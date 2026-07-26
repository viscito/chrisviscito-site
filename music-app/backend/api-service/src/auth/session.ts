import { SignJWT, jwtVerify } from "jose";
import { Errors } from "../errors.js";

export interface Session {
  userId: string;
}

export interface SessionVerifier {
  verify(bearer: string | undefined): Promise<Session>;
}

/** Verifies the Crossfade account session JWT (HS256) — the same token the
 * token-service issues/verifies, so both services share one identity. */
export class Hs256SessionVerifier implements SessionVerifier {
  private readonly key: Uint8Array;
  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }
  async verify(bearer: string | undefined): Promise<Session> {
    const token = extractBearer(bearer);
    if (!token) throw Errors.unauthenticated();
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || !payload.sub) throw Errors.unauthenticated();
      return { userId: payload.sub };
    } catch {
      throw Errors.unauthenticated();
    }
  }
}

export function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : undefined;
}

export async function mintDevSession(secret: string, userId: string, ttlSeconds = 3600): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(new TextEncoder().encode(secret));
}
