"""Identity-bound manual OCR fencing, with local closure and remote outcome separate.

Only an exact terminal receipt can release capacity. No inference is replayed;
legacy unbound markers and unproved closures remain quarantined.
"""
from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import AsyncIterator
from uuid import uuid4

from cli_execution_receipt import CliExecutionReceipt
from native_attempts import AcknowledgeAttempt, NativeAttemptLedger, NativeAttemptProof, ReconcileAttempt
from private_state_json import read_private_json
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class ManualInvoiceLedger(NativeAttemptLedger):
    def read(self, attempt_id: str) -> NativeAttemptProof | None:
        if self.directory is None:
            return super().read(attempt_id)
        if len(attempt_id) != 36 or any(char not in "0123456789abcdef-" for char in attempt_id):
            raise ServiceError("native_proof_mismatch", "Identidad de análisis inválida.", 409)
        try:
            value = read_private_json(self.directory, attempt_id + ".json")
            return None if value is None else NativeAttemptProof.model_validate(value)
        except (OSError, ValueError, RecursionError, OverflowError):
            raise ServiceError("native_proof_mismatch", "El recibo del análisis no es verificable.", 409) from None


class ManualInvoiceDispatch:
    def __init__(self, profiles: ProfileAdmission, ledger: NativeAttemptLedger,
                 session_generation: str):
        self.profiles = profiles
        self.ledger = ledger
        self.attempt_id = str(uuid4())
        self.reference = ReconcileAttempt(resource_key=profiles.identity("agentic"),
            session_generation=session_generation, operation_ref=self.attempt_id)
        self.marker = {"kind": "manual_invoice", "attempt_id": self.attempt_id,
                       **self.reference.model_dump()}
        self.receipt = CliExecutionReceipt(self.attempt_id)
        self.proof = None
        self.dispatched = False

    def arm(self) -> None:
        if self.dispatched:
            raise ServiceError("attempt_already_dispatched", "El intento no se reenviará.", 409)
        self.dispatched = True  # An uncertain durable write must retain the fence.
        self.profiles.arm_dispatch("agentic", self.marker)
        self.proof = self.ledger.arm(self.attempt_id, "agentic", self.reference)

    def finish(self, *, completed: bool) -> None:
        if not self.dispatched:
            return
        self.profiles.quarantine("agentic")
        if self.receipt.operation_id != self.attempt_id:
            raise ServiceError("native_proof_mismatch", "El cierre no corresponde a este análisis.", 409)
        if self.proof is None or not self.receipt.local_closed:
            raise ServiceError("native_proof_missing", "El cierre local del análisis no está verificado.", 409)
        self.profiles.validate_reconcile_dispatch("agentic", self.marker)
        final = self.ledger.close(self.proof, "completed" if completed else "abandoned_unknown")
        self.profiles.reconcile_dispatch("agentic", self.marker)
        # Manual extraction has no SQL/business commit here. This ACK only
        # follows the exact local admission transition; it never confirms a sale.
        self.ledger.acknowledge(self.attempt_id, "agentic", AcknowledgeAttempt(
            **self.reference.model_dump(), terminal_proof_id=final.terminal_proof_id))


