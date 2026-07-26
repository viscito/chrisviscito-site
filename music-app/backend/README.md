# Crossfade — Backend

Server-side specs for Crossfade. The backend is a BFF that owns identity,
credential brokering, catalog normalization, matching, and the durable playlist
store (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

## Documents

- **[`TOKEN_SERVICE.md`](./TOKEN_SERVICE.md)** — the credential & token service
  spec: how Crossfade authorizes to the Apple Music API (developer-token JWT
  signing), vends what MusicKit needs to the app, stores per-user tokens securely,
  and generalizes to a per-service credential broker (Spotify next).

## API contract

- **[`api/`](./api/)** — the full Phase-1 API as an **OpenAPI 3.1** contract
  ([`api/openapi.yaml`](./api/openapi.yaml), validated): accounts, services (R5/R1),
  unified library (R4), cross-platform search (R3), playlists, import (R2), sync
  (R2), and per-listener playback resolution. The token-service and sync-worker
  implement parts of it today. See [`api/README.md`](./api/README.md).

## Implementation

- **[`token-service/`](./token-service/)** — a working TypeScript BFF implementing
  the spec (Hono + jose + zod, Node crypto envelope encryption). `npm test` runs a
  green suite (JWT signing, envelope round-trip, full HTTP API incl. R1 gating and
  rate limiting). See [`token-service/README.md`](./token-service/README.md).
- **[`sync-worker/`](./sync-worker/)** — the worker that drives the R2 kept-in-sync
  reconciliation on a schedule, reading each imported playlist's source via the
  token-service's brokered reads. Green suite (reconcile parity with the Swift
  engine, runner behavior, HTTP reader). See [`sync-worker/README.md`](./sync-worker/README.md).
- **[`api-service/`](./api-service/)** — implements the rest of the contract:
  services (R5), unified library (R4), cross-platform search (R3), playlists +
  items, import (R2), sync (R2), and the per-listener playback queue (R1). Green
  suite + runnable demo. See [`api-service/README.md`](./api-service/README.md).

## Not yet specced (roadmap)

- Full Phase-1 API contract (playlists, unified library, sync jobs).
- The kept-in-sync reconciliation engine (R2).
- Crossfade account/identity service.
