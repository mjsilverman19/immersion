#!/usr/bin/env python3
"""
Prototype / validation — two-axis (local_pull, tourist_pull) surplus model.

Question we're answering BEFORE reshaping the pipeline:
  If we score each hex on TWO independent data-derived axes —
    local_pull   = member  (arrivals - departures) / gross member arrivals
    tourist_pull = casual  (arrivals - departures) / gross casual arrivals
  — do the four quadrants (locals' secret / tourist trap / crossover / dead)
  actually separate, or does everything collapse onto one diagonal?

Reads the same Apr-Jun CSVs as build_hex_index.py, uses END stations (arrivals),
which the current pipeline never touches. Reports quadrant populations and the
cross-axis correlation per daypart. Nothing is written to public/.
"""
import json
import math
from pathlib import Path
import duckdb
import h3

ROOT = Path(__file__).resolve().parent
CSV_DIR = ROOT / ".cache" / "csv"
COMMITTED = ROOT.parent / "public" / "data" / "hexes.geojson"
MONTHS = ["202604", "202605", "202606"]

SMOOTH_SCALE_M = 300.0
SMOOTH_CUTOFF_M = 900.0
LOW_SIGNAL_M = 500.0
GRID_K = 6

# Daypart windows (dow: duckdb dayofweek, 0=Sun..6=Sat). Discretionary cuts.
WINDOWS = {
    "all":          "TRUE",
    "weekend_day":  "dow IN (0,6) AND hr BETWEEN 9 AND 16",
    "wk_evening":   "dow BETWEEN 1 AND 5 AND hr BETWEEN 18 AND 22",
    "late_night":   "hr IN (23,0,1,2,3)",
}

def haversine(a, b):
    R = 6371000.0
    la1, lo1 = math.radians(a[0]), math.radians(a[1])
    la2, lo2 = math.radians(b[0]), math.radians(b[1])
    x = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(x))

def station_events(con, month):
    """Per-station arrival & departure counts by rider type and window, for one month.
       Returns {sid: {'lat','lng', win: {'m_arr','m_dep','c_arr','c_dep'}}}."""
    glob = str(CSV_DIR / f"{month}-*.csv")
    # departures keyed on start_station + started_at; arrivals on end_station + ended_at
    def q(id_col, ts_col, lat_col, lng_col):
        return con.execute(f"""
            SELECT {id_col} AS sid, {lat_col} AS lat, {lng_col} AS lng,
                   dayofweek({ts_col}) AS dow, hour({ts_col}) AS hr,
                   member_casual AS rider, count(*) AS n
            FROM read_csv_auto('{glob}', ignore_errors=true)
            WHERE {id_col} IS NOT NULL AND {ts_col} IS NOT NULL AND {lat_col} IS NOT NULL
            GROUP BY 1,2,3,4,5,6
        """).fetchall()
    st = {}
    coords = {}  # sid -> list of (lat,lng) to median later (cheap: keep running via dict of counts)
    def fold(rows, arr_key, dep_key, is_arr):
        for sid, lat, lng, dow, hr, rider, n in rows:
            if dow is None or hr is None:
                continue
            rec = st.setdefault(sid, {w: {'m_arr':0,'m_dep':0,'c_arr':0,'c_dep':0} for w in WINDOWS})
            coords.setdefault(sid, []).append((lat, lng, n))
            key = ('m_' if rider == 'member' else 'c_') + ('arr' if is_arr else 'dep')
            for w, cond in WINDOWS.items():
                # evaluate window membership in python (small set of conds)
                if _in_window(w, dow, hr):
                    rec[w][key] += n
    dep = q("start_station_id", "started_at", "start_lat", "start_lng")
    arr = q("end_station_id", "ended_at", "end_lat", "end_lng")
    fold(dep, None, None, is_arr=False)
    fold(arr, None, None, is_arr=True)
    # weighted-mean coords per station
    out = {}
    for sid, rec in st.items():
        cs = coords[sid]
        tot = sum(n for _,_,n in cs) or 1
        lat = sum(la*n for la,_,n in cs)/tot
        lng = sum(lo*n for _,lo,n in cs)/tot
        out[sid] = {'lat':lat, 'lng':lng, **rec}
    return out

def _in_window(w, dow, hr):
    if w == "all": return True
    if w == "weekend_day": return dow in (0,6) and 9 <= hr <= 16
    if w == "wk_evening": return 1 <= dow <= 5 and 18 <= hr <= 22
    if w == "late_night": return hr in (23,0,1,2,3)
    return False

def smooth(hex_ids, centroids, stations):
    """Smooth station arr/dep scalars onto hexes with exp distance decay.
       Returns {h3: {win: {m_arr,m_dep,c_arr,c_dep}, 'nearest': m}}."""
    st_by_hex = {}
    for sid, s in stations.items():
        st_by_hex.setdefault(h3.latlng_to_cell(s['lat'], s['lng'], 9), []).append(sid)
    out = {}
    for h in hex_ids:
        c = centroids[h]
        acc = {w: {'m_arr':0.0,'m_dep':0.0,'c_arr':0.0,'c_dep':0.0} for w in WINDOWS}
        nearest = 1e9
        for n in h3.grid_disk(h, GRID_K):
            for sid in st_by_hex.get(n, []):
                s = stations[sid]
                d = haversine(c, (s['lat'], s['lng']))
                nearest = min(nearest, d)
                if d > SMOOTH_CUTOFF_M: continue
                wgt = math.exp(-d/SMOOTH_SCALE_M)
                for w in WINDOWS:
                    for k in ('m_arr','m_dep','c_arr','c_dep'):
                        acc[w][k] += wgt * s[w][k]
        acc['nearest'] = nearest
        out[h] = acc
    return out

