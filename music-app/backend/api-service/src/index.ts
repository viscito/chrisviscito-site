import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { Hs256SessionVerifier, mintDevSession } from "./auth/session.js";
import { buildSeededDeps, DEMO_USER } from "./seed.js";

const port = Number(process.env.PORT ?? 8788);
const sessionSecret = process.env.CROSSFADE_SESSION_SECRET ?? "dev-session-secret-change-me";
if (!process.env.CROSSFADE_SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("CROSSFADE_SESSION_SECRET is required in production");
}

const seeded = buildSeededDeps();
const app = createApp({ verifier: new Hs256SessionVerifier(sessionSecret), ...seeded });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api-service listening on http://localhost:${info.port}`);
  if (process.env.NODE_ENV !== "production") {
    void mintDevSession(sessionSecret, DEMO_USER).then((tok) =>
      console.log(`\n[dev] session for "${DEMO_USER}":\n  Authorization: Bearer ${tok}\n`),
    );
  }
});
