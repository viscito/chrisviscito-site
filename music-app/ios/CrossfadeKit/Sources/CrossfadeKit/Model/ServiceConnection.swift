import Foundation

/// Whether the user meets a service's provider requirement (R1).
public enum EntitlementState: String, Codable, Sendable {
    case active            // paid plan present — playback allowed
    case insufficientPlan  // linked, but on a free/insufficient tier — play-blocked
    case unknown           // not yet checked

    public var canPlay: Bool { self == .active }
}

/// A user's link to one service. Tokens are referenced here but stored securely
/// out of band (Keychain / encrypted at rest) — never in this struct. See
/// ARCHITECTURE.md §7.
public struct ServiceConnection: Identifiable, Codable, Hashable, Sendable {
    public var id: ServiceID { service }
    public let service: ServiceID
    public var isLinked: Bool
    public var entitlement: EntitlementState
    /// e.g. Apple Music storefront ("us"), used to scope catalog requests.
    public var storefront: String?
    public var planName: String?

    public init(
        service: ServiceID,
        isLinked: Bool = false,
        entitlement: EntitlementState = .unknown,
        storefront: String? = nil,
        planName: String? = nil
    ) {
        self.service = service
        self.isLinked = isLinked
        self.entitlement = entitlement
        self.storefront = storefront
        self.planName = planName
    }

    /// R1 gate: a linked service is only playable when its plan requirement is met.
    public var canPlay: Bool { isLinked && entitlement.canPlay }
}
