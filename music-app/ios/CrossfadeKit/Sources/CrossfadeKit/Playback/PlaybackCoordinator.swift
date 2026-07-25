import Foundation

/// A skip that happened because a track wasn't playable (surfaced to the UI).
public struct SkipNotice: Sendable, Equatable {
    public let ref: TrackRef
    public let reason: PlayabilityBlock
}

/// The full playback state the UI renders. Recomputed on every transition.
public struct PlaybackSnapshot: Sendable, Equatable {
    public var nowPlaying: TrackRef?
    public var upNext: TrackRef?
    public var isPlaying: Bool
    public var positionMillis: Int
    /// True when the next track uses a *different* service — i.e. a cross-service
    /// handoff (and its unavoidable gap) is coming. Drives the crossfader UI.
    public var handoffPending: Bool
    public var lastSkip: SkipNotice?

    public static let idle = PlaybackSnapshot(
        nowPlaying: nil, upNext: nil, isPlaying: false,
        positionMillis: 0, handoffPending: false, lastSkip: nil
    )
}

/// The conductor. Holds an abstract queue of `TrackRef`s and delegates real
/// playback to the per-service `PlaybackAdapter`s. It never decodes audio itself.
///
/// Responsibilities (ARCHITECTURE.md §2):
///  • pick the adapter for the current track's service
///  • on natural end, advance — tearing down/spinning up adapters across a
///    service boundary (the handoff gap)
///  • pre-warm the next adapter to shrink that gap
///  • skip tracks that aren't playable (e.g. R1: no subscription) and surface why
@MainActor
public final class PlaybackCoordinator {
    private var adapters: [ServiceID: PlaybackAdapter] = [:]
    private(set) var queue: [TrackRef] = []
    private(set) var index: Int = 0
    private var activeService: ServiceID?
    private var eventTask: Task<Void, Never>?

    public private(set) var snapshot: PlaybackSnapshot = .idle {
        didSet { onSnapshotChange?(snapshot) }
    }

    /// UI observation hook. The app layer wraps this in an ObservableObject.
    public var onSnapshotChange: ((PlaybackSnapshot) -> Void)?

    public init() {}

    // MARK: Registration

    public func register(_ adapter: PlaybackAdapter) {
        adapters[adapter.service] = adapter
    }

    // MARK: Queue control

    /// Replace the queue and begin playback at `startAt`, skipping forward past any
    /// unplayable leading tracks.
    public func setQueue(_ refs: [TrackRef], startAt: Int = 0) async {
        queue = refs
        index = max(0, min(startAt, refs.count - 1))
        await activate(index, direction: .forward)
    }

    public func togglePlayPause() async {
        snapshot.isPlaying ? await pause() : await resume()
    }

    public func pause() async {
        await currentAdapter?.pause()
        snapshot.isPlaying = false
    }

    public func resume() async {
        guard currentAdapter != nil else { return }
        try? await currentAdapter?.play()
        snapshot.isPlaying = true
    }

    public func next() async { await advance(.forward) }
    public func previous() async { await advance(.backward) }

    public func seek(toMillis millis: Int) async {
        await currentAdapter?.seek(toMillis: millis)
        snapshot.positionMillis = millis
    }

    public func stop() async {
        eventTask?.cancel()
        await currentAdapter?.teardown()
        activeService = nil
        snapshot = .idle
    }

    // MARK: Transitions

    private enum Direction { case forward, backward }

    private var currentAdapter: PlaybackAdapter? {
        activeService.flatMap { adapters[$0] }
    }

    private func advance(_ direction: Direction) async {
        let step = direction == .forward ? 1 : -1
        await activate(index + step, direction: direction)
    }

    /// Core handoff logic. Finds the next *playable* track from `target` in the
    /// given direction, performs a cross-service adapter swap if needed, starts
    /// playback, and pre-warms the following track.
    private func activate(_ target: Int, direction: Direction) async {
        let step = direction == .forward ? 1 : -1
        var i = target
        var skip: SkipNotice?

        // Walk past unplayable tracks (e.g. a Spotify track when the user is on Free).
        while queue.indices.contains(i) {
            let ref = queue[i]
            guard let adapter = adapters[ref.service] else {
                skip = SkipNotice(ref: ref, reason: .notAuthorized); i += step; continue
            }
            if let block = await adapter.playabilityBlock(for: ref) {
                skip = SkipNotice(ref: ref, reason: block); i += step; continue
            }

            // Playable. Swap adapters if we're crossing a service boundary.
            if ref.service != activeService {
                eventTask?.cancel()
                await currentAdapter?.teardown()   // <-- the cross-service handoff gap
                activeService = ref.service
            }
            do {
                try await adapter.authorize()
                try await adapter.load(ref)
                try await adapter.play()
            } catch {
                skip = SkipNotice(ref: ref, reason: .notAuthorized); i += step; continue
            }

            index = i
            consumeEvents(from: adapter)
            publish(isPlaying: true, skip: skip)
            await prewarmNeighbor()
            return
        }

        // Nothing playable in that direction — stop, but keep the skip reason so the
        // UI can explain (e.g. "Nothing here is playable on your current plans").
        await stop()
        if let skip { snapshot.lastSkip = skip }
    }

    /// Pre-warm the *next* track's adapter (when it differs) so the handoff is faster.
    private func prewarmNeighbor() async {
        let n = index + 1
        guard queue.indices.contains(n) else { return }
        let ref = queue[n]
        guard ref.service != activeService, let adapter = adapters[ref.service] else { return }
        try? await adapter.load(ref)
    }

    private func consumeEvents(from adapter: PlaybackAdapter) {
        eventTask?.cancel()
        eventTask = Task { [weak self] in
            for await event in adapter.events {
                guard let self else { return }
                switch event {
                case .progress(let ms):
                    await MainActor.run { self.snapshot.positionMillis = ms }
                case .ended:
                    await self.advance(.forward)
                    return
                case .stalled:
                    await MainActor.run { self.snapshot.isPlaying = false }
                case .failed:
                    await self.advance(.forward)
                    return
                }
            }
        }
    }

    private func publish(isPlaying: Bool, skip: SkipNotice?) {
        let now = queue.indices.contains(index) ? queue[index] : nil
        let nextIndex = index + 1
        let up = queue.indices.contains(nextIndex) ? queue[nextIndex] : nil
        snapshot = PlaybackSnapshot(
            nowPlaying: now,
            upNext: up,
            isPlaying: isPlaying,
            positionMillis: 0,
            handoffPending: (up?.service != nil) && (up?.service != now?.service),
            lastSkip: skip
        )
    }
}
