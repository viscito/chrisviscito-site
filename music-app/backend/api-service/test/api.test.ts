import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import { Hs256SessionVerifier, mintDevSession } from "../src/auth/session.js";
import { buildSeededDeps, DEMO_USER } from "../src/seed.js";
import type { Playlist } from "../src/domain.js";

const SECRET = "test-secret";

function build() {
  const deps = buildSeededDeps();
  return { app: createApp({ verifier: new Hs256SessionVerifier(SECRET), ...deps }), deps };
}
async function auth(userId = DEMO_USER) {
  return { Authorization: `Bearer ${await mintDevSession(SECRET, userId)}` };
}
async function playlistNamed(deps: ReturnType<typeof build>["deps"], title: string): Promise<Playlist> {
  const all = await deps.playlists.listForUser(DEMO_USER);
  return all.find((p) => p.title === title)!;
}

describe("api-service", () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => { ctx = build(); });

  it("health is open; /v1 needs auth", async () => {
    expect((await ctx.app.request("/health")).status).toBe(200);
    expect((await ctx.app.request("/v1/services")).status).toBe(401);
  });

  it("lists services with R5 status and R1 connection state", async () => {
    const res = await ctx.app.request("/v1/services", { headers: await auth() });
    const { services } = (await res.json()) as any;
    expect(services).toHaveLength(5);
    const apple = services.find((s: any) => s.service === "appleMusic");
    const spotify = services.find((s: any) => s.service === "spotify");
    const yt = services.find((s: any) => s.service === "youTubeMusic");
    expect(apple.canPlay).toBe(true);
    expect(spotify.canPlay).toBe(false); // linked on Free → play-blocked
    expect(yt.status).toBe("notSupported");
  });

  it("lists and creates playlists", async () => {
    const list = await (await ctx.app.request("/v1/playlists", { headers: await auth() })).json() as any;
    expect(list.data.length).toBe(2);

    const created = await ctx.app.request("/v1/playlists", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Roadtrip" }),
    });
    expect(created.status).toBe(201);
    expect((await created.json() as any).title).toBe("Roadtrip");
  });

  it("adds and removes playlist items (R4)", async () => {
    const focus = await playlistNamed(ctx.deps, "Focus Flow");
    const trackId = ctx.deps.catalog.all()[0]!.id;
    const added = await ctx.app.request(`/v1/playlists/${focus.id}/items`, {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ unifiedTrackIds: [trackId] }),
    });
    const detail = await added.json() as any;
    expect(detail.items.length).toBe(2);
    const newItem = detail.items.find((i: any) => i.origin === "local" && i.track.id === trackId);
    expect(newItem).toBeTruthy();

    const del = await ctx.app.request(`/v1/playlists/${focus.id}/items/${newItem.id}`, { method: "DELETE", headers: await auth() });
    expect(del.status).toBe(204);
  });

  it("resolves a per-listener queue with R1 playability", async () => {
    const drive = await playlistNamed(ctx.deps, "Late Night Drive");
    const res = await ctx.app.request(`/v1/playlists/${drive.id}/queue`, { headers: await auth() });
    const { tracks } = await res.json() as any;
    expect(tracks).toHaveLength(3);

    // Midnight Signal / Neon Tide exist on Apple (playable) via shared ISRC.
    const midnight = tracks.find((t: any) => t.title === "Midnight Signal");
    expect(midnight.service).toBe("appleMusic");
    expect(midnight.playable).toBe(true);

    // Coast Road is Spotify-only; user is on Spotify Free → blocked (R1).
    const coast = tracks.find((t: any) => t.title === "Coast Road");
    expect(coast.playable).toBe(false);
    expect(coast.blockedReason).toBe("notSubscribed");
  });

  it("searches across linked services, deduped, with playability (R3/R1)", async () => {
    const res = await ctx.app.request("/v1/search?q=midnight", { headers: await auth() });
    const { results } = await res.json() as any;
    const midnight = results.find((r: any) => r.track.title === "Midnight Signal");
    expect(midnight).toBeTruthy();
    expect(midnight.availableOn.sort()).toEqual(["appleMusic", "spotify"]);
    expect(midnight.playableOn).toEqual(["appleMusic"]);
  });

  it("imports a playlist kept in sync (R2)", async () => {
    const candidates = await (await ctx.app.request("/v1/import/spotify/playlists", { headers: await auth() })).json() as any;
    expect(candidates.playlists.map((p: any) => p.id)).toContain("sp-pl-1");

    const res = await ctx.app.request("/v1/import/spotify/playlists", {
      method: "POST", headers: { ...(await auth()), "Content-Type": "application/json" },
      body: JSON.stringify({ providerPlaylistIds: ["sp-pl-1"] }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json() as any).playlists[0];
    expect(created.trackCount).toBe(3);
    expect(created.importedFrom.service).toBe("spotify");
  });

  it("triggers sync on an imported playlist; rejects on a non-synced one", async () => {
    const drive = await playlistNamed(ctx.deps, "Late Night Drive");
    const ok = await ctx.app.request(`/v1/playlists/${drive.id}/sync`, { method: "POST", headers: await auth() });
    expect(ok.status).toBe(200);
    const status = await ok.json() as any;
    expect(status.lastDiff).toEqual({ addedTrackIds: [], removedItemIds: [], reordered: false });

    const focus = await playlistNamed(ctx.deps, "Focus Flow");
    const bad = await ctx.app.request(`/v1/playlists/${focus.id}/sync`, { method: "POST", headers: await auth() });
    expect(bad.status).toBe(409);
  });

  it("404s another user's playlist", async () => {
    const drive = await playlistNamed(ctx.deps, "Late Night Drive");
    const res = await ctx.app.request(`/v1/playlists/${drive.id}`, { headers: await auth("someone-else") });
    expect(res.status).toBe(404);
  });
});
