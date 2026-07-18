#!/usr/bin/env python3
"""
Task 2 / Task 6 (Part A) — Build the CitiBike hex index, pooled over three months.

Reconstructs the local-activity surface per H3 res-9 cell from CitiBike trips and
emits it three ways:

  pipeline/.cache/hexes.geojson   hex polygons + properties (consumed by build_venues.py)
  public/data/hexes.geojson       same, served to the app
  public/data/hex-index.json      keyed by H3 id (centroid + properties) — the lookup file

Why three months (Apr–Jun): one month leaves hour-level temporal shares too noisy.
We pool a seasonally coherent window and **normalize per month before pooling** so a
high-volume month can't drown a low-volume one: each hex's shares are computed within
each month, then averaged across months. local_percentile and saturation are then
recomputed from the pooled shares.

Methodology (recovered to match the original Task 2 output, then widened):
  - Each station is smoothed onto nearby hexes with exponential distance decay
    (300 m scale). A hex with no dock within 500 m is low_signal (no score).
  - member_share   = smoothed member / smoothed total trips (volume-weighted).
  - commuter_frac  = weekday (Mon–Fri) share in the commute peaks 8–10 & 17–19.
  - local_percentile = percentile rank of member_share * (1 - 0.5*commuter_frac),
    so commuter hubs (works-here, not lives-here) are damped below residential cells.
  - saturation     = smoothed casual share + additive proximity boosts (0.25 * exp
    decay over 800 m) near the Midtown core, the Brooklyn Bridge approach, and the
    High Line — the tourist corridors.
  - temporal (legacy 3-field signature, kept for the venue card): weekday_evening
    (Mon–Fri 18–22), weekend_day (Sat–Sun 9–16), late_night (any day 23–04).
  - buckets (six new fields, Part B): shares of the normalized 24x7 matrix over the
    time windows the time-aware tint renders against.

The hex id set and polygon geometry are taken verbatim from the committed
hexes.geojson, and the committed low_signal partition is preserved, so the diff is
"identical structure plus the six bucket fields, changed values only."

Usage:
  ./.venv/bin/python build_hex_index.py            # pool Apr–Jun, emit files
  ./.venv/bin/python build_hex_index.py --calibrate  # report corr vs committed (June logic)
"""

import json
import math
import sys
from pathlib import Path

import duckdb
import h3

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CACHE = ROOT / ".cache"
CSV_DIR = CACHE / "csv"
COMMITTED = REPO / "public" / "data" / "hexes.geojson"
OUT_CACHE_GEOJSON = CACHE / "hexes.geojson"
OUT_PUBLIC_GEOJSON = REPO / "public" / "data" / "hexes.geojson"
OUT_HEX_INDEX = REPO / "public" / "data" / "hex-index.json"
OUT_SURFACE = REPO / "public" / "data" / "surface.json"
OUT_HEX_CURVE = REPO / "public" / "data" / "hex-curve.json"

# Seasonally coherent window (spring). Ordered oldest→newest for the log.
MONTHS = ["202604", "202605", "202606"]

# --- Smoothing / coverage ------------------------------------------------
SMOOTH_SCALE_M = 300.0   # exponential decay scale for station→hex smoothing
SMOOTH_CUTOFF_M = 900.0  # ignore stations past this (exp(-900/300)=0.05, negligible)
LOW_SIGNAL_M = 500.0     # a hex with no dock within this is low_signal
GRID_K = 6               # h3 rings to scan for candidate stations (~1 km at res 9)

# --- Fine activity surface (for rendering, not scoring) ------------------
# The venue index and temporal buckets stay at res-9 (stable), but the drawn
# activity wash is computed at res-10 with a tighter kernel so it traces the real
# dock network — specific corridors and blocks — instead of reading as a diffuse
# res-9 blob. Each res-10 cell keeps a pointer to its res-9 parent so it retimes
# with the parent's (stable) temporal buckets.
SURFACE_RES = 10
SURFACE_SMOOTH_SCALE_M = 170.0
SURFACE_CUTOFF_M = 480.0
SURFACE_LOW_SIGNAL_M = 260.0  # a res-10 cell with no dock this close carries no wash
SURFACE_GRID_K = 8            # res-10 rings to scan (~520 m)

