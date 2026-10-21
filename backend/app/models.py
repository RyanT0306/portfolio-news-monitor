"""Request, response, and engine data shapes shared across the backend."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

EngineName = Literal["claude", "finbert"]
Label = Literal["Strongly bearish", "Bearish", "Neutral", "Bullish", "Strongly bullish"]
Status = Literal["ok", "unrelated", "error"]


# ---- API input ----------------------------------------------------------------


class HoldingIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=8)
    weight: float = Field(gt=0, le=100)

    @field_validator("ticker")
    @classmethod
    def _clean_ticker(cls, v: str) -> str:
        v = v.strip().upper().removesuffix(".AX")
        if not v.isalnum():
            raise ValueError("Ticker must be letters and digits only")
        return v


class AnalyzeRequest(BaseModel):
    holdings: list[HoldingIn] = Field(min_length=1, max_length=30)
    news: str = Field(min_length=50, max_length=20_000)
    engines: list[EngineName] = Field(min_length=1, max_length=2)

    @model_validator(mode="after")
    def _unique(self) -> "AnalyzeRequest":
        tickers = [h.ticker for h in self.holdings]
        if len(set(tickers)) != len(tickers):
            raise ValueError("Each ticker can only appear once")
        self.engines = list(dict.fromkeys(self.engines))
        return self


class FetchArticleRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2_000)


# ---- Engine contract ----------------------------------------------------------


class ResolvedHolding(BaseModel):
    """A holding after weight normalization and ASX lookup."""

    ticker: str
    weight: float  # fraction of the portfolio, 0-1
    name: str | None = None
    industry: str | None = None
    aliases: list[str] = []  # names the press uses for this company


class HoldingSentiment(BaseModel):
    """One engine's view of one holding. Probabilities are fractions summing to 1."""

    ticker: str
    relevant: bool
    bullish: float = 0.0
    neutral: float = 1.0
    bearish: float = 0.0
    reason: str = ""
    confidence: int | None = None


class EngineResult(BaseModel):
    per_holding: list[HoldingSentiment]
    summary: str | None = None
    key_points: list[str] = []
    time_horizon: list[str] = []
    risks: list[str] = []
    watch_items: list[str] = []


# ---- API output ---------------------------------------------------------------


class HoldingScore(BaseModel):
    ticker: str
    name: str | None
    weight: float
    relevant: bool
    effective_weight: float
    bullish: float | None
    neutral: float | None
    bearish: float | None
    score: int | None
    label: Label | None
    reason: str
    confidence: int | None


class PortfolioResult(BaseModel):
    engine: EngineName
    status: Status
    score: int | None = None
    label: Label | None = None
    bullish: float | None = None
    neutral: float | None = None
    bearish: float | None = None
    exposure: float = 0.0
    holdings: list[HoldingScore] = []
    summary: str | None = None
    key_points: list[str] = []
    time_horizon: list[str] = []
    risks: list[str] = []
    watch_items: list[str] = []
    error: str | None = None


class AnalyzeResponse(BaseModel):
    weights_adjusted: bool
    results: list[PortfolioResult]


class Article(BaseModel):
    url: str
    title: str | None = None
    text: str
    truncated: bool = False
