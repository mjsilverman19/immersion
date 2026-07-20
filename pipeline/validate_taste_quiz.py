#!/usr/bin/env python3
"""Offline quality gates for the adaptive taste quiz.

Simulates personas with known ground-truth taste directions answering the
shipped quiz (exact same greedy information-gain selection as the client's
src/lib/adaptiveQuiz.ts), then checks that:

  1. TS/Python selection equivalence — walking the shared unit fixture
     (src/lib/tasteSpace.fixture.json) produces the exact question sequence the
     TS test suite asserts.
  2. Recovery — rankings implied by the recovered profile correlate with the
     ground-truth rankings (mean Spearman per intent above threshold).
  3. Divergence — personas with unrelated ground truths get different top-10s.
  4. Coverage — every question in the bank is asked for some persona.
  5. Length — mean questions asked lands in the 6..8 design band.
  6. Stability — a persona re-quizzed with a perturbed ground truth recovers a
     nearby profile.

Run after `npm run data:export`:  python3 pipeline/validate_taste_quiz.py
"""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data" / "nyc"
FIXTURE = ROOT / "src" / "lib" / "tasteSpace.fixture.json"

MIN_QUESTIONS = 6
MAX_QUESTIONS = 8
STOP_GAIN_FRACTION = 0.35
INTENT_SIGMA_FRACTION = 0.25
RELEVANCE_TILT = 0.35
BOTH_BAND = 0.15
SKIP_PROBABILITY = 0.08

INTENT_CATEGORIES = {
    "anything": ["restaurant", "bar", "cafe", "museum", "park", "nightlife"],
    "eat": ["restaurant"],
    "drink": ["bar"],
    "coffee": ["cafe"],
    "culture": ["museum"],
    "outside": ["park"],
    "nightlife": ["nightlife", "bar"],
}

PERSONAS = 300
SEED = 11

MIN_MEAN_SPEARMAN = 0.6
MAX_MEAN_TOP10_JACCARD = 0.6
MIN_STABILITY_COSINE = 0.85


def load_space(path: Path) -> dict:
    space = json.loads(path.read_text())
    if "vectors" in space:
        quantized = np.frombuffer(base64.b64decode(space["vectors"]), dtype=np.int8)
        space["V"] = quantized.reshape(-1, space["dims"]).astype(float) * space["quantClip"] / 127
    space["Sigma"] = np.array(space["covariance"], dtype=float)
    for question in space["questions"]:
        question["a"] = np.array(question["axis"], dtype=float)
    return space


# --- exact mirror of src/lib/adaptiveQuiz.ts --------------------------------

def median_sigma(space: dict) -> float:
    return float(np.median([q["sigma"] for q in space["questions"]]))


def eligible(space: dict, intent: str) -> list[dict]:
    threshold = INTENT_SIGMA_FRACTION * median_sigma(space)
    categories = INTENT_CATEGORIES[intent]
    return [
        q for q in space["questions"]
        if any(q["sigmaByCategory"].get(c, 0.0) >= threshold for c in categories)
    ]


def answered_basis(space: dict, asked: list[tuple[str, int | None]]) -> list[np.ndarray]:
    by_id = {q["id"]: q for q in space["questions"]}
    basis: list[np.ndarray] = []
    for question_id, answer in asked:
        if answer is None or question_id not in by_id:
            continue
        residual = by_id[question_id]["a"].copy()
        for axis in basis:
            residual -= float(residual @ axis) * axis
        length = float(np.linalg.norm(residual))
        if length > 1e-6:
            basis.append(residual / length)
    return basis


def question_gain(space: dict, question: dict, basis: list[np.ndarray]) -> float:
    residual = question["a"].copy()
    for axis in basis:
        residual -= float(residual @ axis) * axis
    return float(np.sqrt(max(0.0, residual @ space["Sigma"] @ residual)))


def opening_gain(space: dict, intent: str) -> float:
    return max((question_gain(space, q, []) for q in eligible(space, intent)), default=0.0)


