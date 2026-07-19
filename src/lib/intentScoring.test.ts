import { describe, expect, it } from "vitest";

import { venueContextTerms } from "@/lib/recommendations";
import { INTENT_SCORING } from "@/lib/config";
import type { HexTimeMetric } from "@/types/data";

const metric = (activity: number, local: number, tourist: number): HexTimeMetric => ({
  activity,
  localOrientation: local,
  visitorPressure: tourist,
  confidence: 1,
  activityConfidence: 1,
  localOrientationConfidence: 1,
  visitorPressureConfidence: 1,
});

describe("intent-relative context terms", () => {
  it("penalizes visitor pressure less for culture than for eating", () => {
    const touristy = metric(0.5, 0.2, 0.9);
    const eat = venueContextTerms(1, touristy, INTENT_SCORING.eat);
    const culture = venueContextTerms(1, touristy, INTENT_SCORING.culture);
    expect(culture.tourist).toBeGreaterThan(eat.tourist); // less penalty
  });

  it("treats moderate activity as best for quiet coffee, not maximum", () => {
    const coffee = INTENT_SCORING.coffee;
    const atTarget = venueContextTerms(1, metric(0.5, 0.5, 0.1), coffee).activity;
    const maxedOut = venueContextTerms(1, metric(1.0, 0.5, 0.1), coffee).activity;
    expect(atTarget).toBeGreaterThan(maxedOut);
    expect(atTarget).toBeCloseTo(1, 6); // fit peaks at the target buzz level
  });

  it("still rewards more activity monotonically for busier-is-better intents", () => {
    const lively = venueContextTerms(1, metric(1.0, 0.5, 0.1), INTENT_SCORING.eat).activity;
    const dead = venueContextTerms(1, metric(0.0, 0.5, 0.1), INTENT_SCORING.eat).activity;
    expect(lively).toBeGreaterThan(dead);
  });

  it("relaxes the activity fit toward neutral when confidence is low", () => {
    const lowConf: HexTimeMetric = { ...metric(1.0, 0.5, 0.1), activityConfidence: 0 };
    // No confidence -> target penalty vanishes, term is exactly neutral.
    expect(venueContextTerms(1, lowConf, INTENT_SCORING.coffee).activity).toBeCloseTo(1, 6);
  });
});
