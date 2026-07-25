import XCTest
@testable import CrossfadeKit

final class PlaylistSyncEngineTests: XCTestCase {
    let engine = PlaylistSyncEngine()
    let fixedNow = Date(timeIntervalSince1970: 1_700_000_000)

    private func pt(_ isrc: String, _ title: String, service: ServiceID = .spotify) -> ProviderTrack {
        ProviderTrack(service: service, providerTrackID: "\(service)-\(isrc)", isrc: isrc,
                      title: title, artists: ["Artist"], durationMillis: 200_000)
    }

    /// Build a catalog + an imported playlist mirroring the given source tracks.
    private func importedPlaylist(from source: [ProviderTrack],
                                  extraLocal: [ProviderTrack] = []) -> (Playlist, UnifiedTrackCatalog) {
        let catalog = UnifiedTrackCatalog()
        var items = source.map { PlaylistItem(unifiedTrackID: catalog.ingest($0).id, origin: .imported) }
        items += extraLocal.map { PlaylistItem(unifiedTrackID: catalog.ingest($0).id, origin: .local) }
        let pl = Playlist(title: "Late Night Drive", items: items,
                          importedFrom: PlaylistSource(service: .spotify, providerPlaylistID: "sp-1"))
        return (pl, catalog)
    }

    func testAdditionInSource() {
        let (pl, catalog) = importedPlaylist(from: [pt("A", "Song A"), pt("B", "Song B")])
        let result = engine.reconcile(playlist: pl,
            source: [pt("A", "Song A"), pt("B", "Song B"), pt("C", "Song C")],
            catalog: catalog, now: { self.fixedNow })
        XCTAssertEqual(result.diff.addedTrackIDs.count, 1)
        XCTAssertFalse(result.diff.reordered)
        XCTAssertEqual(result.playlist.items.filter { $0.origin == .imported }.count, 3)
        XCTAssertEqual(result.playlist.importedFrom?.lastSyncedAt, fixedNow)
    }

    func testRemovalInSource() {
        let (pl, catalog) = importedPlaylist(from: [pt("A", "Song A"), pt("B", "Song B")])
        let result = engine.reconcile(playlist: pl, source: [pt("A", "Song A")], catalog: catalog)
        XCTAssertEqual(result.diff.removedItemIDs.count, 1)
        XCTAssertEqual(result.playlist.items.map(\.unifiedTrackID).count, 1)
    }

    func testReorderDetected() {
        let (pl, catalog) = importedPlaylist(from: [pt("A", "Song A"), pt("B", "Song B")])
        let result = engine.reconcile(playlist: pl,
            source: [pt("B", "Song B"), pt("A", "Song A")], catalog: catalog)
        XCTAssertTrue(result.diff.reordered)
        XCTAssertTrue(result.diff.addedTrackIDs.isEmpty)
        XCTAssertTrue(result.diff.removedItemIDs.isEmpty)
    }

    func testNoChangeIsNoOpButStampsSyncTime() {
        let (pl, catalog) = importedPlaylist(from: [pt("A", "Song A"), pt("B", "Song B")])
        let result = engine.reconcile(playlist: pl,
            source: [pt("A", "Song A"), pt("B", "Song B")], catalog: catalog, now: { self.fixedNow })
        XCTAssertTrue(result.diff.isNoOp)
        XCTAssertEqual(result.playlist.importedFrom?.lastSyncedAt, fixedNow)
    }

    func testLocalItemsArePreserved() {
        let (pl, catalog) = importedPlaylist(from: [pt("A", "Song A")],
                                             extraLocal: [pt("L", "Local Pick")])
        let localID = pl.items.first { $0.origin == .local }!.unifiedTrackID
        // Source adds B; local pick must survive untouched.
        let result = engine.reconcile(playlist: pl,
            source: [pt("A", "Song A"), pt("B", "Song B")], catalog: catalog)
        let locals = result.playlist.items.filter { $0.origin == .local }
        XCTAssertEqual(locals.count, 1)
        XCTAssertEqual(locals.first?.unifiedTrackID, localID)
        XCTAssertEqual(result.playlist.items.filter { $0.origin == .imported }.count, 2)
    }

    func testSurvivingItemsKeepStableIdentity() {
        let (pl, catalog) = importedPlaylist(from: [pt("A", "Song A"), pt("B", "Song B")])
        let originalAItemID = pl.items.first!.id
        let aTrackID = pl.items.first!.unifiedTrackID
        let result = engine.reconcile(playlist: pl,
            source: [pt("B", "Song B"), pt("A", "Song A")], catalog: catalog) // reordered
        let aItemAfter = result.playlist.items.first { $0.unifiedTrackID == aTrackID }
        XCTAssertEqual(aItemAfter?.id, originalAItemID, "Item identity must survive a reorder")
    }

    func testISRCDedupeAcrossServices() {
        let catalog = UnifiedTrackCatalog()
        let a = catalog.ingest(pt("SHARED", "Same Song", service: .spotify))
        let b = catalog.ingest(pt("SHARED", "Same Song", service: .appleMusic))
        XCTAssertEqual(a.id, b.id, "Same ISRC across services is one unified track")
        XCTAssertEqual(catalog.mappings(for: a.id).count, 2)
    }
}
