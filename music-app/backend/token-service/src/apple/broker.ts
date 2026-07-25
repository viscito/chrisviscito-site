import type {
  Connection,
  ConnectPayload,
  ServiceCredentialBroker,
  VendedToken,
} from "../broker/types.js";
import type { AppleMusicApi, ProviderPlaylist, ProviderTrack } from "./appleMusicApi.js";
import type { DeveloperTokenMinter } from "./developerToken.js";
import type { CredentialStore } from "../store/credentialStore.js";
import type { Kms } from "../crypto/envelope.js";
import { decryptSecret, encryptSecret } from "../crypto/envelope.js";
import { Errors } from "../errors.js";

export interface AppleMusicBrokerDeps {
  minter: DeveloperTokenMinter;
  api: AppleMusicApi;
  store: CredentialStore;
  kms: Kms;
  vendedTokenTtlSeconds: number;
}

/**
 * Apple Music implementation of the credential broker (TOKEN_SERVICE.md §5).
 * Vends short-lived developer tokens for MusicKit and brokers catalog/library
 * reads server-side with the backend's own token + the stored user token.
 */
export class AppleMusicBroker implements ServiceCredentialBroker {
  readonly service = "appleMusic" as const;
  constructor(private readonly deps: AppleMusicBrokerDeps) {}

  async vendClientToken(_userId: string): Promise<VendedToken> {
    return this.deps.minter.mint(this.deps.vendedTokenTtlSeconds);
  }

  async connect(userId: string, payload: ConnectPayload): Promise<Connection> {
    if (!payload.userToken) throw Errors.badRequest("userToken is required");
    const developerToken = await this.deps.minter.internalToken();
    // Validate the Music User Token against Apple; also learns the storefront.
    const { storefront } = await this.deps.api.validateUserToken(developerToken, payload.userToken);
    const finalStorefront = payload.storefront ?? storefront;

    // R1: entitlement comes from the device's subscription capability.
    const entitlement = payload.canPlayCatalogContent ? "active" : "insufficientPlan";

    const encryptedUserToken = await encryptSecret(this.deps.kms, payload.userToken);
    const now = new Date().toISOString();
    await this.deps.store.upsert({
      userId,
      service: this.service,
      encryptedUserToken,
      entitlement,
      storefront: finalStorefront,
      updatedAt: now,
    });
    return { service: this.service, entitlement, storefront: finalStorefront, connectedAt: now };
  }

  async refresh(userId: string): Promise<Connection> {
    const record = await this.deps.store.get(userId, this.service);
    if (!record) throw Errors.notConnected();
    const developerToken = await this.deps.minter.internalToken();
    const userToken = await decryptSecret(this.deps.kms, record.encryptedUserToken);
    // Re-validate liveness (throws invalid_user_token if Apple rejects it).
    const { storefront } = await this.deps.api.validateUserToken(developerToken, userToken);
    const updated = { ...record, storefront: record.storefront ?? storefront, updatedAt: new Date().toISOString() };
    await this.deps.store.upsert(updated);
    return {
      service: this.service,
      entitlement: updated.entitlement,
      storefront: updated.storefront,
      connectedAt: updated.updatedAt,
    };
  }

  async disconnect(userId: string): Promise<void> {
    // Real revoke: delete the stored (encrypted) token and its cached library.
    await this.deps.store.delete(userId, this.service);
  }

  // --- Brokered reads (beyond the generic interface) ---

  async search(userId: string, query: string): Promise<ProviderTrack[]> {
    const record = await this.deps.store.get(userId, this.service);
    const developerToken = await this.deps.minter.internalToken();
    return this.deps.api.search(developerToken, record?.storefront ?? "us", query);
  }

  async libraryPlaylists(userId: string): Promise<ProviderPlaylist[]> {
    const { developerToken, userToken } = await this.credentials(userId);
    return this.deps.api.libraryPlaylists(developerToken, userToken);
  }

  async playlistTracks(userId: string, playlistId: string): Promise<ProviderTrack[]> {
    const { developerToken, userToken } = await this.credentials(userId);
    return this.deps.api.playlistTracks(developerToken, userToken, playlistId);
  }

  private async credentials(userId: string): Promise<{ developerToken: string; userToken: string }> {
    const record = await this.deps.store.get(userId, this.service);
    if (!record) throw Errors.notConnected();
    const developerToken = await this.deps.minter.internalToken();
    const userToken = await decryptSecret(this.deps.kms, record.encryptedUserToken);
    return { developerToken, userToken };
  }
}
