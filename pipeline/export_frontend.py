#!/usr/bin/env python3
"""Export versioned NYC artifacts from immersion_data for the React product.

The exporter is the only code that understands engine column names. It assigns
H3 cells to NTA neighborhoods, derives conservative discovery features from the
venue inventory, validates coverage, and writes a compact frontend contract.
"""

from __future__ import annotations

import csv
import json
import math
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

DAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")
# Engine week arrays (hex_metrics_summary.json A/L/T, category_curves.json) are
# indexed dow*24+hour with dow 0=Mon..6=Sun (see compute_metrics.py and
# build_category_curves.py). Map each frontend day key to its engine day-of-week
# so the sliced hourly metrics and the category curve the client indexes by
# `dayOfWeek` refer to the SAME real day. (Previously the exporter sliced by the
# DAYS tuple's position, which put engine Monday under "sun" and rotated every
# day by one.)
ENGINE_DOW = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
SCHEMA_VERSION = 4
COMPLEMENT_ROLES = ("alongside", "after", "before")
ALLOWED_OUTER = {
    "Greenpoint", "Williamsburg", "South Williamsburg", "East Williamsburg",
    "Long Island City-Hunters Point",
}
CATEGORY_PRIORS = {
    "restaurant": [0.50, 0.50, 0.40, 0.50, 0.60, 0.50],
    "cafe": [0.80, 0.50, 0.20, 0.90, 0.80, 0.30],
    "bar": [0.55, 0.60, 0.30, 0.30, 0.80, 0.55],
    "nightlife": [0.40, 0.65, 0.20, 0.10, 0.70, 0.75],
    "museum": [0.10, 0.40, 0.80, 0.80, 0.70, 0.80],
    "park": [0.90, 0.30, 0.40, 0.90, 0.85, 0.50],
}


def compact_score(value: float) -> int:
    return max(0, min(100, round(float(value))))


def compact_confidence(value: float) -> int:
    return max(0, min(100, round(float(value) * 100)))


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")


def polygon_rings(geometry: dict) -> list[list[list[float]]]:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    if geometry["type"] == "MultiPolygon":
        return [polygon[0] for polygon in geometry["coordinates"]]
    return []


