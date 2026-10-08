"""Private, version-pinned CLI login bridge; never forwards terminal output."""

import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit

CODE_PATTERN = r"[A-Za-z0-9_./+~\-]{8,2048}"
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


def valid_authorization_url(value: str) -> bool:
    if len(value) > 4096 or any(ord(c) < 33 for c in value):
        return False
    try:
        url = urlsplit(value)
        params = parse_qs(url.query, strict_parsing=True)
        return (url.scheme == "https" and url.netloc == "accounts.google.com" and not url.fragment
                and url.path in ("/o/oauth2/auth", "/o/oauth2/v2/auth")
                and all(len(v) == 1 for v in params.values())
                and params.get("redirect_uri") == ["https://antigravity.google/oauth-callback"]
                and params.get("response_type") == ["code"]
                and params.get("code_challenge_method") == ["S256"]
                and all(params.get(k) for k in ("client_id", "state", "code_challenge", "scope"))
                and not {"access_token", "refresh_token", "id_token", "code"}.intersection(params))
    except ValueError:
        return False


class LoginTerminalProtocol:
    """Only fixed terminal responses, Google OAuth selection and one code."""

    def __init__(self):
        self.buffer = ""
        self.selected = False
        self.challenge_sent = False

    def feed(self, text: str) -> tuple[list[str], str | None]:
        self.buffer += text
        if len(self.buffer) > 65_536:
            raise ValueError("login_output_limit")
        writes = []
        for request, response in (
            ("\x1b[>c", "\x1b[>0;1;0c"), ("\x1b[c", "\x1b[?1;2c"),
            ("\x1b[6n", "\x1b[1;1R"), ("\x1b[?u", "\x1b[?0u"),
            ("\x1b]11;?\x07", "\x1b]11;rgb:0000/0000/0000\x1b\\"),
        ):
            if request in self.buffer:
                writes.append(response)
                self.buffer = self.buffer.replace(request, "")
        clean = ANSI.sub("", self.buffer)
        if not self.selected and "Select login method:" in clean and "> 1. Google OAuth" in clean:
            writes.append("\r")
            self.selected = True
        if not self.challenge_sent and "copy the code displayed in the browser" in clean:
            # OSC-8 carries the complete URL even when the TUI wraps its text.
            links = re.findall(r"\x1b\]8;[^;\x1b\x07]*;(https://[^\x1b\x07]+)(?:\x1b\\|\x07)", self.buffer)
            links += re.findall(r"https://[^\s\x1b\x07]+", clean)
            # A redraw may replace a challenge; only the latest valid URL
            # belongs to the code prompt currently displayed by the CLI.
            for link in reversed(links):
                if valid_authorization_url(link):
                    self.challenge_sent = True
                    self.buffer = ""
                    return writes, link
        if self.challenge_sent:
            # While the user authorizes in Google, redraws must not accumulate.
            # Retain only enough tail for fragmented fixed terminal queries.
            self.buffer = self.buffer[-32:]
        return writes, None


def run_terminal(binary: str, home: str, log_path: str, *, command: list[str] | None = None) -> None:
    # This process has a Job Object/process group owned by CliRunner.
    from pathlib import Path
    from agentic_cli import cli_environment
    environment = cli_environment(Path(home))
    environment.update(SSH_CONNECTION="127.0.0.1 1 127.0.0.1 2", SSH_TTY="nodia-remote",
                       TERM="xterm-256color", LANG="en_US.UTF-8")
    argv = command if command is not None else [binary, "--log-file", log_path]
    terminal = None
    master = None
    child = None
    if os.name == "nt":
        from winpty import PtyProcess
        terminal = PtyProcess.spawn(argv, cwd=home, env=environment, dimensions=(40, 240))
        read = terminal.read
        write = terminal.write
    else:
        import fcntl
        import pty
        import struct
        import termios
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 240, 0, 0))
        # The wrapper is a session leader; descendants retain its killable group.
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        try:
            child = subprocess.Popen(argv, cwd=home, env=environment,
                                     stdin=slave, stdout=slave, stderr=slave)
        finally:
            os.close(slave)
        def read():
            return os.read(master, 8192).decode("utf-8", errors="replace")
        def write(value: str):
            os.write(master, value.encode())

    messages: queue.Queue[tuple[str, str]] = queue.Queue(maxsize=16)
    def terminal_reader():
        try:
            while text := read():
                messages.put(("output", text))
        except (OSError, EOFError):
            pass
        messages.put(("closed", ""))
    def input_reader():
        while line := sys.stdin.readline(4097):
            messages.put(("input", line))
        messages.put(("closed", ""))
    threading.Thread(target=terminal_reader, daemon=True).start()
    threading.Thread(target=input_reader, daemon=True).start()
    protocol = LoginTerminalProtocol()
    submitted = False
    started = time.monotonic()
    total = 0
    try:
        while time.monotonic() - started < 300:
            try:
                kind, value = messages.get(timeout=0.2)
            except queue.Empty:
                continue
            if kind == "closed":
                return
            if kind == "input":
                command = json.loads(value)
                code = command.get("code") if isinstance(command, dict) else None
                if (submitted or not protocol.challenge_sent or not isinstance(code, str)
                        or re.fullmatch(CODE_PATTERN, code) is None):
                    raise ValueError("login_invalid_input")
                write(code + "\r")
                submitted = True
                print(json.dumps({"event": "code_sent"}), flush=True)
            else:
                total += len(value.encode())
                if total > 2_000_000:
                    raise ValueError("login_output_limit")
                if submitted:
                    # Code/credentials can be echoed; discard all subsequent output.
                    continue
                writes, authorization_url = protocol.feed(value)
                for response in writes:
                    write(response)
                if authorization_url:
                    print(json.dumps({"event": "challenge", "authorization_url": authorization_url}), flush=True)
    finally:
        if terminal is not None:
            terminal.close(force=True)
        if child is not None:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=2)
        if master is not None:
            os.close(master)


if __name__ == "__main__":
    try:
        run_terminal(*sys.argv[1:])
    except Exception:
        # Never print exception messages, terminal data, credentials or codes.
        print(json.dumps({"event": "failed"}), flush=True)
        raise SystemExit(1) from None
