# Crossfade — Product Specification

**Status:** Draft v0.1 · **Working codename:** Crossfade · **First platform:** Apple Music

---

## 1. Problem

People's music lives in silos. A song someone loves might be on Apple Music,
a friend's mix is a Spotify link, a rare live set is only on YouTube Music.
Today you can't build a single playlist that draws from all of them, and moving
playlists between services is painful and lossy.

## 2. Product vision

**One place to link all your music services, and one playlist that can hold a
song from any of them.** Crossfade unifies discovery, library, and playlist
*organization* across services, while respecting that playback stays inside each
service's own player.

## 3. Who it's for

| Segment | Why they care |
|---|---|
| **Multi-service households / people mid-switch** | Have (or are moving between) two services and want their playlists to survive |
| **Playlist curators** | Want to build the best possible playlist regardless of which service has the track |
| **Music enthusiasts** | Want the widest catalog reach and clean cross-service search |
| **Sharers** | Want to share a playlist that a friend can play *on whatever service they have* |

## 4. Core value propositions

1. **Unified playlists** — mix tracks from any linked service in one list.
2. **Universal search & library** — search once, see results across everything.
3. **Portable playlists** — a Crossfade playlist auto-resolves each track to
   whatever service the *listener* is subscribed to (via ISRC matching), so a
   shared playlist "just plays" for them.
4. **Painless migration** — mirror a playlist from one service to another in a tap.

## 5. Functional requirements (v0.2 — locked)

These are committed product requirements. Each notes how it behaves given the
in-app-first policy (§9) and the Apple-Music-first build order.

**R1 — Provider requirements are enforced.** A user can only *use* a linked
service if they meet that provider's requirements (e.g. **Apple Music
subscription**, **Spotify Premium**). Crossfade checks the account's
subscription/entitlement on link and before playback; if the requirement isn't
met, the service is shown as **linked but not playable**, with a clear prompt
explaining what's needed. Crossfade never provides music itself — it always sits
on top of the user's own paid subscription.

**R2 — Import existing playlists (kept in sync).** Users can **import their
current playlists** from any linked service into Crossfade. Import reads the
source playlist, resolves each track to a `UnifiedTrack` (ISRC-first), and creates
a Crossfade playlist that **stays linked to the source and tracks changes over
time** (decision: synced, not a one-time snapshot). This requires a sync engine
with periodic reconciliation and conflict handling — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and the roadmap; it is a Phase-2-grade
capability, mocked in the prototype.

**R3 — Cross-platform search.** Users can **search for music across every linked /
available platform** from one search box. Results fan out to each connected
service, are de-duplicated by ISRC, and each result shows which service(s) can
play it.

**R4 — Provider identification on every track.** Every track in a playlist (and in
search/library) carries the **source provider's identifying logo/badge**, so the
user always knows where a given song is coming from and which service will play
it.

**R5 — Supported-services browser.** Users can **browse the top 5 US music
streaming services** and see, for each, whether it's **supported in Crossfade**
(supported now / planned / under investigation / not supported), with a short
reason tied to the in-app-first policy (§9).

---

## 6. MVP scope (Apple Music only)

The MVP proves the model with a **single service** so the hard parts —
authorization, catalog normalization, library sync, playlist CRUD, and
in-app playback via a service SDK — are solved once before generalizing.

**In scope for MVP:**
- Link an Apple Music account (authorize, store Music User Token securely).
- Browse & search the Apple Music catalog and the user's library.
- Create Crossfade playlists and add catalog/library tracks to them.
- Play a Crossfade playlist in-app through MusicKit (requires an active
  Apple Music subscription).
- Every track stored with its **ISRC** + normalized metadata, so the data is
  already multi-service-ready even though only one service is wired up.

**Explicitly deferred to post-MVP:**
- A second service (Spotify or YouTube Music) — this is what turns the conductor
  model "on." Designed for now, built next.
