"""Synthetic OS/certificate boundaries; no host cgroup, account or SDK access."""
import test_support
import copy
from hashlib import sha256
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from agentic_cli import CliRunner
from login_cgroups import LoginCgroups
from native_attempts import AcknowledgeAttempt, NativeAttemptLedger, NativeAttemptProof, ReconcileAttempt
from native_chat_owner_bindings import read_recovery_record, require_closed_legacy_chat_owner, validate_chat_bindings
from nodia_ai_chat import ChatAdapter
from profile_admission import ProfileAdmission
from service_errors import ServiceError

BOOT = str(uuid4())
ATTEMPT = str(uuid4())
REFERENCE = ReconcileAttempt(resource_key="gemini-profile:" + "a" * 64,
    session_generation="b" * 32, operation_ref=ATTEMPT)
PROOF = NativeAttemptProof(**REFERENCE.model_dump(), attempt_id=ATTEMPT, engine="agentic",
    state="dispatch_armed", process_closed=False, observed_at="2026-10-24T17:00:00+00:00")
RAW = PROOF.model_dump_json().encode()


def binding(proof=PROOF, raw=RAW):
    return {"version": 1, "kind": "legacy_chat_pre_stop", "binding_id": str(uuid4()),
        "engine": "agentic", "attempt_id": proof.attempt_id, "resource_key": proof.resource_key,
        "session_generation": proof.session_generation, "operation_ref": proof.operation_ref,
        "record_sha256": sha256(raw).hexdigest(), "record_bytes": len(raw),
        "record_observed_at": proof.observed_at, "bound_at": "2026-10-24T18:00:00+00:00",
        "generation": {"container_id": "c" * 64, "started_at": "2026-10-24T16:00:00Z",
            "boot": BOOT, "device": 10, "parent_inode": 20}, "lineage_sha256": "d" * 64}


def certificate(item=None):
    return {"version": 2, "root_device": 10, "root_inode": 30, "host_boot": BOOT,
        "closed_roots": [{"boot": BOOT, "device": 10, "parent_inode": 20}],
        "chat_bindings": [item or binding()]}


class BindingSchemaTests(unittest.TestCase):
    def test_exact_public_host_contract_and_current_root_metadata_are_valid(self):
        value = binding()
        self.assertEqual(validate_chat_bindings([value]), [value])
        # Merely publishing PRESTOP metadata is valid, never proof of closure.
        with patch("login_cgroups.LoginCgroups.attestation", return_value={**certificate(value), "closed_roots": [], "root_inode": 20}):
            with self.assertRaises(ServiceError):
                require_closed_legacy_chat_owner(PROOF, REFERENCE, RAW)

    def test_unknown_fields_duplicates_invalid_types_and_time_order_are_rejected(self):
        cases = []
        for field, value in (("record_bytes", True), ("record_bytes", 4097), ("engine", "web"),
                             ("record_sha256", "invalid"), ("operation_ref", str(uuid4())),
                             ("bound_at", "2026-10-24T15:00:00Z"), ("record_observed_at", "2026-10-24T17:00:00")):
            item = binding(); item[field] = value; cases.append([item])
        item = binding(); item["host_path"] = "/not-admitted"; cases.append([item])
        item = binding(); item["generation"]["parent_inode"] = False; cases.append([item])
        item = binding(); cases += [[item, copy.deepcopy(item)], [binding() for _ in range(9)]]
        for values in cases:
            with self.subTest(case=values[0].get("record_bytes")), self.assertRaises(ValueError):
                validate_chat_bindings(values)

    def test_only_exact_bound_record_and_closed_old_root_can_authorize(self):
        original = certificate()
        with patch("login_cgroups.LoginCgroups.attestation", return_value=original):
            require_closed_legacy_chat_owner(PROOF, REFERENCE, RAW)
        cases = []
        for field, value in (("attempt_id", str(uuid4())), ("session_generation", "e" * 32),
                             ("record_sha256", "f" * 64), ("record_bytes", len(RAW) + 1),
                             ("record_observed_at", "2026-10-24T17:00:01+00:00")):
            item = copy.deepcopy(original); item["chat_bindings"][0][field] = value; cases.append(item)
        cases += [{**original, "version": 1}, {**original, "chat_bindings": []},
                  {**original, "closed_roots": []}, {**original, "root_inode": 20}]
        for value in cases:
            with patch("login_cgroups.LoginCgroups.attestation", return_value=value), self.assertRaises(ServiceError) as caught:
                require_closed_legacy_chat_owner(PROOF, REFERENCE, RAW)
            self.assertEqual(caught.exception.code, "native_operation_active_or_unverified")


