#!/usr/bin/env python3
"""
Task 7 — Lock the activity tint to street corridors.

The area wash (res-9/res-10 heatmap) reads as diffuse blobs and doesn't answer
"where should I go," because NYC energy lives on commercial corridors — Bedford
Ave, Smith St, St. Marks — not "southern Williamsburg" as a region. This script
replaces the wash with tinted street linework: the ink street grid itself warms
to rust where locals are, and only where a street is *both* in an active hex and
on a venue-bearing corridor.

Source: OpenStreetMap street centerlines (Overpass), the same lineage as the
OpenFreeMap base tiles the app draws, so the tint sits exactly on the ink streets.
Only walkable street classes are pulled — motorways/trunks (the BQE) carry no
tint. Fetched in cached bbox tiles over the venue footprint.

Scoring (per edge = one segment between two OSM nodes):
  intensity     = the containing res-9 hex's local_percentile (the Task 2 index).
                  A point outside the studied footprint (water, parks, New Jersey)
                  has no hex and scores 0.
  venue_density = venues from venues.json within ~50 m of the edge, passed through
                  a soft saturating factor so one venue is a hint and several is a
                  full corridor. A residential street one block off Bedford has no
                  venue within 50 m -> factor 0 -> no tint.
  base weight   = intensity * venue_density_factor. Smoothed along each way so a
                  corridor reads as a continuous line, not a dashed patchwork.

Each surviving run of edges inherits its hex id (`p`), so the client multiplies by
that hex's time-bucket share exactly as the old surface did — the time control
keeps working unchanged. Water, parks, and New Jersey carry no tint by construction
(no venues / no hex).

Output: public/data/streets.geojson — LineString features with properties
  { bw: base weight (time-neutral, 0-1), p: res-9 hex id, name: corridor name }

Usage:
  ./.venv/bin/python build_streets.py            # fetch (cached) + score + emit
  ./.venv/bin/python build_streets.py fetch      # only refresh the OSM tile cache
  ./.venv/bin/python build_streets.py score      # only re-score from cached tiles
"""

import json
import math
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

import h3

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CACHE = ROOT / ".cache"
STREET_CACHE = CACHE / "streets"
VENUES = REPO / "public" / "data" / "venues.json"
HEX_INDEX = REPO / "public" / "data" / "hex-index.json"
OUT = REPO / "public" / "data" / "streets.geojson"
OUT_RUNS = REPO / "public" / "data" / "runs.json"

# --- Fetch --------------------------------------------------------------------
# Walkable corridor classes. Motorway/trunk (BQE, FDR) and their links are the
# opposite of a corridor you walk — deliberately excluded so they stay plain ink.
HIGHWAY_TYPES = (
    "primary", "secondary", "tertiary",
    "residential", "living_street", "unclassified", "pedestrian",
)
# Public Overpass endpoint. We ask its status endpoint for a free slot before
# each call (rather than hammering and eating 429s), so one endpoint is plenty.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
STATUS_URL = "https://overpass-api.de/api/status"
USER_AGENT = "immersion-phase1/1.0 (street activity tint build)"
TILE_DEG = 0.045           # ~5 km tiles: small, fast queries the server answers quick
BBOX_PAD = 0.004           # pad the venue bbox a touch so edge corridors are whole
FETCH_SLEEP_S = 1.5        # polite pacing between Overpass calls
FETCH_RETRY = 6

# --- Scoring (Task 8 refactor) ------------------------------------------------
# The tint no longer inherits a hex *percentile* (a volume rank that lights every
# avenue). It inherits the hex's per-bucket longitudinal gate z from hex-index.json
# — "is this hex unusually active in this bucket vs its own recent baseline." The
# gate decides *existence* (a segment renders only where its hex clears the z
# threshold for the active bucket); the venue-density factor survives only as a
# secondary width damper, not a gate. Output is one all-activity (member) signal —
# no locals/visitors split — plus per-bucket corridor runs for the low-zoom view.
VENUE_RADIUS_M = 50.0       # a street is "on a corridor" if venues sit within this
VENUE_SOFT = 2.5            # soft-saturation scale: vf = 1 - exp(-count/VENUE_SOFT)
SAMPLE_STEP_M = 15.0        # sample spacing along a segment for the venue scan
SEG_TARGET_M = 90.0         # cut ways into ~block-length segments (render granularity)
VF_FLOOR = 0.30             # a segment is an eligible corridor only with >=1 venue
                            # within 50 m (vf(1)=1-exp(-1/2.5)=0.33 > this)