- Cross-service matching UI, migration, collaborative playlists, social sharing.
- Recommendations / algorithmic discovery.

## 7. Non-goals (things we will NOT do)

- ❌ Decrypt, download, cache, or re-host audio from any service.
- ❌ Play a service's full tracks without that service's SDK/subscription.
- ❌ Bypass or proxy around any platform's Terms of Service or API limits.
- ❌ Be a "free music" app. Crossfade sits *on top of* paid subscriptions.

## 8. Key screens (MVP)

1. **Onboarding / Connect Services** — big "Connect Apple Music" button; explains
   what's shared and that a subscription is needed for playback **(R1)**.
2. **Supported services** — browse the top 5 US streaming services and each one's
   support status in Crossfade **(R5)**.
3. **Home / Library** — unified view; for MVP shows Apple Music library + your
   Crossfade playlists. A per-track **provider logo** shows its source **(R4)**.
4. **Import playlists** — pick playlists from a linked service and import them into
   Crossfade **(R2)**.
5. **Search** — one search box across all linked platforms; results deduped, each
   showing its provider **(R3, R4)**; add-to-playlist action.
6. **Playlist detail** — reorder, remove, play. Each row shows its **provider
   logo** **(R4)**.
7. **Now Playing** — standard transport (play/pause/skip/scrub), plus a subtle
   indicator of which service is currently providing audio.
8. **Settings** — manage linked services, disconnect, privacy controls.

## 9. The playback experience (and its honest limitation)

**Product principle — in-app-first.** Crossfade owns the playlist, browsing, and
Now Playing experience. The user stays visually inside Crossfade to control
playback; they are never bounced out to a service's app for normal listening. We
integrate services that allow this (Apple Music: fully in-app; Spotify: in-app UI
with its app brokering audio in the background — acceptable). A service that
would require *leaving* Crossfade to play is **marked for further investigation
and not integrated by default.** (Technical detail: the three playback modes are
in [`ARCHITECTURE.md`](./ARCHITECTURE.md#21-playback-modes--and-the-in-app-first-policy).)

A mixed playlist plays top-to-bottom through one Now Playing UI. When the queue
crosses from a track on Service A to a track on Service B, there is a **brief
handoff gap** (the app tears down one player and spins up the other). Within a
single service, playback is normal. We set expectations in the UI rather than
pretend it's gapless. For the MVP (Apple Music only) there are no cross-service
boundaries, so playback is fully continuous.

## 10. Business model (options to decide)

- **Freemium subscription** — free to link + organize; paid tier for unlimited
  playlists, migration, collaborative playlists, larger sync. *(Recommended.)*
- **One-time purchase** — simpler, weaker recurring revenue.
- No ads. Handling audio-adjacent ads across services is a legal minefield and
  hurts trust.

*Note:* Crossfade never resells music, so revenue comes from the organization/
utility layer, not the audio.

## 11. Success metrics

- Activation: % of installs that link ≥1 service.
- Core action: playlists created & tracks added per active user.
- The multi-service moment (post-MVP): % of users who link a **2nd** service.
- Retention: W1 / W4 retention of users who created ≥1 playlist.

## 12. Major risks

| Risk | Mitigation |
|---|---|
| Platform ToS / API access revoked | Stay strictly within each API's allowed use; no scraping; adapter isolation so losing one service doesn't break the app |
| Playback handoff gap feels janky | Set expectations in UI; pre-warm the next adapter; keep single-service playback flawless |
| Requires users to already pay for services | Target exactly those users; be clear it's an *organizer*, not a music source |
| Matching errors (wrong track resolved) | ISRC-first matching; show confidence; let users correct a mapping |
| App Store review friction (Apple + a competitor's music) | MVP is Apple-Music-only, fully MusicKit-compliant; introduce others carefully |

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how each of these is handled
technically, and [`ROADMAP.md`](./ROADMAP.md) for sequencing and open questions.
