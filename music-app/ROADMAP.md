# Crossfade — Roadmap & Open Questions

**Status:** Draft v0.1

---

## Phased build plan

### Phase 0 — Foundations & decisions (before any app code)
- Lock the **name**, confirm the **business model** (recommended: freemium).
- Confirm **native iOS first** vs cross-platform (see open questions).
- Enroll in the **Apple Developer Program**; create a **MusicKit identifier**
  and **private key (`.p8`)** for developer-token signing.
- Stand up the backend skeleton + secret store; implement **developer-token
  minting** as the very first backend endpoint (everything Apple depends on it).

### Phase 1 — Apple Music MVP (single service)
1. **Connect Apple Music** flow — MusicKit authorization → Music User Token →
   secure storage.
2. **Read** — catalog search + user library, normalized into `UnifiedTrack`
   (persist **ISRC** on every track).
3. **Playlists** — create Crossfade playlists, add/reorder/remove tracks
   (stored canonically in our backend).
4. **Playback** — `PlaybackCoordinator` + `AppleMusicAdapter` over MusicKit;
   full Now Playing transport; subscription check.
5. **Settings** — disconnect (real token revoke), privacy/data controls.
6. Polish onboarding; ship a private TestFlight.

**Exit criteria:** a user links Apple Music, builds a playlist from catalog +
library, and plays it end-to-end in-app.

### Phase 2 — Turn the conductor "on" (second service)
- Add **Spotify** — recommended second. It's **Mode B** (§2.1 of ARCHITECTURE):
  in-app UI with a background broker, which satisfies the **in-app-first policy**
  (Crossfade owns playlist, browsing, and Now Playing; Spotify's app runs in the
  background). YouTube Music is **not** a Phase-2 candidate — it looks like
  **Mode C** (forces users out to its app) and is flagged for **further
  investigation** unless a compliant in-app path is found.
- Implement its backend client + `PlaybackAdapter` + OAuth (PKCE) flow.
- Ship the **matching engine** for real: ISRC-first, fuzzy fallback, user
  correction UI.
- Enable **mixed playlists** + the handoff-gap UX (pre-warming, source badges).
- **Migration**: mirror a playlist from one service into another.

### Phase 3 — Portability & social
- **Portable shared playlists** — a shared playlist resolves each track to the
  *listener's* connected service via `TrackMapping`.
- Collaborative playlists; basic discovery/recommendations; Android client.

---

## Open questions (need your answers before Phase 1)

1. **Platform strategy** — Native iOS first (recommended, fastest to a flawless
   MusicKit experience), or cross-platform (React Native) from the start to reach
   Android sooner? This affects Phase 1 tooling.
2. **Second service** — Spotify is the recommended #2: it's **Mode B / in-app**,
   satisfying the in-app-first policy. (YouTube Music is deferred to "further
   investigation" because it appears to force users out of the app — Mode C.)
   Confirm Spotify, or name another **in-app-capable** service to prioritize.
3. **Playlist source of truth** — confirm the recommended model: Crossfade
   backend is canonical, with *optional* mirroring back into each service's
   native library. (vs. treating each service's library as truth.)
4. **Business model** — confirm freemium; what sits behind the paywall
   (unlimited playlists? migration? collaboration?).
5. **Name & brand** — is "Crossfade" a keeper or a placeholder?
6. **Accounts** — does Crossfade need its own login/account (recommended, so
   playlists sync across devices and are portable), or is it device-local at first?

---

## Built so far

- ✅ **Clickable prototype** (mock data) — [`prototype/`](./prototype/).
- ✅ **Swift skeleton** — [`ios/`](./ios/): the `PlaybackCoordinator` /
  `PlaybackAdapter` conductor, data model, matching engine (unit-tested), the R5
  registry, and a SwiftUI app with a MusicKit `AppleMusicAdapter`.

- ✅ **Token/credential service spec** — [`backend/TOKEN_SERVICE.md`](./backend/TOKEN_SERVICE.md):
  Apple Music developer-token signing, token vending for MusicKit, secure user-token
  storage, and the general credential-broker interface.
- ✅ **Token service implementation** — [`backend/token-service/`](./backend/token-service/):
  a working TypeScript BFF (Hono + jose), green test suite, real Apple call path.

## What I can produce next (pick any)

- Implement the **kept-in-sync reconciliation engine** (R2) in `CrossfadeKit`.
- The **full Phase-1 API contract** (playlists, unified library, sync jobs) beyond
  the token service.
- Wire the **real MusicKit path** end-to-end (developer-token service + entitlement).
- A **landing / waitlist page** to validate demand before building.
- A deeper **Apple Music integration spec** (exact endpoints, token-signing
  reference, error/rate-limit handling).
