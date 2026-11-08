"""Synthetic fixture tests: no accounts, DB, services or provider requests."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "nodia-gemini-microservice"))
from teacher_operator_probe import TwoTurnBudget, TeacherProbeRunner
from profile_admission import ProfileAdmission


class OperatorProbeFixtureTests(unittest.TestCase):
    def test_shared_budget_allows_only_one_of_each_mode(self):
        budget = TwoTurnBudget()
        budget.consume("positive")
        with self.assertRaises(ValueError):
            budget.consume("positive")
        budget.consume("hook_fail")
        with self.assertRaises(ValueError):
            budget.consume("extra")

    def run_fixture(self, mode, packet):
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        gate = root / "gate.py"
        gate.write_bytes((ROOT / "nodia-gemini-microservice/nodia_ai_tool_gate.py").read_bytes())
        receipt, audit = root / "receipt.jsonl", root / "audit.json"
        result = subprocess.run([sys.executable, str(Path(__file__).with_name("teacher_probe_hook.py")),
                                 mode, str(gate), str(receipt), str(audit)],
            input=json.dumps(packet).encode(), capture_output=True, timeout=10, check=False)
        return result, receipt, audit

    def test_positive_copies_real_gate_and_denies_altered_tool_packet_without_inference(self):
        result, receipt, audit = self.run_fixture("positive", {
            "toolCall": {"name": "finish", "args": {"text": "SYNTHETIC"}}, "stepIdx": 0})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)["decision"], "allow")
        self.assertEqual(json.loads(receipt.read_text()), {"tool": "finish", "allowed": True})
        evidence = json.loads(audit.read_text())
        self.assertTrue(evidence["direct_gate_forbidden_denied"])
        self.assertTrue(evidence["actual_finish_packet_observed"])
        self.assertNotIn("SYNTHETIC", audit.read_text())

    def test_broken_hook_records_reached_packet_but_writes_no_decision_or_receipt(self):
        result, receipt, audit = self.run_fixture("hook_fail", {"toolCall": {"name": "finish", "args": {}}})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, b"")
        self.assertFalse(receipt.exists())
        self.assertTrue(json.loads(audit.read_text())["actual_finish_packet_observed"])


class OperatorAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_profile_and_missing_sql_admission_never_start_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            profiles = ProfileAdmission(Path(directory))
            ref = SimpleNamespace(resource_key=profiles.identity("agentic"), attempt_id="synthetic-attempt",
                session_generation="synthetic-generation", operation_id="synthetic-operation")
            runner = SimpleNamespace(run=AsyncMock())
            sql_check = AsyncMock(return_value=False)
            probe = TeacherProbeRunner(runner, profiles, ref, mode="positive",
                budget=TwoTurnBudget(), assert_sql_admitted=sql_check)
            with self.assertRaisesRegex(ValueError, "profile admission"):
                await probe.run([])
            sql_check.assert_not_called()
            reservation = profiles.reserve("agentic", purpose="execution")
            profiles.arm_dispatch("agentic", {"attempt_id": ref.attempt_id, "resource_key": ref.resource_key,
                "session_generation": ref.session_generation, "operation_ref": ref.operation_id})
            with self.assertRaisesRegex(ValueError, "SQL admission"):
                await probe.run([])
            runner.run.assert_not_called()
            profiles.resolve_dispatch("agentic")
            reservation.release()


if __name__ == "__main__":
    unittest.main()
