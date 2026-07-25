// Minimal domain shared by the worker. In a real monorepo these types would live
// in a `@crossfade/core` workspace package shared with the token-service and mirror
// CrossfadeKit's Swift model; duplicated small here to keep the skeleton standalone.

export type ServiceID = "appleMusic" | "spotify" | "amazonMusic" | "youTubeMusic" | "pandora";

/** A track as returned by a service, before unification. */
export interface ProviderTrack {
  service: ServiceID;
  providerTrackId: string;
  isrc: string | null;
  title: string;
  artists: string[];
  album?: string | null;
  durationMillis: number;
  artworkUrl?: string | null;
}

export interface UnifiedTrack {
  id: string;
  isrc: string | null;
  title: string;
  artists: string[];
  album: string | null;
  durationMillis: number;
}

export interface TrackMapping {
  unifiedTrackId: string;
  service: ServiceID;
  providerTrackId: string;
  confidence: number;
}

export type PlaylistItemOrigin = "imported" | "local";

export interface PlaylistItem {
  id: string;
  unifiedTrackId: string;
  origin: PlaylistItemOrigin;
}

export interface PlaylistSource {
  service: ServiceID;
  providerPlaylistId: string;
  lastSyncedAt: string | null;
}

export interface Playlist {
  id: string;
  ownerId: string;
  title: string;
  items: PlaylistItem[];
  importedFrom: PlaylistSource | null;
  updatedAt: string;
}

export interface SyncDiff {
  addedTrackIds: string[];
  removedItemIds: string[];
  reordered: boolean;
}

export function isNoOp(d: SyncDiff): boolean {
  return d.addedTrackIds.length === 0 && d.removedItemIds.length === 0 && !d.reordered;
}
