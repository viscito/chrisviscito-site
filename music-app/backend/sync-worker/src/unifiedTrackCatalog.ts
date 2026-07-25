import { randomUUID } from "node:crypto";
import type { ProviderTrack, TrackMapping, UnifiedTrack } from "./domain.js";

/** Normalize a title/artist for fuzzy de-dup (port of CrossfadeKit's MatchingEngine). */
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
 * The persistent unified-track catalog: find-or-create canonical tracks, de-duping
 * by ISRC (normalized fallback) and recording per-service mappings. Because the
 * same catalog persists across runs, ingesting the same recording always yields the
 * same `UnifiedTrack.id` — which is what lets the sync engine recognize a source
 * track as an existing playlist item rather than a new one.
 *
 * In production this is backed by the durable store; the interface is unchanged.
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
      };
      this.tracks.set(unified.id, unified);
      if (pt.isrc) this.byIsrc.set(pt.isrc, unified.id);
      else this.byFuzzy.set(fuzzy, unified.id);
    }

    const maps = this.mappings.get(unified.id) ?? [];
    if (!maps.some((m) => m.service === pt.service && m.providerTrackId === pt.providerTrackId)) {
      maps.push({
        unifiedTrackId: unified.id,
        service: pt.service,
        providerTrackId: pt.providerTrackId,
        confidence: pt.isrc ? 1 : 0.85,
      });
      this.mappings.set(unified.id, maps);
    }
    return unified;
  }

  track(id: string): UnifiedTrack | undefined {
    return this.tracks.get(id);
  }
  mappingsFor(id: string): TrackMapping[] {
    return this.mappings.get(id) ?? [];
  }
}
