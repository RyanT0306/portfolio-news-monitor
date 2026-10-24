import { describe, expect, it } from "vitest";
import { filledHoldings, weightTotal } from "./holdings";

describe("filledHoldings", () => {
  it("drops rows without an ASX code and trims the rest", () => {
    expect(
      filledHoldings([
        { ticker: " BHP ", weight: 40 },
        { ticker: "  ", weight: 30 },
        { ticker: "CBA", weight: 30 },
      ]),
    ).toEqual([
      { ticker: "BHP", weight: 40 },
      { ticker: "CBA", weight: 30 },
    ]);
  });
});

describe("weightTotal", () => {
  it("adds up only the rows that will be sent", () => {
    // The blank row is dropped before analysis, so it mustn't make the total look like 100%.
    const holdings = [
      { ticker: "BHP", weight: 40 },
      { ticker: "CBA", weight: 30 },
      { ticker: "", weight: 30 },
    ];
    expect(weightTotal(holdings)).toBe(70);
  });

  it("treats empty weights as 0", () => {
    expect(weightTotal([{ ticker: "BHP", weight: 60 }, { ticker: "CBA", weight: NaN }])).toBe(60);
  });
});
