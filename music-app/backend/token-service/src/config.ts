import { generateKeyPairSync, randomBytes } from "node:crypto";

export interface Config {
  nodeEnv: string;
  port: number;
  /** HS256 secret used to verify Crossfade account session JWTs. */
  sessionSecret: string;
  apple: {
    teamId: string;
    keyId: string;
    /** PKCS#8 PEM private key (contents of the .p8). */
    privateKeyPem: string;
  };
  /** 32-byte master key for the local KMS (envelope encryption of user tokens). */
  kmsMasterKey: Buffer;
  /** TTL for developer tokens vended to the app (seconds). */
  vendedTokenTtlSeconds: number;
  warnings: string[];
}

function normalizePem(pem: string): string {
  // Allow single-line env values that use literal "\n".
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

/**
 * Load config from the environment. In development, missing Apple/KMS secrets are
 * replaced with ephemeral ones so the service boots and tests run — with loud
 * warnings. In production, they are required.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";
  const warnings: string[] = [];

  const requireInProd = (name: string): never | undefined => {
    if (isProd) throw new Error(`Missing required env var in production: ${name}`);
    return undefined;
  };

  // --- Apple signing key ---
  let privateKeyPem = env.APPLE_MUSICKIT_P8 ? normalizePem(env.APPLE_MUSICKIT_P8) : undefined;
  let teamId = env.APPLE_TEAM_ID;
  let keyId = env.APPLE_MUSICKIT_KEY_ID;
  if (!privateKeyPem) {
    requireInProd("APPLE_MUSICKIT_P8");
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    teamId ??= "DEVTEAM000";
    keyId ??= "DEVKEY0000";
    warnings.push(
      "APPLE_MUSICKIT_P8 not set — generated an ephemeral P-256 key. Tokens are well-formed but Apple will reject them.",
    );
  }
  if (!teamId) throw new Error("APPLE_TEAM_ID is required");
  if (!keyId) throw new Error("APPLE_MUSICKIT_KEY_ID is required");

  // --- Local KMS master key ---
  let kmsMasterKey: Buffer;
  if (env.LOCAL_KMS_MASTER_KEY) {
    kmsMasterKey = Buffer.from(env.LOCAL_KMS_MASTER_KEY, "base64");
    if (kmsMasterKey.length !== 32) {
      throw new Error("LOCAL_KMS_MASTER_KEY must be 32 bytes, base64-encoded");
    }
  } else {
    requireInProd("LOCAL_KMS_MASTER_KEY");
    kmsMasterKey = randomBytes(32);
    warnings.push(
      "LOCAL_KMS_MASTER_KEY not set — generated an ephemeral key. Encrypted data will not survive a restart.",
    );
  }

  // --- Crossfade session secret ---
  let sessionSecret = env.CROSSFADE_SESSION_SECRET;
  if (!sessionSecret) {
    requireInProd("CROSSFADE_SESSION_SECRET");
    sessionSecret = "dev-session-secret-change-me";
    warnings.push("CROSSFADE_SESSION_SECRET not set — using an insecure dev default.");
  }

  return {
    nodeEnv,
    port: Number(env.PORT ?? 8787),
    sessionSecret,
    apple: { teamId, keyId, privateKeyPem },
    kmsMasterKey,
    vendedTokenTtlSeconds: Number(env.DEV_TOKEN_TTL_SECONDS ?? 43_200), // 12h
    warnings,
  };
}
