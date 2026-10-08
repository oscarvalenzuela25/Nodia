import test_support
import asyncio
import hashlib
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock
from unittest.mock import patch
import os

from agentic_cli import CliConfig, CliRunner, cli_environment, prepare_cli_home
from agentic_observation import command_data, discovered_models, observed_quota
from agentic_service import AntigravityAgentService
from agentic_tool_gate import decide
from service_errors import ServiceError
from test_support import RESULT, HEADERS, fake_web


def report(name, data):
    return json.dumps({"status": "SUCCESS", "num_turns": 0,
                       "usage": {"total_tokens": 0}, "command": {"name": name, "data": data}})


QUOTA = {"groups": [{"name": "Observed group", "buckets": [
    {"id": "observed-window", "remaining_fraction": 1, "window": "5h"}]}]}


class AgenticCliTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.home = Path(self.directory)
        self.runner = AsyncMock()
        self.runner.config = CliConfig(Path(sys.executable), "", self.home)
        self.runner.run.side_effect = self.run_command
        self.service = AntigravityAgentService(self.runner)
        await self.service.initialize()
        self.service._snapshot = None
        self.runner.run.reset_mock()

    async def asyncTearDown(self):
        await self.service.close()

    async def run_command(self, args, **kwargs):
        if args == ["models"]:
            return "observed-model\tObserved model\n", 0
        if "/usage" in args:
            return report("usage", QUOTA), 0
        if "/model" in args:
            return report("model", {"id": "observed-model"}), 0
        document = kwargs["cwd"] / "invoice.pdf"
        (kwargs["home"] / "tool_receipts.jsonl").write_text(json.dumps({"tool": "view_file", "allowed": True}))
        return "\n".join(json.dumps(e) for e in [
            {"event": "init", "init": {"model": "observed-model"}},
            {"event": "step_update", "step_update": {"tool_name": "view_file", "state": "DONE",
             "tool_info": {"parameters": {"AbsolutePath": str(document)}}}},
            {"event": "result", "result": {"status": "SUCCESS", "structured_output": RESULT}},
        ]), 0

    async def test_observation_is_non_generative_shared_and_preserves_zero(self):
        first, second = await asyncio.gather(self.service.get_status(), self.service.get_status())
        self.assertTrue(first["has_active_session"])
        self.assertEqual(first["quota"]["observed-window"]["usage_percentage"], 0)
        self.assertEqual(self.runner.run.await_count, 2)
        first["models"].clear()
        self.assertEqual(len(second["models"]), 1)

    async def test_failed_observation_invalidates_previous_models(self):
        await self.service.get_status()
        self.service._observed = 0
        self.runner.run.side_effect = ServiceError("session_expired", "safe")
        status = await self.service.get_status()
        self.assertFalse(status["has_active_session"])
        self.assertEqual(status["models"], [])
        self.assertIsNone(status["quota"])

    async def test_model_effort_preserved_document_validated_and_temporaries_removed(self):
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        result = await self.service.analyze_invoice(invoice, model="observed-model", thinking_level="low")
        self.assertEqual(result["data"]["items"][0]["quantity"], 0)
        calls = self.runner.run.await_args_list
        generation = calls[-1]
        self.assertIn("--effort", generation.args[0])
        self.assertIn("low", generation.args[0])
        self.assertFalse(generation.kwargs["cwd"].exists())
        self.assertTrue(invoice.exists())

    async def test_long_generation_budget_preserves_model_without_resending(self):
        self.runner.config = CliConfig(Path(sys.executable), "", self.home, timeout=240)
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        await self.service.analyze_invoice(invoice, model="observed-model", thinking_level="high")
        calls = self.runner.run.await_args_list
        self.assertEqual(sum("--input-format" in c.args[0] for c in calls), 1)
        self.assertEqual(calls[-1].kwargs["timeout"], 242)
        self.assertIn("240s", calls[-1].args[0])
        self.assertEqual([c.kwargs["timeout"] for c in calls[:-1]], [25, 25, 25])

    async def test_timed_out_inference_logs_safe_progress_without_resending(self):
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        original = self.runner.run.side_effect

        async def timeout_inference(args, **kwargs):
            if "--input-format" not in args:
                return await original(args, **kwargs)
            kwargs["stdout_observer"](b'{"event":"init","token":"PRIVATE_TOKEN"}\n'
                                      b'{"event":"step_update","step_update":{"tool_name":"view_file","state":"DONE"}}\n')
            raise ServiceError("agentic_timeout", "Safe timeout", 504)

        self.runner.run.side_effect = timeout_inference
        with patch("agentic_service.logger.info") as log:
            with self.assertRaises(ServiceError) as caught:
                await self.service.analyze_invoice(invoice, model="observed-model")
        self.assertEqual(caught.exception.code, "agentic_timeout")
        summaries = [call.args for call in log.call_args_list if "inference progress" in call.args[0]]
        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0][1], "timeout")
        self.assertTrue(summaries[0][2]["document_read_completed"])
        self.assertFalse(summaries[0][2]["result_seen"])
        self.assertNotIn("PRIVATE_TOKEN", str(log.call_args_list))
        self.assertEqual(sum("--input-format" in call.args[0] for call in self.runner.run.await_args_list), 1)
        self.assertFalse(any(self.home.glob("nodia-agentic-*")))

    async def test_analysis_reuses_recent_verified_session_and_refreshes_expired_observation(self):
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        await self.service.get_status()
        self.runner.run.reset_mock()
        await self.service.analyze_invoice(invoice, model="observed-model")
        self.assertEqual(self.runner.run.await_count, 2)  # Exact effort check + one inference.
        self.assertFalse(any("/usage" in c.args[0] for c in self.runner.run.await_args_list))
        self.service._observed = time.monotonic() - 31
        self.runner.run.reset_mock()
        self.runner.run.side_effect = ServiceError("agentic_timeout", "Safe", 504)
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(invoice, model="observed-model")
        self.assertEqual(caught.exception.code, "agentic_timeout")
        self.assertEqual(self.runner.run.await_count, 2)
        self.assertFalse(any("--input-format" in c.args[0] for c in self.runner.run.await_args_list))
        self.assertIsNone(self.service._snapshot)

    async def test_unknown_model_never_generates_or_falls_back(self):
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(self.home / "unused.pdf", model="retired")
        self.assertEqual(caught.exception.status, 422)
        self.assertEqual(self.runner.run.await_count, 2)

    async def test_effort_model_replacement_is_rejected_before_generation(self):
        original = self.run_command
        async def changed(args, **kwargs):
            return (report("model", {"id": "different-model"}), 0) if "/model" in args else await original(args, **kwargs)
        self.runner.run.side_effect = changed
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(self.home / "unused.pdf", model="observed-model", thinking_level="high")
        self.assertEqual(caught.exception.code, "agentic_model_option_mismatch")

    async def test_empty_success_or_denied_document_is_not_an_extraction(self):
        original = self.run_command
        async def denied(args, **kwargs):
            if "--input-format" in args:
                return json.dumps({"event": "result", "result": {"status": "SUCCESS",
                    "structured_output": RESULT, "denied_actions": [{"action": "read_file"}]}}), 0
            return await original(args, **kwargs)
        self.runner.run.side_effect = denied
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(invoice, model="observed-model")
        self.assertEqual(caught.exception.code, "agentic_document_unread")

    async def test_missing_hook_confirmation_rejects_otherwise_valid_extraction(self):
        original = self.run_command
        async def no_receipt(args, **kwargs):
            response = await original(args, **kwargs)
            if "--input-format" in args:
                (kwargs["home"] / "tool_receipts.jsonl").unlink()
            return response
        self.runner.run.side_effect = no_receipt
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(invoice, model="observed-model")
        self.assertEqual(caught.exception.code, "agentic_tool_policy")

    async def test_busy_analysis_is_rejected_without_queue_or_second_inference(self):
        await self.service._analysis_lock.acquire()
        try:
            with self.assertRaises(ServiceError) as caught:
                await self.service.analyze_invoice(self.home / "source.pdf", model="observed-model")
            self.assertEqual(caught.exception.code, "agentic_busy")
            self.runner.run.assert_not_awaited()
        finally:
            self.service._analysis_lock.release()

    async def test_explicit_quota_exhaustion_is_propagated_without_retry(self):
        original = self.run_command
        async def exhausted(args, **kwargs):
            if "--input-format" in args:
                return json.dumps({"event": "result", "result": {"status": "ERROR", "error": "MODEL_CAPACITY_EXHAUSTED"}}), 1
            return await original(args, **kwargs)
        self.runner.run.side_effect = exhausted
        invoice = self.home / "source.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(invoice, model="observed-model")
        self.assertEqual(caught.exception.status, 429)
        self.assertEqual(sum("--input-format" in c.args[0] for c in self.runner.run.await_args_list), 1)


