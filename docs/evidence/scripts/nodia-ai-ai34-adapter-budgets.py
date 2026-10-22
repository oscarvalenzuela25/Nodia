"""Validate real adapter envelopes offline; no model window or quota is inferred."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / "nodia-gemini-microservice"
os.environ["DOTENV_CONFIG_PATH"] = os.devnull
sys.path[:0] = [str(SERVICE / "tests"), str(SERVICE)]
# Installs temporary paths, denies external connections and browser construction
# before application imports. This is the same isolation as the Python suite.
import test_support  # noqa: E402,F401
from pydantic import ValidationError  # noqa: E402
from nodia_ai_chat import ChatRequest, Answer, REPLY  # noqa: E402
from native_mcp_sessions import McpChatRequest  # noqa: E402
from native_mcp_stdio import MAX_CATALOG_BYTES, MAX_CATALOG_TOOLS  # noqa: E402
from native_context_budget import ContextMeasureRequest, measure_context, require_context_budget, require_measurement_budget, build_chat_prompt, build_mcp_prompt, append_agentic_attachment_prompt, controlled_native_context_bytes  # noqa: E402
from native_execution_agents import execution_agent_definition  # noqa: E402
from service_errors import ServiceError  # noqa: E402


def main() -> None:
    checks: list[str] = []

    def check(name: str, condition: bool) -> None:
        assert condition, name
        checks.append(name)

    def rejected(name: str, model: type, payload: dict) -> None:
        try:
            model.model_validate(payload)
        except ValidationError:
            checks.append(name)
        else:
            raise AssertionError(name)

    base = {
        "attempt_id": str(uuid4()), "model_id": "synthetic-budget-model",
        "effort_id": None, "configuration_generation": "b" * 64,
        "resource_key": "gemini-profile:" + "a" * 64,
        "session_generation": "c" * 32, "timeout_seconds": 1,
    }
    canonical_limit = ChatRequest.model_json_schema()["properties"]["canonical_prompt"]["maxLength"]
    check("canonical envelope remains 262144 bytes rather than an inferred token window", canonical_limit == 262144)
    for label, value in (("ascii", "x" * canonical_limit), ("utf8", "\U0001f7e2" * (canonical_limit // 4))):
        accepted = ChatRequest.model_validate({**base, "canonical_prompt": value})
        check(f"shared Web and Agentic contract accepts exact {label} UTF-8 boundary", len(accepted.canonical_prompt.encode()) == canonical_limit)
        rejected(f"shared Web and Agentic contract rejects {label} boundary plus one byte", ChatRequest, {**base, "canonical_prompt": value + "x"})

    tools = [{"name": f"synthetic_read_{i}", "description": "x", "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}} for i in range(MAX_CATALOG_TOOLS)]

    def size(items: list[dict]) -> int:
        return len(json.dumps(items, ensure_ascii=False, separators=(",", ":")).encode())

    remaining = MAX_CATALOG_BYTES - size(tools)
    for tool in tools:
        added = min(remaining, 2047)
        tool["description"] += "x" * added
        remaining -= added
    check("catalog fixture reaches the real byte envelope without invalid individual descriptors", remaining == 0 and size(tools) == MAX_CATALOG_BYTES)
    request = McpChatRequest.model_validate({**base, "canonical_prompt": "x" * canonical_limit, "tools": tools})
    check("parser alone admits separate canonical and catalog ceilings before final prompt measurement", len(request.canonical_prompt.encode()) == canonical_limit and len(request.tools) == MAX_CATALOG_TOOLS)
    raised = json.loads(json.dumps(tools))
    next(tool for tool in raised if len(tool["description"]) < 2048)["description"] += "x"
    rejected("catalog envelope rejects one extra byte even when canonical input is small", McpChatRequest, {**base, "canonical_prompt": "small", "tools": raised})
    rejected("MCP request inherits exact canonical UTF-8 ceiling independently of its catalog", McpChatRequest, {**base, "canonical_prompt": "x" * (canonical_limit + 1), "tools": [tools[-1]]})
    rejected("catalog count is bounded independently of catalog bytes", McpChatRequest, {**base, "canonical_prompt": "small", "tools": [{"name": f"synthetic_read_{i}", "description": "x", "input_schema": {"type": "object", "additionalProperties": False}} for i in range(MAX_CATALOG_TOOLS + 1)]})
    measure_base = {"model_id": base["model_id"], "effort_id": None}
    for engine, schema in (("web", REPLY.json_schema()), ("agentic", Answer.model_json_schema())):
        measured = measure_context(engine, ContextMeasureRequest(**measure_base, canonical_prompt="x"), schema)
        overhead = measured.overhead_utf8_bytes
        exact = "x" * (canonical_limit - overhead)
        boundary = measure_context(engine, ContextMeasureRequest(**measure_base, canonical_prompt=exact), schema)
        check(f"{engine} measurement counts actual protocol and response schema overhead", overhead > 0 and boundary.total_utf8_bytes == canonical_limit and boundary.measurement_kind == "exact")
        role = execution_agent_definition("chat", False)[1] if engine == "agentic" else ""
        exact_prompt = build_chat_prompt(engine, exact, schema, False)
        require_context_budget(exact_prompt, role)
        check(f"{engine} final native prompt and owned role accept their exact complete UTF-8 boundary", controlled_native_context_bytes(engine, exact_prompt, False) == canonical_limit)
        try:
            require_context_budget(build_chat_prompt(engine, exact + "x", schema, False), role)
        except ServiceError as error:
            check(f"{engine} rejects complete native prompt plus one byte before generation", error.code == "context_limit")
        else:
            raise AssertionError("Native context boundary was not enforced")
        check(f"{engine} model token window remains unknown rather than inferred from Nodia byte policy", boundary.model_context_tokens is None)
        check(f"{engine} without MCP reserves no synthetic tools listing", boundary.first_mcp_listing_upper_bound_utf8_bytes == 0)
    mcp_input = ContextMeasureRequest(**measure_base, canonical_prompt="x", tools=tools)
    mcp = measure_context("agentic", mcp_input, Answer.model_json_schema())
    exact_mcp = "x" * (canonical_limit - mcp.overhead_utf8_bytes - mcp.catalog_utf8_bytes)
    mcp_boundary_input = mcp_input.model_copy(update={"canonical_prompt": exact_mcp})
    mcp_boundary = measure_context("agentic", mcp_boundary_input, Answer.model_json_schema())
    check("MCP complete native budget includes actual catalog presentation and wrapper bytes", mcp_boundary.total_utf8_bytes == canonical_limit and mcp_boundary.catalog_utf8_bytes > 0)
    mcp_role = execution_agent_definition("mcp", False)[1]
    require_context_budget(build_mcp_prompt(exact_mcp, mcp_input.tools), mcp_role)
    check("MCP final native prompt and owned role accept their exact total boundary", controlled_native_context_bytes("agentic", build_mcp_prompt(exact_mcp, mcp_input.tools), False, True) == canonical_limit)
    try:
        require_context_budget(build_mcp_prompt(exact_mcp + "x", mcp_input.tools), mcp_role)
    except ServiceError as error:
        check("MCP rejects total byte boundary plus one even though component parsers accept it", error.code == "context_limit")
    else:
        raise AssertionError("MCP native context boundary was not enforced")
    try:
        require_measurement_budget(mcp_boundary)
    except ServiceError as error:
        check("MCP preflight also reserves its first real JSON-RPC tools listing", error.code == "context_limit" and mcp_boundary.first_mcp_listing_upper_bound_utf8_bytes > 0)
    else:
        raise AssertionError("Duplicated MCP listing was omitted from preflight")
    small_tools = [{"name": "synthetic_read", "description": "x" * 1024, "input_schema": {"type": "object", "additionalProperties": False}}]
    small_input = ContextMeasureRequest(**measure_base, canonical_prompt="x", tools=small_tools)
    small = measure_context("agentic", small_input, Answer.model_json_schema())
    available = canonical_limit - small.overhead_utf8_bytes - small.catalog_utf8_bytes - small.first_mcp_listing_upper_bound_utf8_bytes
    reserved_boundary = measure_context("agentic", small_input.model_copy(update={"canonical_prompt": "x" * available}), Answer.model_json_schema())
    require_measurement_budget(reserved_boundary)
    check("MCP exact controlled boundary includes the independently reported first listing reserve", reserved_boundary.total_utf8_bytes + reserved_boundary.first_mcp_listing_upper_bound_utf8_bytes == canonical_limit)
    try:
        require_measurement_budget(measure_context("agentic", small_input.model_copy(update={"canonical_prompt": "x" * (available + 1)}), Answer.model_json_schema()))
    except ServiceError as error:
        check("MCP controlled boundary plus one fails even while initial native prompt alone fits", error.code == "context_limit")
    else:
        raise AssertionError("MCP reserved boundary was not enforced")
    for engine in ("web", "agentic"):
        attachments = [{"kind": "image", "media_type": "image/png"}] * 4
        payload = ContextMeasureRequest(**measure_base, canonical_prompt="Synthetic attachment metadata", attachments=attachments)
        schema = REPLY.json_schema() if engine == "web" else Answer.model_json_schema()
        bound = measure_context(engine, payload, schema)
        actual = build_chat_prompt(engine, payload.canonical_prompt, schema, True)
        if engine == "agentic":
            actual = append_agentic_attachment_prompt(actual, ["/tmp/synthetic.png"] * 4)
        check(f"{engine} attachment metadata and role overhead are measured before original file materialization", bound.total_utf8_bytes >= controlled_native_context_bytes(engine, actual, True) and bound.total_utf8_bytes == bound.canonical_utf8_bytes + bound.catalog_utf8_bytes + bound.overhead_utf8_bytes)
        check(f"{engine} attachment measurement identifies exact versus conservative path accounting", bound.measurement_kind == ("exact" if engine == "web" else "upper_bound"))
    combined = measure_context("agentic", ContextMeasureRequest(**measure_base, canonical_prompt="x" * canonical_limit, tools=tools), Answer.model_json_schema())
    check("component parser maxima cannot silently bypass the total Nodia native prompt budget", combined.total_utf8_bytes > combined.max_utf8_bytes)
    for kind in ("chat", "mcp"):
        for has_attachments in (False, True):
            role_name, role_document = execution_agent_definition(kind, has_attachments)
            prompt = "Synthetic role budget input \U0001f7e2"
            actual = controlled_native_context_bytes("agentic", prompt, has_attachments, kind == "mcp")
            if kind == "chat":
                check(f"Agentic chat role with attachments={has_attachments} counts its exact owned UTF-8 definition", bool(role_name) and len(role_document.encode()) > 0 and actual == len(prompt.encode()) + len(role_document.encode()))
            else:
                check(f"Agentic MCP with attachments={has_attachments} adds no unverified custom role to its measured prompt", role_name == "" and role_document == "" and actual == len(prompt.encode()))
    sources = ["nodia_ai_chat.py", "native_mcp_sessions.py", "native_mcp_stdio.py", "native_context_budget.py", "native_execution_agents.py"]
    print(json.dumps({
        "stage": "AI-34", "scope": "offline_real_python_adapter_envelopes", "status": "passed",
        "checks": len(checks), "passed": checks,
        "canonical_utf8_bytes": canonical_limit,
        "mcp_catalog_utf8_bytes": MAX_CATALOG_BYTES,
        "mcp_catalog_tools": MAX_CATALOG_TOOLS,
        "provider_model_token_window": None,
        "total_initial_native_prompt_utf8_bytes": canonical_limit,
        "wrapper_overhead": "initial prompt and Nodia-owned role definitions are counted; separate first MCP listing reserve and cumulative bridge replies consume the same Nodia budget",
        "real_inference": False, "configured_sessions_used": False,
        "source_sha256": {name: hashlib.sha256((SERVICE / name).read_bytes()).hexdigest() for name in sources},
    }, indent=2))


if __name__ == "__main__":
    main()
