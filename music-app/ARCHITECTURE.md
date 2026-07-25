# Crossfade — Technical Architecture

**Status:** Draft v0.1 · **First integration:** Apple Music (MusicKit)

This document explains *how* Crossfade works. It is written so the Apple Music
MVP is fully specified, while every abstraction is shaped to accept a second and
third service with no rework.

---

## 1. System overview

```
┌───────────────────────────────────────────────────────────────┐
│                        Mobile app (client)                     │
│                                                                │
│  UI  ──►  App core (unified library, playlists, search)        │
│                    │                                            │
│                    ▼                                            │
│        PlaybackCoordinator ("the conductor")                   │
│                    │                                            │
│        ┌───────────┼─────────────┐                             │
│        ▼           ▼             ▼                             │
│  AppleMusicAdapter  SpotifyAdapter*  YTMusicAdapter*           │
│  (MusicKit SDK)     (Web SDK)*       (…)*        (*post-MVP)   │
└───────────�────────────────────────────────────────────────────┘
            │  (auth, catalog normalization, storage, matching)
            ▼
┌───────────────────────────────────────────────────────────────┐
│              Crossfade backend (BFF + services)                │
│                                                                │
│  • Auth/token service (developer tokens, secure user-token flow)│
│  • Catalog normalizer (per-service DTO → UnifiedTrack)         │
│  • Matching engine (ISRC-first, fuzzy fallback)               │
│  • Playlist store + sync                                       │
│  • User store                                                  │
└───────────────────────────────────────────────────────────────┘
```

**Client is where playback lives** (SDKs must run on-device). **Backend owns
identity, normalization, matching, and the durable playlist store**, so the
same Crossfade playlist resolves correctly for any listener on any device.

---

## 2. The conductor playback model

This is the heart of the product.

Crossfade never mixes or decodes audio itself. It maintains an **abstract
queue** of `TrackRef`s and delegates actual playback to per-service adapters.

```
interface PlaybackAdapter {
  service: ServiceId
  authorize(): Promise<void>
  isPlayable(ref: TrackRef): Promise<boolean>   // e.g. user has this subscription
  load(ref: TrackRef): Promise<void>            // prepare/pre-warm the track
  play(): Promise<void>
  pause(): Promise<void>
  seek(ms: number): Promise<void>
  onProgress(cb): void
  onEnded(cb): void                             // fires when the track finishes
  teardown(): Promise<void>
}
```

`PlaybackCoordinator` logic:

1. Look at the current `TrackRef` → pick the adapter for `ref.service`.
2. `load()` + `play()` that adapter; route transport controls to it.
3. On `onEnded`, advance the queue.
4. **If the next track uses a different service:** `teardown()` the old adapter,
   `load()`/`play()` the new one. This transition is the **handoff gap**.
5. **Pre-warming:** while track N plays, call `load()` on the *next* track's
   adapter (if different) to shrink the gap.

**Honest limitations (document in UI, don't hide):**
- **No true gapless across services** — an SDK swap can't be sample-accurate.
- **Only one service can hold the audio session at a time** — no true crossfade
  *across services* (crossfade *within* a service may be possible per SDK).
- A track is only playable if the user is authorized/subscribed for that service;
  otherwise the coordinator **skips it** and surfaces a "not playable — you're
  not subscribed to X" note.

For the **Apple Music MVP** there is exactly one adapter, so playback is fully
continuous and none of the handoff caveats apply yet — but the coordinator is
built with the interface above from day one.

### 2.1 Playback modes — and the in-app-first policy

"Hand off to the service's SDK" is not one thing. An adapter can operate in one
of three modes, which differ by **whether the user ever leaves the Crossfade
app**:

| Mode | What the user sees | Example services | Leaves Crossfade? |
|---|---|---|---|
| **A — In-app SDK playback** | Stays 100% in Crossfade; our Now Playing UI drives the audio directly | **Apple Music** (MusicKit) | ❌ Never |
| **B — In-app UI, background broker** | Stays in Crossfade's UI; a service's app is installed and runs in the background doing the actual decode, driven by our controls | **Spotify on iOS** (App Remote SDK) | ❌ Not visually — but requires their app installed |
| **C — Deep-link handoff** | Pressing play **opens the service's own app** | Likely **YouTube Music** (no compliant embeddable playback) | ✅ Yes |

**Policy (product decision):** Crossfade is **in-app-first**. We integrate
services that support **Mode A or Mode B**, where Crossfade owns the playlist,
browsing, and Now Playing experience end-to-end. Both are acceptable — including
Mode B's background-broker dependency (e.g. Spotify requiring its app installed
and a Premium account) — **so long as the user never has to leave Crossfade to
play, pause, skip, or scrub.**

