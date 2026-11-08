"""One kernel cgroup per durable login, under the container's own delegated root.

No Docker socket, namespace privilege or host cgroup path is available here.
The host attaches the existing container cgroup at this fixed private mount.
"""
import asyncio
import os
from pathlib import Path
import re
import stat
import sys
import time
import json
from uuid import UUID

from service_errors import ServiceError
from native_chat_owner_bindings import validate_chat_bindings

ROOT = Path("/run/nodia-login-cgroups")
ATTESTATION = Path("/run/nodia-login-containment.json")


def boot_id() -> str:
    return Path("/proc/sys/kernel/random/boot_id").read_text().strip()


def process_birth(pid: int) -> int | None:
    try:
        source = Path(f"/proc/{pid}/stat").read_text()
        fields = source[source.rindex(")") + 2:].split()
        return int(fields[19]) if fields[0] != "Z" else None
    except (FileNotFoundError, ProcessLookupError):
        return None


def supervisor_certificate(pid: int) -> dict:
    birth = process_birth(pid)
    if birth is None:
        raise ServiceError("login_containment_unknown", "El proceso de login no es verificable.", 409)
    return {"boot": boot_id(), "namespace": os.readlink("/proc/self/ns/pid"),
            "uid": os.getuid(), "pid": pid, "birth": birth}


def supervisor_alive(proof: dict | None) -> bool | None:
    if proof is None:
        return False
    if (proof["boot"] != boot_id() or proof["namespace"] != os.readlink("/proc/self/ns/pid")
            or proof["uid"] != os.getuid()):
        return None
    return process_birth(proof["pid"]) == proof["birth"]


