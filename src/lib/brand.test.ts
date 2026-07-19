import { describe, expect, it } from "vitest";

import { BRAND, INTENT_ORDER, INTENT_VISUALS, MAP_FONT_STACKS } from "@/lib/brand";
import { buildBaseStyle } from "@/lib/mapStyle";

describe("brand visual contracts", () => {
  it("defines a distinct visual for every supported intent", () => {
    expect(Object.keys(INTENT_VISUALS)).toEqual(expect.arrayContaining(INTENT_ORDER));
    expect(INTENT_ORDER).toHaveLength(7);
    expect(new Set(INTENT_ORDER.map((intent) => INTENT_VISUALS[intent].color)).size).toBe(7);
    expect(INTENT_VISUALS.anything.color).toBe(BRAND.primary);
    expect(INTENT_VISUALS.nightlife.color).toBe(BRAND.highlight);
  });

  it("builds the map with brand surfaces and Inter labels", () => {
    const style = buildBaseStyle();
    const layers = style.layers as unknown as Array<{
      id: string;
      type: string;
      paint?: Record<string, unknown>;
      layout?: Record<string, unknown>;
    }>;
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    const background = byId.get("bg");
    const park = byId.get("park");
    const water = byId.get("water");
    const placeLabels = byId.get("place-labels");
    const waterLabels = byId.get("water-labels");

    expect(background?.type).toBe("background");
    expect(background?.paint?.["background-color"]).toBe(BRAND.paper);
    expect(park?.paint?.["fill-color"]).toBe(BRAND.park);
    expect(water?.paint?.["fill-color"]).toBe(BRAND.water);
    expect(placeLabels?.layout?.["text-font"]).toEqual(MAP_FONT_STACKS.regular);
    expect(waterLabels?.layout?.["text-font"]).toEqual(MAP_FONT_STACKS.regular);
  });
});
