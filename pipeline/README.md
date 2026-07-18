# Data export

`export_frontend.py` converts the offline Immersion engine output into the
versioned, frontend-safe contract under `public/data/nyc`.

```bash
npm run data:export -- ../immersion_data/data
```

The exporter validates the coverage polygon, excludes unsupported cells,
assigns H3 resolution-10 cells and venues to neighborhoods, derives discovery
features, splits hourly metrics by weekday, and strips provider-specific fields.

The generated artifacts are checked in so the browser never reads CSV files or
depends on the engine repository at runtime.
