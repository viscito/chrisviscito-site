import { describe, it, expect } from "vitest";
import { HttpSourceReader, type SessionProvider } from "../src/sourceReader.js";

const sessions: SessionProvider = { async sessionFor() { return "session-jwt"; } };

describe("HttpSourceReader", () => {
  it("calls the token-service brokered endpoint with the right URL and auth", async () => {
    let seenUrl = "";
    let seenAuth: string | null = null;
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url);
      seenAuth = new Headers(init?.headers).get("Authorization");
      return new Response(JSON.stringify({ tracks: [{ service: "appleMusic", providerTrackId: "am-1", isrc: "X", title: "T", artists: ["A"], durationMillis: 1000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const reader = new HttpSourceReader("http://token", sessions, fakeFetch);
    const tracks = await reader.readSource("u1", "appleMusic", "pl-1");

    expect(seenUrl).toBe("http://token/v1/apple-music/library/playlists/pl-1/tracks");
    expect(seenAuth).toBe("Bearer session-jwt");
    expect(tracks[0]?.isrc).toBe("X");
  });

  it("throws on a non-OK response", async () => {
    const fakeFetch = (async () => new Response("nope", { status: 502 })) as unknown as typeof fetch;
    const reader = new HttpSourceReader("http://token", sessions, fakeFetch);
    await expect(reader.readSource("u1", "spotify", "pl-9")).rejects.toThrow(/502/);
  });
});