class CertificateReaderTests(unittest.TestCase):
    def read(self, value, *, parent_symlink=False, parent_mode=0o755, **metadata):
        raw = json.dumps(value)
        file = MagicMock(spec=Path)
        file.parent.is_symlink.return_value = parent_symlink
        file.parent.stat.return_value = SimpleNamespace(st_uid=0, st_mode=stat.S_IFDIR | parent_mode)
        info = SimpleNamespace(st_uid=0, st_mode=stat.S_IFREG | 0o444, st_nlink=1, st_size=len(raw))
        for key, item in metadata.items(): setattr(info, key, item)
        with patch("login_cgroups.ATTESTATION", file), patch("login_cgroups.boot_id", return_value=BOOT), \
                patch("login_cgroups.os.O_NOFOLLOW", 131072, create=True), patch("login_cgroups.os.open", return_value=7), \
                patch("login_cgroups.os.fstat", return_value=info), patch("login_cgroups.os.close"), \
                patch("login_cgroups.os.fdopen", return_value=io.StringIO(raw)):
            return LoginCgroups().attestation()

    def test_login_v1_stays_compatible_and_v2_accepts_current_root_bindings(self):
        v1 = {key: value for key, value in certificate().items() if key != "chat_bindings"}; v1["version"] = 1
        self.assertEqual(self.read(v1), v1)
        v2 = certificate(); v2["root_inode"] = 20; v2["closed_roots"] = []
        self.assertEqual(self.read(v2), v2)

    def test_root_owner_read_only_regular_single_link_file_is_required(self):
        for metadata in ({"st_uid": 10000}, {"st_mode": stat.S_IFREG | 0o644},
                         {"st_mode": stat.S_IFLNK | 0o444}, {"st_nlink": 2}, {"st_size": 32769}):
            with self.subTest(metadata=metadata), self.assertRaises(ServiceError): self.read(certificate(), **metadata)
        for parent in ({"parent_symlink": True}, {"parent_mode": 0o777}):
            with self.subTest(parent=parent), self.assertRaises(ServiceError): self.read(certificate(), **parent)


