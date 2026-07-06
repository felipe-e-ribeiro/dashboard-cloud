import { describe, expect, it } from "vitest";

import { toCumulative } from "../src/components/TrendChart";

describe("toCumulative", () => {
  it("turns daily amounts into a running total", () => {
    const trend = [
      { usage_date: "2026-07-01", amount: 3 },
      { usage_date: "2026-07-02", amount: 0 },
      { usage_date: "2026-07-03", amount: 0.5 },
    ];

    expect(toCumulative(trend)).toEqual([
      { usage_date: "2026-07-01", amount: 3 },
      { usage_date: "2026-07-02", amount: 3 },
      { usage_date: "2026-07-03", amount: 3.5 },
    ]);
  });

  it("never decreases even when a later day's daily cost is smaller than an earlier day's", () => {
    // A subscription-style fee (e.g. a Route 53 hosted zone) billed entirely on day one,
    // followed by near-zero daily usage charges, must not make the running total dip.
    const trend = [
      { usage_date: "2026-07-01", amount: 2.62 },
      { usage_date: "2026-07-02", amount: 0.01 },
      { usage_date: "2026-07-03", amount: 0 },
    ];

    const cumulative = toCumulative(trend);
    for (let i = 1; i < cumulative.length; i++) {
      expect(cumulative[i].amount).toBeGreaterThanOrEqual(cumulative[i - 1].amount);
    }
    expect(cumulative[cumulative.length - 1].amount).toBeCloseTo(2.63);
  });

  it("returns an empty array for an empty trend", () => {
    expect(toCumulative([])).toEqual([]);
  });

  it("resets the running total at each calendar month boundary", () => {
    // A last-6-months view spans multiple months; each month should read as its own
    // "cost so far this month" curve instead of stacking on top of prior months.
    const trend = [
      { usage_date: "2026-06-29", amount: 5 },
      { usage_date: "2026-06-30", amount: 1 },
      { usage_date: "2026-07-01", amount: 3 },
      { usage_date: "2026-07-02", amount: 0.5 },
    ];

    expect(toCumulative(trend)).toEqual([
      { usage_date: "2026-06-29", amount: 5 },
      { usage_date: "2026-06-30", amount: 6 },
      { usage_date: "2026-07-01", amount: 3 },
      { usage_date: "2026-07-02", amount: 3.5 },
    ]);
  });
});
