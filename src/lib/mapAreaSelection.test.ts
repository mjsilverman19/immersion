import { describe, expect, it } from "vitest";

import { findAreaAtPoint } from "@/lib/mapAreaSelection";
import type { HexGeometryCollection, SelectedArea } from "@/types/data";

const area = (id: string) => ({ id, name: id } as SelectedArea);
const geometry: HexGeometryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: { h3: "a", neighborhoodId: "Area A", borough: "Test", features: {} as never },
    },
    {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] },
      properties: { h3: "b", neighborhoodId: "Area B", borough: "Test", features: {} as never },
    },
  ],
};

describe("detail zoom area selection", () => {
  it("resolves the ranked neighborhood containing the map center", () => {
    expect(findAreaAtPoint(geometry, [area("Area A"), area("Area B")], [1.5, 0.5])?.id).toBe("Area B");
  });

  it("does not activate unsupported or unavailable neighborhoods", () => {
    expect(findAreaAtPoint(geometry, [area("Area A")], [1.5, 0.5])).toBeNull();
    expect(findAreaAtPoint(geometry, [area("Area A")], [3, 3])).toBeNull();
  });
});
