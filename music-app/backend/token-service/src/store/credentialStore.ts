import type { EncryptedBlob } from "../crypto/envelope.js";
import type { EntitlementState, ServiceID } from "../broker/types.js";

/** A stored service credential. The user token is always encrypted at rest. */
export interface CredentialRecord {
  userId: string;
  service: ServiceID;
  encryptedUserToken: EncryptedBlob;
  entitlement: EntitlementState;
  storefront?: string;
  updatedAt: string;
}

export interface CredentialStore {
  get(userId: string, service: ServiceID): Promise<CredentialRecord | undefined>;
  upsert(record: CredentialRecord): Promise<void>;
  delete(userId: string, service: ServiceID): Promise<void>;
}

/**
 * In-memory store for dev/tests. Production replaces this with Postgres (see the
 * `service_credential` table in TOKEN_SERVICE.md §6) behind the same interface.
 */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly map = new Map<string, CredentialRecord>();
  private key(userId: string, service: ServiceID) {
    return `${userId}:${service}`;
  }
  async get(userId: string, service: ServiceID): Promise<CredentialRecord | undefined> {
    return this.map.get(this.key(userId, service));
  }
  async upsert(record: CredentialRecord): Promise<void> {
    this.map.set(this.key(record.userId, record.service), record);
  }
  async delete(userId: string, service: ServiceID): Promise<void> {
    this.map.delete(this.key(userId, service));
  }
}
