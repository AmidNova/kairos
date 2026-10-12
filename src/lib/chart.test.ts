import { describe, expect, it } from "vitest";
import { niceTicks, percentChange, simulateHistory } from "./chart";
import { formatPercent } from "./format";

describe("niceTicks", () => {
  it("covers the range with round steps", () => {
    expect(niceTicks(165.81, 186.75)).toEqual([160, 170, 180, 190]);
    expect(niceTicks(0.2, 0.9)).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(1200, 1450)).toEqual([1200, 1300, 1400, 1500]);
  });

  it("still returns a usable axis for a flat series", () => {
    const ticks = niceTicks(224.99, 224.99);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThan(224.99);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(224.99);
  });

  it("returns nothing for non-finite input", () => {
    expect(niceTicks(Number.NaN, 10)).toEqual([]);
  });
});

describe("simulateHistory", () => {
  it("ends exactly on the scanned price, hourly", () => {
    const now = Date.parse("2026-10-12T10:00:00Z");
    const points = simulateHistory(174.99, now);
    expect(points).toHaveLength(24);
    expect(points.at(-1)).toEqual({ price: 174.99, checked_at: "2026-10-12T10:00:00.000Z" });
    expect(points[0].checked_at).toBe("2026-10-11T11:00:00.000Z");
  });
});

describe("percentChange", () => {
  it("compares first and last point", () => {
    const pts = [
      { price: 200, checked_at: "a" },
      { price: 150, checked_at: "b" },
    ];
    expect(percentChange(pts)).toBe(-25);
    expect(percentChange(pts.slice(0, 1))).toBeNull();
  });
});

describe("formatPercent", () => {
  it("uses a true minus sign and one decimal", () => {
    expect(formatPercent(-3.24)).toBe("−3.2 %");
    expect(formatPercent(2)).toBe("+2.0 %");
    expect(formatPercent(0)).toBe("0.0 %");
  });
});
