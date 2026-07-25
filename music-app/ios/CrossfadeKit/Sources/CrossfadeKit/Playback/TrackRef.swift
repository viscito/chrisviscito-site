import Foundation

/// A concrete, playable pointer to one recording on one service. This is what the
/// `PlaybackCoordinator` queues and what a `PlaybackAdapter` knows how to play.
///
/// It is resolved from a `PlaylistItem` (+ `TrackMapping`) at queue-build time:
/// the unified track is mapped to whatever service the listener can actually play.
public struct TrackRef: Identifiable, Hashable, Sendable {
    public let id: UUID
    public let unifiedTrackID: UUID
    public let service: ServiceID
    public let providerTrackID: String
    public let mode: PlaybackMode
    // Display metadata (kept on the ref so the player UI needs no extra lookup).
    public let title: String
    public let artist: String
    public let durationMillis: Int
    public let artworkURL: URL?

    public init(
        id: UUID = UUID(),
        unifiedTrackID: UUID,
        service: ServiceID,
        providerTrackID: String,
        mode: PlaybackMode,
        title: String,
        artist: String,
        durationMillis: Int,
        artworkURL: URL? = nil
    ) {
        self.id = id
        self.unifiedTrackID = unifiedTrackID
        self.service = service
        self.providerTrackID = providerTrackID
        self.mode = mode
        self.title = title
        self.artist = artist
        self.durationMillis = durationMillis
        self.artworkURL = artworkURL
    }
}
