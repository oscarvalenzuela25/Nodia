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

from service_errors import ServiceError


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
        return cls(binary.resolve(), checksum, profile.resolve(), timeout=timeout)


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


def prepare_cli_home(home: Path, document: Path | None = None) -> None:
    """Only our dedicated home is mutable; never modify the user's CLI settings."""
    settings = home / ".gemini" / "antigravity-cli" / "settings.json"
    settings.parent.mkdir(parents=True, exist_ok=True)
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


class CliRunner:
    def __init__(self, config: CliConfig):
        self.config = config
        self._processes: set[asyncio.subprocess.Process] = set()
        self._jobs: dict[asyncio.subprocess.Process, object] = {}
        self._closed = False
        self._verified_stat: tuple[int, int] | None = None

    async def initialize(self) -> None:
        def checksum() -> str:
            with self.config.binary.open("rb") as binary:
                return hashlib.file_digest(binary, "sha512").hexdigest()
        if await asyncio.to_thread(checksum) != self.config.sha512:
            raise ServiceError("agentic_cli_incompatible", "El binario agéntico no coincide con la versión verificada.")
        info = self.config.binary.stat()
        self._verified_stat = (info.st_mtime_ns, info.st_size)
        prepare_cli_home(self.config.home)
        result, _ = await self.run(["--version"], timeout=4)
        if result.strip() != self.config.version:
            raise ServiceError("agentic_cli_incompatible", "La versión del CLI agéntico no es compatible.")

    async def _terminate(self, process: asyncio.subprocess.Process) -> None:
        job = self._jobs.pop(process, None)
        if job is not None:
            job.close()
        if os.name != "nt":
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        elif process.returncode is None:
            process.kill()
        await process.wait()

    async def run(self, args: list[str], *, stdin: bytes | None = None,
                  cwd: Path | None = None, home: Path | None = None,
                  timeout: float = 4, stdout_observer: Callable[[bytes], None] | None = None) -> tuple[str, int]:
        if self._closed:
            raise ServiceError("agentic_unavailable", "El motor agéntico está detenido.")
        if self._verified_stat is not None:
            info = self.config.binary.stat()
            if (info.st_mtime_ns, info.st_size) != self._verified_stat:
                raise ServiceError("agentic_cli_incompatible", "El binario agéntico cambió; requiere nueva verificación.")
        command = [str(self.config.binary), *args]
        if os.name == "nt":
            # A Windows venv python.exe is itself a redirector. Its interpreter
            # can start before assignment; launch the base interpreter directly.
            interpreter = Path(sys.base_prefix) / "python.exe"
            if not interpreter.is_file():
                raise ServiceError("agentic_process_isolation", "No se pudo aislar el proceso agéntico.")
            command = [str(interpreter), str(Path(__file__).with_name("agentic_process_launcher.py")), *command]
        spawn = asyncio.create_task(asyncio.create_subprocess_exec(
            *command, cwd=cwd or self.config.home,
            env=cli_environment(home or self.config.home),
            stdin=asyncio.subprocess.PIPE if stdin is not None or os.name == "nt" else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            **({"start_new_session": True} if os.name != "nt" else {}),
        ))
        cancelled = False
        try:
            process = await asyncio.shield(spawn)
        except asyncio.CancelledError:
            process = await spawn
            cancelled = True
        self._processes.add(process)
        if os.name == "nt":
            from windows_process_job import WindowsProcessJob
            try:
                self._jobs[process] = WindowsProcessJob(process.pid)
            except OSError:
                await self._terminate(process)
                self._processes.discard(process)
                raise ServiceError("agentic_process_isolation", "No se pudo aislar el proceso agéntico.") from None
        if cancelled or self._closed:
            await self._terminate(process)
            self._processes.discard(process)
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
                    process.stdin.write((b"\x01" if os.name == "nt" else b"") + (stdin or b""))
                    await process.stdin.drain()
                except (BrokenPipeError, ConnectionResetError):
                    pass
                finally:
                    process.stdin.close()

        tasks = [asyncio.create_task(read(process.stdout, stdout_observer)), asyncio.create_task(read(process.stderr)),
                 asyncio.create_task(write()), asyncio.create_task(process.wait())]
        try:
            output, _, _, code = await asyncio.wait_for(asyncio.gather(*tasks), timeout)
            return output.decode("utf-8", errors="strict"), code
        except TimeoutError:
            raise ServiceError("agentic_timeout", "Tiempo agéntico agotado; el resultado puede ser incierto.", 504) from None
        except UnicodeError:
            raise ServiceError("agentic_invalid_response", "Respuesta agéntica inválida.", 502) from None
        finally:
            await self._terminate(process)
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            self._processes.discard(process)

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
            spawn = asyncio.create_task(asyncio.create_subprocess_exec(
                *command, cwd=self.config.home, env=cli_environment(self.config.home),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                **({"start_new_session": True} if os.name != "nt" else {}),
            ))
            cancelled = False
            try:
                process = await asyncio.shield(spawn)
            except asyncio.CancelledError:
                process = await spawn
                cancelled = True
            self._processes.add(process)
            tasks = []
            try:
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
                # write_codes ends after one submission; the owned reader stays live.
                await tasks[1]
            except (ValueError, OSError, UnicodeError):
                raise ServiceError("agentic_login_failed", "El CLI no pudo completar el login remoto.", 502) from None
            finally:
                process.stdin.close()
                await self._terminate(process)
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                self._processes.discard(process)

    async def close(self) -> None:
        self._closed = True
        await asyncio.gather(*(self._terminate(p) for p in tuple(self._processes)))
