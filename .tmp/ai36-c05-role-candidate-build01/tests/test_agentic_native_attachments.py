"""Synthetic native-file lifecycle; no browser, account, CLI or network access."""
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
from agentic_progress import NativeFileCliProgress
from native_attachments import require_completed_attachment_reads, NATIVE_READER_AGENT_DOCUMENT
from nodia_ai_chat import ChatAdapter, ChatRequest
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from native_mcp_sessions import NativeMcpSessions, McpJob, McpChatRequest


def read_event(document: Path, **changes):
    return {"event": "step_update", "step_update": {"tool_name": "view_file", "state": "DONE",
        "tool_info": {"parameters": {"AbsolutePath": str(document.resolve())}}, **changes}}


class CompletedNativeReadTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.documents = [self.root / "synthetic.png", self.root / "synthetic.pdf"]
        for document in self.documents:
            document.write_bytes(b"synthetic attachment")

    def test_every_exact_file_requires_a_completed_successful_read(self):
        require_completed_attachment_reads([read_event(document) for document in self.documents], self.documents)
        for events in ([], [read_event(self.documents[0])],
                [read_event(self.documents[0]), read_event(self.documents[1], state="ACTIVE")],
                [read_event(self.documents[0]), read_event(self.documents[1], tool_info={"error": {"message": "private-error"}})]):
            with self.assertRaises(ServiceError) as caught:
                require_completed_attachment_reads(events, self.documents)
            self.assertEqual(caught.exception.code, "attachment_cli_file_read_missing")
            self.assertNotIn("private-error", str(caught.exception))
            self.assertNotIn(str(self.root), str(caught.exception))

    def test_receipt_or_unrelated_tool_does_not_prove_a_read(self):
        other = self.root / "other.png"
        other.write_bytes(b"synthetic other file")
        for events in ([{"tool": "attachment_0", "allowed": True}], [read_event(other)],
                [read_event(self.documents[0], tool_name="finish")],
                [{"event": "step_update", "step_update": {"tool_name": "view_file", "state": "DONE"}}]):
            with self.assertRaises(ServiceError):
                require_completed_attachment_reads(events, self.documents[:1])
        require_completed_attachment_reads([], [])

    def test_malformed_and_relative_event_paths_never_prove_a_read(self):
        for target in ("synthetic.png", None, 1, "\x00"):
            event = read_event(self.documents[0], tool_info={"parameters": {"AbsolutePath": target}})
            with self.assertRaises(ServiceError):
                require_completed_attachment_reads([None, {}, event], self.documents[:1])

    def test_falsey_or_malformed_tool_errors_never_prove_successful_read(self):
        for error in ({}, [], False, 0, "", {"type": "error", "message": "unsupported file format"}):
            with self.subTest(error=error):
                event = read_event(self.documents[0], tool_info={"parameters": {"AbsolutePath": str(self.documents[0].resolve())}, "error": error})
                with self.assertRaises(ServiceError):
                    require_completed_attachment_reads([event], self.documents[:1])
                trace = NativeFileCliProgress()
                trace.feed((json.dumps(event) + "\n").encode())
                self.assertFalse(trace.summary()["document_read_completed"])
                self.assertEqual(trace.summary()["phase"], "document_read_failed")
                self.assertTrue(trace.summary()["tool_error_categories"])
        for info in ({"parameters": {"AbsolutePath": str(self.documents[0].resolve())}},
                {"parameters": {"AbsolutePath": str(self.documents[0].resolve())}, "error": None}):
            require_completed_attachment_reads([read_event(self.documents[0], tool_info=info)], self.documents[:1])

    def test_failed_tool_does_not_erase_an_independent_previously_completed_read(self):
        trace = NativeFileCliProgress()
        trace.feed((json.dumps(read_event(self.documents[0])) + "\n").encode())
        trace.feed((json.dumps(read_event(self.documents[1], tool_info={"error": {"type": "error", "message": "permission denied"}})) + "\n").encode())
        self.assertTrue(trace.summary()["document_read_completed"])
        self.assertEqual(trace.summary()["phase"], "document_read_failed")
        self.assertEqual(trace.summary()["tool_error_categories"], ["permission"])

    def test_native_tool_diagnostics_keep_only_official_names_and_counts(self):
        trace = NativeFileCliProgress()
        names = ("view_file", "finish", "task_boundary", "notify_user", "view_file_outline", "list_dir", "find_by_name",
            "grep_search", "run_command", "write_to_file", "read_url_content", "call_mcp_tool")
        for name in names:
            for state in ("ACTIVE", "DONE"):
                event = read_event(self.documents[0], tool_name=name, state=state,
                    tool_info={"error": {"type": "error", "message": "permission denied private-error-marker"}})
                trace.feed((json.dumps(event) + "\n").encode())
        summary = trace.summary()
        self.assertEqual(summary["tool_event_counts"], {name: 2 for name in names})
        self.assertEqual(summary["tool_completed_counts"], {name: 1 for name in names})
        self.assertEqual(summary["tool_error_counts"], {name: 2 for name in names})
        self.assertNotIn("private-error-marker", json.dumps(summary))

    def test_unrecognized_or_malicious_tool_names_never_escape_diagnostics(self):
        trace = NativeFileCliProgress()
        secret = "private-path-prompt-account-and-credential"
        names = (secret, "view_file(" + secret + ")", "\nfinish:" + secret, "", [], {}, 12, False)
        for name in names:
            event = read_event(self.documents[0], tool_name=name, tool_info={"parameters": {"AbsolutePath": secret}, "error": "unsupported " + secret})
            trace.feed((json.dumps(event) + "\n").encode())
        summary = trace.summary()
        self.assertEqual(summary["tool_event_counts"], {"other": len(names)})
        self.assertEqual(summary["tool_completed_counts"], {"other": len(names)})
        self.assertEqual(summary["tool_error_counts"], {"other": len(names)})
        self.assertNotIn(secret, json.dumps(summary))

    def test_native_diagnostics_export_only_closed_categories_and_counts(self):
        trace = NativeFileCliProgress()
        secret = "private-prompt-file-response-and-credential"
        events = [read_event(self.documents[0], tool_info={"parameters": {"AbsolutePath": secret}, "output": secret,
            "error": {"message": "unsupported binary file " + secret}}),
            {"event": "result", "result": {"status": "ERROR", "response": secret, "denied_actions": [{"value": secret}]}}]
        raw = ("\n".join(json.dumps(event) for event in events) + "\n").encode()
        for offset in range(0, len(raw), 7):
            trace.feed(raw[offset:offset + 7])
        value = trace.summary()
        self.assertEqual(value["result_status"], "ERROR")
        self.assertEqual(value["phase"], "result")
        self.assertEqual(value["denied_actions_count"], 1)
        self.assertEqual(value["tool_error_categories"], ["format", "unsupported"])
        self.assertNotIn(secret, json.dumps(value))
        self.assertNotIn(str(self.root), json.dumps(value))
        trace.feed((json.dumps({"event": "result", "result": {"status": secret, "denied_actions": secret}}) + "\n").encode())
        self.assertEqual(trace.summary()["result_status"], "unrecognized")
        self.assertIsNone(trace.summary()["denied_actions_count"])


class AgenticNativeLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.home = self.root / "cli"
        self.home.mkdir()
        self.runner = SimpleNamespace(config=CliConfig(Path(sys.executable), "", self.home), run=AsyncMock())
        self.profiles = ProfileAdmission(self.root / "web", self.home, self.root / "state")
        self.adapter = ChatAdapter(None, SimpleNamespace(runner=self.runner), self.profiles)
        self.request = ChatRequest(attempt_id=str(uuid4()), model_id="fixture-model", effort_id="high",
            canonical_prompt="synthetic prompt", resource_key=self.profiles.identity("agentic"),
            session_generation="a" * 32, timeout_seconds=5)
        self.documents = [self.root / "synthetic.png", self.root / "synthetic.wav"]
        for document in self.documents:
            document.write_bytes(b"synthetic attachment")
        self.workspaces = []
        self.copied_paths = []
        self.include_done = True
        self.inference_error = None
        self.unexpected_tool = None
        self.reported_agent = "nodia-attachment-reader"
        self.runner.run.side_effect = self.run_command

    async def run_command(self, args, **kwargs):
        if "/model" in args:
            return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0},
                "command": {"name": "model", "data": {"id": "fixture-model"}}}), 0
        self.assertEqual(args[args.index("--model") + 1], "fixture-model")
        self.assertEqual(args[args.index("--effort") + 1], "high")
        self.assertEqual(args[args.index("--agent") + 1], "nodia-attachment-reader")
        workspace = kwargs["cwd"]
        self.workspaces.append(workspace)
        paths = [Path(value) for value in json.loads((workspace / "documents.json").read_text(encoding="utf-8"))]
        self.copied_paths.extend(paths)
        self.assertEqual([path.read_bytes() for path in paths], [path.read_bytes() for path in self.documents])
        self.assertTrue(all(path.parent == workspace for path in paths))
        self.assertNotEqual(kwargs["home"], self.home)
        agent = workspace / ".agents/agents/nodia-attachment-reader/agent.md"
        self.assertEqual(agent.read_text(encoding="utf-8"), NATIVE_READER_AGENT_DOCUMENT)
        self.assertNotIn("model:", agent.read_text(encoding="utf-8"))
        self.assertNotIn("effort:", agent.read_text(encoding="utf-8"))
        prompt = json.loads(kwargs["stdin"])["message"]["content"]
        self.assertIn("Únicas herramientas permitidas: view_file", prompt)
        self.assertIn("No uses task_boundary, notify_user", prompt)
        policy = json.loads((kwargs["home"] / ".gemini/antigravity-cli/settings.json").read_text(encoding="utf-8"))
        self.assertEqual(len(policy["permissions"]["allow"]), 2)
        self.assertTrue({"command(*)", "unsandboxed(*)", "write_file(*)", "read_url(*)", "mcp(*)"}.issubset(policy["permissions"]["deny"]))
        if self.inference_error is not None:
            raise self.inference_error
        decisions = [{"tool": "attachment_0", "allowed": True}, {"tool": "attachment_1", "allowed": True}, {"tool": "finish", "allowed": True}]
        (workspace / "gate_receipts.jsonl").write_text("\n".join(json.dumps(item) for item in decisions), encoding="utf-8")
        events = [{"event": "init", "init": {"model": "fixture-model", "agent": self.reported_agent}}]
        if self.include_done:
            events.extend(read_event(path) for path in paths)
        if self.unexpected_tool is not None:
            events.append({"event": "step_update", "step_update": {"tool_name": self.unexpected_tool, "state": "DONE",
                "tool_info": {"error": {"message": "permission denied private-untrusted-marker"}}}})
        events.append({"event": "result", "result": {"status": "SUCCESS", "structured_output": {"kind": "answer", "text": "synthetic answer"}}})
        raw = "\n".join(json.dumps(event) for event in events)
        kwargs["stdout_observer"]((raw + "\n").encode())
        return raw, 0

    def assert_cleaned(self):
        self.assertTrue(self.workspaces)
        self.assertTrue(all(not workspace.exists() for workspace in self.workspaces))
        self.assertTrue(all(not path.exists() for path in self.copied_paths))
        self.assertTrue(all(path.is_file() for path in self.documents))
        self.assertFalse(list(self.home.glob("nodia-chat-*")))

    async def test_native_files_are_copied_into_closed_workspace_and_removed_after_success(self):
        answer = await self.adapter.agentic_answer(self.request, "synthetic prompt", self.documents)
        self.assertEqual(answer.text, "synthetic answer")
        self.assertEqual(self.runner.run.await_count, 2)
        self.assert_cleaned()

    async def test_granted_but_unread_files_do_not_become_success(self):
        self.include_done = False
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.agentic_answer(self.request, "synthetic prompt", self.documents)
        self.assertEqual(caught.exception.code, "attachment_cli_file_read_missing")
        self.assertEqual(self.runner.run.await_count, 2)
        self.assert_cleaned()

    async def test_changed_custom_agent_does_not_become_success(self):
        self.reported_agent = "fixture-wrong-agent"
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.agentic_answer(self.request, "synthetic prompt", self.documents)
        self.assertEqual(caught.exception.code, "attachment_cli_agent_changed")
        self.assertEqual(self.runner.run.await_count, 2)
        self.assert_cleaned()

    async def test_malformed_custom_agent_definition_rejects_before_generation(self):
        workspaces = []
        def malformed(workspace):
            workspaces.append(workspace)
            path = workspace / ".agents/agents/nodia-attachment-reader/agent.md"
            path.parent.mkdir(parents=True)
            path.write_text("---\ntools: [run_command]\n---\n", encoding="utf-8")
            return path
        with patch("nodia_ai_chat.prepare_native_reader_agent", side_effect=malformed):
            with self.assertRaises(ServiceError) as caught:
                await self.adapter.agentic_answer(self.request, "synthetic prompt", self.documents)
        self.assertEqual(caught.exception.code, "attachment_cli_agent_invalid")
        self.assertEqual(self.runner.run.await_count, 1)
        self.assertTrue(workspaces)
        self.assertTrue(all(not workspace.exists() for workspace in workspaces))

    async def test_native_cancellation_and_timeout_remove_copies_without_second_generation(self):
        for error in (asyncio.CancelledError(), ServiceError("agentic_timeout", "Safe timeout", 504)):
            self.inference_error = error
            self.runner.run.reset_mock()
            with self.assertRaises(type(error)):
                await self.adapter.agentic_answer(self.request, "synthetic prompt", self.documents)
            self.assertEqual(self.runner.run.await_count, 2)
            self.assert_cleaned()

    async def test_unexpected_tool_warning_carries_closed_native_diagnostic_without_allowing_tool(self):
        self.unexpected_tool = "task_boundary"
        self.adapter.agentic.is_available = lambda: True
        self.adapter.agentic.session_generation = "a" * 32
        self.adapter.agentic.get_status = AsyncMock(return_value={"has_active_session": True, "models": [{"id": "fixture-model"}]})
        with patch("nodia_ai_chat.logger.info", side_effect=RuntimeError("private-sink-failure")):
            with self.assertLogs("nodia_ai_chat", level="WARNING") as captured:
                with self.assertRaises(ServiceError) as caught:
                    await self.adapter._execute("agentic", self.request, self.documents)
        self.assertEqual(caught.exception.code, "chat_result_unknown")
        diagnostic = json.loads(captured.records[-1].getMessage().split(" ", 1)[1])
        self.assertEqual(diagnostic["failure_category"], "attachment_cli_unexpected_tool")
        self.assertEqual(diagnostic["agentic_generation"]["tool_event_counts"], {"view_file": 2, "task_boundary": 1})
        self.assertEqual(diagnostic["agentic_generation"]["tool_error_counts"], {"task_boundary": 1})
        self.assertEqual(diagnostic["agentic_generation"]["result_status"], "SUCCESS")
        self.assertNotIn("private-", json.dumps(diagnostic))
        self.assertNotIn(str(self.root), json.dumps(diagnostic))
        self.assertEqual(self.adapter.ledger.read(self.request.attempt_id).state, "abandoned_unknown")
        self.assertEqual(self.runner.run.await_count, 2)
        self.assert_cleaned()


class AgenticNativeMcpLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_mcp_requires_completed_native_file_read_even_with_authorized_gate_receipts(self):
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        home = root / "cli"
        home.mkdir()
        document = root / "synthetic.pdf"
        document.write_bytes(b"synthetic pdf")
        runner = SimpleNamespace(config=CliConfig(Path(sys.executable), "", home), run=AsyncMock())
        profiles = ProfileAdmission(root / "web", home, root / "state")
        adapter = ChatAdapter(None, SimpleNamespace(runner=runner), profiles)
        sessions = NativeMcpSessions(adapter)
        self.addAsyncCleanup(sessions.close)
        request = McpChatRequest(attempt_id=str(uuid4()), model_id="fixture-model", effort_id=None,
            canonical_prompt="synthetic prompt", resource_key=profiles.identity("agentic"), session_generation="a" * 32,
            timeout_seconds=5, configuration_generation="b" * 64, diagnostic=True, tools=[{"name": "fixture_read",
                "description": "Synthetic read", "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}}])
        for completed in (False, True):
            async def run(args, **kwargs):
                workspace = kwargs["cwd"]
                bridge = workspace.parent / "bridge"
                manifest = json.loads((bridge / "manifest.json").read_text(encoding="utf-8"))
                copy = Path(manifest["documents"][0])
                self.assertEqual(copy.read_bytes(), document.read_bytes())
                prompt = json.loads(kwargs["stdin"])["message"]["content"]
                self.assertIn('{"kind":"answer","text":"Tu respuesta"}', prompt)
                self.assertNotIn("{kind:answer", prompt)
                (bridge / "gate.jsonl").write_text('\n'.join(json.dumps(item) for item in
                    [{"tool": "attachment_0", "allowed": True}, {"tool": "finish", "allowed": True}]), encoding="utf-8")
                from native_execution_agents import execution_agent_definition
                name, role = execution_agent_definition("mcp", True)
                self.assertEqual(args[args.index("--agent") + 1], name)
                self.assertEqual((workspace / '.agents' / 'agents' / name / 'agent.md').read_text(encoding='utf-8'), role)
                self.assertIn('  - view_file\n', role)
                events = [{"event": "init", "init": {"model": "fixture-model", "agent": name}}]
                if completed:
                    events.append(read_event(copy))
                events.append({"event": "result", "result": {"status": "SUCCESS", "structured_output": {"kind": "answer", "text": "synthetic answer"}}})
                return "\n".join(json.dumps(event) for event in events), 0
            runner.run.side_effect = run
            job = McpJob(request, None, None)
            if completed:
                self.assertEqual((await sessions.generate_with_attachments(job, [document])).text, "synthetic answer")
                self.assertTrue(job.gate_verified)
            else:
                with self.assertRaises(ServiceError) as caught:
                    await sessions.generate_with_attachments(job, [document])
                self.assertEqual(caught.exception.code, "attachment_cli_file_read_missing")
                self.assertFalse(job.gate_verified)
            self.assertFalse(list(home.glob("nodia-mcp-*")))
        self.assertEqual(runner.run.await_count, 2)
