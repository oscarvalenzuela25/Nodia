"""Gated exec only. No SDK, credentials or application imports."""
import os
import select
import sys
import time


def await_gate(descriptor: int, timeout: float = 10.0) -> bool:
    if descriptor < 3:
        return False
    deadline = time.monotonic() + timeout
    value = b""
    try:
        while len(value) <= 1:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            readable, _, _ = select.select([descriptor], [], [], remaining)
            if not readable:
                return False
            part = os.read(descriptor, 2 - len(value))
            if not part:
                return value == b"1"
            value += part
        return False
    finally:
        os.close(descriptor)


def main() -> int:
    if len(sys.argv) < 6 or not sys.argv[1].isdigit():
        return 125
    descriptor = int(sys.argv[1])
    command = sys.argv[2:]
    if (not os.path.isabs(command[0]) or command[1] != "-I" or not os.path.isabs(command[2])
            or command[3] not in ("--observe", "--execute") or "--login" in command):
        os.close(descriptor)
        return 125
    if not await_gate(descriptor):
        return 125
    os.execve(command[0], command, dict(os.environ))
    return 125


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError):
        raise SystemExit(125) from None
