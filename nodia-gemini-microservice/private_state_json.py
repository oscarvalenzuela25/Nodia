"""Bounded, owner-only JSON reads; no operational state is read at import."""
import json
import os
from pathlib import Path
import stat


def read_private_json(directory: Path, name: str, *, maximum: int = 4096) -> dict | None:
    if Path(name).name != name or name in {".", ".."}:
        raise ValueError("Invalid private state name")
    parent = descriptor = None
    try:
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
        if os.name != "nt":
            parent = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            info = os.fstat(parent)
            if info.st_uid != os.getuid() or info.st_mode & 0o022:
                raise ValueError("Private state directory ownership mismatch")
            descriptor = os.open(name, flags, dir_fd=parent)
        else:
            descriptor = os.open(directory / name, flags)
        info = os.fstat(descriptor)
        if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > maximum
                or (os.name != "nt" and (info.st_uid != os.getuid() or info.st_mode & 0o077))):
            raise ValueError("Private state file ownership mismatch")
        if os.name == "nt":
            # No payload read until an opened Windows handle matches lstat.
            before = (directory / name).lstat()
            if not stat.S_ISREG(before.st_mode) or not os.path.samestat(before, info):
                raise ValueError("Private state file changed")
        with os.fdopen(descriptor, "rb") as source:
            descriptor = None
            raw = source.read(maximum + 1)
        if len(raw) > maximum:
            raise ValueError("Private state size limit")
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("Duplicate private state key")
                result[key] = value
            return result
        def invalid_constant(_):
            raise ValueError("Non-finite private state")
        value = json.loads(raw, object_pairs_hook=unique, parse_constant=invalid_constant)
        if not isinstance(value, dict):
            raise ValueError("Private state object required")
        return value
    except FileNotFoundError:
        return None
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if parent is not None:
            os.close(parent)
