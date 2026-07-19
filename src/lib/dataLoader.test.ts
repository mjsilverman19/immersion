import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadManifest, loadPlaceNeighbors, loadVenues } from "@/lib/dataLoader";

// Exercise the real loader path against the actual exported artifacts under
// public/data/nyc, so a schema bump or a broken index reference is caught here.
const PUBLIC_ROOT = resolve(__dirname, "../../public");

beforeEach(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const path = resolve(PUBLIC_ROOT, url.replace(/^\//, ""));
    const body = readFileSync(path, "utf-8");
    return { ok: true, status: 200, json: async () => JSON.parse(body) } as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dataLoader against shipped artifacts", () => {
  it("accepts the current schema-v3 manifest", async () => {
    const manifest = await loadManifest();
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.files.placeNeighbors).toBe("place_neighbors.json");
  });

  it("resolves place neighbors into venue-referencing entries with 0-1 scores", async () => {
    const manifest = await loadManifest();
    const venues = await loadVenues(manifest);
    const index = await loadPlaceNeighbors(manifest, venues);

    expect(index.size).toBe(venues.length);
    const entry = index.get(venues[0].id);
    expect(entry).toBeDefined();
    expect(entry!.similar.length).toBeGreaterThan(0);

    const neighbor = entry!.similar[0];
    expect(neighbor.venue.id).toBeTypeOf("string");
    for (const value of Object.values(neighbor.scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    // Every similar/complement reference must resolve to a real venue.
    const ids = new Set(venues.map((venue) => venue.id));
    for (const item of entry!.similar) expect(ids.has(item.venue.id)).toBe(true);
    for (const item of entry!.complements) {
      expect(ids.has(item.venue.id)).toBe(true);
      expect(["alongside", "after", "before"]).toContain(item.role);
      expect(item.distanceMeters).toBeGreaterThanOrEqual(0);
    }
  });
});