class BoundRecordReaderTests(unittest.TestCase):
    def read(self, raw=RAW, *, before_mode=stat.S_IFREG | 0o600, **metadata):
        directory = MagicMock(spec=Path); directory.resolve.return_value = directory
        directory.lstat.return_value = SimpleNamespace(st_uid=10000, st_mode=stat.S_IFDIR | 0o700)
        info = SimpleNamespace(st_uid=10000, st_mode=stat.S_IFREG | 0o600, st_nlink=1,
            st_size=len(raw), st_dev=1, st_ino=2)
        directory.__truediv__.return_value.lstat.return_value = SimpleNamespace(st_dev=1, st_ino=2, st_mode=before_mode)
        for key, value in metadata.items(): setattr(info, key, value)
        ledger = NativeAttemptLedger(directory)
        with patch("native_chat_owner_bindings.sys.platform", "linux"), \
                patch("native_chat_owner_bindings.os.getuid", return_value=10000, create=True), \
                patch("native_chat_owner_bindings.os.O_NOFOLLOW", 131072, create=True), \
                patch("native_chat_owner_bindings.os.O_NONBLOCK", 2048, create=True), \
                patch("native_chat_owner_bindings.os.open", return_value=7), \
                patch("native_chat_owner_bindings.os.fstat", return_value=info), patch("native_chat_owner_bindings.os.close"), \
                patch("native_chat_owner_bindings.os.fdopen", return_value=io.BytesIO(raw)):
            return read_recovery_record(ledger, PROOF)

    def test_exact_bytes_are_returned_without_rewriting_the_record(self):
        self.assertEqual(self.read(), RAW)

    def test_unsafe_owner_mode_link_inode_oversize_or_changed_proof_are_rejected(self):
        for metadata in ({"st_uid": 0}, {"st_mode": stat.S_IFREG | 0o644},
                         {"st_mode": stat.S_IFREG | 0o700}, {"st_mode": stat.S_IFREG | 0o400}, {"st_nlink": 2},
                         {"st_ino": 3}, {"st_size": 4097}):
            with self.subTest(metadata=metadata), self.assertRaises(ServiceError): self.read(**metadata)
        with self.assertRaises(ServiceError): self.read(RAW.replace(b'"process_closed":false', b'"process_closed":true'))
        with self.assertRaises(ServiceError): self.read(before_mode=stat.S_IFIFO | 0o600)

    @unittest.skipUnless(sys.platform == "linux", "Real FIFO and no-follow race require Linux")
    def test_real_linux_fifo_and_regular_to_fifo_or_symlink_swap_do_not_block_or_write(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root) / "attempts"
            ledger = NativeAttemptLedger(directory)
            record = directory / (ATTEMPT + ".json")
            ledger.write(PROOF)
            self.assertEqual(read_recovery_record(ledger, PROOF), RAW)
            record.unlink()
            os.mkfifo(record, 0o600)
            with self.assertRaises(ServiceError): read_recovery_record(ledger, PROOF)
            self.assertTrue(stat.S_ISFIFO(record.lstat().st_mode))
            record.unlink()
            outside = Path(root) / "outside"
            outside.write_bytes(b"synthetic-preserved")
            original_open = os.open
            for replacement in ("fifo", "symlink"):
                ledger.write(PROOF)
                def swapped_open(path, flags, *args, **kwargs):
                    # Fail immediately if a regression could block the test.
                    self.assertTrue(flags & os.O_NONBLOCK)
                    self.assertTrue(flags & os.O_NOFOLLOW)
                    record.unlink()
                    if replacement == "fifo": os.mkfifo(record, 0o600)
                    else: record.symlink_to(outside)
                    return original_open(path, flags, *args, **kwargs)
                with patch("native_chat_owner_bindings.os.open", side_effect=swapped_open):
                    with self.assertRaises(ServiceError): read_recovery_record(ledger, PROOF)
                self.assertEqual(outside.read_bytes(), b"synthetic-preserved")
                self.assertTrue(stat.S_ISFIFO(record.lstat().st_mode) if replacement == "fifo" else record.is_symlink())
                record.unlink()


class ReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles = ProfileAdmission(self.root / "agentic", self.root / "state")
        self.runner = CliRunner(SimpleNamespace())  # Pure constructor; no CLI/SDK initialization.
        self.runner._verified_stat = (1, 1)  # Explicit synthetic verification boundary.
        self.agentic = SimpleNamespace(session_generation="b" * 32, runner=self.runner)
        self.adapter = ChatAdapter(self.agentic, self.profiles)
        self.request = REFERENCE.model_copy(update={"resource_key": self.profiles.identity("agentic")})
        self.proof = self.adapter.ledger.arm(ATTEMPT, "agentic", self.request)
        self.proof.observed_at = PROOF.observed_at
        self.adapter.ledger.write(self.proof)
        self.raw = self.proof.model_dump_json().encode()
        self.enterContext(patch("nodia_ai_chat.read_recovery_record", return_value=self.raw))

    def test_host_certified_old_root_recovers_after_restart_only_as_abandoned_then_normal_ack(self):
        self.agentic.session_generation = "e" * 32  # New runtime cannot use the live-owner path.
        self.assertEqual(self.adapter.attempts, set())
        item = binding(self.proof, self.raw)
        with patch("login_cgroups.LoginCgroups.attestation", return_value=certificate(item)):
            result = self.adapter.reconcile("agentic", ATTEMPT, self.request)
        self.assertEqual(result["outcome"], "abandoned_unknown")
        self.assertTrue(result["process_closed"])
        self.assertEqual(result, self.adapter.reconcile("agentic", ATTEMPT, self.request))
        ack = AcknowledgeAttempt(**self.request.model_dump(), terminal_proof_id=result["terminal_proof_id"])
        self.assertTrue(self.adapter.acknowledge("agentic", ATTEMPT, ack)["acknowledged"])
        self.assertIsNone(self.adapter.ledger.read(ATTEMPT))

    def test_same_live_verified_owner_can_recover_but_restart_without_host_binding_cannot(self):
        self.adapter.attempts.add(ATTEMPT)
        with patch("login_cgroups.LoginCgroups.attestation", side_effect=AssertionError("Live owner must not use HOST fallback")):
            self.assertEqual(self.adapter.reconcile("agentic", ATTEMPT, self.request)["outcome"], "abandoned_unknown")
        restarted = ChatAdapter(self.agentic, self.profiles)
        restarted.ledger.write(self.proof)
        with patch("login_cgroups.LoginCgroups.attestation", side_effect=ServiceError("login_containment_unavailable", "Synthetic unavailable")):
            with self.assertRaises(ServiceError): restarted.reconcile("agentic", ATTEMPT, self.request)
        self.assertEqual(restarted.ledger.read(ATTEMPT).state, "dispatch_armed")

    def test_active_process_or_attempt_never_uses_a_host_binding(self):
        for active in ("process", "attempt"):
            self.runner._processes = {object()} if active == "process" else set()
            self.adapter.active_attempts = {ATTEMPT: "agentic"} if active == "attempt" else {}
            with patch("login_cgroups.LoginCgroups.attestation", side_effect=AssertionError("No certificate read while active")):
                with self.assertRaises(ServiceError): self.adapter.reconcile("agentic", ATTEMPT, self.request)
            self.assertEqual(self.adapter.ledger.read(ATTEMPT).state, "dispatch_armed")

    def test_changed_session_cannot_borrow_the_live_owner_membership(self):
        self.adapter.attempts.add(ATTEMPT)
        self.agentic.session_generation = "e" * 32
        with patch("login_cgroups.LoginCgroups.attestation", side_effect=ServiceError("login_containment_unavailable", "Synthetic unavailable")):
            with self.assertRaises(ServiceError): self.adapter.reconcile("agentic", ATTEMPT, self.request)
        self.assertEqual(self.adapter.ledger.read(ATTEMPT).state, "dispatch_armed")

    def test_proof_cannot_change_attempt_identity_under_the_requested_filename(self):
        self.adapter.attempts.add(ATTEMPT)
        changed = self.proof.model_copy(update={"attempt_id": str(uuid4())})
        (self.adapter.ledger.directory / (ATTEMPT + ".json")).write_bytes(changed.model_dump_json().encode())
        with patch("login_cgroups.LoginCgroups.attestation", side_effect=AssertionError("Mismatched attempt must stop first")):
            with self.assertRaises(ServiceError): self.adapter.reconcile("agentic", ATTEMPT, self.request)
        self.assertFalse(self.adapter.ledger.read(ATTEMPT).process_closed)

    def test_foreign_profile_owner_is_rejected_before_any_terminal_write(self):
        self.adapter.attempts.add(ATTEMPT)
        foreign = self.profiles.reserve("agentic", purpose="execution")
        before = self.adapter.ledger.read(ATTEMPT).model_dump()
        try:
            with self.assertRaises(ServiceError): self.adapter.reconcile("agentic", ATTEMPT, self.request)
            self.assertEqual(self.adapter.ledger.read(ATTEMPT).model_dump(), before)
        finally:
            foreign.release()

    def test_inconsistent_armed_tuple_is_not_rewritten_as_a_new_terminal(self):
        self.adapter.attempts.add(ATTEMPT)
        for update in ({"process_closed": True}, {"terminal_proof_id": str(uuid4())}):
            changed = self.proof.model_copy(update=update)
            self.adapter.ledger.write(changed)
            with self.assertRaises(ServiceError): self.adapter.reconcile("agentic", ATTEMPT, self.request)
            self.assertEqual(self.adapter.ledger.read(ATTEMPT).model_dump(), changed.model_dump())