A service that can only be reached in **Mode C** (forcing the user out to a
native app) is **not adopted by default**. It is flagged **"further
investigation / integration"**: we look for any compliant in-app path first, and
only consider a Mode-C fallback as an explicit, clearly-labeled degraded
experience — never the standard one.

**Consequence for mixed playlists:** Mode-A and Mode-B tracks play back-to-back
inside our UI (subject only to the handoff gap below). A Mode-C track, if ever
allowed, would interrupt the in-app session by launching another app — so the
queue must **visibly badge Mode-C tracks** and offer to auto-skip them rather
than surprise the listener mid-playlist. Until a service earns Mode A/B support,
its tracks simply aren't addable to a playable Crossfade queue.

---

## 3. Apple Music integration (MVP, in depth)

### 3.1 The three Apple pieces

| Piece | What it is | Used for |
|---|---|---|
| **Apple Music API** | REST API at `api.music.apple.com` | Catalog search, fetching songs/albums/playlists, reading & writing the user's library |
| **MusicKit (iOS)** | Native framework | On-device authorization + **playback** |
| **MusicKit JS** | Browser SDK | Same, for a future web client |

### 3.2 Authorization — two tokens

1. **Developer Token (app-level).** A JWT you generate, signed with a MusicKit
   private key (`.p8`) from your Apple Developer account.
   - Algorithm **ES256**; header carries `kid` = your **Key ID**.
   - Payload: `iss` = your **Team ID**, `iat`, `exp` (max **6 months** out).
   - **Generated and signed on the backend**, never in the client. The `.p8`
     private key lives only in the backend secret store.
2. **Music User Token (per-user).** Obtained on-device: the user taps "Connect
   Apple Music", MusicKit prompts for permission, and returns a user token
   representing *their* Apple Music account/subscription.
   - Sent with library/playback requests. Stored **securely on-device**
     (iOS Keychain / Secure Enclave-backed), and/or referenced server-side —
     see §7 for the security stance.

### 3.3 What we read

- **Catalog** — `/v1/catalog/{storefront}/search`, `.../songs/{id}`, etc.
  Storefront is derived from the user (e.g. `us`).
