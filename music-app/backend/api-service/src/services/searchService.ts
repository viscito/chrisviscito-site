import { canPlay, type Connection, type ServiceId, type UnifiedTrack } from "../domain.js";
import { playbackModeFor } from "../catalog/supportedServices.js";
import type { UnifiedTrackCatalog } from "../catalog/unifiedTrackCatalog.js";
import type { ProviderGateway } from "../providers/providerGateway.js";

export interface SearchResult {
  track: UnifiedTrack;
  availableOn: ServiceId[];
  playableOn: ServiceId[];
}

/**
 * Cross-platform search (R3): fan out to the user's linked services, unify results
 * by ISRC, and mark which services can play each result (R1). Results are ordered
 * by how many services carry them (a rough relevance/availability signal).
 */
export async function crossServiceSearch(
  userId: string,
  query: string,
  services: ServiceId[],
  gateway: ProviderGateway,
  catalog: UnifiedTrackCatalog,
  connections: Connection[],
): Promise<SearchResult[]> {
  const playableServices = new Set(connections.filter((c) => canPlay(c)).map((c) => c.service));
  const availabilityByTrack = new Map<string, { track: UnifiedTrack; services: Set<ServiceId> }>();

  for (const service of services) {
    const providerTracks = await gateway.search(userId, service, query);
    for (const pt of providerTracks) {
      const unified = catalog.ingest(pt); // persists the ISRC + mapping (dedupes across services)
      const entry = availabilityByTrack.get(unified.id) ?? { track: unified, services: new Set<ServiceId>() };
      entry.services.add(service);
      availabilityByTrack.set(unified.id, entry);
    }
  }

  return [...availabilityByTrack.values()]
    .map(({ track, services: avail }) => {
      const availableOn = [...avail];
      const playableOn = availableOn.filter(
        (s) => playableServices.has(s) && playbackModeFor(s) !== "deepLinkHandoff",
      );
      return { track, availableOn, playableOn };
    })
    .sort((a, b) => b.availableOn.length - a.availableOn.length);
}