def point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            crossing = (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            if x < crossing:
                inside = not inside
        j = i
    return inside


def centroid(feature: dict) -> tuple[float, float]:
    ring = feature["geometry"]["coordinates"][0]
    points = ring[:-1] if ring and ring[0] == ring[-1] else ring
    return (
        sum(point[0] for point in points) / len(points),
        sum(point[1] for point in points) / len(points),
    )


def build_neighborhood_lookup(nta: dict):
    indexed = []
    for feature in nta["features"]:
        rings = polygon_rings(feature["geometry"])
        coords = [point for ring in rings for point in ring]
        if not coords:
            continue
        indexed.append({
            "name": feature["properties"].get("ntaname"),
            "borough": feature["properties"].get("boro"),
            "rings": rings,
            "bbox": (
                min(point[0] for point in coords), min(point[1] for point in coords),
                max(point[0] for point in coords), max(point[1] for point in coords),
            ),
        })

    def lookup(lng: float, lat: float) -> tuple[str | None, str | None]:
        for item in indexed:
            x0, y0, x1, y1 = item["bbox"]
            if x0 <= lng <= x1 and y0 <= lat <= y1 and any(
                point_in_ring(lng, lat, ring) for ring in item["rings"]
            ):
                return item["name"], item["borough"]
        return None, None
    return lookup


def in_coverage(neighborhood: str | None, borough: str | None, lat: float) -> bool:
    if borough == "Manhattan":
        return lat <= 40.798
    return neighborhood in ALLOWED_OUTER


def load_venue_rows(source: Path) -> list[dict]:
    with (source / "venues_final.csv").open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def export_geometry(source: Path, output: Path, venue_rows: list[dict]) -> set[str]:
    geometry = json.loads((source / "hexes.geojson").read_text())
    nta = json.loads((source / "nta.geojson").read_text())
    lookup = build_neighborhood_lookup(nta)
    by_hex: dict[str, list[dict]] = defaultdict(list)
    for venue in venue_rows:
        by_hex[venue["hex_id"]].append(venue)

    retained = []
    retained_ids: set[str] = set()
    max_count = max((len(rows) for rows in by_hex.values()), default=1)
    for feature in geometry["features"]:
        lng, lat = centroid(feature)
        neighborhood, borough = lookup(lng, lat)
        if not in_coverage(neighborhood, borough, lat):
            continue
        h3 = feature["properties"]["h3"]
        rows = by_hex.get(h3, [])
        categories = Counter(row["category"] for row in rows)
        total = len(rows)
        diversity = len(categories) / max(1, len(CATEGORY_PRIORS))
        anchor = (max(categories.values()) / total) if total else 0
        density = math.log1p(total) / math.log1p(max_count)
        feature["id"] = h3
        feature["properties"] = {
            "h3": h3,
            "neighborhoodId": neighborhood,
            "borough": borough,
            "features": {
                "venueDensity": round(density, 3),
                "categoryDiversity": round(diversity, 3),
                "foodDensity": round(categories["restaurant"] / max_count, 3),
                "drinkDensity": round(categories["bar"] / max_count, 3),
                "coffeeDensity": round(categories["cafe"] / max_count, 3),
                "cultureDensity": round(categories["museum"] / max_count, 3),
                "nightlifeDensity": round(categories["nightlife"] / max_count, 3),
                "outdoorDensity": round(categories["park"] / max_count, 3),
                "wanderingScore": round(min(1, 0.55 * density + 0.45 * diversity), 3),
                "anchorConcentration": round(anchor, 3),
                "venueCount": total,
                "evidenceConfidence": round(min(1, total / 5), 2),
            },
        }
        retained.append(feature)
        retained_ids.add(h3)
    if not retained:
        raise SystemExit("coverage validation removed every hex")
    write_json(output / "hexes.geojson", {"type": "FeatureCollection", "features": retained})
    return retained_ids


def export_metrics(source: Path, output: Path, retained_ids: set[str]) -> dict[str, str]:
    raw = json.loads((source / "hex_metrics_summary.json").read_text())
    missing = retained_ids.difference(raw)
    if missing:
        raise SystemExit(f"{len(missing)} retained hexes have no metrics")
    metric_files: dict[str, str] = {}
    for day in DAYS:
        dow = ENGINE_DOW[day]
        start, stop = dow * 24, dow * 24 + 24
        records = {}
        for h3 in retained_ids:
            record = raw[h3]
            records[h3] = [
                [compact_score(v) for v in record["A"][start:stop]],
                [compact_score(v) for v in record["L"][start:stop]],
                [compact_score(v) for v in record["T"][start:stop]],
                [compact_confidence(record.get("conf_A", 0)), compact_confidence(record.get("conf_L", 0)), compact_confidence(record.get("conf_T", 0))],
            ]
        filename = f"hex_metrics-{day}.json"
        write_json(output / filename, {"dayOfWeek": dow, "intervalMinutes": 60, "records": records})
        metric_files[day] = filename
    return metric_files


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-30.0, min(30.0, z))))


def feature_scores(row: dict, fingerprint: dict | None, hex_confidence: float) -> dict:
    """Per-venue taste features for the client, derived from the engine's place
    fingerprint instead of a static per-category prior — so two venues in the
    same category (even the same hex) can differ.

    The fingerprint's continuous channels are z-scored across the corpus; a
    logistic squashes each back to 0..1 (0.5 = corpus-average). `role` =
    [anchor, density, local_rarity, city_rarity, next_strong]; `spend.price` is
    a raw 0..1 ordinal (often null). Missing evidence falls back to the category
    prior. evidenceConfidence starts at a floor (ecology/role/spend are
    coordinate-based and always available) and rises with hex coverage.
    """
    priors = CATEGORY_PRIORS.get(row["category"], CATEGORY_PRIORS["restaurant"])
    if fingerprint is None:
        informal, novel, institution, solo, linger, destination = priors
        return {
            "informal": informal, "novel": novel, "institution": institution,
            "soloFriendly": solo, "linger": linger, "destination": destination,
            "evidenceConfidence": round(0.25 + 0.5 * hex_confidence, 2),
        }
    anchor, density, local_rarity, city_rarity, next_strong = fingerprint["role"]
    price = fingerprint["spend"].get("price")
    return {
        # casual vs formal: cheaper reads informal; fall back to prior when price is unknown
        "informal": round(1 - price, 3) if price is not None else priors[0],
        # discovery: locally + citywide uncommon
        "novel": round(_sigmoid(0.5 * (local_rarity + city_rarity)), 3),
        # an established anchor (stronger than its neighbours)
        "institution": round(_sigmoid(anchor), 3),
        "soloFriendly": priors[3],
        # lingering / wandering potential tracks nearby venue density
        "linger": round(_sigmoid(density), 3),
        # a place worth travelling to: anchor + rare + standalone
        "destination": round(_sigmoid(0.5 * anchor + 0.3 * city_rarity + 0.2 * next_strong), 3),
        "evidenceConfidence": round(0.4 + 0.5 * hex_confidence, 2),
    }


