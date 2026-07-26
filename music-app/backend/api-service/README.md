# Crossfade — api-service

Implements the Phase-1 endpoints from [`../api/openapi.yaml`](../api/openapi.yaml)
that the token-service doesn't cover: **services (R5), unified library (R4),
cross-platform search (R3), playlists + items (R4), import (R2), sync (R2), and
per-listener playback resolution (R1)**.

Stack: Hono · jose (session verify) · zod · Node ≥ 20 · vitest.

## Run

```bash
npm install
npm test           # 9 tests: services, playlists, items, queue (R1), search, import, sync
npm run typecheck
npm run start      # boots on :8788 with seeded demo data; prints a dev session token
```

The service runs against **in-memory stores + a mock provider gateway** (which
stands in for the token-service's brokered reads), so it works standalone. Try it:

```bash
# copy the printed session into $S
curl -s localhost:8788/v1/services            -H "Authorization: Bearer $S"
curl -s localhost:8788/v1/playlists           -H "Authorization: Bearer $S"
curl -s "localhost:8788/v1/search?q=midnight" -H "Authorization: Bearer $S"
curl -s localhost:8788/v1/playlists/<id>/queue -H "Authorization: Bearer $S"
```

## The interesting endpoint: `GET /playlists/{id}/queue`

This is the server-side mirror of `CrossfadeKit`'s `PlaybackCoordinator` skip logic.
It resolves each playlist item to the service **this listener** can play and returns
ordered `QueueTrack`s with a `playable` flag and `blockedReason` (R1). With the demo
data (Apple Music subscribed, Spotify on Free):

```
Midnight Signal -> appleMusic playable=true          (also on Apple via shared ISRC)
Neon Tide       -> appleMusic playable=true
Coast Road      -> spotify    playable=false (notSubscribed)   (Spotify-only, Free plan)
```

That's the whole product thesis in one response: a mixed-source playlist resolves to
what you can actually play, and honestly flags what you can't.

## How it relates to the other services

- **Auth:** verifies the same Crossfade session JWT the `token-service` issues.
- **Provider reads:** the `ProviderGateway` interface is implemented here by a mock;
  in production it calls the token-service's brokered endpoints (developer token +
  the user's stored token attached server-side).
- **Sync:** `POST /playlists/{id}/sync` runs the same `reconcile` the `sync-worker`
  runs on a schedule.

## Layout

```
src/
  app.ts                 Hono app factory — all routes (pure over deps → testable)
  index.ts / seed.ts     compose + serve with seeded demo data
  domain.ts              contract types (would be @crossfade/core in a monorepo)
  presenters.ts          serialize to the OpenAPI response shapes
  auth/session.ts        Crossfade session (HS256) verification
  pagination.ts          cursor pagination helpers
  catalog/
    supportedServices.ts R5 registry
    unifiedTrackCatalog.ts  ISRC-first library/catalog store
    reconcile.ts         R2 reconciliation (shared with sync-worker)
  stores/stores.ts       PlaylistStore + ConnectionStore (in-memory)
  providers/providerGateway.ts  ProviderGateway interface + mock
  services/              queueResolver (R1), searchService (R3), importService (R2), syncService (R2)
test/                    full HTTP API tests
```

## Production checklist (skeleton)

- Replace in-memory stores with Postgres; back the catalog with the durable store.
- Replace `MockProviderGateway` with a client of the token-service brokered reads.
- Add idempotency-key handling, ETag/`If-Match` for the 409 path, and real rate limits.
