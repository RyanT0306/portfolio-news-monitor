import pytest

from app.asx import resolve
from app.engines.finbert_engine import FinbertEngine, split_sentences
from app.models import HoldingIn


def fake_classifier(sentences):
    """Stands in for the FinBERT pipeline: 'fell' is negative, 'rose' positive."""
    out = []
    for s in sentences:
        if "fell" in s:
            scores = {"negative": 0.8, "neutral": 0.15, "positive": 0.05}
        elif "rose" in s:
            scores = {"negative": 0.1, "neutral": 0.2, "positive": 0.7}
        else:
            scores = {"negative": 0.1, "neutral": 0.8, "positive": 0.1}
        out.append([{"label": k, "score": v} for k, v in scores.items()])
    return out


def holdings(*tickers):
    return resolve([HoldingIn(ticker=t, weight=1) for t in tickers], [1 / len(tickers)] * len(tickers))


def test_split_sentences():
    text = "BHP fell 3%. Iron ore slumped!\nAnalysts were cautious? Yes."
    assert split_sentences(text) == ["BHP fell 3%.", "Iron ore slumped!", "Analysts were cautious?", "Yes."]


async def test_only_mentioned_holdings_are_relevant():
    engine = FinbertEngine(classifier=fake_classifier)
    result = await engine.analyze("BHP shares fell sharply on Monday. The weather was mild.", holdings("BHP", "CBA"))

    bhp, cba = result.per_holding
    assert bhp.relevant is True
    assert bhp.bearish == pytest.approx(0.8)
    assert bhp.bullish + bhp.neutral + bhp.bearish == pytest.approx(1.0)
    assert "BHP shares fell sharply" in bhp.reason
    assert cba.relevant is False


async def test_probabilities_are_averaged_across_mentioning_sentences():
    engine = FinbertEngine(classifier=fake_classifier)
    news = "Woolworths shares fell after the result. Later, Woolworths rose on buybacks."
    (wow,) = (await engine.analyze(news, holdings("WOW"))).per_holding

    assert wow.bearish == pytest.approx((0.8 + 0.1) / 2)
    assert wow.bullish == pytest.approx((0.05 + 0.7) / 2)


async def test_reason_quotes_at_most_two_sentences():
    engine = FinbertEngine(classifier=fake_classifier)
    news = "BHP rose. BHP rose again. BHP rose a third time."
    (bhp,) = (await engine.analyze(news, holdings("BHP"))).per_holding
    assert bhp.reason.count("BHP") == 2


async def test_each_sentence_is_classified_once():
    calls = []

    def counting(sentences):
        calls.append(list(sentences))
        return fake_classifier(sentences)

    engine = FinbertEngine(classifier=counting)
    await engine.analyze("BHP and Rio Tinto fell. Nothing else happened.", holdings("BHP", "RIO"))
    assert calls == [["BHP and Rio Tinto fell."]]


async def test_no_mentions_skips_the_model():
    def boom(_):
        raise AssertionError("classifier should not run")

    engine = FinbertEngine(classifier=boom)
    result = await engine.analyze("Markets were quiet across Asia today.", holdings("BHP"))
    assert result.per_holding[0].relevant is False


def test_status_reports_loaded_classifier():
    assert FinbertEngine(classifier=fake_classifier).status() == "ready"