def export_venues(output: Path, venue_rows: list[dict], retained_ids: set[str], fingerprints: dict) -> list[str]:
    venues = []
    for row in venue_rows:
        if row["hex_id"] not in retained_ids:
            continue
        confidence_values = [float(row.get(key) or 0) for key in ("conf_A", "conf_L", "conf_T")]
        hex_confidence = sum(confidence_values) / 3
        venues.append({
            "id": row["id"], "name": row["name"],
            "latitude": round(float(row["lat"]), 6), "longitude": round(float(row["lng"]), 6),
            "h3": row["hex_id"], "neighborhoodId": row.get("nta") or None,
            "category": row["category"],
            "qualityPrior": round(float(row.get("q") or 0) / 100, 3),
            "qualityConfidence": round(hex_confidence, 2),
            "qualitySource": "engine_prior",
            "featureScores": feature_scores(row, fingerprints.get(row["id"]), hex_confidence),
        })
    write_json(output / "venues.json", venues)
    return [venue["id"] for venue in venues]


def export_place_neighbors(source: Path, output: Path, venue_ids: list[str]) -> None:
    """Compact the engine's venue-to-venue retrieval to the shipped contract.

    Candidate references become integer indices into venues.json (which is exported
    in `venue_ids` order), and candidates outside pilot coverage are dropped. The
    per-channel score arrays are passed through untouched; reason text is
    reconstructed client-side. Roles are stored as an index into COMPLEMENT_ROLES.
    """
    raw = json.loads((source / "place_neighbors.json").read_text())
    index = {vid: i for i, vid in enumerate(venue_ids)}
    similar: list[list] = []
    complements: list[list] = []
    for vid in venue_ids:
        entry = raw.get(vid, {})
        similar.append([
            [index[item["id"]], *item["s"]]
            for item in entry.get("similar", []) if item["id"] in index
        ])
        complements.append([
            [index[item["id"]], item["distanceMeters"], COMPLEMENT_ROLES.index(item["role"]), *item["s"]]
            for item in entry.get("complements", []) if item["id"] in index
        ])
    write_json(output / "place_neighbors.json", {
        "similarScoreOrder": ["time", "ecology", "area", "category", "spend", "role"],
        "complementScoreOrder": ["walk", "complement", "area"],
        "roles": list(COMPLEMENT_ROLES),
        "similar": similar,
        "complements": complements,
    })


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("usage: export_frontend.py ENGINE_DATA_DIR [OUTPUT_DIR]")
    source = Path(sys.argv[1]).expanduser().resolve()
    output = Path(sys.argv[2] if len(sys.argv) == 3 else "public/data/nyc").resolve()
    required = ("hexes.geojson", "hex_metrics_summary.json", "venues_final.csv", "category_curves.json", "nta.geojson", "place_neighbors.json", "place_fingerprints.json")
    missing = [name for name in required if not (source / name).exists()]
    if missing:
        raise SystemExit(f"missing engine artifacts: {', '.join(missing)}")
    output.mkdir(parents=True, exist_ok=True)
    venue_rows = load_venue_rows(source)
    fingerprints = json.loads((source / "place_fingerprints.json").read_text())
    retained_ids = export_geometry(source, output, venue_rows)
    metric_files = export_metrics(source, output, retained_ids)
    venue_ids = export_venues(output, venue_rows, retained_ids, fingerprints)
    export_place_neighbors(source, output, venue_ids)
    shutil.copyfile(source / "nta.geojson", output / "neighborhoods.geojson")
    shutil.copyfile(source / "category_curves.json", output / "category_curves.json")
    manifest = {
        "schemaVersion": SCHEMA_VERSION, "datasetVersion": "2026-07-18", "city": "nyc",
        "coverageLabel": "Manhattan below 96th Street, Williamsburg, Greenpoint, and Long Island City",
        "timeModel": "typical_week", "timeResolutionMinutes": 60, "hexResolution": 10,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "files": {"hexes": "hexes.geojson", "metricsByDay": metric_files, "venues": "venues.json", "categoryCurves": "category_curves.json", "neighborhoods": "neighborhoods.geojson", "placeNeighbors": "place_neighbors.json"},
    }
    write_json(output / "manifest.json", manifest)
    print(f"Exported {len(retained_ids)} supported hexes and frontend artifacts to {output}")


if __name__ == "__main__":
    main()
