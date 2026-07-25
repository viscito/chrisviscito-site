import Foundation

/// A streaming service Crossfade can integrate with.
public enum ServiceID: String, Codable, CaseIterable, Sendable, Hashable {
    case appleMusic
    case spotify
    case amazonMusic
    case youTubeMusic
    case pandora

    public var displayName: String {
        switch self {
        case .appleMusic:   return "Apple Music"
        case .spotify:      return "Spotify"
        case .amazonMusic:  return "Amazon Music"
        case .youTubeMusic: return "YouTube Music"
        case .pandora:      return "Pandora"
        }
    }
}

/// How an adapter delivers playback — the distinction that decides whether the
/// user ever visually leaves Crossfade. See ARCHITECTURE.md §2.1.
public enum PlaybackMode: String, Codable, Sendable {
    /// Mode A — audio plays inside Crossfade via the service's SDK. (Apple Music)
    case inApp
    /// Mode B — Crossfade owns the UI; the service's app decodes in the
    /// background, driven by our controls. (Spotify on iOS)
    case backgroundBroker
    /// Mode C — playback can only happen by opening the service's own app.
    /// Violates the in-app-first policy; not adopted by default. (YouTube Music)
    case deepLinkHandoff

    /// True when playback keeps the user visually inside Crossfade (A or B).
    public var keepsUserInApp: Bool { self != .deepLinkHandoff }
}

/// Where a service stands in Crossfade today. Powers the R5 services browser.
public enum SupportStatus: String, Codable, Sendable {
    case live            // shipped
    case comingNext      // designed, next to build
    case investigating   // feasibility of an in-app path unconfirmed
    case notSupported    // no compliant in-app playback path

    public var label: String {
        switch self {
        case .live:          return "Live"
        case .comingNext:    return "Coming next"
        case .investigating: return "Investigating"
        case .notSupported:  return "Not supported"
        }
    }
}
