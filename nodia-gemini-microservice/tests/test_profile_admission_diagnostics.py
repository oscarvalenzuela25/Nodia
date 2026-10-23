"""Offline gate ownership diagnostics preserve admission and quarantine semantics."""
import test_support
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from profile_admission import ProfileAdmission
from service_errors import ServiceError


class ProfileAdmissionDiagnosticTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.gate = ProfileAdmission(self.root / "sensitive-profile-path", self.root / "sensitive-profile-path", self.root / "state")
        self.log = self.enterContext(patch("profile_admission.logger.info"))
        self.clock = self.enterContext(patch("profile_admission.monotonic", return_value=100.0))

    def events(self):
        return [json.loads(call.args[1]) for call in self.log.call_args_list]

    async def test_busy_log_correlates_physical_owner_without_changing_public_error(self):
        owner = self.gate.reserve("agentic", purpose="health_status")
        self.clock.return_value = 102.25
        with self.assertRaises(ServiceError) as caught:
            self.gate.reserve("web", purpose="eligibility")
        self.assertEqual((caught.exception.code, caught.exception.status), ("runtime_busy", 409))
        self.assertEqual(caught.exception.message, "El perfil está ocupado por otra operación.")
        owner.release()
        acquired, rejected, released = self.events()
        self.assertEqual([item["event"] for item in self.events()], ["acquire", "reject", "release"])
        self.assertEqual(rejected["engine"], "web")
        self.assertEqual(rejected["purpose"], "eligibility")
        self.assertEqual(rejected["owner_engine"], "agentic")
        self.assertEqual(rejected["owner_purpose"], "health_status")
        self.assertEqual(rejected["elapsed_ms"], 2250)
        self.assertEqual(acquired["reservation_nonce"], rejected["reservation_nonce"])
        self.assertEqual(acquired["reservation_nonce"], released["reservation_nonce"])
        self.assertRegex(acquired["reservation_nonce"], r"^[a-f0-9]{32}$")
        self.gate.reserve("web").release()

    async def test_log_field_allowlist_excludes_profile_and_arbitrary_input(self):
        self.gate.reserve("agentic", purpose="eligibility").release()
        with self.assertRaises(ServiceError):
            self.gate.reserve("secret-session-model-user", purpose="health_status")
        expected = {"event", "engine", "purpose", "reservation_nonce", "owner_engine", "owner_purpose", "elapsed_ms", "quarantined", "reason"}
        for event in self.events():
            self.assertEqual(set(event), expected)
        raw = json.dumps(self.events())
        self.assertNotIn("sensitive-profile-path", raw)
        self.assertNotIn(str(self.root), raw)
        self.assertNotIn(self.gate.identity("agentic"), raw)
        self.assertNotIn("secret-session-model-user", raw)
        self.assertEqual(self.events()[-1]["engine"], "unknown")
        self.assertEqual(self.events()[-1]["reason"], "runtime_unconfigured")

    async def test_default_legacy_is_compatible_and_release_is_idempotent(self):
        reservation = self.gate.reserve("agentic")
        reservation.release()
        reservation.release()
        self.assertEqual([item["purpose"] for item in self.events()], ["legacy", "legacy"])
        self.assertEqual([item["event"] for item in self.events()], ["acquire", "release"])
        self.assertEqual(self.gate._owners, {})
        self.gate.reserve("agentic").release()

    async def test_purpose_accepts_only_closed_internal_categories(self):
        with self.assertRaisesRegex(ValueError, "Invalid profile reservation purpose"):
            self.gate.reserve("agentic", purpose="untrusted-profile-payload")
        self.assertEqual(self.events(), [])
        self.gate.reserve("agentic", purpose="execution").release()

    async def test_cancelled_operation_releases_after_its_body_exits(self):
        entered = asyncio.Event()
        pending = asyncio.Event()

        async def work():
            async with self.gate.operation("agentic", purpose="eligibility"):
                entered.set()
                await pending.wait()

        task = asyncio.create_task(work())
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual([item["event"] for item in self.events()], ["acquire", "release"])
        self.assertEqual(self.gate._owners, {})
        self.gate.reserve("agentic", purpose="login").release()

    async def test_quarantine_remains_busy_after_release_with_owner_correlated(self):
        async with self.gate.operation("agentic", purpose="execution"):
            self.gate.arm_dispatch("agentic")
            self.gate.quarantine("agentic")
        with self.assertRaises(ServiceError) as caught:
            self.gate.reserve("agentic", purpose="health_status")
        self.assertEqual(caught.exception.code, "runtime_busy")
        acquired, released, rejected = self.events()
        self.assertTrue(released["quarantined"])
        self.assertTrue(rejected["quarantined"])
        self.assertEqual(acquired["reservation_nonce"], rejected["reservation_nonce"])
        self.assertEqual(len(list((self.root / "state").glob("*.unknown"))), 1)
        self.assertLessEqual(len(self.gate._owners), 1)

    async def test_restart_quarantine_has_unknown_owner_instead_of_fabricated_nonce_or_age(self):
        async with self.gate.operation("agentic", purpose="execution"):
            self.gate.arm_dispatch("agentic")
            self.gate.quarantine("agentic")
        restarted = ProfileAdmission(self.root / "sensitive-profile-path", self.root / "sensitive-profile-path", self.root / "state")
        with self.assertRaises(ServiceError):
            restarted.reserve("agentic", purpose="eligibility")
        rejected = self.events()[-1]
        self.assertTrue(rejected["quarantined"])
        self.assertIsNone(rejected["reservation_nonce"])
        self.assertIsNone(rejected["owner_purpose"])
        self.assertIsNone(rejected["elapsed_ms"])

    async def test_release_metadata_does_not_accumulate_history(self):
        for _ in range(50):
            self.gate.reserve("agentic", purpose="discovery").release()
            self.assertEqual(self.gate._owners, {})
        self.assertEqual(len(self.events()), 100)

    async def test_logging_failure_does_not_change_exclusion_or_release(self):
        self.log.side_effect = RuntimeError("synthetic log sink failure")
        first = self.gate.reserve("agentic", purpose="refresh")
        with self.assertRaises(ServiceError) as caught:
            self.gate.reserve("agentic", purpose="eligibility")
        self.assertEqual(caught.exception.code, "runtime_busy")
        first.release()
        self.gate.reserve("web", purpose="logout").release()
        self.assertEqual(self.gate._owners, {})

    async def test_monotonic_duration_never_uses_wall_clock(self):
        reservation = self.gate.reserve("agentic", purpose="startup")
        self.clock.return_value = 101.5
        with patch("time.time", side_effect=AssertionError("wall clock is not elapsed time")):
            reservation.release()
        self.assertEqual(self.events()[-1]["elapsed_ms"], 1500)
