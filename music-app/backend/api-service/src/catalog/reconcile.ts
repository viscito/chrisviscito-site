import { randomUUID } from "node:crypto";
import type { Playlist, PlaylistItem, ProviderTrack, SyncDiff } from "../domain.js";
import type { UnifiedTrackCatalog } from "./unifiedTrackCatalog.js";

export interface ReconcileResult {
  playlist: Playlist;
  diff: SyncDiff;
}

/** TS port of CrossfadeKit's PlaylistSyncEngine (R2): source-authoritative for
 * imported items, preserving user-added local items. Shared with the sync-worker. */
export function reconcile(
  playlist: Playlist,
  source: ProviderTrack[],
  catalog: UnifiedTrackCatalog,
  now: () => Date = () => new Date(),
): ReconcileResult {
  const desiredTrackIds: string[] = [];
  const seen = new Set<string>();
  for (const pt of source) {
    const track = catalog.ingest(pt);
    if (!seen.has(track.id)) {
      seen.add(track.id);
      desiredTrackIds.push(track.id);
    }
  }

  const existingImported = playlist.items.filter((i) => i.origin === "imported");
  const existingByTrack = new Map(existingImported.map((i) => [i.unifiedTrackId, i]));
  const desiredItems: PlaylistItem[] = desiredTrackIds.map(
    (tid) =>
      existingByTrack.get(tid) ?? { id: randomUUID(), unifiedTrackId: tid, origin: "imported", preferredService: null },
  );

  const existingOrder = existingImported.map((i) => i.unifiedTrackId);
  const existingSet = new Set(existingOrder);
  const desiredSet = new Set(desiredTrackIds);
  const addedTrackIds = desiredTrackIds.filter((t) => !existingSet.has(t));
  const removedItemIds = existingImported.filter((i) => !desiredSet.has(i.unifiedTrackId)).map((i) => i.id);
  const survivingExisting = existingOrder.filter((t) => desiredSet.has(t));
  const survivingDesired = desiredTrackIds.filter((t) => existingSet.has(t));
  const reordered = survivingExisting.join(",") !== survivingDesired.join(",");

  const localItems = playlist.items.filter((i) => i.origin === "local");
  const nowIso = now().toISOString();
  const updated: Playlist = {
    ...playlist,
    items: [...desiredItems, ...localItems],
    updatedAt: nowIso,
    importedFrom: playlist.importedFrom ? { ...playlist.importedFrom, lastSyncedAt: nowIso } : null,
  };

  return { playlist: updated, diff: { addedTrackIds, removedItemIds, reordered } };
}
