"""Claude engine: reads the article like an analyst would.

Unlike FinBERT it can connect indirect effects ("iron ore falls" -> bad for
BHP even if BHP isn't named). Claude returns integers in a fixed schema; the
backend then rescales and sanity-checks every number before it's shown.
"""

import os
from typing import Literal

import anthropic
from pydantic import BaseModel

from ..models import EngineResult, HoldingSentiment, ResolvedHolding
from .base import EngineError, EngineStatus

DEFAULT_MODEL = "claude-opus-5-5"
_FALLBACK_BETA = "server-side-fallback-2026-07-01"

SYSTEM_PROMPT = """\
You are an equity research analyst covering the Australian share market (ASX).
You're given a news article and a list of holdings in one investor's portfolio.
For each holding, judge how this article is likely to affect its share price.

Rules:
- Keep facts reported in the article separate from your own inference, and base
  your judgement on the article. Don't bring in outside news.
- A holding is relevant if the article affects it directly (it's named) or
  indirectly through a clear channel: commodity prices, interest rates, the
  Australian dollar, regulation, suppliers, customers, or competitors. Name the
  channel in the reason.
- If the link is speculative or you're unsure, mark the holding not relevant.
  Don't stretch.
- bullish, neutral, and bearish are your probabilities in whole percent and
  must add up to 100.
- Don't overstate one-off news as a long-term trend.
- Never give price targets or buy, sell, or hold advice.
- reason is one plain-English sentence. summary is at most two sentences about
  what the article means for this portfolio as a whole.
- Use each ticker exactly as given. Return one entry per holding.
"""


# Output schema. Bounds are enforced after parsing rather than in the schema,
# so a slightly off number is corrected instead of failing the whole request.
class ClaudeHolding(BaseModel):
    ticker: str
    relevant: bool
    bullish: int
    neutral: int
    bearish: int
    reason: str
    confidence: int


class ClaudeAnalysis(BaseModel):
    holdings: list[ClaudeHolding]
    summary: str
    key_points: list[str]
    time_horizon: list[Literal["short", "medium", "long"]]
    risks: list[str]
    watch_items: list[str]


class ClaudeEngine:
    name = "claude"

    def __init__(self, client=None, model: str | None = None):
        self._client = client
        self.model = model or os.getenv("CLAUDE_MODEL", DEFAULT_MODEL)

    def status(self) -> EngineStatus:
        if self._client is not None or os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"):
            return "ready"
        return "unavailable"

    def _get_client(self):
        if self._client is None:
            if self.status() == "unavailable":
                raise EngineError("Claude isn't set up. Add ANTHROPIC_API_KEY to backend/.env and restart the server.")
            self._client = anthropic.AsyncAnthropic(timeout=60, max_retries=2)
        return self._client

    async def analyze(self, news: str, holdings: list[ResolvedHolding]) -> EngineResult:
        client = self._get_client()
        prompt = _user_prompt(news, holdings)

        parsed = None
        for _ in range(2):  # one retry if the output doesn't fit the schema
            response = await self._call(client, prompt)
            if response.stop_reason == "refusal":
                raise EngineError("Claude declined to analyze this article.")
            parsed = response.parsed_output
            if parsed is not None:
                break
        if parsed is None:
            raise EngineError("Claude's answer didn't match the expected format. Try again.")

        return _to_result(parsed, holdings)

    async def _call(self, client, prompt: str):
        try:
            return await client.beta.messages.parse(
                model=self.model,
                max_tokens=16000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                output_format=ClaudeAnalysis,
                output_config={"effort": "low"},
                betas=[_FALLBACK_BETA],
                fallbacks="default",
            )
        except anthropic.AuthenticationError as exc:
            raise EngineError("Your Claude API key was rejected. Check ANTHROPIC_API_KEY.") from exc
        except anthropic.RateLimitError as exc:
            raise EngineError("Claude is rate-limited right now. Wait a moment and try again.") from exc
        except anthropic.APIConnectionError as exc:
            raise EngineError("Couldn't reach the Claude API. Check your internet connection.") from exc
        except anthropic.APIStatusError as exc:
            raise EngineError(f"The Claude API returned an error ({exc.status_code}).") from exc


def _user_prompt(news: str, holdings: list[ResolvedHolding]) -> str:
    lines = []
    for h in holdings:
        desc = h.name or "unknown company"
        if h.industry:
            desc += f", {h.industry}"
        lines.append(f"- {h.ticker} ({desc}), {h.weight * 100:.0f}% of the portfolio")
    return "Holdings:\n" + "\n".join(lines) + f"\n\nArticle:\n<article>\n{news}\n</article>"


def _clamp(v: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, v))


def _to_result(parsed: ClaudeAnalysis, holdings: list[ResolvedHolding]) -> EngineResult:
    by_ticker = {h.ticker.strip().upper(): h for h in parsed.holdings}
    per_holding = []
    for h in holdings:
        c = by_ticker.get(h.ticker)
        if c is None:
            per_holding.append(HoldingSentiment(ticker=h.ticker, relevant=False, reason="Not assessed."))
            continue
        bull, neu, bear = (_clamp(c.bullish), _clamp(c.neutral), _clamp(c.bearish))
        total = bull + neu + bear
        probs = (bull / total, neu / total, bear / total) if total else (0.0, 1.0, 0.0)
        per_holding.append(
            HoldingSentiment(
                ticker=h.ticker,
                relevant=c.relevant,
                bullish=probs[0],
                neutral=probs[1],
                bearish=probs[2],
                reason=c.reason.strip(),
                confidence=_clamp(c.confidence),
            )
        )
    return EngineResult(
        per_holding=per_holding,
        summary=parsed.summary.strip() or None,
        key_points=parsed.key_points,
        time_horizon=list(dict.fromkeys(parsed.time_horizon)),
        risks=parsed.risks,
        watch_items=parsed.watch_items,
    )
