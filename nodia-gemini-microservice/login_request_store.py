"""Small private login dispatch journal. It contains identities/proof, never credentials.

The lock also fences a cancelled request against a delayed supervisor. A deadline
is mandatory at admission: pruning a terminal record cannot resurrect an old start.
"""
from contextlib import asynccontextmanager, contextmanager
import asyncio
import errno
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import stat
import time
from uuid import UUID, uuid4

from service_errors import ServiceError

TERMINAL = frozenset({"succeeded", "failed", "cancelled"})


def _private_directory(directory: Path) -> None:
    for parent in (directory, *directory.parents):
        info = parent.lstat()
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
            raise ValueError()
        if os.name != "nt" and (info.st_uid not in (0, os.getuid()) or info.st_mode & 0o022):
            # /tmp is an explicit kernel-controlled sticky parent; the private
            # owned child is still 0700. Shared writable ancestors otherwise fail.
            if parent != Path("/tmp") or not info.st_mode & stat.S_ISVTX:
                raise ValueError()
    if os.name != "nt" and (directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o077):
        raise ValueError()


def _private_file(info) -> None:
    if not stat.S_ISREG(info.st_mode):
        raise ValueError()
    if os.name != "nt" and (info.st_uid != os.getuid() or info.st_mode & 0o077):
        raise ValueError()


def _record(record: dict, key: str) -> dict:
    required = {"version", "id", "request_id", "engine", "actor", "provider", "expires_at", "state",
                "resource_key", "supervisor", "containment", "closure_proof"}
    if not isinstance(record, dict) or not required <= record.keys() or record.keys() - required - {"acknowledged", "reason", "candidate_state"}:
        raise ValueError()
    if type(record["version"]) is not int or record["version"] != 1 or record["id"] != key or request_key(record["request_id"]) != key:
        raise ValueError()
    for identity in (record["actor"], record["provider"]):
        if not isinstance(identity, str) or re.fullmatch(r"[1-9][0-9]{0,18}", identity) is None or int(identity) > 9223372036854775807:
            raise ValueError()
    if record["engine"] not in {"web", "agentic"} or record["state"] not in TERMINAL | {"armed", "running", "closing", "unknown"}:
        raise ValueError()
    if (type(record["expires_at"]) not in (int, float) or not math.isfinite(record["expires_at"])
            or record["expires_at"] <= 0):
        raise ValueError()
    if record["resource_key"] is not None and re.fullmatch(r"gemini-profile:[0-9a-f]{64}", record["resource_key"]) is None:
        raise ValueError()
    if "acknowledged" in record and type(record["acknowledged"]) is not bool:
        raise ValueError()
    if record.get("reason") not in {None, "agentic_login_failed", "agentic_login_timeout"}:
        raise ValueError()
    if record["closure_proof"] not in {None, "never_dispatched", "native_tree_closed", "container_tree_closed"}:
        raise ValueError()
    if record["state"] in TERMINAL and record["closure_proof"] is None:
        raise ValueError()
    if record["state"] not in TERMINAL and record["closure_proof"] is not None:
        raise ValueError()
    if record.get("candidate_state") is not None and record["candidate_state"] not in TERMINAL:
        raise ValueError()
    if record["state"] == "closing" and record.get("candidate_state") not in TERMINAL:
        raise ValueError()
    containment = record["containment"]
    if containment is not None:
        if (not isinstance(containment, dict) or containment.keys() != {"kind", "name", "boot", "device", "inode", "parent_inode"}
                or containment["kind"] != "cgroup_v2" or containment["name"] != key
                or str(UUID(containment["boot"])) != containment["boot"]
                or any(type(containment[name]) is not int or containment[name] < 1 for name in ("device", "inode", "parent_inode"))):
            raise ValueError()
    for proof in ([record["supervisor"]] if record["supervisor"] is not None else []):
        if not isinstance(proof, dict) or proof.keys() != {"boot", "namespace", "uid", "pid", "birth"}:
            raise ValueError()
        if str(UUID(proof["boot"])) != proof["boot"] or re.fullmatch(r"pid:\[[1-9][0-9]*\]", proof["namespace"]) is None:
            raise ValueError()
        if any(type(proof[name]) is not int or proof[name] < (0 if name == "uid" else 1) for name in ("uid", "pid", "birth")):
            raise ValueError()
    return record


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError()
        result[key] = value
    return result


