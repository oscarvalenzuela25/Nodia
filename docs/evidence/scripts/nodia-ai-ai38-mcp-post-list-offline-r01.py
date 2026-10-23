"""Synthetic real-stdio counterexamples; no application/SDK, VM, or network."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / "nodia-gemini-microservice"
OUTPUT = ROOT / "docs/evidence/nodia-ai-ai38-mcp-post-list-offline-r01.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rpc(identity, method, params=None):
    value = {"jsonrpc": "2.0", "method": method}
    if identity is not None:
        value["id"] = identity
    if params is not None:
        value["params"] = params
    return value


def case(error_before_list, append_ping=False):
    with tempfile.TemporaryDirectory(prefix="nodia-ai38-post-list-synthetic-") as directory:
        root = Path(directory)
        (root / "requests").mkdir()
        (root / "responses").mkdir()
        manifest = root / "manifest.json"
        manifest.write_text(json.dumps({"tools": [{"name": "fixture_read", "description": "Synthetic fixture only",
            "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}}],
            "rpc_budget": 128, "tool_budget": 12, "timeout_seconds": 1, "cli_json_string_arguments": True,
            "context_budget": {"schema_version": 1, "initial_utf8_bytes": 0, "maximum_utf8_bytes": 262144}}), encoding="utf-8")
        error = rpc(2, "resources/list" if error_before_list else "prompts/list")
        listed = rpc(3, "tools/list")
        requests = [rpc(1, "initialize", {"protocolVersion": "2025-11-25"}), rpc(None, "notifications/initialized"),
                    *([error, listed] if error_before_list else [listed, error]),
                    rpc(None, "notifications/progress"), rpc(None, "notifications/cancelled")]
        if append_ping:
            requests.append(rpc(4, "ping"))
        completed = subprocess.run([sys.executable, "-I", str(SERVICE / "native_mcp_stdio.py"), str(manifest)],
            input="".join(json.dumps(item) + "\n" for item in requests).encode(), capture_output=True,
            cwd=root, timeout=5, check=True)
        replies = [json.loads(line) for line in completed.stdout.splitlines()]
        assert completed.stderr == b""
        assert [reply for reply in replies if reply.get("id") == 2][0]["error"]["code"] == -32602
        assert [reply for reply in replies if reply.get("id") == 3][0]["result"]["tools"][0]["name"] == "fixture_read"
        if append_ping:
            assert replies[-1] == {"jsonrpc": "2.0", "id": 4, "result": {}}
        events = [json.loads(path.read_bytes()) for path in sorted((root / "requests").glob("*.json"))]
        diagnostics = [event["rpc_diagnostic"] for event in events]
        assert all(event["tool_requests"] == 0 for event in events)
        return {"synthetic_error_method": error["method"], "error_before_list": error_before_list,
            "exit_code": completed.returncode, "RPC_messages": len(events), "tool_requests": 0,
            "methods": dict(Counter(value["method"] for value in diagnostics)),
            "responses": dict(Counter(value["response"] for value in diagnostics)),
            "error_ordinals": [index + 1 for index, value in enumerate(diagnostics) if value["response"] == "error"],
            "list_success_ordinals": [index + 1 for index, value in enumerate(diagnostics) if value["method"] == "tools_list" and value["response"] == "success"],
            "last_response": diagnostics[-1], "ping_after_error_observed_on_stdout": append_ping}


def main():
    frozen = json.loads((ROOT / "docs/evidence/nodia-ai-ai38-profile-reservation-fix-build-r01.json").read_bytes())
    names = ("native_mcp_stdio.py", "native_mcp_sessions.py", "native_execution_agents.py", "native_cli_diagnostics.py")
    pins = {name: sha(SERVICE / name) for name in names}
    assert all(value == frozen["target_public_python_hashes"][name] for name, value in pins.items())
    cases = [case(True), case(False), case(True, append_ping=True)]
    assert cases[0]["methods"] == cases[1]["methods"] == {"initialize": 1, "notifications_initialized": 1, "other": 3, "tools_list": 1}
    assert cases[0]["responses"] == cases[1]["responses"] == {"success": 2, "notification": 3, "error": 1}
    assert cases[0]["last_response"] == cases[1]["last_response"]
    assert cases[0]["error_ordinals"] != cases[1]["error_ordinals"]
    result = {"scope": "synthetic_real_stdio_offline_counterexamples_not_provider_cause", "status": "passed",
        "source_sha256": sha(Path(__file__)), "runtime_FIX_public_source_pins": pins, "cases": cases,
        "facts": ["Two distinct synthetic methods and opposite error/list ordering produce the same retained aggregate and last_response.",
                  "An unsupported request returns -32602 without terminating the bridge; subsequent tools/list and ping replies reach synthetic stdout.",
                  "These fixtures do not identify the actual other methods, prove CLI consumption, or explain the live timeout."],
        "real_CLI_executions": 0, "VM_calls": 0, "network_calls": 0, "SQL_calls": 0, "provider_generations": 0,
        "bridge_subprocesses": 3, "temporary_synthetic_workspaces_closed": True}
    raw = (json.dumps(result, indent=2) + "\n").encode()
    if OUTPUT.exists():
        assert OUTPUT.read_bytes() == raw
    else:
        with OUTPUT.open("xb") as target:
            target.write(raw)
    print(json.dumps({"status": "passed", "receipt": OUTPUT.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(raw).hexdigest()}))


if __name__ == "__main__":
    main()
