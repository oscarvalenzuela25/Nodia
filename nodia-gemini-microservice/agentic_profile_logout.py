"""Remove and verify only the credential owned by the private Linux CLI home."""

import asyncio
import os
import stat
import sys
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from pathlib import Path

from agentic_cli import CLI_ACCOUNT_TOKEN_NAME, CliRunner
from agentic_keyring import prove_empty_keyring
from service_errors import ServiceError


# The binary and its file-backed authentication behavior were verified together.
_FILE_BACKEND_SHA512 = "f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2"


def _unavailable() -> ServiceError:
    return ServiceError("agentic_logout_unavailable",
                        "El almacenamiento privado de la sesión agéntica no se pudo verificar.", 503)


def _outcome_unknown() -> ServiceError:
    return ServiceError("agentic_logout_outcome_unknown",
                        "No se pudo confirmar el cierre de la sesión agéntica.", 503)


def _present(path: Path) -> bool:
    try:
        path.lstat()
        return True
    except FileNotFoundError:
        return False


def _assert_profile_transport(runner: CliRunner, home: Path) -> None:
    if (sys.platform != "linux" or runner.config.version != "1.3.1"
            or runner.config.sha512 != _FILE_BACKEND_SHA512 or runner.config.home != home
            or not home.is_absolute() or home.resolve(strict=True) != home or home == Path.home().resolve()
            or not runner.has_idle_verified_transport()):
        raise _unavailable()


def _keyring_socket(home: Path) -> tuple[Path, os.stat_result] | None:
    uid = os.getuid()
    runtime = Path("/run/user") / str(uid)
    socket = runtime / "bus"
    address = os.environ.get("DBUS_SESSION_BUS_ADDRESS")
    runtime_setting = os.environ.get("XDG_RUNTIME_DIR")
    # HOME alone does not isolate the native Linux keyring. Accept only no
    # service bus or the exact user's private bus with inspectable ownership.
    if _present(home / ".dbus" / "session-bus"):
        raise _unavailable()
    if not address and not runtime_setting and not _present(socket):
        return None
    if address != f"unix:path={socket}" or runtime_setting != str(runtime):
        raise _unavailable()
    info = runtime.lstat()
    bus = socket.lstat()
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != uid or info.st_mode & 0o077
            or runtime.resolve(strict=True) != runtime
            or not stat.S_ISSOCK(bus.st_mode) or bus.st_uid != uid):
        raise _unavailable()
    return socket, bus


async def _keyring_evidence(home: Path) -> tuple[str, str, int, int] | None:
    binding = _keyring_socket(home)
    if binding is None:
        return None
    socket, before = binding
    proof, owner = await prove_empty_keyring(socket, os.getuid())
    if not os.path.samestat(before, socket.lstat()):
        raise _unavailable()
    return proof, owner, before.st_dev, before.st_ino


@contextmanager
def _owned_directory(path: str | Path, *, parent: int | None = None) -> Iterator[int]:
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        info = os.fstat(descriptor)
        if info.st_uid != os.getuid() or info.st_mode & 0o022:
            raise _unavailable()
        yield descriptor
    finally:
        os.close(descriptor)


def _credential_info(directory: int) -> os.stat_result | None:
    try:
        return os.stat(CLI_ACCOUNT_TOKEN_NAME, dir_fd=directory, follow_symlinks=False)
    except FileNotFoundError:
        return None


async def sign_out_cli_profile(runner: CliRunner, home: Path) -> None:
    checking_result = False
    try:
        _assert_profile_transport(runner, home)
        async with asyncio.timeout(2):
            if not await runner.verifies_binary_checksum():
                raise _unavailable()
        keyring = await _keyring_evidence(home)
        _assert_profile_transport(runner, home)
        with ExitStack() as directories:
            profile = directories.enter_context(_owned_directory(home))
            gemini = directories.enter_context(_owned_directory(".gemini", parent=profile))
            store = directories.enter_context(_owned_directory("antigravity-cli", parent=gemini))
            credential = _credential_info(store)
            if credential is not None:
                if (not stat.S_ISREG(credential.st_mode) or credential.st_nlink != 1
                        or credential.st_uid != os.getuid() or credential.st_mode & 0o077):
                    raise _unavailable()
                checking_result = True
                os.unlink(CLI_ACCOUNT_TOKEN_NAME, dir_fd=store)
                os.fsync(store)
            checking_result = True
            if not await runner.confirms_signed_out():
                raise _outcome_unknown()
            if keyring != await _keyring_evidence(home):
                raise _outcome_unknown()
            _assert_profile_transport(runner, home)
            current = (home / ".gemini" / "antigravity-cli").lstat()
            if not os.path.samestat(os.fstat(store), current) or _credential_info(store) is not None:
                raise _outcome_unknown()
    except (OSError, RuntimeError, ValueError, ImportError, ServiceError):
        if checking_result:
            raise _outcome_unknown() from None
        raise _unavailable() from None
