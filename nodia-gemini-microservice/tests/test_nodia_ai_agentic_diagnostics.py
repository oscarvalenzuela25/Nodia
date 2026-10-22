import json
from pathlib import Path
import tempfile
import unittest

from experiments.nodia_ai_agentic_diagnostics import SafeTrace, error_categories


class DiagnosticsTests(unittest.TestCase):
    def test_fragmented_events_keep_shape_without_sensitive_values(self):
        trace = SafeTrace()
        raw = (json.dumps({"event": "step_update", "step_update": {"step_type": "agent_response", "state": "DONE",
                    "text_delta": "secret-response", "tool_info": {"parameters": {"secret": "token"}}}}) + "\n"
               + json.dumps({"event": "result", "result": {"status": "ERROR", "response": "secret-response",
                    "error": "RESOURCE_EXHAUSTED secret-token", "num_turns": 1}}) + "\n").encode()
        for part in (raw[:20], raw[20:]):
            trace.feed(part)
        with tempfile.TemporaryDirectory() as directory:
            report = trace.diagnostic(Path(directory) / "absent")
        self.assertEqual(report["steps"], {"agent_response:DONE": 1})
        self.assertEqual(report["result_shape"]["error_categories"], ["quota"])
        self.assertNotIn("secret", json.dumps(report))
        self.assertNotIn("token", json.dumps(report))

    def test_invalid_and_oversized_events_are_bounded(self):
        trace = SafeTrace()
        trace.feed(b"x" * 70000)
        trace.feed(b"\nnot-json\n")
        self.assertEqual(trace.invalid_lines, 2)
        self.assertFalse(trace.result_seen)
        self.assertEqual(trace.steps, {})

    def test_only_closed_fixture_names_exported(self):
        trace = SafeTrace()
        trace.feed((json.dumps({"event": "init", "init": {"tools": ["account-secret", "fixture_availability_read", 1]}}) + "\n").encode())
        self.assertEqual(trace.fixture_names, ["fixture_availability_read"])

    def test_log_values_do_not_escape_and_no_inferred_quota(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cli.log"
            path.write_text("deadline_exceeded account=secret-token read-only file system")
            report = SafeTrace().diagnostic(path)
        self.assertEqual(report["log_categories"], ["timeout", "readonly"])
        self.assertNotIn("secret", json.dumps(report))
        self.assertEqual(error_categories("nothing happened"), [])

    def test_stderr_patterns_cross_chunks_without_exporting_values(self):
        trace = SafeTrace()
        trace.feed_error(b"secret-token RESOURCE_EXHAU")
        trace.feed_error(b"STED account-label")
        with tempfile.TemporaryDirectory() as directory:
            report = trace.diagnostic(Path(directory) / "absent")
        self.assertEqual(report["stderr_categories"], ["quota"])
        self.assertGreater(report["stderr_bytes"], 0)
        self.assertNotIn("secret", json.dumps(report))

    def test_tool_error_classification_does_not_export_message_or_arguments(self):
        trace = SafeTrace()
        trace.feed((json.dumps({"event": "step_update", "step_update": {"step_type": "tool", "state": "DONE",
            "tool_name": "call_mcp_tool", "tool_info": {"parameters": {"Arguments": "secret-token"},
                "error": {"type": "error", "message": "unknown tool secret-token"}}}}) + "\n").encode())
        with tempfile.TemporaryDirectory() as directory:
            report = trace.diagnostic(Path(directory) / "absent")
        self.assertEqual(report["tool_steps"][0]["error_categories"], ["mcp_lookup"])
        self.assertNotIn("secret-token", json.dumps(report))


if __name__ == "__main__":
    unittest.main()