# --- Scoring knobs (recovered by fitting the committed June output) ------
COMMUTER_DAMPEN = 0.5    # local weight is scaled by (1 - COMMUTER_DAMPEN*commuter_frac)
SAT_BOOST = 0.25         # additive tourist-corridor boost magnitude
SAT_BOOST_SCALE_M = 800.0
TOURIST_ANCHORS = {
    "midtown_core": (40.758, -73.985),    # Times Square
    "brooklyn_bridge": (40.7115, -73.9999),  # Manhattan approach
    "high_line": (40.7440, -74.0050),     # corridor midpoint
}

# dow convention (CitiBike started_at via duckdb dayofweek): 0=Sun … 6=Sat.
WEEKDAYS = (1, 2, 3, 4, 5)
WEEKEND = (0, 6)
COMMUTE_HOURS = (8, 9, 10, 17, 18, 19)

# --- Longitudinal gate (Task 8 refactor) ---------------------------------
# The rendered signal is no longer a citywide percentile (which just ranks
# avenues by absolute volume, every bucket). It is a *self-referential trend*:
# per (hex, bucket), the last complete week's member volume against that same
# hex+bucket's own trailing-weeks baseline (median + MAD, robust to spikes).
# A steadily-busy avenue sits at its own median → z≈0 → renders as plain ink.
# A pocket that popped this week rises above its own normal → high z → lit.
GATE_TRAILING_WEEKS = 12     # baseline window before the current week
GATE_MIN_VALID_WEEKS = 6     # need this many baseline weeks with real signal
GATE_MIN_WEEK_MEM = 8.0      # min smoothed member rides in a bucket-week to trust it
MAD_TO_SIGMA = 1.4826        # scale MAD to a normal-consistent sigma
GATE_Z_CAP = 6.0             # clamp z so a near-constant hex can't produce infinities
WEEK_MIN_DAYS = 7            # a "complete" week must cover all seven dates

# All trip CSVs as one pooled glob (the gate/curve read the full window at once).
ALL_CSV = str(CSV_DIR / "*.csv")

# SQL predicates for the six buckets, over derived (dow, hr). Overlap-faithful to
# the Python BUCKETS windows above (weekend_night claims the Fri/Sat-night edge;
# late excludes those). Each is summed independently via FILTER, so a trip may
# count toward more than one bucket exactly as window_share() allows.
_WN_SQL = "((dow IN (5,6) AND hr IN (20,21,22,23)) OR (dow IN (6,0) AND hr IN (0,1)))"
BUCKET_SQL = {
    "weekday_morning": "dow BETWEEN 1 AND 5 AND hr BETWEEN 7 AND 10",
    "weekday_midday": "dow BETWEEN 1 AND 5 AND hr BETWEEN 11 AND 16",
    "weekday_evening": "dow BETWEEN 1 AND 5 AND hr BETWEEN 17 AND 22",
    "weekend_day": "dow IN (0,6) AND hr BETWEEN 9 AND 16",
    "weekend_night": _WN_SQL,
    "late": f"hr IN (23,0,1,2,3) AND NOT {_WN_SQL}",
}
BUCKET_ORDER = list(BUCKET_SQL)  # stable ordering for the packed weekly arrays


def cell(dow, hour):
    return dow * 24 + hour


# --- Six time buckets (Part B), as (dow, hour) index sets over the matrix -
def _weekend_night_cells():
    cells = set()
    for d in (5, 6):                       # Fri, Sat evenings
        for h in (20, 21, 22, 23):
            cells.add(cell(d, h))
    for d in (6, 0):                       # into Sat, Sun small hours (00–02)
        for h in (0, 1):
            cells.add(cell(d, h))
    return cells


def _late_cells(weekend_night):
    # any day 23–04 (hours 23,0,1,2,3), excluding hours claimed by weekend_night
    cells = set()
    for d in range(7):
        for h in (23, 0, 1, 2, 3):
            c = cell(d, h)
            if c not in weekend_night:
                cells.add(c)
    return cells


_WN = _weekend_night_cells()
BUCKETS = {
    "weekday_morning": {cell(d, h) for d in WEEKDAYS for h in range(7, 11)},
    "weekday_midday": {cell(d, h) for d in WEEKDAYS for h in range(11, 17)},
    "weekday_evening": {cell(d, h) for d in WEEKDAYS for h in range(17, 23)},
    "weekend_day": {cell(d, h) for d in WEEKEND for h in range(9, 17)},
    "weekend_night": _WN,
    "late": _late_cells(_WN),
}


