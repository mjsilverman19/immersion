/**
 * Map configuration.
 *
 * Phase 1 uses keyless vector tiles only — no proprietary access token.
 * Base geometry comes from OpenFreeMap (OpenMapTiles schema); glyphs come
 * from the community openmaptiles font server (which carries a serif face
 * we use for venue labels). Both are restyled into a cream / ink / rust
 * atlas surface in `mapStyle.ts`.
 */

/** Keyless OpenMapTiles vector tiles (TileJSON). */
export const TILE_URL =
  import.meta.env.VITE_TILE_URL || "https://tiles.openfreemap.org/planet";

/**
 * Self-hosted serif glyphs (generated from Noto Serif into /public/fonts).
 * Kept in-app so the venue and place labels render in the atlas's serif with
 * no third-party font server dependency.
 */
export const GLYPHS_URL =
  import.meta.env.VITE_GLYPHS_URL ||
  `${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`;

/** Static data assets, served from /public. */
export const DATA = {
  hexes: `${import.meta.env.BASE_URL}data/hexes.geojson`,
  hexIndex: `${import.meta.env.BASE_URL}data/hex-index.json`,
  hexCurve: `${import.meta.env.BASE_URL}data/hex-curve.json`,
  streets: `${import.meta.env.BASE_URL}data/streets.geojson`,
  runs: `${import.meta.env.BASE_URL}data/runs.json`,
  venues: `${import.meta.env.BASE_URL}data/venues.json`,
} as const;

export const MAP_CONFIG = {
  /** Default view: the Brooklyn / Queens activity band (midtown suppressed). */
  center: { lat: 40.726, lng: -73.958 },
  zoom: 12.3,
  minZoom: 10,
  maxZoom: 18,
} as const;

/**
 * The hand-tinted atlas palette. Kept here so the base style, the data
 * layers, and any React chrome all draw from one source of truth.
 */
export const PALETTE = {
  cream: "#FAF8F5", // land / paper ground
  creamDeep: "#EDE4D4", // water — a slightly deeper cream
  creamPark: "#F0EEE4", // barely-there greenspace tint
  building: "#F1EBE0", // faint plate texture
  ink: "#1A1A1A", // linework + labels
  rust: "#C45D3E", // locals (member) activity + venue pins
  indigo: "#6B6E8A", // visitors (casual) activity — the muted second population
  touristGray: "#ABA398", // saturated hexes desaturate toward this
  lowSignal: "#E3DCCF", // flat, muted "thin data" fill
} as const;
