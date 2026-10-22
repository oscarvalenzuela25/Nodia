"""Versioned Gemini Web reasoning transport, scoped to observed model profiles.

Only generation's two observed reasoning fields are replaced. The SDK retains
ownership of authentication, discovery, uploads, parsing and transport cleanup.
"""
from __future__ import annotations

import asyncio
from contextvars import ContextVar
from contextlib import aclosing
from dataclasses import dataclass
from importlib.metadata import version
import json
import re
from typing import Any, Literal
from collections.abc import AsyncGenerator
from collections.abc import Mapping
from types import MappingProxyType
from pathlib import Path

from web_generation_diagnostics import DiagnosticWebClient
from gemini_webapi.constants import Endpoint, MODEL_HEADER_KEY

Level = Literal["low", "medium", "high"]
LEVELS = ("low", "medium", "high")
VERIFIED_SDK_VERSION = "2.1.1"


@dataclass(frozen=True)
class ObservedProfile:
    model_id: str
    codes: tuple[int, int, int]
    model_number: int

    def __post_init__(self) -> None:
        if (not isinstance(self.model_id, str) or not re.fullmatch(r"[0-9a-f]{16}", self.model_id)
                or not isinstance(self.codes, tuple) or len(self.codes) != 3
                or any(type(code) is not int or not 1 <= code <= 100 for code in self.codes)
                or len(set(self.codes)) != 3 or type(self.model_number) is not int):
            raise ValueError("Invalid observed profile")

    @classmethod
    def from_observations(cls, records: object) -> ObservedProfile:
        if not isinstance(records, list) or not 3 <= len(records) <= 12:
            raise ValueError("Three observed levels are required")
        models: set[str] = set()
        model_numbers: set[int] = set()
        codes: dict[str, int] = {}
        for record in records:
            if not isinstance(record, dict):
                raise ValueError("Invalid observation")
            level = record.get("level")
            model = record.get("model_id")
            body, header = record.get("body_shape"), record.get("header_shape")
            if (level not in LEVELS or not isinstance(model, str)
                    or not re.fullmatch(r"[0-9a-f]{16}", model)
                    or record.get("http_status") != 200
                    or not isinstance(body, list) or len(body) != 99
                    or not isinstance(header, list) or len(header) != 20):
                raise ValueError("Unverified native request shape")
            code = body[80]
            if (type(code) is not int or not 1 <= code <= 100
                    or type(header[15]) is not int or header[15] != code
                    or type(body[79]) is not int or type(header[14]) is not int
                    or body[79] != header[14]):
                raise ValueError("Inconsistent reasoning fields")
            if level in codes and codes[level] != code:
                raise ValueError("Inconsistent repeated level")
            models.add(model)
            model_numbers.add(body[79])
            codes[level] = code
        if (len(models) != 1 or len(model_numbers) != 1
                or set(codes) != set(LEVELS) or len(set(codes.values())) != 3):
            raise ValueError("Levels must be distinct for the same observed model")
        return cls(models.pop(), tuple(codes[level] for level in LEVELS), model_numbers.pop())

    def code(self, level: str) -> int:
        if level not in LEVELS:
            raise ValueError("Unsupported reasoning level")
        return self.codes[LEVELS.index(level)]


def rewrite_generation(headers: object, data: object, profile: ObservedProfile,
                       level: Level) -> tuple[dict[str, Any], dict[str, Any]]:
    """Validate SDK 2.1.1's layout before copying exactly two numeric fields."""
    try:
        if not isinstance(headers, dict) or not isinstance(data, dict):
            raise ValueError
        header = json.loads(headers[MODEL_HEADER_KEY])
        outer = json.loads(data["f.req"])
        if not isinstance(outer, list) or len(outer) != 2 or outer[0] is not None:
            raise ValueError
        body = json.loads(outer[1])
        if (not isinstance(header, list) or len(header) != 17
                or header[4] != profile.model_id
                or not isinstance(body, list) or len(body) != 81
                or type(header[14]) is not int or type(body[79]) is not int
                or body[79] != header[14] or header[14] != profile.model_number
                or type(header[15]) is not int or header[15] not in (1, 2)
                or type(body[80]) is not int or body[80] != header[15]):
            raise ValueError
    except (ValueError, TypeError, KeyError, IndexError):
        raise ValueError("SDK request is incompatible with observed reasoning protocol") from None
    code = profile.code(level)
    header[15] = body[80] = code
    return ({**headers, MODEL_HEADER_KEY: json.dumps(header)},
            {**data, "f.req": json.dumps([None, json.dumps(body)])})