# ---------------------------------------------------------------------------
# Per-month station aggregation (from raw trip CSVs)
# ---------------------------------------------------------------------------
def month_aggregates(con, month):
    """Return (stations, matrices) for one month.
       stations: {sid: (lat, lng, total, member, casual)}
       matrices: {sid: {(dow, hour): trips}}"""
    glob = str(CSV_DIR / f"{month}-*.csv")
    files = sorted(CSV_DIR.glob(f"{month}-*.csv"))
    if not files:
        sys.exit(f"No CSVs for {month} under {CSV_DIR} (expected {month}-*.csv).")

    st_rows = con.execute(f"""
        SELECT start_station_id AS sid,
               median(start_lat) AS lat,
               median(start_lng) AS lng,
               count(*) AS tot,
               count(*) FILTER (WHERE member_casual = 'member') AS mem,
               count(*) FILTER (WHERE member_casual = 'casual') AS cas
        FROM read_csv_auto('{glob}', ignore_errors=true)
        WHERE start_station_id IS NOT NULL AND start_lat IS NOT NULL
        GROUP BY 1
    """).fetchall()
    stations = {r[0]: (r[1], r[2], r[3] or 0, r[4] or 0, r[5] or 0) for r in st_rows}

    hd_rows = con.execute(f"""
        SELECT start_station_id AS sid,
               dayofweek(started_at) AS dow,
               hour(started_at) AS hour,
               count(*) AS trips
        FROM read_csv_auto('{glob}', ignore_errors=true)
        WHERE start_station_id IS NOT NULL AND started_at IS NOT NULL
        GROUP BY 1, 2, 3
    """).fetchall()
    matrices = {}
    total_trips = 0
    for sid, dow, hour, trips in hd_rows:
        if dow is None or hour is None:
            continue
        matrices.setdefault(sid, {})[cell(dow, hour)] = trips
        total_trips += trips
    return stations, matrices, total_trips


def haversine(a, b):
    R = 6371000.0
    la1, lo1 = math.radians(a[0]), math.radians(a[1])
    la2, lo2 = math.radians(b[0]), math.radians(b[1])
    x = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def smooth_month(hex_ids, centroids, stations, matrices):
    """Smooth one month's station values onto every hex. Returns per-hex
       {h3: (sm_tot, sm_mem, sm_cas, nearest_dock_m, matrix[168])}."""
    st_by_hex = {}
    for sid, (lat, lng, *_rest) in stations.items():
        st_by_hex.setdefault(h3.latlng_to_cell(lat, lng, 9), []).append(sid)

    out = {}
    for h in hex_ids:
        c = centroids[h]
        sm_tot = sm_mem = sm_cas = 0.0
        nearest = 1e9
        mat = [0.0] * 168
        for n in h3.grid_disk(h, GRID_K):
            for sid in st_by_hex.get(n, []):
                lat, lng, tot, mem, cas = stations[sid]
                d = haversine(c, (lat, lng))
                if d < nearest:
                    nearest = d
                if d > SMOOTH_CUTOFF_M:
                    continue
                w = math.exp(-d / SMOOTH_SCALE_M)
                sm_tot += w * tot
                sm_mem += w * mem
                sm_cas += w * cas
                for idx, tr in matrices.get(sid, {}).items():
                    mat[idx] += w * tr
        out[h] = (sm_tot, sm_mem, sm_cas, nearest, mat)
    return out


