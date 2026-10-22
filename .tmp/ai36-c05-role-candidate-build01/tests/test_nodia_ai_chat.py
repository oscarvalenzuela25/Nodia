"""Offline real admission/protocol paths; no browser, account or business data."""
import test_support
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from nodia_ai_chat import ChatAdapter, ChatRequest, ObserveRequest, parse_reply, _json_syntax_diagnostic
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from interactive_login import InteractiveLoginManager
from gemini_service import GeminiWebService


class ProfileAdmissionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.root = Path(self.directory)

    async def test_same_physical_profile_excludes_other_modes_without_queue(self):
        profiles = ProfileAdmission(self.root / "profile", self.root / "profile")
        async with profiles.operation("web"):
            with self.assertRaises(ServiceError) as caught:
                profiles.reserve("agentic")
            self.assertEqual(caught.exception.code, "runtime_busy")
        async with profiles.operation("agentic"):
            pass

    async def test_independent_profiles_keep_independent_capacity(self):
        profiles = ProfileAdmission(self.root / "web", self.root / "cli")
        async with profiles.operation("web"), profiles.operation("agentic"):
            self.assertNotEqual(profiles.identity("web"), profiles.identity("agentic"))

    async def test_unknown_survives_restart_and_never_releases_profile(self):
        profiles = ProfileAdmission(self.root / "web", None, self.root / "state")
        async with profiles.operation("web"):
            profiles.arm_dispatch("web")
            profiles.quarantine("web")
        restarted = ProfileAdmission(self.root / "web", None, self.root / "state")
        with self.assertRaises(ServiceError):
            restarted.reserve("web")
        self.assertEqual(len(list((self.root / "state").glob("*.unknown"))), 1)
        self.assertEqual(list((self.root / "state").glob("*.unknown"))[0].read_text(), "unknown\n")

    async def test_validated_result_clears_marker_and_preserves_capacity(self):
        profiles = ProfileAdmission(self.root / "web", None, self.root / "state")
        async with profiles.operation("web"):
            profiles.arm_dispatch("web")
            profiles.resolve_dispatch("web")
        restarted = ProfileAdmission(self.root / "web", None, self.root / "state")
        restarted.reserve("web").release()
        self.assertEqual(list((self.root / "state").glob("*.unknown")), [])

    async def test_login_cancel_before_first_instruction_releases_reservation(self):
        profiles = ProfileAdmission(self.root, None)
        reservation = profiles.reserve("web")
        manager = InteractiveLoginManager()
        job = manager.start(AsyncMock(), "1", reservation.release)
        manager.cancel(job["id"], "1")
        await manager.close()
        await asyncio.sleep(0)
        profiles.reserve("web").release()

    async def test_login_guard_rejects_all_shared_existing_locks(self):
        service = GeminiWebService()
        for lock in (service._analysis_lock, service._quota_lock, service._client_lock, service.browser_manager.lock):
            async with lock:
                with self.assertRaises(ServiceError):
                    service.assert_login_allowed()


class ChatProtocolTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.root = Path(self.directory)
        self.profiles = ProfileAdmission(self.root / "web", None, self.root / "state")
        self.web = SimpleNamespace(is_initialized=True, client=object(), session_generation="a" * 32,
            discovered_models=lambda: [SimpleNamespace(model_id="fixture-model")],
            _reasoning_profiles={}, _reasoning_profile_invalid=False, supported_options=lambda: {"thinking_levels_by_model": {}},
            init_client=AsyncMock(), _generate_content=AsyncMock(return_value=SimpleNamespace(text='{"kind":"answer","text":"Hola"}')),
            _persist_live_cookies=Mock())
        self.adapter = ChatAdapter(self.web, SimpleNamespace(), self.profiles)

    def request(self, **override):
        return ChatRequest.model_validate({"attempt_id": str(uuid4()), "model_id": "fixture-model", "effort_id": None,
            "canonical_prompt": "Historia canónica sintética", "resource_key": self.profiles.identity("web"),
            "session_generation": "a" * 32, "timeout_seconds": 5, **override})

    async def test_one_exact_generation_no_tools_no_sdk_retry(self):
        reply = await self.adapter.execute("web", self.request())
        self.assertEqual(reply.text, "Hola")
        self.web._generate_content.assert_awaited_once()
        call = self.web._generate_content.await_args
        self.assertEqual(call.kwargs["model"].model_id, "fixture-model")
        self.assertIs(call.kwargs["preserve_structured_text"], True)
        self.assertNotIn("tools", call.kwargs)
        self.assertEqual(list((self.root / "state").glob("*.unknown")), [])

    async def test_same_attempt_never_resends_even_after_valid_response(self):
        request = self.request()
        await self.adapter.execute("web", request)
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.execute("web", request)
        self.assertEqual(caught.exception.code, "attempt_already_dispatched")
        self.web._generate_content.assert_awaited_once()

    async def test_web_can_only_request_delegation_not_dispatch_it(self):
        self.web._generate_content.return_value.text = '{"kind":"delegation_request","reason":"Necesita consulta autorizada"}'
        reply = await self.adapter.execute("web", self.request())
        self.assertEqual(reply.kind, "delegation_request")
        self.web._generate_content.assert_awaited_once()

    async def test_web_native_citation_presentation_finishes_original_generation_without_replay(self):
        self.web._generate_content.return_value.text = '{"kind":"answer","text":"Hola"}[cite: 1]'
        request = self.request()
        reply = await self.adapter.execute("web", request)
        self.assertEqual(reply.text, "Hola")
        self.assertEqual(self.adapter.ledger.read(request.attempt_id).state, "completed")
        self.assertEqual(list((self.root / "state").glob("*.unknown")), [])
        self.web._generate_content.assert_awaited_once()

    async def test_unknown_quarantines_all_consumers_and_does_not_replay(self):
        self.web._generate_content.side_effect = TimeoutError()
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.execute("web", self.request())
        self.assertEqual(caught.exception.code, "chat_result_unknown")
        with self.assertRaises(ServiceError):
            self.profiles.reserve("web")
        self.web._generate_content.assert_awaited_once()
        self.assertEqual(len(list((self.root / "state").glob("*.unknown"))), 1)

    async def test_cancellation_closes_owned_operation_and_keeps_quarantine(self):
        entered = asyncio.Event()
        async def pending(*args, **kwargs):
            entered.set()
            await asyncio.Event().wait()
        self.web._generate_content.side_effect = pending
        task = asyncio.create_task(self.adapter.execute("web", self.request()))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        with self.assertRaises(ServiceError):
            self.profiles.reserve("web")

    async def test_changed_session_or_resource_never_generates(self):
        for override in ({"session_generation": "b" * 32}, {"resource_key": "gemini-profile:" + "f" * 64}):
            with self.assertRaises(ServiceError):
                await self.adapter.execute("web", self.request(**override))
        self.web._generate_content.assert_not_awaited()

    async def test_unavailable_model_or_effort_never_generates(self):
        for override in ({"model_id": "not-discovered"}, {"effort_id": "high"}):
            with self.assertRaises(ServiceError):
                await self.adapter.execute("web", self.request(**override))
        self.web._generate_content.assert_not_awaited()

    async def test_malformed_model_response_is_uncertain_not_success(self):
        self.web._generate_content.return_value.text = '{"kind":"tool_request","tool":"sql","arguments":{}}'
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.execute("web", self.request())
        self.assertEqual(caught.exception.code, "chat_result_unknown")

    async def test_failure_diagnostics_do_not_log_exception_or_conversation_content(self):
        self.web._generate_content.side_effect = TimeoutError("private-provider-marker")
        request = self.request(canonical_prompt="private-conversation-marker")
        with self.assertLogs("nodia_ai_chat", level="WARNING") as captured:
            with self.assertRaises(ServiceError) as caught:
                await self.adapter.execute("web", request)
        self.assertEqual(caught.exception.code, "chat_result_unknown")
        record = json.loads(captured.records[0].getMessage().split(" ", 1)[1])
        self.assertEqual(set(record), {"engine", "attempt_id", "phase", "error_type", "elapsed_ms", "web_generation"})
        self.assertEqual(record["phase"], "generation")
        self.assertEqual(record["error_type"], "TimeoutError")
        self.assertEqual(record["attempt_id"], request.attempt_id)
        self.assertGreaterEqual(record["elapsed_ms"], 0)
        self.assertNotIn("private-provider-marker", "".join(captured.output))
        self.assertNotIn("private-conversation-marker", "".join(captured.output))
        self.web._generate_content.assert_awaited_once()

    async def test_invalid_reply_is_diagnosed_separately_without_logging_it(self):
        self.web._generate_content.return_value.text = "private-invalid-reply-marker"
        with self.assertLogs("nodia_ai_chat", level="WARNING") as captured:
            with self.assertRaises(ServiceError):
                await self.adapter.execute("web", self.request())
        record = json.loads(captured.records[0].getMessage().split(" ", 1)[1])
        self.assertEqual(record["phase"], "reply_validation")
        self.assertNotIn("private-invalid-reply-marker", "".join(captured.output))
        self.web._generate_content.assert_awaited_once()

    async def test_json_syntax_diagnostic_keeps_exact_failure_without_response_or_replay(self):
        import hashlib
        # The shape distinguishes a missing colon from a truncated stream without
        # exporting either the field name or the provider's response characters.
        private_reply = '{"private-field"="private-response-marker"}'
        self.web._generate_content.return_value.text = private_reply
        request = self.request(canonical_prompt="private-conversation-marker")
        with self.assertLogs("nodia_ai_chat", level="WARNING") as captured:
            with self.assertRaises(ServiceError) as caught:
                await self.adapter.execute("web", request)
        self.assertEqual(caught.exception.code, "chat_result_unknown")
        record = json.loads(captured.records[0].getMessage().split(" ", 1)[1])
        syntax = record["reply_format"]["json_syntax"]
        self.assertEqual(syntax["category"], "colon_delimiter")
        self.assertEqual(syntax["character_category"], "equals")
        self.assertEqual(syntax["ending_category"], "object_close")
        self.assertFalse(syntax["at_end"])
        self.assertEqual(syntax["document_sha256"], hashlib.sha256(private_reply.encode()).hexdigest())
        for private_value in ("private-field", "private-response-marker", "private-conversation-marker"):
            self.assertNotIn(private_value, "".join(captured.output))
        self.assertEqual(self.adapter.ledger.read(request.attempt_id).state, "abandoned_unknown")
        with self.assertRaises(ServiceError):
            await self.adapter.execute("web", request)
        self.web._generate_content.assert_awaited_once()

    async def test_success_diagnostic_failure_preserves_completed_reply_and_proof(self):
        request = self.request()
        with patch("nodia_ai_chat.progress_logger.info", side_effect=RuntimeError("private-log-sink-error")):
            reply = await self.adapter.execute("web", request)
        self.assertEqual(reply.text, "Hola")
        self.assertEqual(self.adapter.ledger.read(request.attempt_id).state, "completed")
        self.assertEqual(list((self.root / "state").glob("*.unknown")), [])
        self.web._generate_content.assert_awaited_once()

    async def test_error_diagnostic_failure_still_quarantines_and_preserves_unknown(self):
        self.web._generate_content.side_effect = RuntimeError("private-provider-error")
        with patch("nodia_ai_chat.logger.warning", side_effect=RuntimeError("private-log-sink-error")):
            with self.assertRaises(ServiceError) as caught:
                await self.adapter.execute("web", self.request())
        self.assertEqual(caught.exception.code, "chat_result_unknown")
        with self.assertRaises(ServiceError):
            self.profiles.reserve("web")

    async def test_cancel_diagnostic_failure_never_replaces_cancellation_or_replays(self):
        entered = asyncio.Event()
        async def pending(*args, **kwargs):
            entered.set()
            await asyncio.Event().wait()
        self.web._generate_content.side_effect = pending
        with patch("nodia_ai_chat.progress_logger.info", side_effect=RuntimeError("private-log-sink-error")):
            task = asyncio.create_task(self.adapter.execute("web", self.request()))
            await entered.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.web._generate_content.assert_awaited_once()
        with self.assertRaises(ServiceError):
            self.profiles.reserve("web")

    async def test_observation_exact_model_and_effort_not_name_inference(self):
        observation = await self.adapter.observe("web", ObserveRequest(model_id="fixture-model", effort_id=None))
        self.assertTrue(observation["available"])
        self.assertFalse(observation["supports_mcp"])
        self.assertIsNotNone(observation["observed_at"])
        other = await self.adapter.observe("web", ObserveRequest(model_id="not-discovered", effort_id=None))
        self.assertFalse(other["available"])
        effort = await self.adapter.observe("web", ObserveRequest(model_id="fixture-model", effort_id="high"))
        self.assertFalse(effort["available"])
        self.web._generate_content.assert_not_awaited()

    async def test_strict_closed_parser_rejects_duplicate_fields_and_tools(self):
        for raw in ('{"kind":"answer","kind":"answer","text":"ok"}', '{"kind":"answer","text":"ok","sql":"DELETE"}', '{"kind":"delegation_request","reason":"x"}'):
            with self.assertRaises(ValueError):
                parse_reply(raw, "agentic")


