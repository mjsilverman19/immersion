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
SCHEMA_VERSION = 2
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
    for day_index, day in enumerate(DAYS):
        start, stop = day_index * 24, day_index * 24 + 24
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
        write_json(output / filename, {"dayOfWeek": day_index, "intervalMinutes": 60, "records": records})
        metric_files[day] = filename
    return metric_files


def export_venues(output: Path, venue_rows: list[dict], retained_ids: set[str]) -> None:
    venues = []
    for row in venue_rows:
        if row["hex_id"] not in retained_ids:
            continue
        confidence_values = [float(row.get(key) or 0) for key in ("conf_A", "conf_L", "conf_T")]
        priors = CATEGORY_PRIORS.get(row["category"], CATEGORY_PRIORS["restaurant"])
        venues.append({
            "id": row["id"], "name": row["name"],
            "latitude": round(float(row["lat"]), 6), "longitude": round(float(row["lng"]), 6),
            "h3": row["hex_id"], "neighborhoodId": row.get("nta") or None,
            "category": row["category"],
            "qualityPrior": round(float(row.get("q") or 0) / 100, 3),
            "qualityConfidence": round(sum(confidence_values) / 3, 2),
            "qualitySource": "engine_prior",
            "featureScores": {
                "informal": priors[0], "novel": priors[1], "institution": priors[2],
                "soloFriendly": priors[3], "linger": priors[4], "destination": priors[5],
                "evidenceConfidence": 0.25,
            },
        })
    write_json(output / "venues.json", venues)


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("usage: export_frontend.py ENGINE_DATA_DIR [OUTPUT_DIR]")
    source = Path(sys.argv[1]).expanduser().resolve()
    output = Path(sys.argv[2] if len(sys.argv) == 3 else "public/data/nyc").resolve()
    required = ("hexes.geojson", "hex_metrics_summary.json", "venues_final.csv", "category_curves.json", "nta.geojson")
    missing = [name for name in required if not (source / name).exists()]
    if missing:
        raise SystemExit(f"missing engine artifacts: {', '.join(missing)}")
    output.mkdir(parents=True, exist_ok=True)
    venue_rows = load_venue_rows(source)
    retained_ids = export_geometry(source, output, venue_rows)
    metric_files = export_metrics(source, output, retained_ids)
    export_venues(output, venue_rows, retained_ids)
    shutil.copyfile(source / "nta.geojson", output / "neighborhoods.geojson")
    shutil.copyfile(source / "category_curves.json", output / "category_curves.json")
    manifest = {
        "schemaVersion": SCHEMA_VERSION, "datasetVersion": "2026-07-18", "city": "nyc",
        "coverageLabel": "Manhattan below 96th Street, Williamsburg, Greenpoint, and Long Island City",
        "timeModel": "typical_week", "timeResolutionMinutes": 60, "hexResolution": 10,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "files": {"hexes": "hexes.geojson", "metricsByDay": metric_files, "venues": "venues.json", "categoryCurves": "category_curves.json", "neighborhoods": "neighborhoods.geojson"},
    }
    write_json(output / "manifest.json", manifest)
    print(f"Exported {len(retained_ids)} supported hexes and frontend artifacts to {output}")


if __name__ == "__main__":
    main()
