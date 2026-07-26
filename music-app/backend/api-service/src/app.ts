import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, Errors } from "./errors.js";
import type { SessionVerifier } from "./auth/session.js";
import type { PlaylistStore, ConnectionStore } from "./stores/stores.js";
import type { UnifiedTrackCatalog } from "./catalog/unifiedTrackCatalog.js";
import type { ProviderGateway } from "./providers/providerGateway.js";
import { paginate, parseLimit } from "./pagination.js";
import { toPlaylistDetail, toPlaylistSummary, toServicesWithConnections } from "./presenters.js";
import { resolveQueue } from "./services/queueResolver.js";
import { crossServiceSearch } from "./services/searchService.js";
import { importPlaylists } from "./services/importService.js";
import { triggerSync } from "./services/syncService.js";
import type { Playlist, PlaylistItem, ServiceId } from "./domain.js";

export interface AppDeps {
  verifier: SessionVerifier;
  playlists: PlaylistStore;
  connections: ConnectionStore;
  catalog: UnifiedTrackCatalog;
  gateway: ProviderGateway;
}

type Vars = { Variables: { userId: string } };

const SERVICE_IDS = ["appleMusic", "spotify", "amazonMusic", "youTubeMusic", "pandora"] as const;
const serviceParam = z.enum(SERVICE_IDS);

const playlistCreate = z.object({ title: z.string().min(1), detail: z.string().optional() });
const playlistUpdate = z.object({
  title: z.string().min(1).optional(),
  detail: z.string().optional(),
  itemOrder: z.array(z.string()).optional(),
});
const addItems = z.object({ unifiedTrackIds: z.array(z.string()).min(1), position: z.number().int().optional() });
const itemUpdate = z.object({ position: z.number().int().optional(), preferredService: serviceParam.optional() });
const importReq = z.object({ providerPlaylistIds: z.array(z.string()).min(1), keepInSync: z.boolean().default(true) });

