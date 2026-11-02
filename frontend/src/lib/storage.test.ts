import { describe, expect, it } from "vitest";
import { DEFAULT_HOLDINGS, loadEngines, loadHistory, loadHoldings } from "./storage";

// Tests run in Node, which has no localStorage, so each test installs its own.
function withStorage(items: Record<string, string>) {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => items[k] ?? null,
    setItem: (k: string, v: string) => {
      items[k] = v;
    },
  };
}

const entry = {
  id: "1",
  at: "2026-10-24T00:00:00.000Z",
  news: "CBA posts a record profit.",
  holdings: [{ ticker: "CBA", weight: 100 }],
  response: { weights_adjusted: false, results: [] },
};

describe("saved data with the wrong shape falls back instead of crashing the page", () => {
  it.each(["null", "{}", '"BHP"', "42"])("holdings saved as %s", (raw) => {
    withStorage({ "pnm.holdings": raw });
    expect(loadHoldings()).toEqual(DEFAULT_HOLDINGS);
  });

  it("holdings rows without a ticker", () => {
    withStorage({ "pnm.holdings": '[{"weight": 50}]' });
    expect(loadHoldings()).toEqual(DEFAULT_HOLDINGS);
  });

  it("an empty weight comes back empty, not as null", () => {
    // JSON turns NaN (an empty weight box) into null.
    withStorage({ "pnm.holdings": '[{"ticker": "BHP", "weight": null}]' });
    const [h] = loadHoldings();
    expect(h.ticker).toBe("BHP");
    expect(Number.isNaN(h.weight)).toBe(true);
  });

  it.each(["null", '"finbert"', "{}"])("engines saved as %s", (raw) => {
    withStorage({ "pnm.engines": raw });
    expect(loadEngines()).toEqual(["finbert"]);
  });

  it("unknown engine names are dropped", () => {
    withStorage({ "pnm.engines": '["claude", "gpt"]' });
    expect(loadEngines()).toEqual(["claude"]);
  });

  it.each(["null", "{}", '"x"'])("history saved as %s", (raw) => {
    withStorage({ "pnm.history": raw });
    expect(loadHistory()).toEqual([]);
  });

  it("history keeps good entries and drops broken ones", () => {
    withStorage({ "pnm.history": JSON.stringify([entry, { id: "2" }, null, { ...entry, id: "3", response: {} }]) });
    expect(loadHistory().map((e) => e.id)).toEqual(["1"]);
  });
});

describe("saved data in the right shape is kept", () => {
  it("holdings, engines and history", () => {
    withStorage({
      "pnm.holdings": '[{"ticker": "WES", "weight": 100}]',
      "pnm.engines": '["claude", "finbert"]',
      "pnm.history": JSON.stringify([entry]),
    });
    expect(loadHoldings()).toEqual([{ ticker: "WES", weight: 100 }]);
    expect(loadEngines()).toEqual(["claude", "finbert"]);
    expect(loadHistory()).toEqual([entry]);
  });
});
