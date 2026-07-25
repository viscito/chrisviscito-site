import { randomUUID } from "node:crypto";
import type { Playlist, ProviderTrack, ServiceID } from "./domain.js";
import { InMemoryPlaylistStore } from "./playlistStore.js";
import { UnifiedTrackCatalog } from "./unifiedTrackCatalog.js";
import { SyncRunner } from "./syncRunner.js";
import { HttpSourceReader, type SessionProvider, type SourceReader } from "./sourceReader.js";

/**
 * Worker entry. Runs `SyncRunner.runOnce()` on an interval.
 *
 *  • With TOKEN_SERVICE_URL set, it reads real sources via the token-service.
 *  • Otherwise it runs a self-contained DEMO: an in-memory playlist whose "source"
 *    changes each tick, so you can watch diffs flow through. Production swaps the
 *    store for Postgres and the reader for HttpSourceReader.
 */
const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 300_000); // 5 min default
const tokenServiceUrl = process.env.TOKEN_SERVICE_URL;

const catalog = new UnifiedTrackCatalog();

function pt(isrc: string, title: string, service: ServiceID = "spotify"): ProviderTrack {
  return { service, providerTrackId: `${service}-${isrc}`, isrc, title, artists: ["Artist"], durationMillis: 200_000 };
}

// ---- Demo wiring (no token-service required) ----
const demoOwner = "dev-user-1";
const demoSourceStates: ProviderTrack[][] = [
  [pt("A", "Song A"), pt("B", "Song B")],
  [pt("A", "Song A"), pt("B", "Song B"), pt("C", "Song C")], // +C
  [pt("B", "Song B"), pt("A", "Song A"), pt("C", "Song C")], // reorder
  [pt("B", "Song B"), pt("C", "Song C")], // -A
];
let demoTick = 0;
const demoReader: SourceReader = {
  async readSource() {
    return demoSourceStates[demoTick % demoSourceStates.length]!;
  },
};

function seedDemoPlaylist(): Playlist {
  // Build the initial imported playlist from the first source state, using the SAME
  // catalog so track identities line up on later runs.
  const first = demoSourceStates[0]!;
  return {
    id: randomUUID(),
    ownerId: demoOwner,
    title: "Late Night Drive",
    items: first.map((p) => ({ id: randomUUID(), unifiedTrackId: catalog.ingest(p).id, origin: "imported" as const })),
    importedFrom: { service: "spotify", providerPlaylistId: "sp-1", lastSyncedAt: null },
    updatedAt: new Date().toISOString(),
  };
}

const store = new InMemoryPlaylistStore([seedDemoPlaylist()]);

let reader: SourceReader = demoReader;
if (tokenServiceUrl) {
  const sessions: SessionProvider = {
    async sessionFor() {
      const t = process.env.WORKER_SESSION_TOKEN;
      if (!t) throw new Error("WORKER_SESSION_TOKEN required when TOKEN_SERVICE_URL is set");
      return t;
    },
  };
  reader = new HttpSourceReader(tokenServiceUrl, sessions);
  console.log(`[worker] reading sources from token-service at ${tokenServiceUrl}`);
} else {
  console.log("[worker] DEMO mode — no TOKEN_SERVICE_URL; using an in-memory mutating source");
}

const runner = new SyncRunner({ store, reader, catalog });

async function tick() {
  const report = await runner.runOnce();
  console.log(
    `[worker] run: reconciled=${report.reconciled} changed=${report.changed} failed=${report.failed}`,
    report.playlists.map((p) =>
      p.error ? `${p.title}: ERROR ${p.error}` : `${p.title}: +${p.diff?.addedTrackIds.length ?? 0} -${p.diff?.removedItemIds.length ?? 0} reorder=${p.diff?.reordered ?? false}`,
    ),
  );
  demoTick += 1;
}

console.log(`[worker] starting; interval=${intervalMs}ms`);
void tick();
setInterval(() => void tick(), intervalMs);
