/**
 * Map configuration.
 *
 * Phase 1 uses keyless vector tiles only — no proprietary access token.
 * Base geometry comes from OpenFreeMap (OpenMapTiles schema); glyphs come
 * from the community openmaptiles font server (which carries a serif face
 * we use for venue labels). Both are restyled into the Immersion brand
 * surface in `mapStyle.ts`.
 */

import type { Intent } from "@/types/data";

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

/**
 * Recommender score constants, mirrored from the offline engine
 * (immersion_data/pipeline/assemble_scores.py) so client venue rankings
 * reproduce S(v,t) = SCALE · Q · time · activity · local · tourist by
 * construction. Keep these in lockstep with the pipeline.
 */
export const SCORING = {
  /** Local reward ceiling: up to +100% at full local likelihood. */
  LAMBDA: 1.0,
  /** Tourist penalty: down to −60% at full tourist saturation. */
  GAMMA: 0.6,
  /** Off-peak floor for the category time curve (never zeroes a venue). */
  TIME_FLOOR: 0.25,
  /** Display scale: SCALE · max product (2.0) = 100 ceiling. */
  SCALE: 50,
  /** Bounded ±15% taste nudge applied on top of a venue's contextual score. */
  VENUE_PERSONALIZATION_CAP: 0.15,
} as const;

export interface IntentScoring {
  /** Local-reward strength (engine default 1.0 -> up to +100%). */
  lambda: number;
  /** Tourist-penalty strength (engine default 0.6 -> down to −60%). */
  gamma: number;
  /** When set, activity is scored as fit toward this level (0..1) rather than
   *  "busier is better" — e.g. a quiet-coffee run prefers a moderate buzz. */
  activityTarget?: number;
  /** Curvature of the peaked activity fit; higher = sharper preference. */
  activityStrength?: number;
}

/** Engine-faithful scoring: local/visitor as universal levers, activity
 *  monotonic. Used for `anything` and as the default in the pure scorer, so
 *  golden parity with the offline engine is preserved. */
export const ENGINE_SCORING: IntentScoring = { lambda: SCORING.LAMBDA, gamma: SCORING.GAMMA };

/**
 * Intent-relative scoring. Local orientation, visitor pressure, and activity are
 * *fit*, not universal good/bad: a quiet-coffee run prefers a calm block and
 * barely penalizes visitors, while culture tolerates iconic/touristy areas.
 * These diverge from the engine's global constants by design and apply only to
 * specific intents; `anything` stays engine-faithful.
 */
export const INTENT_SCORING: Record<Intent, IntentScoring> = {
  anything: ENGINE_SCORING,
  eat: { lambda: 1.0, gamma: 0.6 },
  drink: { lambda: 1.0, gamma: 0.6 },
  coffee: { lambda: 1.0, gamma: 0.3, activityTarget: 0.5, activityStrength: 3 },
  culture: { lambda: 0.7, gamma: 0.2 },
  outside: { lambda: 0.9, gamma: 0.4 },
  nightlife: { lambda: 1.0, gamma: 0.6 },
};

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
