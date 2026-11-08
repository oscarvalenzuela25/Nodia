"""Read-only HOST binding for a legacy chat; never certifies provider success."""
from datetime import datetime
from hashlib import sha256
import json
import os
import re
import stat
import sys
from uuid import UUID

from native_attempts import NativeAttemptLedger, NativeAttemptProof, ReconcileAttempt
from service_errors import ServiceError


_KEYS = {"version", "kind", "binding_id", "engine", "attempt_id", "resource_key",
         "session_generation", "operation_ref", "record_sha256", "record_bytes",
         "record_observed_at", "bound_at", "generation", "lineage_sha256"}
_GENERATION_KEYS = {"container_id", "started_at", "boot", "device", "parent_inode"}


def _uuid(value: object) -> bool:
    return isinstance(value, str) and str(UUID(value)) == value


def _instant(value: object) -> datetime:
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("Invalid binding time")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("Binding time requires timezone")
    return parsed


def validate_chat_bindings(value: object) -> list[dict]:
    """Pure public schema shared with the existing root attestation reader.

    A binding of the *current/live* root is valid metadata, not a closed proof.
    """
    if not isinstance(value, list) or len(value) > 8:
        raise ValueError("Invalid chat binding collection")
    identities, ids = set(), set()
    for binding in value:
        if not isinstance(binding, dict) or binding.keys() != _KEYS:
            raise ValueError("Invalid chat binding shape")
        if (type(binding["version"]) is not int or binding["version"] != 1
                or binding["kind"] != "legacy_chat_pre_stop" or binding["engine"] != "agentic"
                or not all(_uuid(binding[key]) for key in ("binding_id", "attempt_id", "operation_ref"))
                or binding["operation_ref"] != binding["attempt_id"]):
            raise ValueError("Invalid chat binding identity")
        for key, pattern in (("resource_key", r"gemini-profile:[0-9a-f]{64}"),
                             ("session_generation", r"[0-9a-f]{32}"),
                             ("record_sha256", r"[0-9a-f]{64}"), ("lineage_sha256", r"[0-9a-f]{64}")):
            if not isinstance(binding[key], str) or re.fullmatch(pattern, binding[key]) is None:
                raise ValueError("Invalid chat binding scope")
        if type(binding["record_bytes"]) is not int or not 0 < binding["record_bytes"] <= 4096:
            raise ValueError("Invalid bound record size")
        generation = binding["generation"]
        if (not isinstance(generation, dict) or generation.keys() != _GENERATION_KEYS
                or not isinstance(generation["container_id"], str)
                or re.fullmatch(r"[0-9a-f]{64}", generation["container_id"]) is None
                or not _uuid(generation["boot"])
                or any(type(generation[key]) is not int or not 0 < generation[key] < 2**64
                       for key in ("device", "parent_inode"))
                or not _instant(generation["started_at"]) <= _instant(binding["record_observed_at"]) <= _instant(binding["bound_at"])):
            raise ValueError("Invalid chat binding generation")
        identity = tuple(binding[key] for key in ("engine", "attempt_id", "resource_key", "session_generation", "operation_ref"))
        if identity in identities or binding["binding_id"] in ids:
            raise ValueError("Ambiguous chat binding")
        identities.add(identity)
        ids.add(binding["binding_id"])
    return value


def read_recovery_record(ledger: NativeAttemptLedger, proof: NativeAttemptProof) -> bytes:
    """Read the exact immutable input to reconciliation, with Linux FD guards."""
    descriptor = None
    try:
        if sys.platform != "linux" or ledger.directory is None:
            raise ValueError()
        directory = ledger.directory
        parent = directory.lstat()
        if (directory.resolve() != directory or not stat.S_ISDIR(parent.st_mode)
                or parent.st_uid != os.getuid() or parent.st_mode & 0o022):
            raise ValueError()
        path = directory / (proof.attempt_id + ".json")
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode):
            raise ValueError()
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        info = os.fstat(descriptor)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1 or not 0 < info.st_size <= 4096
                or (before.st_dev, before.st_ino) != (info.st_dev, info.st_ino)):
            raise ValueError()
        with os.fdopen(descriptor, "rb") as stream:
            descriptor = None
            raw = stream.read(4097)
        if len(raw) != info.st_size:
            raise ValueError()
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError()
                result[key] = value
            return result
        decoded = json.loads(raw, object_pairs_hook=unique)
        if NativeAttemptProof.model_validate(decoded).model_dump() != proof.model_dump():
            raise ValueError()
        return raw
    except (OSError, ValueError, TypeError, KeyError):
        raise ServiceError("native_proof_invalid", "No se pudo verificar el recibo nativo.", 409) from None
    finally:
        if descriptor is not None:
            os.close(descriptor)


def require_closed_legacy_chat_owner(proof: NativeAttemptProof, request: ReconcileAttempt, raw: bytes) -> None:
    # Reuse root ownership, read-only FD, boot identity and closed_roots policy.
    # The import is local so the shared schema above has no import cycle.
    from login_cgroups import LoginCgroups
    try:
        certificate = LoginCgroups().attestation()
        if certificate["version"] != 2:
            raise ValueError()
        candidates = [binding for binding in certificate["chat_bindings"]
                      if all(binding[key] == expected for key, expected in {
                          "engine": proof.engine, "attempt_id": proof.attempt_id,
                          **request.model_dump()}.items())]
        if len(candidates) != 1:
            raise ValueError()
        binding = candidates[0]
        if (binding["record_bytes"] != len(raw) or binding["record_sha256"] != sha256(raw).hexdigest()
                or binding["record_observed_at"] != proof.observed_at):
            raise ValueError()
        generation = binding["generation"]
        closed = {"boot": generation["boot"], "device": generation["device"], "parent_inode": generation["parent_inode"]}
        current = {"boot": certificate["host_boot"], "device": certificate["root_device"], "parent_inode": certificate["root_inode"]}
        if closed == current or closed not in certificate["closed_roots"]:
            raise ValueError()
    except (ServiceError, OSError, ValueError, TypeError, KeyError):
        raise ServiceError("native_operation_active_or_unverified", "La terminación nativa aún no está verificada.", 409) from None