# Selection is *geographically local*, not one global threshold: within each local
# cell (a res-8 H3 tile, ~0.5 km) we light that tile's own top-K corridors by
# trend z. So every populated neighbourhood surfaces its own most-unusual streets
# — the tint spreads across the map instead of collapsing onto whichever borough
# had the biggest week-over-week jump — while staying "alive but selective".
LOCAL_RES = 8               # H3 resolution of the local selection tile (~0.46 km edge)
LOCAL_TOP_K = 3             # light each tile's top-K corridors by z …
LOCAL_MIN_Z = 0.5           # … that also clear this modest above-own-baseline floor
# A selected segment's per-bucket render intensity (0..1) maps z over this range,
# so the hottest corridors render boldest and a just-above-floor one stays faint.
INTENSITY_Z_HI = 3.5
INTENSITY_FLOOR = 0.4
ENDPOINT_ROUND = 5          # decimals (~1 m) for shared-endpoint adjacency

BUCKET_ORDER = [
    "weekday_morning", "weekday_midday", "weekday_evening",
    "weekend_day", "weekend_night", "late",
]

# Local equirectangular projection (meters) about the footprint centroid.
LAT0 = 40.73
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LNG = 111_320.0 * math.cos(math.radians(LAT0))


def to_xy(lat, lng):
    return ((lng - -73.95) * M_PER_DEG_LNG, (lat - LAT0) * M_PER_DEG_LAT)


# ---------------------------------------------------------------------------
# Fetch OSM street centerlines (tiled + cached)
# ---------------------------------------------------------------------------
def venue_bbox():
    venues = json.loads(VENUES.read_text())
    lats = [v["lat"] for v in venues]
    lngs = [v["lng"] for v in venues]
    return (min(lats) - BBOX_PAD, min(lngs) - BBOX_PAD,
            max(lats) + BBOX_PAD, max(lngs) + BBOX_PAD)


def tiles(bbox):
    s, w, n, e = bbox
    lat = s
    while lat < n:
        lng = w
        while lng < e:
            yield (lat, lng, min(lat + TILE_DEG, n), min(lng + TILE_DEG, e))
            lng += TILE_DEG
        lat += TILE_DEG


