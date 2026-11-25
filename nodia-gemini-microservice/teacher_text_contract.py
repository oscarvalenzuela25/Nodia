"""Closed Teacher and CV text commands. No account, profile, SDK or IO on import."""
from datetime import datetime
from hashlib import sha256
import json
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

CONTRACT = "teacher-agentic-text/1"
CV_CONTRACT = "cv-agentic-text/1"
TextContract = Literal["teacher-agentic-text/1", "cv-agentic-text/1"]
Hex64 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
UuidString = Annotated[str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]
DecimalId = Annotated[str, Field(pattern=r"^[1-9][0-9]{0,18}$")]


def owner_namespace(contract: TextContract) -> Literal["teacher", "cv"]:
    return "cv" if contract == CV_CONTRACT else "teacher"


class Closed(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class TextSelection(Closed):
    model_id: str = Field(min_length=1, max_length=1024)
    effort_id: str | None = Field(max_length=256)
    configuration_generation: Hex64

    @field_validator("model_id", "effort_id")
    @classmethod
    def exact_option(cls, value: str | None, info: ValidationInfo) -> str | None:
        if value is not None and (not value.strip() or value != value.strip() or any(ord(c) < 32 for c in value)):
            raise ValueError("Exact nonempty option required")
        if value is not None and len(value.encode("utf-8")) > (1024 if info.field_name == "model_id" else 256):
            raise ValueError("Exact option byte budget exceeded")
        return value


class TeacherObserve(TextSelection):
    contract: Literal["teacher-agentic-text/1"]


class CvObserve(TextSelection):
    contract: Literal["cv-agentic-text/1"]


KnownTool = Literal["finish", "ask_permission", "view_file", "task_boundary", "notify_user",
    "view_file_outline", "list_dir", "find_by_name", "grep_search", "run_command", "write_to_file",
    "read_url_content", "call_mcp_tool", "replace_file_content", "multi_replace_file_content",
    "invoke_subagent", "define_subagent", "generate_image"]


class TeacherCatalogShape(Closed):
    container_type: Literal["absent", "null", "array", "object", "string", "number", "boolean", "other"]
    entry_count: int | None = Field(default=None, ge=0, le=4096)
    string_count: int | None = Field(default=None, ge=0, le=4096)
    object_count: int | None = Field(default=None, ge=0, le=4096)
    other_count: int | None = Field(default=None, ge=0, le=4096)
    finish_string_count: int | None = Field(default=None, ge=0, le=4096)
    finish_object_name_count: int | None = Field(default=None, ge=0, le=4096)
    unrecognized_name_count: int | None = Field(default=None, ge=0, le=4096)
    known_tool_names: list[KnownTool] = Field(default_factory=list, max_length=18)
    over_limit: bool = False


class TeacherCatalogInspection(Closed):
    contract: Literal["teacher-agentic-text-catalog/1"] = "teacher-agentic-text-catalog/1"
    status: Literal["observed", "inconclusive", "rejected"]
    reason: Literal["catalog_observed", "init_missing", "invalid_events", "unexpected_activity", "identity_mismatch", "cli_failed", "cli_unavailable", "generation_changed"]
    catalog: TeacherCatalogShape | None = None
    init_count: int = Field(default=0, ge=0, le=4096)
    model_matches: bool | None = None
    role_matches: bool | None = None
    exit_code: int | None = Field(default=None, ge=-255, le=255)
    local_closed: bool
    user_events_sent: Literal[0] = 0
    user_events_observed: int = Field(default=0, ge=0, le=4096)
    step_events_observed: int = Field(default=0, ge=0, le=4096)
    tool_events_observed: int = Field(default=0, ge=0, le=4096)
    num_turns: int | None = Field(default=None, ge=0, le=4096)
    provider_internal_generation_posts: None = None
    qualification_inferred: Literal[False] = False
    resource_key: str = Field(pattern=r"^gemini-profile:[0-9a-f]{64}$")
    session_generation: str = Field(pattern=r"^[0-9a-f]{32}$")
    runtime_hash: Hex64
    policy_hash: Hex64
    binary_sha512: str = Field(pattern=r"^[0-9a-f]{128}$")


class _TextOwner(Closed):
    operation_id: UuidString
    session_id: UuidString
    job_id: UuidString
    attempt_id: UuidString
    actor_id: DecimalId
    connection_id: DecimalId
    resource_key: str = Field(pattern=r"^gemini-profile:[0-9a-f]{64}$")
    session_generation: str = Field(pattern=r"^[0-9a-f]{32}$")
    runtime_hash: Hex64
    policy_hash: Hex64
    request_hash: Hex64

    @field_validator("operation_id", "session_id", "job_id", "attempt_id")
    @classmethod
    def canonical_uuid(cls, value: str) -> str:
        if str(UUID(value)) != value or UUID(value).int == 0:
            raise ValueError("Canonical nonzero UUID required")
        return value

    @field_validator("actor_id", "connection_id")
    @classmethod
    def positive_bigint(cls, value: str) -> str:
        if int(value) > 9223372036854775807:
            raise ValueError("Positive bigint required")
        return value


class TeacherReference(TeacherObserve, _TextOwner):
    pass


class CvReference(CvObserve, _TextOwner):
    owner_digest: Hex64


TextReference = TeacherReference | CvReference
StoredTextReference = Annotated[TextReference, Field(discriminator="contract")]

def canonical_hash(value: dict[str, object]) -> str:
    """Node canonical JSON: sorted ASCII keys, literal Unicode, compact UTF-8."""
    return sha256(json.dumps(value,
        sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")).hexdigest()


def command_hash(command: dict[str, object]) -> str:
    return canonical_hash({k: v for k, v in command.items() if k != "request_hash"})


class _TextCommand(Closed):
    prompt: str = Field(min_length=1, max_length=131072)
    deadline_at: str = Field(min_length=1, max_length=64,
        pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")

    @field_validator("prompt")
    @classmethod
    def prompt_bytes(cls, value: str) -> str:
        if not value.strip() or len(value.encode("utf-8")) > 131072:
            raise ValueError("Prompt byte budget exceeded")
        return value

    @field_validator("deadline_at")
    @classmethod
    def deadline_instant(cls, value: str) -> str:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Timezone required")
        return value

    @model_validator(mode="after")
    def exact_hash(self) -> "_TextCommand":
        if self.request_hash != command_hash(self.model_dump()):
            raise ValueError("Command hash mismatch")
        return self


class TeacherStart(TeacherReference, _TextCommand):
    def reference(self) -> TeacherReference:
        return TeacherReference.model_validate(self.model_dump(exclude={"prompt", "deadline_at"}))


class CvStart(CvReference, _TextCommand):
    def reference(self) -> CvReference:
        return CvReference.model_validate(self.model_dump(exclude={"prompt", "deadline_at"}))


TextStart = TeacherStart | CvStart


class _TextAck(Closed):
    terminal_proof_id: UuidString
    response_hash: Hex64 | None


class TeacherAck(TeacherReference, _TextAck):
    def reference(self) -> TeacherReference:
        return TeacherReference.model_validate(self.model_dump(exclude={"terminal_proof_id", "response_hash"}))


class CvAck(CvReference, _TextAck):
    def reference(self) -> CvReference:
        return CvReference.model_validate(self.model_dump(exclude={"terminal_proof_id", "response_hash"}))


TextAck = TeacherAck | CvAck


class TeacherDispatchExclusion(Closed):
    contract: TextContract = CONTRACT
    operation_id: UuidString
    request_hash: Hex64
    session_generation: str = Field(pattern=r"^[0-9a-f]{32}$")
    runtime_hash: Hex64
    process_started: Literal[False] = False
    provider_started: Literal[False] = False
    dispatch_exclusion: Literal[True] = True
    observed_at: str


class TeacherAnswer(Closed):
    text: str = Field(min_length=1, max_length=32768)

    @field_validator("text")
    @classmethod
    def text_bytes(cls, value: str) -> str:
        if not value.strip() or len(value.encode("utf-8")) > 32768:
            raise ValueError("Response byte budget exceeded")
        return value


class _TextObservation(Closed):
    available: bool
    reason: str | None
    observed_at: str
    resource_key: str | None
    session_generation: str
    runtime_hash: Hex64
    binary_sha512: str | None = Field(pattern=r"^[0-9a-f]{128}$")
    policy_hash: Hex64
    tool_policy: Literal["finish_only"] = "finish_only"
    native_io: Literal[False] = False


class TeacherObservation(_TextObservation):
    contract: Literal["teacher-agentic-text/1"] = CONTRACT


class CvObservation(_TextObservation):
    contract: Literal["cv-agentic-text/1"] = CV_CONTRACT


class _TextTerminalProof(Closed):
    terminal_proof_id: UuidString
    process_closed: Literal[True]
    remote_outcome: Literal["completed", "unknown"]
    response_hash: Hex64 | None
    observed_at: str


class TeacherTerminalProof(TeacherReference, _TextTerminalProof):
    pass


class CvTerminalProof(CvReference, _TextTerminalProof):
    pass


class _TextSnapshot(Closed):
    operation_id: UuidString
    state: Literal["running", "completed", "unknown"]
    text: str | None = Field(max_length=32768)

    @field_validator("text")
    @classmethod
    def response_bytes(cls, value: str | None) -> str | None:
        return TeacherAnswer(text=value).text if value is not None else None


class TeacherSnapshot(_TextSnapshot):
    contract: Literal["teacher-agentic-text/1"] = CONTRACT
    terminal_proof: TeacherTerminalProof | None


class CvSnapshot(_TextSnapshot):
    contract: Literal["cv-agentic-text/1"] = CV_CONTRACT
    terminal_proof: CvTerminalProof | None
