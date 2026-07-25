# Crossfade — Credential & Token Service

**Status:** Draft v0.1 · **Scope:** the backend service that authorizes Crossfade
to the Apple Music API and hands the iOS app what MusicKit needs — designed as the
first implementation of a general **credential broker** that later services
(Spotify, etc.) slot into.

Read alongside [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §3 (Apple Music) and §7
(auth & security).

---

## 1. Why this service exists

Three things force a backend — none of them can live on the device:

1. **The signing key must stay secret.** Apple Music developer tokens are JWTs
   signed with a MusicKit private key (`.p8`). If that key shipped in the app it
   could be extracted and abused, so **signing happens server-side only**.
2. **Kept-in-sync imports (R2) need server-side work.** Reconciling an imported
   playlist against its source on a schedule requires a stored user token and a
   job runner — there is no device awake to do it.
3. **Portable playlists + matching** resolve per-listener from server-owned
   mappings, so the catalog/library reads that feed them belong on the backend.

The device still runs MusicKit for **playback** (Mode A) — that part can't move to
the server. So the service does two jobs: **vend** a short-lived developer token to
the app for MusicKit, and **broker** server-side Apple Music API calls itself.

---

## 2. The two Apple tokens (recap)

| Token | Scope | Who makes it | Lifetime | Header |
|---|---|---|---|---|
| **Developer token** | App-level | **This service** (signs a JWT) | ≤ 6 months (we issue much shorter) | `Authorization: Bearer <dev-token>` |
| **Music User Token** | Per-user | The **device** (MusicKit authorization) | Long-lived, opaque | `Music-User-Token: <user-token>` |

Personalized/library requests need **both** headers. Catalog-only requests need
just the developer token.

---

## 3. Design decision — hybrid (vend + broker)

Two extremes, and the recommended middle:

- **Token vending only** — backend returns a developer token; the app calls the
  Apple Music API directly. Simple, but the token lives on many devices and we
  lose central caching/rate-limit control.
- **Full proxy** — the app never sees the developer token; the backend proxies
  every call. Maximum control, but can't cover the on-device MusicKit playback
  path, which *requires* a developer token in the app.

**Recommended (hybrid):**
- **Vend** a short-lived developer token (≈12 h) to the app **only** for MusicKit
  authorization + playback.
- **Broker** all catalog/library reads (search, import, sync) through the backend
  using its own developer token + the user's stored token, so we get caching,
  centralized backoff, and the data needed for matching/sync.

This bounds blast radius (a leaked vended token expires in hours and can't touch
the signing key) while keeping the heavy lifting server-side.

---

## 4. Signing the developer token

Inputs, all from the secret store (never the repo/binary):

| Name | What | Example |
|---|---|---|
| `APPLE_TEAM_ID` | 10-char Apple Developer Team ID → JWT `iss` | `A1B2C3D4E5` |
| `APPLE_MUSICKIT_KEY_ID` | 10-char Key ID of the MusicKit key → JWT header `kid` | `ABC123DEFG` |
| `APPLE_MUSICKIT_P8` | The EC P-256 private key (PKCS#8, from the `.p8`) | `-----BEGIN PRIVATE KEY----- …` |

JWT shape:

```
header  = { "alg": "ES256", "kid": APPLE_MUSICKIT_KEY_ID }
payload = { "iss": APPLE_TEAM_ID, "iat": now, "exp": now + ttl }   // ttl ≤ 15777000s (6 months)
signature = ES256(base64url(header) + "." + base64url(payload), p8PrivateKey)
```

Reference (TypeScript / `jose`):

```ts
import { SignJWT, importPKCS8 } from "jose";

// ttlSeconds: 43200 (12h) for tokens vended to the app; longer for the backend's
// own internal token. Never exceed 15777000 (Apple's 6-month cap).
export async function mintAppleDeveloperToken(ttlSeconds: number): Promise<string> {
  const key = await importPKCS8(process.env.APPLE_MUSICKIT_P8!, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_MUSICKIT_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}
```

**Caching:** minting is cheap, but don't sign per request under load. Keep one
**internal** token cached in memory/Redis, refreshed when it's within a day of
expiry. Vended (app-facing) tokens are minted fresh with the shorter TTL and may
be cached per-TTL-window.

**Rotation without downtime:** support two active keys. `signing_keys` table holds
`(kid, not_before, not_after, secret_ref)`; sign with the newest valid key. To
rotate: add a new MusicKit key in the Apple Developer portal, insert it, let it
become primary, retire the old one after existing vended tokens expire.

---

## 5. HTTP API

All endpoints require an authenticated **Crossfade session** (the user's own
Crossfade account JWT in `Authorization`) — this is separate from the Apple tokens
and prevents anonymous harvesting of developer tokens. All responses are JSON; all
traffic TLS-only; the app pins our cert.

### 5.1 Vend a developer token (for MusicKit)

```
GET /v1/apple-music/developer-token
Authorization: Bearer <crossfade-session-jwt>

200 OK
{ "token": "<apple-developer-jwt>", "expiresAt": "2026-07-25T21:00:00Z" }
```
- Rate-limited per user (e.g. 30/hour). The app caches until `expiresAt` and
  refreshes ahead of expiry.

### 5.2 Connect Apple Music (store the user token)

The device runs MusicKit authorization, obtains the Music User Token, checks
`MusicSubscription.canPlayCatalogContent`, then:

```
POST /v1/apple-music/connections
Authorization: Bearer <crossfade-session-jwt>
{ "musicUserToken": "<opaque>", "canPlayCatalogContent": true, "storefront": "us" }

201 Created
{ "service": "appleMusic", "entitlement": "active", "storefront": "us",
  "connectedAt": "2026-07-25T20:41:00Z" }
```
- Backend **validates** the token by calling `GET https://api.music.apple.com/v1/me/storefront`
  with the dev token + the supplied user token; non-200 ⇒ `400 invalid_user_token`.
- `entitlement` = `active` when `canPlayCatalogContent` is true, else
  `insufficientPlan` (R1). Subscription capability is authoritative on-device and
  reported here; the backend re-checks token liveness, not the plan.
- The user token is **encrypted at rest** (envelope encryption via KMS) before
  storage. It is never returned to any client again.

### 5.3 Refresh entitlement / re-validate

```
POST /v1/apple-music/connections/refresh   → 200 { entitlement, storefront, validatedAt }
```
Used on app launch and before a sync run to catch expired tokens or plan changes.

### 5.4 Disconnect

```
DELETE /v1/apple-music/connections   → 204 No Content
```
Deletes the stored (encrypted) user token **and** any cached library data for the
service. This is a real revoke, per the privacy stance in ARCHITECTURE §7.

### 5.5 Brokered catalog/library reads

These run server-side with the backend's dev token (+ the stored user token where
personalized) and return Crossfade's normalized DTOs — feeding search (R3), import
(R2), and matching. They mirror `MusicServiceClient` in `CrossfadeKit`.

```
GET /v1/apple-music/search?q=midnight            → { tracks: ProviderTrack[] }
GET /v1/apple-music/library/playlists            → { playlists: ProviderPlaylist[] }
GET /v1/apple-music/library/playlists/{id}/tracks → { tracks: ProviderTrack[] }
```
`ProviderTrack` carries the **ISRC** (`song.attributes.isrc`) so the matching
engine can canonicalize immediately.

### 5.6 Error model

| HTTP | `error` | When |
|---|---|---|
| 401 | `unauthenticated` | Missing/invalid Crossfade session |
| 400 | `invalid_user_token` | Apple rejected the supplied Music User Token |
| 402 | `insufficient_plan` | Action needs an active subscription (R1) |
| 429 | `rate_limited` | Our limit or Apple's — includes `Retry-After` |
| 502 | `upstream_apple_error` | Apple Music API failure (with request id) |

---

## 6. Data model (server-side additions)

```
signing_keys
  kid (pk), service='appleMusic', alg='ES256',
  secret_ref (KMS/secret-manager pointer, NOT the key itself),
  not_before, not_after

service_credential
  user_id, service,                         # (user_id, service) unique
  encrypted_user_token (bytea),             # envelope-encrypted; Apple = Music User Token
  entitlement ('active'|'insufficientPlan'|'unknown'),
  storefront, scopes[], updated_at, revoked_at
```
The signing key material lives in **KMS / a secrets manager**; `secret_ref` is only
a pointer. Tokens in `service_credential` are encrypted with a per-record data key
wrapped by KMS.

---

## 7. Key flows

**App launch**
```
App → (Crossfade session) → GET /developer-token → {token, expiresAt}
App → MusicKit.configure(developerToken) → ready to authorize/play
```

**Connect**
```
App → MusicKit authorize (device) → Music User Token + canPlayCatalogContent
App → POST /connections {userToken, canPlay, storefront}
Backend → validate via /v1/me/storefront → encrypt+store → return entitlement
```

**Kept-in-sync import (R2), scheduled**
```
Job → load service_credential (decrypt user token) → GET library playlists/tracks
    → normalize (ISRC) → MatchingEngine.unify → reconcile Crossfade playlist
    → update PlaylistSource.lastSyncedAt
```

---

## 8. Security & operations

- **Secrets:** `.p8`, KMS keys, and the Crossfade session-signing secret live only
  in the secret store. CI/CD injects them at deploy; they never touch the repo.
- **Least privilege / short TTLs:** vended dev tokens ≈12 h; internal token
  refreshed proactively; user tokens encrypted, per-user, revocable.
- **No token logging.** Redact `Authorization`, `Music-User-Token`, and token
  bodies from logs and error reports.
- **Central rate-limit/backoff:** honor Apple's `Retry-After`; cache catalog
  responses (keyed by storefront+query) so all users share the budget.
- **Auditing:** log connect/disconnect/refresh events (user id + service, never
  token values) for the privacy/delete-my-data path.

---

## 9. Generalizing to other services

This is a **credential broker** with a per-service strategy. Apple Music mints a
JWT; the next services exchange OAuth codes and refresh tokens. Same endpoints
(`/v1/{service}/connections`, brokered reads), different broker implementation.

| Service | Broker type | App-facing token | Backend holds |
|---|---|---|---|
| **Apple Music** | JWT signer | short-lived developer token | `.p8` signing key + user token |
| Spotify (next) | OAuth 2.0 (PKCE) | access token (short) | client secret + refresh token |
| Amazon / others | OAuth | access token | client secret + refresh token |

Define one interface so the app core never learns the difference:

```ts
interface ServiceCredentialBroker {
  service: ServiceID;
  vendClientToken(userId: string): Promise<{ token: string; expiresAt: string }>;
  connect(userId: string, payload: ConnectPayload): Promise<Connection>;
  refresh(userId: string): Promise<Connection>;
  disconnect(userId: string): Promise<void>;
}
```

`AppleMusicBroker` implements it with §4's signing + §5's endpoints; a
`SpotifyBroker` implements it with OAuth token exchange/refresh — no change to the
API surface or the client.

---

## 10. Open questions

1. **Crossfade accounts** — the developer-token endpoint assumes a Crossfade
   session. Confirm we ship our own account system in Phase 1 (recommended in the
   roadmap) so token vending is authenticated from day one.
2. **Vended-token TTL** — 12 h is a starting point; tune against MusicKit's
   re-auth UX so users aren't re-prompted.
3. **Where sync runs** — confirm a scheduled job runner (e.g. cron/worker) for R2
   reconciliation, and its cadence.
