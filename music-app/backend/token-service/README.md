# Crossfade — token-service (BFF)

A small TypeScript BFF that implements [`../TOKEN_SERVICE.md`](../TOKEN_SERVICE.md):
it signs Apple Music **developer tokens**, **vends** short-lived ones to the app for
MusicKit, stores per-user **Music User Tokens** encrypted at rest, and **brokers**
catalog/library reads server-side.

Stack: [Hono](https://hono.dev) (HTTP) · [jose](https://github.com/panva/jose)
(ES256 JWT signing) · [zod](https://zod.dev) (validation) · Node ≥ 20 crypto
(AES-256-GCM envelope encryption) · [vitest](https://vitest.dev) (tests).

## Quick start

```bash
npm install
npm test           # unit + HTTP tests, no network or real Apple keys needed
npm run typecheck  # tsc --noEmit
npm run dev        # boots on :8787; prints a dev session token to curl with
```

In development, missing secrets (`.p8`, KMS key, session secret) are replaced with
**ephemeral dev values** and a warning, so it runs out of the box. Copy
`.env.example` → `.env` and fill in real values for anything beyond local testing.
In `NODE_ENV=production` those secrets are **required**.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness (no auth) |
| `GET` | `/v1/apple-music/developer-token` | Vend a short-lived developer token for MusicKit (rate-limited) |
| `POST` | `/v1/apple-music/connections` | Connect: store the Music User Token, return entitlement (R1) |
| `POST` | `/v1/apple-music/connections/refresh` | Re-validate the stored token |
| `DELETE` | `/v1/apple-music/connections` | Disconnect (real revoke) |
| `GET` | `/v1/apple-music/search?q=` | Brokered catalog search (R3) |
| `GET` | `/v1/apple-music/library/playlists` | Brokered library read (import, R2) |
| `GET` | `/v1/apple-music/library/playlists/:id/tracks` | Brokered playlist tracks (R2) |

Every `/v1` route requires a Crossfade session: `Authorization: Bearer <jwt>`.

### Try it

```bash
# after `npm run dev`, copy the printed dev session token into $S
curl -s localhost:8787/v1/apple-music/developer-token -H "Authorization: Bearer $S"

curl -s -X POST localhost:8787/v1/apple-music/connections \
  -H "Authorization: Bearer $S" -H 'Content-Type: application/json' \
  -d '{"musicUserToken":"mut-abc","canPlayCatalogContent":true}'
```
(The connect/search calls reach the real Apple Music API only when configured with a
valid `.p8` and a genuine Music User Token; with the ephemeral dev key Apple will
reject them — the token *minting* and all local logic still work and are tested.)

## Layout

```
src/
  app.ts               Hono app factory (pure over deps → fully testable)
  index.ts             compose real deps + serve
  config.ts            env loading with dev fallbacks
  errors.ts            ApiError + the §5.6 error model
  rateLimit.ts         fixed-window limiter for the developer-token endpoint
  auth/session.ts      Crossfade session (HS256) verification
  apple/
    developerToken.ts  ES256 JWT signing + internal-token cache
    appleMusicApi.ts   Apple Music API client (interface + HTTP impl)
    broker.ts          AppleMusicBroker: vend / connect / refresh / disconnect / reads
  broker/types.ts      ServiceCredentialBroker (Spotify slots in here later)
  crypto/envelope.ts   Kms interface + LocalKms + envelope encrypt/decrypt
  store/credentialStore.ts  CredentialStore interface + in-memory impl
test/                  envelope, developer-token signing, and full HTTP API tests
```

## Production checklist (not done here — this is a skeleton BFF)

- Replace `InMemoryCredentialStore` with Postgres (`service_credential` table).
- Replace `LocalKms` with a real cloud KMS.
- Move the rate limiter to a shared store (Redis) so limits hold across instances.
- Add key rotation (two active `kid`s) per TOKEN_SERVICE.md §4.
- Wire real Crossfade account issuance for the session JWTs.
