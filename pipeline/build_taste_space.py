#!/usr/bin/env python3
"""Build the client taste-space artifact from engine place fingerprints.

The taste space is the concatenation of the fingerprint's continuous channels —
[temporal(8) | ecology(24) | area(9) | role(5) | price_z(1)] — with each channel
scaled by 1/sqrt(dim) so no channel dominates the inner product by width alone.
Category and quality are deliberately excluded: the intent filter and the
baseline score already own them, and taste must not double-count either.

Question axes are corpus-derived: each side of a question is a declarative
selector (categories + percentile predicates over named fingerprint fields,
see taste_questions.json) resolved to an exemplar venue set, and the axis is
the normalized difference of the two side centroids. No behavioural training
data is required; the bank is re-resolved on every export so axes track the
corpus, and the same construction can later be retrained on real users.

Importable module — export_frontend.py calls build_taste_space() with venues
already in venues.json order, which makes vector-row/venue-index alignment
structural rather than a convention. The CLI form exists for authoring
iteration only and reads an existing venues.json for that order.
"""

from __future__ import annotations

import base64
import json
import math
import sys
from pathlib import Path

import numpy as np

CHANNELS = (("temporal", 8), ("ecology", 24), ("area", 9), ("role", 5), ("spend", 1))
DIMS = sum(length for _, length in CHANNELS)
QUANT_CLIP = 3.0
VIEW_GAIN = 0.8
# Target RMS of tanh(matchGain * projection) over the corpus for a typical
# 6-answer profile — matches the spread today's tanh(2.4 * handDot) produces.
MATCH_RMS_TARGET = 0.45
MIN_SIDE_VENUES = 30
MAX_AXIS_COSINE = 0.92
MIN_CHANNEL_COVERAGE = 0.25
MAX_PAYLOAD_BYTES = 800_000

# Named interpretable fields usable in question `where` predicates. Values are
# read from the (already z-scored) fingerprint channels; percentile thresholds
# are invariant under that monotone transform, so raw vs z-scored is immaterial.
# Semantic order comes from immersion_data/pipeline/build_place_fingerprints.py.
FIELD_INDEX = {
    "area.meanActivity": ("area", 0),
    "area.peakActivity": ("area", 1),
    "area.lateShare": ("area", 4),
    "area.weekendRatio": ("area", 5),
    "area.localMean": ("area", 6),
    "area.touristMean": ("area", 7),
    "role.anchor": ("role", 0),
    "role.density": ("role", 1),
    "role.localRarity": ("role", 2),
    "role.cityRarity": ("role", 3),
    "role.nextStrong": ("role", 4),
    "ecology.restaurantShare1": ("ecology", 6),
    "ecology.barShare1": ("ecology", 7),
    "ecology.cafeShare1": ("ecology", 8),
    "ecology.nightlifeShare1": ("ecology", 9),
    "ecology.parkShare1": ("ecology", 10),
    "ecology.museumShare1": ("ecology", 11),
    "ecology.density0": ("ecology", 18),
    "ecology.density1": ("ecology", 19),
    "ecology.density2": ("ecology", 20),
    "ecology.entropy0": ("ecology", 21),
    "ecology.entropy1": ("ecology", 22),
    "ecology.entropy2": ("ecology", 23),
}
NULLABLE_FIELDS = ("spend.price",)


class TasteSpaceError(SystemExit):
    pass


