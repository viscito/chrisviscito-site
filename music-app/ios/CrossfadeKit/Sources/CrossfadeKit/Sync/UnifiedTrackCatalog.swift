import Foundation

/// An in-memory catalog of canonical tracks and their per-service mappings. As
/// provider tracks are ingested (from search, import, or sync), it de-duplicates
/// by ISRC (falling back to a normalized title+artist key) so the same recording
/// from two services becomes one `UnifiedTrack` with multiple `TrackMapping`s.
///
/// Production backs this with the durable store; the interface is the same.
public final class UnifiedTrackCatalog {
    private var tracks: [UUID: UnifiedTrack] = [:]
    private var mappingsByTrack: [UUID: [TrackMapping]] = [:]
    private var byISRC: [String: UUID] = [:]
    private var byFuzzyKey: [String: UUID] = [:]

    public init() {}

    /// Find-or-create the canonical track for a provider track, recording its
    /// service mapping. Idempotent: ingesting the same recording again returns the
    /// same `UnifiedTrack`.
    @discardableResult
    public func ingest(_ pt: ProviderTrack) -> UnifiedTrack {
        let fuzzyKey = MatchingEngine.normalizedKey(title: pt.title, artist: pt.artists.first ?? "")
        let existingID: UUID? = {
            if let isrc = pt.isrc { return byISRC[isrc] }
            return byFuzzyKey[fuzzyKey]
        }()

        let unified: UnifiedTrack
        if let id = existingID, let found = tracks[id] {
            unified = found
        } else {
            unified = UnifiedTrack(
                isrc: pt.isrc, title: pt.title, artists: pt.artists, album: pt.album,
                durationMillis: pt.durationMillis, artworkURL: pt.artworkURL
            )
            tracks[unified.id] = unified
            if let isrc = pt.isrc { byISRC[isrc] = unified.id } else { byFuzzyKey[fuzzyKey] = unified.id }
        }

        var maps = mappingsByTrack[unified.id] ?? []
        let alreadyMapped = maps.contains { $0.service == pt.service && $0.providerTrackID == pt.providerTrackID }
        if !alreadyMapped {
            maps.append(TrackMapping(
                unifiedTrackID: unified.id, service: pt.service,
                providerTrackID: pt.providerTrackID, confidence: pt.isrc != nil ? 1.0 : 0.85
            ))
            mappingsByTrack[unified.id] = maps
        }
        return unified
    }

    public func track(_ id: UUID) -> UnifiedTrack? { tracks[id] }
    public func mappings(for id: UUID) -> [TrackMapping] { mappingsByTrack[id] ?? [] }
    public var allTracks: [UnifiedTrack] { Array(tracks.values) }
}
