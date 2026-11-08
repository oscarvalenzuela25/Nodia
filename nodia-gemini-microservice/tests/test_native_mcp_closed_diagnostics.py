"""Atomic production diagnostics; stdlib-only, no app/provider imports."""
import ast
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch


SERVICE = Path(os.environ.get("C03_MCP_SERVICE_ROOT", Path(__file__).resolve().parents[1]))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


stdio = load("closed_diagnostic_stdio", SERVICE / "native_mcp_stdio.py")
progress = load("closed_diagnostic_progress", SERVICE / "agentic_progress.py")
# Exercise the real atomic parser/observer without importing the app or SDK.
tree = ast.parse((SERVICE / "native_mcp_sessions.py").read_text(encoding="utf-8"))
selected = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))
    and node.name in ("capture_rpc_diagnostic", "capture_closed_rpc_diagnostic", "McpTrace")]
scope = {"Path": Path, "json": json, "NativeFileCliProgress": progress.NativeFileCliProgress,
    "bounded_json": stdio.bounded_json, "CLOSED_RPC_METHODS": stdio.CLOSED_RPC_METHODS,
    "CLOSED_RPC_REASONS": stdio.CLOSED_RPC_REASONS,
    "MAX_CONTROLLED_CONTEXT_BYTES": stdio.MAX_CONTROLLED_CONTEXT_BYTES}
exec(compile(ast.Module(body=selected, type_ignores=[]), str(SERVICE / "native_mcp_sessions.py"), "exec"), scope)
capture = scope["capture_rpc_diagnostic"]
capture_closed = scope["capture_closed_rpc_diagnostic"]
McpTrace = scope["McpTrace"]


def rpc(method, identity=1, params=None):
    result = {"jsonrpc": "2.0", "method": method}
    if identity is not None:
        result["id"] = identity
    if params is not None:
        result["params"] = params
    return result


class ClosedRpcTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        (self.root / "requests").mkdir()
        (self.root / "responses").mkdir()
        self.manifest = self.root / "manifest.json"
        stdio.atomic(self.manifest, {"tools": [{"name": "fixture_read", "description": "Synthetic only",
            "input_schema": {"type": "object", "properties": {}}}], "rpc_budget": 128,
            "tool_budget": 12, "timeout_seconds": 1, "cli_json_string_arguments": True,
            "context_budget": {"schema_version": 1, "initial_utf8_bytes": 0, "maximum_utf8_bytes": 262144}})
        self.bridge = stdio.StdioBridge(self.manifest)

    def handle(self, request, output=None):
        reply = self.bridge.handle(request)
        if reply is not None and output is not None:
            self.bridge.write_reply(reply, output)
        return reply

    def ready(self):
        self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}))
        self.handle(rpc("notifications/initialized", None))

    def last(self):
        return capture(self.root)["closed_observation"]["sequence"][-1]

    def test_same_legacy_summary_distinguishes_method_and_order(self):
        self.ready()
        self.handle(rpc("resources/list")); self.handle(rpc("tools/list"))
        self.handle(rpc("notifications/progress", None)); self.handle(rpc("notifications/cancelled", None))
        first = capture(self.root)
        self.assertEqual(first["methods"], {"initialize": 1, "notifications_initialized": 1,
            "tools_list": 1, "tools_call": 0, "ping": 0, "other": 3})
        self.assertEqual(first["responses"], {"success": 2, "error": 1, "notification": 3, "unknown": 0})
        sequence = first["closed_observation"]["sequence"]
        self.assertEqual((sequence[2]["ordinal"], sequence[2]["method"], sequence[2]["reason"], sequence[2]["error_code"]),
            (3, "resources_list", "unsupported_method", -32602))
        # Opposite ordering/method retains the same aggregate, distinguishable v1 sidecar.
        second = Path(self.enterContext(tempfile.TemporaryDirectory()))
        (second / "requests").mkdir(); (second / "responses").mkdir()
        manifest = second / "manifest.json"; manifest.write_bytes(self.manifest.read_bytes())
        bridge = stdio.StdioBridge(manifest)
        for request in [rpc("initialize", params={"protocolVersion": "2025-11-25"}), rpc("notifications/initialized", None),
                rpc("tools/list"), rpc("prompts/list"), rpc("notifications/progress", None), rpc("notifications/cancelled", None)]:
            bridge.handle(request)
        other = capture(second)
        for key in ("methods", "responses", "last_response"):
            self.assertEqual(first[key], other[key])
        self.assertEqual(other["closed_observation"]["sequence"][3]["method"], "prompts_list")

    def test_rejection_reasons_preserve_distinct_wire_codes(self):
        self.assertEqual(self.handle(rpc("tools/list"))["error"]["code"], -32000)
        self.assertEqual(self.last()["reason"], "pre_ready")
        self.ready()
        self.assertEqual(self.handle(rpc("untrusted-free-method"))["error"]["code"], -32602)
        self.assertEqual(self.last()["reason"], "unsupported_method")
        self.assertEqual(self.handle(rpc("tools/call", params={}))["error"]["code"], -32602)
        self.assertEqual(self.last()["reason"], "invalid_tool_params")
        self.assertEqual(self.handle({"jsonrpc": "bad", "method": "tools/list"})["error"]["code"], -32600)
        self.assertEqual(self.last()["reason"], "envelope")

    def test_constructed_write_flush_are_separate_and_wire_unchanged(self):
        reply = self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}))
        self.assertEqual([self.last()[key] for key in ("constructed", "write_completed", "flush_completed")], [True, False, False])
        output = io.BytesIO(); self.bridge.write_reply(reply, output)
        self.assertEqual(output.getvalue(), stdio.wire_reply_bytes(reply))
        self.assertEqual([self.last()[key] for key in ("constructed", "write_completed", "flush_completed")], [True, True, True])
        self.assertEqual(self.last()["response_utf8_bytes"], len(output.getvalue()))
        self.assertEqual(capture_closed(self.root)["scope"], "flush_completed_not_cli_consumption")

    def test_broken_pipe_preserves_constructed_without_delivery(self):
        reply = self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}))
        output = types.SimpleNamespace(write=lambda raw: (_ for _ in ()).throw(BrokenPipeError()),
            flush=lambda: self.fail("flush after failed write"))
        with self.assertRaises(BrokenPipeError): self.bridge.write_reply(reply, output)
        self.assertTrue(self.last()["constructed"])
        self.assertFalse(self.last()["write_completed"]); self.assertFalse(self.last()["flush_completed"])

    def test_protocol_write_flush_complete_before_any_diagnostic_publication(self):
        reply = self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}))
        order = []
        original = self.bridge._record_closed
        def publish(**values):
            order.append("publish")
            return original(**values)
        output = types.SimpleNamespace(write=lambda raw: order.append("write") or len(raw),
            flush=lambda: order.append("flush"))
        with patch.object(self.bridge, "_record_closed", side_effect=publish):
            self.bridge.write_reply(reply, output)
        self.assertEqual(order, ["write", "flush", "publish"])

    def test_diagnostic_exception_preserves_original_transport_exception_and_success(self):
        reply = self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}))
        original = BrokenPipeError("synthetic transport")
        output = types.SimpleNamespace(write=lambda raw: (_ for _ in ()).throw(original), flush=lambda: None)
        with patch.object(self.bridge, "_record_closed", side_effect=RuntimeError("synthetic diagnostic")):
            with self.assertRaises(BrokenPipeError) as caught: self.bridge.write_reply(reply, output)
            self.assertIs(caught.exception, original)
            success = io.BytesIO(); self.bridge.write_reply(reply, success)
            self.assertEqual(success.getvalue(), stdio.wire_reply_bytes(reply))

    def test_flush_failure_and_short_write_do_not_claim_full_delivery(self):
        reply = self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}))
        output = types.SimpleNamespace(write=lambda raw: len(raw), flush=lambda: (_ for _ in ()).throw(OSError()))
        with self.assertRaises(OSError): self.bridge.write_reply(reply, output)
        self.assertTrue(self.last()["write_completed"]); self.assertFalse(self.last()["flush_completed"])
        # A short write keeps the original behavior (no added retry).
        self.bridge.write_reply(reply, types.SimpleNamespace(write=lambda raw: 1, flush=lambda: None))
        self.assertFalse(self.last()["write_completed"]); self.assertTrue(self.last()["flush_completed"])

    def test_sidecar_failure_cannot_change_reply_or_write_flush(self):
        original = stdio.atomic
        def fail_diagnostics(path, value, **options):
            if path.parent.name == "rpc-diagnostics": raise OSError("synthetic secret failure")
            return original(path, value, **options)
        with patch.object(stdio, "atomic", side_effect=fail_diagnostics):
            output = io.BytesIO()
            reply = self.handle(rpc("initialize", params={"protocolVersion": "2025-11-25"}), output)
            self.assertEqual(output.getvalue(), stdio.wire_reply_bytes(reply))
            self.assertIn("result", reply)
        self.assertEqual(capture(self.root)["closed_observation"]["state"], "missing")

    def test_closed_allowlist_never_exports_free_values_or_tampered_data(self):
        secret = "synthetic-secret-method-id-and-params"
        self.handle(rpc(secret, secret, {secret: secret}))
        summary = capture(self.root)
        self.assertNotIn(secret, json.dumps(summary))
        self.assertEqual(self.last()["method"], "other")
        path = self.root / "rpc-diagnostics" / "0001.json"
        value = json.loads(path.read_bytes()); value["reason"] = secret
        stdio.atomic(path, value)
        summary = capture(self.root)
        self.assertEqual(summary["closed_observation"]["state"], "partial")
        self.assertNotIn(secret, json.dumps(summary))

    def test_valid_callback_pending_does_not_claim_invalid_arguments(self):
        self.ready()
        original = stdio.atomic
        pending = []
        def respond(path, value, **options):
            original(path, value, **options)
            if value.get("kind") == "tool_request":
                pending.append(self.last())
                original(self.root / "responses" / (value["call_id"] + ".json"), {"result": {"synthetic": True}})
        with patch.object(stdio, "atomic", side_effect=respond):
            reply = self.handle(rpc("tools/call", 3, {"name": "fixture_read", "arguments": {}}))
        self.assertEqual(pending[0]["reason"], "unknown")
        self.assertEqual(pending[0]["response"], "unknown")
        self.assertFalse(pending[0]["constructed"])
        self.assertIn("result", reply)
        self.assertEqual(self.last()["reason"], "tool_result")

    def test_valid_callback_deadline_does_not_claim_invalid_arguments(self):
        self.ready()
        with patch.object(stdio.time, "monotonic", return_value=self.bridge.deadline + 1):
            with self.assertRaisesRegex(ValueError, "Callback deadline"):
                self.handle(rpc("tools/call", 3, {"name": "fixture_read", "arguments": {}}))
        self.assertEqual(self.last()["reason"], "unknown")
        self.assertEqual(self.last()["response"], "unknown")
        self.assertFalse(self.last()["constructed"])

    def test_missing_oversize_and_ordinal_gaps_stay_unknown(self):
        self.ready(); (self.root / "rpc-diagnostics" / "0001.json").unlink()
        summary = capture(self.root)["closed_observation"]
        self.assertEqual(summary["state"], "partial")
        self.assertGreater(summary["unknown_events"], 0)
        (self.root / "rpc-diagnostics" / "0002.json").write_bytes(b"x" * 2049)
        self.assertEqual(capture_closed(self.root)["state"], "partial")
        for index in range(3, 131): (self.root / "rpc-diagnostics" / (str(index).zfill(4) + ".json")).write_bytes(b"{}")
        self.assertEqual(capture_closed(self.root)["state"], "oversize")

    def test_128_sidecars_remain_bounded_and_do_not_expand_rpc_budget(self):
        for _ in range(128): self.handle(rpc("notifications/progress", None))
        value = capture(self.root)
        self.assertEqual(len(value["closed_observation"]["sequence"]), 128)
        self.assertLess(len(json.dumps(value).encode()), 65536)
        with self.assertRaises(ValueError): self.handle(rpc("ping"))


