/** Services Crossfade can broker credentials for. Mirrors CrossfadeKit's ServiceID. */
export type ServiceID = "appleMusic" | "spotify" | "amazonMusic" | "youTubeMusic" | "pandora";

export type EntitlementState = "active" | "insufficientPlan" | "unknown";

/** A short-lived token vended to the app (e.g. an Apple Music developer token). */
export interface VendedToken {
  token: string;
  expiresAt: string; // ISO 8601
}

/** The connection state returned to the client (never contains a raw token). */
export interface Connection {
  service: ServiceID;
  entitlement: EntitlementState;
  storefront?: string;
  connectedAt: string;
}

/** Payload the device sends when connecting a service. */
export interface ConnectPayload {
  /** Apple: the Music User Token. OAuth services: the authorization code / tokens. */
  userToken: string;
  /** Apple: whether the device reports an active catalog subscription (R1). */
  canPlayCatalogContent?: boolean;
  storefront?: string;
}

/**
 * The per-service credential broker. Apple Music implements this with JWT signing;
 * OAuth services (Spotify next) implement it with token exchange/refresh — the API
 * surface and the client never learn the difference. See TOKEN_SERVICE.md §9.
 */
export interface ServiceCredentialBroker {
  readonly service: ServiceID;
  vendClientToken(userId: string): Promise<VendedToken>;
  connect(userId: string, payload: ConnectPayload): Promise<Connection>;
  refresh(userId: string): Promise<Connection>;
  disconnect(userId: string): Promise<void>;
}
