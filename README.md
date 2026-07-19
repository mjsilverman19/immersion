# Immersion

Immersion is a recommendation-first NYC map. Its offline engine models a
typical week; the React product uses that intelligence quietly to show where to
look, then which places fit a user’s intent and optional taste profile.

```text
immersion_data → versioned NYC artifacts → immersion React app
```

## Product loop

```text
Open map → choose intent → choose an area → compare 3–5 venues
         ↘ optional Near me and five-choice taste flow ↗
```

- City zoom shows at most three neighborhood-scale recommendation halos, never
  a blanket analytics grid.
- Intent immediately changes area and venue eligibility.
- `Near me` is opt-in and precise location remains in memory only.
- Taste personalization is capped at ±30% and can be compared with the city
  baseline.
- Venue actions persist locally behind a replaceable storage interface.
- Recommendation copy never claims literal local/tourist composition.

## Run and verify

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

The app opens directly at `/map`. MapLibre uses keyless OpenFreeMap tiles; no
authentication or Mapbox token is required.

`.github/workflows/deploy.yml` builds and publishes the app to GitHub Pages on
every push to `main` (`https://mjsilverman19.github.io/immersion/`). It sets
`VITE_BASE_PATH=/immersion/` for the Pages subpath and copies `index.html` to
`404.html` so client-side routes resolve correctly on refresh/deep-link.

## Data boundary

The app never parses CSV or fetches GitHub raw URLs. Regenerate the checked-in
contract from the separate engine checkout with:

```bash
npm run data:export -- ../immersion_data/data
```

`pipeline/export_frontend.py` filters geometry to the declared pilot coverage,
assigns H3 cells to NTA neighborhoods, derives discovery features from real
venue inventory, splits the hourly model by weekday, strips raw provider
fields, and emits schema-versioned artifacts under `public/data/nyc`.

## Scoring guardrails

- Area candidates combine relative activity, intent-relevant supply, diversity,
  wandering potential, confidence, and a small internal orientation adjustment.
- Taste follows the capped formula `B × [1 + 0.3 × tanh(θ·x)]`, with confidence
  pulling unsupported areas back toward baseline.
- Venues rank only inside a selected area. Intent and taste are primary;
  external quality prior is a maximum 10% tie-breaker.
- Explanations are template-based outputs of actual positive contributions.

The methodology page documents activity, local-orientation, visitor-pressure,
confidence, limitations, dataset version, and footprint in plain language.
