# AGENTS.md

## Cursor Cloud specific instructions

Immersion is a **single static Vite + React + TypeScript SPA** — there is no backend, no database, and no auth. All recommendation data is pre-generated and committed under `public/data/nyc/` (~14 MB GeoJSON/JSON); the app reads these static artifacts at runtime. The optional Python pipeline in `pipeline/` (`data:export`) only regenerates those artifacts from a sibling `immersion_data` engine checkout and is not needed to run or test this app.

Standard commands live in `package.json` scripts and the README "Run and verify" section — use those (`npm run dev`, `npm test`, `npm run typecheck`, `npm run build`). Notes that aren't obvious from those files:

- Dev server runs on **port 8080** (not Vite's default 5173) with `host: true` — see `vite.config.ts`. The `/` route redirects to `/map`.
- The base map needs **internet access** for keyless OpenFreeMap vector tiles (`https://tiles.openfreemap.org/planet`). Map glyphs are self-hosted from committed files in `public/fonts/`. Optional overrides: `VITE_TILE_URL`, `VITE_GLYPHS_URL` (see `.env.example`); no tokens/secrets required.
- `npm test` runs Vitest, which includes a **golden-parity test** asserting the client score matches the offline engine exactly, plus calibration diagnostics. If you change scoring logic in `src/lib/`, expect these to fail unless the committed golden data is also regenerated.
- `VITE_BASE_PATH=/immersion/` is only for the GitHub Pages subpath deploy; leave it unset for local dev.
