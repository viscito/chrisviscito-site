import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { SyncRunner } from "../src/syncRunner.js";
import { InMemoryPlaylistStore } from "../src/playlistStore.js";
import { UnifiedTrackCatalog } from "../src/unifiedTrackCatalog.js";
import type { Playlist, ProviderTrack, ServiceID } from "../src/domain.js";
import type { SourceReader } from "../src/sourceReader.js";

function pt(isrc: string, title: string): ProviderTrack {
  return { service: "spotify", providerTrackId: `sp-${isrc}`, isrc, title, artists: ["Artist"], durationMillis: 200_000 };
}

function importedPlaylist(catalog: UnifiedTrackCatalog, id: string, owner: string, sourceId: string, source: ProviderTrack[]): Playlist {
  return {
    id,
    ownerId: owner,
    title: `Playlist ${id}`,
    items: source.map((p) => ({ id: randomUUID(), unifiedTrackId: catalog.ingest(p).id, origin: "imported" as const })),
    importedFrom: { service: "spotify", providerPlaylistId: sourceId, lastSyncedAt: null },
    updatedAt: new Date().toISOString(),
  };
}

/** A reader whose per-source responses are scripted. */
class ScriptedReader implements SourceReader {
  constructor(private readonly sources: Record<string, ProviderTrack[] | Error>) {}
  async readSource(_userId: string, _service: ServiceID, providerPlaylistId: string): Promise<ProviderTrack[]> {
    const entry = this.sources[providerPlaylistId];
    if (entry instanceof Error) throw entry;
    return entry ?? [];
  }
}

describe("SyncRunner", () => {
  it("reconciles every synced playlist and persists the results", async () => {
    const catalog = new UnifiedTrackCatalog();
    const p1 = importedPlaylist(catalog, "p1", "u1", "src1", [pt("A", "A"), pt("B", "B")]);
    const p2 = importedPlaylist(catalog, "p2", "u1", "src2", [pt("X", "X")]);
    const store = new InMemoryPlaylistStore([p1, p2]);
    const reader = new ScriptedReader({
      src1: [pt("A", "A"), pt("B", "B"), pt("C", "C")], // +C
      src2: [pt("X", "X")], // unchanged
    });

    const report = await new SyncRunner({ store, reader, catalog }).runOnce();

    expect(report.reconciled).toBe(2);
    expect(report.changed).toBe(1);
    expect(report.failed).toBe(0);

    const saved1 = await store.get("p1");
    expect(saved1?.items).toHaveLength(3);
    expect(saved1?.importedFrom?.lastSyncedAt).toBeTruthy();
  });

  it("captures a per-playlist error without aborting the run", async () => {
    const catalog = new UnifiedTrackCatalog();
    const good = importedPlaylist(catalog, "good", "u1", "srcGood", [pt("A", "A")]);
    const bad = importedPlaylist(catalog, "bad", "u1", "srcBad", [pt("B", "B")]);
    const store = new InMemoryPlaylistStore([good, bad]);
    const reader = new ScriptedReader({
      srcGood: [pt("A", "A"), pt("D", "D")], // +D
      srcBad: new Error("token-service 502"),
    });

    const report = await new SyncRunner({ store, reader, catalog }).runOnce();

    expect(report.reconciled).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.playlists.find((p) => p.playlistId === "bad")?.error).toContain("502");
    // The healthy playlist still synced.
    expect((await store.get("good"))?.items).toHaveLength(2);
  });

  it("scopes to a single user with runForUser", async () => {
    const catalog = new UnifiedTrackCatalog();
    const mine = importedPlaylist(catalog, "mine", "u1", "srcMine", [pt("A", "A")]);
    const theirs = importedPlaylist(catalog, "theirs", "u2", "srcTheirs", [pt("B", "B")]);
    const store = new InMemoryPlaylistStore([mine, theirs]);
    const reader = new ScriptedReader({ srcMine: [pt("A", "A"), pt("C", "C")], srcTheirs: [pt("B", "B")] });

    const report = await new SyncRunner({ store, reader, catalog }).runForUser("u1");
    expect(report.reconciled).toBe(1);
    expect(report.playlists[0]?.playlistId).toBe("mine");
  });
});