def answered_direction(space: dict, asked: list[tuple[str, int | None]]) -> np.ndarray | None:
    by_id = {q["id"]: q for q in space["questions"]}
    direction = np.zeros(space["dims"])
    answered = False
    for question_id, answer in asked:
        if not answer or question_id not in by_id:
            continue
        direction += answer * by_id[question_id]["a"]
        answered = True
    if not answered:
        return None
    length = float(np.linalg.norm(direction))
    return direction / length if length > 0 else None


def relevance_tilt(question: dict, direction: np.ndarray | None) -> float:
    if direction is None:
        return 1.0
    axis = question["a"]
    length = float(np.linalg.norm(axis))
    if length == 0:
        return 1.0
    return 1.0 + RELEVANCE_TILT * max(0.0, float(axis @ direction) / length)


def next_question(space: dict, asked: list[tuple[str, int | None]], intent: str) -> dict | None:
    if len(asked) >= MAX_QUESTIONS:
        return None
    asked_ids = {question_id for question_id, _ in asked}
    basis = answered_basis(space, asked)
    direction = answered_direction(space, asked)
    best = None
    best_score = -1.0
    max_gain = 0.0
    for question in eligible(space, intent):
        if question["id"] in asked_ids:
            continue
        gain = question_gain(space, question, basis)
        max_gain = max(max_gain, gain)
        score = gain * relevance_tilt(question, direction)
        if score > best_score:
            best, best_score = question, score
    if best is None:
        return None
    if len(asked) >= MIN_QUESTIONS and max_gain < STOP_GAIN_FRACTION * opening_gain(space, intent):
        return None
    return best


# --- simulation --------------------------------------------------------------

def run_quiz(
    space: dict,
    truth: np.ndarray,
    intent: str,
    rng: np.random.Generator | None = None,
) -> tuple[np.ndarray, list[str]]:
    asked: list[tuple[str, int | None]] = []
    while (question := next_question(space, asked, intent)) is not None:
        if rng is not None and rng.random() < SKIP_PROBABILITY:
            asked.append((question["id"], None))
            continue
        projection = float(truth @ question["a"])
        answer = 0 if abs(projection) <= BOTH_BAND * question["sigma"] else (1 if projection > 0 else -1)
        asked.append((question["id"], answer))
    by_id = {q["id"]: q for q in space["questions"]}
    recovered = np.zeros(space["dims"])
    for question_id, answer in asked:
        if answer:
            recovered += answer * by_id[question_id]["a"]
    length = np.linalg.norm(recovered)
    return (recovered / length if length > 0 else recovered), [question_id for question_id, _ in asked]


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    ranks_a = np.argsort(np.argsort(a))
    ranks_b = np.argsort(np.argsort(b))
    return float(np.corrcoef(ranks_a, ranks_b)[0, 1])


def check(name: str, ok: bool, detail: str) -> bool:
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: {detail}")
    return ok


def validate_fixture_equivalence() -> bool:
    space = load_space(FIXTURE)
    asked: list[tuple[str, int | None]] = []
    sequence = []
    while (question := next_question(space, asked, "anything")) is not None:
        sequence.append(question["id"])
        asked.append((question["id"], 1))
    expected = ["q_energy", "q_novelty", "q_formality", "q_wandering", "q_neighborhood"]
    return check("fixture equivalence (matches src/lib/adaptiveQuiz.test.ts)", sequence == expected, f"{sequence}")