def _raw_rows(fingerprints: dict, venues: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Concatenated (unscaled) channel matrix in venues order + validity mask.

    Venues without a fingerprint get a zero row (neutral under dot products)
    and are excluded from exemplar sets and corpus statistics.
    """
    n = len(venues)
    raw = np.zeros((n, DIMS))
    valid = np.zeros(n, dtype=bool)
    prices = np.full(n, np.nan)
    for i, venue in enumerate(venues):
        fp = fingerprints.get(venue["id"])
        if fp is None:
            continue
        valid[i] = True
        row = fp["temporal"] + fp["ecology"] + fp["area"] + fp["role"]
        raw[i, : DIMS - 1] = row
        price = fp["spend"].get("price")
        if price is not None:
            prices[i] = price
    priced = ~np.isnan(prices)
    if priced.any():
        mean = prices[priced].mean()
        std = prices[priced].std() or 1.0
        raw[priced, DIMS - 1] = (prices[priced] - mean) / std
    return raw, valid


def _channel_scale() -> np.ndarray:
    scale = np.ones(DIMS)
    start = 0
    for _, length in CHANNELS:
        scale[start : start + length] = 1.0 / math.sqrt(length)
        start += length
    return scale


def _field_values(fingerprints: dict, venues: list[dict]) -> dict[str, np.ndarray]:
    """Per-field value arrays (NaN where unavailable) for predicate resolution."""
    n = len(venues)
    values: dict[str, np.ndarray] = {name: np.full(n, np.nan) for name in (*FIELD_INDEX, "spend.price", "spend.q")}
    for i, venue in enumerate(venues):
        fp = fingerprints.get(venue["id"])
        if fp is None:
            continue
        for name, (channel, index) in FIELD_INDEX.items():
            values[name][i] = fp[channel][index]
        if fp["spend"].get("price") is not None:
            values["spend.price"][i] = fp["spend"]["price"]
        values["spend.q"][i] = fp["spend"]["q"]
    return values


def _resolve_side(side: dict, venues: list[dict], values: dict[str, np.ndarray], valid: np.ndarray) -> np.ndarray:
    mask = valid.copy()
    categories = side.get("categories")
    if categories:
        allowed = set(categories)
        mask &= np.array([venue["category"] in allowed for venue in venues])
    for field, op, percentile in side.get("where", ()):
        if field not in values:
            raise TasteSpaceError(f"taste question predicate references unknown field {field!r}")
        column = values[field]
        known = ~np.isnan(column)
        threshold = np.percentile(column[known], percentile)
        passes = np.zeros(len(column), dtype=bool)
        if op == "ltp":
            passes[known] = column[known] <= threshold
        elif op == "gtp":
            passes[known] = column[known] >= threshold
        else:
            raise TasteSpaceError(f"taste question predicate has unknown op {op!r}")
        mask &= passes
    ids = {venue["id"]: i for i, venue in enumerate(venues)}
    for vid in side.get("include", ()):
        if vid in ids:
            mask[ids[vid]] = True
    for vid in side.get("exclude", ()):
        if vid in ids:
            mask[ids[vid]] = False
    return mask


def _calibrate_match_gain(vectors: np.ndarray, axes: np.ndarray, valid: np.ndarray, seed: int = 7) -> float:
    """Solve tanh gain so a typical 6-answer profile's corpus match distribution
    has RMS ≈ MATCH_RMS_TARGET (the spread of the previous hand-signal model)."""
    rng = np.random.default_rng(seed)
    corpus = vectors[valid]
    projections = []
    for _ in range(200):
        picks = rng.choice(len(axes), size=min(6, len(axes)), replace=False)
        answers = rng.choice((-1.0, 1.0), size=len(picks))
        direction = (answers[:, None] * axes[picks]).sum(axis=0)
        norm = np.linalg.norm(direction)
        if norm < 1e-9:
            continue
        projections.append(corpus @ (direction / norm))
    stacked = np.concatenate(projections)

    def rms(gain: float) -> float:
        return float(np.sqrt(np.mean(np.tanh(gain * stacked) ** 2)))

    lo, hi = 0.01, 50.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if rms(mid) < MATCH_RMS_TARGET:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2, 3)


def build_taste_space(fingerprints: dict, venues: list[dict], questions_path: Path, verbose: bool = True) -> dict:
    """venues: exported venue dicts (id, category, neighborhoodId) in venues.json order."""
    bank = json.loads(Path(questions_path).read_text())
    questions = bank["questions"]
    raw, valid = _raw_rows(fingerprints, venues)
    vectors = raw * _channel_scale()
    values = _field_values(fingerprints, venues)
    corpus = vectors[valid]
    covariance = np.cov(corpus, rowvar=False)

    axes = np.zeros((len(questions), DIMS))
    out_questions = []
    categories = sorted({venue["category"] for venue in venues})
    category_masks = {c: np.array([venue["category"] == c for venue in venues]) & valid for c in categories}
    anchors: dict[str, dict] = {}
    for qi, question in enumerate(questions):
        neg = _resolve_side(question["sides"]["negative"], venues, values, valid)
        pos = _resolve_side(question["sides"]["positive"], venues, values, valid)
        # A venue matched by both selectors is an ambiguous exemplar; drop it
        # from both sides so the axis contrasts genuinely opposed venues.
        both = neg & pos
        neg &= ~both
        pos &= ~both
        overlap = int(both.sum())
        if verbose:
            samples = [venues[i]["name"] for i in np.flatnonzero(pos)[:3]]
            print(f"  {question['id']}: negative={int(neg.sum())} positive={int(pos.sum())} overlap={overlap} e.g. {samples}")
        if neg.sum() < MIN_SIDE_VENUES or pos.sum() < MIN_SIDE_VENUES:
            raise TasteSpaceError(
                f"taste question {question['id']} side too small (negative={int(neg.sum())}, positive={int(pos.sum())}, need {MIN_SIDE_VENUES})")
        axis = vectors[pos].mean(axis=0) - vectors[neg].mean(axis=0)
        norm = np.linalg.norm(axis)
        if norm < 1e-9:
            raise TasteSpaceError(f"taste question {question['id']} produces a zero axis")
        axis /= norm
        axes[qi] = axis
        projections = corpus @ axis
        sigma_by_category = {
            c: round(float((vectors[mask] @ axis).std()), 3) if mask.any() else 0.0
            for c, mask in category_masks.items()
        }
        entry = {
            "id": question["id"],
            "dimension": question["dimension"],
            "anchor": bool(question.get("anchor")),
            "sign": question.get("sign", 1),
            "prompt": question["prompt"],
            "negative": question["negative"],
            "positive": question["positive"],
            "copy": question["copy"],
            "axis": [round(float(v), 4) for v in axis],
            "sigma": round(float(projections.std()), 3),
            "sigmaByCategory": sigma_by_category,
        }
        out_questions.append(entry)
        if entry["anchor"]:
            if entry["dimension"] in anchors:
                raise TasteSpaceError(f"duplicate anchor question for dimension {entry['dimension']}")
            anchors[entry["dimension"]] = entry

    expected_dimensions = {"energy", "novelty", "wandering", "formality", "neighborhoodOrientation"}
    if set(anchors) != expected_dimensions:
        raise TasteSpaceError(f"anchor questions must cover exactly {sorted(expected_dimensions)}, got {sorted(anchors)}")

    for i in range(len(questions)):
        for j in range(i + 1, len(questions)):
            cosine = abs(float(axes[i] @ axes[j]))
            if cosine > MAX_AXIS_COSINE:
                raise TasteSpaceError(
                    f"questions {questions[i]['id']} and {questions[j]['id']} are near-duplicates (|cos|={cosine:.3f})")

    start = 0
    for name, length in CHANNELS:
        coverage = float(np.abs(np.linalg.norm(axes[:, start : start + length], axis=1)).max())
        if coverage < MIN_CHANNEL_COVERAGE:
            raise TasteSpaceError(f"no question meaningfully covers channel {name!r} (max ‖axis‖={coverage:.3f})")
        start += length

    quantized = np.clip(np.round(vectors / QUANT_CLIP * 127), -127, 127).astype(np.int8)
    interpretive = {
        dimension: [round(float(v) * entry["sign"], 4) for v in entry["axis"]]
        for dimension, entry in anchors.items()
    }
    area_centroids: dict[str, list[float]] = {}
    by_area: dict[str, list[int]] = {}
    for i, venue in enumerate(venues):
        if venue.get("neighborhoodId") and valid[i]:
            by_area.setdefault(venue["neighborhoodId"], []).append(i)
    for area, indices in sorted(by_area.items()):
        area_centroids[area] = [round(float(v), 4) for v in vectors[indices].mean(axis=0)]

    artifact = {
        "version": 1,
        "bankVersion": bank["bankVersion"],
        "dims": DIMS,
        "channels": [
            {"key": name, "start": sum(l for _, l in CHANNELS[:i]), "len": length}
            for i, (name, length) in enumerate(CHANNELS)
        ],
        "quantClip": QUANT_CLIP,
        "matchGain": _calibrate_match_gain(vectors, axes, valid),
        "viewGain": VIEW_GAIN,
        "vectors": base64.b64encode(quantized.tobytes()).decode("ascii"),
        "covariance": [[round(float(v), 5) for v in row] for row in covariance],
        "interpretiveAxes": interpretive,
        "areaCentroids": area_centroids,
        "questions": out_questions,
    }
    payload = len(json.dumps(artifact, separators=(",", ":")).encode("utf-8"))
    if payload > MAX_PAYLOAD_BYTES:
        raise TasteSpaceError(f"taste_space.json payload {payload} exceeds {MAX_PAYLOAD_BYTES} bytes")
    if verbose:
        print(f"  taste space: {len(venues)} venues x {DIMS} dims, matchGain={artifact['matchGain']}, payload={payload / 1024:.0f} KB")
    return artifact


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_taste_space.py ENGINE_DATA_DIR VENUES_JSON  (authoring iteration only; the real build runs inside export_frontend.py)")
    source = Path(sys.argv[1]).expanduser().resolve()
    venues = json.loads(Path(sys.argv[2]).read_text())
    fingerprints = json.loads((source / "place_fingerprints.json").read_text())
    questions = Path(__file__).parent / "taste_questions.json"
    artifact = build_taste_space(fingerprints, venues, questions)
    out = Path(sys.argv[2]).parent / "taste_space.json"
    out.write_text(json.dumps(artifact, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