class JsonSyntaxDiagnosticTests(unittest.TestCase):
    def test_web_native_citation_suffix_matches_observed_synthetic_failure_without_inference(self):
        import hashlib
        raw = '{"kind":"answer","text":"The purple lantern is glowing."}[cite: 1]'
        self.assertEqual(len(raw), 66)
        self.assertEqual(hashlib.sha256(raw.encode()).hexdigest(), "7806984847b82221a24787b58aaca08ddb3d5e6166047e6014edeb539e4206f8")
        self.assertEqual(parse_reply(raw, "web").text, "The purple lantern is glowing.")
        with self.assertRaises(json.JSONDecodeError):
            parse_reply(raw, "agentic")

    def test_web_citations_are_bounded_presentation_and_do_not_change_answer_or_delegation_fields(self):
        answer = '{"kind":"answer","text":"literal [cite: 7] stays in the answer"}'
        self.assertEqual(parse_reply(answer+'[cite: 0]\n[cite: 1234567890]', "web").text, "literal [cite: 7] stays in the answer")
        self.assertEqual(parse_reply('```json\n  '+answer+'[cite: 2]\n```', "web").text, "literal [cite: 7] stays in the answer")
        self.assertEqual(parse_reply('{"kind":"delegation_request","reason":"Needs authorized tools"}[cite: 1]', "web").kind, "delegation_request")
        self.assertEqual(parse_reply('{"kind":"answer","text":"ok"}'+('[cite: 1]'*32), "web").text, "ok")
        self.assertEqual(parse_reply('{"kind":"answer","text":"ok"}'+(' '*503)+'[cite: 1]', "web").text, "ok")
        for suffix in ('[cite: 1]'*33, '[cite: 12345678901]', '[cite: ١]', '[cite: -1]', '[CITE: 1]',
                '[cite:1]', '[cite: 1] garbage', '{"kind":"answer","text":"second"}', '[other: 1]',
                '[cite: 1' , '[cite: 1]```', (' '*512)+'[cite: 1]'):
            with self.subTest(suffix_category=suffix[:15]):
                with self.assertRaises(json.JSONDecodeError):
                    parse_reply('{"kind":"answer","text":"ok"}'+suffix, "web")
        for malformed in ('{"kind":"answer","text":"ok"', '{"kind":"answer","text":"ok","kind":"answer"}',
                '{"kind":"answer","text":NaN}', '{"kind":"answer","text":"ok","execute":true}'):
            with self.assertRaises(ValueError):
                parse_reply(malformed+'[cite: 1]', "web")

    def test_categories_are_bounded_and_offsets_follow_normalized_json(self):
        fixtures = [
            ("{'private':1}", "property_name", "single_quote", False),
            ('{"private"=1}', "colon_delimiter", "equals", False),
            ('{"private":1 "other":2}', "comma_delimiter", "double_quote", False),
            ('{"private":}', "value", "object_close", False),
            ('{"private":', "value", "boundary", True),
            ('{"private":"unterminated}', "unterminated_string", "double_quote", False),
            ('{"private":"a\nb"}', "invalid_control", "control", False),
            ('{"private":"a\\q"}', "invalid_escape", "backslash", False),
            ('{"private":1} {"other":2}', "extra_data", "object_open", False),
            ('```json\n{"private"=1}\n```', "colon_delimiter", "equals", False),
        ]
        for raw, category, character, at_end in fixtures:
            with self.subTest(category=category, character=character):
                with self.assertRaises(json.JSONDecodeError) as caught:
                    parse_reply(raw, "web")
                diagnostic = _json_syntax_diagnostic(caught.exception)
                self.assertEqual(diagnostic["category"], category)
                self.assertEqual(diagnostic["character_category"], character)
                self.assertEqual(diagnostic["at_end"], at_end)
                self.assertEqual(diagnostic["position"], caught.exception.pos)
                self.assertEqual(diagnostic["line"], caught.exception.lineno)
                self.assertEqual(diagnostic["column"], caught.exception.colno)
                self.assertEqual(diagnostic["document_chars"], len(caught.exception.doc))
                self.assertNotIn("private", json.dumps(diagnostic))
                self.assertNotIn("unterminated}", json.dumps(diagnostic))


