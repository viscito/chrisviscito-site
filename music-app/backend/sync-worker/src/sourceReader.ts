import type { ProviderTrack, ServiceID } from "./domain.js";

/** Reads the current tracks of a source playlist. Abstracts *how* — the HTTP impl
 * calls the token-service's brokered library reads. */
export interface SourceReader {
  readSource(userId: string, service: ServiceID, providerPlaylistId: string): Promise<ProviderTrack[]>;
}

/** Provides a Crossfade session bearer token for a user (to authenticate to the
 * token-service on that user's behalf). Production issues short-lived service
 * sessions; tests supply a stub. */
export interface SessionProvider {
  sessionFor(userId: string): Promise<string>;
}

const SERVICE_SLUG: Record<ServiceID, string> = {
  appleMusic: "apple-music",
  spotify: "spotify",
  amazonMusic: "amazon-music",
  youTubeMusic: "youtube-music",
  pandora: "pandora",
};

/**
 * Reads source playlists via the token-service's brokered endpoint:
 *   GET {baseUrl}/v1/{service}/library/playlists/{id}/tracks
 * The token-service attaches the developer token + the user's stored Music User
 * Token, so the worker never touches provider credentials directly.
 */
export class HttpSourceReader implements SourceReader {
  constructor(
    private readonly baseUrl: string,
    private readonly sessions: SessionProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async readSource(userId: string, service: ServiceID, providerPlaylistId: string): Promise<ProviderTrack[]> {
    const slug = SERVICE_SLUG[service];
    const url = `${this.baseUrl}/v1/${slug}/library/playlists/${encodeURIComponent(providerPlaylistId)}/tracks`;
    const bearer = await this.sessions.sessionFor(userId);
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!res.ok) {
      throw new Error(`token-service ${res.status} reading ${service} playlist ${providerPlaylistId}`);
    }
    const json = (await res.json()) as { tracks?: ProviderTrack[] };
    return json.tracks ?? [];
  }
}
