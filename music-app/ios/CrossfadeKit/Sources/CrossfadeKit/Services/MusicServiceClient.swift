import Foundation

/// A track as returned by a single service's catalog/library API, before it is
/// unified. Carries the provider ID + ISRC so the MatchingEngine can canonicalize it.
public struct ProviderTrack: Hashable, Sendable {
    public let service: ServiceID
    public let providerTrackID: String
    public let isrc: String?
    public let title: String
    public let artists: [String]
    public let album: String?
    public let durationMillis: Int
    public let artworkURL: URL?

    public init(service: ServiceID, providerTrackID: String, isrc: String?, title: String,
                artists: [String], album: String? = nil, durationMillis: Int, artworkURL: URL? = nil) {
        self.service = service; self.providerTrackID = providerTrackID; self.isrc = isrc
        self.title = title; self.artists = artists; self.album = album
        self.durationMillis = durationMillis; self.artworkURL = artworkURL
    }
}

/// A playlist as it exists on a service (for the import picker).
public struct ProviderPlaylist: Identifiable, Hashable, Sendable {
    public let id: String            // provider playlist ID
    public let service: ServiceID
    public let title: String
    public let trackCount: Int

    public init(id: String, service: ServiceID, title: String, trackCount: Int) {
        self.id = id; self.service = service; self.title = title; self.trackCount = trackCount
    }
}

/// The per-service backend/catalog abstraction: read catalog & library, search,
/// and import. Every service implements this once; the app core is unchanged when
/// a new service is added. Concrete implementations (AppleMusicClient over the
/// Apple Music API) live in the app layer.
public protocol MusicServiceClient: Sendable {
    var service: ServiceID { get }

    /// Confirm authorization + fetch the user's entitlement (R1).
    func refreshConnection() async throws -> ServiceConnection

    /// Search this service's catalog.
    func search(_ query: String) async throws -> [ProviderTrack]

    /// The user's playlists on this service (import picker).
    func libraryPlaylists() async throws -> [ProviderPlaylist]

    /// The tracks of one provider playlist (used by import + sync reconciliation).
    func tracks(inPlaylist providerPlaylistID: String) async throws -> [ProviderTrack]
}