def build_surface(usable_res9, res9_commuter, per_month_stations, months):
    """Build the fine (res-10) activity surface: for each res-10 child of a usable
    res-9 hex, smooth station member share with a tight kernel and rank it as a
    volume-weighted percentile. Temporal retiming stays at res-9, so each cell
    carries its parent's h3. Returns a list of {lat,lng,lp,parent}."""
    # res-10 cells covering the footprint, with their res-9 parent.
    parent = {}
    for h in usable_res9:
        for c in h3.cell_to_children(h, SURFACE_RES):
            parent[c] = h
    cells = list(parent)
    centroids = {c: h3.cell_to_latlng(c) for c in cells}

    # Per month: index stations by their res-10 cell, smooth tot/mem onto each cell.
    per_month_cell = {}
    for m in months:
        stations = per_month_stations[m]
        st_by_cell = {}
        for sid, (lat, lng, *_r) in stations.items():
            st_by_cell.setdefault(h3.latlng_to_cell(lat, lng, SURFACE_RES), []).append(sid)
        cellrec = {}
        for c in cells:
            ctr = centroids[c]
            sm_tot = sm_mem = 0.0
            nearest = 1e9
            for n in h3.grid_disk(c, SURFACE_GRID_K):
                for sid in st_by_cell.get(n, []):
                    lat, lng, tot, mem, _cas = stations[sid]
                    d = haversine(ctr, (lat, lng))
                    if d < nearest:
                        nearest = d
                    if d > SURFACE_CUTOFF_M:
                        continue
                    w = math.exp(-d / SURFACE_SMOOTH_SCALE_M)
                    sm_tot += w * tot
                    sm_mem += w * mem
            cellrec[c] = (sm_tot, sm_mem, nearest)
        per_month_cell[m] = cellrec

    # Pool per cell (only months with signal); keep cells within reach of a dock.
    metric, vol = {}, {}
    for c in cells:
        ms, vols, near = [], [], 1e9
        for m in months:
            sm_tot, sm_mem, nd = per_month_cell[m][c]
            near = min(near, nd)
            if sm_tot <= 0:
                continue
            ms.append(sm_mem / sm_tot)
            vols.append(sm_tot)
        if not ms or near > SURFACE_LOW_SIGNAL_M:
            continue
        member_share = sum(ms) / len(ms)
        # Damp by the parent's (res-9) commuter fraction — spatial detail is fine,
        # the commuter signal stays coarse and stable.
        cf = res9_commuter.get(parent[c], 0.0)
        metric[c] = member_share * max(0.0, 1 - COMMUTER_DAMPEN * cf)
        vol[c] = sum(vols) / len(vols)

    # Volume-weighted percentile (same low-skew logic as res-9 local_percentile).
    order = sorted(metric, key=lambda c: metric[c])
    total_vol = sum(vol[c] for c in order) or 1.0
    lp, cum = {}, 0.0
    for c in order:
        lp[c] = (cum + vol[c] / 2) / total_vol
        cum += vol[c]

    surface = []
    for c in order:
        lat, lng = centroids[c]
        surface.append({
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "lp": round(lp[c], 3),
            "p": parent[c],
        })
    return surface


def window_share(mat, total, cells):
    if total <= 0:
        return 0.0
    return sum(mat[c] for c in cells) / total


def tourist_boost(centroid):
    return SAT_BOOST * max(
        math.exp(-haversine(centroid, a) / SAT_BOOST_SCALE_M) for a in TOURIST_ANCHORS.values()
    )


def percentile_ranker(values):
    import bisect
    srt = sorted(values)
    n = len(srt)
    return lambda x: (bisect.bisect_right(srt, x) / n) if n else 0.0


# Legacy temporal windows (kept so the venue card is unchanged).
LEGACY_EVENING = {cell(d, h) for d in WEEKDAYS for h in range(18, 23)}   # Mon–Fri 18–22
LEGACY_WEEKEND = {cell(d, h) for d in WEEKEND for h in range(9, 17)}     # Sat–Sun 9–16
LEGACY_LATE = {cell(d, h) for d in range(7) for h in (23, 0, 1, 2, 3, 4)}  # any day 23–04


# ---------------------------------------------------------------------------
# Longitudinal gate + hourly curve (Task 8 refactor)
# ---------------------------------------------------------------------------
def complete_weeks(con):
    """Sorted list of week-start timestamps that cover all seven dates. The
    partial first/last weeks of the ingest window are dropped so a half-week's
    low volume can't read as a hex 'going quiet'."""
    rows = con.execute(f"""
        SELECT date_trunc('week', CAST(started_at AS TIMESTAMP)) AS wk,
               count(DISTINCT CAST(started_at AS DATE)) AS days
        FROM read_csv_auto('{ALL_CSV}', ignore_errors=true)
        WHERE started_at IS NOT NULL
        GROUP BY 1
    """).fetchall()
    return sorted(wk for wk, days in rows if days and days >= WEEK_MIN_DAYS)


