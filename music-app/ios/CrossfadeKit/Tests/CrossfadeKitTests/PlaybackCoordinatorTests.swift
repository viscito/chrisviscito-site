import XCTest
@testable import CrossfadeKit

@MainActor
final class PlaybackCoordinatorTests: XCTestCase {

    private func ref(_ service: ServiceID, _ title: String) -> TrackRef {
        TrackRef(unifiedTrackID: UUID(), service: service, providerTrackID: title,
                 mode: SupportedServices.descriptor(for: service)?.playbackMode ?? .inApp,
                 title: title, artist: "Artist", durationMillis: 200_000)
    }

    func testStartsOnFirstPlayableTrack() async {
        let c = PlaybackCoordinator()
        c.register(MockPlaybackAdapter(service: .appleMusic, entitled: true))
        await c.setQueue([ref(.appleMusic, "A"), ref(.appleMusic, "B")])
        XCTAssertEqual(c.snapshot.nowPlaying?.title, "A")
        XCTAssertTrue(c.snapshot.isPlaying)
    }

    func testSkipsUnplayableTrackAndReportsReason() async {
        // Apple entitled; Spotify linked but not Premium (R1).
        let c = PlaybackCoordinator()
        c.register(MockPlaybackAdapter(service: .appleMusic, entitled: true))
        c.register(MockPlaybackAdapter(service: .spotify, entitled: false))

        await c.setQueue([ref(.appleMusic, "A"), ref(.spotify, "blocked"), ref(.appleMusic, "C")])
        XCTAssertEqual(c.snapshot.nowPlaying?.title, "A")

        // Advancing must skip the blocked Spotify track and land on C, noting why.
        await c.next()
        XCTAssertEqual(c.snapshot.nowPlaying?.title, "C")
        XCTAssertEqual(c.snapshot.lastSkip?.reason, .notSubscribed)
    }

    func testHandoffPendingWhenNextServiceDiffers() async {
        let c = PlaybackCoordinator()
        c.register(MockPlaybackAdapter(service: .appleMusic, entitled: true))
        c.register(MockPlaybackAdapter(service: .spotify, entitled: true))

        await c.setQueue([ref(.appleMusic, "A"), ref(.spotify, "B")])
        XCTAssertTrue(c.snapshot.handoffPending, "A→B crosses services, so a handoff is pending")
    }

    func testStopsWhenNothingPlayable() async {
        let c = PlaybackCoordinator()
        c.register(MockPlaybackAdapter(service: .spotify, entitled: false))
        await c.setQueue([ref(.spotify, "x"), ref(.spotify, "y")])
        XCTAssertNil(c.snapshot.nowPlaying)
        XCTAssertEqual(c.snapshot.lastSkip?.reason, .notSubscribed)
    }
}
