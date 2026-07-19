# Immersion

**Immersion helps you find the right place, at the right time, for the person you
are — so you can spend an evening in New York like a local, not a tourist.**

Most "top places" lists are static: they rank a bar the same way at 9am Tuesday as
at 11pm Saturday, and they rank it the same for everyone. Immersion starts from a
different premise — that where a city is worth being *changes by the hour and by
who you are*. It reads a typical week of anonymized movement to estimate, for every
block, how alive an area is right now and whether that life is driven by locals or
visitors. Then it ranks venues by their inherent quality and adjusts those rankings
for the neighborhood's live context — nudging a great spot down when its block is
dead or tourist-heavy at this hour, and up when the neighborhood is genuinely humming.

## What it's trying to get right

- **Right place** — surface neighborhoods that are *unusually alive for them* right
  now (a quiet Greenpoint block that fills up on a Friday counts as much as a busy
  Midtown one), leaning toward areas with local energy rather than raw density.
- **Right time** — the same area and the same venue re-score across the week; a
  wine bar's Saturday-midnight is not its Tuesday-morning.
- **Right person** — an optional five-question taste read gently reshuffles results
  toward the kind of energy, novelty, and formality you chose, without ever
  overturning quality.
- **Honest about what it knows** — where the signal is thin, the map falls back to
  what it's confident in (a venue's quality) instead of inventing local color, and
  it never claims a literal headcount of locals vs. tourists.

## How it works

Two repositories, one contract:

```text
immersion_data  →  versioned NYC artifacts  →  immersion (this app)
(offline engine)     public/data/nyc/            React + MapLibre
```

The offline engine models a typical week and produces, per block and hour, four
quantities kept deliberately separate: **activity** (how alive), **local
likelihood**, **visitor pressure**, and **venue quality**. This app loads those
artifacts and ranks venues with the engine's recommender score:

```text
S(v,t) = quality  ×  time-of-week fit  ×  activity  ×  local reward  ×  visitor penalty
```

Quality anchors the ranking; the place-and-time terms move a venue up or down and
relax toward "no opinion" as the underlying data thins. Personalization rides on
top as a bounded nudge. The client reproduces the engine's score exactly — a
golden-parity test asserts it, so the app and the engine can never quietly drift.

## Product loop

```text
Open map → choose intent → choose an area → compare 3–5 venues
         ↘ optional "Near me" and five-choice taste flow ↗
```

- City zoom shows at most three neighborhood-scale recommendation halos, never a
  blanket analytics grid.
- Intent (eat, drink, coffee, culture, outside, nightlife) immediately changes
  which areas and venues are eligible — and how context is weighed (a quiet-coffee
  run prefers a calm block; nightlife wants energy; culture tolerates iconic,
  visitor-heavy spots).
- The 3–5 venues shown are chosen to spread across the neighborhood, not stack on
  one corner.
- `Near me` is opt-in and precise location stays in memory only.

## Run and verify

```bash
npm install
npm test        # unit + golden-parity + calibration tests
npm run typecheck
npm run build
npm run dev     # opens directly at /map
```

MapLibre uses keyless OpenFreeMap tiles — no authentication or Mapbox token
required.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push
to `main` — live at **https://mjsilverman19.github.io/immersion/**. It sets
`VITE_BASE_PATH=/immersion/` for the Pages subpath and copies `index.html` to
`404.html` so deep links and refreshes resolve.

## Data boundary

The app never parses CSV or fetches raw provider URLs at runtime. Regenerate the
checked-in, schema-versioned contract from a sibling engine checkout with:

```bash
npm run data:export -- ../immersion_data/data
```

`pipeline/export_frontend.py` filters geometry to the declared pilot coverage
(Manhattan below 96th St + Williamsburg / Greenpoint / Long Island City), assigns
H3 cells to NTA neighborhoods, derives per-venue taste features from the engine's
place fingerprints, splits the hourly model by weekday (aligned to the engine's
Monday-indexed week), strips raw provider fields, and emits artifacts under
`public/data/nyc`.

## Scoring model

- **Venues** rank by the multiplicative score above: quality is the anchor, the
  neighborhood's activity / local-orientation / visitor-pressure at the selected
  hour contextualize it, and each context term is scaled by its confidence so
  thin-evidence blocks fall back toward pure quality rather than reading as dead.
- **Context is intent-relative fit, not universal good/bad** — local reward,
  visitor penalty, and the preferred activity level vary by intent
  (`src/lib/config.ts` → `INTENT_SCORING`).
- **Taste personalization is a bounded lever**, not a competing term: ±15% on
  venues and ±30% on areas, scaled down further when the taste profile is sparse.
- **The shown set is composed for variety** (spatial + category diversity) after
  ranking, so relevance and set composition stay separate concerns.
- **Explanations are template-based** and describe only genuine positive
  contributions; recommendation copy never states a literal local/tourist
  composition.

Calibration diagnostics (`src/lib/scoreDiagnostics.ts`) track that quality stays
the anchor of the ranking rather than being overwhelmed by context. The
methodology page documents activity, local-orientation, visitor-pressure,
confidence, limitations, dataset version, and footprint in plain language.
