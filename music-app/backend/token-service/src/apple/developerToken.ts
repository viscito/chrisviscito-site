import { SignJWT, importPKCS8, type KeyLike } from "jose";
import type { VendedToken } from "../broker/types.js";

const SIX_MONTHS_SECONDS = 15_777_000; // Apple's maximum developer-token lifetime.

/**
 * Signs Apple Music developer tokens (ES256) — TOKEN_SERVICE.md §4.
 *
 * Vended (app-facing) tokens use a short TTL; the backend's own brokered calls use
 * a longer-lived internal token, cached and refreshed before expiry.
 */
export class DeveloperTokenMinter {
  private keyPromise: Promise<KeyLike>;
  private internal?: { token: string; expiresAtEpoch: number };

  constructor(
    private readonly teamId: string,
    private readonly keyId: string,
    pkcs8Pem: string,
  ) {
    this.keyPromise = importPKCS8(pkcs8Pem, "ES256");
  }

  /** Mint a fresh developer token with the given TTL (clamped to Apple's 6-month cap). */
  async mint(ttlSeconds: number): Promise<VendedToken> {
    const ttl = Math.min(Math.max(ttlSeconds, 60), SIX_MONTHS_SECONDS);
    const key = await this.keyPromise;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttl;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.keyId })
      .setIssuer(this.teamId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key);
    return { token, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /** A long-lived token for the backend's own Apple Music API calls, cached and
   * proactively refreshed when within a day of expiry. */
  async internalToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.internal && this.internal.expiresAtEpoch - now > 86_400) {
      return this.internal.token;
    }
    const minted = await this.mint(SIX_MONTHS_SECONDS);
    this.internal = {
      token: minted.token,
      expiresAtEpoch: Math.floor(new Date(minted.expiresAt).getTime() / 1000),
    };
    return this.internal.token;
  }
}
