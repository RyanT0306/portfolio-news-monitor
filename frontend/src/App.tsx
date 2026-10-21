import { useEffect, useState } from "react";
import { HistoryList } from "./components/HistoryList";
import { HoldingsEditor } from "./components/HoldingsEditor";
import { ResultPanel } from "./components/ResultPanel";
import {
  ENGINE_NAMES,
  analyze,
  getHealth,
  type AnalyzeResponse,
  type EngineName,
  type EngineStatus,
  type HoldingInput,
} from "./lib/api";
import { EXAMPLES } from "./lib/examples";
import {
  addHistory,
  clearHistory,
  loadEngines,
  loadHistory,
  loadHoldings,
  saveEngines,
  saveHoldings,
  type HistoryEntry,
} from "./lib/storage";

const MIN_NEWS = 50;
const MAX_NEWS = 20000;

const ENGINE_HINTS: Record<EngineName, string> = {
  claude: "Reads the story like an analyst, including indirect effects.",
  finbert: "Free and local. Scores only sentences that name your companies.",
};

function validate(holdings: HoldingInput[], news: string, engines: EngineName[]): string | null {
  const filled = holdings.filter((h) => h.ticker.trim());
  if (!filled.length) return "Add at least one holding.";
  if (filled.some((h) => !Number.isFinite(h.weight) || h.weight <= 0)) return "Give every holding a weight above 0%.";
  const tickers = filled.map((h) => h.ticker.trim());
  if (new Set(tickers).size !== tickers.length) return "Each ASX code can only appear once.";
  if (news.trim().length < MIN_NEWS) return `Paste a longer story. It needs at least ${MIN_NEWS} characters.`;
  if (!engines.length) return "Choose at least one engine.";
  return null;
}

export default function App() {
  const [holdings, setHoldings] = useState<HoldingInput[]>(loadHoldings);
  const [news, setNews] = useState("");
  const [engines, setEngines] = useState<EngineName[]>(loadEngines);
  const [status, setStatus] = useState<Partial<Record<EngineName, EngineStatus>>>({});
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => saveHoldings(holdings), [holdings]);
  useEffect(() => saveEngines(engines), [engines]);

  // Poll engine status until FinBERT has finished loading.
  useEffect(() => {
    let timer: number | undefined;
    const check = () =>
      getHealth()
        .then((h) => {
          setStatus(h.engines);
          if (h.engines.finbert === "not_loaded") timer = window.setTimeout(check, 3000);
        })
        .catch(() => setStatus({}));
    check();
    return () => window.clearTimeout(timer);
  }, []);

  function toggleEngine(name: EngineName) {
    setEngines((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]));
  }

  async function run() {
    const problem = validate(holdings, news, engines);
    setError(problem);
    if (problem) return;
    const cleaned = holdings
      .filter((h) => h.ticker.trim())
      .map((h) => ({ ticker: h.ticker.trim(), weight: h.weight }));
    setLoading(true);
    try {
      const res = await analyze(cleaned, news.trim(), engines);
      setResponse(res);
      setHistory(addHistory({ news: news.trim(), holdings: cleaned, response: res }));
      // On a single-column layout the result sits below the form.
      if (window.matchMedia("(max-width: 860px)").matches) {
        document.querySelector(".result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function openHistory(entry: HistoryEntry) {
    setHoldings(entry.holdings);
    setNews(entry.news);
    setResponse(entry.response);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="page">
      <header className="masthead">
        <h1>Portfolio News Monitor</h1>
        <p>Paste a news story and see whether it's good or bad for your ASX portfolio, weighted by what you hold.</p>
      </header>

      <main className="layout">
        <div className="inputs">
          <HoldingsEditor holdings={holdings} onChange={setHoldings} />

          <div className="news">
            <label htmlFor="news">News story</label>
            <textarea
              id="news"
              value={news}
              maxLength={MAX_NEWS}
              rows={9}
              placeholder="Paste the headline and article text here."
              onChange={(e) => setNews(e.target.value)}
            />
            <div className="news-foot">
              <div className="samples">
                <span className="muted">Try a sample:</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex.title} type="button" className="chip" onClick={() => setNews(ex.text)}>
                    {ex.title}
                  </button>
                ))}
              </div>
              <span className="muted">{news.length.toLocaleString()} characters</span>
            </div>
            <p className="muted small">Sample stories are made up for demonstration.</p>
          </div>

          <fieldset className="engines">
            <legend>Engine</legend>
            {(Object.keys(ENGINE_NAMES) as EngineName[]).map((name) => (
              <div key={name} className="engine">
                <button
                  type="button"
                  className="engine-toggle"
                  aria-pressed={engines.includes(name)}
                  onClick={() => toggleEngine(name)}
                >
                  <span className="engine-check" aria-hidden="true" />
                  <span>
                    <strong>{ENGINE_NAMES[name]}</strong>
                    <span className="muted">{ENGINE_HINTS[name]}</span>
                  </span>
                </button>
                {engines.includes(name) && <EngineNote name={name} status={status[name]} />}
              </div>
            ))}
            {engines.length === 2 && <p className="muted small">Both engines run side by side so you can compare them.</p>}
          </fieldset>

          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="primary" onClick={run} disabled={loading}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        <ResultPanel response={response} loading={loading} />
      </main>

      <HistoryList entries={history} onOpen={openHistory} onClear={() => setHistory(clearHistory())} />

      <footer className="footer">
        For research and education only. Not investment advice. ASX company list from asx.com.au.
      </footer>
    </div>
  );
}

function EngineNote({ name, status }: { name: EngineName; status?: EngineStatus }) {
  if (name === "claude" && status === "unavailable")
    return (
      <p className="notice small">
        Claude needs an API key. Add <code>ANTHROPIC_API_KEY</code> to <code>backend/.env</code> and restart the
        backend. You can get a key at console.anthropic.com.
      </p>
    );
  if (name === "finbert" && status === "not_loaded")
    return <p className="notice small">FinBERT is loading. The first run downloads the model, which can take a minute.</p>;
  if (name === "finbert" && status === "unavailable")
    return (
      <p className="notice small">
        FinBERT isn't installed. Run <code>pip install -e '.[finbert]'</code> in <code>backend</code>.
      </p>
    );
  return null;
}
