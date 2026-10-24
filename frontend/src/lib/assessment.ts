// Holdings an engine left out of its answer. They're not in the score, like
// holdings the story doesn't touch, but the user should be told they were skipped.

import { ENGINE_NAMES, type HoldingScore, type PortfolioResult } from "./api";

// History saved before `assessed` existed has no such field; treat it as assessed.
const wasSkipped = (h: HoldingScore) => h.assessed === false;

export const notScoredLabel = (h: HoldingScore) => (wasSkipped(h) ? "Not assessed" : "Not affected");

function joinList(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function skippedNotice(result: PortfolioResult): string | null {
  const skipped = result.holdings.filter(wasSkipped).map((h) => h.ticker);
  if (!skipped.length) return null;
  const one = skipped.length === 1;
  return (
    `${ENGINE_NAMES[result.engine]} skipped ${joinList(skipped)}, so ${one ? "it isn't" : "they aren't"} ` +
    `part of this score. Try again to include ${one ? "it" : "them"}.`
  );
}
