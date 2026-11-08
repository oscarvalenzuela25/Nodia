"""Supervisor-owned stdio IPC bridge. No network, app imports, DB or secrets."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys
import time
from uuid import uuid4

MAX_BYTES = 65536
# Private transport envelopes, not CLI/model quotas. Ordinary RPC/callback limits stay unchanged.
# AI-31 complete read catalog: 67 product reads plus seven technical tools.
# This verified transport ceiling is independent from model/provider quotas.
MAX_CATALOG_TOOLS = 74
MAX_CATALOG_BYTES = 131072
MAX_MANIFEST_BYTES = MAX_CATALOG_BYTES + 4096
MAX_CONTROLLED_CONTEXT_BYTES = 262144
MAX_RPC_ID_UTF8_BYTES = 512
MAX_RPC_ID_INTEGER = 9007199254740991
MAX_JSON_DEPTH = 16
RPC_DIAGNOSTIC_METHODS = {
    "initialize": "initialize", "notifications/initialized": "notifications_initialized",
    "tools/list": "tools_list", "tools/call": "tools_call", "ping": "ping",
}
CLOSED_RPC_METHODS = {**RPC_DIAGNOSTIC_METHODS,
    "resources/list": "resources_list", "resources/templates/list": "resources_templates_list",
    "prompts/list": "prompts_list", "logging/setLevel": "logging_set_level",
    "notifications/progress": "notifications_progress", "notifications/cancelled": "notifications_cancelled",
    "notifications/tools/list_changed": "notifications_tools_list_changed"}
CLOSED_RPC_REASONS = frozenset({"unknown", "envelope", "initialize_params", "pre_ready",
    "unsupported_method", "invalid_tool_params", "replayed_identity", "rpc_budget", "tool_budget",
    "initialize", "notification", "tools_list", "ping", "tool_result"})


def rpc_result(identity, value):
    return {"jsonrpc": "2.0", "id": identity, "result": value}


def wire_reply_bytes(reply):
    return json.dumps(reply, ensure_ascii=False).encode("utf-8") + b"\n"


def mark_context_failure(directory: Path, category: str):
    try:
        with (directory / "context-budget-failed.json").open("x", encoding="utf-8") as output:
            output.write(json.dumps({"schema_version": 1, "category": category}))
    except FileExistsError:
        pass


def check_context_budget(directory: Path, final=False):
    if (directory / "context-budget-failed.json").exists():
        raise ValueError("Controlled context budget failed")
    if not (directory / "context-budget-owner.claim").exists():
        return  # The CLI did not start a bridge, so no MCP response was delivered.
    if not final and not (directory / "context-budget.json").exists():
        return  # A freshly claimed bridge has not published its initial atomic state yet.
    with (directory / "context-budget.json").open("rb") as source:
        state = bounded_json(source.read(1025), 1024)
    if (not isinstance(state, dict) or set(state) != {"schema_version", "used_utf8_bytes", "maximum_utf8_bytes"}
            or state["schema_version"] != 1 or type(state["used_utf8_bytes"]) is not int
            or state["maximum_utf8_bytes"] != MAX_CONTROLLED_CONTEXT_BYTES
            or not 0 <= state["used_utf8_bytes"] <= state["maximum_utf8_bytes"]):
        raise ValueError("Controlled context accounting invalid")
    return state


def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _bounded_json(raw, max_bytes, max_depth):
    if len(raw) > max_bytes:
        raise ValueError("Message budget")
    value = json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite JSON")))
    pending = [(value, 0)]
    while pending:
        item, depth = pending.pop()
        if depth > max_depth:
            raise ValueError("JSON depth")
        if isinstance(item, (dict, list)):
            if len(item) > 128:
                raise ValueError("JSON collection")
            pending.extend((child, depth+1) for child in (item.values() if isinstance(item, dict) else item))
    return value


def bounded_json(raw, max_bytes=MAX_BYTES):
    return _bounded_json(raw, max_bytes, MAX_JSON_DEPTH)


def atomic(path, value, max_bytes=MAX_BYTES):
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
    if len(raw) > max_bytes:
        raise ValueError("IPC budget")
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(raw)
    temporary.replace(path)


def read_manifest(path: Path):
    with path.open("rb") as source:
        # The catalog has its own depth-16 budget. This closed supervisor-owned
        # object adds exactly one structural level; it grants no extra payload depth.
        policy = _bounded_json(source.read(MAX_MANIFEST_BYTES + 1), MAX_MANIFEST_BYTES, MAX_JSON_DEPTH + 1)
    required = {"tools", "rpc_budget", "tool_budget", "timeout_seconds", "cli_json_string_arguments", "context_budget"}
    if not isinstance(policy, dict) or not required <= set(policy) or set(policy) - required - {"documents"}:
        raise ValueError("Manifest envelope")
    if (type(policy["rpc_budget"]) is not int or not 1 <= policy["rpc_budget"] <= 128
            or type(policy["tool_budget"]) is not int or not 1 <= policy["tool_budget"] <= 12
            or type(policy["timeout_seconds"]) is not int or not 1 <= policy["timeout_seconds"] <= 120
            or type(policy["cli_json_string_arguments"]) is not bool):
        raise ValueError("Manifest budgets")
    tools = policy.get("tools") if isinstance(policy, dict) else None
    if not isinstance(tools, list) or not 1 <= len(tools) <= MAX_CATALOG_TOOLS:
        raise ValueError("Catalog tool budget")
    names = [tool.get("name") for tool in tools if isinstance(tool, dict)]
    if len(names) != len(tools) or any(not isinstance(name, str) for name in names) or len(set(names)) != len(names):
        raise ValueError("Catalog identity")
    raw = json.dumps(tools, ensure_ascii=False, separators=(",", ":")).encode()
    bounded_json(raw, MAX_CATALOG_BYTES)
    documents = policy.get("documents", [])
    if not isinstance(documents, list) or len(documents) > 4 or any(not isinstance(item, str) or len(item) > 1024 or not Path(item).is_absolute() for item in documents):
        raise ValueError("Document allowlist")
    budget = policy.get("context_budget")
    if (not isinstance(budget, dict) or set(budget) != {"schema_version", "initial_utf8_bytes", "maximum_utf8_bytes"}
            or budget["schema_version"] != 1 or type(budget["initial_utf8_bytes"]) is not int
            or budget["maximum_utf8_bytes"] != MAX_CONTROLLED_CONTEXT_BYTES
            or not 0 <= budget["initial_utf8_bytes"] <= budget["maximum_utf8_bytes"]):
        raise ValueError("Controlled context budget required")
    return policy


class StdioBridge:
    def __init__(self, manifest: Path):
        self.policy = read_manifest(manifest)
        self.directory = manifest.parent
        try:
            with (self.directory / "context-budget-owner.claim").open("xb") as claim:
                claim.write(b"one bridge per native attempt\n")
        except FileExistsError:
            mark_context_failure(self.directory, "bridge_restart_rejected")
            raise ValueError("Bridge restart cannot reset context budget") from None
        self.context_used = self.policy["context_budget"]["initial_utf8_bytes"]
        self._persist_context()
        self.tools = {item["name"]: item for item in self.policy["tools"]}
        self.rpc_messages = 0
        self.tool_calls = 0
        self.initialized = False
        self.ready = False
        self.receipts = {}
        self.deadline = time.monotonic() + self.policy["timeout_seconds"]
        self._diagnostic_started = self.deadline - self.policy["timeout_seconds"]
        self._closed_rpc = None

    def _record_closed(self, publish=True, **updates):
        # Independent best-effort sidecar: never republish a domain callback or
        # change protocol, context accounting, completion, or cleanup on failure.
        try:
            self._closed_rpc.update(updates)
            if self._closed_rpc["elapsed_ms"] is None:
                self._closed_rpc["elapsed_ms"] = max(0, min(2147483647,
                    round((time.monotonic() - self._diagnostic_started) * 1000)))
            if not publish: return
            directory = self.directory / "rpc-diagnostics"
            directory.mkdir(exist_ok=True)
            atomic(directory / (str(self.rpc_messages).zfill(4) + ".json"), self._closed_rpc, max_bytes=2048)
        except Exception:
            pass

    def write_reply(self, reply, output):
        """Observe the original single write/flush; flush is not CLI consumption."""
        raw = wire_reply_bytes(reply)
        updates = {"write_completed": False, "flush_completed": False}
        try:
            written = output.write(raw)
            updates["write_completed"] = type(written) is int and written == len(raw)
            output.flush()
            updates["flush_completed"] = True
        finally:
            # No diagnostic filesystem operation may separate protocol write/flush.
            try: self._record_closed(**updates)
            except Exception: pass  # Preserve the exact original transport exception.

    def _persist_context(self):
        atomic(self.directory / "context-budget.json", {"schema_version": 1,
            "used_utf8_bytes": self.context_used, "maximum_utf8_bytes": MAX_CONTROLLED_CONTEXT_BYTES})

    def _reply(self, reply):
        # Reserve the entire serialized RPC response before any byte reaches CLI.
        # Includes discovery, rejected envelopes and repeated delivery of a receipt.
        cost = len(wire_reply_bytes(reply))
        if (self.directory / "context-budget-failed.json").exists() or self.context_used + cost > MAX_CONTROLLED_CONTEXT_BYTES:
            mark_context_failure(self.directory, "context_budget_exceeded")
            raise ValueError("Controlled context budget exhausted")
        self.context_used += cost
        self._persist_context()
        self._record_closed(publish=False, response_utf8_bytes=cost)
        return reply

    def handle(self, request):
        self.rpc_messages += 1
        if self.rpc_messages > self.policy["rpc_budget"]:
            raise ValueError("RPC budget exhausted")
        if isinstance(request, dict) and request.get("method") == "tools/call":
            # Every attempted tool invocation consumes capacity, including denied
            # envelopes and replays that reuse an existing result.
            self.tool_calls += 1
        event = {"kind": "rpc", "rpc_messages": self.rpc_messages,
                 "tool_requests": self.tool_calls}
        method = request.get("method") if isinstance(request, dict) else None
        self._closed_rpc = {"ordinal": self.rpc_messages, "elapsed_ms": None,
            "method": CLOSED_RPC_METHODS.get(method, "other") if isinstance(method, str) else "other",
            "response": "unknown", "reason": "unknown", "error_code": None,
            "constructed": False, "write_completed": False, "flush_completed": False,
            "response_utf8_bytes": None}
        self._record_closed()
        event["rpc_diagnostic"] = {"method": RPC_DIAGNOSTIC_METHODS.get(method, "other") if isinstance(method, str) else "other",
                                   "response": None, "error_code": None}
        target = self.directory / "requests" / (str(self.rpc_messages).zfill(4) + ".json")
        if self.tool_calls > self.policy["tool_budget"]:
            self._record_closed(reason="tool_budget")
            atomic(target,event)
            raise ValueError("Tool budget exhausted")
        identity = request.get("id") if isinstance(request, dict) else None
        def record_response(kind, code=None):
            # Supplemental evidence of a constructed reply, not proof the CLI
            # consumed it. Preserve the request event and its original budgets.
            # A callback request is published exactly once before its response
            # arrives. Do not publish it again as a second callback observation.
            if event["kind"]=="tool_request":return
            event["rpc_diagnostic"].update(response=kind, error_code=code)
            try: atomic(target,event)
            except (ValueError,OSError): pass
        def result(value, reason):
            reply=self._reply(rpc_result(identity, value))
            record_response("success")
            self._record_closed(response="success", reason=reason, constructed=True)
            return reply
        def error(code, reason):
            reply=self._reply({"jsonrpc":"2.0", "id":identity, "error":{"code":code,"message":"Nodia MCP request rejected"}})
            record_response("error",code)
            self._record_closed(response="error", reason=reason, error_code=code, constructed=True)
            return reply
        if (not isinstance(request, dict) or request.get("jsonrpc") != "2.0"
                or set(request)-{"jsonrpc","id","method","params"}
                or type(identity) not in (str, int, type(None))
                or (isinstance(identity, str) and len(identity.encode("utf-8")) > MAX_RPC_ID_UTF8_BYTES)
                or (type(identity) is int and abs(identity) > MAX_RPC_ID_INTEGER)):
            identity = None
            atomic(target,event)
            return error(-32600, "envelope")
        method = request.get("method")
        params = request.get("params",{})
        if method == "initialize":
            atomic(target,event)
            if self.initialized or not isinstance(params,dict) or params.get("protocolVersion") not in ("2025-11-25","2025-06-18","2025-03-26","2024-11-05"):
                return error(-32602, "initialize_params")
            self.initialized=True
            return result({"protocolVersion":params["protocolVersion"],"capabilities":{"tools":{}},"serverInfo":{"name":"nodia-runtime","version":"1"}}, "initialize")
        if method == "notifications/initialized" and self.initialized:
            self.ready=True
            atomic(target,event)
            record_response("notification")
            self._record_closed(response="notification", reason="notification")
            return None
        if method == "notifications/cancelled":
            atomic(target,event)
            record_response("notification")
            self._record_closed(response="notification", reason="notification")
            return None
        if identity is None:
            atomic(target,event)
            record_response("notification")
            self._record_closed(response="notification", reason="notification")
            return None
        if not self.ready:
            atomic(target,event)
            return error(-32000, "pre_ready")
        if method == "ping":
            atomic(target,event)
            return result({}, "ping")
        if method == "tools/list":
            atomic(target,event)
            return result({"tools":[{"name":item["name"],"description":item["description"],"inputSchema":item["input_schema"]} for item in self.tools.values()]}, "tools_list")
        if method != "tools/call" or not isinstance(params,dict) or set(params)-{"name","arguments","_meta"} or params.get("name") not in self.tools:
            atomic(target,event)
            return error(-32602, "unsupported_method" if method != "tools/call" else "invalid_tool_params")
        arguments = params.get("arguments")
        if isinstance(arguments,str) and self.policy["cli_json_string_arguments"]:
            arguments=bounded_json(arguments.encode())
        if not isinstance(arguments,dict):
            atomic(target,event)
            return error(-32602, "invalid_tool_params")
        canonical=json.dumps({"name":params["name"],"arguments":arguments},sort_keys=True,separators=(",",":"))
        fingerprint=hashlib.sha256(canonical.encode()).hexdigest()
        receipt_key=json.dumps(identity)
        previous=self.receipts.get(receipt_key)
        if previous is not None:
            atomic(target,event)
            return result(previous[1], "tool_result") if previous[0]==fingerprint else error(-32600, "replayed_identity")
        call_id=str(uuid4())
        event.update(kind="tool_request",call_id=call_id,name=params["name"],arguments=arguments)
        # Domain callback payloads retain their exact pre-diagnostic envelope and
        # byte budget. Their response remains unknown in the structural summary.
        event.pop("rpc_diagnostic")
        atomic(target,event)
        response=self.directory/"responses"/(call_id+".json")
        while not response.exists():
            if time.monotonic()>=self.deadline:
                raise ValueError("Callback deadline")
            time.sleep(0.05)
        value=bounded_json(response.read_bytes())
        if set(value)!={"result"} or not isinstance(value["result"],dict):
            raise ValueError("Invalid callback response")
        payload={"content":[{"type":"text","text":json.dumps(value["result"],ensure_ascii=False)}],"structuredContent":value["result"],"isError":False}
        self.receipts[receipt_key]=(fingerprint,payload)
        return result(payload, "tool_result")


def gate_detail(payload, tools, documents=()):
    try:
        call=payload["toolCall"]
        name=call["name"]
        if name=="finish":
            allowed=isinstance(call.get("args"),dict)
            return "finish",allowed,"allowed_finish" if allowed else "finish_arguments","finish"
        if name=="view_file" and documents:
            from nodia_ai_tool_gate import file_decision
            logical,allowed=file_decision(payload,list(documents))
            return logical,allowed,"allowed_attachment" if allowed else "unregistered_native","attachment"
        if name=="call_mcp_tool":
            args=call["args"]
            if not isinstance(args,dict): return "other",False,"dispatcher_envelope","dispatcher"
            if set(args)-{"ServerName","ToolName","Arguments","toolAction","toolSummary"}:return "other",False,"dispatcher_extra_fields","dispatcher"
            if args.get("ServerName")!="nodia_runtime":return "other",False,"foreign_server","dispatcher"
            if args.get("ToolName") not in tools:return "other",False,"unregistered_tool","dispatcher"
            value=args.get("Arguments")
            if not isinstance(value,(str,dict)):return "other",False,"arguments_type","dispatcher"
            try:
                raw=value.encode() if isinstance(value,str) else json.dumps(value,ensure_ascii=False,allow_nan=False).encode()
                arguments=bounded_json(raw)
            except (ValueError,UnicodeError,TypeError,OverflowError,RecursionError):return "other",False,"arguments_json","dispatcher"
            if not isinstance(arguments,dict):return "other",False,"arguments_shape","dispatcher"
            return args["ToolName"],True,"allowed_registered","dispatcher"
        aliases={alias:tool for tool in tools for alias in (tool,"mcp_nodia_runtime_"+tool,"mcp_nodia_runtime__"+tool)}
        if name not in aliases:return "other",False,"unregistered_native","other"
        if not isinstance(call.get("args"),dict):return "other",False,"arguments_type","registered"
        return aliases[name],True,"allowed_registered","registered"
    except (ValueError,KeyError,TypeError,AttributeError):
        return "other",False,"payload_shape","other"


def gate(payload, tools):
    name,allowed,_,_=gate_detail(payload,tools)
    return name,allowed


def main():
    # JSON-RPC is UTF-8 on every host; Windows redirected stdout otherwise uses
    # the locale codepage and corrupts non-ASCII catalog descriptions.
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv)==4 and sys.argv[1]=="gate":
        allowed=False
        name="other"
        category="invalid_json"
        call_kind="other"
        try:
            manifest=read_manifest(Path(sys.argv[2]))
            name,allowed,category,call_kind=gate_detail(bounded_json(sys.stdin.buffer.read(MAX_BYTES+1)),{tool["name"] for tool in manifest["tools"]},manifest.get("documents",[]))
            with Path(sys.argv[3]).open("a",encoding="utf-8") as output:
                output.write(json.dumps({"tool":name,"allowed":allowed})+"\n")
        except (ValueError,OSError): pass
        try:
            # Structural categories only. The proof receipt keeps its exact two-field contract.
            with Path(sys.argv[3]).with_name("gate-diagnostic.jsonl").open("a",encoding="utf-8") as output:
                output.write(json.dumps({"category":category,"call_kind":call_kind})+"\n")
        except OSError:pass
        print(json.dumps({"decision":"allow" if allowed else "deny","reason":"Only registered Nodia MCP calls and finish are allowed."}))
        return 0
    if len(sys.argv)!=2: return 2
    try:
        bridge=StdioBridge(Path(sys.argv[1]))
        while raw:=sys.stdin.buffer.readline(MAX_BYTES+1):
            reply=bridge.handle(bounded_json(raw))
            if reply is not None:
                bridge.write_reply(reply, sys.stdout.buffer)
        return 0
    except (ValueError,OSError,KeyError,TypeError):
        return 2


if __name__=="__main__":
    sys.exit(main())
