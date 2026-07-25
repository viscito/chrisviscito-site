import { Errors } from "../errors.js";

/** A track normalized from Apple Music into Crossfade's service-agnostic shape. */
export interface ProviderTrack {
  service: "appleMusic";
  providerTrackId: string;
  isrc: string | null;
  title: string;
  artists: string[];
  album: string | null;
  durationMillis: number;
  artworkUrl: string | null;
}

export interface ProviderPlaylist {
  id: string;
  service: "appleMusic";
  title: string;
  trackCount: number;
}

/**
 * The Apple Music API surface the broker needs. An interface so routes/broker are
 * testable without hitting Apple; `HttpAppleMusicApi` is the real implementation.
 */
export interface AppleMusicApi {
  validateUserToken(developerToken: string, userToken: string): Promise<{ storefront: string }>;
  search(developerToken: string, storefront: string, query: string): Promise<ProviderTrack[]>;
  libraryPlaylists(developerToken: string, userToken: string): Promise<ProviderPlaylist[]>;
  playlistTracks(developerToken: string, userToken: string, playlistId: string): Promise<ProviderTrack[]>;
}

const BASE = "https://api.music.apple.com";

export class HttpAppleMusicApi implements AppleMusicApi {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async validateUserToken(developerToken: string, userToken: string): Promise<{ storefront: string }> {
    const res = await this.fetchImpl(`${BASE}/v1/me/storefront`, {
      headers: { Authorization: `Bearer ${developerToken}`, "Music-User-Token": userToken },
    });
    if (res.status === 401 || res.status === 403) throw Errors.invalidUserToken();
    if (!res.ok) throw Errors.upstreamApple(`storefront ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    return { storefront: json.data?.[0]?.id ?? "us" };
  }

  async search(developerToken: string, storefront: string, query: string): Promise<ProviderTrack[]> {
    const url = `${BASE}/v1/catalog/${encodeURIComponent(storefront)}/search?types=songs&limit=25&term=${encodeURIComponent(query)}`;
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${developerToken}` } });
    if (!res.ok) throw Errors.upstreamApple(`search ${res.status}`);
    const json = (await res.json()) as { results?: { songs?: { data?: AppleSong[] } } };
    return (json.results?.songs?.data ?? []).map(mapSong);
  }

  async libraryPlaylists(developerToken: string, userToken: string): Promise<ProviderPlaylist[]> {
    const res = await this.fetchImpl(`${BASE}/v1/me/library/playlists?limit=100`, {
      headers: { Authorization: `Bearer ${developerToken}`, "Music-User-Token": userToken },
    });
    if (!res.ok) throw Errors.upstreamApple(`library ${res.status}`);
    const json = (await res.json()) as { data?: AppleLibraryPlaylist[] };
    return (json.data ?? []).map((p) => ({
      id: p.id,
      service: "appleMusic" as const,
      title: p.attributes?.name ?? "Untitled",
      trackCount: p.attributes?.trackCount ?? 0,
    }));
  }

  async playlistTracks(developerToken: string, userToken: string, playlistId: string): Promise<ProviderTrack[]> {
    const url = `${BASE}/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;
    const res = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${developerToken}`, "Music-User-Token": userToken },
    });
    if (!res.ok) throw Errors.upstreamApple(`playlist tracks ${res.status}`);
    const json = (await res.json()) as { data?: AppleSong[] };
    return (json.data ?? []).map(mapSong);
  }
}

// --- Apple response shapes (only the fields we read) ---
interface AppleSong {
  id: string;
  attributes?: {
    isrc?: string;
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    artwork?: { url?: string };
  };
}
interface AppleLibraryPlaylist {
  id: string;
  attributes?: { name?: string; trackCount?: number };
}

function mapSong(song: AppleSong): ProviderTrack {
  const a = song.attributes ?? {};
  const artwork = a.artwork?.url?.replace("{w}", "300").replace("{h}", "300") ?? null;
  return {
    service: "appleMusic",
    providerTrackId: song.id,
    isrc: a.isrc ?? null, // persisted for cross-service matching (R3)
    title: a.name ?? "Unknown",
    artists: a.artistName ? [a.artistName] : [],
    album: a.albumName ?? null,
    durationMillis: a.durationInMillis ?? 0,
    artworkUrl: artwork,
  };
}
