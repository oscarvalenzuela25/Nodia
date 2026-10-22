"""Standalone CLI hook for AI-03; nothing is sent to network or business APIs."""
import json
from pathlib import Path
import sys

from experiments.nodia_ai_mcp_fixture import gate, parse_json, MAX_LINE


def main() -> None:
    allowed = False
    name = "invalid"
    try:
        name, allowed = gate(parse_json(sys.stdin.buffer.read(MAX_LINE + 1)))
        if len(sys.argv) == 2:
            with Path(sys.argv[1]).open("a", encoding="utf-8") as audit:
                audit.write(json.dumps({"tool": name, "allowed": allowed}) + "\n")
    except (OSError, ValueError, TypeError):
        allowed = False
    print(json.dumps({"decision": "allow" if allowed else "deny",
                      "reason": "AI-03 permits only two synthetic MCP tools and structured finish."}))


if __name__ == "__main__":
    main()
