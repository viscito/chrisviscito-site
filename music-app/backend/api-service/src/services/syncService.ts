import type { Playlist, SyncDiff } from "../domain.js";
import { reconcile } from "../catalog/reconcile.js";
import type { UnifiedTrackCatalog } from "../catalog/unifiedTrackCatalog.js";
import type { ProviderGateway } from "../providers/providerGateway.js";
import type { PlaylistStore } from "../stores/stores.js";
import { Errors } from "../errors.js";

export interface SyncStatus {
  playlistId: string;
  lastSyncedAt: string | null;
  lastDiff: SyncDiff | null;
}

/** Trigger a sync now (POST /playlists/{id}/sync) — the same reconciliation the
 * worker runs on a schedule, on demand. */
export async function triggerSync(params: {
  userId: string;
  playlist: Playlist;
  gateway: ProviderGateway;
  catalog: UnifiedTrackCatalog;
  store: PlaylistStore;
  now?: () => Date;
}): Promise<SyncStatus> {
  const { userId, playlist, gateway, catalog, store } = params;
  if (!playlist.importedFrom) throw Errors.notSynced();

  const source = await gateway.playlistTracks(
    userId,
    playlist.importedFrom.service,
    playlist.importedFrom.providerPlaylistId,
  );
  const { playlist: updated, diff } = reconcile(playlist, source, catalog, params.now);
  await store.save(updated);
  return { playlistId: updated.id, lastSyncedAt: updated.importedFrom?.lastSyncedAt ?? null, lastDiff: diff };
}
