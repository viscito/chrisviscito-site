import { isNoOp, type Playlist, type SyncDiff } from "./domain.js";
import type { PlaylistStore } from "./playlistStore.js";
import type { SourceReader } from "./sourceReader.js";
import { reconcile } from "./reconcile.js";
import type { UnifiedTrackCatalog } from "./unifiedTrackCatalog.js";

export interface PlaylistRunReport {
  playlistId: string;
  title: string;
  changed: boolean;
  diff?: SyncDiff;
  error?: string;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  reconciled: number;
  changed: number;
  failed: number;
  playlists: PlaylistRunReport[];
}

export interface SyncRunnerDeps {
  store: PlaylistStore;
  reader: SourceReader;
  /** The persistent unified-track catalog (shared across runs). */
  catalog: UnifiedTrackCatalog;
  now?: () => Date;
}

/**
 * Drives R2 sync: for each imported playlist, read the source's current tracks and
 * reconcile. One failing playlist never aborts the run — its error is captured and
 * the rest still process.
 */
export class SyncRunner {
  constructor(private readonly deps: SyncRunnerDeps) {}

  runOnce(): Promise<RunReport> {
    return this.run(() => this.deps.store.listSynced());
  }
  runForUser(userId: string): Promise<RunReport> {
    return this.run(() => this.deps.store.listSyncedForUser(userId));
  }

  private async run(select: () => Promise<Playlist[]>): Promise<RunReport> {
    const now = this.deps.now ?? (() => new Date());
    const startedAt = now().toISOString();
    const playlists = await select();
    const reports: PlaylistRunReport[] = [];

    for (const pl of playlists) {
      if (!pl.importedFrom) continue;
      try {
        const source = await this.deps.reader.readSource(
          pl.ownerId,
          pl.importedFrom.service,
          pl.importedFrom.providerPlaylistId,
        );
        const { playlist: updated, diff } = reconcile(pl, source, this.deps.catalog, now);
        await this.deps.store.save(updated);
        reports.push({ playlistId: pl.id, title: pl.title, changed: !isNoOp(diff), diff });
      } catch (err) {
        reports.push({
          playlistId: pl.id,
          title: pl.title,
          changed: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      startedAt,
      finishedAt: now().toISOString(),
      reconciled: reports.length,
      changed: reports.filter((r) => r.changed).length,
      failed: reports.filter((r) => r.error).length,
      playlists: reports,
    };
  }
}
