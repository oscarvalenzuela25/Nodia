"""Explicit audio metadata for NodiaAI's already validated native files.

This narrow transport experiment retains the installed SDK's upload, endpoint,
original file bytes and filename. The descriptor shape comes from upstream
PR179; only exact-format real canaries can establish working account support.
"""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

_AUDIO_MEDIA_TYPES = frozenset({"audio/wav", "audio/ogg", "audio/webm", "audio/mpeg", "audio/mp4"})
_OTHER_MEDIA_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "application/pdf"})


@dataclass(frozen=True)
class _AudioScope:
    client: object
    task: asyncio.Task | None
    names: tuple[str, ...]
    media_types: tuple[str, ...]


_owner: ContextVar[_AudioScope | None] = ContextVar("nodia_web_audio_transport", default=None)


def new_audio_transport_diagnostic() -> dict[str, object]:
    return {"scoped": False, "applied": False, "input_files": None,
            "audio_files": None, "audio_media_types": [], "descriptor_version": None}


@contextmanager
def native_audio_transport(client: object, files: object, media_types: list[str] | None = None) -> Iterator[None]:
    if media_types is None:
        yield
        return
    if (type(media_types) is not list or not 1 <= len(media_types) <= 4
            or any(type(media) is not str or media not in _AUDIO_MEDIA_TYPES | _OTHER_MEDIA_TYPES
                   for media in media_types)):
        raise ValueError("Invalid native Web audio metadata")
    if not any(media in _AUDIO_MEDIA_TYPES for media in media_types):
        yield
        return
    if (type(files) is not list or len(files) != len(media_types)
            or any(not isinstance(file, Path) or not file.name for file in files)
            or _owner.get() is not None):
        raise ValueError("Invalid native Web audio files")
    token = _owner.set(_AudioScope(client, asyncio.current_task(),
        tuple(file.name for file in files), tuple(media_types)))
    try:
        yield
    finally:
        _owner.reset(token)


def native_audio_scope_active(client: object) -> bool:
    scope = _owner.get()
    return scope is not None and scope.client is client and scope.task is asyncio.current_task()


def adapt_req_file_data(client: object, req_file_data: object, trace: object | None = None) -> object:
    scope = _owner.get()
    if scope is None or not native_audio_scope_active(client):
        return req_file_data
    diagnostic = getattr(trace, "audio_transport", None) if trace is not None else None
    if type(diagnostic) is dict:
        diagnostic["scoped"] = True
    if type(req_file_data) is not list or len(req_file_data) != len(scope.names):
        raise ValueError("Unverified native Web attachment descriptor")
    transformed = []
    audio_types = []
    for item, name, media in zip(req_file_data, scope.names, scope.media_types, strict=True):
        if (type(item) is not list or len(item) != 2 or type(item[0]) is not list
                or len(item[0]) != 1 or type(item[0][0]) is not str
                or not 1 <= len(item[0][0]) <= 4096
                or any(ord(character) < 32 or ord(character) == 127 for character in item[0][0])
                or type(item[1]) is not str or item[1] != name):
            raise ValueError("Unverified native Web attachment descriptor")
        if media in _AUDIO_MEDIA_TYPES:
            # Historical upstream PR179: audio=4, explicit MIME at index3.
            # Never infer an enum or MIME from a model or filename.
            transformed.append([[item[0][0], 4, None, media], item[1]])
            audio_types.append(media)
        else:
            transformed.append(item)
    if type(diagnostic) is dict:
        diagnostic.update(scoped=True, applied=True, input_files=len(req_file_data),
            audio_files=len(audio_types), audio_media_types=list(dict.fromkeys(audio_types)),
            descriptor_version="explicit-audio/1")
    return transformed
