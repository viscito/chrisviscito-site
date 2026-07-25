import Foundation

/// The origin of a Crossfade playlist. Imported playlists stay linked to their
/// source and are reconciled over time (R2 — kept in sync, not a snapshot).
public struct PlaylistSource: Codable, Hashable, Sendable {
    public let service: ServiceID
    public let providerPlaylistID: String
    /// Last time Crossfade reconciled this playlist against the source.
    public var lastSyncedAt: Date?

    public init(service: ServiceID, providerPlaylistID: String, lastSyncedAt: Date? = nil) {
        self.service = service
        self.providerPlaylistID = providerPlaylistID
        self.lastSyncedAt = lastSyncedAt
    }
}

/// How a playlist item got here. The sync engine mirrors `.imported` items to the
/// source while leaving `.local` (user-added) items untouched (R2).
public enum PlaylistItemOrigin: String, Codable, Sendable {
    case imported   // came from the synced source playlist
    case local      // the user added this in Crossfade
}

/// One entry in a playlist. References a `UnifiedTrack`, so it can resolve to any
/// service the listener has connected.
public struct PlaylistItem: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public let unifiedTrackID: UUID
    public var origin: PlaylistItemOrigin
    /// Optional pin: "always play this one from Apple Music".
    public var preferredService: ServiceID?

    public init(
        id: UUID = UUID(),
        unifiedTrackID: UUID,
        origin: PlaylistItemOrigin = .local,
        preferredService: ServiceID? = nil
    ) {
        self.id = id
        self.unifiedTrackID = unifiedTrackID
        self.origin = origin
        self.preferredService = preferredService
    }
}

/// A Crossfade playlist — may mix tracks from any number of services.
public struct Playlist: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public var title: String
    public var detail: String?
    public var items: [PlaylistItem]
    /// Non-nil when this playlist was imported and is kept in sync (R2).
    public var importedFrom: PlaylistSource?
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
        title: String,
        detail: String? = nil,
        items: [PlaylistItem] = [],
        importedFrom: PlaylistSource? = nil,
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.items = items
        self.importedFrom = importedFrom
        self.updatedAt = updatedAt
    }

    public var isSynced: Bool { importedFrom != nil }
}
