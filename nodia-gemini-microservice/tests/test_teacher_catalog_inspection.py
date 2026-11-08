"""EOF metadata lane: synthetic CLI boundary, no real account/provider/profile."""
import test_support
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from pydantic import ValidationError
import test_native_teacher_text as fixtures
from teacher_text_contract import TeacherObserve
from teacher_text_execution import (AGENT_NAME, AGENT_DOCUMENT, catalog_shape, inspect_catalog_events,
    parse_terminal, TeacherExecutionError)
from service_errors import ServiceError
from unittest.mock import patch


def command():
    return TeacherObserve(contract="teacher-agentic-text/1", model_id="synthetic-model",
        effort_id="synthetic-effort", configuration_generation="b" * 64)


def init(tools):
    return {"event": "init", "init": {"model": "synthetic-model", "agent": AGENT_NAME, "tools": tools}}


class CatalogParserTests(unittest.TestCase):
    def test_duplicate_finish_objects_and_unknown_names_are_diagnostic_not_permissive(self):
        shape = catalog_shape({"tools": ["finish", "finish", {"name": "finish", "description": "PRIVATE"},
            "run_command", "PRIVATE_TOOL", {"name": "PRIVATE_NAME"}, 42]})
        self.assertEqual(shape.entry_count, 7)
        self.assertEqual(shape.finish_string_count, 2)
        self.assertEqual(shape.finish_object_name_count, 1)
        self.assertEqual(shape.known_tool_names, ["finish", "run_command"])
        self.assertEqual(shape.unrecognized_name_count, 3)
        self.assertNotIn("PRIVATE", shape.model_dump_json())
        with tempfile.TemporaryDirectory() as temporary:
            for tools in (["finish", "finish"], [{"name": "finish"}], ["finish", "run_command"]):
                with self.assertRaises(TeacherExecutionError) as caught:
                    parse_terminal(json.dumps(init(tools)), 0, Path(temporary)/"absent", "synthetic-model")
                self.assertEqual(caught.exception.failure.code, "tool_catalog_mismatch")
                self.assertIsNotNone(caught.exception.failure.catalog)

    def test_eof_missing_init_and_turns_are_unknown_not_invented_zero(self):
        self.assertEqual(inspect_catalog_events("", 0, "synthetic-model")["reason"], "init_missing")
        result = inspect_catalog_events(json.dumps(init(["finish"])), 0, "synthetic-model")
        self.assertEqual(result["status"], "observed")
        self.assertIsNone(result["num_turns"])
        self.assertEqual(catalog_shape({}).container_type, "absent")
        self.assertIsNone(catalog_shape({"tools": None}).entry_count)
        self.assertTrue(catalog_shape({"tools": ["finish"]*4097}).over_limit)

    def test_every_activity_and_positive_or_malformed_turn_counter_rejected(self):
        for event in ({"event": "message"}, {"event": "step_update", "step_update": {"tool_name": "finish"}},
                      {"event": "tool_call"}, {"event": "result", "result": {"num_turns": 1}},
                      {"event": "result", "result": {"num_turns": "0"}}):
            raw = json.dumps(init(["finish"]))+"\n"+json.dumps(event)
            self.assertEqual(inspect_catalog_events(raw, 0, "synthetic-model")["status"], "rejected")
        with self.assertRaises(ValidationError):
            TeacherObserve.model_validate({**command().model_dump(), "prompt": "forbidden"})


