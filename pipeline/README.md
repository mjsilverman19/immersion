# Data export

`export_frontend.py` converts the offline Immersion engine output into the
versioned, frontend-safe contract under `public/data/nyc`.

```bash
npm run data:export -- ../immersion_data/data
```

The exporter validates the coverage polygon, excludes unsupported cells,
assigns H3 resolution-10 cells and venues to neighborhoods, derives discovery
features, splits hourly metrics by weekday, and strips provider-specific fields.
It requires `numpy` (the taste-space build below runs inside the export).

The generated artifacts are checked in so the browser never reads CSV files or
depends on the engine repository at runtime.

## Taste space (schema v5)

`build_taste_space.py` (invoked from the exporter, never standalone in the
normal flow) turns the engine's per-venue fingerprints into
`public/data/nyc/taste_space.json`: int8-quantized 47-dim venue vectors
(temporal 8 | ecology 24 | area 9 | role 5 | price 1, channel-scaled), the
corpus covariance, per-neighborhood centroid vectors, and the quiz question
axes derived from `taste_questions.json` — each question's axis is the
normalized difference between the centroids of its two exemplar venue sets,
resolved from declarative selectors (categories + percentile predicates over
named fingerprint fields). Build gates fail the export on thin exemplar sets,
near-duplicate axes, uncovered channels, or an oversized payload.

For authoring iteration on the question bank only:

```bash
python3 pipeline/build_taste_space.py ../immersion_data/data public/data/nyc/venues.json
```

`validate_taste_quiz.py` simulates personas answering the shipped quiz with the
exact client selection math (equivalence pinned against
`src/lib/tasteSpace.fixture.json`, shared with the TS unit tests) and gates on
ranking recovery, persona divergence, question coverage, quiz length, and
stability:

```bash
python3 pipeline/validate_taste_quiz.py
```

Run it after every `data:export`.