- **Library** — `/v1/me/library/...` (the user's songs, albums, playlists).
- **ISRC** — catalog song objects expose the **ISRC**; we persist it on every
  track. This is the linchpin for future cross-service matching (§6).

### 3.4 What we write

- **Create library playlists** — `POST /v1/me/library/playlists`.
- **Add tracks** — `POST /v1/me/library/playlists/{id}/tracks`.
- Design choice: Crossfade playlists are stored **canonically in our backend**
  (so they can be multi-service and portable). We *optionally* mirror a
  single-service playlist back into Apple Music's library when the user asks —
  we don't treat Apple's library as our source of truth.

### 3.5 Playback

- Full-track playback goes through **MusicKit on-device** and requires an
  **active Apple Music subscription**. `AppleMusicAdapter.isPlayable()` checks
  subscription capability before attempting to play.
- Rate limits and error/retry handling live in the adapter + backend client;
  respect `Retry-After`, back off, and never hammer the API.

---

## 4. The service-adapter abstraction (multi-platform readiness)

Every service is reached through **two** parallel abstractions:

- **A catalog/library client** (backend) → normalizes each service's response
  into the shared `UnifiedTrack` / `UnifiedPlaylist` DTOs.
- **A `PlaybackAdapter`** (client) → the conductor interface in §2.

Adding a service = implement one backend client + one client adapter + an OAuth
flow. Nothing in the app core, data model, or UI changes. This is why the MVP,
though Apple-only, is genuinely a multi-platform product and not a rewrite
waiting to happen.

Per-service reality to encode in each adapter (playback mode per §2.1):

| Service | Auth | Playback SDK | Mode | Full playback needs sub? | Adoption |
|---|---|---|---|---|---|
| **Apple Music** | Developer JWT + Music User Token | MusicKit (iOS/JS) | **A** — fully in-app | Yes | ✅ MVP |
| Spotify* | OAuth 2.0 (PKCE) | Web Playback SDK / iOS App Remote SDK | **B** — in-app UI, background broker (their app installed) | Yes (Premium) | ✅ Recommended #2 |
| Tidal / Amazon* | OAuth | Native SDKs | A/B — validate per SDK | Yes | ⏳ Later, if in-app capable |
| YouTube Music* | Google OAuth | No compliant embeddable playback (likely) | **C** — deep-link handoff | Varies | 🔍 **Further investigation** — not adopted unless an in-app (A/B) path is found |

\* post-MVP. Per the **in-app-first policy (§2.1)**, only Mode A/B services are
integrated by default; Mode-C services are flagged for investigation, not shipped
as the standard experience.

---

## 5. Data model (canonical)

```
User
  id, auth (Crossfade account), createdAt

ServiceConnection
  id, userId, service (enum), status,
  # tokens are stored securely — see §7 for where and how
  scopes, storefront/region, connectedAt

UnifiedTrack            # canonical, service-agnostic
  id (Crossfade id)
  isrc                  # primary cross-service key (nullable but strongly preferred)
  title, artists[], album, durationMs, artworkUrl, explicit

TrackMapping            # how a UnifiedTrack maps into each service
  unifiedTrackId
  service
  serviceTrackId        # e.g. Apple Music catalog id
  confidence            # 1.0 for ISRC match, <1.0 for fuzzy
  verifiedByUser        # user can correct a bad mapping

Playlist                # a Crossfade playlist (can be multi-service)
  id, ownerId, title, description, artworkUrl,
  visibility (private/shared), updatedAt

PlaylistItem
  playlistId, position,
  unifiedTrackId,
  preferredService      # optional pin ("always play this from Apple Music")
```

Key idea: **playlists reference `UnifiedTrack`s, not service IDs.** When a
listener opens a playlist, each item resolves through `TrackMapping` to whatever
service *they* have connected — that's what makes playlists portable.

---

## 6. Matching engine (turns a track into a cross-service `UnifiedTrack`)

Order of precedence:

1. **ISRC exact match** — international standard recording code. If two services
   report the same ISRC, it is (almost always) the same recording.
   Confidence = 1.0.
2. **Fuzzy match fallback** (when ISRC missing on one side):
   normalize `title` + `artist` (+ `album`), compare with duration tolerance
   (±~2s), score, and accept above a threshold. Confidence < 1.0.
3. **User correction** — surface low-confidence mappings; let the user pick the
   right track; store `verifiedByUser`.

For the **MVP**, matching is effectively a no-op (one service), but we **persist
ISRCs from day one** so the engine has data to work with the moment a second
service is connected.

---

## 7. Auth, tokens & security

- **Developer/app secrets** (Apple `.p8` key, Spotify client secret, etc.) live
  **only in the backend secret store**. Never shipped in the app binary.
- **Developer Token** minting happens server-side; the client fetches a
  short-lived token from our backend when it needs one.
- **Music User Token / per-user OAuth tokens:**
  - On-device: store in **iOS Keychain** (Secure Enclave-backed where available).
  - If mirrored server-side (needed for server-driven sync/portable playlists),
    store **encrypted at rest**, scoped per user, with rotation and the ability
    to revoke on disconnect.
- **Least privilege** — request only the scopes each feature needs.
- **Disconnect = real revoke** — deleting a `ServiceConnection` wipes stored
  tokens and any cached user-library data for that service.
- **Transport** — TLS everywhere; certificate pinning to our backend for the app.
- **Privacy** — we store references + metadata, never audio. Clear disclosure of
  what each service link shares. GDPR/CCPA delete-my-data path from day one.

---

## 8. Tech stack recommendation

| Layer | Recommendation | Why |
|---|---|---|
| **Mobile app** | **Native iOS (Swift/SwiftUI)** for MVP | MusicKit is a first-class native framework; playback fidelity matters most on the first platform. React Native is viable later but adds a bridge layer over each playback SDK — riskier for the exact thing that's hard. |
| **Backend** | A typed server (TypeScript/Node or Kotlin) as a **BFF** | Owns token minting, normalization, matching, playlist store |
| **Storage** | Postgres | Relational data model (users, mappings, playlists) fits cleanly |
| **Secrets** | Managed secret store (e.g. cloud KMS/secrets manager) | For `.p8` keys and client secrets |

*Decision to confirm:* native-first vs cross-platform-first. Recommended:
**native iOS first** (fastest path to a flawless MusicKit experience), then
evaluate React Native / a native Android app when adding the second service.
See open questions in [`ROADMAP.md`](./ROADMAP.md).

---

## 9. How this maps back to the risks

- *Losing a service's API access* → adapter isolation; the app degrades to the
  remaining services instead of breaking.
- *Handoff gap* → pre-warming + honest UI; single-service playback stays perfect.
- *Wrong track matched* → ISRC-first + confidence + user correction.
- *App Store review* → MVP is 100% MusicKit-compliant, no competing service in
  the first submission.

Next: sequencing and the decisions needed before code — [`ROADMAP.md`](./ROADMAP.md).