_active: ContextVar[tuple[object, Level, ObservedProfile] | None] = ContextVar("web_reasoning", default=None)
_requested: ContextVar[tuple[object, Level, ObservedProfile] | None] = ContextVar("web_reasoning_request", default=None)


class _GenerationTransport:
    def __init__(self, session: Any, profile: ObservedProfile, level: Level):
        self.session, self.profile, self.level = session, profile, level

    def __getattr__(self, name: str) -> Any:
        return getattr(self.session, name)

    def stream(self, method: str, url: object, **kwargs: Any) -> Any:
        if method == "POST" and url == Endpoint.GENERATE:
            headers, data = rewrite_generation(kwargs.get("headers"), kwargs.get("data"),
                                               self.profile, self.level)
            kwargs = {**kwargs, "headers": headers, "data": data}
        return self.session.stream(method, url, **kwargs)


def load_profiles(path: Path) -> Mapping[str, ObservedProfile]:
    if path.stat().st_size > 131072:
        raise ValueError("Reasoning profiles exceed the configuration limit")
    document = json.loads(path.read_text(encoding="utf-8"))
    if (not isinstance(document, dict) or set(document) != {"sdk_version", "observations"}
            or document["sdk_version"] != VERIFIED_SDK_VERSION
            or not isinstance(document["observations"], list)
            or not 1 <= len(document["observations"]) <= 64):
        raise ValueError("Invalid reasoning profile configuration")
    profiles: dict[str, ObservedProfile] = {}
    for records in document["observations"]:
        profile = ObservedProfile.from_observations(records)
        if profile.model_id in profiles:
            raise ValueError("Duplicate reasoning model profile")
        profiles[profile.model_id] = profile
    return MappingProxyType(profiles)


class ReasoningWebClient(DiagnosticWebClient):
    def __init__(self, *args: Any, profiles: Mapping[str, ObservedProfile] | None = None,
                 observed_profile: ObservedProfile | None = None, **kwargs: Any):
        if version("gemini-webapi") != VERIFIED_SDK_VERSION:
            raise ValueError("SDK version must be verified before using reasoning levels")
        super().__init__(*args, **kwargs)
        if observed_profile is not None:
            if profiles is not None:
                raise ValueError("Use one profile source")
            profiles = {observed_profile.model_id: observed_profile}
        self.reasoning_profiles = MappingProxyType(dict(profiles or {}))
        self._experiment_lock = asyncio.Lock()

    @property
    def _live_client(self) -> Any:
        session = super()._live_client
        context = _active.get()
        if context is not None and context[0] is self:
            return _GenerationTransport(session, context[2], context[1])
        return session

    async def _generate(self, *args: Any, **kwargs: Any) -> AsyncGenerator[Any, None]:
        # Upload's validated API must receive the real AsyncSession. Adapt only
        # generation, after the SDK has uploaded files and synchronized activity.
        requested = _requested.get()
        token = _active.set(requested) if requested is not None and requested[0] is self else None
        try:
            async with aclosing(super()._generate(*args, **kwargs)) as generation:
                async for result in generation:
                    yield result
        finally:
            if token is not None:
                _active.reset(token)

    async def generate_content(self, prompt: str, *, thinking_level: Level | None = None,
                               **kwargs: Any) -> Any:
        if self._experiment_lock.locked():
            raise RuntimeError("Concurrent generation is not supported by the reasoning adapter")
        if thinking_level is not None:
            if "extended_thinking" in kwargs or kwargs.get("current_retry", 0) != 0:
                raise ValueError("Explicit levels require no boolean override or generation retry")
            model = kwargs.get("model")
            model_id = model if isinstance(model, str) else getattr(model, "model_id", None)
            profile = self.reasoning_profiles.get(model_id)
            if profile is None:
                raise ValueError("Reasoning protocol was not observed for this model")
            profile.code(thinking_level)
        async with self._experiment_lock:
            token = _requested.set((self, thinking_level, profile)) if thinking_level is not None else None
            try:
                if thinking_level is not None:
                    kwargs = {**kwargs, "current_retry": 0}
                return await super().generate_content(prompt, **kwargs)
            finally:
                if token is not None:
                    _requested.reset(token)
