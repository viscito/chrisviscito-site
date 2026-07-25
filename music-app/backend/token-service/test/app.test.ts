import { describe, it, expect, beforeEach } from "vitest";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { createApp, type AppDeps } from "../src/app.js";
import { AppleMusicBroker } from "../src/apple/broker.js";
import { DeveloperTokenMinter } from "../src/apple/developerToken.js";
import type { AppleMusicApi, ProviderPlaylist, ProviderTrack } from "../src/apple/appleMusicApi.js";
import { InMemoryCredentialStore } from "../src/store/credentialStore.js";
import { LocalKms } from "../src/crypto/envelope.js";
import { Hs256SessionVerifier, mintDevSession } from "../src/auth/session.js";
import { FixedWindowRateLimiter, noopRateLimiter, type RateLimiter } from "../src/rateLimit.js";
import { Errors } from "../src/errors.js";

const SECRET = "test-session-secret";

// A fake Apple Music API so tests never hit the network.
class FakeAppleMusicApi implements AppleMusicApi {
  async validateUserToken(_dev: string, userToken: string) {
    if (userToken === "bad") throw Errors.invalidUserToken();
    return { storefront: "us" };
  }
  async search(): Promise<ProviderTrack[]> {
    return [{ service: "appleMusic", providerTrackId: "am-1", isrc: "USX000001", title: "Midnight Signal",
      artists: ["Sable Court"], album: "Static Bloom", durationMillis: 222000, artworkUrl: null }];
  }
  async libraryPlaylists(): Promise<ProviderPlaylist[]> {
    return [{ id: "pl-1", service: "appleMusic", title: "Late Night Drive", trackCount: 18 }];
  }
  async playlistTracks(): Promise<ProviderTrack[]> {
    return this.search();
  }
}

function build(limiter: RateLimiter = noopRateLimiter) {
  const store = new InMemoryCredentialStore();
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const minter = new DeveloperTokenMinter("TEAM", "KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  const broker = new AppleMusicBroker({
    minter, api: new FakeAppleMusicApi(), store, kms: new LocalKms(randomBytes(32)),
    vendedTokenTtlSeconds: 43200,
  });
  const deps: AppDeps = {
    appleBroker: broker,
    verifier: new Hs256SessionVerifier(SECRET),
    developerTokenLimiter: limiter,
  };
  return { app: createApp(deps), store, broker };
}

async function auth(userId = "u1") {
  return { Authorization: `Bearer ${await mintDevSession(SECRET, userId)}` };
}

describe("token-service HTTP API", () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => { ctx = build(); });

  it("health needs no auth", async () => {
    const res = await ctx.app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("rejects unauthenticated /v1 requests", async () => {
    const res = await ctx.app.request("/v1/apple-music/developer-token");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthenticated" });
  });

  it("vends a developer token to an authenticated user", async () => {
    const res = await ctx.app.request("/v1/apple-music/developer-token", { headers: await auth() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresAt: string };
    expect(body.token.split(".")).toHaveLength(3); // JWT
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("connects with an active subscription (R1: entitlement active) and encrypts the token", async () => {
    const res = await ctx.app.request("/v1/apple-music/connections", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ musicUserToken: "mut-123", canPlayCatalogContent: true }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ service: "appleMusic", entitlement: "active", storefront: "us" });

    const record = await ctx.store.get("u1", "appleMusic");
    expect(record?.encryptedUserToken.ciphertext).toBeTruthy();
    expect(JSON.stringify(record?.encryptedUserToken)).not.toContain("mut-123"); // stored encrypted
  });

  it("connects a free-tier user as play-blocked (R1: insufficientPlan)", async () => {
    const res = await ctx.app.request("/v1/apple-music/connections", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ musicUserToken: "mut-123", canPlayCatalogContent: false }),
    });
    expect(await res.json()).toMatchObject({ entitlement: "insufficientPlan" });
  });

  it("rejects an invalid Music User Token", async () => {
    const res = await ctx.app.request("/v1/apple-music/connections", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ musicUserToken: "bad", canPlayCatalogContent: true }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_user_token" });
  });

  it("refresh returns 404 when not connected, 200 after connect", async () => {
    const notConnected = await ctx.app.request("/v1/apple-music/connections/refresh",
      { method: "POST", headers: await auth("nobody") });
    expect(notConnected.status).toBe(404);

    await ctx.app.request("/v1/apple-music/connections", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ musicUserToken: "mut-123", canPlayCatalogContent: true }),
    });
    const ok = await ctx.app.request("/v1/apple-music/connections/refresh", { method: "POST", headers: await auth() });
    expect(ok.status).toBe(200);
  });

  it("disconnect deletes the stored credential", async () => {
    await ctx.app.request("/v1/apple-music/connections", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ musicUserToken: "mut-123", canPlayCatalogContent: true }),
    });
    const del = await ctx.app.request("/v1/apple-music/connections", { method: "DELETE", headers: await auth() });
    expect(del.status).toBe(204);
    expect(await ctx.store.get("u1", "appleMusic")).toBeUndefined();
  });

  it("brokers a catalog search", async () => {
    const res = await ctx.app.request("/v1/apple-music/search?q=midnight", { headers: await auth() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracks: ProviderTrack[] };
    expect(body.tracks[0]?.isrc).toBe("USX000001");
  });

  it("rate-limits the developer-token endpoint", async () => {
    const limited = build(new FixedWindowRateLimiter(1, 3600));
    const first = await limited.app.request("/v1/apple-music/developer-token", { headers: await auth() });
    expect(first.status).toBe(200);
    const second = await limited.app.request("/v1/apple-music/developer-token", { headers: await auth() });
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });
});
