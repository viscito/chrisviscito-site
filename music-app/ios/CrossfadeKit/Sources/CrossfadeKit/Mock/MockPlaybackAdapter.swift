import Foundation

/// A `PlaybackAdapter` that simulates playback with no real audio. Used by
/// SwiftUI previews, tests, and the mock app shell. Real adapters (AppleMusicAdapter
/// over MusicKit) replace this in the app layer.
public final class MockPlaybackAdapter: PlaybackAdapter, @unchecked Sendable {
    public let service: ServiceID
    /// Simulated entitlement — when false, `playabilityBlock` returns `.notSubscribed` (R1).
    private let entitled: Bool
    private let mode: PlaybackMode

    private var continuation: AsyncStream<AdapterEvent>.Continuation?
    public let events: AsyncStream<AdapterEvent>

    public init(service: ServiceID, entitled: Bool = true) {
        self.service = service
        self.entitled = entitled
        self.mode = SupportedServices.descriptor(for: service)?.playbackMode ?? .inApp
        var cont: AsyncStream<AdapterEvent>.Continuation!
        self.events = AsyncStream { cont = $0 }
        self.continuation = cont
    }

    public func authorize() async throws {}

    public func playabilityBlock(for ref: TrackRef) async -> PlayabilityBlock? {
        if mode == .deepLinkHandoff { return .leavesApp }
        if !entitled { return .notSubscribed }
        return nil
    }

    public func load(_ ref: TrackRef) async throws {}
    public func play() async throws { continuation?.yield(.progress(millis: 0)) }
    public func pause() async {}
    public func seek(toMillis millis: Int) async { continuation?.yield(.progress(millis: millis)) }
    public func teardown() async {}

    /// Test hook: simulate the current track finishing.
    public func simulateEnded() { continuation?.yield(.ended) }
}