class AgenticChatTests(unittest.IsolatedAsyncioTestCase):
    async def test_attachment_diagnostic_sink_failure_preserves_result_error_and_cancellation(self):
        from agentic_cli import CliConfig
        import sys
        directory = self.enterContext(tempfile.TemporaryDirectory())
        root = Path(directory)
        (root / "cli").mkdir()
        document = root / "input.png"
        document.write_bytes(b"synthetic image")
        profiles = ProfileAdmission(root / "web", root / "cli", root / "state")
        runner = SimpleNamespace(config=CliConfig(Path(sys.executable), "", root / "cli"), run=AsyncMock())
        adapter = ChatAdapter(None, SimpleNamespace(runner=runner), profiles)
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
        profiles = ProfileAdmission(root / "web", root / "cli", root / "state")
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
        adapter = ChatAdapter(None, service, profiles)
        request = ChatRequest(attempt_id=str(uuid4()), model_id="fixture-model", effort_id=None, canonical_prompt="Historia", resource_key=profiles.identity("agentic"),session_generation="a"*32,timeout_seconds=5)
        result = await adapter.execute("agentic", request)
        self.assertEqual(result.text,"Hola")
        self.assertEqual(runner.run.await_count,2)
        self.assertFalse(executions[0].exists())


class ChatHttpTests(test_support.AppTestCase):
    def configure(self):
        self.profiles = ProfileAdmission(Path(self.directory) / "web", None, Path(self.directory) / "state")
        self.web.is_initialized = True
        self.web.client = object()
        self.web.session_generation = "a" * 32
        self.web.discovered_models = lambda: [SimpleNamespace(model_id="fixture-model")]
        self.web._generate_content = AsyncMock(return_value=SimpleNamespace(text='{"kind":"answer","text":"Hola"}'))
        self.web._persist_live_cookies = Mock()
        self.app.state.profiles = self.profiles
        self.app.state.chat = ChatAdapter(self.web, self.app.state.agentic, self.profiles)

    def payload(self):
        return {"attempt_id": str(uuid4()), "model_id":"fixture-model", "effort_id":None,
            "canonical_prompt":"Historia", "resource_key":self.profiles.identity("web"),
            "session_generation":"a" * 32, "timeout_seconds":5}

    def test_new_chat_routes_require_private_identity_and_validate_closed_input(self):
        self.configure()
        self.assertEqual(self.client.post("/nodia-ai/web/turn", json=self.payload()).status_code,401)
        invalid = self.payload()
        invalid["tools"] = [{"name":"sql"}]
        self.assertEqual(self.client.post("/nodia-ai/web/turn",headers=test_support.HEADERS,json=invalid).status_code,422)
        self.web._generate_content.assert_not_awaited()

    def test_chat_observation_and_turn_preserve_exact_private_contract(self):
        self.configure()
        observation=self.client.post("/nodia-ai/web/observe",headers=test_support.HEADERS,json={"model_id":"fixture-model","effort_id":None})
        self.assertEqual(observation.status_code,200)
        self.assertTrue(observation.json()["available"])
        self.assertFalse(observation.json()["supports_mcp"])
        result=self.client.post("/nodia-ai/web/turn",headers=test_support.HEADERS,json=self.payload())
        self.assertEqual(result.json()["reply"],{"kind":"answer","text":"Hola"})
        self.assertEqual(result.json()["terminal_proof"]["outcome"],"completed")

    def test_login_ocr_discovery_refresh_logout_reject_while_profile_owned(self):
        self.configure()
        reservation=self.profiles.reserve("web")
        try:
            for method,path,body in (("GET","/models",None),("POST","/auth/refresh",None),("POST","/auth/logout",None),("POST","/auth/login/start",None),("POST","/nodia-ai/web/turn",self.payload())):
                headers={**test_support.HEADERS,"X-Nodia-Actor-Id":"1"}
                result=self.client.request(method,path,headers=headers,json=body)
                self.assertEqual(result.status_code,409,path)
            self.assertEqual(self.analyze().status_code,409)
        finally:
            reservation.release()
        self.web._generate_content.assert_not_awaited()
        self.web.analyze_invoice.assert_not_awaited()

    def test_unknown_survives_next_request_without_model_data_leak_or_replay(self):
        self.configure()
        self.web._generate_content.side_effect=RuntimeError("PRIVATE_PROVIDER_DATA")
        result=self.client.post("/nodia-ai/web/turn",headers=test_support.HEADERS,json=self.payload())
        self.assertEqual(result.status_code,502)
        self.assertNotIn("PRIVATE_PROVIDER_DATA",result.text)
        self.assertEqual(self.client.get("/models",headers=test_support.HEADERS).status_code,409)
        self.web._generate_content.assert_awaited_once()
