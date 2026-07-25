import Foundation
import CrossfadeKit
#if canImport(MusicKit)
import MusicKit

/// Reads the Apple Music catalog & the user's library via MusicKit, mapping results
/// into Crossfade's service-agnostic DTOs. MusicKit handles user-scoped auth on
/// device; catalog API calls needing a developer token are minted server-side.
@available(iOS 16.0, *)
public struct AppleMusicClient: MusicServiceClient {
    public let service: ServiceID = .appleMusic
    public init() {}

    public func refreshConnection() async throws -> ServiceConnection {
        let auth = await MusicAuthorization.request()
        let sub = try? await MusicSubscription.current
        let entitlement: EntitlementState = (sub?.canPlayCatalogContent ?? false) ? .active
            : (auth == .authorized ? .insufficientPlan : .unknown)
        return ServiceConnection(service: .appleMusic, isLinked: auth == .authorized,
                                 entitlement: entitlement, storefront: nil, planName: nil)
    }

    public func search(_ query: String) async throws -> [ProviderTrack] {
        var request = MusicCatalogSearchRequest(term: query, types: [Song.self])
        request.limit = 25
        let response = try await request.response()
        return response.songs.map(Self.map)
    }

    public func libraryPlaylists() async throws -> [ProviderPlaylist] {
        let request = MusicLibraryRequest<Playlist>()
        let response = try await request.response()
        return response.items.map {
            ProviderPlaylist(id: $0.id.rawValue, service: .appleMusic,
                             title: $0.name, trackCount: $0.entries?.count ?? 0)
        }
    }

    public func tracks(inPlaylist providerPlaylistID: String) async throws -> [ProviderTrack] {
        let request = MusicLibraryRequest<Playlist>()
        let response = try await request.response()
        guard let playlist = response.items.first(where: { $0.id.rawValue == providerPlaylistID }) else { return [] }
        let detailed = try await playlist.with([.tracks])
        return (detailed.tracks ?? []).compactMap { track in
            guard case let .song(song) = track else { return nil }
            return Self.map(song)
        }
    }

    private static func map(_ song: Song) -> ProviderTrack {
        ProviderTrack(
            service: .appleMusic,
            providerTrackID: song.id.rawValue,
            isrc: song.isrc,                                  // <-- persisted for cross-service matching
            title: song.title,
            artists: [song.artistName],
            album: song.albumTitle,
            durationMillis: Int((song.duration ?? 0) * 1000),
            artworkURL: song.artwork?.url(width: 300, height: 300)
        )
    }
}
#endif