def main() -> None:
    print("validate_taste_quiz")
    ok = validate_fixture_equivalence()

    space = load_space(DATA / "taste_space.json")
    venues = json.loads((DATA / "venues.json").read_text())
    categories = np.array([venue["category"] for venue in venues])
    V = space["V"]
    rng = np.random.default_rng(SEED)

    # Personas: real venue vectors + noise, plus pure question-axis archetypes.
    picks = rng.choice(len(V), size=PERSONAS - len(space["questions"]), replace=False)
    truths = [v / (np.linalg.norm(v) or 1.0) + rng.normal(0, 0.15, space["dims"]) for v in V[picks]]
    truths += [q["a"].copy() for q in space["questions"]]
    truths = [t / np.linalg.norm(t) for t in truths]

    recovered, asked_ids, lengths = [], [], []
    for truth in truths:
        u, ids = run_quiz(space, truth, "anything")
        recovered.append(u)
        asked_ids.append(set(ids))
        lengths.append(len(ids))
    recovered = np.array(recovered)

    # Coverage sampling: quizzes branch on answer signs, skips, and intent, so
    # sweep all three — every intent with a slice of personas, skips enabled.
    coverage_asked: set[str] = set().union(*asked_ids)
    for intent in INTENT_CATEGORIES:
        for truth in truths[:25]:
            _, ids = run_quiz(space, truth, intent, rng=rng)
            coverage_asked |= set(ids)

    # 2. Recovery: ranking implied by the recovered profile tracks ground truth.
    per_intent = {}
    for intent, intent_categories in INTENT_CATEGORIES.items():
        mask = np.isin(categories, intent_categories)
        scores = [
            spearman(V[mask] @ u, V[mask] @ t)
            for u, t in zip(recovered, truths)
            if np.linalg.norm(u) > 0
        ]
        per_intent[intent] = float(np.mean(scores))
    worst_intent = min(per_intent, key=per_intent.get)
    ok &= check(
        f"recovery (mean Spearman per intent >= {MIN_MEAN_SPEARMAN})",
        all(value >= MIN_MEAN_SPEARMAN for value in per_intent.values()),
        ", ".join(f"{intent}={value:.2f}" for intent, value in per_intent.items()) + f" (worst: {worst_intent})",
    )

    # 3. Divergence: unrelated personas end up with different top-10s.
    jaccards = []
    pairs = 0
    for _ in range(400):
        i, j = rng.choice(PERSONAS, size=2, replace=False)
        if abs(float(truths[i] @ truths[j])) > 0.2:
            continue
        top_i = set(np.argsort(V @ recovered[i])[-10:])
        top_j = set(np.argsort(V @ recovered[j])[-10:])
        jaccards.append(len(top_i & top_j) / len(top_i | top_j))
        pairs += 1
    mean_jaccard = float(np.mean(jaccards)) if jaccards else 0.0
    ok &= check(
        f"divergence (mean top-10 Jaccard of unrelated personas < {MAX_MEAN_TOP10_JACCARD})",
        mean_jaccard < MAX_MEAN_TOP10_JACCARD,
        f"{mean_jaccard:.2f} over {pairs} pairs",
    )

    # 4. Coverage: every bank question gets asked for someone, across the
    # intent/skip/answer variations real sessions produce.
    unasked = [q["id"] for q in space["questions"] if q["id"] not in coverage_asked]
    ok &= check("coverage (every question asked for some persona/intent)", not unasked, f"unasked: {unasked or 'none'}")

    # 5. Length: the adaptive stop lands in the design band.
    mean_length = float(np.mean(lengths))
    ok &= check(
        f"length (mean questions asked in [{MIN_QUESTIONS}, {MAX_QUESTIONS}])",
        MIN_QUESTIONS <= mean_length <= MAX_QUESTIONS,
        f"{mean_length:.2f} (min {min(lengths)}, max {max(lengths)})",
    )

    # 6. Stability: a perturbed re-quiz recovers a nearby profile.
    cosines = []
    for truth in truths[:60]:
        perturbed = truth + rng.normal(0, 0.08, space["dims"])
        perturbed /= np.linalg.norm(perturbed)
        u1, _ = run_quiz(space, truth, "anything")
        u2, _ = run_quiz(space, perturbed, "anything")
        if np.linalg.norm(u1) > 0 and np.linalg.norm(u2) > 0:
            cosines.append(float(u1 @ u2))
    mean_cosine = float(np.mean(cosines))
    ok &= check(
        f"stability (mean recovered cosine under perturbation >= {MIN_STABILITY_COSINE})",
        mean_cosine >= MIN_STABILITY_COSINE,
        f"{mean_cosine:.2f}",
    )

    if not ok:
        raise SystemExit("validate_taste_quiz: FAILED")
    print("validate_taste_quiz: all gates passed")


if __name__ == "__main__":
    main()
