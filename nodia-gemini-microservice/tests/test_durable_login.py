import test_support
import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from durable_login import DurableLoginRequests
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class DurableLoginRequestTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles = ProfileAdmission(self.directory / "agentic", self.directory / "admission")
        self.manager = DurableLoginRequests(self.directory / "requests", self.profiles)
        self.request = str(uuid4())
        self.deadline = datetime.fromtimestamp(time.time() + 200, timezone.utc).isoformat()
        self.enterContext(patch("durable_login.sys.platform", "linux"))
        self.manager.containment = Mock()
        self.manager.containment.create.return_value = None
        self.manager.containment.close = AsyncMock(return_value=False)
        self.manager._spawn = AsyncMock()

    async def asyncTearDown(self):
        await self.manager.close()

    async def start(self, engine="agentic"):
        return await self.manager.start(engine, self.request, "9223372036854775807", "2", self.deadline)

    async def test_dispatch_identity_written_before_spawn_and_scope_exact(self):
        async def inspect(key):
            with self.manager.store.locked():
                record = self.manager.store.read(key)
            self.assertEqual(record["actor"], "9223372036854775807")
            self.assertEqual(record["provider"], "2")
            self.assertEqual(record["request_id"], self.request)
            self.assertEqual(record["state"], "armed")
            with self.assertRaises(ServiceError):
                self.profiles.reserve("agentic")
        self.manager._spawn.side_effect = inspect
        result = await self.start()
        self.assertEqual(result, {"id": self.request.replace("-", ""), "state": "running", "authorization_url": None, "reason": None})

    async def test_cancel_before_late_start_is_durable_tombstone_without_native_dispatch(self):
        result = await self.manager.cancel("agentic", self.request, "9223372036854775807", "2")
        self.assertEqual(result["state"], "cancelled")
        self.assertEqual((await self.start())["state"], "cancelled")
        self.manager._spawn.assert_not_awaited()

    async def test_response_loss_replay_cannot_spawn_again_after_new_manager(self):
        await self.start()
        other = DurableLoginRequests(self.directory / "requests", self.profiles)
        other._spawn = AsyncMock()
        other.containment = self.manager.containment
        other.rpc = AsyncMock(side_effect=OSError())
        # Original process crashed before releasing its dispatch gate. This is
        # safe to close, and never safe to replay as a second native login.
        result = await other.start("agentic", self.request, "9223372036854775807", "2", self.deadline)
        self.assertEqual(result["state"], "cancelled")
        other._spawn.assert_not_awaited()

    async def test_foreign_actor_provider_or_engine_never_observes_or_cancels(self):
        await self.start()
        for actor, provider, engine in (("1", "2", "agentic"), ("9223372036854775807", "3", "agentic"), ("9223372036854775807", "2", "retired")):
            for method in (self.manager.observe, self.manager.cancel):
                with self.assertRaises(ServiceError) as caught:
                    await method(engine, self.request, actor, provider)
                self.assertEqual(caught.exception.status, 404)

    async def test_past_deadline_denied_even_if_old_journal_was_pruned(self):
        deadline = datetime.fromtimestamp(time.time() - 1, timezone.utc).isoformat()
        with self.assertRaises(ServiceError) as caught:
            await self.manager.start("agentic", self.request, "1", "2", deadline)
        self.assertEqual(caught.exception.code, "login_request_expired")
        self.manager._spawn.assert_not_awaited()

    async def test_replay_cannot_change_deadline(self):
        await self.start()
        deadline = datetime.fromtimestamp(time.time() + 250, timezone.utc).isoformat()
        with self.assertRaises(ServiceError) as caught:
            await self.manager.start("agentic", self.request, "9223372036854775807", "2", deadline)
        self.assertEqual(caught.exception.code, "login_request_mismatch")

    async def test_ack_required_before_terminal_receipt_can_be_pruned(self):
        await self.start()
        key = self.request.replace("-", "")
        with self.manager.store.locked():
            record = self.manager.store.read(key)
            record.update(state="cancelled", closure_proof="native_tree_closed", expires_at=time.time() - 1)
            self.manager.store.write(record)
            self.manager.store.prune()
            self.assertIsNotNone(self.manager.store.read(key))
        self.assertEqual(self.manager.acknowledge("agentic", self.request, "9223372036854775807", "2"), {"acknowledged": True})
        with self.manager.store.locked():
            self.manager.store.prune()
            self.assertIsNone(self.manager.store.read(key))
        # Lost ack response does not make a committed SQL terminal uncertain.
        self.assertEqual(self.manager.acknowledge("agentic", self.request, "9223372036854775807", "2"), {"acknowledged": True})

    async def test_unknown_cannot_be_acknowledged_or_pruned(self):
        await self.start()
        key = self.request.replace("-", "")
        with self.manager.store.locked():
            record = self.manager.store.read(key)
            record.update(state="unknown", expires_at=time.time() - 1)
            self.manager.store.write(record)
            self.manager.store.prune()
            self.assertIsNotNone(self.manager.store.read(key))
        with self.assertRaises(ServiceError):
            self.manager.acknowledge("agentic", self.request, "9223372036854775807", "2")

    async def test_no_404_as_cancellation_and_no_silent_request_creation_on_lookup(self):
        with self.assertRaises(ServiceError) as caught:
            await self.manager.observe("agentic", self.request, "1", "2")
        self.assertEqual(caught.exception.status, 404)
        self.assertFalse((self.directory / "requests" / (self.request.replace("-", "") + ".json")).exists())

    async def test_proof_for_other_namespace_keeps_unknown_and_profile_quarantined(self):
        await self.start()
        key = self.request.replace("-", "")
        with self.manager.store.locked():
            record = self.manager.store.read(key)
            record["supervisor"] = {"boot": str(uuid4()), "namespace": "pid:[1]", "uid": 10001, "pid": 100, "birth": 1}
            self.manager.store.write(record)
        with patch("durable_login.supervisor_alive", return_value=None), patch.object(self.manager, "rpc", side_effect=OSError()):
            result = await self.manager.observe("agentic", self.request, "9223372036854775807", "2")
        self.assertEqual(result["state"], "unknown")
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic")

    async def test_journal_has_no_human_interaction_fields(self):
        await self.start("agentic")
        record = json.loads(next((self.directory / "requests").glob("*.json")).read_text())
        self.assertTrue({"authorization_url", "code", "cookies", "secret", "frame", "payload"}.isdisjoint(record))

    async def test_candidate_success_is_not_terminal_before_kernel_closure(self):
        proof = {"kind": "cgroup_v2", "name": self.request.replace("-", ""), "boot": str(uuid4()), "device": 1, "inode": 2, "parent_inode": 3}
        self.manager.containment.create.return_value = proof
        self.manager.containment.known_closed.return_value = False
        await self.start()
        key = self.request.replace("-", "")
        with self.manager.store.locked():
            record = self.manager.store.read(key)
            record.update(state="closing", candidate_state="succeeded")
            self.manager.store.write(record)
        with patch.object(self.manager, "rpc", side_effect=OSError()):
            self.assertEqual((await self.manager.observe("agentic", self.request, "9223372036854775807", "2"))["state"], "unknown")
            with self.assertRaises(ServiceError):
                self.profiles.reserve("agentic")
            self.manager.containment.close.return_value = True
            self.assertEqual((await self.manager.observe("agentic", self.request, "9223372036854775807", "2"))["state"], "succeeded")
        self.profiles.reserve("agentic").release()

    async def test_closed_container_attestation_can_conciliate_old_identity_without_targeting_current_root(self):
        self.manager.containment.create.return_value = {"kind": "cgroup_v2", "name": self.request.replace("-", ""), "boot": str(uuid4()), "device": 1, "inode": 2, "parent_inode": 3}
        self.manager.containment.known_closed.return_value = True
        await self.start()
        with patch.object(self.manager, "rpc", side_effect=OSError()):
            self.assertEqual((await self.manager.cancel("agentic", self.request, "9223372036854775807", "2"))["state"], "cancelled")
        self.manager.containment.close.assert_not_awaited()
        with self.manager.store.locked():
            self.assertEqual(self.manager.store.read(self.request.replace("-", ""))["closure_proof"], "container_tree_closed")

    async def test_unavailable_kernel_containment_never_dispatches_and_releases_only_local_reservation(self):
        self.manager.containment.create.side_effect = ServiceError("login_containment_unavailable", "Unavailable")
        with self.assertRaises(ServiceError):
            await self.start()
        self.manager._spawn.assert_not_awaited()
        self.profiles.reserve("agentic").release()

    async def test_persisted_record_rejects_unexpected_fields_instead_of_exposing_them(self):
        await self.start()
        target = self.directory / "requests" / (self.request.replace("-", "") + ".json")
        record = json.loads(target.read_text())
        record["authorization_url"] = "fixture-forbidden-field"
        target.write_text(json.dumps(record))
        with self.assertRaises(ServiceError) as caught:
            await self.manager.observe("agentic", self.request, "9223372036854775807", "2")
        self.assertEqual(caught.exception.code, "login_journal_invalid")

    async def test_async_lock_wait_yields_event_loop_and_recovers_after_short_contention(self):
        await self.start()
        guard = self.manager.store.locked()
        guard.__enter__()
        async def lookup():
            async with self.manager.store.alocked():
                return self.manager.store.read(self.request.replace("-", ""))["actor"]
        pending = asyncio.create_task(lookup())
        try:
            await asyncio.sleep(0.04)
            self.assertFalse(pending.done())
        finally:
            guard.__exit__(None, None, None)
        self.assertEqual(await pending, "9223372036854775807")