def request_key(value: str) -> str:
    try:
        parsed = UUID(value)
        if parsed.version != 4 or str(parsed) != value:
            raise ValueError()
        return parsed.hex
    except (ValueError, AttributeError):
        raise ServiceError("invalid_login_request", "Identidad de login inválida.", 422) from None


def login_deadline(value: str) -> float:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError()
        deadline = parsed.astimezone(timezone.utc).timestamp()
        if not time.time() < deadline <= time.time() + 310:
            raise ValueError()
        return deadline
    except (ValueError, OverflowError):
        raise ServiceError("login_request_expired", "El plazo del login no es válido.", 409) from None


class LoginRequestStore:
    def __init__(self, directory: Path):
        self.directory = directory

    @asynccontextmanager
    async def alocked(self):
        deadline = time.monotonic() + 1
        while True:
            guard = self.locked()
            try:
                guard.__enter__()
                break
            except ServiceError as error:
                if error.code != "login_journal_busy" or time.monotonic() >= deadline:
                    raise
                await asyncio.sleep(0.01)
        try:
            yield
        finally:
            guard.__exit__(None, None, None)

    @contextmanager
    def locked(self):
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            _private_directory(self.directory)
        except (ValueError, OSError):
            raise ServiceError("login_journal_invalid", "El registro privado no está disponible.") from None
        descriptor = os.open(self.directory / ".lock", os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
        try:
            _private_file(os.fstat(descriptor))
            if os.name == "nt":
                import msvcrt
                if os.fstat(descriptor).st_size == 0:
                    os.write(descriptor, b"\0")
                os.lseek(descriptor, 0, 0)
                try:
                    msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
                except OSError as error:
                    if error.errno in (errno.EACCES, errno.EDEADLK):
                        raise BlockingIOError() from None
                    raise
            else:
                import fcntl
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield
        except BlockingIOError:
            # No synchronous lock wait can block the ASGI event loop. Callers
            # may retry observation; a dispatched login is never repeated.
            raise ServiceError("login_journal_busy", "El registro de login está ocupado.", 503) from None
        except ValueError:
            raise ServiceError("login_journal_invalid", "El registro privado no es verificable.") from None
        finally:
            os.close(descriptor)

    def read(self, key: str) -> dict | None:
        if not isinstance(key, str) or re.fullmatch(r"[0-9a-f]{32}", key) is None:
            raise ServiceError("login_journal_invalid", "Identidad privada inválida.")
        target = self.directory / (key + ".json")
        try:
            descriptor = os.open(target, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        except FileNotFoundError:
            return None
        try:
            _private_file(os.fstat(descriptor))
            if os.fstat(descriptor).st_size > 32_768:
                raise ValueError()
            with os.fdopen(descriptor, "r", encoding="utf8") as source:
                descriptor = -1
                data = json.load(source, object_pairs_hook=_unique_object)
            return _record(data, key)
        except (ValueError, OSError, KeyError, TypeError, ServiceError):
            raise ServiceError("login_journal_invalid", "El registro privado no es verificable.") from None
        finally:
            if descriptor >= 0:
                os.close(descriptor)

    def write(self, record: dict) -> None:
        _record(record, record["id"])
        temporary = self.directory / (uuid4().hex + ".tmp")
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf8") as output:
                json.dump(record, output, sort_keys=True, separators=(",", ":"))
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, self.directory / (record["id"] + ".json"))
            self.sync()
        finally:
            temporary.unlink(missing_ok=True)

    def sync(self) -> None:
        if os.name != "nt":
            descriptor = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)

    def prune(self) -> None:
        # Active/uncertain dispatches are never reclaimed by elapsed time alone.
        for target in self.directory.glob("*.json"):
            record = self.read(target.stem)
            if (record["state"] in TERMINAL and record.get("acknowledged")
                    and record["expires_at"] < time.time()):
                target.unlink()
        self.sync()
        if sum(1 for _ in self.directory.glob("*.json")) >= 128:
            raise ServiceError("login_journal_full", "Hay operaciones pendientes de conciliación.", 409)

    @staticmethod
    def owned(record: dict | None, actor: str, provider: str, engine: str) -> dict:
        if record is None or (record["actor"], record["provider"], record["engine"]) != (actor, provider, engine):
            raise ServiceError("login_not_found", "Intento de login no encontrado.", 404)
        return record

    @staticmethod
    def public(record: dict) -> dict:
        result = {"id": record["id"], "state": record["state"] if record["state"] not in {"armed", "closing"} else "running"}
        if record["engine"] == "agentic":
            result.update(authorization_url=None, reason=record.get("reason"))
        return result
