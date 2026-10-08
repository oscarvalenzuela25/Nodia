"""CLI PreToolUse hook: only the current document may be read.

Runs as a standalone subprocess. Never imports application configuration or logs
the CLI payload, which can contain document contents and authentication metadata.
"""
import json
import sys
from pathlib import Path


def decide(payload: object, document: Path | None) -> tuple[str, bool]:
    try:
        call = payload["toolCall"]
        name = call["name"]
        target = call["args"].get("AbsolutePath")
        # `finish` is the CLI's structured response terminator, with no I/O.
        allowed = name == "finish" or (name == "view_file" and document is not None
                   and isinstance(target, str) and Path(target).is_absolute()
                   and Path(target).resolve() == document.resolve())
        return name if isinstance(name, str) else "invalid", allowed
    except (KeyError, TypeError, AttributeError, OSError, ValueError):
        return "invalid", False


def main() -> None:
    document = Path(sys.argv[1]) if len(sys.argv) == 3 else None
    receipt = Path(sys.argv[2]) if len(sys.argv) == 3 else None
    try:
        raw = sys.stdin.buffer.read(65_537)
        name, allowed = decide(json.loads(raw) if len(raw) <= 65_536 else None, document)
        if receipt is not None:
            with receipt.open("a", encoding="utf-8") as target:
                target.write(json.dumps({"tool": name, "allowed": allowed}) + "\n")
    except (ValueError, OSError):
        allowed = False
    print(json.dumps({"decision": "allow" if allowed else "deny",
                      "reason": "Nodia permits only reading the current invoice and returning its structured result."}))


if __name__ == "__main__":
    main()
