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
- Add **Spotify** (recommended second — best-documented SDK/API) *or*
  validate **YouTube Music** feasibility first if catalog breadth is the priority.
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
2. **Second service** — Spotify (best tooling) or YouTube Music (biggest catalog,
   riskier API) after Apple Music?
3. **Playlist source of truth** — confirm the recommended model: Crossfade
   backend is canonical, with *optional* mirroring back into each service's
   native library. (vs. treating each service's library as truth.)
4. **Business model** — confirm freemium; what sits behind the paywall
   (unlimited playlists? migration? collaboration?).
5. **Name & brand** — is "Crossfade" a keeper or a placeholder?
6. **Accounts** — does Crossfade need its own login/account (recommended, so
   playlists sync across devices and are portable), or is it device-local at first?

---

## What I can produce next (pick any)

- A **clickable prototype** (mock data) of the Apple Music MVP screens.
- A **backend API contract** (endpoints + request/response schemas) for Phase 1.
- A concrete **Swift/SwiftUI project skeleton** with the `PlaybackAdapter` /
  `PlaybackCoordinator` interfaces stubbed.
- A **landing / waitlist page** to validate demand before building.
- A deeper **Apple Music integration spec** (exact endpoints, token-signing
  reference, error/rate-limit handling).