class CliBoundaryTest(unittest.IsolatedAsyncioTestCase):
    def test_standalone_container_profile_is_outside_app_without_rejecting_all_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            values = {"ANTIGRAVITY_CLI_PATH": str(Path(sys.executable).resolve()),
                      "ANTIGRAVITY_CLI_SHA512": "ab" * 64,
                      "ANTIGRAVITY_CLI_HOME": str(root / "profile"),
                      "ANTIGRAVITY_CLI_TIMEOUT_SECONDS": "240"}
            with patch("agentic_cli.__file__", str(root / "app" / "agentic_cli.py")), patch.dict(os.environ, values):
                self.assertEqual(CliConfig.from_environment().home, (root / "profile").resolve())
                os.environ["ANTIGRAVITY_CLI_HOME"] = str(root / "app" / "profile")
                with self.assertRaises(ValueError): CliConfig.from_environment()

    def test_monorepo_profiles_remain_outside_all_nodia_projects(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "nodia-server").mkdir()
            values = {"ANTIGRAVITY_CLI_PATH": str(Path(sys.executable).resolve()),
                      "ANTIGRAVITY_CLI_SHA512": "ab" * 64,
                      "ANTIGRAVITY_CLI_HOME": str(root / "profile"),
                      "ANTIGRAVITY_CLI_TIMEOUT_SECONDS": "240"}
            with patch("agentic_cli.__file__", str(root / "nodia-gemini-microservice" / "agentic_cli.py")), patch.dict(os.environ, values):
                with self.assertRaises(ValueError): CliConfig.from_environment()

    def test_supported_long_timeout_does_not_disable_cli_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            values = {"ANTIGRAVITY_CLI_PATH": str(Path(sys.executable).resolve()),
                      "ANTIGRAVITY_CLI_SHA512": "ab" * 64, "ANTIGRAVITY_CLI_HOME": directory,
                      "ANTIGRAVITY_CLI_TIMEOUT_SECONDS": "240"}
            with patch.dict(os.environ, values):
                self.assertEqual(CliConfig.from_environment().timeout, 240)
                os.environ["ANTIGRAVITY_CLI_TIMEOUT_SECONDS"] = "241"
                with self.assertRaises(ValueError):
                    CliConfig.from_environment()

    def test_secrets_and_provider_overrides_never_enter_child_environment(self):
        env = cli_environment(Path("isolated"), {"PATH": "bin", "GEMINI_SERVICE_TOKEN": "secret",
            "GEMINI_API_KEY": "secret", "ANTIGRAVITY_LS_ADDRESS": "override"})
        self.assertNotIn("GEMINI_SERVICE_TOKEN", env)
        self.assertNotIn("GEMINI_API_KEY", env)
        self.assertNotIn("ANTIGRAVITY_LS_ADDRESS", env)

    def test_generated_configuration_has_no_api_mode_or_unrestricted_permissions(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            prepare_cli_home(root / "profile", root / "invoice.pdf")
            data = json.loads((root / "profile/.gemini/antigravity-cli/settings.json").read_text())
            self.assertNotIn("modelProvider", data)
            self.assertEqual(len(data["permissions"]["allow"]), 1)
            self.assertIn("command(*)", data["permissions"]["deny"])
            self.assertIn("write_file(*)", data["permissions"]["deny"])
            self.assertIs(data["useG1Credits"], False)

    def test_hook_denies_every_other_tool_and_document_including_malformed_payloads(self):
        document = Path(__file__).resolve()
        self.assertEqual(decide({"toolCall": {"name": "view_file", "args": {"AbsolutePath": str(document)}}}, document), ("view_file", True))
        for name in ["run_command", "write_to_file", "send_message", "schedule", "browser_subagent", "call_mcp_tool", "unknown"]:
            self.assertEqual(decide({"toolCall": {"name": name, "args": {}}}, document), (name, False))
        self.assertEqual(decide({"toolCall": {"name": "view_file", "args": {"AbsolutePath": str(document.parent)}}}, document), ("view_file", False))
        self.assertFalse(decide(None, document)[1])

    async def test_cancelled_real_process_and_its_descendant_are_reaped(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            runner = CliRunner(CliConfig(Path(sys.executable), "", root))
            # The descendant would write after cancellation if tree cleanup failed.
            marker = root / "escaped.txt"
            ready, trigger = root / "ready.txt", root / "trigger.txt"
            child_code = (f"import time; from pathlib import Path; Path({str(ready)!r}).touch(); "
                          f"trigger=Path({str(trigger)!r});\nwhile not trigger.exists(): time.sleep(0.01)\n"
                          f"Path({str(marker)!r}).write_text('escaped')")
            parent = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c'," + repr(child_code) + "]); time.sleep(20)"
            task = asyncio.create_task(runner.run(["-u", "-c", parent], timeout=10))
            deadline = time.monotonic() + 5
            while not ready.exists() and time.monotonic() < deadline:
                await asyncio.sleep(0.01)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertTrue(ready.exists(), "descendant must have started before cancellation")
            trigger.touch()
            await asyncio.sleep(0.2)
            self.assertFalse(marker.exists())
            self.assertFalse(runner._processes)
            self.assertFalse(runner._jobs)
            await runner.close()

    def test_reports_cannot_disguise_an_inference_as_health(self):
        obj = json.loads(report("usage", QUOTA))
        obj["num_turns"] = 1
        with self.assertRaises(ServiceError):
            command_data(json.dumps(obj), "usage")
        obj["num_turns"] = False
        with self.assertRaises(ServiceError):
            command_data(json.dumps(obj), "usage")
        self.assertIsNone(observed_quota({"groups": [{"buckets": [{"id": "bad", "remaining_fraction": True}]}]}))
        with self.assertRaises(ServiceError):
            discovered_models("invalid line")

    async def test_real_child_timeout_and_output_limit_are_cleaned_up(self):
        with tempfile.TemporaryDirectory() as folder:
            config = CliConfig(Path(sys.executable), "", Path(folder), output_bytes=100)
            runner = CliRunner(config)
            with self.assertRaises(ServiceError) as timeout:
                await runner.run(["-c", "import time; time.sleep(20)"], timeout=0.1)
            self.assertEqual(timeout.exception.status, 504)
            self.assertFalse(runner._processes)
            with self.assertRaises(ServiceError) as output:
                await runner.run(["-c", "print('x'*200)"], timeout=3)
            self.assertEqual(output.exception.status, 502)
            self.assertFalse(runner._processes)
            await runner.close()


class AgenticHttpTest(unittest.TestCase):
    def test_same_adapter_serves_status_models_readiness_and_analysis_with_web_down(self):
        from fastapi.testclient import TestClient
        from main import create_app
        from unittest.mock import patch
        service = AsyncMock()
        service.is_available = lambda: True
        service.get_status.return_value = {"available": True, "has_active_session": True,
            "models": [{"id": "observed-model", "name": "Observed model"}]}
        service.analyze_invoice.return_value = RESULT
        with tempfile.TemporaryDirectory() as folder, patch.dict('os.environ', {"GEMINI_SERVICE_TOKEN": test_support.TOKEN}):
            web = fake_web()
            web.get_status.side_effect = RuntimeError("web offline")
            app = create_app(web_service=web, agentic_service=service, temp_dir=Path(folder), load_environment=False)
            with TestClient(app) as client:
                for path in ["/agentic/status", "/agentic/models", "/agentic/ready", "/engines/status"]:
                    self.assertEqual(client.get(path, headers=HEADERS).status_code, 200)
                    self.assertEqual(client.get(path).status_code, 401)
                response = client.post('/agentic/analyze-invoice', headers=HEADERS, data={'model': 'observed-model'},
                    files={'file': ('invoice.pdf', b'%PDF-1.4', 'application/pdf')})
                self.assertEqual(response.status_code, 200)
                web.analyze_invoice.assert_not_awaited()
