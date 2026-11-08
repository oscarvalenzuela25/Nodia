"""Actual CLI metadata probe: no account binding and no user input.

Run only through run-offline.ps1, which supplies Docker's network-none boundary.
This does not qualify inference or hooks. No provider output is printed.
"""
import argparse
import asyncio
import json
from pathlib import Path
import sys
import tempfile


async def main(args: argparse.Namespace) -> int:
    sys.path.insert(0, str(args.source_root))
    from agentic_cli import CliConfig, CliRunner, prepare_cli_home
    from teacher_text_contract import TeacherAnswer
    from teacher_text_execution import AGENT_DOCUMENT, AGENT_NAME, process_closed

    with tempfile.TemporaryDirectory(prefix="nodia-offline-catalog-") as directory:
        root = Path(directory)
        home, workspace = root / "profile", root / "workspace"
        home.mkdir()
        workspace.mkdir()
        runner = CliRunner(CliConfig(args.binary, args.sha512, home, version="1.3.1"))
        await runner.initialize()
        prepare_cli_home(home)  # Deliberately no account_home, token or installation binding.
        role = workspace / ".agents/agents" / AGENT_NAME / "agent.md"
        role.parent.mkdir(parents=True)
        role.write_text(AGENT_DOCUMENT, encoding="utf-8", newline="\n")
        for config in (workspace / ".agents", home / ".gemini/config"):
            config.mkdir(parents=True, exist_ok=True)
            (config / "mcp_config.json").write_text('{"mcpServers":{}}', encoding="utf-8")
        events = []
        diagnostics = bytearray()
        status = "no_init_without_account_or_input"
        try:
            raw, code = await runner.run([
                "--input-format", "stream-json", "--output-format", "stream-json",
                "--json-schema", json.dumps(TeacherAnswer.model_json_schema()),
                "--disable-slash-commands", "--sandbox", "--print-timeout", "8s",
                "--model", args.model_id, "--agent", AGENT_NAME,
            ], stdin=b"", cwd=workspace, home=home, timeout=12,
                stderr_observer=diagnostics.extend)
            for line in raw.splitlines():
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                if isinstance(event, dict):
                    events.append(event)
        except Exception:
            code = None
            status = "bounded_cli_failure"
        inits = [event.get("init") for event in events if event.get("event") == "init"]
        catalog = None
        if len(inits) == 1 and isinstance(inits[0], dict):
            catalog = (inits[0].get("tools") == ["finish"]
                       and inits[0].get("model") == args.model_id
                       and inits[0].get("agent") == AGENT_NAME)
            status = "catalog_observed" if catalog else "catalog_rejected"
        closed = process_closed(runner)
        diagnostic = diagnostics.decode("utf-8", errors="replace").lower()
        diagnostic_classes = [name for name, needles in {
            "authentication_required": ("authentication required", "not authenticated", "not logged in"),
            "unknown_option": ("unknown option", "unrecognized option", "unexpected argument"),
            "empty_input": ("no prompt", "empty input", "no input"),
        }.items() if any(needle in diagnostic for needle in needles)]
        print(json.dumps({
            "probe": "antigravity-offline-catalog/1", "status": status,
            "cli_version": "1.3.1", "binary_sha512": args.sha512,
            "account_bound": False, "user_messages": 0,
            "network_boundary": "docker-network-none",
            "cli_exit_code": code, "init_count": len(inits),
            "diagnostic_classes": diagnostic_classes,
            "exact_finish_catalog": catalog, "local_closed": closed,
            "hook_negatives_verified": False, "inference_qualified": False,
        }, sort_keys=True))
        return 0 if catalog is True and closed else 2


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--sha512", required=True)
    parser.add_argument("--model-id", required=True)
    options = parser.parse_args()
    if not options.model_id or len(options.model_id.encode("utf-8")) > 1024:
        parser.error("An explicit bounded model ID is required")
    raise SystemExit(asyncio.run(main(options)))
