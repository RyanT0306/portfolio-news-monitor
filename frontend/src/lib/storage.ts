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
  /** The article link the story was fetched from, if any. */
  url?: string;
  holdings: HoldingInput[];
  response: AnalyzeResponse;
}

// Saved data can have the wrong shape (an older version of the app, a hand
// edit), and a non-array here would crash the page on every load. `check`
// returns the cleaned value, or null to use the fallback.
function read<T>(key: string, fallback: T, check: (value: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (check(JSON.parse(raw)) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function checkHoldings(v: unknown): HoldingInput[] | null {
  if (!Array.isArray(v) || !v.every((h) => isObject(h) && typeof h.ticker === "string")) return null;
  // JSON saves an empty weight (NaN) as null.
  return v.map((h) => ({ ticker: h.ticker, weight: typeof h.weight === "number" ? h.weight : NaN }));
}

function checkEngines(v: unknown): EngineName[] | null {
  return Array.isArray(v) ? v.filter((e): e is EngineName => e === "claude" || e === "finbert") : null;
}

function checkHistory(v: unknown): HistoryEntry[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter(
    (e): e is HistoryEntry =>
      isObject(e) &&
      typeof e.id === "string" &&
      typeof e.at === "string" &&
      typeof e.news === "string" &&
      checkHoldings(e.holdings) !== null &&
      isObject(e.response) &&
      Array.isArray(e.response.results),
  );
}

// crypto.randomUUID only exists on https or localhost, not on a LAN address
// such as http://192.168.1.5:5173 used to try the app on a phone.
const newId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

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

export const loadHoldings = () => read(HOLDINGS_KEY, DEFAULT_HOLDINGS, checkHoldings);
export const saveHoldings = (h: HoldingInput[]) => write(HOLDINGS_KEY, h);

export const loadEngines = () => read<EngineName[]>(ENGINES_KEY, ["finbert"], checkEngines);
export const saveEngines = (e: EngineName[]) => write(ENGINES_KEY, e);

export const loadHistory = () => read<HistoryEntry[]>(HISTORY_KEY, [], checkHistory);

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">): HistoryEntry[] {
  const full: HistoryEntry = { ...entry, id: newId(), at: new Date().toISOString() };
  const next = mergeHistory(loadHistory(), full, HISTORY_LIMIT);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  write(HISTORY_KEY, []);
  return [];
}
