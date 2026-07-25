import XCTest
@testable import CrossfadeKit

final class MatchingEngineTests: XCTestCase {
    let engine = MatchingEngine()

    func testISRCMatchWinsOutright() {
        let track = MockData.midnightSignal
        let candidates = [
            ProviderTrack(service: .spotify, providerTrackID: "x", isrc: "USMOCK0000001",
                          title: "midnight signal (remastered)", artists: ["Sable Court"], durationMillis: 500),
            ProviderTrack(service: .spotify, providerTrackID: "y", isrc: "OTHER",
                          title: "Midnight Signal", artists: ["Sable Court"], durationMillis: 222_000)
        ]
        let match = engine.bestMatch(for: track, among: candidates)
        XCTAssertEqual(match?.candidate.providerTrackID, "x", "ISRC hit must win even with a worse title/duration")
        XCTAssertEqual(match?.confidence, 1.0)
    }

    func testFuzzyFallbackMatchesNormalizedTitle() {
        let track = UnifiedTrack(isrc: nil, title: "Neon Tide", artists: ["The Wavelengths"], durationMillis: 245_000)
        let candidates = [
            ProviderTrack(service: .appleMusic, providerTrackID: "z", isrc: nil,
                          title: "Neon Tide (feat. Someone)", artists: ["The Wavelengths"], durationMillis: 246_000)
        ]
        let match = engine.bestMatch(for: track, among: candidates)
        XCTAssertEqual(match?.candidate.providerTrackID, "z")
        XCTAssertLessThan(match?.confidence ?? 1, 1.0, "Non-ISRC matches must report reduced confidence")
    }

    func testFuzzyRejectsDifferentSong() {
        let track = UnifiedTrack(isrc: nil, title: "Neon Tide", artists: ["The Wavelengths"], durationMillis: 245_000)
        let candidates = [
            ProviderTrack(service: .appleMusic, providerTrackID: "no", isrc: nil,
                          title: "Completely Different", artists: ["Someone Else"], durationMillis: 100_000)
        ]
        XCTAssertNil(engine.bestMatch(for: track, among: candidates))
    }

    func testUnifyGroupsByISRC() {
        let tracks = [
            ProviderTrack(service: .appleMusic, providerTrackID: "am", isrc: "ISRC1",
                          title: "Song", artists: ["A"], durationMillis: 200_000),
            ProviderTrack(service: .spotify, providerTrackID: "sp", isrc: "ISRC1",
                          title: "Song", artists: ["A"], durationMillis: 200_000)
        ]
        let unified = engine.unify(tracks)
        XCTAssertEqual(unified.count, 1, "Same ISRC across two services collapses to one unified track")
        XCTAssertEqual(unified.first?.mappings.count, 2)
    }
}
