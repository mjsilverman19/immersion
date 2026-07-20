import { describe, expect, it } from "vitest";

import { estimateTotal, nextQuestion, questionGain, type AskedQuestion } from "@/lib/adaptiveQuiz";
import { decodeTasteSpace } from "@/lib/tasteSpace";
import type { TasteSpaceArtifact } from "@/types/data";

import fixture from "./tasteSpace.fixture.json";

const space = decodeTasteSpace(fixture as unknown as TasteSpaceArtifact, 4);
const question = (id: string) => space.questions.find((item) => item.id === id)!;
const answered = (entries: Array<[string, -1 | 0 | 1 | undefined]>): AskedQuestion[] =>
  entries.map(([questionId, answer]) => ({ questionId, answer }));

describe("questionGain", () => {
  it("equals the corpus sigma sqrt(aᵀΣa) with nothing answered", () => {
    // Σ = diag(1, 1, 0.25).
    expect(questionGain(space, question("q_energy"), [])).toBeCloseTo(1, 5);
    expect(questionGain(space, question("q_formality"), [])).toBeCloseTo(0.5, 5);
    expect(questionGain(space, question("q_neighborhood"), [])).toBeCloseTo(Math.sqrt(0.73), 5);
  });

  it("drops the gain of a question correlated with an answered one", () => {
    // q_wandering = [0.48, 0.64, 0]; with q_energy ([1,0,0]) resolved, only
    // the [0, 0.64, 0] component remains.
    const basis = [Float64Array.from([1, 0, 0])];
    expect(questionGain(space, question("q_wandering"), basis)).toBeCloseTo(0.64, 5);
  });
});

describe("nextQuestion", () => {
  it("opens with the highest-gain question, deterministically", () => {
    expect(nextQuestion(space, [], "anything")!.id).toBe("q_energy");
    expect(nextQuestion(space, [], "anything")!.id).toBe("q_energy");
  });

  it("adapts: after an answer, probes the most informative unresolved direction", () => {
    const asked = answered([["q_energy", 1]]);
    expect(nextQuestion(space, asked, "anything")!.id).toBe("q_novelty");
    // With both orthogonal directions resolved, q_wandering (their linear
    // combination) is fully resolved; q_formality's untouched axis wins.
    const two = answered([["q_energy", 1], ["q_novelty", -1]]);
    expect(nextQuestion(space, two, "anything")!.id).toBe("q_formality");
  });

  it("counts a 'both' answer as resolving the direction", () => {
    const asked = answered([["q_energy", 0]]);
    expect(nextQuestion(space, asked, "anything")!.id).toBe("q_novelty");
  });

  it("does not count a skip as resolving anything", () => {
    const asked = answered([["q_energy", undefined]]);
    // q_energy was asked (never re-asked) but its direction stays unresolved,
    // so the correlated q_novelty/q_wandering still carry full gain.
    expect(nextQuestion(space, asked, "anything")!.id).toBe("q_novelty");
    expect(questionGain(space, question("q_wandering"), [])).toBeCloseTo(0.8, 5);
  });

  it("skips questions that cannot discriminate the current intent's categories", () => {
    // q_formality's restaurant sigma (0.05) is below the intent threshold.
    const two = answered([["q_energy", 1], ["q_novelty", -1]]);
    expect(nextQuestion(space, two, "eat")!.id).toBe("q_neighborhood");
  });

  it("stops when the bank is exhausted or MAX_QUESTIONS is reached", () => {
    const all = answered([["q_energy", 1], ["q_novelty", 1], ["q_formality", 1], ["q_wandering", 1], ["q_neighborhood", 1]]);
    expect(nextQuestion(space, all, "anything")).toBeNull();
    const eight = answered(Array.from({ length: 8 }, (_, i) => [`q${i}`, 1]));
    expect(nextQuestion(space, eight, "anything")).toBeNull();
  });

  it("walks the full fixture sequence the offline validator also asserts", () => {
    // Shared contract with pipeline/validate_taste_quiz.py: answering +1 to
    // everything under intent 'anything' asks exactly this sequence.
    const sequence: string[] = [];
    const asked: AskedQuestion[] = [];
    for (;;) {
      const next = nextQuestion(space, asked, "anything");
      if (!next) break;
      sequence.push(next.id);
      asked.push({ questionId: next.id, answer: 1 });
    }
    expect(sequence).toEqual(["q_energy", "q_novelty", "q_formality", "q_wandering", "q_neighborhood"]);
  });
});

describe("relevance tilt", () => {
  it("branches on answer sign when remaining questions lean opposite ways", () => {
    // Correlated mini-bank: qB leans toward qA's positive side, qC toward its
    // negative side. Same residual gain either way — the tilt decides.
    const mini = {
      ...space,
      dims: 2,
      covariance: Float32Array.from([1, 0, 0, 1]),
      interpretiveAxes: space.interpretiveAxes,
      questions: [
        { ...question("q_energy"), id: "qA", axis: [1, 0] },
        { ...question("q_novelty"), id: "qB", axis: [0.6, 0.8] },
        { ...question("q_wandering"), id: "qC", axis: [-0.6, 0.8] },
      ],
    };
    expect(nextQuestion(mini, answered([["qA", 1]]), "anything")!.id).toBe("qB");
    expect(nextQuestion(mini, answered([["qA", -1]]), "anything")!.id).toBe("qC");
  });
});

describe("estimateTotal", () => {
  it("estimates within the min/max band from the informative remainder", () => {
    expect(estimateTotal(space, [], "anything")).toBe(6);
    const all = answered([["q_energy", 1], ["q_novelty", 1], ["q_formality", 1], ["q_wandering", 1], ["q_neighborhood", 1]]);
    expect(estimateTotal(space, all, "anything")).toBe(6);
  });
});
