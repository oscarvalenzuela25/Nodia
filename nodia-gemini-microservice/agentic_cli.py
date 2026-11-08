"""Bounded official CLI transport. No credentials are inspected or logged."""

import asyncio
import hashlib
import json
import os
import signal
import shlex
import subprocess
import sys
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from owned_process import OwnedProcessOwner
from cli_execution_receipt import CliExecutionReceipt
from login_cgroups import LoginCgroups
from service_errors import ServiceError


# Transport candidates, not evidence of a working session or MCP/attachment support.
CHAT_CLI_VERSIONS = frozenset({"1.3.1", "1.4.2"})


@dataclass(frozen=True)
class CliConfig:
    binary: Path
    sha512: str
    home: Path
    version: str = "1.3.1"
    timeout: float = 240
    output_bytes: int = 2_000_000

    @classmethod
    def from_environment(cls) -> "CliConfig | None":
        path = os.environ.get("ANTIGRAVITY_CLI_PATH")
        if not path:
            return None
        checksum = os.environ.get("ANTIGRAVITY_CLI_SHA512", "").lower()
        home = os.environ.get("ANTIGRAVITY_CLI_HOME")
        if len(checksum) != 128 or any(c not in "0123456789abcdef" for c in checksum) or not home:
            raise ValueError("Configure ANTIGRAVITY_CLI_SHA512 and ANTIGRAVITY_CLI_HOME")
        version = os.environ.get("ANTIGRAVITY_CLI_VERSION", "1.3.1")
        if version not in CHAT_CLI_VERSIONS:
            raise ValueError("Unsupported ANTIGRAVITY_CLI_VERSION")
        timeout = float(os.environ.get("ANTIGRAVITY_CLI_TIMEOUT_SECONDS", "240"))
        if not 1 <= timeout <= 240:
            raise ValueError("Invalid CLI timeout")
        binary, profile = Path(path), Path(home)
        workspace = Path(__file__).resolve().parent
        # Monorepo on the host; standalone /app in the service container.
        # Using /app's parent would reject every absolute path under /.
        if (workspace.parent / "nodia-server").is_dir():
            workspace = workspace.parent
        if (not binary.is_absolute() or not profile.is_absolute()
                or profile.resolve() == Path.home().resolve()
                or profile.resolve() in workspace.parents
                or profile.resolve().is_relative_to(workspace)):
            raise ValueError("Configure absolute CLI paths and a dedicated profile outside Nodia")
        return cls(binary.resolve(), checksum, profile.resolve(), version=version, timeout=timeout)


def cli_environment(home: Path, inherited: Mapping[str, str] | None = None) -> dict[str, str]:
    # Never pass Nodia tokens, API credentials, cookies, or arbitrary AGY overrides.
    source = os.environ if inherited is None else inherited
    allowed = {"PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT",
               "TEMP", "TMP", "TMPDIR", "LOCALAPPDATA", "APPDATA", "LANG", "LC_ALL",
               "DBUS_SESSION_BUS_ADDRESS", "XDG_RUNTIME_DIR", "SSL_CERT_FILE", "SSL_CERT_DIR"}
    env = {key: value for key, value in source.items() if key in allowed}
    env.update(HOME=str(home), USERPROFILE=str(home), AGY_CLI_DISABLE_AUTO_UPDATE="1")
    return env


def permission_path(path: Path) -> str:
    value = path.resolve().as_posix()
    return value[2:] if len(value) > 2 and value[1] == ":" else value


