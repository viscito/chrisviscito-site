import Foundation

/// What changed when an imported playlist was reconciled against its source.
public struct SyncDiff: Equatable, Sendable {
    /// Canonical tracks newly present in the source.
    public var addedTrackIDs: [UUID]
    /// Existing imported items whose track is gone from the source (to be removed).
    public var removedItemIDs: [UUID]
    /// The surviving imported tracks changed order to match the source.
    public var reordered: Bool

    public var isNoOp: Bool { addedTrackIDs.isEmpty && removedItemIDs.isEmpty && !reordered }

    public static let noChange = SyncDiff(addedTrackIDs: [], removedItemIDs: [], reordered: false)
}

public struct SyncResult: Sendable {
    public var playlist: Playlist
    public var diff: SyncDiff
}

/// Reconciles a kept-in-sync imported playlist (R2) against the current state of
/// its source. The sync is **source-authoritative for imported items** — additions,
/// removals, and reordering on the source flow into Crossfade — while **user-added
/// (`.local`) items are preserved**. This is the one-way-with-local-preservation
/// policy from PRODUCT_SPEC R2; true two-way sync/conflict resolution is future work.
public struct PlaylistSyncEngine {
    public init() {}

    /// - Parameters:
    ///   - playlist: the current Crossfade playlist (must be an imported one).
    ///   - source: the source playlist's current ordered tracks (from the service).
    ///   - catalog: resolves provider tracks to canonical `UnifiedTrack`s (ISRC-first).
    ///   - now: injectable clock for deterministic tests.
    public func reconcile(
        playlist: Playlist,
        source: [ProviderTrack],
        catalog: UnifiedTrackCatalog,
        now: () -> Date = Date.init
    ) -> SyncResult {
        // 1. Resolve the source into desired imported track IDs, in source order,
        //    de-duplicating tracks that resolve to the same recording.
        var desiredTrackIDs: [UUID] = []
        var seen = Set<UUID>()
        for pt in source {
            let track = catalog.ingest(pt)
            if seen.insert(track.id).inserted { desiredTrackIDs.append(track.id) }
        }

        // 2. Reuse existing imported items (stable identity) or create new ones.
        let existingImported = playlist.items.filter { $0.origin == .imported }
        let existingByTrack = Dictionary(
            existingImported.map { ($0.unifiedTrackID, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        let desiredItems: [PlaylistItem] = desiredTrackIDs.map { trackID in
            existingByTrack[trackID] ?? PlaylistItem(unifiedTrackID: trackID, origin: .imported)
        }

        // 3. Diff.
        let existingOrder = existingImported.map(\.unifiedTrackID)
        let existingSet = Set(existingOrder)
        let desiredSet = Set(desiredTrackIDs)
        let added = desiredTrackIDs.filter { !existingSet.contains($0) }
        let removed = existingImported.filter { !desiredSet.contains($0.unifiedTrackID) }.map(\.id)
        let survivingExisting = existingOrder.filter { desiredSet.contains($0) }
        let survivingDesired = desiredTrackIDs.filter { existingSet.contains($0) }
        let reordered = survivingExisting != survivingDesired
        let diff = SyncDiff(addedTrackIDs: added, removedItemIDs: removed, reordered: reordered)

        // 4. Compose the updated playlist: mirrored imported block + preserved local
        //    items. Stamp the sync time even on a no-op so "last synced" is honest.
        let localItems = playlist.items.filter { $0.origin == .local }
        var updated = playlist
        updated.items = desiredItems + localItems
        updated.updatedAt = now()
        updated.importedFrom?.lastSyncedAt = now()

        return SyncResult(playlist: updated, diff: diff)
    }
}
