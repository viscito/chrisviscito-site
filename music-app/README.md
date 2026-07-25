# Crossfade — Multi-Platform Music App

> **Working codename:** *Crossfade* (placeholder — swap for the real name once decided).

A mobile app that lets you **link multiple streaming services** (Apple Music
first, others to follow) and **build playlists that mix tracks from any of
them**. You get one library, one search box, and one playlist — even though the
audio is legally sourced from each platform's own player.

---

## The one thing that shapes everything

You **cannot** legally play audio from one service inside another service's
player. Apple Music tracks play through Apple's MusicKit; Spotify tracks play
through Spotify's SDK; and so on. Each also generally requires the user to hold
a **paid subscription** to that service.

So Crossfade is **not** a universal audio player with one decoder. It is a
**conductor**: it keeps an abstract, unified playlist, and when a track plays it
hands off to the correct service's playback SDK. The listener experiences one
continuous playlist; the audio is always sourced legally from the platform that
owns it.

**In-app-first policy:** Crossfade always owns the playlist, browsing, and Now
Playing experience — the user stays *visually* inside Crossfade to play, pause,
skip, and scrub. We integrate services that support this (Apple Music plays fully
in-app; Spotify plays via its app running in the background, controlled from our
UI). Any service that would force the user *out* to its own app is **flagged for
further investigation, not adopted by default.** See the three playback modes in
[`ARCHITECTURE.md`](./ARCHITECTURE.md#21-playback-modes--and-the-in-app-first-policy).

That single constraint drives the entire architecture. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md#the-conductor-playback-model).

---

## What's realistic to build

| Capability | Feasible? | Notes |
|---|---|---|
| Unified library across linked services | ✅ | Read each service's catalog + user library via its API |
| One search box across all services | ✅ | Fan-out search, de-duplicate by ISRC |
| Cross-service playlists (mixed tracks) | ✅ | Store references; play via each service's SDK |
| Cross-service track matching / migration | ✅ | ISRC-first, fuzzy fallback |
| Seamless single-player playback of a mixed playlist | ⚠️ | Works, but with a short **handoff gap** at each service boundary; true gapless across services is impossible |
| Downloading / caching audio from a service | ❌ | Prohibited by every major service's ToS |
| Playing a service you don't subscribe to | ❌ | Full-track playback requires that service's subscription |

---

## Clickable prototype

A working, clickable mobile prototype (mock data — no real streaming
connections) lives in [`prototype/index.html`](./prototype/index.html). Open it
in a browser and tap through: onboarding, the supported-services browser, the
library, cross-platform search, playlist import, a mixed-service playlist, and
Now Playing with the signature "crossfader" handoff. Each screen maps to a
requirement (R1–R5) via the annotation rail.

## Documents in this folder

1. **[`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md)** — what we're building and for whom:
   users, features, MVP scope, screens, business model, non-goals.
2. **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — how it works: the conductor
   playback model, Apple Music integration in depth, the service-adapter
   abstraction, data model, matching engine, auth/token handling, security.
3. **[`ROADMAP.md`](./ROADMAP.md)** — phased build plan, milestones, and the
   open questions that need answers before coding.

---

## Status

Idea stage. This is a design deliverable — no application code yet. It lives on
the `claude/multi-platform-music-app-1unope` branch and does **not** touch the
`chrisviscito.com` voice-over site on `main`.
