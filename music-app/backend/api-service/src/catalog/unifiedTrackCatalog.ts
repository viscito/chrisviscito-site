import { randomUUID } from "node:crypto";
import type { ProviderTrack, TrackMapping, UnifiedTrack } from "../domain.js";

export function normalize(s: string): string {
  let out = s.toLowerCase();
  for (const noise of [" (feat", " feat.", " ft.", " - remaster", " (remaster", " - single version", " (live"]) {
    const i = out.indexOf(noise);
    if (i >= 0) out = out.slice(0, i);
  }
  return out.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
export function normalizedKey(title: string, artist: string): string {
  return `${normalize(title)}|${normalize(artist)}`;
}

/**
 * The unified-track catalog — also serves as the user's library store. Find-or-create
 * canonical tracks (ISRC-first, normalized fallback), record per-service mappings, and
 * list them for the library endpoint. Mirrors CrossfadeKit's UnifiedTrackCatalog.
 */
export class UnifiedTrackCatalog {
  private tracks = new Map<string, UnifiedTrack>();
  private mappings = new Map<string, TrackMapping[]>();
  private byIsrc = new Map<string, string>();
  private byFuzzy = new Map<string, string>();

  ingest(pt: ProviderTrack): UnifiedTrack {
    const fuzzy = normalizedKey(pt.title, pt.artists[0] ?? "");
    const existingId = pt.isrc ? this.byIsrc.get(pt.isrc) : this.byFuzzy.get(fuzzy);

    let unified = existingId ? this.tracks.get(existingId) : undefined;
    if (!unified) {
      unified = {
        id: randomUUID(),
        isrc: pt.isrc,
        title: pt.title,
        artists: pt.artists,
        album: pt.album ?? null,
        durationMillis: pt.durationMillis,
        artworkUrl: pt.artworkUrl ?? null,
        isExplicit: false,
      };
      this.tracks.set(unified.id, unified);
      if (pt.isrc) this.byIsrc.set(pt.isrc, unified.id);
      else this.byFuzzy.set(fuzzy, unified.id);
    }

    const maps = this.mappings.get(unified.id) ?? [];
    if (!maps.some((m) => m.service === pt.service && m.providerTrackId === pt.providerTrackId)) {
      maps.push({
        service: pt.service,
        providerTrackId: pt.providerTrackId,
        confidence: pt.isrc ? 1 : 0.85,
        verifiedByUser: false,
      });
      this.mappings.set(unified.id, maps);
    }
    return unified;
  }

  get(id: string): UnifiedTrack | undefined {
    return this.tracks.get(id);
  }
  mappingsFor(id: string): TrackMapping[] {
    return this.mappings.get(id) ?? [];
  }
  all(): UnifiedTrack[] {
    return [...this.tracks.values()];
  }
}
