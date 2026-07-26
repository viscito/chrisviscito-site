import type { ProviderPlaylist, ProviderTrack, ServiceId } from "../domain.js";

/**
 * Reads a service's catalog/library. In production each method calls the
 * token-service's brokered endpoints (which attach the developer token + the user's
 * stored token). Here a Mock implementation serves seeded data so the API runs and
 * is testable without the token-service.
 */
export interface ProviderGateway {
  search(userId: string, service: ServiceId, query: string): Promise<ProviderTrack[]>;
  listPlaylists(userId: string, service: ServiceId): Promise<ProviderPlaylist[]>;
  playlistTracks(userId: string, service: ServiceId, providerPlaylistId: string): Promise<ProviderTrack[]>;
}

export interface MockServiceData {
  catalog: ProviderTrack[];
  playlists: Array<{ playlist: ProviderPlaylist; trackIds: string[] }>;
}

/** Serves seeded per-service data; filters search by title substring. */
export class MockProviderGateway implements ProviderGateway {
  constructor(private readonly data: Partial<Record<ServiceId, MockServiceData>>) {}

  async search(_userId: string, service: ServiceId, query: string): Promise<ProviderTrack[]> {
    const q = query.toLowerCase();
    return (this.data[service]?.catalog ?? []).filter((t) => t.title.toLowerCase().includes(q));
  }
  async listPlaylists(_userId: string, service: ServiceId): Promise<ProviderPlaylist[]> {
    return (this.data[service]?.playlists ?? []).map((p) => p.playlist);
  }
  async playlistTracks(_userId: string, service: ServiceId, providerPlaylistId: string): Promise<ProviderTrack[]> {
    const svc = this.data[service];
    const entry = svc?.playlists.find((p) => p.playlist.id === providerPlaylistId);
    if (!entry) return [];
    const byId = new Map((svc?.catalog ?? []).map((t) => [t.providerTrackId, t]));
    return entry.trackIds.map((id) => byId.get(id)).filter((t): t is ProviderTrack => !!t);
  }
}
