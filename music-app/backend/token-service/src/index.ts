import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { AppleMusicBroker } from "./apple/broker.js";
import { DeveloperTokenMinter } from "./apple/developerToken.js";
import { HttpAppleMusicApi } from "./apple/appleMusicApi.js";
import { InMemoryCredentialStore } from "./store/credentialStore.js";
import { LocalKms } from "./crypto/envelope.js";
import { Hs256SessionVerifier, mintDevSession } from "./auth/session.js";
import { FixedWindowRateLimiter } from "./rateLimit.js";

const config = loadConfig();
for (const w of config.warnings) console.warn(`[config] ${w}`);

const minter = new DeveloperTokenMinter(config.apple.teamId, config.apple.keyId, config.apple.privateKeyPem);
const kms = new LocalKms(config.kmsMasterKey);

const appleBroker = new AppleMusicBroker({
  minter,
  api: new HttpAppleMusicApi(),
  store: new InMemoryCredentialStore(),
  kms,
  vendedTokenTtlSeconds: config.vendedTokenTtlSeconds,
});

const app = createApp({
  appleBroker,
  verifier: new Hs256SessionVerifier(config.sessionSecret),
  developerTokenLimiter: new FixedWindowRateLimiter(30, 3600), // 30/hour/user
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`token-service listening on http://localhost:${info.port}`);
  if (config.nodeEnv !== "production") {
    // Convenience: print a dev session token so you can curl the API immediately.
    void mintDevSession(config.sessionSecret, "dev-user-1").then((t) =>
      console.log(`\n[dev] sample session for user "dev-user-1":\n  Authorization: Bearer ${t}\n`),
    );
  }
});
