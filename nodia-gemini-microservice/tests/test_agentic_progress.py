import test_support
import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path

from agentic_cli import CliConfig, CliRunner
from agentic_progress import CliProgress
from service_errors import ServiceError


class AgenticProgressTest(unittest.IsolatedAsyncioTestCase):
    def test_fragmented_progress_preserves_read_and_result_without_private_data(self):
        progress = CliProgress()
        raw = b"\n".join(json.dumps(event).encode() for event in [
            {"event": "init", "init": {"cwd": "PRIVATE_PATH", "token": "PRIVATE_TOKEN"}},
            {"event": "step_update", "step_update": {"tool_name": "view_file", "state": "DONE",
                                                     "tool_info": {"output": "PRIVATE_INVOICE"}}},
            {"event": "step_update", "step_update": {"step_type": "agent_response", "text_delta": "PRIVATE_INVOICE"}},
            {"event": "result", "result": {"status": "SUCCESS", "response": "PRIVATE_INVOICE"}},
        ]) + b"\n"
        for index in range(0, len(raw), 7):
            progress.feed(raw[index:index + 7])
        summary = progress.summary()
        self.assertTrue(summary["document_read_completed"])
        self.assertTrue(summary["result_seen"])
        self.assertEqual(summary["stage"], "result")
        self.assertEqual(summary["events"], 4)
        self.assertNotIn("PRIVATE_", json.dumps(summary))

    def test_missing_and_malformed_events_do_not_invent_progress_or_fail_inference(self):
        progress = CliProgress()
        self.assertIsNone(progress.summary()["last_event_age_ms"])
        for line in (b"[]", b"null", b"not-json", b'\xff', b'{"event":"PRIVATE_DATA"}',
                     b'{"event":"step_update","step_update":null}'):
            progress.feed(line + b"\n")
        self.assertFalse(progress.summary()["initialized"])
        self.assertFalse(progress.summary()["document_read_completed"])
        self.assertFalse(progress.summary()["result_seen"])
        self.assertEqual(progress.summary()["stage"], "no_event")
        self.assertEqual(progress.summary()["invalid_lines"], 6)

    def test_oversized_lines_are_discarded_and_later_events_remain_observable(self):
        progress = CliProgress()
        progress.feed(b"x" * 70_000)
        self.assertLessEqual(len(progress._pending), 65_536)
        progress.feed(b'private tail\n{"event":"init"}\n')
        self.assertTrue(progress.summary()["initialized"])
        self.assertEqual(progress.summary()["invalid_lines"], 1)
        self.assertEqual(progress.summary()["stage"], "initialized")

    async def test_real_transport_timeout_keeps_progress_and_reaps_owned_process(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = CliRunner(CliConfig(Path(sys.executable), "", Path(directory)))
            progress = CliProgress()
            code = ('import json, time; '
                    'print(json.dumps({"event":"init"}), flush=True); '
                    'print(json.dumps({"event":"step_update","step_update":'
                    '{"tool_name":"view_file","state":"DONE","text_delta":"PRIVATE_INVOICE"}}), flush=True); '
                    'time.sleep(20)')
            try:
                with self.assertRaises(ServiceError) as caught:
                    await runner.run(["-u", "-c", code], timeout=3, stdout_observer=progress.feed)
                self.assertEqual(caught.exception.code, "agentic_timeout")
                self.assertTrue(progress.summary()["document_read_completed"])
                self.assertFalse(progress.summary()["result_seen"])
                self.assertEqual(runner._processes, set())
                self.assertNotIn("PRIVATE_INVOICE", json.dumps(progress.summary()))
            finally:
                await runner.close()
