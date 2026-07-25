import Foundation

/// A canonical, service-agnostic recording. Crossfade playlists reference these,
/// never per-service IDs, so a playlist resolves to whatever service the
/// *listener* has connected. The ISRC is the primary cross-service key.
public struct UnifiedTrack: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    /// International Standard Recording Code — the linchpin for matching the same
    /// recording across services. Nullable, but strongly preferred (see MatchingEngine).
    public let isrc: String?
    public let title: String
    public let artists: [String]
    public let album: String?
    public let durationMillis: Int
    public let artworkURL: URL?
    public let isExplicit: Bool

    public init(
        id: UUID = UUID(),
        isrc: String?,
        title: String,
        artists: [String],
        album: String? = nil,
        durationMillis: Int,
        artworkURL: URL? = nil,
        isExplicit: Bool = false
    ) {
        self.id = id
        self.isrc = isrc
        self.title = title
        self.artists = artists
        self.album = album
        self.durationMillis = durationMillis
        self.artworkURL = artworkURL
        self.isExplicit = isExplicit
    }

    public var primaryArtist: String { artists.first ?? "Unknown Artist" }
}

/// How a `UnifiedTrack` is realized on a specific service.
public struct TrackMapping: Codable, Hashable, Sendable {
    public let unifiedTrackID: UUID
    public let service: ServiceID
    /// The service's own catalog identifier (e.g. an Apple Music catalog ID).
    public let providerTrackID: String
    /// 1.0 for an ISRC match; < 1.0 for a fuzzy match (see MatchingEngine).
    public let confidence: Double
    /// The user confirmed this mapping is correct (overrides a low confidence).
    public let verifiedByUser: Bool

    public init(
        unifiedTrackID: UUID,
        service: ServiceID,
        providerTrackID: String,
        confidence: Double,
        verifiedByUser: Bool = false
    ) {
        self.unifiedTrackID = unifiedTrackID
        self.service = service
        self.providerTrackID = providerTrackID
        self.confidence = confidence
        self.verifiedByUser = verifiedByUser
    }

    public var isTrusted: Bool { verifiedByUser || confidence >= 0.999 }
}
