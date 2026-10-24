import type { Label } from "./gauge";

export type EngineName = "claude" | "finbert";
export type EngineStatus = "ready" | "not_loaded" | "unavailable";

export interface HoldingInput {
  ticker: string;
  weight: number;
}

export interface HoldingScore {
  ticker: string;
  name: string | null;
  weight: number;
  relevant: boolean;
  assessed?: boolean; // missing in history saved before it existed
  effective_weight: number;
  bullish: number | null;
  neutral: number | null;
  bearish: number | null;
  score: number | null;
  label: Label | null;
  reason: string;
  confidence: number | null;
}

export interface PortfolioResult {
  engine: EngineName;
  status: "ok" | "unrelated" | "error";
  score: number | null;
  label: Label | null;
  bullish: number | null;
  neutral: number | null;
  bearish: number | null;
  exposure: number;
  holdings: HoldingScore[];
  summary: string | null;
  key_points: string[];
  time_horizon: string[];
  risks: string[];
  watch_items: string[];
  error: string | null;
}

export interface AnalyzeResponse {
  weights_adjusted: boolean;
  results: PortfolioResult[];
}

export interface TickerMatch {
  ticker: string;
  name: string;
}

export const ENGINE_NAMES: Record<EngineName, string> = { claude: "Claude", finbert: "FinBERT" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("Can't reach the analysis server. Make sure the backend is running on port 8000.");
  }
  if (!res.ok) {
    // The dev proxy answers 5xx with a plain-text body when the backend is down.
    let detail =
      res.status >= 500
        ? "The analysis server didn't respond. Make sure the backend is running on port 8000."
        : `The server returned an error (${res.status}).`;
    try {
      const body = await res.json();
      const first = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
      if (first) detail = String(first).replace(/^Value error, /, "");
    } catch {
      // keep the generic message
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function getHealth() {
  return request<{ engines: Record<EngineName, EngineStatus> }>("/api/health");
}

export function searchTickers(q: string, signal?: AbortSignal) {
  return request<TickerMatch[]>(`/api/tickers?q=${encodeURIComponent(q)}`, { signal });
}

export function analyze(holdings: HoldingInput[], news: string, engines: EngineName[]) {
  return request<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings, news, engines }),
  });
}

export interface Article {
  url: string;
  title: string | null;
  text: string;
  truncated: boolean;
}

export function fetchArticle(url: string) {
  return request<Article>("/api/article", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}
