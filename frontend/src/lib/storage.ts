// Browser-only conveniences. Storage can be missing or throw (private mode,
// blocked site data), so every access falls back quietly.

import type { AnalyzeResponse, EngineName, HoldingInput } from "./api";
import { mergeHistory } from "./history";

const HOLDINGS_KEY = "pnm.holdings";
const ENGINES_KEY = "pnm.engines";
const HISTORY_KEY = "pnm.history";
const HISTORY_LIMIT = 20;

export interface HistoryEntry {
  id: string;
  at: string;
  news: string;
  holdings: HoldingInput[];
  response: AnalyzeResponse;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable; nothing to do
  }
}

export const DEFAULT_HOLDINGS: HoldingInput[] = [
  { ticker: "BHP", weight: 40 },
  { ticker: "CBA", weight: 30 },
  { ticker: "CSL", weight: 30 },
];

export const loadHoldings = () => read<HoldingInput[]>(HOLDINGS_KEY, DEFAULT_HOLDINGS);
export const saveHoldings = (h: HoldingInput[]) => write(HOLDINGS_KEY, h);

export const loadEngines = () => read<EngineName[]>(ENGINES_KEY, ["finbert"]);
export const saveEngines = (e: EngineName[]) => write(ENGINES_KEY, e);

export const loadHistory = () => read<HistoryEntry[]>(HISTORY_KEY, []);

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">): HistoryEntry[] {
  const full: HistoryEntry = { ...entry, id: crypto.randomUUID(), at: new Date().toISOString() };
  const next = mergeHistory(loadHistory(), full, HISTORY_LIMIT);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  write(HISTORY_KEY, []);
  return [];
}
