// Domain types mirroring the OpenAPI contract (backend/api/openapi.yaml) and
// CrossfadeKit's Swift model. In a monorepo these would live in @crossfade/core.

export type ServiceId = "appleMusic" | "spotify" | "amazonMusic" | "youTubeMusic" | "pandora";
export type PlaybackMode = "inApp" | "backgroundBroker" | "deepLinkHandoff";
export type SupportStatus = "live" | "comingNext" | "investigating" | "notSupported";
export type EntitlementState = "active" | "insufficientPlan" | "unknown";
export type PlaylistItemOrigin = "imported" | "local";
export type BlockedReason = "notSubscribed" | "notAuthorized" | "unavailableInRegion" | "leavesApp";

export interface UnifiedTrack {
  id: string;
  isrc: string | null;
  title: string;
  artists: string[];
  album: string | null;
  durationMillis: number;
  artworkUrl: string | null;
  isExplicit: boolean;
}

export interface TrackMapping {
  service: ServiceId;
  providerTrackId: string;
  confidence: number;
  verifiedByUser: boolean;
}

export interface Connection {
  service: ServiceId;
  isLinked: boolean;
  entitlement: EntitlementState;
  storefront: string | null;
  connectedAt: string | null;
}

/** R1 gate: a linked service is playable only with an active plan. */
export function canPlay(c: Connection | undefined): boolean {
  return !!c && c.isLinked && c.entitlement === "active";
}

export interface PlaylistSource {
  service: ServiceId;
  providerPlaylistId: string;
  lastSyncedAt: string | null;
}

export interface PlaylistItem {
  id: string;
  unifiedTrackId: string;
  origin: PlaylistItemOrigin;
  preferredService: ServiceId | null;
}

export interface Playlist {
  id: string;
  ownerId: string;
  title: string;
  detail: string | null;
  items: PlaylistItem[];
  importedFrom: PlaylistSource | null;
  updatedAt: string;
}

export interface ProviderTrack {
  service: ServiceId;
  providerTrackId: string;
  isrc: string | null;
  title: string;
  artists: string[];
  album?: string | null;
  durationMillis: number;
  artworkUrl?: string | null;
}

export interface ProviderPlaylist {
  id: string;
  service: ServiceId;
  title: string;
  trackCount: number;
}

export interface SyncDiff {
  addedTrackIds: string[];
  removedItemIds: string[];
  reordered: boolean;
}

export interface QueueTrack {
  unifiedTrackId: string;
  title: string;
  artist: string;
  durationMillis: number;
  service: ServiceId;
  providerTrackId: string;
  playbackMode: PlaybackMode;
  playable: boolean;
  blockedReason: BlockedReason | null;
}
