"""ASX company directory and 'does this sentence mention this holding?' matching."""

import csv
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from .models import HoldingIn, ResolvedHolding

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "asx_companies.csv"

_LEGAL_SUFFIXES = {"limited", "ltd", "nl", "inc", "plc", "corporation", "corp", "holdings", "group", "co"}

# Tickers that double as English words or common acronyms. A bare match would
# fire on ordinary text, so these only count with an exchange marker.
_AMBIGUOUS_TICKERS = {
    "ACT", "AFL", "AI", "AIR", "ALL", "AND", "ARE", "ARR", "ASX", "ATM", "BAD", "BBC", "BIG", "BOT",
    "CAN", "CAR", "CAT", "CEO", "CIA", "CMO", "COL", "CPI", "CPU", "CTO", "DIG", "DOG", "DOW", "EAT",
    "ESG", "ETF", "EV", "FOR", "FUN", "G20", "GAS", "GDP", "GO", "HOT", "ICE", "ICU", "IPO", "IT",
    "JOB", "LED", "MAD", "MIN", "NEW", "NFL", "NOW", "NRL", "OIL", "ONE", "ORG", "PAY", "PET", "RAM",
    "RBA", "RED", "SEA", "SEC", "SKY", "SMS", "SPP", "SPX", "SUN", "TOP", "USA", "WIN", "WOW",
}


@dataclass(frozen=True)
class Company:
    ticker: str
    name: str
    industry: str
    aliases: tuple[str, ...]


@cache
def _directory() -> dict[str, Company]:
    with DATA_FILE.open(encoding="utf-8") as f:
        return {
            row["ticker"]: Company(
                ticker=row["ticker"],
                name=row["name"],
                industry=row["industry"],
                aliases=tuple(a for a in row["aliases"].split("|") if a),
            )
            for row in csv.DictReader(f)
        }


def get_company(ticker: str) -> Company | None:
    return _directory().get(ticker.upper())


def search(query: str, limit: int = 8) -> list[Company]:
    q = query.strip().upper()
    if not q:
        return []
    companies = _directory().values()
    by_ticker = [c for c in companies if c.ticker.startswith(q)]
    by_ticker.sort(key=lambda c: (len(c.ticker), c.ticker))
    by_name = [c for c in companies if q in c.name.upper() and c not in by_ticker]
    return (by_ticker + by_name)[:limit]


def core_name(name: str) -> str:
    """Drop trailing legal words: 'BHP Group Limited' -> 'BHP'."""
    words = name.split()
    while len(words) > 1 and words[-1].lower().rstrip(".") in _LEGAL_SUFFIXES:
        words.pop()
    if len(words) > 1 and words[0].lower() == "the":
        words.pop(0)
    return " ".join(words)


def resolve(holdings: list[HoldingIn], weights: list[float]) -> list[ResolvedHolding]:
    out = []
    for h, w in zip(holdings, weights, strict=True):
        c = get_company(h.ticker)
        if c is None:
            out.append(ResolvedHolding(ticker=h.ticker, weight=w))
            continue
        terms = [c.name, core_name(c.name), *c.aliases]
        terms = [t for t in dict.fromkeys(terms) if len(t) >= 3 and t != h.ticker]
        out.append(ResolvedHolding(ticker=h.ticker, weight=w, name=c.name, industry=c.industry, aliases=terms))
    return out


@cache
def _term_pattern(term: str) -> re.Pattern[str]:
    # Case-sensitive on purpose: "Origin" the company, not "origin" the word.
    # The all-caps form covers headlines.
    # Either apostrophe counts: "Domino's" and "Domino’s".
    alternatives = {re.escape(t.replace("’", "'")).replace("'", "['’]") for t in (term, term.upper())}
    return re.compile(r"(?<![\w])(?:" + "|".join(alternatives) + r")(?![\w])")


@cache
def _ticker_pattern(ticker: str) -> re.Pattern[str]:
    t = re.escape(ticker)
    prefixed = rf"ASX\s*:\s*{t}(?![\w])|(?<![\w]){t}\.AX(?![\w])"
    if ticker in _AMBIGUOUS_TICKERS:
        return re.compile(prefixed)
    return re.compile(rf"{prefixed}|(?<![\w]){t}(?![\w])")


def mentions(text: str, holding: ResolvedHolding) -> bool:
    if _ticker_pattern(holding.ticker).search(text):
        return True
    return any(_term_pattern(term).search(text) for term in holding.aliases)
