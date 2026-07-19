/**
 * Map configuration.
 *
 * Phase 1 uses keyless vector tiles only — no proprietary access token.
 * Base geometry comes from OpenFreeMap (OpenMapTiles schema); glyphs come
 * from the community openmaptiles font server (which carries a serif face
 * we use for venue labels). Both are restyled into the Immersion brand
 * surface in `mapStyle.ts`.
 */

/** Keyless OpenMapTiles vector tiles (TileJSON). */
export const TILE_URL =
  import.meta.env.VITE_TILE_URL || "https://tiles.openfreemap.org/planet";

/**
 * Self-hosted Inter glyphs generated into /public/fonts.
 * Kept in-app so venue and place labels render in the brand sans face with
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
  paper: "#FAF8F5",
  surface: "#F2EDE6",
  border: "#E3DFD6",
  text: "#24221F",
  muted: "#6B6862",
  primary: "#1D4ED8",
  route: "#2E7CCB",
  park: "#A8C9A0",
  water: "#DCEAF6",
  highlight: "#FFB84D",
} as const;
