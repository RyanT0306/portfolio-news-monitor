import { describe, expect, it } from "vitest";
import type { HoldingScore, PortfolioResult } from "./api";
import { notScoredLabel, skippedNotice } from "./assessment";

function holding(ticker: string, patch: Partial<HoldingScore> = {}): HoldingScore {
  return {
    ticker,
    name: null,
    weight: 0.5,
    relevant: false,
    assessed: true,
    effective_weight: 0,
    bullish: null,
    neutral: null,
    bearish: null,
    score: null,
    label: null,
    reason: "",
    confidence: null,
    ...patch,
  };
}

function result(holdings: HoldingScore[]): PortfolioResult {
  return {
    engine: "claude",
    status: "ok",
    score: 50,
    label: "Neutral",
    bullish: 0,
    neutral: 1,
    bearish: 0,
    exposure: 0.5,
    holdings,
    summary: null,
    key_points: [],
    time_horizon: [],
    risks: [],
    watch_items: [],
    error: null,
  };
}

describe("notScoredLabel", () => {
  it("tells a skipped holding apart from one the story doesn't touch", () => {
    expect(notScoredLabel(holding("CBA", { assessed: false }))).toBe("Not assessed");
    expect(notScoredLabel(holding("CBA"))).toBe("Not affected");
  });

  it("treats history saved before the field existed as assessed", () => {
    const { assessed: _, ...old } = holding("CBA");
    expect(notScoredLabel(old as HoldingScore)).toBe("Not affected");
  });
});

describe("skippedNotice", () => {
  it("is empty when every holding was assessed", () => {
    expect(skippedNotice(result([holding("BHP"), holding("CBA")]))).toBeNull();
  });

  it("names one skipped holding", () => {
    expect(skippedNotice(result([holding("BHP"), holding("CBA", { assessed: false })]))).toBe(
      "Claude skipped CBA, so it isn't part of this score. Try again to include it.",
    );
  });

  it("lists several skipped holdings", () => {
    const skipped = ["BHP", "CBA", "CSL"].map((t) => holding(t, { assessed: false }));
    expect(skippedNotice(result(skipped))).toBe(
      "Claude skipped BHP, CBA and CSL, so they aren't part of this score. Try again to include them.",
    );
  });
});