def prepare_cli_home(home: Path, document: Path | None = None, *, account_home: Path | None = None) -> None:
    """Only our dedicated home is mutable; never modify the user's CLI settings."""
    settings = home / ".gemini" / "antigravity-cli" / "settings.json"
    bindings: list[tuple[Path, Path]] = []
    if account_home is not None:
        if (not home.is_absolute() or not account_home.is_absolute() or not account_home.is_dir()
                or home.resolve() == account_home.resolve()
                or not settings.parent.resolve().is_relative_to(home.resolve())):
            raise ValueError("A separate private CLI home is required")
        for name in ("antigravity-oauth-token", "installation_id"):
            source = account_home.resolve() / ".gemini" / "antigravity-cli" / name
            destination = settings.parent / name
            if destination.exists() or destination.is_symlink():
                raise ValueError("Account binding destination already exists")
            if source.is_file():
                bindings.append((source, destination))
    settings.parent.mkdir(parents=True, exist_ok=True)
    linked: list[Path] = []
    try:
        for source, destination in bindings:
            destination.symlink_to(source)
            linked.append(destination)
    except OSError:
        for destination in linked:
            destination.unlink()
        raise
    policy = {"toolPermission": "request-review", "notifications": False, "showTips": False,
              "useG1Credits": False, "enableTerminalSandbox": True,
              "permissions": {"allow": [f"read_file({permission_path(document)})"] if document else [],
                              "deny": ["command(*)", "unsandboxed(*)", "write_file(*)",
                                       "read_url(*)", "execute_url(*)", "mcp(*)",
                                       f"read_file({permission_path(home)})"]}}
    settings.write_text(json.dumps(policy), encoding="utf-8")
    if document is not None:
        # Pin our hook into the dedicated profile, independent of the repository.
        gate = home / "tool_gate.py"
        gate.write_bytes(Path(__file__).with_name("agentic_tool_gate.py").read_bytes())
        argv = [sys.executable, str(gate), str(document.resolve()), str(home / "tool_receipts.jsonl")]
        if os.name == "nt" and any(any(c in arg for c in '&|<>^%!\r\n') for arg in argv):
            raise ValueError("CLI hook paths contain unsupported shell characters")
        command = subprocess.list2cmdline(argv) if os.name == "nt" else shlex.join(argv)
        hooks = document.parent / ".agents" / "hooks.json"
        hooks.parent.mkdir(parents=True, exist_ok=True)
        definitions = {"nodia-invoice-only": {"PreToolUse": [
            {"matcher": "*", "hooks": [{"type": "command", "command": command, "timeout": 3}]}
        ]}}
        hooks.write_text(json.dumps(definitions), encoding="utf-8")


