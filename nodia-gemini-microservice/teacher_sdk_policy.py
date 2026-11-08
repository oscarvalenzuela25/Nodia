"""Closed Teacher SDK policy. Importing this module performs no runtime IO."""
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

CONTRACT = "teacher-sdk-host/1"
INPUT_LIMIT = 800000
PROMPT_LIMIT = 131072
OUTPUT_LIMIT = 32768
REPLY_LIMIT = 262144
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["text"],
    "properties": {"text": {"type": "string", "minLength": 1, "maxLength": OUTPUT_LIMIT}}}


class SDKPolicyError(ValueError):
    """Only application-owned, bounded codes may cross the child boundary."""


class Closed(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class TeacherSDKHostRequest(Closed):
    contract: Literal["teacher-sdk-host/1"]
    operation_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    request_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    host_nonce: str = Field(pattern=r"^[0-9a-f]{32}$")
    model_id: str = Field(min_length=1, max_length=1024)
    effort_id: str | None = Field(max_length=256)
    prompt: str = Field(min_length=1, max_length=PROMPT_LIMIT)
    deadline_at: str = Field(min_length=1, max_length=64,
        pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")

    @field_validator("operation_id")
    @classmethod
    def uuid(cls, value: str) -> str:
        if str(UUID(value)) != value or UUID(value).int == 0:
            raise ValueError("Canonical nonzero UUID required")
        return value

    @field_validator("model_id", "effort_id")
    @classmethod
    def option(cls, value: str | None) -> str | None:
        if value is not None and (value != value.strip() or not value or any(ord(c) < 32 for c in value)):
            raise ValueError("Exact option required")
        return value

    @field_validator("prompt")
    @classmethod
    def prompt_bytes(cls, value: str) -> str:
        if not value.strip() or len(value.encode("utf-8")) > PROMPT_LIMIT:
            raise ValueError("Prompt byte budget exceeded")
        return value

    @field_validator("model_id")
    @classmethod
    def model_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 1024:
            raise ValueError("Model byte budget exceeded")
        return value

    @field_validator("effort_id")
    @classmethod
    def effort_bytes(cls, value: str | None) -> str | None:
        if value is not None and len(value.encode("utf-8")) > 256:
            raise ValueError("Effort byte budget exceeded")
        return value

    @field_validator("deadline_at")
    @classmethod
    def instant(cls, value: str) -> str:
        if datetime.fromisoformat(value.replace("Z", "+00:00")).utcoffset() is None:
            raise ValueError("Timezone required")
        return value

    def remaining(self) -> float:
        seconds = (datetime.fromisoformat(self.deadline_at.replace("Z", "+00:00")) - datetime.now(timezone.utc)).total_seconds()
        if not 0 < seconds <= 600:
            raise SDKPolicyError("deadline_expired")
        return seconds

    def binding(self) -> dict[str, str]:
        return {"contract": CONTRACT, "operation_id": self.operation_id, "request_hash": self.request_hash,
            "host_nonce": self.host_nonce, "binding_hash": canonical_hash(self.model_dump())}


class TeacherSDKAnswer(Closed):
    text: str = Field(min_length=1, max_length=OUTPUT_LIMIT)

    @field_validator("text")
    @classmethod
    def bytes(cls, value: str) -> str:
        if not value.strip() or len(value.encode("utf-8")) > OUTPUT_LIMIT:
            raise ValueError("Answer byte budget exceeded")
        return value


class TeacherSDKObserveRequest(Closed):
    contract: Literal["teacher-sdk-host/1"]
    model_id: str = Field(min_length=1, max_length=1024)
    effort_id: str | None = Field(max_length=256)

    @field_validator("model_id", "effort_id")
    @classmethod
    def exact(cls, value: str | None) -> str | None:
        return TeacherSDKHostRequest.option(value)

    @field_validator("model_id")
    @classmethod
    def model_bytes(cls, value: str) -> str:
        return TeacherSDKHostRequest.model_bytes(value)

    @field_validator("effort_id")
    @classmethod
    def effort_bytes(cls, value: str | None) -> str | None:
        return TeacherSDKHostRequest.effort_bytes(value)


def canonical_hash(value: object) -> str:
    return sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
        separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def unique_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value: dict[str, object] = {}
    for key, item in pairs:
        if key in value:
            raise SDKPolicyError("invalid_json")
        value[key] = item
    return value


def reject_constant(_value: str) -> None:
    raise SDKPolicyError("invalid_json")


def strict_json(raw: bytes) -> object:
    return json.loads(raw, object_pairs_hook=unique_pairs, parse_constant=reject_constant)


def finish_tool_configuration() -> dict[str, object]:
    """Teacher's provider contract, independent of the SDK's default NONE.

    Public SDK 0.1.23 exposes no function-calling mode field. The owned CCPA
    boundary composes this explicit control before validating/sending its one
    request. Finish returns text; no native IO, MCP or business tool is enabled.
    """
    return {"functionCallingConfig": {"mode": "ANY", "allowedFunctionNames": ["finish"]}}


def source_finish(result: object, steps: list[dict[str, object]], reply_hash: str | None,
                  stop_reason: str | None, history_before: int, turns: int) -> TeacherSDKAnswer:
    """The public SDK's last structured value alone is insufficient proof."""
    answer = TeacherSDKAnswer.model_validate(result)
    expected = canonical_hash(answer.model_dump())
    if (reply_hash != expected or history_before != 0 or turns != 1 or not steps
            or stop_reason not in ("UNSPECIFIED", "MAX_MODEL_CALLS_EXCEEDED")
            or any(row.get("error_present") or row.get("status") in ("ERROR", "CANCELED") for row in steps)):
        raise SDKPolicyError("finish_unverified")
    last = steps[-1]
    if not (last.get("type") == "FINISH" and last.get("status") == "DONE"
            and last.get("source") == "MODEL" and last.get("target") == "TARGET_USER"
            and last.get("root_trajectory_matches") is True and last.get("depth") == 0
            and last.get("complete_response") is True and last.get("structured_hash") == expected):
        raise SDKPolicyError("finish_unverified")
    return answer


def make_sdk_config(command: TeacherSDKHostRequest, endpoint_url: str, token: str, binding: str,
                    directory: str, conversation_id: str):
    """Use only public SDK extension/factory APIs; no optional SDK on import."""
    import logging
    from google.antigravity import types
    from google.antigravity.connections.connection import AgentConfig, DebugConfig
    from google.antigravity.connections.local.local_connection import LocalConnectionStrategy
    from google.antigravity.hooks import policy

    try:
        options = (types.GeminiModelOptions(thinking_level=types.ThinkingLevel(command.effort_id))
            if command.effort_id is not None else None)
    except ValueError:
        raise SDKPolicyError("unsupported_effort") from None

    class TeacherConfig(AgentConfig):
        models: list[types.ModelTarget]

        def create_strategy(self, *, tool_runner, hook_runner):
            if not (len(self.models) == 1 and self.models[0].name == command.model_id
                    and self.models[0].types == [types.ModelType.TEXT]):
                raise SDKPolicyError("model_mismatch")
            return LocalConnectionStrategy(tool_runner=tool_runner, hook_runner=hook_runner,
                models=self.models, system_instructions=self.system_instructions,
                capabilities_config=self.capabilities, tools=self.tools, workspaces=self.workspaces,
                skills_paths=self.skills_paths, inline_skills=self.inline_skills, mcp_servers=self.mcp_servers,
                subagents=self.subagents, policies=self.policies, debug_config=self.debug_config,
                save_dir=self.save_dir, app_data_dir=self.app_data_dir, conversation_id=self.conversation_id,
                session_continuation_mode=self.session_continuation_mode, compaction_config=self.compaction_config,
                retry_config=self.retry_config, budget_config=self.budget_config)

    endpoint = types.GeminiAPIEndpoint(api_key="INTERNAL_LOOPBACK_PROXY_ONLY", base_url=endpoint_url,
        options=options, http_headers={"X-Nodia-Teacher-Token": token, "X-Nodia-Teacher-Binding": binding})
    config = TeacherConfig(models=[types.ModelTarget(name=command.model_id, endpoint=endpoint, types=[types.ModelType.TEXT])],
        tools=[], mcp_servers=[], skills_paths=[], inline_skills=[], subagents=[], workspaces=[],
        capabilities=types.CapabilitiesConfig(enabled_tools=[], enable_subagents=False,
            agent_behavior=types.AgentBehavior.AUTONOMOUS, finish_tool_schema_json=json.dumps(SCHEMA)),
        response_schema=SCHEMA, policies=[policy.allow("finish"), policy.deny("*")],
        retry_config=types.RetryConfig(api_retry=types.ModelAPIRetryConfig(max_retries=0),
            model_output_retry=types.ModelOutputRetryConfig(max_retries=0)),
        budget_config=types.BudgetConfig(max_model_calls=1, max_tool_calls=1),
        compaction_config=types.CompactionConfig(token_threshold=2147483647),
        conversation_id=conversation_id, session_continuation_mode=types.SessionContinuationMode.CREATE_ONLY,
        debug_config=DebugConfig(enable_server_side_tracing=False, logging_level=logging.CRITICAL),
        save_dir=directory + "/trajectory", app_data_dir=directory + "/appdata")
    return config
