"""Synthetic plain-Agentic diagnostics: no account, CLI, browser or network."""
import test_support
import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from agentic_cli import CliConfig
from nodia_ai_chat import ChatAdapter, ChatRequest
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from native_cli_diagnostics import capture_plain_gate_diagnostic
from native_execution_agents import execution_agent_definition


class PlainAgenticDiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.home = self.root / "profile"
        self.home.mkdir()
        self.runner = SimpleNamespace(config=CliConfig(Path(sys.executable), "", self.home), run=AsyncMock())
        self.adapter = ChatAdapter(None, SimpleNamespace(runner=self.runner),
            ProfileAdmission(self.root / "web", self.home, self.root / "state"))
        self.request = ChatRequest(attempt_id=str(uuid4()), model_id="synthetic-model", effort_id="synthetic-effort",
            canonical_prompt="private-canonical-message", resource_key="gemini-profile:" + "a" * 64,
            session_generation="b" * 32, timeout_seconds=5)
        self.failure = None
        self.wait = None
        self.entered = asyncio.Event()
        self.workspaces = []
        self.reported_agent = "nodia-text-chat"
        self.runner.run.side_effect = self.run_command

    async def run_command(self, args, **kwargs):
        if "/model" in args:
            return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0},
                "command": {"name": "model", "data": {"id": self.request.model_id}}}), 0
        self.assertEqual(args[args.index("--model") + 1], self.request.model_id)
        self.assertEqual(args[args.index("--effort") + 1], self.request.effort_id)
        self.assertEqual(args[args.index("--print-timeout") + 1], "5s")
        self.assertEqual(args[args.index("--agent") + 1], "nodia-text-chat")
        workspace = kwargs["cwd"]
        self.workspaces.append(workspace)
        name, definition = execution_agent_definition("chat", False)
        self.assertEqual((workspace / ".agents" / "agents" / name / "agent.md").read_text(encoding="utf-8"), definition)
        (workspace / "cli.log").write_text("HTTP status 429 RESOURCE_EXHAUSTED private-log-secret", encoding="utf-8")
        (workspace / "gate_receipts.jsonl").write_text('{"tool":"finish","allowed":true}\n', encoding="utf-8")
        events = [{"event": "init", "init": {"model": self.request.model_id, "agent": self.reported_agent, "account": "private-account"}},
            {"event": "step_update", "step_update": {"tool_name": "finish", "state": "DONE",
                "text_delta": "private-response", "tool_info": {"parameters": {"secret": "private-arguments"}}}},
            {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"kind": "answer", "text": "synthetic answer"}}}]
        if self.failure is not None:
            events[1]["step_update"]["tool_name"] = "private-arbitrary-tool"
            events[1]["step_update"]["tool_info"]["error"] = "permission denied private-error"
        raw = "\n".join(json.dumps(event) for event in events)
        kwargs["stdout_observer"]((raw + "\n").encode())
        self.entered.set()
        if self.wait is not None:
            await self.wait.wait()
        if self.failure is not None:
            raise self.failure
        return raw, 0

    def assert_safe_and_clean(self, diagnostic):
        value = json.dumps(diagnostic)
        self.assertNotIn("private-", value)
        self.assertNotIn(str(self.root), value)
        self.assertTrue(all(not workspace.exists() for workspace in self.workspaces))
        self.assertFalse(list(self.home.glob("nodia-chat-*")))
        self.assertIsInstance(diagnostic["total_elapsed_ms"], int)

    async def test_success_plain_has_closed_progress_log_hook_and_measured_phases(self):
        diagnostic = {}
        with patch("nodia_ai_chat.logger.info") as sink:
            answer = await self.adapter.agentic_answer(self.request, self.request.canonical_prompt, native_diagnostic=diagnostic)
        self.assertEqual(answer.text, "synthetic answer")
        self.assertEqual(diagnostic["execution_phase"], "terminal_validation")
        self.assertEqual(diagnostic["cli"]["tool_completed_counts"], {"finish": 1})
        self.assertEqual(diagnostic["cli_log"]["provider_error_indicators"], ["RESOURCE_EXHAUSTED"])
        self.assertEqual(diagnostic["cli_log"]["http_statuses"], [429])
        self.assertEqual(diagnostic["cli_log"]["interpretation"], "text_indicator_not_verified_cause")
        self.assertEqual(diagnostic["hook"]["finish_count"], 1)
        self.assertEqual(diagnostic["hook"]["rejected_count"], 0)
        for field in ("model_preflight_elapsed_ms", "bootstrap_elapsed_ms", "cli_elapsed_ms"):
            self.assertGreaterEqual(diagnostic[field], 0)
        self.assertNotIn("private-", str(sink.call_args_list))
        self.assertEqual(self.runner.run.await_count, 2)
        self.assert_safe_and_clean(diagnostic)

    async def test_failure_and_timeout_preserve_exception_and_closed_tool_categories(self):
        for failure in (ServiceError("agentic_timeout", "private-error", 504), TimeoutError("private-timeout")):
            with self.subTest(kind=type(failure).__name__):
                self.failure = failure
                diagnostic = {}
                with self.assertRaises(type(failure)) as caught:
                    await self.adapter.agentic_answer(self.request, "private-prompt", native_diagnostic=diagnostic)
                self.assertIs(caught.exception, failure)
                self.assertEqual(diagnostic["execution_phase"], "cli_generation")
                self.assertEqual(diagnostic["cli"]["tool_event_counts"], {"other": 1})
                self.assertEqual(diagnostic["cli"]["tool_error_categories"], ["permission"])
                self.assert_safe_and_clean(diagnostic)
        self.assertEqual(self.runner.run.await_count, 4)

    async def test_cancel_preserves_cancellation_cleanup_and_emits_safe_terminal(self):
        self.wait = asyncio.Event()
        diagnostic = {}
        with patch("nodia_ai_chat.logger.info") as sink:
            task = asyncio.create_task(self.adapter.agentic_answer(self.request, "private-prompt", native_diagnostic=diagnostic))
            await self.entered.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertEqual(diagnostic["execution_phase"], "cli_generation")
        terminal = json.loads(sink.call_args.args[1])
        self.assertEqual(terminal["outcome"], "cancelled")
        self.assert_safe_and_clean(diagnostic)

    async def test_broken_log_capture_or_sink_never_changes_success(self):
        for target in ("nodia_ai_chat.capture_cli_log_diagnostic", "nodia_ai_chat.logger.info"):
            with self.subTest(target=target), patch(target, side_effect=RuntimeError("private-sink-error")):
                diagnostic = {}
                answer = await self.adapter.agentic_answer(self.request, "private-prompt", native_diagnostic=diagnostic)
                self.assertEqual(answer.text, "synthetic answer")
                self.assert_safe_and_clean(diagnostic)

    async def test_preflight_failure_does_not_infer_or_change_selection(self):
        self.runner.run.side_effect = ServiceError("agentic_model_unavailable", "private-error", 503)
        diagnostic = {}
        with self.assertRaises(ServiceError):
            await self.adapter.agentic_answer(self.request, "private-prompt", native_diagnostic=diagnostic)
        self.assertEqual(diagnostic["execution_phase"], "model_preflight")
        self.assertEqual(self.runner.run.await_count, 1)
        self.assertEqual(self.workspaces, [])
        self.assert_safe_and_clean(diagnostic)

    async def test_success_cannot_hide_missing_or_changed_native_role(self):
        for reported in (None, "foreign-agent"):
            with self.subTest(reported=reported):
                self.reported_agent = reported
                diagnostic = {}
                with self.assertRaises(ServiceError) as caught:
                    await self.adapter.agentic_answer(self.request, "private-prompt", native_diagnostic=diagnostic)
                self.assertEqual(caught.exception.code, "native_cli_agent_changed")
                self.assert_safe_and_clean(diagnostic)

    async def test_tampered_owned_role_fails_before_inference_without_relaxing_gate(self):
        def forged(workspace, _kind, _has_attachments):
            path = workspace / ".agents" / "agents" / "nodia-text-chat" / "agent.md"
            path.parent.mkdir(parents=True)
            path.write_text("private-instructions grant shell permissions", encoding="utf-8")
            return path
        diagnostic = {}
        with patch("nodia_ai_chat.prepare_execution_agent", side_effect=forged), self.assertRaises(ServiceError) as caught:
            await self.adapter.agentic_answer(self.request, "private-prompt", native_diagnostic=diagnostic)
        self.assertEqual(caught.exception.code, "native_cli_agent_invalid")
        self.assertEqual(self.runner.run.await_count, 1)
        self.assertFalse(list(self.home.glob("nodia-chat-*")))

    def test_hook_diagnostic_only_exports_counts_never_arbitrary_names(self):
        receipt = self.root / "receipt.jsonl"
        receipt.write_text('{"tool":"private-tool","allowed":false}\n', encoding="utf-8")
        diagnostic = capture_plain_gate_diagnostic(receipt, {"finish"})
        self.assertEqual(diagnostic["decision_count"], 1)
        self.assertEqual(diagnostic["unrecognized_count"], 1)
        self.assertEqual(diagnostic["rejected_count"], 1)
        self.assertNotIn("private-tool", json.dumps(diagnostic))
        receipt.write_text("x" * 9000, encoding="utf-8")
        self.assertEqual(capture_plain_gate_diagnostic(receipt, {"finish"})["state"], "oversize")


if __name__ == "__main__":
    unittest.main()
