#!/usr/bin/env python3
"""
Task 3 — Build the scored venue layer.

Reads Task 2's hex output (h3, local_percentile, saturation, temporal signature),
selects the top + a stratified mid-tier sample of hexes, queries Google Places
Nearby Search per category, scores each venue, attaches a temporal note, and emits
/data/venues.json.

Usage:
  python build_venues.py select      # dry run: hex selection + Places call/cost estimate (no API key needed)
  python build_venues.py fetch       # query Places Nearby Search (needs GOOGLE_PLACES_API_KEY), caches raw JSON to disk
  python build_venues.py score       # score cached responses -> data/venues.json (offline, no key)
  python build_venues.py all         # fetch + score

Environment:
  GOOGLE_PLACES_API_KEY   Google Places API (new / v1) key. Same key the Task 1 edge function uses.

Notes:
  - Raw Places responses are cached under pipeline/.cache/places/ so reruns are free.
  - Output stores ratings-derived scores and basic facts only. No photo references, no review text.
"""

import json
import os
import sys
import time
import math
import urllib.request
import urllib.error
from pathlib import Path

import h3

# ---------------------------------------------------------------------------
# Paths & config
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
CACHE = ROOT / ".cache"
PLACES_CACHE = CACHE / "places"
HEXES_GEOJSON = CACHE / "hexes.geojson"
HEX_VIEWER = CACHE / "hex-viewer.html"
OUT = REPO / "data" / "venues.json"

# Hex selection
N_TOP = 130          # top hexes by local_percentile
N_MID = 70           # stratified mid-tier hexes (so the map isn't empty outside the best areas)
MID_BANDS = [(0.35, 0.55), (0.55, 0.75)]  # local_percentile bands to sample mid-tier from

# Places Nearby Search
SEARCH_RADIUS_M = 260          # res-9 hex edge ~200m; cover the cell from its center
MAX_RESULTS = 20               # new Places API Nearby Search caps at 20
CATEGORIES = {
    "restaurant": ["restaurant"],
    "bar": ["bar"],
    "cafe": ["cafe"],
    "park": ["park"],
    "museum": ["museum", "art_gallery"],
}
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.primaryType",
    "places.types",
    "places.regularOpeningHours.openNow",
    "places.regularOpeningHours.weekdayDescriptions",
    "places.addressComponents",  # for neighborhood attribution (validation only)
])
RATE_SLEEP_S = 0.12            # polite pacing between calls

# Scoring
PRIOR_STRENGTH = 75.0          # Bayesian shrinkage prior weight (~50-100 ratings)
BLEND_LOCAL = 0.60             # weight on hex local_percentile
BLEND_QUALITY = 0.40           # weight on venue quality term
SAT_PENALTY_CAP = 0.15         # max subtractive penalty (in 0-1 index space) => 15 points
SAT_FLOOR = 0.20               # saturation below this incurs no penalty
SAT_CEIL = 0.50               # saturation at/above this incurs the full cap

PRICE_TIERS = {
    "PRICE_LEVEL_FREE": "free",
    "PRICE_LEVEL_INEXPENSIVE": "$",
    "PRICE_LEVEL_MODERATE": "$$",
    "PRICE_LEVEL_EXPENSIVE": "$$$",
    "PRICE_LEVEL_VERY_EXPENSIVE": "$$$$",
}

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Small temporal-note vocabulary (6-8 phrases), assigned from the hex signature.
NOTE_LATE_NIGHT = "LATE NIGHT CROWD"
NOTE_WEEKEND = "WEEKEND MORNINGS"
NOTE_LOCALS_WEEKNIGHT = "LOCALS HERE WEEKNIGHTS"
NOTE_AFTER_WORK = "AFTER-WORK WEEKNIGHTS"
NOTE_COMMUTER = "WEEKDAY COMMUTER HUB"
NOTE_REGULARS = "NEIGHBORHOOD REGULARS"
NOTE_STEADY = "STEADY ALL WEEK"


