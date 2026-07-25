# Crossfade — sync-worker

The worker that **drives** the R2 kept-in-sync reconciliation on a schedule. For
each imported playlist it reads the source's current tracks (through the
token-service's brokered library endpoint), runs the reconciliation engine, and
persists the diff.

It pairs with:
- **`CrossfadeKit/Sync/PlaylistSyncEngine`** (Swift) — the same reconciliation logic
  on-device; `reconcile.ts` here is the server-side TypeScript port.
- **`../token-service`** — supplies the source tracks via
  `GET /v1/{service}/library/playlists/{id}/tracks` (developer token + the user's
  stored Music User Token attached server-side, so the worker never touches
  provider credentials).

## Run

```bash
npm install
npm test           # 11 tests: reconcile parity, runner behavior, HTTP reader
npm run typecheck

# DEMO (no token-service needed): an in-memory playlist whose source mutates each
# tick, so you can watch diffs flow.
SYNC_INTERVAL_MS=500 npm run worker

# Against a real token-service:
TOKEN_SERVICE_URL=http://localhost:8787 WORKER_SESSION_TOKEN=<crossfade-session> \
  SYNC_INTERVAL_MS=300000 npm run worker
```

Sample demo output:

```
[worker] run: reconciled=1 changed=0 failed=0 [ 'Late Night Drive: +0 -0 reorder=false' ]
[worker] run: reconciled=1 changed=1 failed=0 [ 'Late Night Drive: +1 -0 reorder=false' ]
[worker] run: reconciled=1 changed=1 failed=0 [ 'Late Night Drive: +0 -0 reorder=true' ]
[worker] run: reconciled=1 changed=1 failed=0 [ 'Late Night Drive: +0 -1 reorder=false' ]
```

## Design notes

- **One failing playlist never aborts the run** — its error is captured in the run
  report and the rest still process.
- **Shared catalog = stable identity.** `UnifiedTrackCatalog` de-dups by ISRC, so
  ingesting the same recording across runs yields the same `UnifiedTrack.id` — which
  is what lets the engine recognize a source track as an existing item instead of a
  churn of add+remove. In production this catalog is the durable unified-track store.
- **Interfaces, not implementations.** `PlaylistStore` (Postgres in prod) and
  `SourceReader` (`HttpSourceReader` → token-service) are swappable; tests use
  in-memory + scripted fakes.

## Layout

```
src/
  domain.ts             shared types (would be a @crossfade/core package in a monorepo)
  unifiedTrackCatalog.ts  ISRC-first find-or-create catalog
  reconcile.ts          TS port of PlaylistSyncEngine (add/remove/reorder + local preservation)
  playlistStore.ts      PlaylistStore interface + in-memory impl
  sourceReader.ts       SourceReader interface + HttpSourceReader (token-service client)
  syncRunner.ts         SyncRunner: runOnce / runForUser → RunReport
  worker.ts             interval loop entry (demo mode by default)
test/                   reconcile, syncRunner, and HTTP reader tests
```

## Production checklist (skeleton — not done here)

- Replace `InMemoryPlaylistStore` with Postgres; back the catalog with the durable
  unified-track store.
- Issue real per-user service sessions in the `SessionProvider` (instead of a static
  `WORKER_SESSION_TOKEN`).
- Replace the fixed interval with a proper scheduler/queue; add per-playlist backoff
  and a cadence tuned to how often sources actually change.
