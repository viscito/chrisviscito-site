import { randomUUID } from "node:crypto";
import type { Playlist, PlaylistItem, ServiceId } from "../domain.js";
import type { UnifiedTrackCatalog } from "../catalog/unifiedTrackCatalog.js";
import type { ProviderGateway } from "../providers/providerGateway.js";
import type { PlaylistStore } from "../stores/stores.js";
import { Errors } from "../errors.js";

/**
 * Import provider playlists into Crossfade (R2). Each becomes a Crossfade playlist
 * of `.imported` items; when `keepInSync` (default), it stays linked to the source
 * so the sync engine/worker can reconcile it later.
 */
export async function importPlaylists(params: {
  userId: string;
  service: ServiceId;
  providerPlaylistIds: string[];
  keepInSync: boolean;
  gateway: ProviderGateway;
  catalog: UnifiedTrackCatalog;
  store: PlaylistStore;
  now?: () => Date;
}): Promise<Playlist[]> {
  const { userId, service, providerPlaylistIds, keepInSync, gateway, catalog, store } = params;
  const now = params.now ?? (() => new Date());

  const candidates = await gateway.listPlaylists(userId, service);
  const titleById = new Map(candidates.map((p) => [p.id, p.title]));

  const created: Playlist[] = [];
  for (const providerPlaylistId of providerPlaylistIds) {
    if (!titleById.has(providerPlaylistId)) throw Errors.notFound("Source playlist");
    const providerTracks = await gateway.playlistTracks(userId, service, providerPlaylistId);
    const items: PlaylistItem[] = providerTracks.map((pt) => {
      const unified = catalog.ingest(pt); // adds to the unified library + records the mapping
      return { id: randomUUID(), unifiedTrackId: unified.id, origin: "imported", preferredService: null };
    });

    const nowIso = now().toISOString();
    const playlist: Playlist = {
      id: randomUUID(),
      ownerId: userId,
      title: titleById.get(providerPlaylistId) ?? "Imported playlist",
      detail: `Imported from ${service}`,
      items,
      importedFrom: keepInSync ? { service, providerPlaylistId, lastSyncedAt: nowIso } : null,
      updatedAt: nowIso,
    };
    await store.save(playlist);
    created.push(playlist);
  }
  return created;
}
