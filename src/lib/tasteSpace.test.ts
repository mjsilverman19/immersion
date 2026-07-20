import { describe, expect, it } from "vitest";

import { channelDots, covarianceQuadraticForm, decodeTasteSpace, dot, norm, normalize, venueVector } from "@/lib/tasteSpace";
import type { TasteSpaceArtifact } from "@/types/data";

import fixture from "./tasteSpace.fixture.json";

const artifact = fixture as unknown as TasteSpaceArtifact;

describe("decodeTasteSpace", () => {
  it("decodes base64 int8 rows back to the original values within quantization error", () => {
    const space = decodeTasteSpace(artifact, 4);
    expect(space.dims).toBe(3);
    expect(space.vectors.length).toBe(12);
    // v0 = [3,0,0] quantizes exactly (127 -> 3.0); v3 = [1.5,1.5,0] rounds to
    // 64 -> 1.512, inside the 3/127 ≈ 0.0236 error bound.
    expect(venueVector(space, 0)[0]).toBeCloseTo(3.0, 5);
    expect(venueVector(space, 1)[1]).toBeCloseTo(3.0, 5);
    expect(venueVector(space, 2)[2]).toBeCloseTo(3.0, 5);
    expect(Math.abs(venueVector(space, 3)[0] - 1.5)).toBeLessThan(3 / 127);
    expect(Math.abs(venueVector(space, 3)[1] - 1.5)).toBeLessThan(3 / 127);
    expect(venueVector(space, 3)[2]).toBe(0);
  });

  it("rejects a vector payload that does not match the venue count", () => {
    expect(() => decodeTasteSpace(artifact, 5)).toThrow(/misaligned/);
  });

  it("exposes typed interpretive axes and area centroids", () => {
    const space = decodeTasteSpace(artifact, 4);
    expect(Array.from(space.interpretiveAxes.energy)).toEqual([1, 0, 0]);
    expect(Array.from(space.areaCentroids.get("TestArea")!)).toEqual([1, 0, 0]);
  });
});

describe("vector kernel", () => {
  it("computes dot, norm, and normalize", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(norm([3, 4, 0])).toBe(5);
    const unit = normalize([3, 4, 0]);
    expect(unit[0]).toBeCloseTo(0.6, 6);
    expect(unit[1]).toBeCloseTo(0.8, 6);
    expect(unit[2]).toBe(0);
    expect(Array.from(normalize([0, 0, 0]))).toEqual([0, 0, 0]);
  });

  it("splits a dot product by channel", () => {
    const space = decodeTasteSpace(artifact, 4);
    const dots = channelDots([1, 2, 3], [4, 5, 6], space.channels);
    expect(dots.temporal).toBe(4);
    expect(dots.ecology).toBe(10);
    expect(dots.role).toBe(18);
  });

  it("computes the covariance quadratic form", () => {
    const space = decodeTasteSpace(artifact, 4);
    // Σ = diag(1, 1, 0.25): rᵀΣr for r=[0.6, 0.8, 2] = 0.36 + 0.64 + 1 = 2.
    expect(covarianceQuadraticForm(space.covariance, [0.6, 0.8, 2], 3)).toBeCloseTo(2, 5);
  });
});