def pct_ranks(vals):
    """Map value->percentile in [0,1] via average rank (ties share)."""
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    r = [0.0]*len(vals)
    n = len(vals)
    for rank, i in enumerate(order):
        r[i] = (rank + 0.5)/n
    return r

def main():
    committed = json.load(open(COMMITTED))
    feats = committed["features"]
    hex_ids = [f["properties"]["h3"] for f in feats]
    low_signal = {f["properties"]["h3"]: bool(f["properties"].get("low_signal")) for f in feats}
    centroids = {h: h3.cell_to_latlng(h) for h in hex_ids}

    con = duckdb.connect()
    # pool months: accumulate smoothed scalars, normalize per month then average
    pooled = {h: {w:{'m_arr':[],'m_dep':[],'c_arr':[],'c_dep':[]} for w in WINDOWS} for h in hex_ids}
    nearest = {h: 1e9 for h in hex_ids}
    for m in MONTHS:
        stations = station_events(con, m)
        sm = smooth(hex_ids, centroids, stations)
        for h in hex_ids:
            nearest[h] = min(nearest[h], sm[h]['nearest'])
            for w in WINDOWS:
                for k in ('m_arr','m_dep','c_arr','c_dep'):
                    pooled[h][w][k].append(sm[h][w][k])
        tot = sum(sum(s[w][k] for k in ('m_arr','m_dep','c_arr','c_dep')) for s in stations.values() for w in ['all'])
        print(f"  ingested {m}: {len(stations)} stations")

    usable = [h for h in hex_ids if not low_signal[h] and nearest[h] <= LOW_SIGNAL_M]
    print(f"\nUsable hexes (dock within {LOW_SIGNAL_M:.0f}m): {len(usable)} / {len(hex_ids)}\n")

    mean = lambda xs: sum(xs)/len(xs) if xs else 0.0

    for w in WINDOWS:
        # per-hex pooled arr/dep (mean across months)
        m_arr = {h: mean(pooled[h][w]['m_arr']) for h in usable}
        m_dep = {h: mean(pooled[h][w]['m_dep']) for h in usable}
        c_arr = {h: mean(pooled[h][w]['c_arr']) for h in usable}
        c_dep = {h: mean(pooled[h][w]['c_dep']) for h in usable}

        # two axes: net surplus, normalized by that group's citywide gross arrival scale
        # (so members ~4x casual volume doesn't make the axes incomparable)
        local_surplus   = {h: m_arr[h]-m_dep[h] for h in usable}
        tourist_surplus = {h: c_arr[h]-c_dep[h] for h in usable}
        # gross arrivals (destination popularity, ignores round-trip cancellation)
        local_gross   = {h: m_arr[h] for h in usable}
        tourist_gross = {h: c_arr[h] for h in usable}

        def report(name, la, ta):
            lr = pct_ranks([la[h] for h in usable])
            tr = pct_ranks([ta[h] for h in usable])
            lrank = {h:lr[i] for i,h in enumerate(usable)}
            trank = {h:tr[i] for i,h in enumerate(usable)}
            # correlation of the two ranked axes
            import statistics as sstat
            corr = sstat.correlation([lrank[h] for h in usable],[trank[h] for h in usable])
            HI = 0.66  # top third on an axis = "popular with" that group
            q = {'locals_secret':0,'tourist_trap':0,'crossover':0,'dead':0}
            members = {'locals_secret':[],'tourist_trap':[],'crossover':[]}
            for h in usable:
                lo = lrank[h] >= HI; to = trank[h] >= HI
                if lo and to: q['crossover']+=1; members['crossover'].append(h)
                elif lo: q['locals_secret']+=1; members['locals_secret'].append(h)
                elif to: q['tourist_trap']+=1; members['tourist_trap'].append(h)
                else: q['dead']+=1
            print(f"  [{name:8s}] axis-corr={corr:+.2f}  "
                  f"locals_secret={q['locals_secret']:3d}  crossover={q['crossover']:3d}  "
                  f"tourist_trap={q['tourist_trap']:3d}  dead={q['dead']:3d}")
            return members

        print(f"=== window: {w} ===")
        report("surplus", local_surplus, tourist_surplus)
        mem = report("gross", local_gross, tourist_gross)
        # show a few example centroids per quadrant for the 'gross' model (easier to sanity-name)
        if w in ("all","late_night"):
            for qd in ('locals_secret','crossover','tourist_trap'):
                ex = mem[qd][:4]
                pts = "; ".join(f"({centroids[h][0]:.4f},{centroids[h][1]:.4f})" for h in ex)
                print(f"      {qd:14s}: {pts}")
        print()

if __name__ == "__main__":
    main()