class DurableLoginRequestHttpTest(test_support.AppTestCase):
    def test_private_scope_validation_and_tombstone_both_engines(self):
        for prefix in ("/agentic/auth/login",):
            request = str(uuid4())
            headers = {**test_support.HEADERS, "X-Nodia-Actor-Id": "9223372036854775807", "X-Nodia-Provider-Id": "2"}
            route = prefix + "/requests/" + request
            self.assertEqual(self.client.post(route + "/cancel").status_code, 401)
            self.assertEqual(self.client.post(route + "/cancel", headers={**headers, "X-Nodia-Service-Token": "bad"}).status_code, 401)
            self.assertEqual(self.client.post(route + "/cancel", headers={**headers, "X-Nodia-Provider-Id": "02"}).status_code, 422)
            self.assertEqual(self.client.get(route, headers=headers).status_code, 404)
            result = self.client.post(route + "/cancel", headers=headers)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["state"], "cancelled")
            if prefix.startswith("/agentic"):
                self.assertEqual(result.json(), {"id": request.replace("-", ""), "state": "cancelled", "authorization_url": None, "reason": None})
            self.assertEqual(result.headers["cache-control"], "no-store")
            self.assertEqual(self.client.get(route, headers={**headers, "X-Nodia-Actor-Id": "1"}).status_code, 404)
            self.assertEqual(self.client.post(route + "/ack", headers=headers).json(), {"acknowledged": True})
