import { randomUUID } from "node:crypto";
import type { Connection, Playlist, ProviderTrack } from "./domain.js";
import { UnifiedTrackCatalog } from "./catalog/unifiedTrackCatalog.js";
import { InMemoryConnectionStore, InMemoryPlaylistStore } from "./stores/stores.js";
import { MockProviderGateway } from "./providers/providerGateway.js";

export const DEMO_USER = "dev-user-1";

function t(service: ProviderTrack["service"], id: string, isrc: string, title: string, artist: string): ProviderTrack {
  return { service, providerTrackId: id, isrc, title, artists: [artist], durationMillis: 210_000 };
}

/** Build a fully-wired set of dependencies with believable demo content. */
export function buildSeededDeps() {
  const apple: ProviderTrack[] = [
    t("appleMusic", "am-mid", "ISRC_MID", "Midnight Signal", "Sable Court"),
    t("appleMusic", "am-neon", "ISRC_NEON", "Neon Tide", "The Wavelengths"),
    t("appleMusic", "am-slow", "ISRC_SLOW", "Slow Headlights", "Aster Vale"),
    t("appleMusic", "am-paper", "ISRC_PAPER", "Paper Lanterns", "Ilse Renn"),
  ];
  const spotify: ProviderTrack[] = [
    t("spotify", "sp-mid", "ISRC_MID", "Midnight Signal", "Sable Court"), // shared ISRC with apple
    t("spotify", "sp-neon", "ISRC_NEON", "Neon Tide", "The Wavelengths"),
    t("spotify", "sp-coast", "ISRC_COAST", "Coast Road", "Nova Divide"),
  ];

  const gateway = new MockProviderGateway({
    appleMusic: { catalog: apple, playlists: [] },
    spotify: {
      catalog: spotify,
      playlists: [
        { playlist: { id: "sp-pl-1", service: "spotify", title: "Late Night Drive", trackCount: 3 }, trackIds: ["sp-mid", "sp-neon", "sp-coast"] },
        { playlist: { id: "sp-pl-2", service: "spotify", title: "Rainy Sunday", trackCount: 0 }, trackIds: [] },
      ],
    },
  });

  // Populate the unified library from both services (cross-service ISRC de-dup).
  const catalog = new UnifiedTrackCatalog();
  [...apple, ...spotify].forEach((pt) => catalog.ingest(pt));

  const now = new Date().toISOString();
  const drive: Playlist = {
    id: randomUUID(), ownerId: DEMO_USER, title: "Late Night Drive", detail: "Imported from spotify",
    items: ["sp-mid", "sp-neon", "sp-coast"].map((pid) => ({
      id: randomUUID(),
      unifiedTrackId: catalog.ingest(spotify.find((s) => s.providerTrackId === pid)!).id,
      origin: "imported" as const, preferredService: null,
    })),
    importedFrom: { service: "spotify", providerPlaylistId: "sp-pl-1", lastSyncedAt: now },
    updatedAt: now,
  };
  const focus: Playlist = {
    id: randomUUID(), ownerId: DEMO_USER, title: "Focus Flow", detail: "Made in Crossfade",
    items: [{ id: randomUUID(), unifiedTrackId: catalog.ingest(apple[3]!).id, origin: "local", preferredService: null }],
    importedFrom: null, updatedAt: now,
  };

  const connections: Connection[] = [
    { service: "appleMusic", isLinked: true, entitlement: "active", storefront: "us", connectedAt: now },
    { service: "spotify", isLinked: true, entitlement: "insufficientPlan", storefront: null, connectedAt: now }, // Free → play-blocked (R1)
  ];

  return {
    catalog,
    gateway,
    playlists: new InMemoryPlaylistStore([drive, focus]),
    connections: new InMemoryConnectionStore({ [DEMO_USER]: connections }),
  };
}