export function createApp(deps: AppDeps): Hono<Vars> {
  const app = new Hono<Vars>();

  app.get("/health", (c) => c.json({ ok: true, service: "api-service" }));

  app.use("/v1/*", async (c, next) => {
    const { userId } = await deps.verifier.verify(c.req.header("Authorization"));
    c.set("userId", userId);
    await next();
  });

  const owned = async (id: string, userId: string): Promise<Playlist> => {
    const pl = await deps.playlists.get(id);
    if (!pl || pl.ownerId !== userId) throw Errors.notFound("Playlist");
    return pl;
  };
  const body = async (c: { req: { json: () => Promise<unknown> } }) => c.req.json().catch(() => null);

  // -------------------- Services (R5 + R1) --------------------
  app.get("/v1/services", async (c) => {
    const connections = await deps.connections.listForUser(c.get("userId"));
    return c.json({ services: toServicesWithConnections(connections) });
  });

  // -------------------- Library (R4) --------------------
  app.get("/v1/library/tracks", (c) => {
    const page = paginate(deps.catalog.all(), parseLimit(c.req.query("limit")), c.req.query("cursor"));
    return c.json(page);
  });
  app.get("/v1/tracks/:trackId", (c) => {
    const track = deps.catalog.get(c.req.param("trackId"));
    if (!track) throw Errors.notFound("Track");
    return c.json({ ...track, mappings: deps.catalog.mappingsFor(track.id) });
  });

  // -------------------- Search (R3 / R1) --------------------
  app.get("/v1/search", async (c) => {
    const q = c.req.query("q");
    if (!q) throw Errors.badRequest("query parameter 'q' is required");
    const connections = await deps.connections.listForUser(c.get("userId"));
    const linked = connections.filter((x) => x.isLinked).map((x) => x.service);
    const requested = c.req.queries("services") as ServiceId[] | undefined;
    const services = requested?.length ? requested.filter((s) => linked.includes(s)) : linked;
    const results = await crossServiceSearch(c.get("userId"), q, services, deps.gateway, deps.catalog, connections);
    return c.json({ results });
  });

  // -------------------- Playlists (R4 / R1) --------------------
  app.get("/v1/playlists", async (c) => {
    const all = await deps.playlists.listForUser(c.get("userId"));
    const page = paginate(all, parseLimit(c.req.query("limit")), c.req.query("cursor"));
    return c.json({ data: page.data.map(toPlaylistSummary), nextCursor: page.nextCursor });
  });
  app.post("/v1/playlists", async (c) => {
    const parsed = playlistCreate.safeParse(await body(c));
    if (!parsed.success) throw Errors.badRequest("title is required");
    const now = new Date().toISOString();
    const pl: Playlist = {
      id: randomUUID(), ownerId: c.get("userId"), title: parsed.data.title,
      detail: parsed.data.detail ?? null, items: [], importedFrom: null, updatedAt: now,
    };
    await deps.playlists.save(pl);
    return c.json(toPlaylistSummary(pl), 201);
  });
  app.get("/v1/playlists/:id", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    return c.json(toPlaylistDetail(pl, deps.catalog));
  });
  app.patch("/v1/playlists/:id", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    const parsed = playlistUpdate.safeParse(await body(c));
    if (!parsed.success) throw Errors.badRequest("invalid update");
    if (parsed.data.title !== undefined) pl.title = parsed.data.title;
    if (parsed.data.detail !== undefined) pl.detail = parsed.data.detail;
    if (parsed.data.itemOrder) {
      const byId = new Map(pl.items.map((i) => [i.id, i]));
      const reordered = parsed.data.itemOrder.map((id) => byId.get(id)).filter((i): i is PlaylistItem => !!i);
      // keep any items not named in itemOrder, appended in their existing order
      const named = new Set(parsed.data.itemOrder);
      pl.items = [...reordered, ...pl.items.filter((i) => !named.has(i.id))];
    }
    pl.updatedAt = new Date().toISOString();
    await deps.playlists.save(pl);
    return c.json(toPlaylistDetail(pl, deps.catalog));
  });
  app.delete("/v1/playlists/:id", async (c) => {
    await owned(c.req.param("id"), c.get("userId"));
    await deps.playlists.delete(c.req.param("id"));
    return c.body(null, 204);
  });

  // -------------------- Playlist items (R4) --------------------
  app.post("/v1/playlists/:id/items", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    const parsed = addItems.safeParse(await body(c));
    if (!parsed.success) throw Errors.badRequest("unifiedTrackIds is required");
    for (const tid of parsed.data.unifiedTrackIds) {
      if (!deps.catalog.get(tid)) throw Errors.notFound(`Track ${tid}`);
    }
    const newItems: PlaylistItem[] = parsed.data.unifiedTrackIds.map((tid) => ({
      id: randomUUID(), unifiedTrackId: tid, origin: "local", preferredService: null,
    }));
    const at = parsed.data.position ?? pl.items.length;
    pl.items.splice(Math.max(0, Math.min(at, pl.items.length)), 0, ...newItems);
    pl.updatedAt = new Date().toISOString();
    await deps.playlists.save(pl);
    return c.json(toPlaylistDetail(pl, deps.catalog));
  });
  app.patch("/v1/playlists/:id/items/:itemId", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    const idx = pl.items.findIndex((i) => i.id === c.req.param("itemId"));
    if (idx < 0) throw Errors.notFound("Item");
    const parsed = itemUpdate.safeParse(await body(c));
    if (!parsed.success) throw Errors.badRequest("invalid item update");
    const item = pl.items[idx]!;
    if (parsed.data.preferredService !== undefined) item.preferredService = parsed.data.preferredService;
    if (parsed.data.position !== undefined) {
      pl.items.splice(idx, 1);
      pl.items.splice(Math.max(0, Math.min(parsed.data.position, pl.items.length)), 0, item);
    }
    pl.updatedAt = new Date().toISOString();
    await deps.playlists.save(pl);
    return c.json(toPlaylistDetail(pl, deps.catalog));
  });
  app.delete("/v1/playlists/:id/items/:itemId", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    const before = pl.items.length;
    pl.items = pl.items.filter((i) => i.id !== c.req.param("itemId"));
    if (pl.items.length === before) throw Errors.notFound("Item");
    pl.updatedAt = new Date().toISOString();
    await deps.playlists.save(pl);
    return c.body(null, 204);
  });

  // -------------------- Import (R2) --------------------
  app.get("/v1/import/:service/playlists", async (c) => {
    const service = serviceParam.parse(c.req.param("service"));
    const conn = await deps.connections.get(c.get("userId"), service);
    if (!conn?.isLinked) throw Errors.notConnected();
    return c.json({ playlists: await deps.gateway.listPlaylists(c.get("userId"), service) });
  });
  app.post("/v1/import/:service/playlists", async (c) => {
    const service = serviceParam.parse(c.req.param("service"));
    const conn = await deps.connections.get(c.get("userId"), service);
    if (!conn?.isLinked) throw Errors.notConnected();
    const parsed = importReq.safeParse(await body(c));
    if (!parsed.success) throw Errors.badRequest("providerPlaylistIds is required");
    const created = await importPlaylists({
      userId: c.get("userId"), service, providerPlaylistIds: parsed.data.providerPlaylistIds,
      keepInSync: parsed.data.keepInSync, gateway: deps.gateway, catalog: deps.catalog, store: deps.playlists,
    });
    return c.json({ playlists: created.map(toPlaylistSummary) }, 201);
  });

  // -------------------- Sync (R2) --------------------
  app.get("/v1/playlists/:id/sync", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    if (!pl.importedFrom) throw Errors.notSynced();
    return c.json({ playlistId: pl.id, lastSyncedAt: pl.importedFrom.lastSyncedAt, lastDiff: null });
  });
  app.post("/v1/playlists/:id/sync", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    const status = await triggerSync({
      userId: c.get("userId"), playlist: pl, gateway: deps.gateway, catalog: deps.catalog, store: deps.playlists,
    });
    return c.json(status);
  });

  // -------------------- Playback queue (R1) --------------------
  app.get("/v1/playlists/:id/queue", async (c) => {
    const pl = await owned(c.req.param("id"), c.get("userId"));
    const connections = await deps.connections.listForUser(c.get("userId"));
    return c.json({ tracks: resolveQueue(pl, deps.catalog, connections) });
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.code, message: err.message }, err.status as never);
    if (err instanceof z.ZodError) return c.json({ error: "bad_request", message: "invalid parameter" }, 400);
    console.error("unhandled", err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
