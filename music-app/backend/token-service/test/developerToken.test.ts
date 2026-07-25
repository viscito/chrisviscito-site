import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { importSPKI, jwtVerify, decodeProtectedHeader } from "jose";
import { DeveloperTokenMinter } from "../src/apple/developerToken.js";

function makeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    pkcs8: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    spki: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

describe("DeveloperTokenMinter", () => {
  const { pkcs8, spki } = makeKeyPair();
  const minter = new DeveloperTokenMinter("TEAM123456", "KEYABCDEFG", pkcs8);

  it("mints a verifiable ES256 JWT with the right header and issuer", async () => {
    const { token, expiresAt } = await minter.mint(3600);
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("KEYABCDEFG");

    const pub = await importSPKI(spki, "ES256");
    const { payload } = await jwtVerify(token, pub);
    expect(payload.iss).toBe("TEAM123456");
    expect(typeof payload.exp).toBe("number");
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("clamps TTL to Apple's 6-month maximum", async () => {
    const { token } = await minter.mint(999_999_999);
    const pub = await importSPKI(spki, "ES256");
    const { payload } = await jwtVerify(token, pub);
    const now = Math.floor(Date.now() / 1000);
    expect((payload.exp ?? 0) - now).toBeLessThanOrEqual(15_777_000 + 5);
  });

  it("caches the internal token across calls", async () => {
    const a = await minter.internalToken();
    const b = await minter.internalToken();
    expect(a).toBe(b);
  });
});
