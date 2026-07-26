import type { Connection, Playlist, ServiceId } from "./domain.js";
import { canPlay } from "./domain.js";
import { SUPPORTED_SERVICES } from "./catalog/supportedServices.js";
import type { UnifiedTrackCatalog } from "./catalog/unifiedTrackCatalog.js";

/** Playlist summary (openapi Playlist): no items, just a track count. */
export function toPlaylistSummary(p: Playlist) {
  return {
    id: p.id,
    title: p.title,
    detail: p.detail,
    trackCount: p.items.length,
    importedFrom: p.importedFrom,
    updatedAt: p.updatedAt,
  };
}

/** Playlist detail (openapi PlaylistDetail): items expanded with their tracks (R4). */
export function toPlaylistDetail(p: Playlist, catalog: UnifiedTrackCatalog) {
  return {
    ...toPlaylistSummary(p),
    items: p.items.map((item) => ({
      id: item.id,
      origin: item.origin,
      preferredService: item.preferredService,
      track: catalog.get(item.unifiedTrackId) ?? null,
    })),
  };
}

/** openapi ServiceWithConnection — the R5 registry merged with this user's state. */
export function toServicesWithConnections(connections: Connection[]) {
  const byService = new Map<ServiceId, Connection>(connections.map((c) => [c.service, c]));
  return SUPPORTED_SERVICES.map((d) => {
    const connection = byService.get(d.service) ?? null;
    return { ...d, connection, canPlay: canPlay(connection ?? undefined) };
  });
}
