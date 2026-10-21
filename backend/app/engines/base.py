from typing import Literal, Protocol

from ..models import EngineName, EngineResult, ResolvedHolding

EngineStatus = Literal["ready", "not_loaded", "unavailable"]


class EngineError(Exception):
    """A failure that's safe to show the user as-is."""


class Engine(Protocol):
    name: EngineName

    def status(self) -> EngineStatus: ...

    async def analyze(self, news: str, holdings: list[ResolvedHolding]) -> EngineResult: ...
