// Which holding rows count. The editor's total and the request must agree,
// or the editor can say 100% while the server scales the weights.

import type { HoldingInput } from "./api";

/** Rows with an ASX code, trimmed. Blank rows are never sent. */
export function filledHoldings(holdings: HoldingInput[]): HoldingInput[] {
  return holdings.filter((h) => h.ticker.trim()).map((h) => ({ ticker: h.ticker.trim(), weight: h.weight }));
}

export function weightTotal(holdings: HoldingInput[]): number {
  return filledHoldings(holdings).reduce((sum, h) => sum + (Number.isFinite(h.weight) ? h.weight : 0), 0);
}
