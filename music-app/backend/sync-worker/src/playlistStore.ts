import type { Playlist } from "./domain.js";

/** Durable store of Crossfade playlists. Production is Postgres; in-memory here. */
export interface PlaylistStore {
  /** All imported (synced) playlists across all users. */
  listSynced(): Promise<Playlist[]>;
  /** Imported playlists for one user. */
  listSyncedForUser(userId: string): Promise<Playlist[]>;
  get(id: string): Promise<Playlist | undefined>;
  save(playlist: Playlist): Promise<void>;
}

export class InMemoryPlaylistStore implements PlaylistStore {
  private readonly map = new Map<string, Playlist>();

  constructor(seed: Playlist[] = []) {
    for (const p of seed) this.map.set(p.id, p);
  }
  async listSynced(): Promise<Playlist[]> {
    return [...this.map.values()].filter((p) => p.importedFrom !== null);
  }
  async listSyncedForUser(userId: string): Promise<Playlist[]> {
    return (await this.listSynced()).filter((p) => p.ownerId === userId);
  }
  async get(id: string): Promise<Playlist | undefined> {
    return this.map.get(id);
  }
  async save(playlist: Playlist): Promise<void> {
    this.map.set(playlist.id, playlist);
  }
}