def station_weekly_buckets(con, weeks):
    """{sid: {wk: [member count per bucket, in BUCKET_ORDER]}} over complete weeks.
    One scan; buckets summed independently via FILTER so overlaps are faithful."""
    keep = set(weeks)
    filters = ",\n".join(
        f"count(*) FILTER (WHERE member_casual='member' AND ({sql})) AS b{i}"
        for i, sql in enumerate(BUCKET_SQL.values())
    )
    rows = con.execute(f"""
        WITH t AS (
            SELECT start_station_id AS sid,
                   date_trunc('week', CAST(started_at AS TIMESTAMP)) AS wk,
                   dayofweek(CAST(started_at AS TIMESTAMP)) AS dow,
                   hour(CAST(started_at AS TIMESTAMP)) AS hr,
                   member_casual
            FROM read_csv_auto('{ALL_CSV}', ignore_errors=true)
            WHERE start_station_id IS NOT NULL AND started_at IS NOT NULL
        )
        SELECT sid, wk, {filters}
        FROM t GROUP BY sid, wk
    """).fetchall()
    out = {}
    for r in rows:
        sid, wk = r[0], r[1]
        if wk not in keep:
            continue
        out.setdefault(sid, {})[wk] = [float(x or 0) for x in r[2:]]
    return out


def station_curves(con):
    """{sid: [member count per (dow*24+hour), 168 cells]} pooled over the window."""
    rows = con.execute(f"""
        SELECT start_station_id AS sid,
               dayofweek(CAST(started_at AS TIMESTAMP)) AS dow,
               hour(CAST(started_at AS TIMESTAMP)) AS hr,
               count(*) FILTER (WHERE member_casual='member') AS mem
        FROM read_csv_auto('{ALL_CSV}', ignore_errors=true)
        WHERE start_station_id IS NOT NULL AND started_at IS NOT NULL
        GROUP BY 1, 2, 3
    """).fetchall()
    out = {}
    for sid, dow, hr, mem in rows:
        if dow is None or hr is None:
            continue
        out.setdefault(sid, [0.0] * 168)[dow * 24 + hr] += float(mem or 0)
    return out


def station_hex_weights(hex_ids, centroids, stations):
    """{h3: [(sid, w)]} — the same exponential distance kernel the monthly
    smoothing uses, precomputed once so the weekly/curve station vectors can be
    projected onto hexes by a plain weighted sum."""
    st_by_hex = {}
    for sid, (lat, lng) in stations.items():
        st_by_hex.setdefault(h3.latlng_to_cell(lat, lng, 9), []).append(sid)
    weights = {}
    for h in hex_ids:
        c = centroids[h]
        acc = []
        for n in h3.grid_disk(h, GRID_K):
            for sid in st_by_hex.get(n, []):
                lat, lng = stations[sid]
                d = haversine(c, (lat, lng))
                if d > SMOOTH_CUTOFF_M:
                    continue
                acc.append((sid, math.exp(-d / SMOOTH_SCALE_M)))
        weights[h] = acc
    return weights


def _median(xs):
    s = sorted(xs)
    n = len(s)
    if n == 0:
        return 0.0
    m = n // 2
    return s[m] if n % 2 else (s[m - 1] + s[m]) / 2


def gate_for_series(series):
    """(z, ratio) for one hex+bucket weekly series (chronological). x is the last
    complete week; the baseline is the trailing weeks before it. Robust (median +
    MAD) so a single spike in the baseline doesn't inflate sigma. z≈0 when the
    current week sits at the hex's own normal; ratio is x/median for the caption."""
    if len(series) < 2:
        return 0.0, 0.0
    x = series[-1]
    baseline = [v for v in series[:-1] if v >= GATE_MIN_WEEK_MEM][-GATE_TRAILING_WEEKS:]
    if x < GATE_MIN_WEEK_MEM or len(baseline) < GATE_MIN_VALID_WEEKS:
        return 0.0, 0.0
    med = _median(baseline)
    if med <= 0:
        return 0.0, 0.0
    mad = _median([abs(v - med) for v in baseline])
    sigma = MAD_TO_SIGMA * mad
    if sigma <= 0:
        # Near-constant baseline: fall back to a fraction of the median so a real
        # jump still scores, but a flat hex with a tiny wobble can't blow up.
        sigma = max(0.15 * med, 1.0)
    z = max(-GATE_Z_CAP, min(GATE_Z_CAP, (x - med) / sigma))
    return z, x / med


