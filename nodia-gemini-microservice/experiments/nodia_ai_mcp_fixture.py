"""Closed synthetic MCP server for AI-03. No DB, network, executor or auth secrets."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

from experiments.nodia_ai_web_protocol import (
    AvailabilityArgs, ExpenseArgs, FixtureGateway, ReadRequest, PrepareRequest, _unique_pairs,
)

TOOLS = {"fixture_availability_read": AvailabilityArgs, "fixture_expense_prepare": ExpenseArgs}
NATIVE_NAMES = {name: tool for tool in TOOLS for name in (
    tool, "mcp_nodia_fixture_" + tool, "mcp_nodia_fixture__" + tool,
)}
MAX_LINE = 65536


def parse_json(raw: bytes) -> object:
    if len(raw) > MAX_LINE:
        raise ValueError("Fixture message too large")
    try:
        value = json.loads(raw, object_pairs_hook=_unique_pairs,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Invalid number")))
        pending = [(value, 0)]
        while pending:
            item, depth = pending.pop()
            if depth > 16:
                raise ValueError("Fixture nesting budget exceeded")
            if isinstance(item, (dict, list)):
                if len(item) > 128:
                    raise ValueError("Fixture collection budget exceeded")
                pending.extend((child, depth + 1) for child in (item.values() if isinstance(item, dict) else item))
        return value
    except (UnicodeError, RecursionError) as error:
        raise ValueError("Invalid fixture JSON") from error


def gate(payload: object) -> tuple[str, bool]:
    try:
        call = payload["toolCall"]
        name = call["name"]
        if name == "finish":
            return "finish", isinstance(call["args"], dict)
        if name == "call_mcp_tool":
            envelope = call["args"]
            if (not isinstance(envelope, dict)
                    or set(envelope) - {"ServerName", "ToolName", "Arguments", "toolAction", "toolSummary"}
                    or envelope.get("ServerName") != "nodia_fixture"
                    or not isinstance(envelope.get("ToolName"), str) or envelope["ToolName"] not in TOOLS
                    or not isinstance(envelope.get("Arguments"), str)
                    or any(k in envelope and (not isinstance(envelope[k], str) or len(envelope[k]) > 1024)
                           for k in ("toolAction", "toolSummary"))):
                return "unregistered", False
            tool = envelope["ToolName"]
            TOOLS[tool].model_validate(parse_json(envelope["Arguments"].encode()))
            return tool, True
        tool = NATIVE_NAMES.get(name)
        if tool is None:
            return "unregistered", False
        TOOLS[tool].model_validate(call["args"])
        return tool, True
    except (KeyError, TypeError, ValueError, AttributeError):
        return "invalid", False


class FixtureMcp:
    def __init__(self, run_id: str, marker: str, *, cli_json_string_arguments: bool = False) -> None:
        self.run_id = run_id
        self.gateway = FixtureGateway(marker)
        self.initialized = False
        self.ready = False
        self.calls = 0
        self.requests = 0
        self.cli_json_string_arguments = cli_json_string_arguments
        self.audit: list[dict[str, object]] = []

    def handle(self, request: object) -> dict[str, object] | None:
        self.requests += 1
        method = request.get("method") if isinstance(request, dict) else None
        params = request.get("params") if isinstance(request, dict) else None
        self.audit.append({"run_id": self.run_id, "event": "rpc_received",
            "method": method if method in ("initialize", "notifications/initialized", "notifications/cancelled", "ping", "tools/list", "tools/call") else "other",
            "arguments_type": type(params.get("arguments")).__name__ if isinstance(params, dict) and method == "tools/call" else None})
        identity = request.get("id") if isinstance(request, dict) else None
        def result(value: object) -> dict[str, object]:
            return {"jsonrpc": "2.0", "id": identity, "result": value}
        def error(code: int) -> dict[str, object]:
            self.audit.append({"run_id": self.run_id, "event": "rpc_rejected", "code": code})
            return {"jsonrpc": "2.0", "id": identity, "error": {"code": code, "message": "Fixture request rejected"}}
        if self.requests > 128:
            return error(-32000)
        if (not isinstance(request, dict) or request.get("jsonrpc") != "2.0"
                or set(request) - {"jsonrpc", "id", "method", "params"}
                or not isinstance(request.get("method"), str)
                or type(identity) not in (str, int, type(None))):
            return error(-32600)
        method = request["method"]
        params = request.get("params", {})
        if method == "initialize":
            if self.initialized or not isinstance(params, dict):
                return error(-32600)
            protocol = params.get("protocolVersion")
            if protocol not in ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"):
                return error(-32602)
            self.initialized = True
            self.audit.append({"run_id": self.run_id, "event": "initialize", "protocol": protocol})
            return result({"protocolVersion": protocol, "capabilities": {"tools": {}},
                           "serverInfo": {"name": "nodia-ai03-fixture", "version": "1"}})
        if method == "notifications/initialized" and self.initialized:
            self.ready = True
            return None
        if method == "notifications/cancelled":
            return None
        if identity is None:
            return None
        if not self.ready:
            return error(-32000)
        if method == "ping":
            return result({})
        if method == "tools/list":
            self.audit.append({"run_id": self.run_id, "event": "tools_list"})
            return result({"tools": [{"name": tool, "description": (
                "Synthetic availability; no real database. Return its marker in your answer." if tool.endswith("read") else
                "Synthetic expense preview only. Never executes; human confirmation is required."),
                "inputSchema": schema.model_json_schema()} for tool, schema in TOOLS.items()]})
        if method != "tools/call":
            return error(-32601)
        if (not isinstance(params, dict) or set(params) - {"name", "arguments", "_meta"}
                or not isinstance(params.get("name"), str) or params["name"] not in TOOLS or self.calls >= 12):
            return error(-32602)
        try:
            tool = params["name"]
            arguments = params.get("arguments")
            if isinstance(arguments, str) and self.cli_json_string_arguments:
                arguments = parse_json(arguments.encode())
                self.audit.append({"run_id": self.run_id, "event": "cli_arguments_normalized"})
            args = TOOLS[tool].model_validate(arguments)
            call_id = hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:32]
            cls = ReadRequest if tool.endswith("read") else PrepareRequest
            request = cls(kind="tool_request", call_id=call_id,
                          tool="fixture.availability.read" if tool.endswith("read") else "fixture.expense.prepare",
                          arguments=args)
            value = self.gateway.dispatch(request)
            self.calls += 1
            self.audit.append({"run_id": self.run_id, "event": "tool_completed", "tool": tool,
                               "call_id": call_id, "result": value})
            return result({"content": [{"type": "text", "text": json.dumps(value)}],
                           "structuredContent": value, "isError": False})
        except (ValueError, TypeError):
            return error(-32602)


def main() -> int:
    # These paths/context come only from a supervisor-generated MCP configuration.
    if len(sys.argv) not in (4, 5) or (len(sys.argv) == 5 and sys.argv[4] != "--cli-json-string-arguments"):
        return 2
    audit, run_id, marker = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    server = FixtureMcp(run_id, marker, cli_json_string_arguments=len(sys.argv) == 5)
    while raw := sys.stdin.buffer.readline(MAX_LINE + 1):
        if len(raw) > MAX_LINE:
            return 2
        before = len(server.audit)
        try:
            reply = server.handle(parse_json(raw))
        except (ValueError, TypeError):
            reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Invalid fixture JSON"}}
        if len(server.audit) > before:
            with audit.open("a", encoding="utf-8") as target:
                for item in server.audit[before:]:
                    target.write(json.dumps(item) + "\n")
        if reply is not None:
            print(json.dumps(reply), flush=True)
        if server.requests > 128:
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