# ---------------------------------------------------------------------------
# Hex loading (Task 2 output)
# ---------------------------------------------------------------------------
def extract_hexes_from_viewer():
    """Fallback: pull the embedded HEXES FeatureCollection out of the Task 2 viewer HTML."""
    html = HEX_VIEWER.read_text(encoding="utf-8")
    i = html.index("const HEXES = ") + len("const HEXES = ")
    obj, _ = json.JSONDecoder().raw_decode(html, i)
    HEXES_GEOJSON.write_text(json.dumps(obj))
    return obj


def load_hexes():
    if HEXES_GEOJSON.exists():
        gj = json.loads(HEXES_GEOJSON.read_text())
    elif HEX_VIEWER.exists():
        gj = extract_hexes_from_viewer()
    else:
        sys.exit("No hex data found (expected .cache/hexes.geojson or .cache/hex-viewer.html from Task 2).")

    hexes = {}
    for f in gj["features"]:
        p = f["properties"]
        if p.get("low_signal") or p.get("local_percentile") is None:
            continue
        h = p["h3"]
        lat, lng = h3.cell_to_latlng(h)
        t = p.get("temporal", {}) or {}
        hexes[h] = {
            "h3": h,
            "lat": lat,
            "lng": lng,
            "local_percentile": float(p["local_percentile"]),
            "saturation": float(p["saturation"]),
            "member_share": float(p.get("member_share") or 0.0),
            "commuter_frac": float(p.get("commuter_frac") or 0.0),
            "weekday_evening": float(t.get("weekday_evening") or 0.0),
            "weekend_day": float(t.get("weekend_day") or 0.0),
            "late_night": float(t.get("late_night") or 0.0),
        }
    return hexes


# ---------------------------------------------------------------------------
# Temporal notes — corpus-relative so the vocabulary stays varied
# ---------------------------------------------------------------------------
def _pct_ranker(values):
    """Return f(x) -> percentile rank (0-1) of x within `values`."""
    srt = sorted(values)
    n = len(srt)

    def rank(x):
        # fraction of corpus <= x
        lo, hi = 0, n
        while lo < hi:
            mid = (lo + hi) // 2
            if srt[mid] <= x:
                lo = mid + 1
            else:
                hi = mid
        return lo / n if n else 0.0
    return rank


def assign_temporal_notes(hexes):
    rk_late = _pct_ranker([h["late_night"] for h in hexes.values()])
    rk_wend = _pct_ranker([h["weekend_day"] for h in hexes.values()])
    rk_eve = _pct_ranker([h["weekday_evening"] for h in hexes.values()])
    rk_comm = _pct_ranker([h["commuter_frac"] for h in hexes.values()])
    rk_mem = _pct_ranker([h["member_share"] for h in hexes.values()])

    for h in hexes.values():
        late, wend, eve = rk_late(h["late_night"]), rk_wend(h["weekend_day"]), rk_eve(h["weekday_evening"])
        comm, mem = rk_comm(h["commuter_frac"]), rk_mem(h["member_share"])
        if late >= 0.85:
            note = NOTE_LATE_NIGHT
        elif wend >= 0.80:
            note = NOTE_WEEKEND
        elif eve >= 0.80 and mem >= 0.50:
            note = NOTE_LOCALS_WEEKNIGHT
        elif eve >= 0.75:
            note = NOTE_AFTER_WORK
        elif comm >= 0.80:
            note = NOTE_COMMUTER
        elif mem >= 0.75:
            note = NOTE_REGULARS
        else:
            note = NOTE_STEADY
        h["temporal_note"] = note
    return hexes