def compute_gates(hex_weights, station_weekly, weeks):
    """{h3: {bucket: [z, ratio]}} — project station weekly bucket vectors onto each
    hex, then gate each bucket's weekly series against its own baseline."""
    out = {}
    for h, sw in hex_weights.items():
        # hex weekly bucket matrix: {wk: [6]}
        wk_mat = {wk: [0.0] * len(BUCKET_ORDER) for wk in weeks}
        for sid, w in sw:
            for wk, vec in station_weekly.get(sid, {}).items():
                row = wk_mat.get(wk)
                if row is None:
                    continue
                for b in range(len(BUCKET_ORDER)):
                    row[b] += w * vec[b]
        gates = {}
        for b, name in enumerate(BUCKET_ORDER):
            series = [wk_mat[wk][b] for wk in weeks]
            z, ratio = gate_for_series(series)
            gates[name] = [round(z, 3), round(ratio, 3)]
        out[h] = gates
    return out


def compute_curves(hex_weights, station_curves_map):
    """{h3: [168 floats 0..1]} — project station hourly profiles onto each hex,
    smooth ±1h (wrapped), normalize to the hex's own peak. Absent/flat → omitted
    (the client falls back to a flat 1.0)."""
    out = {}
    for h, sw in hex_weights.items():
        prof = [0.0] * 168
        for sid, w in sw:
            sc = station_curves_map.get(sid)
            if not sc:
                continue
            for k in range(168):
                prof[k] += w * sc[k]
        sm = [(prof[(k - 1) % 168] + prof[k] + prof[(k + 1) % 168]) / 3 for k in range(168)]
        peak = max(sm)
        if peak <= 0:
            continue
        out[h] = [round(v / peak, 3) for v in sm]
    return out