class LoginCgroups:
    def __init__(self, root: Path = ROOT):
        self.root = root

    def attestation(self) -> dict:
        descriptor = None
        try:
            if ATTESTATION.parent.is_symlink() or ATTESTATION.parent.stat().st_uid != 0 or ATTESTATION.parent.stat().st_mode & 0o022:
                raise ValueError()
            descriptor = os.open(ATTESTATION, os.O_RDONLY | os.O_NOFOLLOW)
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1 or info.st_mode & 0o222 or info.st_size > 32_768:
                raise ValueError()
            def unique_object(pairs):
                result = {}
                for key, value in pairs:
                    if key in result:
                        raise ValueError()
                    result[key] = value
                return result
            with os.fdopen(descriptor, "r") as source:
                descriptor = None
                raw = source.read(32_769)
                if len(raw.encode("utf-8")) > 32_768:
                    raise ValueError()
                data = json.loads(raw, object_pairs_hook=unique_object)
            if (not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] not in (1, 2)
                    or data.keys() != ({"version", "root_device", "root_inode", "host_boot", "closed_roots"}
                                       | ({"chat_bindings"} if data["version"] == 2 else set()))
                    or str(UUID(data["host_boot"])) != data["host_boot"]
                    or data["host_boot"] != boot_id() or not isinstance(data["closed_roots"], list)
                    or len(data["closed_roots"]) > 128):
                raise ValueError()
            if any(type(data[key]) is not int or data[key] < 1 for key in ("root_device", "root_inode")):
                raise ValueError()
            for closed in data["closed_roots"]:
                if (not isinstance(closed, dict) or closed.keys() != {"boot", "device", "parent_inode"}
                        or str(UUID(closed["boot"])) != closed["boot"]
                        or any(type(closed[key]) is not int or closed[key] < 1 for key in ("device", "parent_inode"))
                        or closed == {"boot": data["host_boot"], "device": data["root_device"], "parent_inode": data["root_inode"]}):
                    raise ValueError()
            if data["version"] == 2:
                validate_chat_bindings(data["chat_bindings"])
            return data
        except (OSError, ValueError, KeyError, TypeError):
            raise ServiceError("login_containment_unavailable", "Falta la prueba privada de contención.") from None
        finally:
            if descriptor is not None:
                os.close(descriptor)

    def known_closed(self, proof: dict) -> bool:
        try:
            return {"boot": proof["boot"], "device": proof["device"], "parent_inode": proof["parent_inode"]} in self.attestation()["closed_roots"]
        except ServiceError:
            return False

    def _root(self) -> os.stat_result:
        try:
            if sys.platform != "linux" or self.root.is_symlink():
                raise ValueError()
            info = self.root.stat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o022:
                raise ValueError()
            attestation = self.attestation()
            if (attestation["root_device"], attestation["root_inode"]) != (info.st_dev, info.st_ino):
                raise ValueError()
            # A plain writable directory can never impersonate kernel proof.
            table = Path("/proc/self/mountinfo")
            if table.stat().st_size > 262_144:
                raise ValueError()
            candidates = []
            with table.open() as source:
                contents = source.read(262_145)
            if len(contents) > 262_144:
                raise ValueError()
            for line in contents.splitlines():
                before, separator, after = line.partition(" - ")
                fields = before.split()
                if not separator or len(fields) < 6:
                    continue
                target = fields[4]
                if self.root.as_posix() == target or self.root.as_posix().startswith(target.rstrip("/") + "/"):
                    candidates.append((len(target), after.split()[0], fields[5]))
            if not candidates or max(candidates)[1] != "cgroup2" or "rw" not in max(candidates)[2].split(","):
                raise ValueError()
            return info
        except (OSError, ValueError):
            raise ServiceError("login_containment_unavailable", "La contención de login no está disponible.") from None

    def create(self, key: str) -> dict:
        parent = self._root()
        if re.fullmatch(r"[0-9a-f]{32}", key) is None:
            raise ServiceError("invalid_login_request", "Identidad de login inválida.", 422)
        directory = self.root / key
        try:
            directory.mkdir(mode=0o700)
            info = directory.stat()
            proof = {"kind": "cgroup_v2", "name": key,
                     "boot": boot_id(),
                     "device": info.st_dev, "inode": info.st_ino, "parent_inode": parent.st_ino}
            if self.populated(proof):
                raise ValueError()
            return proof
        except (OSError, ValueError):
            raise ServiceError("login_containment_unavailable", "No se pudo reservar la contención de login.") from None

    def directory(self, proof: dict) -> Path:
        parent = self._root()
        if not isinstance(proof.get("name"), str) or re.fullmatch(r"[0-9a-f]{32}", proof["name"]) is None:
            raise ServiceError("login_containment_unknown", "Identidad de contención inválida.", 409)
        directory = self.root / proof["name"]
        try:
            if directory.is_symlink():
                raise ValueError()
            info = directory.stat()
            if (proof["kind"] != "cgroup_v2" or proof["boot"] != boot_id()
                    or proof["device"] != info.st_dev or proof["inode"] != info.st_ino
                    or proof["parent_inode"] != parent.st_ino or info.st_uid != os.getuid()
                    or not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o022):
                raise ValueError()
            return directory
        except (OSError, ValueError):
            raise ServiceError("login_containment_unknown", "La identidad de la contención no es verificable.", 409) from None

    def populated(self, proof: dict) -> bool:
        try:
            value = (self.directory(proof) / "cgroup.events").read_text()
            if len(value) > 1024:
                raise ValueError()
            fields = dict(line.split() for line in value.splitlines())
            if fields.get("populated") not in {"0", "1"}:
                raise ValueError()
            return fields["populated"] == "1"
        except (OSError, ValueError):
            raise ServiceError("login_containment_unknown", "No se pudo observar el cierre de login.", 409) from None

    def attach(self, proof: dict, pid: int) -> None:
        try:
            (self.directory(proof) / "cgroup.procs").write_text(str(pid))
        except OSError:
            raise ServiceError("login_containment_unavailable", "No se pudo contener el proceso de login.") from None

    async def close(self, proof: dict, *, timeout: float = 3) -> bool:
        try:
            directory = self.directory(proof)
            if self.populated(proof):
                # The kernel atomically includes descendants and concurrent forks.
                (directory / "cgroup.kill").write_text("1")
            until = time.monotonic() + timeout
            while time.monotonic() < until:
                if not self.populated(proof):
                    return True
                await asyncio.sleep(0.03)
            return False
        except ServiceError:
            return False
        except OSError:
            return False

    def remove(self, proof: dict) -> None:
        try:
            directory = self.directory(proof)
            if not self.populated(proof):
                directory.rmdir()
        except (OSError, ServiceError):
            pass
