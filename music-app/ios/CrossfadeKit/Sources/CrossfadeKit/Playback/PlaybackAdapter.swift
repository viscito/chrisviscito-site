import Foundation

/// Something an adapter emits back to the coordinator during playback.
public enum AdapterEvent: Sendable {
    case progress(millis: Int)
    case ended                 // the current track finished naturally
    case stalled               // buffering / temporary interruption
    case failed(reason: String)
}

/// Why a track can't be played by its adapter right now.
public enum PlayabilityBlock: Equatable, Sendable {
    case notSubscribed         // R1 — user lacks the required plan
    case notAuthorized         // service not linked / authorization expired
    case unavailableInRegion
    case leavesApp             // Mode C — playing would push the user out
}

/// The single interface every service implements so the conductor can drive it
/// uniformly. Concrete adapters (e.g. AppleMusicAdapter over MusicKit) live in the
/// app layer; the coordinator only ever sees this protocol. See ARCHITECTURE.md §2.
public protocol PlaybackAdapter: AnyObject, Sendable {
    var service: ServiceID { get }

    /// Ensure the service is authorized for playback (idempotent).
    func authorize() async throws

    /// Whether this ref can be played *right now*. Returns nil if playable, or the
    /// reason it is blocked (used by the coordinator to skip and surface a note).
    func playabilityBlock(for ref: TrackRef) async -> PlayabilityBlock?

    /// Prepare a track for playback without starting it (used for pre-warming the
    /// next adapter to shrink the cross-service handoff gap).
    func load(_ ref: TrackRef) async throws

    func play() async throws
    func pause() async
    func seek(toMillis millis: Int) async

    /// Release the audio session / SDK resources. Called on a cross-service handoff
    /// and when playback stops.
    func teardown() async

    /// A stream of playback events for the currently loaded track.
    var events: AsyncStream<AdapterEvent> { get }
}
