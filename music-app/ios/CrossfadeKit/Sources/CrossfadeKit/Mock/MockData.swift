import Foundation

/// Believable sample content (invented tracks/artists) for previews, the mock app
/// shell, and tests. No real recordings are referenced.
public enum MockData {
    public static let connections: [ServiceConnection] = [
        ServiceConnection(service: .appleMusic, isLinked: true, entitlement: .active,
                          storefront: "us", planName: "Individual"),
        // Linked on Free — playback blocked (R1 demonstration).
        ServiceConnection(service: .spotify, isLinked: true, entitlement: .insufficientPlan,
                          planName: "Free")
    ]

    // Canonical tracks.
    public static let midnightSignal = UnifiedTrack(isrc: "USMOCK0000001", title: "Midnight Signal",
        artists: ["Sable Court"], album: "Static Bloom", durationMillis: 222_000)
    public static let neonTide = UnifiedTrack(isrc: "USMOCK0000002", title: "Neon Tide",
        artists: ["The Wavelengths"], album: "Low Beam", durationMillis: 245_000)
    public static let slowHeadlights = UnifiedTrack(isrc: "USMOCK0000003", title: "Slow Headlights",
        artists: ["Aster Vale"], album: "Night Work", durationMillis: 198_000)
    public static let paperLanterns = UnifiedTrack(isrc: "USMOCK0000004", title: "Paper Lanterns",
        artists: ["Ilse Renn"], album: "Quiet Rooms", durationMillis: 312_000)

    public static let unifiedTracks = [midnightSignal, neonTide, slowHeadlights, paperLanterns]

    // Mappings: Apple Music plays everything; Spotify covers the "drive" set.
    public static let mappings: [TrackMapping] = [
        TrackMapping(unifiedTrackID: midnightSignal.id, service: .appleMusic, providerTrackID: "am-1", confidence: 1),
        TrackMapping(unifiedTrackID: midnightSignal.id, service: .spotify, providerTrackID: "sp-1", confidence: 1),
        TrackMapping(unifiedTrackID: neonTide.id, service: .spotify, providerTrackID: "sp-2", confidence: 1),
        TrackMapping(unifiedTrackID: neonTide.id, service: .appleMusic, providerTrackID: "am-2", confidence: 1),
        TrackMapping(unifiedTrackID: slowHeadlights.id, service: .appleMusic, providerTrackID: "am-3", confidence: 1),
        TrackMapping(unifiedTrackID: paperLanterns.id, service: .appleMusic, providerTrackID: "am-4", confidence: 1)
    ]

    public static let playlists: [Playlist] = [
        Playlist(title: "Late Night Drive", detail: "18 songs",
                 items: [midnightSignal, neonTide, slowHeadlights].map { PlaylistItem(unifiedTrackID: $0.id) },
                 importedFrom: PlaylistSource(service: .spotify, providerPlaylistID: "sp-pl-1", lastSyncedAt: Date())),
        Playlist(title: "Focus Flow", detail: "24 songs",
                 items: [PlaylistItem(unifiedTrackID: paperLanterns.id)])
    ]

    /// Resolve a playlist into a playable queue, preferring the service the user can
    /// actually play (mirrors what the app's queue builder does with real mappings).
    public static func queue(for playlist: Playlist,
                             connections: [ServiceConnection] = connections) -> [TrackRef] {
        let playable = Set(connections.filter { $0.canPlay }.map { $0.service })
        return playlist.items.compactMap { item -> TrackRef? in
            guard let track = unifiedTracks.first(where: { $0.id == item.unifiedTrackID }) else { return nil }
            let candidates = mappings.filter { $0.unifiedTrackID == item.unifiedTrackID }
            // Prefer a mapping on a playable service; else fall back to any mapping
            // (the coordinator will skip it and surface the reason).
            let chosen = candidates.first { playable.contains($0.service) } ?? candidates.first
            guard let m = chosen else { return nil }
            let mode = SupportedServices.descriptor(for: m.service)?.playbackMode ?? .inApp
            return TrackRef(unifiedTrackID: track.id, service: m.service, providerTrackID: m.providerTrackID,
                            mode: mode, title: track.title, artist: track.primaryArtist,
                            durationMillis: track.durationMillis)
        }
    }
}