class CliRunner(OwnedProcessOwner):
    def __init__(self, config: CliConfig):
        super().__init__()
        self.config = config
        self._jobs: dict[asyncio.subprocess.Process, object] = {}
        self._verified_stat: tuple[int, int] | None = None
        self._closure_receipts: dict[asyncio.subprocess.Process, CliExecutionReceipt] = {}
        self._receipt_cgroups: dict[asyncio.subprocess.Process, tuple[dict, bool]] = {}
        self._receipt_containment = LoginCgroups()
        self._prepared_receipts: dict[str, tuple[CliExecutionReceipt, dict]] = {}

    def prepare_closure(self, receipt: CliExecutionReceipt) -> None:
        """Verify containment before the caller arms or announces dispatch."""
        receipt.claim()
        if sys.platform != "linux":
            raise ServiceError("native_proof_missing", "La contención del análisis no está verificada en este entorno.", 409)
        try:
            containment = self._receipt_containment.create(receipt.operation_id.replace("-", ""))
        except ServiceError:
            raise ServiceError("native_proof_missing", "La contención local del análisis no está disponible.", 409) from None
        self._prepared_receipts[receipt.operation_id] = (receipt, containment)

    def discard_prepared_closure(self, receipt: CliExecutionReceipt) -> None:
        current = self._prepared_receipts.get(receipt.operation_id)
        if current is not None and current[0] is receipt:
            self._prepared_receipts.pop(receipt.operation_id)
            self._receipt_containment.remove(current[1])  # Never spawned or gated.

    async def _shutdown_owned(self, process: asyncio.subprocess.Process) -> bool:
        terminated = False
        contained_closed = False
        tasks = self._io_tasks.get(process, ())
        try:
            containment = self._receipt_cgroups.get(process)
            if containment is None:
                await self._terminate(process)
            else:
                # The shared owner budgets termination once, then IO draining.
                # Do not multiply that deadline by containment + leader wait.
                # Reserve scheduling/removal margin inside the outer owner's
                # TERMINATE + DRAIN deadline (2.4 + 1 within 4 seconds today).
                async with asyncio.timeout(self._TERMINATE_SECONDS * 0.8):
                    if not containment[1]:
                        # The known launcher never received its gate byte.
                        await self._terminate(process)
                    contained_closed = await self._receipt_containment.close(containment[0])
                    if contained_closed:
                        await process.wait()
            terminated = process.returncode is not None
        except Exception:
            pass
        finally:
            for task in tasks:
                task.cancel()
                task.add_done_callback(self._observe_task)
        pending = set()
        if tasks:
            _, pending = await asyncio.wait(tasks, timeout=self._DRAIN_SECONDS)
        self._io_tasks[process] = tuple(pending)
        receipt = self._closure_receipts.get(process)
        if terminated and not pending and (receipt is None or contained_closed):
            if receipt is not None:
                containment = self._receipt_cgroups[process]
                self._receipt_containment.remove(containment[0])
                # remove() is deliberately best-effort for older consumers.
                # OCR must prove its own group is absent before certifying or
                # dropping any handles, including a swallowed remove failure.
                target = self._receipt_containment.root / containment[0]["name"]
                try:
                    target.lstat()
                except FileNotFoundError:
                    pass
                else:
                    raise ServiceError("agentic_process_cleanup_unknown", "No se verificó la limpieza del análisis.", 502)
            self._io_tasks.pop(process, None)
            self._processes.discard(process)
            if receipt is not None:
                receipt.record_contained_closure()
                self._closure_receipts.pop(process, None)
                self._receipt_cgroups.pop(process)
            return True
        self._closed = True
        return False  # Retain the process/handles; do not re-kill a stale PID.


    async def initialize(self) -> None:
        def checksum() -> str:
            with self.config.binary.open("rb") as binary:
                return hashlib.file_digest(binary, "sha512").hexdigest()
        if await asyncio.to_thread(checksum) != self.config.sha512:
            raise ServiceError("agentic_cli_incompatible", "El binario agéntico no coincide con la versión verificada.")
        info = self.config.binary.stat()
        self._verified_stat = (info.st_mtime_ns, info.st_size)
        prepare_cli_home(self.config.home)
        result, code = await self.run(["--version"], timeout=4)
        if code != 0 or result.strip() != self.config.version:
            raise ServiceError("agentic_cli_incompatible", "La versión del CLI agéntico no es compatible.")

    async def _terminate(self, process: asyncio.subprocess.Process) -> None:
        job = self._jobs.get(process)
        if job is not None:
            job.close()
            self._jobs.pop(process, None)
        if os.name != "nt":
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        elif process.returncode is None:
            process.kill()
        await asyncio.wait_for(process.wait(), self._TERMINATE_SECONDS)

    async def run(self, args: list[str], *, stdin: bytes | None = None,
                  cwd: Path | None = None, home: Path | None = None,
                  timeout: float = 4, stdout_observer: Callable[[bytes], None] | None = None,
                  stderr_observer: Callable[[bytes], None] | None = None,
                  closure_receipt: CliExecutionReceipt | None = None) -> tuple[str, int]:
        if self._closed:
            raise ServiceError("agentic_unavailable", "El motor agéntico está detenido.")
        if self._verified_stat is not None:
            info = self.config.binary.stat()
            if (info.st_mtime_ns, info.st_size) != self._verified_stat:
                raise ServiceError("agentic_cli_incompatible", "El binario agéntico cambió; requiere nueva verificación.")
        command = [str(self.config.binary), *args]
        containment = None
        if closure_receipt is not None:
            prepared = self._prepared_receipts.get(closure_receipt.operation_id)
            if prepared is None or prepared[0] is not closure_receipt:
                raise ServiceError("native_proof_missing", "La invocación no tiene una reserva de contención propia.", 409)
            self._prepared_receipts.pop(closure_receipt.operation_id)
            containment = prepared[1]
            # The attested cgroup contains descendants even after setsid.
            command = [sys.executable, str(Path(__file__).with_name("agentic_process_launcher.py")), *command]
        if os.name == "nt":
            # A Windows venv python.exe is itself a redirector. Its interpreter
            # can start before assignment; launch the base interpreter directly.
            interpreter = Path(sys.base_prefix) / "python.exe"
            if not interpreter.is_file():
                raise ServiceError("agentic_process_isolation", "No se pudo aislar el proceso agéntico.")
            command = [str(interpreter), str(Path(__file__).with_name("agentic_process_launcher.py")), *command]
        def register_receipt(process: asyncio.subprocess.Process) -> None:
            self._closure_receipts[process] = closure_receipt
            self._receipt_cgroups[process] = (containment, False)

        process, cancelled = await self._spawn_owned(command, dict(cwd=cwd or self.config.home,
            env=cli_environment(home or self.config.home),
            stdin=asyncio.subprocess.PIPE if stdin is not None or os.name == "nt" or containment is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            **({"start_new_session": True} if os.name != "nt" else {}),
        ), timeout, on_owned=register_receipt if closure_receipt is not None else None)
        if closure_receipt is not None:
            try:
                self._receipt_containment.attach(containment, process.pid)
                self._receipt_cgroups[process] = (containment, True)
            except BaseException:
                await self._finish_process(process)
                raise
        if cancelled or self._closed:
            await self._finish_process(process)
            if cancelled:
                raise asyncio.CancelledError()
            raise ServiceError("agentic_unavailable", "El motor agéntico está detenido.")
        if os.name == "nt":
            from windows_process_job import WindowsProcessJob
            try:
                self._jobs[process] = WindowsProcessJob(process.pid)
            except OSError:
                await self._finish_process(process)
                raise ServiceError("agentic_process_isolation", "No se pudo aislar el proceso agéntico.") from None
        if cancelled or self._closed:
            await self._finish_process(process)
            if cancelled:
                raise asyncio.CancelledError()
            raise ServiceError("agentic_unavailable", "El motor agéntico está detenido.")

        async def read(stream: asyncio.StreamReader, observer: Callable[[bytes], None] | None = None) -> bytes:
            parts = []
            size = 0
            while chunk := await stream.read(32_768):
                size += len(chunk)
                if size > self.config.output_bytes:
                    raise ServiceError("agentic_output_limit", "Respuesta agéntica demasiado extensa.", 502)
                parts.append(chunk)
                if observer is not None:
                    observer(chunk)
            return b"".join(parts)

        async def write() -> None:
            if process.stdin is not None:
                try:
                    # Releasing the launcher is safe only after job assignment.
                    process.stdin.write((b"\x01" if os.name == "nt" or containment is not None else b"") + (stdin or b""))
                    await process.stdin.drain()
                except (BrokenPipeError, ConnectionResetError):
                    pass
                finally:
                    process.stdin.close()

        tasks = [asyncio.create_task(read(process.stdout, stdout_observer)), asyncio.create_task(read(process.stderr, stderr_observer)),
                 asyncio.create_task(write()), asyncio.create_task(process.wait())]
        self._io_tasks[process] = tuple(tasks)
        try:
            output, _, _, code = await asyncio.wait_for(asyncio.gather(*tasks), timeout)
            return output.decode("utf-8", errors="strict"), code
        except TimeoutError:
            raise ServiceError("agentic_timeout", "Tiempo agéntico agotado; el resultado puede ser incierto.", 504) from None
        except UnicodeError:
            raise ServiceError("agentic_invalid_response", "Respuesta agéntica inválida.", 502) from None
        finally:
            await self._finish_process(process, tasks)

    async def remote_login(self, codes: asyncio.Queue[str],
                           on_event: Callable[[dict], None]) -> None:
        """Only safe bridge events leave the owned PTY wrapper."""
        if self._closed or self._verified_stat is None:
            raise ServiceError("agentic_unavailable", "El CLI agéntico no está disponible.")
        info = self.config.binary.stat()
        if (info.st_mtime_ns, info.st_size) != self._verified_stat:
            raise ServiceError("agentic_cli_incompatible", "El CLI cambió; requiere verificación.")
        with tempfile.TemporaryDirectory(prefix="nodia-agentic-login-", dir=self.config.home) as directory:
            interpreter = Path(sys.base_prefix) / "python.exe" if os.name == "nt" else Path(sys.executable)
            command = [sys.executable, str(Path(__file__).with_name("agentic_login_terminal.py")),
                       str(self.config.binary), str(self.config.home), str(Path(directory) / "cli.log")]
            if os.name == "nt":
                command = [str(interpreter), str(Path(__file__).with_name("agentic_process_launcher.py")), *command]
            process, cancelled = await self._spawn_owned(command, dict(cwd=self.config.home, env=cli_environment(self.config.home),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                **({"start_new_session": True} if os.name != "nt" else {}),
            ), self._SPAWN_SECONDS)
            tasks = []
            try:
                if cancelled or self._closed:
                    raise asyncio.CancelledError()
                if os.name == "nt":
                    from windows_process_job import WindowsProcessJob
                    self._jobs[process] = WindowsProcessJob(process.pid)
                    process.stdin.write(b"\x01")
                    await process.stdin.drain()
                if cancelled or self._closed:
                    raise asyncio.CancelledError()

                async def write_codes():
                    code = await codes.get()
                    process.stdin.write((json.dumps({"code": code}) + "\n").encode())
                    await process.stdin.drain()

                async def read_events():
                    from agentic_login_terminal import valid_authorization_url
                    count = 0
                    while line := await process.stdout.readline():
                        count += len(line)
                        if count > 16_384:
                            raise ValueError("login_output_limit")
                        event = json.loads(line)
                        if not isinstance(event, dict) or event.get("event") not in ("challenge", "code_sent"):
                            raise ValueError("login_invalid_response")
                        if event["event"] == "challenge" and not valid_authorization_url(event.get("authorization_url", "")):
                            raise ValueError("login_invalid_response")
                        on_event(event)
                    await process.wait()
                    raise ServiceError("agentic_login_failed", "El CLI no pudo completar el login remoto.", 502)

                tasks = [asyncio.create_task(write_codes()), asyncio.create_task(read_events())]
                self._io_tasks[process] = tuple(tasks)
                # write_codes ends after one submission; the owned reader stays live.
                await tasks[1]
            except (ValueError, OSError, UnicodeError):
                raise ServiceError("agentic_login_failed", "El CLI no pudo completar el login remoto.", 502) from None
            finally:
                process.stdin.close()
                await self._finish_process(process, tasks)

    async def close(self) -> None:
        self._closed = True
        deadline = asyncio.get_running_loop().time() + self._SPAWN_SECONDS
        for spawn in tuple(self._spawns):
            self._spawns[spawn] = True
            await self._wait_owned(spawn, deadline)
        results = await asyncio.gather(*(self._finish_process(p) for p in tuple(self._processes)), return_exceptions=True)
        if asyncio.current_task().cancelling():
            raise asyncio.CancelledError()
        if self._spawns or self._processes or any(isinstance(result, BaseException) for result in results):
            raise ServiceError("agentic_process_cleanup_unknown", "No se verificó el cierre del proceso agéntico.", 502)