def build(calibrate=False):
    committed = json.load(open(COMMITTED))
    features = committed["features"]
    hex_ids = [f["properties"]["h3"] for f in features]
    low_signal = {f["properties"]["h3"]: bool(f["properties"].get("low_signal")) for f in features}
    centroids = {h: h3.cell_to_latlng(h) for h in hex_ids}

    con = duckdb.connect()

    # In calibrate mode, use only June (the committed month) to check the recovery.
    months = ["202606"] if calibrate else MONTHS

    per_month = {}       # month -> smoothed hex dict
    per_month_stations = {}  # month -> {sid: (lat,lng,tot,mem,cas)} (for the fine surface)
    trip_counts = {}
    for m in months:
        stations, matrices, total = month_aggregates(con, m)
        trip_counts[m] = total
        per_month_stations[m] = stations
        per_month[m] = smooth_month(hex_ids, centroids, stations, matrices)
        print(f"  ingested {m}: {len(stations)} stations, {total:,} trips")

    # Pool: average each hex's per-month shares (only months where it has signal).
    pooled = {}
    for h in hex_ids:
        if low_signal[h]:
            continue
        ms, cs, cf = [], [], []          # member_share, casual_share, commuter_frac
        eve, wend, late = [], [], []
        vols = []                        # smoothed trip volume (for the vol-weighted rank)
        buckets = {k: [] for k in BUCKETS}
        for m in months:
            sm_tot, sm_mem, sm_cas, _nd, mat = per_month[m][h]
            if sm_tot <= 0:
                continue
            vols.append(sm_tot)
            ms.append(sm_mem / sm_tot)
            cs.append(sm_cas / sm_tot)
            cf.append(window_share(mat, sm_tot, {cell(d, hr) for d in WEEKDAYS for hr in COMMUTE_HOURS}))
            eve.append(window_share(mat, sm_tot, LEGACY_EVENING))
            wend.append(window_share(mat, sm_tot, LEGACY_WEEKEND))
            late.append(window_share(mat, sm_tot, LEGACY_LATE))
            for k, cells in BUCKETS.items():
                buckets[k].append(window_share(mat, sm_tot, cells))
        if not ms:
            # A committed-usable hex with no signal in any pooled month: leave the
            # committed values as-is rather than blanking them.
            pooled[h] = None
            continue
        mean = lambda xs: sum(xs) / len(xs)
        pooled[h] = {
            "member_share": mean(ms),
            "casual_share": mean(cs),
            "commuter_frac": mean(cf),
            "weekday_evening": mean(eve),
            "weekend_day": mean(wend),
            "late_night": mean(late),
            "volume": mean(vols),
            "buckets": {k: mean(v) for k, v in buckets.items()},
        }

    # local_percentile: the damped member share ranked as a **trip-volume-weighted**
    # percentile — a hex's value is the fraction of citywide trip volume in hexes at
    # or below its member share. This is deliberately *not* a plain per-hex rank
    # (which would be uniform 0..1 and paint half the map bright). Volume weighting
    # skews the distribution low, so most cells stay dim and only genuinely strong
    # local cells rise — that skew is what gives the activity surface its structure.
    metric = {}
    for h, p in pooled.items():
        if p is None:
            continue
        metric[h] = p["member_share"] * max(0.0, 1 - COMMUTER_DAMPEN * p["commuter_frac"])
    order = sorted(metric, key=lambda h: metric[h])
    total_vol = sum(pooled[h]["volume"] for h in order) or 1.0
    vw_percentile, cum = {}, 0.0
    for h in order:
        v = pooled[h]["volume"]
        vw_percentile[h] = (cum + v / 2) / total_vol   # midpoint of this hex's volume band
        cum += v

    # visitor_percentile: the casual (non-member) counterpart to local_percentile.
    # Casual trips are the tourist/occasional population; here they become a
    # *positive* signal (not the saturation subtraction they used to be), lifted by
    # the same tourist-anchor proximity boost so the landmark zones that read as
    # voids on the locals map — the park edges, the bridge approaches, the High Line
    # — surface. Ranked as the same volume-weighted, low-skew percentile so most
    # cells stay dim and only real visitor concentrations rise.
    vmetric = {}
    for h, p in pooled.items():
        if p is None:
            continue
        vmetric[h] = min(1.0, p["casual_share"] + tourist_boost(centroids[h]))
    vorder = sorted(vmetric, key=lambda h: vmetric[h])
    visitor_pct, vcum = {}, 0.0
    for h in vorder:
        v = pooled[h]["volume"]
        visitor_pct[h] = (vcum + v / 2) / total_vol
        vcum += v

    # ---- calibrate: report correlations vs committed, then stop ----
    if calibrate:
        import statistics as st
        tgt = {f["properties"]["h3"]: f["properties"] for f in features}

        def corr(pairs):
            xs = [a for a, b in pairs]
            ys = [b for a, b in pairs]
            return st.correlation(xs, ys)
        lp = [(vw_percentile[h], tgt[h]["local_percentile"]) for h in metric]
        sat = [(pooled[h]["casual_share"] + tourist_boost(centroids[h]), tgt[h]["saturation"])
               for h in pooled if pooled[h]]
        mem = [(pooled[h]["member_share"], tgt[h]["member_share"]) for h in pooled if pooled[h]]
        print(f"\ncalibrate vs committed (June logic):")
        print(f"  local_percentile corr = {corr(lp):.4f}")
        print(f"  saturation       corr = {corr(sat):.4f}")
        print(f"  member_share     corr = {corr(mem):.4f}")
        return

    # ---- longitudinal gate + hourly curve (the new rendered signal) ----
    # Station coords are stable across months; prefer the most recent month's
    # median so a relocated dock reads at its current spot.
    stations_union = {}
    for m in months:
        for sid, (lat, lng, *_r) in per_month_stations[m].items():
            stations_union[sid] = (lat, lng)
    usable_hexes = [h for h in hex_ids if not low_signal[h] and pooled.get(h)]
    weeks = complete_weeks(con)
    print(f"Complete weeks for gate: {len(weeks)} "
          f"({weeks[0].date()} … {weeks[-1].date()}), x = {weeks[-1].date()}")
    hex_weights = station_hex_weights(usable_hexes, centroids, stations_union)
    print("Gating weekly member volume against each hex+bucket's own baseline …")
    gates = compute_gates(hex_weights, station_weekly_buckets(con, weeks), weeks)
    print("Building 168-hour member curves …")
    curves = compute_curves(hex_weights, station_curves(con))

    # ---- assemble output properties per hex ----
    def round_bucket(b):
        return {k: round(v, 4) for k, v in b.items()}

    props = {}
    for f in features:
        h = f["properties"]["h3"]
        if low_signal[h]:
            props[h] = {"h3": h, "low_signal": True, "local_percentile": None,
                        "visitor_percentile": None, "saturation": None, "temporal": None}
            continue
        p = pooled[h]
        if p is None:                     # keep committed values, no bucket data
            props[h] = dict(f["properties"])
            continue
        props[h] = {
            "h3": h,
            "low_signal": False,
            "local_percentile": round(vw_percentile[h], 3),
            "visitor_percentile": round(visitor_pct[h], 3),
            "saturation": round(min(1.0, p["casual_share"] + tourist_boost(centroids[h])), 3),
            "member_share": round(p["member_share"], 3),
            "commuter_frac": round(p["commuter_frac"], 3),
            "temporal": {
                "weekday_evening": round(p["weekday_evening"], 3),
                "weekend_day": round(p["weekend_day"], 3),
                "late_night": round(p["late_night"], 3),
            },
            "buckets": round_bucket(p["buckets"]),
            # Task 8: per-bucket longitudinal gate — [z, ratio]. z drives the render
            # existence threshold (downstream, adaptive); ratio ("3.4x") the caption.
            "gz": {k: v[0] for k, v in gates.get(h, {}).items()},
            "gr": {k: v[1] for k, v in gates.get(h, {}).items()},
        }

    # ---- emit geojson (polygons) ----
    out_features = []
    for f in features:
        out_features.append({"type": "Feature", "geometry": f["geometry"],
                             "properties": props[f["properties"]["h3"]]})
    geojson = {"type": "FeatureCollection", "features": out_features}
    OUT_CACHE_GEOJSON.write_text(json.dumps(geojson))
    OUT_PUBLIC_GEOJSON.write_text(json.dumps(geojson))

    # ---- emit hex-index.json (keyed lookup, centroid included for the surface) ----
    index = {}
    for h in hex_ids:
        p = props[h]
        lat, lng = centroids[h]
        entry = {"lat": round(lat, 6), "lng": round(lng, 6), **p}
        del entry["h3"]
        index[h] = entry
    OUT_HEX_INDEX.write_text(json.dumps(index))

    # ---- emit hex-curve.json (168-hour normalized member curve, keyed by hex) ----
    OUT_HEX_CURVE.write_text(json.dumps(curves))
    _gate_report(gates, curves)

    # ---- emit surface.json (fine res-10 wash, retimed by its res-9 parent) ----
    usable_res9 = [h for h in hex_ids if not low_signal[h] and pooled.get(h)]
    res9_commuter = {h: pooled[h]["commuter_frac"] for h in usable_res9}
    print(f"Building fine surface at res-{SURFACE_RES} …")
    surface = build_surface(usable_res9, res9_commuter, per_month_stations, months)
    OUT_SURFACE.write_text(json.dumps(surface))

    _report(months, trip_counts, props, len(surface))


