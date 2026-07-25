import Foundation
import SwiftUI
import CrossfadeKit

/// The app's single source of truth. Wraps the `CrossfadeKit` core (coordinator,
/// connections, library) and exposes it to SwiftUI. By default it wires **mock**
/// adapters so the app runs in the simulator without MusicKit entitlements; flip
/// `useRealAppleMusic` once the MusicKit capability and server token are in place.
@MainActor
final class AppModel: ObservableObject {
    @Published var connections: [ServiceConnection]
    @Published var playlists: [Playlist]
    @Published var snapshot: PlaybackSnapshot = .idle

    let coordinator = PlaybackCoordinator()
    private let useRealAppleMusic: Bool

    init(useRealAppleMusic: Bool = false) {
        self.useRealAppleMusic = useRealAppleMusic
        self.connections = MockData.connections
        self.playlists = MockData.playlists
        registerAdapters()
        coordinator.onSnapshotChange = { [weak self] snap in
            Task { @MainActor in self?.snapshot = snap }
        }
    }

    private func registerAdapters() {
        // Apple Music: real MusicKit adapter when enabled, else a mock.
        if useRealAppleMusic {
            #if canImport(MusicKit)
            if #available(iOS 15.0, *) { coordinator.register(AppleMusicAdapter()) }
            #endif
        } else {
            coordinator.register(MockPlaybackAdapter(service: .appleMusic, entitled: true))
        }
        // Spotify present but on Free in the mock → play-blocked (R1).
        coordinator.register(MockPlaybackAdapter(service: .spotify, entitled: false))
    }

    // MARK: Derived state

    func connection(_ service: ServiceID) -> ServiceConnection? {
        connections.first { $0.service == service }
    }

    var linkedServices: [ServiceConnection] { connections.filter { $0.isLinked } }

    // MARK: Intents

    func play(playlist: Playlist) async {
        let refs = MockData.queue(for: playlist, connections: connections)
        await coordinator.setQueue(refs)
    }

    func playSingle(_ ref: TrackRef) async {
        await coordinator.setQueue([ref])
    }

    func togglePlayPause() async { await coordinator.togglePlayPause() }
    func next() async { await coordinator.next() }
    func previous() async { await coordinator.previous() }

    /// Simulate connecting a service (the real flow runs the provider OAuth / MusicKit
    /// authorization and then `client.refreshConnection()`).
    func connect(_ service: ServiceID, entitled: Bool) {
        if let i = connections.firstIndex(where: { $0.service == service }) {
            connections[i].isLinked = true
            connections[i].entitlement = entitled ? .active : .insufficientPlan
        } else {
            connections.append(ServiceConnection(service: service, isLinked: true,
                entitlement: entitled ? .active : .insufficientPlan))
        }
    }
}
