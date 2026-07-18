# Pipeline

Two offline batch scripts build the static data the app loads:

- **`build_hex_index.py`** — the CitiBike hex index (local-activity surface).
- **`build_venues.py`** — the scored venue layer, built on the hex index.

---

## `build_hex_index.py` — hex index (Task 2, pooled over three months)

Reconstructs the local-activity surface per H3 res-9 cell from CitiBike trips and
emits it three ways:

```
pipeline/.cache/hexes.geojson   hex polygons + properties (consumed by build_venues.py)
public/data/hexes.geojson       same, served to the app
public/data/hex-index.json      keyed by H3 id (centroid + properties) — the lookup file
```

```bash
./.venv/bin/python build_hex_index.py             # pool Apr–Jun 2026, emit files
./.venv/bin/python build_hex_index.py --calibrate # report corr vs committed (June logic)
```

**Three-month pool.** One month leaves hour-level temporal shares too noisy, so we
pool a seasonally coherent spring window (**Apr, May, Jun 2026**) downloaded from the
same public S3 bucket (`s3.amazonaws.com/tripdata/YYYYMM-citibike-tripdata.zip`).
Shares are **normalized per month before pooling** — each hex's shares are computed
within each month, then averaged across months — so a high-volume month can't drown a
low-volume one (Apr 3.86M / May 4.69M / Jun 5.38M trips). `local_percentile` and
`saturation` are recomputed from the pooled shares.

**Methodology** (recovered to reproduce the original single-month output, then widened
— calibration corr vs committed: member_share 0.995, saturation 0.967,
local_percentile 0.919):

- Each station is smoothed onto nearby hexes with exponential distance decay (300 m).
  A hex with no dock within 500 m is `low_signal` (no score).
- `member_share` — smoothed member / smoothed total (volume-weighted subscriber share).
- `commuter_frac` — weekday (Mon–Fri) share in the commute peaks 8–10 & 17–19.
- `local_percentile` — percentile rank of `member_share * (1 - 0.5*commuter_frac)`, so
  commuter hubs (works-here, not lives-here) are damped below residential cells.
- `saturation` — smoothed casual share + additive tourist-corridor boosts (`0.25 * exp`
  decay over 800 m) near the Midtown core, the Brooklyn Bridge approach, and the High Line.
- `temporal` — the legacy 3-field signature kept for the venue card: `weekday_evening`
  (Mon–Fri 18–22), `weekend_day` (Sat–Sun 9–16), `late_night` (any day 23–04).
- `buckets` — six new time-window shares of the normalized 24×7 matrix, used by the
  app's time-aware tint: `weekday_morning` (Mon–Fri 7–11), `weekday_midday` (11–17),
  `weekday_evening` (17–23), `weekend_day` (Sat–Sun 9–17), `weekend_night`
  (Fri–Sat 20–02), `late` (any day 23–04, minus the hours claimed by `weekend_night`).

The hex id set, polygon geometry, and the `low_signal` partition are taken verbatim
from the committed `hexes.geojson`, so the diff is "identical structure plus the six
bucket fields, changed values only." Re-run `build_venues.py score` afterward to
re-score venues against the updated hex values (offline, no API spend).

---

## `build_venues.py` — scored venue layer (Task 3)

`build_venues.py` turns the hex grid into `data/venues.json`: a static set of
scored NYC venues for the map.

## Flow

```
python build_venues.py select   # dry run: hex selection + Places call/cost estimate (no key)
python build_venues.py fetch     # Places Nearby Search -> caches raw JSON to .cache/places/ (needs key)
python build_venues.py score     # score cached responses -> ../data/venues.json (offline)
python build_venues.py all       # fetch + score
```

Use the repo's Python venv: `./.venv/bin/python build_venues.py <cmd>`.

## API key

`fetch` needs `GOOGLE_PLACES_API_KEY` (Places API **New** / `places.googleapis.com/v1`,
same surface as the Task 1 edge function). Put it in the gitignored repo-root `.env`:

```
GOOGLE_PLACES_API_KEY=...
```

then `set -a && . ../.env && set +a` before running `fetch`.

Raw responses are cached under `.cache/places/{h3}_{category}.json`, so reruns and
re-scoring are free — delete a cache file to force a refetch of that hex/category.

## What it does

- **Hex source** — `.cache/hexes.geojson`, written by `build_hex_index.py` (`h3`,
  `local_percentile`, `saturation`, `member_share`, `commuter_frac`, `temporal`
  signature, `buckets`). Low-signal hexes are dropped.
- **Selection** — top 130 hexes by `local_percentile` + 70 stratified mid-tier
  (bands 0.35–0.55 and 0.55–0.75) so the map isn't empty outside the best areas.
- **Categories** — restaurant, bar, cafe, park, museum/gallery (Nearby Search,
  radius 260 m, ≤20 results/call).
- **Score (0–100)**
  - *Quality* — Bayesian shrinkage of the Google rating toward its category mean
    (prior strength 75), then converted to a category-relative percentile so a
    4.9-with-5-reviews lands below a 4.4-with-800.
  - *Blend* — `0.60 * local_percentile + 0.40 * quality` (tune in Task 6).
  - *Saturation penalty* — subtractive, `0 … 0.15` scaled from the hex's saturation
    (floor 0.20, ceil 0.50), capped so a great venue in a saturated zone still
    surfaces but ranks below its unsaturated equivalent.
- **Temporal note** — one of 7 phrases, assigned from the hex signature by
  corpus-relative percentile (LATE NIGHT CROWD, WEEKEND MORNINGS, LOCALS HERE
  WEEKNIGHTS, AFTER-WORK WEEKNIGHTS, WEEKDAY COMMUTER HUB, NEIGHBORHOOD REGULARS,
  STEADY ALL WEEK).
- **Venue → hex** — each venue is assigned to its true res-9 h3 cell (falls back to
  the query hex), so every `hex_id` links back to a Task 2 hex.

## Output

`data/venues.json` — array of `{ id, name, lat, lng, category, price_tier,
index_score, temporal_note, hex_id, neighborhood }`. Ratings-derived scores and basic
facts only; no photo references or review text are stored (Places API caching terms).
`neighborhood` is an extra field kept for Task 6 validation.
