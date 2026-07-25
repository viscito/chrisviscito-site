import { randomUUID } from "node:crypto";
import type { Playlist, PlaylistItem, ProviderTrack, SyncDiff } from "./domain.js";
import type { UnifiedTrackCatalog } from "./unifiedTrackCatalog.js";

export interface ReconcileResult {
  playlist: Playlist;
  diff: SyncDiff;
}

/**
 * TypeScript port of CrossfadeKit's `PlaylistSyncEngine.reconcile` (R2).
 * Source-authoritative for imported items (add / remove / reorder), preserving
 * user-added `.local` items. One-way with local preservation — see PRODUCT_SPEC R2.
 */
export function reconcile(
  playlist: Playlist,
  source: ProviderTrack[],
  catalog: UnifiedTrackCatalog,
  now: () => Date = () => new Date(),
): ReconcileResult {
  // 1. Resolve source into desired imported track ids, in order, de-duplicated.
  const desiredTrackIds: string[] = [];
  const seen = new Set<string>();
  for (const pt of source) {
    const track = catalog.ingest(pt);
    if (!seen.has(track.id)) {
      seen.add(track.id);
      desiredTrackIds.push(track.id);
    }
  }

  // 2. Reuse existing imported items (stable identity) or create new ones.
  const existingImported = playlist.items.filter((i) => i.origin === "imported");
  const existingByTrack = new Map(existingImported.map((i) => [i.unifiedTrackId, i]));
  const desiredItems: PlaylistItem[] = desiredTrackIds.map(
    (tid) => existingByTrack.get(tid) ?? { id: randomUUID(), unifiedTrackId: tid, origin: "imported" as const },
  );

  // 3. Diff.
  const existingOrder = existingImported.map((i) => i.unifiedTrackId);
  const existingSet = new Set(existingOrder);
  const desiredSet = new Set(desiredTrackIds);
  const addedTrackIds = desiredTrackIds.filter((t) => !existingSet.has(t));
  const removedItemIds = existingImported.filter((i) => !desiredSet.has(i.unifiedTrackId)).map((i) => i.id);
  const survivingExisting = existingOrder.filter((t) => desiredSet.has(t));
  const survivingDesired = desiredTrackIds.filter((t) => existingSet.has(t));
  const reordered = survivingExisting.join(",") !== survivingDesired.join(",");

  // 4. Compose: mirrored imported block + preserved local items; stamp sync time.
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
