import Foundation

/// A service's standing in Crossfade, for the R5 "supported services" browser.
public struct ServiceDescriptor: Identifiable, Sendable {
    public var id: ServiceID { service }
    public let service: ServiceID
    public let playbackMode: PlaybackMode
    public let status: SupportStatus
    /// The provider requirement to play (R1), e.g. "Apple Music subscription".
    public let requirement: String
    /// One-line rationale tied to the in-app-first policy.
    public let note: String
}

/// The top-5 US streaming services and where each stands. Single source of truth
/// for R5; adopting a new service is a data change here plus an adapter/client.
///
/// Support is governed by the in-app-first policy (ARCHITECTURE.md §2.1): only
/// Mode A/B services are adopted; Mode C is flagged, not shipped.
public enum SupportedServices {
    public static let all: [ServiceDescriptor] = [
        ServiceDescriptor(
            service: .spotify, playbackMode: .backgroundBroker, status: .comingNext,
            requirement: "Spotify Premium",
            note: "In-app: Crossfade owns the UI; the Spotify app brokers audio in the background."),
        ServiceDescriptor(
            service: .appleMusic, playbackMode: .inApp, status: .live,
            requirement: "Apple Music subscription",
            note: "Plays fully inside Crossfade via MusicKit. First supported service."),
        ServiceDescriptor(
            service: .amazonMusic, playbackMode: .backgroundBroker, status: .investigating,
            requirement: "Amazon Music Unlimited",
            note: "Confirming an in-app playback path that keeps the user in Crossfade."),
        ServiceDescriptor(
            service: .youTubeMusic, playbackMode: .deepLinkHandoff, status: .notSupported,
            requirement: "YouTube Music Premium",
            note: "No compliant in-app playback — would push the user out to the YouTube Music app."),
        ServiceDescriptor(
            service: .pandora, playbackMode: .deepLinkHandoff, status: .notSupported,
            requirement: "Pandora Premium",
            note: "No third-party playback available to keep listening inside Crossfade.")
    ]

    public static func descriptor(for service: ServiceID) -> ServiceDescriptor? {
        all.first { $0.service == service }
    }

    /// Services Crossfade will integrate (Mode A/B) — i.e. not deep-link-only.
    public static var adoptable: [ServiceDescriptor] {
        all.filter { $0.playbackMode.keepsUserInApp }
    }
}
