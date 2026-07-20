import { describe, expect, it } from "vitest";

import { currentTypicalTime, formatTypicalTime } from "@/lib/time";

describe("currentTypicalTime", () => {
  it("reads weekday and hour in America/New_York, not the runtime timezone", () => {
    // 2026-07-20 18:30 UTC == 14:30 EDT (Monday afternoon in NYC)
    const result = currentTypicalTime(new Date("2026-07-20T18:30:00.000Z"));
    expect(result).toEqual({ day: "mon", hour: 14 });
  });

  it("handles late-evening NYC hours across the UTC date boundary", () => {
    // 2026-07-21 03:15 UTC == 23:15 EDT Monday in NYC
    const result = currentTypicalTime(new Date("2026-07-21T03:15:00.000Z"));
    expect(result).toEqual({ day: "mon", hour: 23 });
  });

  it("maps early-morning NYC hours correctly", () => {
    // 2026-07-18 04:10 UTC == 00:10 EDT Saturday in NYC
    const result = currentTypicalTime(new Date("2026-07-18T04:10:00.000Z"));
    expect(result).toEqual({ day: "sat", hour: 0 });
  });
});

describe("formatTypicalTime", () => {
  it("labels the typical-week clock without claiming live conditions", () => {
    expect(formatTypicalTime("sat", 15)).toBe("Typical Saturday at 3:00 PM");
  });
});
