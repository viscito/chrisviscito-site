# Crossfade — Phase-1 API contract

The full backend API for the Apple Music MVP, as an **OpenAPI 3.1** contract in
[`openapi.yaml`](./openapi.yaml). It is the machine-readable source of truth —
usable for client codegen, mock servers, and request/response validation.

Some of it is already built: the **Services** connection + developer-token
endpoints are served by [`../token-service`](../token-service), and the **Sync**
reconciliation is driven by [`../sync-worker`](../sync-worker). The rest
(accounts, library, search, playlists, import, queue) is specced here for Phase 1.

## Conventions

- **Base path / versioning:** everything under `/v1`. Breaking changes bump the URI version.
- **Auth:** `Authorization: Bearer <session>` on every endpoint except `POST /auth/session`. The session is the Crossfade account token (see the token-service, which verifies the same token).
- **Content type:** `application/json`; timestamps are ISO-8601 UTC; Crossfade IDs are UUIDs.
- **Errors:** `{ "error": "<code>", "message": "<text>" }` with stable codes (`unauthenticated`, `insufficient_plan`, `invalid_user_token`, `not_connected`, `not_found`, `rate_limited`, …) — the same model the token-service already uses.
- **Pagination:** cursor-based — `?limit=&cursor=`, response `{ data: [...], nextCursor: string|null }`.
- **Idempotency:** creates accept an `Idempotency-Key` header so retries create at most once.
- **Rate limits:** `429` with `Retry-After`.

## Endpoint map (by requirement)

| Area | Endpoints | Req |
|---|---|---|
| **Auth** | `POST /auth/session`, `POST /auth/session/refresh`, `GET /me`, `DELETE /me` | — |
| **Services** | `GET /services`; `GET /apple-music/developer-token`; `POST·DELETE /apple-music/connections`; `POST /apple-music/connections/refresh` | R5, R1 |
| **Library** | `GET /library/tracks`, `GET /tracks/{id}` | R4 |
| **Search** | `GET /search?q=&services=` | R3, R1 |
| **Playlists** | `GET·POST /playlists`; `GET·PATCH·DELETE /playlists/{id}`; `POST /playlists/{id}/items`; `PATCH·DELETE /playlists/{id}/items/{itemId}` | R4, R1 |
| **Import** | `GET·POST /import/{service}/playlists` | R2 |
| **Sync** | `GET·POST /playlists/{id}/sync` | R2 |
| **Playback** | `GET /playlists/{id}/queue` | R1 |

## Two contract choices worth noting

- **Playlists reference `UnifiedTrack`s, not per-service IDs.** So the same playlist
  resolves differently per listener. `GET /playlists/{id}/queue` does that
  resolution: it returns ordered `QueueTrack`s already mapped to the service *this*
  user can play, each carrying a `playable` flag + `blockedReason` (R1) so the client
  can badge or skip — mirroring the coordinator's skip logic in `CrossfadeKit`.
- **Import is explicit about sync.** `POST /import/{service}/playlists` takes
  `keepInSync` (default true); a synced playlist exposes its state at
  `GET /playlists/{id}/sync` and can be forced with `POST` (the same reconciliation
  the worker runs on a schedule).

## Validate / view

```bash
# validate (Redocly)
npx --yes @redocly/cli lint openapi.yaml

# render interactive docs to a file
npx --yes @redocly/cli build-docs openapi.yaml -o api-docs.html
```

## Not yet in this contract (later phases)

- Multi-service endpoints beyond Apple Music (Spotify connect/reads) — they reuse
  the same shapes via the `{service}` path param and the credential-broker interface.
- Collaborative/shared playlists and portable-playlist sharing.
- Recommendations / discovery.
