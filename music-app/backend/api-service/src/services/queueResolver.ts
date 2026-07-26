import { canPlay, type BlockedReason, type Connection, type Playlist, type QueueTrack, type ServiceId } from "../domain.js";
import { playbackModeFor } from "../catalog/supportedServices.js";
import type { UnifiedTrackCatalog } from "../catalog/unifiedTrackCatalog.js";

/**
 * Resolve a playlist into an ordered, per-listener playable queue (GET
 * /playlists/{id}/queue). For each item, choose the best service *this* user can
 * play and compute playability — the server-side mirror of CrossfadeKit's
 * PlaybackCoordinator skip logic and the in-app-first policy (R1).
 */
export function resolveQueue(
  playlist: Playlist,
  catalog: UnifiedTrackCatalog,
  connections: Connection[],
): QueueTrack[] {
  const connByService = new Map(connections.map((c) => [c.service, c]));
  const playableServices = new Set(connections.filter((c) => canPlay(c)).map((c) => c.service));

  const queue: QueueTrack[] = [];
  for (const item of playlist.items) {
    const track = catalog.get(item.unifiedTrackId);
    if (!track) continue;
    const mappings = catalog.mappingsFor(item.unifiedTrackId);
    if (mappings.length === 0) continue;

    // Prefer a pinned service, then any playable in-app service, then any mapping.
    const pinned = item.preferredService ? mappings.find((m) => m.service === item.preferredService) : undefined;
    const playableInApp = mappings.find(
      (m) => playableServices.has(m.service) && playbackModeFor(m.service) !== "deepLinkHandoff",
    );
    const chosen = pinned ?? playableInApp ?? mappings[0]!;
    const service = chosen.service;
    const mode = playbackModeFor(service);

    queue.push({
      unifiedTrackId: track.id,
      title: track.title,
      artist: track.artists[0] ?? "Unknown Artist",
      durationMillis: track.durationMillis,
      service,
      providerTrackId: chosen.providerTrackId,
      playbackMode: mode,
      playable: playableServices.has(service) && mode !== "deepLinkHandoff",
      blockedReason: blockReason(service, mode, connByService.get(service)),
    });
  }
  return queue;
}

function blockReason(service: ServiceId, mode: string, conn: Connection | undefined): BlockedReason | null {
  if (!conn || !conn.isLinked) return "notAuthorized";
  if (conn.entitlement !== "active") return "notSubscribed";
  if (mode === "deepLinkHandoff") return "leavesApp";
  return null;
}
