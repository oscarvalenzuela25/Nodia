"""Cumulative initial-prompt plus exact MCP stdout budget, with no provider calls."""
import test_support
import json
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from native_mcp_stdio import (StdioBridge, atomic, wire_reply_bytes, bounded_json, check_context_budget,
    MAX_CONTROLLED_CONTEXT_BYTES, MAX_RPC_ID_UTF8_BYTES, read_manifest)
from native_context_budget import ContextMeasureRequest, McpTool, measure_context

TOOLS = [{"name": "fixture_read", "description": "Synthetic ñ read", "input_schema": {"type": "object", "additionalProperties": False}}]
INITIALIZE = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-11-25"}}
READY = {"jsonrpc": "2.0", "method": "notifications/initialized"}


class NativeContextLedgerTests(unittest.TestCase):
    def fixture(self, initial=0, tools=None):
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        (root / "requests").mkdir(); (root / "responses").mkdir()
        manifest = root / "manifest.json"
        atomic(manifest, {"tools": tools or TOOLS, "rpc_budget": 128, "tool_budget": 12,
            "timeout_seconds": 4, "cli_json_string_arguments": True,
            "context_budget": {"schema_version": 1, "initial_utf8_bytes": initial,
                "maximum_utf8_bytes": MAX_CONTROLLED_CONTEXT_BYTES}}, max_bytes=135168)
        return root, manifest

    def test_all_complete_replies_count_utf8_escaping_catalog_and_replays_without_repeating_callback(self):
        root, manifest = self.fixture(initial=1000)
        bridge = StdioBridge(manifest)
        replies = [bridge.handle(INITIALIZE)]
        self.assertIsNone(bridge.handle(READY))
        replies.append(bridge.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}))
        replies.append(bridge.handle({"jsonrpc": "2.0", "id": 3, "method": "unregistered_method"}))
        payload = {"text": 'ñ"\\\n' * 100}
        callbacks = []
        def published(file, value, **options):
            atomic(file, value, **options)
            if value.get("kind") == "tool_request":
                callbacks.append(value["call_id"])
                atomic(root / "responses" / (value["call_id"] + ".json"), {"result": payload})
        call = {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "fixture_read", "arguments": {}}}
        with patch("native_mcp_stdio.atomic", side_effect=published):
            replies.append(bridge.handle(call)); replies.append(bridge.handle(call))
        state = bounded_json((root / "context-budget.json").read_bytes())
        self.assertEqual(state["used_utf8_bytes"], 1000 + sum(len(wire_reply_bytes(reply)) for reply in replies))
        self.assertGreater(len(wire_reply_bytes(replies[-1])), len(json.dumps(payload, ensure_ascii=False).encode()) * 2)
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(replies[-1], replies[-2])
        check_context_budget(root, final=True)

    def test_exact_boundary_returns_whole_reply_then_blocks_the_next_reply_without_partial_delivery(self):
        _root, baseline = self.fixture()
        baseline_reply = StdioBridge(baseline).handle(INITIALIZE)
        cost = len(wire_reply_bytes(baseline_reply))
        root, manifest = self.fixture(initial=MAX_CONTROLLED_CONTEXT_BYTES - cost)
        bridge = StdioBridge(manifest)
        self.assertEqual(bridge.handle(INITIALIZE), baseline_reply)
        self.assertIsNone(bridge.handle(READY))
        with self.assertRaisesRegex(ValueError, "context budget exhausted"):
            bridge.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        self.assertEqual(bounded_json((root / "context-budget.json").read_bytes())["used_utf8_bytes"], MAX_CONTROLLED_CONTEXT_BYTES)
        with self.assertRaises(ValueError): check_context_budget(root, final=True)

    def test_actual_stdio_process_never_writes_an_over_budget_catalog_response(self):
        _root, baseline = self.fixture()
        cost = len(wire_reply_bytes(StdioBridge(baseline).handle(INITIALIZE)))
        root, manifest = self.fixture(initial=MAX_CONTROLLED_CONTEXT_BYTES - cost)
        commands = [INITIALIZE, READY, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}]
        result = subprocess.run([sys.executable, str(Path(__file__).parents[1] / "native_mcp_stdio.py"), str(manifest)],
            input=("\n".join(json.dumps(item) for item in commands) + "\n").encode(), capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(len(result.stdout), cost)
        self.assertEqual(len(result.stdout.splitlines()), 1)
        self.assertTrue((root / "context-budget-failed.json").exists())

    def test_callback_result_survives_budget_rejection_and_is_not_reinvoked(self):
        root, manifest = self.fixture()
        bridge = StdioBridge(manifest); bridge.handle(INITIALIZE); bridge.handle(READY)
        # Reserve all remaining bytes as already delivered context. This is a
        # synthetic native boundary, independent from the callback's SQL receipt.
        bridge.context_used = MAX_CONTROLLED_CONTEXT_BYTES - 10
        bridge._persist_context()
        delivered = []
        def published(file, value, **options):
            atomic(file, value, **options)
            if value.get("kind") == "tool_request":
                delivered.append(value["call_id"])
                atomic(root / "responses" / (value["call_id"] + ".json"), {"result": {"read_receipt": "synthetic"}})
        call = {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "fixture_read", "arguments": {}}}
        with patch("native_mcp_stdio.atomic", side_effect=published), self.assertRaises(ValueError): bridge.handle(call)
        self.assertEqual(len(delivered), 1)
        self.assertEqual(bounded_json((root / "responses" / (delivered[0] + ".json")).read_bytes()), {"result": {"read_receipt": "synthetic"}})
        with self.assertRaises(ValueError): bridge.handle(call)
        self.assertEqual(len(delivered), 1)

    def test_concurrent_bridge_or_respawn_cannot_reset_the_durable_budget(self):
        root, manifest = self.fixture(initial=500)
        def attempt():
            try: return StdioBridge(manifest)
            except ValueError: return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            values = list(pool.map(lambda _: attempt(), range(2)))
        self.assertEqual(sum(value is not None for value in values), 1)
        with self.assertRaises(ValueError): check_context_budget(root, final=True)
        with self.assertRaises(ValueError): next(value for value in values if value).handle(INITIALIZE)

    def test_missing_or_invalid_budget_is_never_replaced_with_an_unbounded_default(self):
        root, manifest = self.fixture()
        source = bounded_json(manifest.read_bytes())
        for budget in (None, {}, {"schema_version": 1, "initial_utf8_bytes": -1, "maximum_utf8_bytes": 262144},
                       {"schema_version": 1, "initial_utf8_bytes": True, "maximum_utf8_bytes": 262144}):
            value = {**source, "context_budget": budget}
            atomic(manifest, value)
            with self.assertRaisesRegex(ValueError, "context budget required"): read_manifest(manifest)
        self.assertFalse((root / "context-budget-owner.claim").exists())

    def test_rpc_identity_is_bounded_before_escaping_and_known_listing_bound_covers_it(self):
        root, manifest = self.fixture(); bridge = StdioBridge(manifest)
        bridge.handle(INITIALIZE); bridge.handle(READY)
        measured = measure_context("agentic", ContextMeasureRequest(model_id="configured-model", effort_id=None,
            canonical_prompt="Synthetic", tools=[McpTool.model_validate(TOOLS[0])]), {})
        listed = bridge.handle({"jsonrpc": "2.0", "id": "\0" * MAX_RPC_ID_UTF8_BYTES, "method": "tools/list"})
        self.assertEqual(len(wire_reply_bytes(listed)), measured.first_mcp_listing_upper_bound_utf8_bytes)
        for identity in ("ñ" * 257, 9007199254740992):
            rejected = bridge.handle({"jsonrpc": "2.0", "id": identity, "method": "ping"})
            self.assertEqual(rejected["id"], None)
            self.assertEqual(rejected["error"]["code"], -32600)

    def test_actual_74_tool_fixture_bootstrap_and_one_small_response_fit_or_fail_explicitly(self):
        tools = json.loads((Path(__file__).parent / "fixtures/nodia-ai-ai31-mcp-tools.json").read_text(encoding="utf-8"))
        self.assertEqual(len(tools), 74)
        source = ContextMeasureRequest(model_id="configured-model", effort_id=None, canonical_prompt="Synthetic",
            tools=[McpTool.model_validate(item) for item in tools])
        measured = measure_context("agentic", source, {})
        self.assertLessEqual(measured.total_utf8_bytes + measured.first_mcp_listing_upper_bound_utf8_bytes, measured.max_utf8_bytes)
        root, manifest = self.fixture(initial=measured.total_utf8_bytes, tools=tools)
        bridge = StdioBridge(manifest); bridge.handle(INITIALIZE); bridge.handle(READY)
        bridge.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        def published(file, value, **options):
            atomic(file, value, **options)
            if value.get("kind") == "tool_request":
                atomic(root / "responses" / (value["call_id"] + ".json"), {"result": {"synthetic": True}})
        with patch("native_mcp_stdio.atomic", side_effect=published):
            reply = bridge.handle({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                "params": {"name": tools[-1]["name"], "arguments": {}}})
        self.assertTrue(reply["result"]["structuredContent"]["synthetic"])
        check_context_budget(root, final=True)
