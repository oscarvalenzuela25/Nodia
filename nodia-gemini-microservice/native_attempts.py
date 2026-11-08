"""Minimal native terminal proofs. Never stores prompts, replies or business data."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal
from uuid import uuid4
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field
from service_errors import ServiceError


class ReconcileAttempt(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    resource_key: str = Field(pattern=r"^gemini-profile:[0-9a-f]{64}$")
    session_generation: str = Field(pattern=r"^[0-9a-f]{32}$")
    operation_ref: str = Field(pattern=r"^[0-9a-f-]{36}$")


class AcknowledgeAttempt(ReconcileAttempt):
    terminal_proof_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class NativeAttemptProof(ReconcileAttempt):
    input_digest: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    schema_version: Literal[1] = 1
    attempt_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    # Historical Web proofs remain readable; new dispatches are Agentic only.
    engine: Literal["web", "agentic"]
    state: Literal["dispatch_armed", "completed", "abandoned_unknown"]
    process_closed: bool
    terminal_proof_id: str | None = Field(default=None, pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    observed_at: str


class NativeTerminalReply(ReconcileAttempt):
    attempt_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    terminal_proof_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    process_closed: Literal[True]
    outcome: Literal["completed", "abandoned_unknown"]
    observed_at: str


class NativeAttemptLedger:
    def __init__(self, directory: Path | None):
        self.directory = directory
        self.memory: dict[str, NativeAttemptProof] = {}

    def read(self, attempt_id: str) -> NativeAttemptProof | None:
        if len(attempt_id) != 36 or any(char not in "0123456789abcdef-" for char in attempt_id):
            raise ServiceError("invalid_attempt", "Identidad de intento inválida.", 422)
        if self.directory is None:
            return self.memory.get(attempt_id)
        path = self.directory / (attempt_id + ".json")
        if not path.exists():
            return None
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 4096:
            raise ServiceError("native_proof_invalid", "No se pudo verificar el recibo nativo.", 409)
        try:
            return NativeAttemptProof.model_validate_json(path.read_bytes())
        except (ValueError, OSError):
            raise ServiceError("native_proof_invalid", "No se pudo verificar el recibo nativo.", 409) from None

    def write(self, proof: NativeAttemptProof) -> None:
        if self.directory is None:
            self.memory[proof.attempt_id] = proof
            return
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        target = self.directory / (proof.attempt_id + ".json")
        temporary = self.directory / (uuid4().hex + ".tmp")
        try:
            descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                output.write(proof.model_dump_json())
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, target)
            self.sync_directory()
        finally:
            temporary.unlink(missing_ok=True)

    def sync_directory(self) -> None:
        if self.directory is not None and os.name != "nt":
            descriptor = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)

    def arm(self, attempt_id: str, engine: str, request: ReconcileAttempt, input_digest: str | None = None) -> NativeAttemptProof:
        if engine != "agentic":
            raise ServiceError("invalid_engine", "Unsupported execution mode.", 422)
        if self.read(attempt_id) is not None:
            raise ServiceError("attempt_already_dispatched", "El intento ya fue admitido; no se reenviará.", 409)
        proof = NativeAttemptProof(attempt_id=attempt_id, engine=engine, state="dispatch_armed",
            process_closed=False, input_digest=input_digest, observed_at=datetime.now(timezone.utc).isoformat(), **request.model_dump())
        self.write(proof)
        return proof

    def close(self, proof: NativeAttemptProof, outcome: Literal["completed", "abandoned_unknown"]) -> NativeAttemptProof:
        final = proof.model_copy(update={"state": outcome, "process_closed": True,
            "terminal_proof_id": str(uuid4()), "observed_at": datetime.now(timezone.utc).isoformat()})
        self.write(final)
        return final

    @staticmethod
    def project(proof: NativeAttemptProof) -> NativeTerminalReply:
        if proof.state == "dispatch_armed" or not proof.process_closed or proof.terminal_proof_id is None:
            raise ServiceError("native_proof_missing", "No hay prueba terminal del intento.", 409)
        return NativeTerminalReply(attempt_id=proof.attempt_id,resource_key=proof.resource_key,
            session_generation=proof.session_generation,operation_ref=proof.operation_ref,
            terminal_proof_id=proof.terminal_proof_id,process_closed=True,outcome=proof.state,
            observed_at=proof.observed_at)

    @staticmethod
    def matches(proof: NativeAttemptProof, engine: str, request: ReconcileAttempt) -> bool:
        return (proof.engine == engine and proof.resource_key == request.resource_key
                and proof.session_generation == request.session_generation and proof.operation_ref == request.operation_ref)

    def acknowledge(self, attempt_id: str, engine: str, request: AcknowledgeAttempt) -> None:
        proof = self.read(attempt_id)
        if proof is None:
            return
        if (not self.matches(proof, engine, request) or not proof.process_closed
                or proof.state == "dispatch_armed" or proof.terminal_proof_id != request.terminal_proof_id):
            raise ServiceError("native_proof_mismatch", "El recibo no corresponde a la operación cerrada.", 409)
        if self.directory is None:
            self.memory.pop(attempt_id, None)
        else:
            (self.directory / (attempt_id + ".json")).unlink()
            self.sync_directory()
