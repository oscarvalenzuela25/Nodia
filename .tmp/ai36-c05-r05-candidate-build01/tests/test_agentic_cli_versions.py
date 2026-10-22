"""Explicit CLI dependency candidates; synthetic transport, no accounts or CLI execution."""
import test_support
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from agentic_cli import CliConfig, CliRunner
from agentic_service import AntigravityAgentService
from nodia_ai_chat import ChatAdapter, ObserveRequest
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class CliVersionConfigurationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.binary = self.root / "synthetic-cli.bin"
        self.binary.write_bytes(b"synthetic-not-an-executable")
        self.digest = hashlib.sha512(self.binary.read_bytes()).hexdigest()
        self.values = {"ANTIGRAVITY_CLI_PATH": str(self.binary),
            "ANTIGRAVITY_CLI_HOME": str(self.root / "dedicated-home"),
            "ANTIGRAVITY_CLI_SHA512": self.digest,
            "HOME": str(self.root / "synthetic-user-home"), "USERPROFILE": str(self.root / "synthetic-user-home")}

    def test_missing_version_preserves_historical_dependency(self):
        with patch.dict(os.environ, self.values, clear=True):
            self.assertEqual(CliConfig.from_environment().version, "1.3.1")

    def test_explicit_reviewed_version_is_not_replaced(self):
        for version in ("1.3.1", "1.4.2"):
            with self.subTest(version=version), patch.dict(os.environ,
                    {**self.values, "ANTIGRAVITY_CLI_VERSION": version}, clear=True):
                config = CliConfig.from_environment()
                self.assertEqual(config.version, version)
                self.assertEqual(config.sha512, self.digest)
                self.assertEqual(config.timeout, 240)

    def test_unreviewed_or_malformed_dependency_is_rejected_without_fallback(self):
        for version in ("", "latest", "1.3.4", "1.4.3", " 1.4.2", "1.4.2\n"):
            with self.subTest(version=version), patch.dict(os.environ,
                    {**self.values, "ANTIGRAVITY_CLI_VERSION": version}, clear=True):
                with self.assertRaises(ValueError):
                    CliConfig.from_environment()

    async def test_exact_digest_and_version_are_required_for_each_candidate(self):
        for version in ("1.3.1", "1.4.2"):
            with self.subTest(version=version):
                runner = CliRunner(CliConfig(self.binary, self.digest, self.root / version, version=version))
                runner.run = AsyncMock(return_value=(version + "\n", 0))
                await runner.initialize()
                runner.run.assert_awaited_once_with(["--version"], timeout=4)

    async def test_wrong_digest_never_executes_even_the_version_command(self):
        runner = CliRunner(CliConfig(self.binary, "00" * 64, self.root / "profile", version="1.4.2"))
        runner.run = AsyncMock()
        with self.assertRaises(ServiceError) as caught:
            await runner.initialize()
        self.assertEqual(caught.exception.code, "agentic_cli_incompatible")
        runner.run.assert_not_awaited()
        self.assertFalse(runner.config.home.exists())

    async def test_version_mismatch_or_failed_command_never_initializes(self):
        for version, response, code in (("1.3.1", "1.4.2", 0), ("1.4.2", "1.3.1", 0),
                ("1.4.2", "1.4.2", 1), ("1.4.2", "1.4.2-extra", 0)):
            with self.subTest(version=version, response=response, code=code):
                runner = CliRunner(CliConfig(self.binary, self.digest, self.root / "profile", version=version))
                runner.run = AsyncMock(return_value=(response, code))
                with self.assertRaises(ServiceError) as caught:
                    await runner.initialize()
                self.assertEqual(caught.exception.code, "agentic_cli_incompatible")
                runner.run.assert_awaited_once_with(["--version"], timeout=4)


class CliVersionConsumerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles = ProfileAdmission(self.root / "web", self.root / "cli")
        self.runner = SimpleNamespace(config=SimpleNamespace(version="1.4.2"), run=AsyncMock())
        self.runner.run.return_value = (json.dumps({"status": "SUCCESS", "num_turns": 0,
            "usage": {"total_tokens": 0}, "command": {"name": "model", "data": {"id": "fixture-model"}}}), 0)
        self.agentic = SimpleNamespace(runner=self.runner, session_generation="a" * 32,
            get_status=AsyncMock(return_value={"available": True, "has_active_session": True,
                "models": [{"id": "fixture-model"}]}))
        self.adapter = ChatAdapter(None, self.agentic, self.profiles)
        self.adapter.mcp_sessions = SimpleNamespace(supports=Mock(return_value=False))
        self.request = ObserveRequest(model_id="fixture-model", effort_id="high", configuration_generation="b" * 64)

    async def test_explicit_candidates_require_exact_live_model_and_do_not_accredit_mcp(self):
        for version in ("1.3.1", "1.4.2"):
            with self.subTest(version=version):
                self.runner.config.version = version
                observation = await self.adapter.observe("agentic", self.request)
                self.assertTrue(observation["available"])
                self.assertFalse(observation["supports_mcp"])
                self.assertEqual(observation["verified_modalities"], [])
                self.assertEqual(observation["verified_attachment_media_types"], [])
                self.assertEqual(self.runner.run.await_args.args[0], ["-p", "/model", "--output-format", "json",
                    "--print-timeout", "10s", "--model", "fixture-model", "--effort", "high"])
                self.assertEqual(self.runner.run.await_args.kwargs, {"timeout": 10})
        self.assertEqual(self.runner.run.await_count, 2)

    async def test_unknown_version_cannot_reach_model_preflight(self):
        self.runner.config.version = "unreviewed"
        observation = await self.adapter.observe("agentic", self.request)
        self.assertFalse(observation["available"])
        self.assertEqual(observation["reason"], "adapter_protocol_unverified")
        self.runner.run.assert_not_awaited()
        self.adapter.mcp_sessions.supports.assert_not_called()

    async def test_candidate_configuration_does_not_replace_live_session_or_model_checks(self):
        self.agentic.get_status.return_value = {"available": False, "has_active_session": False,
            "reason": "session_required"}
        observation = await self.adapter.observe("agentic", self.request)
        self.assertFalse(observation["available"])
        self.runner.run.assert_not_awaited()
        self.agentic.get_status.return_value = {"available": True, "has_active_session": True,
            "models": [{"id": "different-fixture-model"}]}
        observation = await self.adapter.observe("agentic", self.request)
        self.assertEqual(observation["reason"], "model_unavailable")
        self.runner.run.assert_not_awaited()

    def test_attachment_gate_remains_historical_and_rejects_candidate_or_unknown(self):
        for version in ("1.4.2", "unreviewed"):
            self.runner.config.version = version
            with self.subTest(version=version), self.assertRaises(ServiceError) as caught:
                self.adapter.verify_attachment_runtime("agentic")
            self.assertEqual(caught.exception.code, "attachment_adapter_unverified")
        self.runner.config.version = "1.3.1"
        self.adapter.verify_attachment_runtime("agentic")
        self.runner.run.assert_not_awaited()

    async def test_candidate_and_unknown_ocr_fail_before_observation_or_materialization(self):
        service = AntigravityAgentService(self.runner)
        service._available = True
        service.get_status = AsyncMock()
        for version in ("1.4.2", "unreviewed"):
            self.runner.config.version = version
            with self.subTest(version=version), patch("agentic_service.tempfile.TemporaryDirectory") as materialize:
                with self.assertRaises(ServiceError) as caught:
                    await service.analyze_invoice(self.root / "not-read.pdf", model="fixture-model", thinking_level="high")
                self.assertEqual(caught.exception.code, "agentic_cli_incompatible")
                materialize.assert_not_called()
        service.get_status.assert_not_awaited()
        self.runner.run.assert_not_awaited()
