import { describe, expect, it } from "vitest";
import { ZONES, arcPath, needleRotation, pointAt, scoreToAngle, zoneFor } from "./gauge";

describe("scoreToAngle", () => {
  it("maps 0 to the left, 50 to the top, 100 to the right", () => {
    expect(scoreToAngle(0)).toBe(180);
    expect(scoreToAngle(50)).toBe(90);
    expect(scoreToAngle(100)).toBe(0);
  });

  it("clamps out-of-range scores", () => {
    expect(scoreToAngle(-10)).toBe(180);
    expect(scoreToAngle(140)).toBe(0);
  });
});

describe("pointAt", () => {
  it("puts score 50 straight above the centre", () => {
    const p = pointAt(50, 100, 100, 80);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(20);
  });

  it("puts score 0 on the left edge", () => {
    const p = pointAt(0, 100, 100, 80);
    expect(p.x).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(100);
  });
});

describe("arcPath", () => {
  it("draws a clockwise arc between two scores", () => {
    expect(arcPath(0, 100, 100, 100, 80)).toBe("M 20 100 A 80 80 0 0 1 180 100");
  });
});

describe("needleRotation", () => {
  it("rotates from pointing left at 0 to pointing right at 100", () => {
    expect(needleRotation(0)).toBe(0);
    expect(needleRotation(50)).toBe(90);
    expect(needleRotation(100)).toBe(180);
  });
});

describe("zones", () => {
  it("cover 0-100 without gaps", () => {
    expect(ZONES[0].from).toBe(0);
    expect(ZONES.at(-1)!.to).toBe(100);
    ZONES.slice(1).forEach((z, i) => expect(z.from).toBe(ZONES[i].to));
  });

  it.each([
    [0, "Strongly bearish"],
    [19, "Strongly bearish"],
    [20, "Bearish"],
    [39, "Bearish"],
    [40, "Neutral"],
    [60, "Neutral"],
    [61, "Bullish"],
    [80, "Bullish"],
    [81, "Strongly bullish"],
    [100, "Strongly bullish"],
  ])("score %i is %s, matching the backend", (score, label) => {
    expect(zoneFor(score).label).toBe(label);
  });
});
