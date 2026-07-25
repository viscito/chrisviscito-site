# Crossfade — Backend

Server-side specs for Crossfade. The backend is a BFF that owns identity,
credential brokering, catalog normalization, matching, and the durable playlist
store (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

## Documents

- **[`TOKEN_SERVICE.md`](./TOKEN_SERVICE.md)** — the credential & token service
  spec: how Crossfade authorizes to the Apple Music API (developer-token JWT
  signing), vends what MusicKit needs to the app, stores per-user tokens securely,
  and generalizes to a per-service credential broker (Spotify next).

## Implementation

- **[`token-service/`](./token-service/)** — a working TypeScript BFF implementing
  the spec (Hono + jose + zod, Node crypto envelope encryption). `npm test` runs a
  green suite (JWT signing, envelope round-trip, full HTTP API incl. R1 gating and
  rate limiting). See [`token-service/README.md`](./token-service/README.md).
- **[`sync-worker/`](./sync-worker/)** — the worker that drives the R2 kept-in-sync
  reconciliation on a schedule, reading each imported playlist's source via the
  token-service's brokered reads. Green suite (reconcile parity with the Swift
  engine, runner behavior, HTTP reader). See [`sync-worker/README.md`](./sync-worker/README.md).

## Not yet specced (roadmap)

- Full Phase-1 API contract (playlists, unified library, sync jobs).
- The kept-in-sync reconciliation engine (R2).
- Crossfade account/identity service.