def wait_for_slot(status_url, cap_s=90):
    """Poll an Overpass status endpoint; block until a slot is free. Overpass
    reports either 'N slots available now' or 'Slot available after: …, in K
    seconds'. Best-effort: any parse failure just returns and we try the call."""
    try:
        req = urllib.request.Request(status_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:
            txt = resp.read().decode()
    except Exception:
        return
    if "slots available now" in txt:
        return
    waits = []
    for line in txt.splitlines():
        if "in" in line and "seconds" in line:
            for tok in line.replace(",", " ").split():
                if tok.lstrip("-").isdigit():
                    waits.append(int(tok))
    if waits:
        time.sleep(min(cap_s, max(1, min(waits) + 1)))


def fetch_tile(tile):
    s, w, n, e = tile
    key = f"{s:.4f}_{w:.4f}_{n:.4f}_{e:.4f}".replace("-", "m")
    cp = STREET_CACHE / f"{key}.json"
    if cp.exists():
        return json.loads(cp.read_text()), True
    types = "|".join(HIGHWAY_TYPES)
    q = (f'[out:json][timeout:90];'
         f'way["highway"~"^({types})$"]({s},{w},{n},{e});'
         f'out geom;')
    data = urllib.parse.quote(q).encode()
    last = None
    for attempt in range(FETCH_RETRY):
        wait_for_slot(STATUS_URL)
        req = urllib.request.Request(
            OVERPASS_URL, data=b"data=" + data, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=150) as resp:
                payload = json.loads(resp.read().decode())
            STREET_CACHE.mkdir(parents=True, exist_ok=True)
            cp.write_text(json.dumps(payload))
            return payload, False
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as ex:
            last = ex
            print(f"    retry {attempt + 1}/{FETCH_RETRY} on {key}: {ex}", flush=True)
            time.sleep(8.0 * (attempt + 1))  # back off progressively
    raise SystemExit(f"Overpass failed for tile {key}: {last}")


def cmd_fetch():
    bbox = venue_bbox()
    tl = list(tiles(bbox))
    print(f"Footprint bbox {bbox}")
    print(f"Fetching {len(tl)} OSM tiles ({'|'.join(HIGHWAY_TYPES)}) …")
    ways, live = {}, 0
    for i, t in enumerate(tl, 1):
        payload, cached = fetch_tile(t)
        if not cached:
            live += 1
            time.sleep(FETCH_SLEEP_S)
        for el in payload.get("elements", []):
            if el.get("type") == "way":
                ways[el["id"]] = el  # dedupe ways spanning tile borders
        if i % 5 == 0 or i == len(tl):
            print(f"  tile {i}/{len(tl)}  ways so far: {len(ways)}  (live {live})")
    print(f"Fetched {len(ways)} unique ways ({live} live tiles, {len(tl) - live} cached).")
    return list(ways.values())


def load_cached_ways():
    if not STREET_CACHE.exists():
        return None
    ways = {}
    for cp in STREET_CACHE.glob("*.json"):
        for el in json.loads(cp.read_text()).get("elements", []):
            if el.get("type") == "way":
                ways[el["id"]] = el
    return list(ways.values()) if ways else None


# ---------------------------------------------------------------------------
# Venue grid index (50 m cells) for fast "venues within radius" scans
# ---------------------------------------------------------------------------
class VenueGrid:
    def __init__(self, venues, cell_m=VENUE_RADIUS_M):
        self.cell = cell_m
        self.pts = [to_xy(v["lat"], v["lng"]) for v in venues]
        self.grid = {}
        for i, (x, y) in enumerate(self.pts):
            self.grid.setdefault((int(x // cell_m), int(y // cell_m)), []).append(i)

    def within(self, x, y, r):
        """Set of venue indices within r meters of (x, y)."""
        cx, cy = int(x // self.cell), int(y // self.cell)
        span = int(math.ceil(r / self.cell))
        r2 = r * r
        hit = set()
        for gx in range(cx - span, cx + span + 1):
            for gy in range(cy - span, cy + span + 1):
                for i in self.grid.get((gx, gy), ()):  # noqa: E501
                    px, py = self.pts[i]
                    if (px - x) ** 2 + (py - y) ** 2 <= r2:
                        hit.add(i)
        return hit


def edge_venue_count(grid, a, b):
    """Unique venues within VENUE_RADIUS_M of the segment a→b (sampled)."""
    (ax, ay), (bx, by) = a, b
    length = math.hypot(bx - ax, by - ay)
    steps = max(1, int(math.ceil(length / SAMPLE_STEP_M)))
    hit = set()
    for s in range(steps + 1):
        t = s / steps
        hit |= grid.within(ax + (bx - ax) * t, ay + (by - ay) * t, VENUE_RADIUS_M)
    return len(hit)


# ---------------------------------------------------------------------------
# Score
# ---------------------------------------------------------------------------
def load_hex_gates():
    """h3 res-9 id -> {gz, gr, vs} for usable, gated hexes. A segment inherits its
    parent hex's per-bucket gate z (`gz`, drives existence) and ratio (`gr`, the
    caption); `vs` is the retained visitor_percentile — metadata only, no layer."""
    index = json.loads(HEX_INDEX.read_text())
    out = {}
    for hid, e in index.items():
        if e.get("low_signal") or not e.get("gz"):
            continue
        out[hid] = {"gz": e["gz"], "gr": e.get("gr", {}),
                    "vs": float(e.get("visitor_percentile") or 0.0)}
    return out


def segmentize(pts):
    """Cut a way's point list into ~SEG_TARGET_M block-length pieces (each a list of
    (lat,lng)). Original vertices are kept; a cut lands at the first vertex past the
    target length, so segments are the render/run granularity."""
    if len(pts) < 2:
        return []
    segs, cur, acc = [], [pts[0]], 0.0
    for i in range(len(pts) - 1):
        (ax, ay), (bx, by) = to_xy(*pts[i]), to_xy(*pts[i + 1])
        acc += math.hypot(bx - ax, by - ay)
        cur.append(pts[i + 1])
        if acc >= SEG_TARGET_M and i < len(pts) - 2:
            segs.append(cur)
            cur, acc = [pts[i + 1]], 0.0
    if len(cur) >= 2:
        segs.append(cur)
    return segs


def seg_venue_count(grid, xy):
    """Unique venues within VENUE_RADIUS_M of a multi-point segment (sampled)."""
    hit = set()
    for i in range(len(xy) - 1):
        (ax, ay), (bx, by) = xy[i], xy[i + 1]
        length = math.hypot(bx - ax, by - ay)
        steps = max(1, int(math.ceil(length / SAMPLE_STEP_M)))
        for s in range(steps + 1):
            t = s / steps
            hit |= grid.within(ax + (bx - ax) * t, ay + (by - ay) * t, VENUE_RADIUS_M)
    return len(hit)


def _endkey(latlng):
    return (round(latlng[0], ENDPOINT_ROUND), round(latlng[1], ENDPOINT_ROUND))


def _intensity(z):
    """Map a segment's trend z to a 0..1 render intensity (INTENSITY_FLOOR at the
    selection floor, 1.0 at INTENSITY_Z_HI) so hotter corridors render boldest."""
    t = (z - LOCAL_MIN_Z) / max(1e-6, INTENSITY_Z_HI - LOCAL_MIN_Z)
    t = max(0.0, min(1.0, t))
    return round(INTENSITY_FLOOR + (1 - INTENSITY_FLOOR) * t, 3)


def cmd_score(ways):
    venues = json.loads(VENUES.read_text())
    grid = VenueGrid(venues)
    gates = load_hex_gates()
    print(f"Scoring {len(ways)} ways against {len(venues)} venues "
          f"and {len(gates)} gated hexes …")

    # 1) Emit the eligible-corridor universe: every ~block segment that sits in a
    #    gated hex AND has at least one venue within 50 m. Major avenues are *in*
    #    this set — they're gated out per-bucket by their own flat trend, not by
    #    exclusion here. This is the "N of M" denominator.
    features, feat_by_id, seg_records = [], {}, []
    sid = 0
    for w in ways:
        geom = w.get("geometry")
        if not geom or len(geom) < 2:
            continue
        name = (w.get("tags") or {}).get("name")
        pts = [(g["lat"], g["lon"]) for g in geom]
        for seg in segmentize(pts):
            xy = [to_xy(la, lo) for la, lo in seg]
            mlat = sum(p[0] for p in seg) / len(seg)
            mlng = sum(p[1] for p in seg) / len(seg)
            hid = h3.latlng_to_cell(mlat, mlng, 9)
            g = gates.get(hid)
            if g is None:
                continue
            vf = 1.0 - math.exp(-seg_venue_count(grid, xy) / VENUE_SOFT)
            if vf < VF_FLOOR:
                continue
            sid += 1
            seg_id = f"{w['id']}-{sid}"
            line = [[round(lo, 6), round(la, 6)] for la, lo in seg]
            props = {"id": seg_id, "p": hid, "vf": round(vf, 3), "vs": round(g["vs"], 3)}
            if name:
                props["name"] = name
            feat = {"type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": line},
                    "properties": props}
            features.append(feat)
            feat_by_id[seg_id] = feat
            seg_records.append({"id": seg_id, "p": hid, "name": name, "line": line,
                                "ends": (_endkey(seg[0]), _endkey(seg[-1]))})

    # 2) Per bucket, per local tile: light that tile's top-K corridors by trend z
    #    (above a modest floor), chain them into runs, and record each segment's
    #    per-bucket render intensity (`gi`) so the client lights exactly this set
    #    and the hottest corridors render boldest.
    from collections import defaultdict
    tiles = defaultdict(list)
    for r in seg_records:
        tiles[h3.cell_to_parent(r["p"], LOCAL_RES)].append(r)

    runs_out = {"total_segments": len(seg_records), "buckets": {}}
    gi_by_seg = {r["id"]: {} for r in seg_records}
    for bucket in BUCKET_ORDER:
        zed = {r["id"]: float(gates[r["p"]]["gz"].get(bucket, 0.0)) for r in seg_records}
        selected = []
        for members in tiles.values():
            ranked = sorted(members, key=lambda r: zed[r["id"]], reverse=True)
            for r in ranked[:LOCAL_TOP_K]:
                if zed[r["id"]] >= LOCAL_MIN_Z:
                    selected.append(r)
        # Runs chain adjacent selected segments; no lone-cull here — one strong
        # corridor is a legitimate result for a quiet neighbourhood.
        runs = build_runs(selected, zed, gates, bucket, cull_lone=False)
        shown = {r["id"] for r in selected}
        for r in selected:
            gi_by_seg[r["id"]][bucket] = _intensity(zed[r["id"]])
        runs_out["buckets"][bucket] = {
            "threshold": LOCAL_MIN_Z, "shown": len(shown), "runs": runs}
    for sid_, gi in gi_by_seg.items():
        if gi:
            feat_by_id[sid_]["properties"]["gi"] = gi

    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    OUT_RUNS.write_text(json.dumps(runs_out))
    _report(seg_records, runs_out)


def build_runs(segs, zed, gates, bucket, cull_lone=True):
    """Chain selected segments that share an endpoint into corridor runs (street
    name not required — an intersection is enough). Returns runs hottest-first."""
    from collections import Counter, defaultdict
    parent = {r["id"]: r["id"] for r in segs}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    by_end = defaultdict(list)
    for r in segs:
        by_end[r["ends"][0]].append(r["id"])
        by_end[r["ends"][1]].append(r["id"])
    for ids in by_end.values():
        for j in range(1, len(ids)):
            union(ids[0], ids[j])

    comps = defaultdict(list)
    for r in segs:
        comps[find(r["id"])].append(r)

    runs = []
    for members in comps.values():
        peak_z = max(zed[m["id"]] for m in members)
        if cull_lone and len(members) == 1 and peak_z < LOCAL_MIN_Z:
            continue
        names = [m["name"] for m in members if m["name"]]
        anchor = Counter(names).most_common(1)[0][0] if names else None
        peak_ratio = max(float(gates[m["p"]]["gr"].get(bucket, 0.0)) for m in members)
        runs.append({
            "seg_ids": [m["id"] for m in members],
            "blocks": len(members),
            "peak_z": round(peak_z, 2),
            "peak_ratio": round(peak_ratio, 2),
            "name": anchor,
            "coords": [m["line"] for m in members],  # MultiLineString parts
        })
    runs.sort(key=lambda r: -r["peak_z"])
    return runs


def _report(seg_records, runs_out):
    size = OUT.stat().st_size
    runs_size = OUT_RUNS.stat().st_size
    print(f"\nEmitted {len(seg_records)} eligible corridor segments "
          f"-> {OUT.relative_to(REPO)} ({size / 1_048_576:.2f} MB)")
    print(f"Runs -> {OUT_RUNS.relative_to(REPO)} ({runs_size / 1024:.0f} KB)")
    print(f"\n{'bucket':16s}  shown  thresh   runs   top corridors")
    for bucket in BUCKET_ORDER:
        b = runs_out["buckets"][bucket]
        top = b["runs"][:5]
        head = ", ".join(
            f"{r['name'] or '(unnamed)'} [{r['blocks']}blk z{r['peak_z']} {r['peak_ratio']}x]"
            for r in top[:3]
        )
        print(f"{bucket:16s}  {b['shown']:5d}  {b['threshold']:5.2f}  {len(b['runs']):5d}   {head}")
    # Full top-5 for the three buckets the brief asks to validate.
    for bucket in ("weekday_midday", "weekday_evening", "weekend_night"):
        print(f"\nTop 5 runs — {bucket} (of {len(seg_records)} segments, "
              f"{runs_out['buckets'][bucket]['shown']} shown):")
        for r in runs_out["buckets"][bucket]["runs"][:5]:
            print(f"  z{r['peak_z']:4.1f}  {r['peak_ratio']:.2f}x  {r['blocks']:2d} blk  "
                  f"{r['name'] or '(unnamed run)'}")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "fetch":
        cmd_fetch()
    elif cmd == "score":
        ways = load_cached_ways()
        if not ways:
            sys.exit("No cached OSM tiles. Run `fetch` first.")
        cmd_score(ways)
    elif cmd == "all":
        cmd_score(cmd_fetch())  # fetch is per-tile cached; fills any missing tiles
    else:
        sys.exit(f"Unknown command: {cmd}. Use fetch | score | all.")


if __name__ == "__main__":
    main()