# ---------------------------------------------------------------------------
# Hex selection
# ---------------------------------------------------------------------------
def select_hexes(hexes):
    ordered = sorted(hexes.values(), key=lambda h: -h["local_percentile"])
    top = ordered[:N_TOP]
    top_ids = {h["h3"] for h in top}

    # Stratified mid-tier sample: evenly stride each band so it's spatially spread.
    mid = []
    per_band = max(1, N_MID // len(MID_BANDS))
    for lo, hi in MID_BANDS:
        band = [h for h in hexes.values() if lo <= h["local_percentile"] < hi and h["h3"] not in top_ids]
        band.sort(key=lambda h: (h["lat"], h["lng"]))  # deterministic spatial ordering
        if not band:
            continue
        stride = max(1, len(band) // per_band)
        picked = band[::stride][:per_band]
        mid.extend(picked)
        top_ids.update(h["h3"] for h in picked)

    selected = top + mid
    return selected, top, mid


# ---------------------------------------------------------------------------
# Places Nearby Search (new / v1)
# ---------------------------------------------------------------------------
def cache_path(h3id, cat):
    return PLACES_CACHE / f"{h3id}_{cat}.json"


def fetch_nearby(api_key, hexrec, cat, included_types):
    cp = cache_path(hexrec["h3"], cat)
    if cp.exists():
        return json.loads(cp.read_text()), True  # cached

    body = json.dumps({
        "includedTypes": included_types,
        "maxResultCount": MAX_RESULTS,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": hexrec["lat"], "longitude": hexrec["lng"]},
                "radius": SEARCH_RADIUS_M,
            }
        },
    }).encode()

    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchNearby",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise SystemExit(f"Places API error {e.code} for {hexrec['h3']}/{cat}: {detail}")

    PLACES_CACHE.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps(data))
    return data, False


def cmd_fetch(hexes):
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        sys.exit("GOOGLE_PLACES_API_KEY not set. Export it (or add it to a .env you source) and rerun `fetch`.")

    selected, top, mid = select_hexes(hexes)
    total = len(selected) * len(CATEGORIES)
    print(f"Fetching {len(selected)} hexes x {len(CATEGORIES)} categories = {total} Nearby Search calls")
    done = calls = cached = 0
    for hx in selected:
        for cat, types in CATEGORIES.items():
            _, was_cached = fetch_nearby(api_key, hx, cat, types)
            done += 1
            if was_cached:
                cached += 1
            else:
                calls += 1
                time.sleep(RATE_SLEEP_S)
            if done % 50 == 0:
                print(f"  {done}/{total}  (live {calls}, cached {cached})")
    print(f"Done. {calls} live calls, {cached} served from cache.")


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def bayesian_quality(rating, n, cat_mean):
    """Shrink a Google rating toward its category mean; weak-evidence ratings regress."""
    if rating is None or n is None:
        return cat_mean * 0.85  # unknown-quality prior: slightly below the mean
    return (PRIOR_STRENGTH * cat_mean + n * rating) / (PRIOR_STRENGTH + n)


def saturation_penalty(sat):
    frac = (sat - SAT_FLOOR) / (SAT_CEIL - SAT_FLOOR)
    frac = max(0.0, min(1.0, frac))
    return SAT_PENALTY_CAP * frac


# ---------------------------------------------------------------------------
# Hours parsing + factual note
#
# Google returns human strings like "Monday: 11:00 AM – 10:00 PM", one per day
# starting Monday, with unicode narrow/thin spaces. We parse them into a compact
# per-day structure (open/close in minutes-from-midnight, close may exceed 1440
# for after-midnight closings) and derive one honest, template-based note from
# the *structure* — never inventing a fact the hours don't support.
# ---------------------------------------------------------------------------
def _clean_hours_str(s):
    # Normalise the unicode spacing Google uses: narrow no-break space ( ),
    # thin space ( ), and the en-dash separator.
    return (s.replace(" ", " ").replace(" ", " ")
             .replace("–", "-").replace("—", "-"))


def _parse_time(tok, ampm_hint):
    """Parse '11:00 AM' / '5:00' -> minutes from midnight. ampm_hint fills a
    missing AM/PM from the range's other side (Google drops it on open times)."""
    tok = tok.strip()
    ampm = ampm_hint
    m = tok.upper().rsplit(" ", 1)
    if len(m) == 2 and m[1] in ("AM", "PM"):
        tok, ampm = m[0].strip(), m[1]
    if ":" in tok:
        h, mn = tok.split(":", 1)
    else:
        h, mn = tok, "0"
    try:
        h, mn = int(h), int(mn)
    except ValueError:
        return None
    if ampm == "PM" and h != 12:
        h += 12
    elif ampm == "AM" and h == 12:
        h = 0
    return h * 60 + mn


