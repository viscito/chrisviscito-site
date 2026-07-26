import type { Connection, Playlist, ServiceId } from "../domain.js";

/** Playlists per user. Production = Postgres. */
export interface PlaylistStore {
  listForUser(userId: string): Promise<Playlist[]>;
  get(id: string): Promise<Playlist | undefined>;
  save(playlist: Playlist): Promise<void>;
  delete(id: string): Promise<void>;
}

export class InMemoryPlaylistStore implements PlaylistStore {
  private readonly map = new Map<string, Playlist>();
  constructor(seed: Playlist[] = []) {
    for (const p of seed) this.map.set(p.id, p);
  }
  async listForUser(userId: string): Promise<Playlist[]> {
    return [...this.map.values()]
      .filter((p) => p.ownerId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id: string): Promise<Playlist | undefined> {
    return this.map.get(id);
  }
  async save(playlist: Playlist): Promise<void> {
    this.map.set(playlist.id, playlist);
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

/** A user's service connections (R1). Mirrors what the token-service records. */
export interface ConnectionStore {
  listForUser(userId: string): Promise<Connection[]>;
  get(userId: string, service: ServiceId): Promise<Connection | undefined>;
}

export class InMemoryConnectionStore implements ConnectionStore {
  private readonly map = new Map<string, Connection[]>();
  constructor(seed: Record<string, Connection[]> = {}) {
    for (const [userId, conns] of Object.entries(seed)) this.map.set(userId, conns);
  }
  async listForUser(userId: string): Promise<Connection[]> {
    return this.map.get(userId) ?? [];
  }
  async get(userId: string, service: ServiceId): Promise<Connection | undefined> {
    return (this.map.get(userId) ?? []).find((c) => c.service === service);
  }
}
