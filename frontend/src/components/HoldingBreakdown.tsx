import type { HoldingScore } from "../lib/api";
import { notScoredLabel } from "../lib/assessment";
import { zoneFor } from "../lib/gauge";
import { pct } from "../lib/format";

export function ProbabilityBar({ bullish, neutral, bearish }: { bullish: number; neutral: number; bearish: number }) {
  return (
    <div
      className="prob-bar"
      role="img"
      aria-label={`Bullish ${pct(bullish)}, neutral ${pct(neutral)}, bearish ${pct(bearish)}`}
    >
      <span className="tone-bull-strong" style={{ flexGrow: bullish }} />
      <span className="tone-neutral" style={{ flexGrow: neutral }} />
      <span className="tone-bear-strong" style={{ flexGrow: bearish }} />
    </div>
  );
}

export function HoldingBreakdown({ holdings }: { holdings: HoldingScore[] }) {
  const sorted = [...holdings].sort((a, b) => Number(b.relevant) - Number(a.relevant) || b.weight - a.weight);
  return (
    <ul className="breakdown">
      {sorted.map((h) => (
        <li key={h.ticker} className="holding" data-relevant={h.relevant}>
          <div className="holding-head">
            <div className="holding-id">
              <strong>{h.ticker}</strong>
              {h.name && <span className="muted">{h.name}</span>}
            </div>
            <div className="holding-weight muted">{pct(h.weight)} of portfolio</div>
            {h.relevant && h.score !== null ? (
              <div className={`holding-score tone-text-${zoneFor(h.score).tone}`}>
                <strong>{h.score}</strong> {h.label}
              </div>
            ) : (
              <div className="holding-score muted">{notScoredLabel(h)}</div>
            )}
          </div>
          {h.relevant && h.bullish !== null && h.neutral !== null && h.bearish !== null && (
            <ProbabilityBar bullish={h.bullish} neutral={h.neutral} bearish={h.bearish} />
          )}
          {h.reason && (
            <p className="holding-reason">
              {h.reason}
              {h.relevant && h.confidence !== null && <span className="muted"> Confidence {h.confidence}%.</span>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