def parse_hours(weekday_descriptions):
    """Return a 7-element list (Mon..Sun) of day records:
       {"d": "Mon", "ranges": [[open, close], ...], "closed": bool, "allDay": bool}
    or None when there is nothing parseable."""
    if not weekday_descriptions:
        return None
    by_day = {}
    for raw in weekday_descriptions:
        s = _clean_hours_str(raw)
        if ":" not in s:
            continue
        day, rest = s.split(":", 1)
        day = day.strip()[:3].title()
        rest = rest.strip()
        rec = {"d": day, "ranges": [], "closed": False, "allDay": False}
        if rest.lower().startswith("closed"):
            rec["closed"] = True
        elif "24 hours" in rest.lower():
            rec["allDay"] = True
            rec["ranges"] = [[0, 1440]]
        else:
            for span in rest.split(","):
                if "-" not in span:
                    continue
                left, right = span.split("-", 1)
                # AM/PM hint flows from the close time back to the open time.
                right = right.strip()
                hint = None
                up = right.upper()
                if up.endswith("AM"):
                    hint = "AM"
                elif up.endswith("PM"):
                    hint = "PM"
                o = _parse_time(left, hint)
                c = _parse_time(right, None)
                if o is None or c is None:
                    continue
                if c <= o:  # closes after midnight
                    c += 1440
                rec["ranges"].append([o, c])
        by_day[day] = rec
    if not by_day:
        return None
    return [by_day.get(d, {"d": d, "ranges": [], "closed": True, "allDay": False}) for d in DAYS]


def compact_hours(hours):
    """Shrink the parsed structure for the wire: a 7-element list (Mon..Sun),
    each element `null` when closed or a list of [open, close] minute pairs."""
    if not hours:
        return None
    out = []
    for d in hours:
        out.append(None if (d["closed"] or not d["ranges"]) else d["ranges"])
    return out


def _fmt_hour(minutes):
    """Minutes-from-midnight (possibly >1440) -> friendly hour like '2am', '9pm'."""
    m = minutes % 1440
    h, mn = divmod(m, 60)
    suffix = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    return f"{h12}:{mn:02d}{suffix}" if mn else f"{h12}{suffix}"


def hours_note(hours):
    """One honest, lowercase, template-based line from the hours structure, or
    None when the hours say nothing worth a text message. Friend-voice: brief,
    no superlatives, no title case."""
    if not hours:
        return None
    open_days = [d for d in hours if not d["closed"] and d["ranges"]]
    if not open_days:
        return None

    idx = {d["d"]: d for d in hours}

    # Open around the clock, every day.
    if all(d["allDay"] for d in hours):
        return "open around the clock"

    # Closed on one or two specific days (a genuinely useful heads-up).
    closed = [d["d"] for d in hours if d["closed"]]
    if len(closed) == 1:
        plural = {"Mon": "mondays", "Tue": "tuesdays", "Wed": "wednesdays",
                  "Thu": "thursdays", "Fri": "fridays", "Sat": "saturdays", "Sun": "sundays"}
        return f"closed {plural[closed[0]]}"
    if len(closed) == 2:
        return f"closed {closed[0].lower()} and {closed[1].lower()}"

    def latest_close(day):
        return max((r[1] for r in day["ranges"]), default=0)

    def earliest_open(day):
        return min((r[0] for r in day["ranges"]), default=1440)

    # Late on weekends but not on weekdays -> a real weekend-vs-weekday signal.
    wknd = [idx[x] for x in ("Fri", "Sat") if not idx[x]["closed"] and idx[x]["ranges"]]
    wkdy = [idx[x] for x in ("Mon", "Tue", "Wed", "Thu") if not idx[x]["closed"] and idx[x]["ranges"]]
    wknd_late = wknd and all(latest_close(d) >= 1440 + 60 for d in wknd)   # past 1am
    wkdy_late = wkdy and all(latest_close(d) >= 1440 + 60 for d in wkdy)
    if wknd_late and not wkdy_late:
        return "open late on weekends"

    # Late most nights.
    late_nights = sum(1 for d in open_days if latest_close(d) >= 23 * 60)
    if late_nights >= 4:
        return "open late most nights"

    # Evenings only (every open day starts at/after 4pm).
    if all(earliest_open(d) >= 16 * 60 for d in open_days):
        opens = min(earliest_open(d) for d in open_days)
        return f"opens at {_fmt_hour(opens)}, evenings only"

    # Daytime spot that's closed by mid-afternoon every open day.
    if all(latest_close(d) <= 15 * 60 for d in open_days):
        return "daytime only, closed by mid-afternoon"

    return None


