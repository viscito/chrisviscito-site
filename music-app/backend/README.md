# Crossfade — Backend

Server-side specs for Crossfade. The backend is a BFF that owns identity,
credential brokering, catalog normalization, matching, and the durable playlist
store (see [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

## Documents

- **[`TOKEN_SERVICE.md`](./TOKEN_SERVICE.md)** — the credential & token service:
  how Crossfade authorizes to the Apple Music API (developer-token JWT signing),
  vends what MusicKit needs to the app, stores per-user tokens securely, and
  generalizes to a per-service credential broker (Spotify next).

## Not yet specced (roadmap)

- Full Phase-1 API contract (playlists, unified library, sync jobs).
- The kept-in-sync reconciliation engine (R2).
- Crossfade account/identity service.
