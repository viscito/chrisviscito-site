import { Hono } from "hono";
import { z } from "zod";
import type { AppleMusicBroker } from "./apple/broker.js";
import type { SessionVerifier } from "./auth/session.js";
import { extractBearer } from "./auth/session.js";
import type { RateLimiter } from "./rateLimit.js";
import { ApiError, Errors } from "./errors.js";

export interface AppDeps {
  appleBroker: AppleMusicBroker;
  verifier: SessionVerifier;
  /** Guards the developer-token endpoint (per user). */
  developerTokenLimiter: RateLimiter;
}

type Vars = { Variables: { userId: string } };

const connectSchema = z.object({
  musicUserToken: z.string().min(1),
  canPlayCatalogContent: z.boolean().optional(),
  storefront: z.string().optional(),
});

/** Build the Hono app. Pure factory over its dependencies so it is fully testable
 * via `app.request(...)` with fakes — no live server or Apple calls needed. */
export function createApp(deps: AppDeps): Hono<Vars> {
  const app = new Hono<Vars>();

  app.get("/health", (c) => c.json({ ok: true, service: "token-service" }));

  // --- Auth: every /v1 route requires a valid Crossfade session ---
  app.use("/v1/*", async (c, next) => {
    const session = await deps.verifier.verify(c.req.header("Authorization"));
    c.set("userId", session.userId);
    await next();
  });

  // --- Vend a developer token for MusicKit (§5.1) ---
  app.get("/v1/apple-music/developer-token", async (c) => {
    const userId = c.get("userId");
    const retryAfter = deps.developerTokenLimiter.check(userId);
    if (retryAfter !== null) throw Errors.rateLimited(retryAfter);
    const vended = await deps.appleBroker.vendClientToken(userId);
    return c.json(vended);
  });

  // --- Connect Apple Music (§5.2) ---
  app.post("/v1/apple-music/connections", async (c) => {
    const body = connectSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw Errors.badRequest("musicUserToken is required");
    const connection = await deps.appleBroker.connect(c.get("userId"), {
      userToken: body.data.musicUserToken,
      canPlayCatalogContent: body.data.canPlayCatalogContent,
      storefront: body.data.storefront,
    });
    return c.json(connection, 201);
  });

  // --- Refresh entitlement / re-validate (§5.3) ---
  app.post("/v1/apple-music/connections/refresh", async (c) => {
    return c.json(await deps.appleBroker.refresh(c.get("userId")));
  });

  // --- Disconnect (§5.4) ---
  app.delete("/v1/apple-music/connections", async (c) => {
    await deps.appleBroker.disconnect(c.get("userId"));
    return c.body(null, 204);
  });

  // --- Brokered reads (§5.5) ---
  app.get("/v1/apple-music/search", async (c) => {
    const q = c.req.query("q");
    if (!q) throw Errors.badRequest("query parameter 'q' is required");
    return c.json({ tracks: await deps.appleBroker.search(c.get("userId"), q) });
  });

  app.get("/v1/apple-music/library/playlists", async (c) => {
    return c.json({ playlists: await deps.appleBroker.libraryPlaylists(c.get("userId")) });
  });

  app.get("/v1/apple-music/library/playlists/:id/tracks", async (c) => {
    const tracks = await deps.appleBroker.playlistTracks(c.get("userId"), c.req.param("id"));
    return c.json({ tracks });
  });

  // --- Error model (§5.6) ---
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      if (err.status === 429 && typeof err.extra?.retryAfter === "number") {
        c.header("Retry-After", String(err.extra.retryAfter));
      }
      return c.json({ error: err.code, message: err.message }, err.status as never);
    }
    console.error("unhandled error", err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
