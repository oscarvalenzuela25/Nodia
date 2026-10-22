"""Initial native prompt bytes, isolated HTTP metadata and pre-dispatch boundaries."""
import test_support
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError
from native_context_budget import (ContextMeasureRequest, McpTool, measure_context, build_chat_prompt,
    build_mcp_prompt, append_agentic_attachment_prompt, require_context_budget, MAX_NATIVE_CONTEXT_BYTES,
    controlled_native_context_bytes)
from nodia_ai_chat import ChatAdapter, ChatRequest, Answer, REPLY
from native_mcp_sessions import NativeMcpSessions, McpChatRequest
from main import create_app
from service_errors import ServiceError
from native_execution_agents import execution_agent_definition,prepare_execution_agent,verify_execution_agent


def tool():
    return McpTool(name="nodia_read", description="Lectura sintética ñ", input_schema={"type": "object", "additionalProperties": False})


def request(**values):
    return ContextMeasureRequest(model_id="configured-fixture-model", effort_id=None,
        canonical_prompt="Contexto ñ", **values)


class NativeContextBudgetTests(unittest.TestCase):
    def test_owned_mcp_role_has_only_dispatch_finish_and_explicit_attachment_reader(self):
        for attached in (False,True):
            with self.subTest(attached=attached),tempfile.TemporaryDirectory() as directory:
                workspace=Path(directory)
                name,document=execution_agent_definition('mcp',attached)
                declared={line.removeprefix('  - ') for line in document.splitlines() if line.startswith('  - ')}
                self.assertEqual(declared,{'finish'}|({'view_file'} if attached else set()))
                self.assertIn('mainAgent: true\nsubagent: false\n',document)
                self.assertIn('inheritMcp: true\n',document)
                self.assertIn('never wait for human confirmation',document)
                path=prepare_execution_agent(workspace,'mcp',attached)
                verify_execution_agent(path,workspace,'mcp',attached)
                self.assertEqual(path,workspace/'.agents'/'agents'/name/'agent.md')
                path.write_text(document+'synthetic unauthorized mutation',encoding='utf-8')
                with self.assertRaises(ServiceError) as caught:
                    verify_execution_agent(path,workspace,'mcp',attached)
                self.assertEqual(caught.exception.code,'native_cli_agent_invalid')

    def test_exact_web_and_agentic_bytes_are_the_same_constructed_native_prompt(self):
        for engine, schema in (("web", REPLY.json_schema()), ("agentic", Answer.model_json_schema())):
            with self.subTest(engine=engine):
                source = request()
                measured = measure_context(engine, source, schema)
                native = build_chat_prompt(engine, source.canonical_prompt, schema, False)
                self.assertEqual(measured.measurement_kind, "exact")
                self.assertEqual(measured.total_utf8_bytes, controlled_native_context_bytes(engine, native, False))
                role = execution_agent_definition("chat", False)[1] if engine == "agentic" else ""
                self.assertEqual(measured.total_utf8_bytes, len(native.encode("utf-8")) + len(role.encode("utf-8")))
                self.assertEqual(measured.canonical_utf8_bytes, len(source.canonical_prompt.encode("utf-8")))
                self.assertEqual(measured.catalog_utf8_bytes, 0)
                self.assertEqual(measured.total_utf8_bytes, measured.canonical_utf8_bytes + measured.overhead_utf8_bytes)
                self.assertEqual(measured.measurement_scope, "initial_native_prompt")
                self.assertIsNone(measured.model_context_tokens)

    def test_mcp_catalog_and_protocol_overhead_are_counted_in_addition_to_the_canonical_history(self):
        source = request(tools=[tool()])
        measured = measure_context("agentic", source, {})
        native = build_mcp_prompt(source.canonical_prompt, source.tools)
        self.assertEqual(measured.total_utf8_bytes, controlled_native_context_bytes("agentic", native, False, True))
        self.assertGreater(measured.catalog_utf8_bytes, 0)
        self.assertGreater(measured.overhead_utf8_bytes, 0)
        self.assertEqual(measured.total_utf8_bytes, measured.canonical_utf8_bytes + measured.catalog_utf8_bytes + measured.overhead_utf8_bytes)

    def test_every_owned_agent_definition_counts_at_the_actual_native_boundary(self):
        for kind, attachments in (("chat", False), ("chat", True), ("mcp", False), ("mcp", True)):
            with self.subTest(kind=kind, attachments=attachments):
                name, role = execution_agent_definition(kind, attachments)
                self.assertIn("name: " + name, role)
                if kind == "mcp":
                    self.assertIn("inheritMcp: true\n", role)
                    self.assertNotIn("  - call_mcp_tool\n", role)
                    self.assertEqual("  - view_file\n" in role, attachments)
                self.assertNotIn("\nmodel:", role)
                self.assertNotIn("\neffort:", role)
                self.assertNotIn("  - run_command", role)
                self.assertNotIn("  - task_boundary", role)
                role_bytes = len(role.encode("utf-8"))
                self.assertGreater(role_bytes, 0)
                exact = "x" * (MAX_NATIVE_CONTEXT_BYTES - role_bytes)
                require_context_budget(exact, role)
                self.assertEqual(controlled_native_context_bytes("agentic", exact, attachments, kind == "mcp"), MAX_NATIVE_CONTEXT_BYTES)
                with self.assertRaises(ServiceError) as caught:
                    require_context_budget(exact + "x", role)
                self.assertEqual(caught.exception.code, "context_limit")

    def test_metadata_reports_overflow_but_the_actual_boundary_rejects_it(self):
        source = request().model_copy(update={"canonical_prompt": "x" * MAX_NATIVE_CONTEXT_BYTES})
        measured = measure_context("web", source, REPLY.json_schema())
        self.assertGreater(measured.total_utf8_bytes, measured.max_utf8_bytes)
        with self.assertRaises(ServiceError) as caught:
            require_context_budget(build_chat_prompt("web", source.canonical_prompt, REPLY.json_schema(), False))
        self.assertEqual(caught.exception.code, "context_limit")

    def test_agentic_attachment_bound_covers_unicode_escaped_absolute_paths_without_reading_files(self):
        source = request(attachments=[{"kind": "audio"}])
        measured = measure_context("agentic", source, Answer.model_json_schema())
        self.assertEqual(measured.measurement_kind, "upper_bound")
        base = build_chat_prompt("agentic", source.canonical_prompt, Answer.model_json_schema(), True)
        for path in ("/tmp/attachment.wav", "/" + "\U00010000" * 1023, "/" + "\n" * 1023):
            actual = append_agentic_attachment_prompt(base, [path])
            self.assertLessEqual(controlled_native_context_bytes("agentic", actual, True), measured.total_utf8_bytes)
        with self.assertRaises(ServiceError):
            append_agentic_attachment_prompt(base, ["/" + "a" * 1024])

    def test_web_attachment_measurement_is_exact_because_paths_are_not_put_in_its_prompt(self):
        source = request(attachments=[{"kind": "image", "media_type": "image/png"}])
        measured = measure_context("web", source, REPLY.json_schema())
        self.assertEqual(measured.measurement_kind, "exact")
        self.assertEqual(measured.total_utf8_bytes,
            len(build_chat_prompt("web", source.canonical_prompt, REPLY.json_schema(), True).encode("utf-8")))

    def test_mcp_attachment_path_bound_counts_catalog_and_full_escaped_path(self):
        source = request(tools=[tool()], attachments=[{"kind": "pdf"}])
        measured = measure_context("agentic", source, {})
        self.assertEqual(measured.measurement_kind, "upper_bound")
        actual = build_mcp_prompt(source.canonical_prompt, source.tools, ["/" + "\U00010000" * 1023])
        self.assertEqual(measured.total_utf8_bytes, controlled_native_context_bytes("agentic", actual, True, True))

    def test_measurement_never_authorizes_web_tools_or_accepts_buffers_secrets_or_unknown_fields(self):
        with self.assertRaises(ServiceError):
            measure_context("web", request(tools=[tool()]), REPLY.json_schema())
        for extra in ({"attachments": [{"kind": "audio", "content_base64": "AAAA"}]},
                      {"tools": [tool().model_dump(), tool().model_dump()]}, {"api_key": "fixture-secret"}):
            with self.subTest(extra=tuple(extra)), self.assertRaises(ValidationError):
                request(**extra)

    def test_real_metadata_route_is_private_pure_closed_and_does_not_initialize_clients(self):
        with patch.dict("os.environ", {"GEMINI_SERVICE_TOKEN": "ab" * 32}), \
             patch("main.ChatAdapter", side_effect=AssertionError("SDK initialization is forbidden")):
            client = TestClient(create_app(load_environment=False))
            self.addCleanup(client.close)
            data = request().model_dump()
            for headers in ({}, {"X-Nodia-Service-Token": "invalid"}):
                response = client.post("/nodia-ai/web/measure-context", json=data, headers=headers)
                self.assertEqual(response.status_code, 401)
            response = client.post("/nodia-ai/web/measure-context", json=data,
                headers={"X-Nodia-Service-Token": "ab" * 32})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["measurement_kind"], "exact")
            self.assertIsNone(response.json()["model_context_tokens"])
            self.assertEqual(len(response.json()), 10)
            self.assertNotIn("configured-fixture-model", response.text)

    def test_metadata_transport_accepts_bounded_catalog_plus_history_and_rejects_an_unbounded_body(self):
        with patch.dict("os.environ", {"GEMINI_SERVICE_TOKEN": "ab" * 32}):
            client = TestClient(create_app(load_environment=False))
            self.addCleanup(client.close)
            headers = {"X-Nodia-Service-Token": "ab" * 32}
            data = request(tools=[tool().model_copy(update={"name": "fixture_" + str(index),
                "description": "x" * 2048}) for index in range(30)]).model_dump()
            data["canonical_prompt"] = "x" * 250000
            response = client.post("/nodia-ai/agentic/measure-context", json=data, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertGreater(response.json()["total_utf8_bytes"], response.json()["max_utf8_bytes"])
            response = client.post("/nodia-ai/web/measure-context", content=b"x" * (2 * 1024 * 1024 + 1),
                headers={**headers, "Content-Type": "application/json"})
            self.assertEqual(response.status_code, 413)
            self.assertEqual(response.json()["code"], "body_too_large")


class NativeContextPreDispatchTests(unittest.IsolatedAsyncioTestCase):
    def oversized(self):
        return {"attempt_id": "6c8d70cd-139e-4533-a730-22a233cf1ac4", "model_id": "configured-fixture-model",
            "effort_id": None, "canonical_prompt": "x" * MAX_NATIVE_CONTEXT_BYTES,
            "resource_key": "gemini-profile:" + "a" * 64, "session_generation": "b" * 32,
            "configuration_generation": "c" * 64, "timeout_seconds": 5}

    async def test_chat_rejects_protocol_overflow_before_reading_any_profile_ledger_or_sdk_state(self):
        adapter = ChatAdapter.__new__(ChatAdapter)
        with self.assertRaises(ServiceError) as caught:
            await adapter.execute("web", ChatRequest.model_validate(self.oversized()))
        self.assertEqual(caught.exception.code, "context_limit")

    async def test_mcp_rejects_catalog_overflow_before_claiming_any_profile_or_arming_the_ledger(self):
        adapter = NativeMcpSessions.__new__(NativeMcpSessions)
        with self.assertRaises(ServiceError) as caught:
            await adapter.start(McpChatRequest.model_validate({**self.oversized(), "tools": [tool().model_dump()]}))
        self.assertEqual(caught.exception.code, "context_limit")