def _gate_report(gates, curves):
    """How many hexes clear common z thresholds per bucket — a sanity glance on
    sparsity before build_streets applies the corridor-level thresholds."""
    print(f"\nHex gate: {len(gates)} hexes gated, {len(curves)} with an hourly curve.")
    print(f"{'bucket':16s}  z≥1.5  z≥2.0  z≥2.5   max z")
    for name in BUCKET_ORDER:
        zs = [g[name][0] for g in gates.values() if name in g]
        n15 = sum(1 for z in zs if z >= 1.5)
        n20 = sum(1 for z in zs if z >= 2.0)
        n25 = sum(1 for z in zs if z >= 2.5)
        print(f"{name:16s}  {n15:5d}  {n20:5d}  {n25:5d}   {max(zs) if zs else 0:5.2f}")


def _report(months, trip_counts, props, surface_cells=0):
    usable = [p for p in props.values() if not p["low_signal"]]
    print(f"\nMonths ingested: {', '.join(months)}")
    for m in months:
        print(f"  {m}: {trip_counts[m]:,} trips")
    print(f"Hexes: {len(props)} ({len(usable)} usable, {len(props) - len(usable)} low_signal)")
    print(f"Fine surface cells (res-{SURFACE_RES}): {surface_cells}")
    print(f"Wrote:\n  {OUT_CACHE_GEOJSON}\n  {OUT_PUBLIC_GEOJSON}\n  {OUT_HEX_INDEX}\n  {OUT_SURFACE}")
    # Citywide mean bucket shares (drives the render multiplier) for a sanity glance.
    keys = list(BUCKETS)
    means = {k: sum(p["buckets"][k] for p in usable if "buckets" in p) /
                max(1, sum(1 for p in usable if "buckets" in p)) for k in keys}
    print("Citywide mean bucket shares:")
    for k in keys:
        print(f"  {k:16s} {means[k]:.4f}")


if __name__ == "__main__":
    build(calibrate="--calibrate" in sys.argv)
