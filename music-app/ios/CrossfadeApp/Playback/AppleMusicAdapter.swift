import Foundation
import CrossfadeKit
#if canImport(MusicKit)
import MusicKit

/// Mode A adapter: plays Apple Music catalog tracks fully inside Crossfade using
/// MusicKit's `ApplicationMusicPlayer`. The user never leaves the app.
///
/// Requirements to make this run for real (see ARCHITECTURE.md §3 / §7):
///   • The app target has the **MusicKit** capability enabled.
///   • Info.plist has **NSAppleMusicUsageDescription**.
///   • Catalog *API* calls that need a developer token are minted **server-side**
///     from your `.p8` key (never shipped in the binary). MusicKit's on-device
///     requests below handle user-scoped auth for you.
@available(iOS 15.0, *)
public final class AppleMusicAdapter: PlaybackAdapter, @unchecked Sendable {
    public let service: ServiceID = .appleMusic

    private let player = ApplicationMusicPlayer.shared
    private var continuation: AsyncStream<AdapterEvent>.Continuation?
    public let events: AsyncStream<AdapterEvent>
    private var pollTask: Task<Void, Never>?

    public init() {
        var cont: AsyncStream<AdapterEvent>.Continuation!
        self.events = AsyncStream { cont = $0 }
        self.continuation = cont
    }

    public func authorize() async throws {
        let status = await MusicAuthorization.request()
        guard status == .authorized else { throw AdapterError.notAuthorized }
    }

    public func playabilityBlock(for ref: TrackRef) async -> PlayabilityBlock? {
        // R1: catalog playback requires an active subscription.
        guard let sub = try? await MusicSubscription.current else { return .notAuthorized }
        return sub.canPlayCatalogContent ? nil : .notSubscribed
    }

    public func load(_ ref: TrackRef) async throws {
        let id = MusicItemID(ref.providerTrackID)
        let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: id)
        let response = try await request.response()
        guard let song = response.items.first else { throw AdapterError.trackNotFound }
        player.queue = ApplicationMusicPlayer.Queue(for: [song])
        try await player.prepareToPlay()
    }

    public func play() async throws {
        try await player.play()
        startPolling()
    }

    public func pause() async { player.pause() }

    public func seek(toMillis millis: Int) async {
        player.playbackTime = TimeInterval(millis) / 1000.0
    }

    public func teardown() async {
        pollTask?.cancel()
        player.stop()
    }

    // MusicKit exposes state but no single "did end" callback; poll playbackTime and
    // detect the transition to a stopped state near the end. Good enough for the
    // skeleton — production would also observe `queue.currentEntry`.
    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                let ms = Int(self.player.playbackTime * 1000)
                self.continuation?.yield(.progress(millis: ms))
                if self.player.state.playbackStatus == .stopped, ms > 0 {
                    self.continuation?.yield(.ended)
                    return
                }
                try? await Task.sleep(nanoseconds: 500_000_000)
            }
        }
    }

    enum AdapterError: Error { case notAuthorized, trackNotFound }
}
#endif
