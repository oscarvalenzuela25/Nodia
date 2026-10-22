"""AI-03 synthetic MCP/CLI-hook boundary tests, no external services."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from experiments.nodia_ai_mcp_fixture import FixtureMcp, NATIVE_NAMES, gate, parse_json


def rpc(method, params=None, identity=1):
    return {"jsonrpc": "2.0", "id": identity, "method": method, "params": params or {}}


READ = {"property_id": "fixture-house", "start_date": "2026-11-10", "end_date": "2026-11-12"}
PREPARE = {"name": "Comida", "amount": "20000", "category_id": "fixture-food", "status": "paid"}


class McpFixtureTests(unittest.TestCase):
    def ready(self, *, cli_json_string_arguments=False):
        server = FixtureMcp("synthetic-run", "SYNTHETIC_MARKER", cli_json_string_arguments=cli_json_string_arguments)
        response = server.handle(rpc("initialize", {"protocolVersion": "2025-11-25", "capabilities": {},
            "clientInfo": {"name": "fixture", "version": "1"}}))
        self.assertEqual(response["result"]["protocolVersion"], "2025-11-25")
        server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return server

    def test_tool_call_before_handshake_rejected(self):
        server = FixtureMcp("synthetic-run", "SYNTHETIC")
        self.assertIn("error", server.handle(rpc("tools/call", {"name": "fixture_availability_read", "arguments": READ})))
        self.assertEqual(server.calls, 0)

    def test_catalog_exposes_only_read_and_prepare(self):
        tools = self.ready().handle(rpc("tools/list"))["result"]["tools"]
        self.assertEqual({t["name"] for t in tools}, {"fixture_availability_read", "fixture_expense_prepare"})
        self.assertTrue(all(t["inputSchema"]["additionalProperties"] is False for t in tools))

    def test_read_result_bound_to_trusted_run(self):
        server = self.ready()
        value = server.handle(rpc("tools/call", {"name": "fixture_availability_read", "arguments": READ}))["result"]
        self.assertEqual(value["structuredContent"]["marker"], "SYNTHETIC_MARKER")
        self.assertTrue(value["structuredContent"]["available"])
        self.assertTrue(all(r["run_id"] == "synthetic-run" for r in server.audit))

    def test_prepare_is_not_execution_or_confirmation(self):
        value = self.ready().handle(rpc("tools/call", {"name": "fixture_expense_prepare", "arguments": PREPARE}))["result"]
        self.assertIs(value["structuredContent"]["executed"], False)
        self.assertEqual(value["structuredContent"]["state"], "awaiting_human_confirmation")
        self.assertNotIn("approval_token", json.dumps(value))

    def test_unknown_confirmation_sql_and_http_rejected(self):
        server = self.ready()
        for name in ("confirm", "sql", "http", "execute", "fixture_expense_confirm"):
            with self.subTest(name=name):
                self.assertIn("error", server.handle(rpc("tools/call", {"name": name, "arguments": PREPARE})))
        self.assertEqual(server.calls, 0)

    def test_scope_identity_command_overrides_rejected(self):
        for key in ("actor_id", "run_id", "connection_id", "sql", "approval_token", "endpoint"):
            server = self.ready()
            with self.subTest(key=key):
                self.assertIn("error", server.handle(rpc("tools/call", {
                    "name": "fixture_expense_prepare", "arguments": {**PREPARE, key: "untrusted"}})))
                self.assertEqual(server.calls, 0)

    def test_missing_status_and_invalid_money_rejected(self):
        for amount in (True, 20000, "20.5", "0", "-1"):
            with self.subTest(amount=amount):
                self.assertIn("error", self.ready().handle(rpc("tools/call", {
                    "name": "fixture_expense_prepare", "arguments": {**PREPARE, "amount": amount}})))
        args = dict(PREPARE)
        del args["status"]
        self.assertIn("error", self.ready().handle(rpc("tools/call", {"name": "fixture_expense_prepare", "arguments": args})))

    def test_reused_rpc_id_different_intent_does_not_dispatch(self):
        server = self.ready()
        first = server.handle(rpc("tools/call", {"name": "fixture_expense_prepare", "arguments": PREPARE}))
        self.assertIn("result", first)
        changed = server.handle(rpc("tools/call", {"name": "fixture_expense_prepare", "arguments": {**PREPARE, "amount": "21000"}}))
        self.assertIn("error", changed)
        self.assertEqual(len(server.gateway.receipts), 1)

    def test_callback_budget_bounded(self):
        server = self.ready()
        for identity in range(12):
            self.assertIn("result", server.handle(rpc("tools/call", {
                "name": "fixture_availability_read", "arguments": READ}, identity)))
        self.assertIn("error", server.handle(rpc("tools/call", {
            "name": "fixture_availability_read", "arguments": READ}, 13)))

    def test_rpc_malformed_name_and_privileged_methods_rejected(self):
        server = self.ready()
        for name in ([], {}, None, 3):
            with self.subTest(name=name):
                self.assertIn("error", server.handle(rpc("tools/call", {"name": name, "arguments": READ})))
        for method in ("resources/read", "prompts/get", "command", "confirm"):
            self.assertEqual(server.handle(rpc(method))["error"]["code"], -32601)

    def test_json_duplicate_nonfinite_excessive_and_recursive_rejected(self):
        for raw in (b'{"id":1,"id":2}', b'{"x":NaN}', b'[' * 4000 + b'0' + b']' * 4000, b'x' * 65537):
            with self.subTest(length=len(raw)), self.assertRaises(ValueError):
                parse_json(raw)

    def test_hook_all_registered_encodings_validate_arguments(self):
        for name, tool in NATIVE_NAMES.items():
            args = READ if tool.endswith("read") else PREPARE
            with self.subTest(name=name):
                self.assertTrue(gate({"toolCall": {"name": name, "args": args}})[1])
                self.assertFalse(gate({"toolCall": {"name": name, "args": {**args, "endpoint": "untrusted"}}})[1])

    def test_hook_blocks_builtin_io_browser_subagents_and_confirmation(self):
        for tool in ("view_file", "run_command", "write_to_file", "read_url", "browser", "task", "confirm", "mcp_other_read"):
            with self.subTest(tool=tool):
                self.assertFalse(gate({"toolCall": {"name": tool, "args": {}}})[1])
        self.assertTrue(gate({"toolCall": {"name": "finish", "args": {"answer": "synthetic"}}})[1])

    def test_native_dispatcher_validates_server_tool_and_inner_schema(self):
        envelope = {"ServerName": "nodia_fixture", "ToolName": "fixture_availability_read", "Arguments": json.dumps(READ)}
        payload = lambda args: {"toolCall": {"name": "call_mcp_tool", "args": args}}
        self.assertEqual(gate(payload(envelope)), ("fixture_availability_read", True))
        self.assertTrue(gate(payload({**envelope, "toolAction": "read", "toolSummary": "synthetic"}))[1])
        for key, value in (("ServerName", "other"), ("ToolName", "confirm"), ("Arguments", READ),
                           ("Arguments", '{"property_id":"fixture-house","property_id":"other"}'),
                           ("Arguments", json.dumps({**READ, "actor_id": "other"})),
                           ("Arguments", json.dumps({"house": "fixture-house", "start_date": READ["start_date"], "end_date": READ["end_date"]})),
                           ("permissionOverrides", ["mcp(*)"]), ("toolSummary", "x" * 1025)):
            with self.subTest(key=key, value_type=type(value).__name__):
                self.assertFalse(gate(payload({**envelope, key: value}))[1])

    def test_cli_wire_compatibility_is_explicit_and_preserves_closed_inner_schema(self):
        request = lambda args: rpc("tools/call", {"name": "fixture_availability_read", "arguments": args})
        self.assertIn("error", self.ready().handle(request(json.dumps(READ))))
        compatible = self.ready(cli_json_string_arguments=True)
        self.assertIn("result", compatible.handle(request(json.dumps(READ))))
        self.assertEqual(compatible.calls, 1)
        self.assertEqual(sum(r["event"] == "cli_arguments_normalized" for r in compatible.audit), 1)
        for args in ('{"property_id":"fixture-house","property_id":"other"}', json.dumps({**READ, "actor_id": "other"}),
                     json.dumps(json.dumps(READ)), "x" * 65537, "{bad-json}", '{"amount":NaN}'):
            with self.subTest(length=len(args)):
                server = self.ready(cli_json_string_arguments=True)
                self.assertIn("error", server.handle(request(args)))
                self.assertEqual(server.calls, 0)

    def test_rpc_audit_does_not_export_invalid_arguments_and_budget_stops_dispatch(self):
        server = self.ready()
        server.handle(rpc("tools/call", {"name": "fixture_availability_read", "arguments": "secret-token"}))
        self.assertNotIn("secret-token", json.dumps(server.audit))
        for _ in range(130):
            server.handle(rpc("ping"))
        self.assertIn("error", server.handle(rpc("tools/call", {"name": "fixture_availability_read", "arguments": READ})))
        self.assertEqual(server.calls, 0)

    def test_stdio_transport_runs_real_fixture_process_and_closes(self):
        with tempfile.TemporaryDirectory() as directory:
            audit = Path(directory) / "audit.jsonl"
            messages = [rpc("initialize", {"protocolVersion": "2025-11-25"}),
                        {"jsonrpc": "2.0", "method": "notifications/initialized"}, rpc("tools/list", identity=2),
                        rpc("tools/call", {"name": "fixture_availability_read", "arguments": READ}, 3)]
            result = subprocess.run([sys.executable, "-m", "experiments.nodia_ai_mcp_fixture", str(audit),
                "synthetic-run", "SYNTHETIC"], input="\n".join(json.dumps(m) for m in messages) + "\n",
                text=True, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 0)
            replies = [json.loads(line) for line in result.stdout.splitlines()]
            self.assertEqual(len(replies), 3)
            self.assertEqual(replies[-1]["result"]["structuredContent"]["marker"], "SYNTHETIC")
            self.assertEqual(json.loads(audit.read_text().splitlines()[-1])["run_id"], "synthetic-run")