class CatalogOwnershipTests(unittest.IsolatedAsyncioTestCase):
    successful_cli = fixtures.TeacherRuntimeTests.successful_cli

    async def asyncSetUp(self):
        await fixtures.TeacherRuntimeTests.asyncSetUp(self)

    async def test_empty_input_exact_owned_preparation_and_no_generation_ledger(self):
        async def eof(args, **kwargs):
            self.assertEqual(kwargs["stdin"], b"")
            self.assertEqual(kwargs["timeout"], 12.0)
            self.assertEqual(args[args.index("--agent")+1], AGENT_NAME)
            self.assertIn("--json-schema", args)
            self.assertIn("--disable-slash-commands", args)
            workspace, home = kwargs["cwd"], kwargs["home"]
            self.assertNotEqual(home, self.home)
            self.assertEqual((home/".gemini/config/agents"/AGENT_NAME/"agent.md").read_text(), AGENT_DOCUMENT)
            self.assertFalse((workspace/".agents/agents"/AGENT_NAME/"agent.md").exists())
            self.assertFalse((self.home/".gemini/config/agents"/AGENT_NAME/"agent.md").exists())
            role_lines = (home/".gemini/config/agents"/AGENT_NAME/"agent.md").read_text().split("---", 2)[1].splitlines()
            self.assertEqual([line for line in role_lines if line.startswith("excludeDefaultComponents:")], ["excludeDefaultComponents: true"])
            self.assertIn("PreToolUse", (home/".gemini/config/hooks.json").read_text())
            with self.assertRaises(ServiceError): self.profiles.reserve("agentic", purpose="execution")
            return json.dumps(init(["finish", "finish"])), 0
        self.runner.run.side_effect = eof
        result = await self.adapter.inspect_catalog(command())
        self.assertTrue(result.local_closed)
        self.assertEqual(result.catalog.finish_string_count, 2)
        self.assertFalse(result.qualification_inferred)
        self.assertEqual(result.user_events_sent, 0)
        self.assertIsNone(result.provider_internal_generation_posts)
        self.assertFalse(self.adapter.records)
        self.assertFalse(self.adapter.tasks)
        self.assertFalse(self.adapter.transport.workspaces)
        reservation = self.profiles.reserve("agentic", purpose="execution")
        reservation.release()

    async def test_existing_profile_owner_prevents_inspection_before_process(self):
        reservation = self.profiles.reserve("agentic", purpose="execution")
        try:
            with self.assertRaises(ServiceError): await self.adapter.inspect_catalog(command())
            self.runner.run.assert_not_awaited()
        finally: reservation.release()

    async def test_global_role_mutation_is_rejected_before_any_CLI_process(self):
        write_text = Path.write_text
        def tampered(path, data, *args, **kwargs):
            if path.name == 'agent.md':
                data = data.replace('tools:\n  - finish','tools:\n  - run_command')
            return write_text(path,data,*args,**kwargs)
        with patch.object(Path,'write_text',tampered):
            result = await self.adapter.inspect_catalog(command())
        self.assertEqual(result.status,'inconclusive')
        self.assertTrue(result.local_closed)
        self.runner.run.assert_not_awaited()
        self.assertFalse(self.adapter.transport.workspaces)
        self.assertFalse(self.profiles._held)

    async def test_unclosed_process_retains_workspace_and_quarantines_profile(self):
        async def unclosed(args, **kwargs):
            self.runner._processes.add("synthetic-unclosed-owned-handle")
            return json.dumps(init(["finish"])), 0
        self.runner.run.side_effect = unclosed
        result = await self.adapter.inspect_catalog(command())
        self.assertFalse(result.local_closed)
        self.assertEqual(result.status, "inconclusive")
        self.assertTrue(self.adapter.transport.workspaces)
        with self.assertRaises(ServiceError): self.profiles.reserve("agentic", purpose="execution")
        self.runner._processes.clear()
        for identity in list(self.adapter.transport.workspaces): self.adapter.transport.cleanup(identity)

    async def test_cancellation_waits_for_owned_runner_cleanup_and_releases_profile(self):
        entered = asyncio.Event()
        async def waiting(args, **kwargs):
            self.runner._processes.add("synthetic-handle")
            entered.set()
            try: await asyncio.Event().wait()
            finally: self.runner._processes.clear()
        self.runner.run.side_effect = waiting
        task = asyncio.create_task(self.adapter.inspect_catalog(command()))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertFalse(self.adapter.transport.workspaces)
        self.assertFalse(self.adapter.inspections)
        reservation = self.profiles.reserve("agentic", purpose="execution")
        reservation.release()
