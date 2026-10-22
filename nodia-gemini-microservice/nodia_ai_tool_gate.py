"""Standalone CLI gate: only the structured finish terminator has no I/O."""
import json
import sys
from pathlib import Path


def file_decision(payload: object, documents: list[str]) -> tuple[str, bool]:
    if not isinstance(payload, dict) or not isinstance(payload.get("toolCall"), dict):
        return "other", False
    call = payload["toolCall"]
    if call.get("name") == "finish":
        return "finish", True
    args = call.get("args")
    if call.get("name") != "view_file" or not isinstance(args, dict) or not isinstance(args.get("AbsolutePath"), str):
        return "other", False
    target = Path(args["AbsolutePath"])
    if not target.is_absolute() or target.is_symlink():
        return "other", False
    try:
        for index, document in enumerate(documents):
            if target.resolve() == Path(document).resolve() and target.is_file():
                return "attachment_" + str(index), True
    except (ValueError, OSError):
        pass
    return "other", False


def decide(payload: object) -> bool:
    return file_decision(payload, [])[1]


def main() -> None:
    allowed = False
    try:
        raw = sys.stdin.buffer.read(65537)
        documents = []
        if len(sys.argv) == 3:
            manifest = Path(sys.argv[2])
            if manifest.stat().st_size > 4096:
                raise ValueError("Manifest budget")
            documents = json.loads(manifest.read_text())
            if not isinstance(documents, list) or len(documents) > 4 or any(not isinstance(item, str) for item in documents):
                raise ValueError("Invalid manifest")
        name, allowed = file_decision(json.loads(raw), documents) if len(raw) <= 65536 else ("other", False)
        if len(sys.argv) not in (2, 3):
            allowed = False
        else:
            with Path(sys.argv[1]).open("a", encoding="utf-8") as receipt:
                receipt.write(json.dumps({"tool": name, "allowed": allowed}) + "\n")
    except (ValueError, OSError):
        allowed = False
    print(json.dumps({"decision": "allow" if allowed else "deny", "reason": "No runtime tools are published."}))


if __name__ == "__main__":
    main()
