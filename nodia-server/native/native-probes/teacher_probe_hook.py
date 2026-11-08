"""Probe-only hook fixture; never installed in a persistent account profile."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

GATE_SHA256 = "994cfd59965dc066fc8c05567b4d074c88b376eb7dc435975d17bbd15df04f39"


def main() -> int:
    mode, original, receipt, audit = sys.argv[1:]
    gate = Path(original)
    if hashlib.sha256(gate.read_bytes()).hexdigest() != GATE_SHA256:
        return 71
    raw = sys.stdin.buffer.read(65537)
    if len(raw) > 65536:
        return 72
    try:
        packet = json.loads(raw)
        is_finish = isinstance(packet, dict) and packet.get("toolCall", {}).get("name") == "finish"
    except (ValueError, AttributeError):
        return 73
    evidence = {"fixture": "teacher-probe-hook/1", "mode": mode,
                "gate_sha256": GATE_SHA256, "actual_finish_packet_observed": is_finish}
    if mode == "hook_fail":
        Path(audit).write_text(json.dumps(evidence), encoding="utf-8")
        return 1  # Deliberately no decision and no production receipt.
    if mode != "positive" or not is_finish:
        return 74
    allowed = subprocess.run([sys.executable, str(gate), receipt], input=raw,
                             capture_output=True, timeout=3, check=False)
    # Retain the real CLI packet only in memory. Replace the toolCall, preserving
    # the actual envelope shape. This tests the copied gate, not a CLI-offered tool.
    denied_packet = {**packet, "toolCall": {"name": "run_command", "args": {}}}
    denied_receipt = str(Path(audit).with_suffix(".denied.jsonl"))
    denied = subprocess.run([sys.executable, str(gate), denied_receipt],
                            input=json.dumps(denied_packet).encode(),
                            capture_output=True, timeout=3, check=False)
    try:
        evidence["direct_gate_forbidden_denied"] = (denied.returncode == 0
            and json.loads(denied.stdout).get("decision") == "deny"
            and Path(denied_receipt).read_text().splitlines() == ['{"tool": "other", "allowed": false}'])
        evidence["finish_allowed"] = (allowed.returncode == 0
            and json.loads(allowed.stdout).get("decision") == "allow")
    except (ValueError, OSError):
        return 75
    Path(audit).write_text(json.dumps(evidence), encoding="utf-8")
    if not evidence["direct_gate_forbidden_denied"] or not evidence["finish_allowed"]:
        return 76
    sys.stdout.buffer.write(allowed.stdout)
    return allowed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
