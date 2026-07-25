import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { reconcile } from "../src/reconcile.js";
import { UnifiedTrackCatalog } from "../src/unifiedTrackCatalog.js";
import type { Playlist, ProviderTrack } from "../src/domain.js";

const FIXED = new Date("2026-01-01T00:00:00.000Z");
const at = () => FIXED;

function pt(isrc: string, title: string, service: ProviderTrack["service"] = "spotify"): ProviderTrack {
  return { service, providerTrackId: `${service}-${isrc}`, isrc, title, artists: ["Artist"], durationMillis: 200_000 };
}

/** Build an imported playlist mirroring `source` (using the given catalog). */
function importedPlaylist(catalog: UnifiedTrackCatalog, source: ProviderTrack[], local: ProviderTrack[] = []): Playlist {
  return {
    id: randomUUID(),
    ownerId: "u1",
    title: "Late Night Drive",
    items: [
      ...source.map((p) => ({ id: randomUUID(), unifiedTrackId: catalog.ingest(p).id, origin: "imported" as const })),
      ...local.map((p) => ({ id: randomUUID(), unifiedTrackId: catalog.ingest(p).id, origin: "local" as const })),
    ],
    importedFrom: { service: "spotify", providerPlaylistId: "sp-1", lastSyncedAt: null },
    updatedAt: FIXED.toISOString(),
  };
}

describe("reconcile (R2)", () => {
  it("detects an addition in the source", () => {
    const catalog = new UnifiedTrackCatalog();
    const pl = importedPlaylist(catalog, [pt("A", "Song A"), pt("B", "Song B")]);
    const { playlist, diff } = reconcile(pl, [pt("A", "Song A"), pt("B", "Song B"), pt("C", "Song C")], catalog, at);
    expect(diff.addedTrackIds).toHaveLength(1);
    expect(diff.reordered).toBe(false);
    expect(playlist.items.filter((i) => i.origin === "imported")).toHaveLength(3);
    expect(playlist.importedFrom?.lastSyncedAt).toBe(FIXED.toISOString());
  });

  it("detects a removal", () => {
    const catalog = new UnifiedTrackCatalog();
    const pl = importedPlaylist(catalog, [pt("A", "Song A"), pt("B", "Song B")]);
    const { playlist, diff } = reconcile(pl, [pt("A", "Song A")], catalog, at);
    expect(diff.removedItemIds).toHaveLength(1);
    expect(playlist.items).toHaveLength(1);
  });

  it("detects a reorder", () => {
    const catalog = new UnifiedTrackCatalog();
    const pl = importedPlaylist(catalog, [pt("A", "Song A"), pt("B", "Song B")]);
    const { diff } = reconcile(pl, [pt("B", "Song B"), pt("A", "Song A")], catalog, at);
    expect(diff.reordered).toBe(true);
    expect(diff.addedTrackIds).toHaveLength(0);
    expect(diff.removedItemIds).toHaveLength(0);
  });

  it("is a no-op when nothing changed but still stamps lastSyncedAt", () => {
    const catalog = new UnifiedTrackCatalog();
    const pl = importedPlaylist(catalog, [pt("A", "Song A"), pt("B", "Song B")]);
    const { playlist, diff } = reconcile(pl, [pt("A", "Song A"), pt("B", "Song B")], catalog, at);
    expect(diff).toEqual({ addedTrackIds: [], removedItemIds: [], reordered: false });
    expect(playlist.importedFrom?.lastSyncedAt).toBe(FIXED.toISOString());
  });

  it("preserves user-added local items", () => {
    const catalog = new UnifiedTrackCatalog();
    const pl = importedPlaylist(catalog, [pt("A", "Song A")], [pt("L", "Local Pick")]);
    const localId = pl.items.find((i) => i.origin === "local")!.unifiedTrackId;
    const { playlist } = reconcile(pl, [pt("A", "Song A"), pt("B", "Song B")], catalog, at);
    const locals = playlist.items.filter((i) => i.origin === "local");
    expect(locals).toHaveLength(1);
    expect(locals[0]!.unifiedTrackId).toBe(localId);
    expect(playlist.items.filter((i) => i.origin === "imported")).toHaveLength(2);
  });

  it("keeps stable item identity across a reorder", () => {
    const catalog = new UnifiedTrackCatalog();
    const pl = importedPlaylist(catalog, [pt("A", "Song A"), pt("B", "Song B")]);
    const aItem = pl.items[0]!;
    const { playlist } = reconcile(pl, [pt("B", "Song B"), pt("A", "Song A")], catalog, at);
    const aAfter = playlist.items.find((i) => i.unifiedTrackId === aItem.unifiedTrackId);
    expect(aAfter?.id).toBe(aItem.id);
  });
});
