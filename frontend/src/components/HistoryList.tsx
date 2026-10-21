import { ENGINE_NAMES } from "../lib/api";
import { zoneFor } from "../lib/gauge";
import { timeAgo } from "../lib/format";
import type { HistoryEntry } from "../lib/storage";

interface Props {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export function HistoryList({ entries, onOpen, onClear }: Props) {
  if (!entries.length) return null;
  return (
    <section className="history">
      <div className="history-head">
        <h2>Recent analyses</h2>
        <button type="button" className="text-button" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onOpen(e)}>
              <span className="history-text">{e.news.slice(0, 90)}</span>
              <span className="history-meta">
                <span className="muted">{timeAgo(e.at)}</span>
                {e.response.results.map((r) => (
                  <span key={r.engine} className="history-score">
                    {ENGINE_NAMES[r.engine]}{" "}
                    <strong className={r.score !== null ? `tone-text-${zoneFor(r.score).tone}` : "muted"}>
                      {r.score ?? "n/a"}
                    </strong>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