def cmd_score(hexes):
    assign_temporal_notes(hexes)

    # 1) Gather unique venues from every cached response, tagging each with the
    #    category it was discovered under and its containing hex.
    raw = {}  # place_id -> record
    files = sorted(PLACES_CACHE.glob("*.json"))
    if not files:
        sys.exit("No cached Places responses found. Run `fetch` first.")

    for fp in files:
        h3id, cat = fp.stem.rsplit("_", 1)
        data = json.loads(fp.read_text())
        for pl in data.get("places", []):
            pid = pl.get("id")
            if not pid:
                continue
            loc = pl.get("location") or {}
            lat, lng = loc.get("latitude"), loc.get("longitude")
            if lat is None or lng is None:
                continue
            # True containing hex; fall back to the query hex so hex_id is always valid.
            true_h = h3.latlng_to_cell(lat, lng, 9)
            hexrec = hexes.get(true_h) or hexes.get(h3id)
            if hexrec is None:
                continue
            rec = raw.get(pid)
            if rec is None:
                rec = {
                    "id": pid,
                    "name": (pl.get("displayName") or {}).get("text"),
                    "lat": lat,
                    "lng": lng,
                    "rating": pl.get("rating"),
                    "n": pl.get("userRatingCount"),
                    "price_level": pl.get("priceLevel"),
                    "primary_type": pl.get("primaryType"),
                    "types": pl.get("types") or [],
                    "weekday_descriptions": (
                        (pl.get("regularOpeningHours") or {}).get("weekdayDescriptions")
                    ),
                    "hex": hexrec,
                    "categories": set(),
                    "neighborhood": _neighborhood(pl),
                }
                raw[pid] = rec
            rec["categories"].add(cat)

    # 2) Assign each venue a single display category (first match by our priority)
    #    and compute category rating means for the Bayesian prior.
    cat_priority = ["restaurant", "bar", "cafe", "park", "museum"]
    for rec in raw.values():
        rec["category"] = next((c for c in cat_priority if c in rec["categories"]), sorted(rec["categories"])[0])

    cat_ratings = {}
    for rec in raw.values():
        if rec["rating"] is not None and rec["n"]:
            cat_ratings.setdefault(rec["category"], []).append(rec["rating"])
    cat_mean = {c: (sum(v) / len(v)) for c, v in cat_ratings.items()}
    global_mean = sum(cat_mean.values()) / len(cat_mean) if cat_mean else 4.2

    # 3) Quality term -> category-relative percentile (comparable across categories).
    for rec in raw.values():
        m = cat_mean.get(rec["category"], global_mean)
        rec["q_raw"] = bayesian_quality(rec["rating"], rec["n"], m)

    q_by_cat = {}
    for rec in raw.values():
        q_by_cat.setdefault(rec["category"], []).append(rec["q_raw"])
    q_rankers = {c: _pct_ranker(vs) for c, vs in q_by_cat.items()}

    # 4) Blend + saturation penalty -> index_score (0-100).
    venues = []
    for rec in raw.values():
        q01 = q_rankers[rec["category"]](rec["q_raw"])
        lp = rec["hex"]["local_percentile"]
        core = BLEND_LOCAL * lp + BLEND_QUALITY * q01
        idx01 = max(0.0, min(1.0, core - saturation_penalty(rec["hex"]["saturation"])))
        hx = rec["hex"]
        hours = parse_hours(rec.get("weekday_descriptions"))
        note = hours_note(hours)
        venues.append({
            "id": rec["id"],
            "name": rec["name"],
            "lat": round(rec["lat"], 6),
            "lng": round(rec["lng"], 6),
            "category": rec["category"],
            "price_tier": PRICE_TIERS.get(rec["price_level"]),
            "index_score": round(100 * idx01),
            "temporal_note": hx["temporal_note"],
            # Neighbourhood rhythm from the containing hex — powers the "when
            # locals are around" chart on the card. Raw shares, not normalised.
            "temporal_signature": {
                "weekday_evening": round(hx["weekday_evening"], 3),
                "weekend_day": round(hx["weekend_day"], 3),
                "late_night": round(hx["late_night"], 3),
            },
            "hours": compact_hours(hours),
            "factual_note": note,
            "hex_id": hx["h3"],
            "neighborhood": rec["neighborhood"],  # extra: for Task 6 validation
        })

    # Keep venues with a real name; sort best-first for readability.
    venues = [v for v in venues if v["name"]]
    venues.sort(key=lambda v: -v["index_score"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(venues, indent=2))
    _report(venues)


def _neighborhood(pl):
    comps = pl.get("addressComponents") or []
    for want in ("neighborhood", "sublocality_level_1", "sublocality"):
        for c in comps:
            if want in (c.get("types") or []):
                return c.get("longText")
    for c in comps:
        if "locality" in (c.get("types") or []):
            return c.get("longText")
    return None


def _report(venues):
    from collections import Counter
    print(f"\nEmitted {len(venues)} venues -> {OUT.relative_to(REPO)}")
    nbhds = Counter(v["neighborhood"] for v in venues if v["neighborhood"])
    print(f"Neighborhoods represented: {len(nbhds)}")
    cats = Counter(v["category"] for v in venues)
    print("By category:", dict(cats))
    print("\nTop 10 citywide:")
    for v in venues[:10]:
        print(f"  {v['index_score']:3d}  {v['category']:11s} {v['name']}  [{v.get('neighborhood') or '?'}]")
    for cat in ["restaurant", "bar", "cafe", "park", "museum"]:
        cv = [v for v in venues if v["category"] == cat][:5]
        if cv:
            print(f"\nTop 5 {cat}:")
            for v in cv:
                print(f"  {v['index_score']:3d}  {v['name']}  [{v.get('neighborhood') or '?'}]")


# ---------------------------------------------------------------------------
# Dry-run selection + cost estimate
# ---------------------------------------------------------------------------
def cmd_select(hexes):
    assign_temporal_notes(hexes)
    selected, top, mid = select_hexes(hexes)
    calls = len(selected) * len(CATEGORIES)
    cached = sum(1 for hx in selected for cat in CATEGORIES if cache_path(hx["h3"], cat).exists())
    print(f"Hexes available (signal): {len(hexes)}")
    print(f"Selected: {len(selected)}  (top {len(top)} by local_percentile + {len(mid)} stratified mid-tier)")
    print(f"  top local_percentile range:  {top[-1]['local_percentile']:.3f} .. {top[0]['local_percentile']:.3f}")
    if mid:
        lps = [h['local_percentile'] for h in mid]
        print(f"  mid local_percentile range:  {min(lps):.3f} .. {max(lps):.3f}")
    print(f"\nPlaces Nearby Search calls: {len(selected)} hexes x {len(CATEGORIES)} categories = {calls}")
    print(f"  already cached: {cached}   remaining live: {calls - cached}")
    print(f"  est. cost @ $32/1000 (Nearby Search Pro tier): ~${(calls - cached) * 0.032:.2f}")
    from collections import Counter
    notes = Counter(h["temporal_note"] for h in selected)
    print("\nTemporal-note distribution (selected hexes):")
    for note, n in notes.most_common():
        print(f"  {n:4d}  {note}")


# ---------------------------------------------------------------------------
def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "select"
    hexes = load_hexes()
    if cmd == "select":
        cmd_select(hexes)
    elif cmd == "fetch":
        cmd_fetch(hexes)
    elif cmd == "score":
        cmd_score(hexes)
    elif cmd == "all":
        cmd_fetch(hexes)
        cmd_score(hexes)
    else:
        sys.exit(f"Unknown command: {cmd}. Use select | fetch | score | all.")


if __name__ == "__main__":
    main()
