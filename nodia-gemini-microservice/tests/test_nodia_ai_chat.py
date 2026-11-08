"""Agentic CLI policy regressions retained after Web transport retirement."""
import test_support
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from nodia_ai_chat import ChatAdapter, ChatRequest, parse_reply
from profile_admission import ProfileAdmission
from service_errors import ServiceError

class AgenticChatTests(unittest.IsolatedAsyncioTestCase):
    async def test_attachment_diagnostic_sink_failure_preserves_result_error_and_cancellation(self):
        from agentic_cli import CliConfig
        import sys
        directory = self.enterContext(tempfile.TemporaryDirectory())
        root = Path(directory)
        (root / "cli").mkdir()
        document = root / "input.png"
        document.write_bytes(b"synthetic image")
        profiles = ProfileAdmission(root / "cli", root / "state")
        runner = SimpleNamespace(config=CliConfig(Path(sys.executable), "", root / "cli"), run=AsyncMock())
        adapter = ChatAdapter(SimpleNamespace(runner=runner), profiles)
        request = ChatRequest(attempt_id=str(uuid4()), model_id="fixture-model", effort_id=None,
            canonical_prompt="Synthetic", resource_key=profiles.identity("agentic"), session_generation="a"*32, timeout_seconds=5)
        for outcome in ("completed", "error", "cancelled"):
            workspaces = []
            async def run(args, **kwargs):
                if "/model" in args:
                    return json.dumps({"status":"SUCCESS", "num_turns":0, "usage":{"total_tokens":0},
                        "command":{"name":"model", "data":{"id":"fixture-model"}}}), 0
                workspace = kwargs["cwd"]
                workspaces.append(workspace)
                if outcome == "error":
                    raise ValueError("synthetic-runtime-error")
                if outcome == "cancelled":
                    raise asyncio.CancelledError()
                copied = workspace / "attachment-0.png"
                (workspace / "gate_receipts.jsonl").write_text(
                    '{"tool":"attachment_0","allowed":true}\n{"tool":"finish","allowed":true}\n', encoding="utf-8")
                events = [{"event":"init", "init":{"model":"fixture-model","agent":"nodia-attachment-reader"}},
                    {"event":"step_update", "step_update":{"tool_name":"view_file", "state":"DONE",
                        "tool_info":{"parameters":{"AbsolutePath":str(copied.resolve())}}}},
                    {"event":"result", "result":{"status":"SUCCESS", "structured_output":{"kind":"answer", "text":"Synthetic"}}}]
                return "\n".join(json.dumps(event) for event in events), 0
            runner.run.side_effect = run
            with self.subTest(outcome=outcome), patch("nodia_ai_chat.logger.info", side_effect=RuntimeError("synthetic-log-error")):
                if outcome == "completed":
                    self.assertEqual((await adapter.agentic_answer(request, "Synthetic", [document])).text, "Synthetic")
                else:
                    with self.assertRaises(asyncio.CancelledError if outcome == "cancelled" else ValueError):
                        await adapter.agentic_answer(request, "Synthetic", [document])
                self.assertTrue(workspaces)
                self.assertTrue(all(not workspace.exists() for workspace in workspaces))

    async def test_only_finish_allowed_and_arbitrary_mcp_file_shell_denied(self):
        from nodia_ai_tool_gate import decide
        self.assertTrue(decide({"toolCall": {"name": "finish", "args": {}}}))
        for name in ("call_mcp_tool", "mcp(nodia/finance.create)", "view_file", "run_command", "read_url", "subagent"):
            self.assertFalse(decide({"toolCall": {"name": name, "args": {}}}))
        self.assertFalse(decide(None))

    async def test_closed_agentic_global_home_policy_and_verified_hook_receipt(self):
        from agentic_cli import CliConfig
        import sys
        directory = self.enterContext(tempfile.TemporaryDirectory())
        root = Path(directory)
        profiles = ProfileAdmission(root / "cli", root / "state")
        (root / "cli").mkdir()
        runner = SimpleNamespace(config=CliConfig(Path(sys.executable), "", root / "cli"), run=AsyncMock())
        executions = []
        async def run(args, **kwargs):
            if "/model" in args:
                return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0}, "command": {"name": "model", "data": {"id": "fixture-model"}}}), 0
            home = kwargs["home"]
            configuration = json.loads((home / ".gemini/config/mcp_config.json").read_text(encoding="utf-8"))
            hooks = json.loads((home / ".gemini/config/hooks.json").read_text(encoding="utf-8"))
            settings = json.loads((home / ".gemini/antigravity-cli/settings.json").read_text(encoding="utf-8"))
            self.assertEqual(configuration, {"mcpServers": {}})
            self.assertIn("mcp(*)", settings["permissions"]["deny"])
            self.assertIn("PreToolUse", hooks["nodia-chat"])
            self.assertNotEqual(home, runner.config.home)
            self.assertNotEqual(kwargs["cwd"], runner.config.home)
            self.assertIn("--disable-slash-commands", args)
            (kwargs["cwd"] / "gate_receipts.jsonl").write_text('{"tool":"finish","allowed":true}\n', encoding="utf-8")
            executions.append(kwargs["cwd"])
            return "\n".join(json.dumps(event) for event in [{"event":"init","init":{"model":"fixture-model","agent":"nodia-text-chat"}}, {"event":"result","result":{"status":"SUCCESS","structured_output":{"kind":"answer","text":"Hola"}}}]), 0
        runner.run.side_effect = run
        service = SimpleNamespace(runner=runner, is_available=lambda: True, session_generation="a"*32, get_status=AsyncMock(return_value={"has_active_session":True,"models":[{"id":"fixture-model"}]}))
        adapter = ChatAdapter(service, profiles)
        request = ChatRequest(attempt_id=str(uuid4()), model_id="fixture-model", effort_id=None, canonical_prompt="Historia", resource_key=profiles.identity("agentic"),session_generation="a"*32,timeout_seconds=5)
        result = await adapter.execute("agentic", request)
        self.assertEqual(result.text,"Hola")
        self.assertEqual(runner.run.await_count,2)
        self.assertFalse(executions[0].exists())
