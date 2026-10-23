"""Offline reader regression: synthetic logs; never starts Docker or requests."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

path = Path(__file__).with_name("nodia-ai-ai38-web-stream-diag-r01.py")
spec = importlib.util.spec_from_file_location("stream_reader", path)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class ReaderTests(unittest.TestCase):
    def test_counts_reject_bool_negative_overflow_and_strings(self):
        for value in (True, -1, 2**32, "private"):
            self.assertIsNone(reader.count(value))
        self.assertEqual(reader.count(0), 0)

    def test_frames_project_only_closed_fields_and_error_categories(self):
        result = reader.snapshot({"stream_frames": {"enabled": True, "cid_present": True,
            "rid_present": False, "parts": 2, "secret-cid": "private",
            "error_categories": {"usage_limit": 1, "private": 999}}})
        self.assertEqual(result["stream_frames"]["parts"], 2)
        self.assertIs(result["stream_frames"]["rid_present"], False)
        self.assertEqual(result["stream_frames"]["error_categories"]["usage_limit"], 1)
        self.assertNotIn("private", json.dumps(result))

    def test_exact_identity_filter_and_no_private_log_output(self):
        attempt = "a160f615-ea41-4a05-831d-acdbb413ec4d"
        value = {"attempt_id": attempt, "engine": "web", "error_type": "TimeoutError",
            "phase": "generation", "private": "secret-cookie",
            "web_generation": {"stream_frames": {"frames": 2, "cid_present": False,
                "raw_payload": "private-provider-body"}, "raw_text": "private-answer"}}
        line = lambda v: b"2026-10-22T21:00:00Z nodia_ai_chat_failure " + json.dumps(v).encode()
        logs = line(value) + b"\n" + line({**value, "attempt_id": "other-private-attempt"})
        epoch = {"id": "synthetic-epoch", "image": "synthetic-image", "started_at": "synthetic-time"}
        with patch.object(reader, "epoch", return_value=epoch), patch.object(reader, "logs", return_value=logs), patch.object(reader, "run", return_value=b'{"gemini-webapi":"2.1.1","curl-cffi":"0.16.3"}'):
            result = reader.read(attempt, "2026-10-22T21:00:00Z", "2026-10-22T21:01:00Z")
        self.assertEqual(result["record_count"], 1)
        self.assertEqual(result["records"][0]["web_generation"]["stream_frames"]["frames"], 2)
        for marker in ("secret-cookie", "private-provider", "private-answer", "other-private-attempt"):
            self.assertNotIn(marker, json.dumps(result))

    def test_changed_epoch_rejects_snapshot(self):
        with patch.object(reader, "epoch", side_effect=[{"id": "before"}, {"id": "after"}]), patch.object(reader, "logs", return_value=b""):
            with self.assertRaises(AssertionError):
                reader.read("synthetic-attempt", "since", "until")


if __name__ == "__main__":
    unittest.main()