class ManualInvoiceDispatches:
    def __init__(self, profiles: ProfileAdmission, directory: Path | None):
        self.profiles = profiles
        self.ledger = ManualInvoiceLedger(directory)
        self.active: set[str] = set()

    def initialize_safety(self) -> None:
        """Fence durable OCR uncertainty before any consumer starts up."""
        try:
            self.recover_closed()
        except ServiceError:
            self.profiles.quarantine("agentic")

    def recover_closed(self) -> None:
        """Reconcile only a previously committed exact local closure receipt."""
        identity = self.profiles.identity("agentic")
        if identity is None:
            return
        marker = self.profiles.read_dispatch_marker("agentic")
        if marker is None:
            self._ack_closed_without_marker(identity)
            return
        # Never adopt a chat, login, Teacher or historical marker as OCR.
        if not isinstance(marker, dict) or marker.get("kind") != "manual_invoice":
            raise ServiceError("native_proof_missing", "El perfil requiere conciliación verificable.", 409)
        attempt_id = marker.get("attempt_id")
        if not isinstance(attempt_id, str) or attempt_id in self.active:
            raise ServiceError("runtime_busy", "El perfil tiene un análisis activo.", 409)
        proof = self.ledger.read(attempt_id)
        if (proof is None or not proof.process_closed or proof.terminal_proof_id is None
                or proof.state == "dispatch_armed"):
            raise ServiceError("native_proof_missing", "El cierre local del análisis no está verificado.", 409)
        reference = ReconcileAttempt(resource_key=proof.resource_key,
            session_generation=proof.session_generation, operation_ref=proof.operation_ref)
        expected = {"kind": "manual_invoice", "attempt_id": proof.attempt_id, **reference.model_dump()}
        if (marker != expected or proof.engine != "agentic" or proof.resource_key != identity
                or proof.attempt_id != attempt_id or proof.operation_ref != attempt_id):
            raise ServiceError("native_proof_mismatch", "El recibo no corresponde al análisis.", 409)
        self.profiles.reconcile_dispatch("agentic", expected)
        self.ledger.acknowledge(attempt_id, "agentic", AcknowledgeAttempt(
            **reference.model_dump(), terminal_proof_id=proof.terminal_proof_id))

    def _ack_closed_without_marker(self, identity: str) -> None:
        """Crash after admission release: remove only exact closed OCR receipts.

        This never releases capacity, promotes an armed proof, or touches another
        profile. The dedicated directory and bounded scan prevent a journal.
        """
        if self.ledger.directory is None:
            names = [key + ".json" for key in self.ledger.memory]
        else:
            try:
                with os.scandir(self.ledger.directory) as entries:
                    names = []
                    for entry in entries:
                        names.append(entry.name)
                        if len(names) > 64:
                            raise ServiceError("native_proof_missing", "Los recibos del análisis requieren revisión.", 409)
            except FileNotFoundError:
                return
        for name in names:
            if not name.endswith(".json"):
                continue
            attempt_id = name[:-5]
            if attempt_id in self.active:
                continue
            proof = self.ledger.read(attempt_id)
            if (proof is not None and proof.resource_key == identity and proof.engine == "agentic"
                    and (proof.state == "dispatch_armed" or not proof.process_closed
                         or proof.terminal_proof_id is None)):
                # A missing marker cannot erase durable evidence of dispatch.
                # Startup repeats this fence; no new marker or proof is forged.
                self.profiles.quarantine("agentic")
                raise ServiceError("native_proof_missing", "El análisis anterior requiere conciliación verificable.", 409)
            if (proof is not None and proof.resource_key == identity and proof.engine == "agentic"
                    and proof.attempt_id == attempt_id and proof.operation_ref == attempt_id
                    and proof.state != "dispatch_armed" and proof.process_closed and proof.terminal_proof_id):
                self.ledger.acknowledge(attempt_id, "agentic", AcknowledgeAttempt(
                    resource_key=proof.resource_key, session_generation=proof.session_generation,
                    operation_ref=proof.operation_ref, terminal_proof_id=proof.terminal_proof_id))

    @asynccontextmanager
    async def operation(self, session_generation: str) -> AsyncIterator[ManualInvoiceDispatch]:
        self.recover_closed()
        async with self.profiles.operation("agentic", purpose="execution"):
            dispatch = ManualInvoiceDispatch(self.profiles, self.ledger, session_generation)
            self.active.add(dispatch.attempt_id)
            try:
                yield dispatch
            except BaseException:
                try:
                    dispatch.finish(completed=False)
                except Exception:
                    # Keep the original cancellation/error and its quarantine.
                    pass
                raise
            else:
                dispatch.finish(completed=True)
            finally:
                self.active.discard(dispatch.attempt_id)
