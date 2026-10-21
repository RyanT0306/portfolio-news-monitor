from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.asx import resolve
from app.engines.base import EngineError
from app.engines.claude_engine import ClaudeAnalysis, ClaudeEngine, ClaudeHolding
from app.models import HoldingIn


class FakeMessages:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def fake_client(*responses):
    messages = FakeMessages(*responses)
    return SimpleNamespace(beta=SimpleNamespace(messages=messages)), messages


def reply(analysis, stop_reason="end_turn"):
    return SimpleNamespace(stop_reason=stop_reason, parsed_output=analysis)


def analysis(*holdings, **extras):
    base = dict(summary="Iron ore prices fell.", key_points=[], time_horizon=["short"], risks=[], watch_items=[])
    base.update(extras)
    return ClaudeAnalysis(holdings=list(holdings), **base)


def ch(ticker, relevant=True, bull=0, neu=100, bear=0, reason="r", confidence=70):
    return ClaudeHolding(
        ticker=ticker, relevant=relevant, bullish=bull, neutral=neu, bearish=bear, reason=reason, confidence=confidence
    )


HOLDINGS = resolve([HoldingIn(ticker="BHP", weight=60), HoldingIn(ticker="CBA", weight=40)], [0.6, 0.4])
NEWS = "Iron ore prices slumped 8% overnight as Chinese steel demand weakened further."


async def test_probabilities_are_normalized_to_fractions():
    client, _ = fake_client(reply(analysis(ch("BHP", bull=10, neu=20, bear=70), ch("CBA", relevant=False))))
    result = await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)

    bhp, cba = result.per_holding
    assert (bhp.bullish, bhp.neutral, bhp.bearish) == pytest.approx((0.1, 0.2, 0.7))
    assert cba.relevant is False
    assert result.summary == "Iron ore prices fell."
    assert result.time_horizon == ["short"]


async def test_probabilities_that_dont_sum_to_100_are_rescaled():
    client, _ = fake_client(reply(analysis(ch("BHP", bull=30, neu=30, bear=90), ch("CBA", relevant=False))))
    (bhp, _) = (await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)).per_holding
    assert bhp.bearish == pytest.approx(0.6)
    assert bhp.bullish + bhp.neutral + bhp.bearish == pytest.approx(1.0)


async def test_all_zero_probabilities_become_neutral():
    client, _ = fake_client(reply(analysis(ch("BHP", bull=0, neu=0, bear=0), ch("CBA", relevant=False))))
    (bhp, _) = (await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)).per_holding
    assert bhp.neutral == 1.0


async def test_unknown_tickers_are_dropped_and_missing_ones_marked_unrelated():
    client, _ = fake_client(reply(analysis(ch("BHP", bear=100, neu=0), ch("XYZ", bull=100, neu=0))))
    result = await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)
    assert [h.ticker for h in result.per_holding] == ["BHP", "CBA"]
    assert result.per_holding[1].relevant is False


async def test_confidence_is_clamped():
    client, _ = fake_client(reply(analysis(ch("BHP", confidence=150), ch("CBA", confidence=-5))))
    bhp, cba = (await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)).per_holding
    assert bhp.confidence == 100 and cba.confidence == 0


async def test_request_uses_structured_output_and_fallbacks():
    client, messages = fake_client(reply(analysis(ch("BHP"), ch("CBA"))))
    await ClaudeEngine(client=client, model="claude-opus-5-5").analyze(NEWS, HOLDINGS)

    call = messages.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["output_format"] is ClaudeAnalysis
    assert call["fallbacks"] == "default"
    assert "server-side-fallback-2026-07-01" in call["betas"]
    prompt = call["messages"][0]["content"]
    assert "BHP" in prompt and "Commonwealth Bank of Australia" in prompt and NEWS in prompt


async def test_refusal_raises_a_readable_error():
    client, _ = fake_client(reply(None, stop_reason="refusal"))
    with pytest.raises(EngineError, match="declined"):
        await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)


async def test_unparseable_output_is_retried_once():
    client, messages = fake_client(reply(None), reply(analysis(ch("BHP"), ch("CBA"))))
    await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)
    assert len(messages.calls) == 2


async def test_unparseable_output_twice_raises():
    client, _ = fake_client(reply(None), reply(None))
    with pytest.raises(EngineError):
        await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)


async def test_bad_api_key_raises_a_readable_error():
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    err = anthropic.AuthenticationError("bad key", response=httpx.Response(401, request=request), body=None)
    client, _ = fake_client(err)
    with pytest.raises(EngineError, match="API key"):
        await ClaudeEngine(client=client).analyze(NEWS, HOLDINGS)


def test_status_without_key_is_unavailable(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert ClaudeEngine().status() == "unavailable"


def test_status_with_key_is_ready(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    assert ClaudeEngine().status() == "ready"