class InitIdentityTests(unittest.TestCase):
    def trace(self):
        trace = McpTrace(); trace.expect_identity("synthetic-agent", "synthetic-model")
        return trace

    def feed(self, trace, value):
        trace.feed((json.dumps(value) + "\n").encode())
        return trace.diagnostic()["init_identity"]

    def test_absent_init_is_unknown(self):
        self.assertEqual(self.trace().diagnostic()["init_identity"],
            {"init_count": 0, "agent_matches": None, "model_matches": None})

    def test_init_received_before_terminal_compares_without_exporting_names(self):
        trace = self.trace()
        raw = (json.dumps({"event": "init", "init": {"agent": "synthetic-agent", "model": "synthetic-model"}}) + "\n").encode()
        trace.feed(raw[:12]); self.assertEqual(trace.init_count, 0)
        trace.feed(raw[12:])
        self.assertEqual(trace.diagnostic()["init_identity"], {"init_count": 1, "agent_matches": True, "model_matches": True})
        self.assertFalse(trace.result_seen)
        self.assertNotIn("synthetic-", json.dumps(trace.diagnostic()))

    def test_malformed_missing_or_foreign_identity_is_never_matching(self):
        for identity, expected in [(None, (None, None)), ({}, (None, None)),
                ({"agent": [], "model": 1}, (None, None)),
                ({"agent": "foreign", "model": "synthetic-model"}, (False, True)),
                ({"agent": "synthetic-agent", "model": "foreign"}, (True, False))]:
            with self.subTest(identity=identity):
                value = self.feed(self.trace(), {"event": "init", "init": identity})
                self.assertEqual((value["agent_matches"], value["model_matches"]), expected)

    def test_duplicate_init_cannot_claim_unique_matching_identity(self):
        trace = self.trace(); event = {"event": "init", "init": {"agent": "synthetic-agent", "model": "synthetic-model"}}
        self.feed(trace, event); value = self.feed(trace, event)
        self.assertEqual(value, {"init_count": 2, "agent_matches": None, "model_matches": None})
        value = self.feed(trace, {"event": "init", "init": {"agent": "foreign", "model": "foreign"}})
        self.assertEqual(value, {"init_count": 3, "agent_matches": False, "model_matches": False})

    def test_malformed_json_and_missing_expected_identity_stay_unknown(self):
        trace = self.trace(); trace.feed(b'{invalid\n')
        self.assertEqual(trace.init_count, 0)
        value = self.feed(McpTrace(), {"event": "init", "init": {"agent": "untrusted", "model": "untrusted"}})
        self.assertEqual(value, {"init_count": 1, "agent_matches": None, "model_matches": None})

    def test_init_diagnostic_failure_does_not_change_progress_or_raise(self):
        trace = self.trace()
        with patch.object(trace, "_observe_init", side_effect=RuntimeError("synthetic private failure")):
            self.feed(trace, {"event": "init", "init": {"agent": "synthetic-agent", "model": "synthetic-model"}})
        self.assertTrue(trace.initialized)
        self.assertEqual(trace.events, 1)


if __name__ == "__main__":
    unittest.main()
