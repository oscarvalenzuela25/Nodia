"""Synthetic reader contract checks; no service, account or provider access."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest


READER = Path(__file__).with_name("read-nodia-ai-web-diagnostics.py")
SPEC = importlib.util.spec_from_file_location("web_diagnostics_reader", READER)
reader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reader)


def baseline():
    return {"attached": True, "last_phase": "generation_cancelled", "cancelled_at_phase": "candidate_output",
            "elapsed_ms": 119004, "http_status": 200, "byte_chunks": 11, "body_bytes": 39194,
            "candidate_outputs": 7, "activity_calls": 1, "recovery_calls": 0,
            "client_close_calls": 1, "sink_errors": 0, "events": []}


def extended():
    return {**baseline(), "upstream_eof_seen": False, "upstream_eof_elapsed_ms": None,
            "output_shape": {"text_nonempty": False, "text_delta_nonempty": False,
                "thoughts_present": True, "thoughts_empty": False, "media_count": 0,
                "candidates_count": 1, "first_yield_elapsed_ms": 110000,
                "last_yield_elapsed_ms": 118235, "first_text_elapsed_ms": None,
                "text_outputs": 0, "thoughts_only_outputs": 7, "empty_outputs": 0,
                "unclassified_outputs": 0}}


class ReaderContractTests(unittest.TestCase):
    def test_historical_baseline_is_preserved_exactly(self):
        value = baseline()
        self.assertTrue(reader.snapshot(value))
        result = reader.project("nodia_ai_web_cancelled ", {
            "attempt_id": "00000000-0000-4000-8000-000000000001", "web_generation": value})
        self.assertEqual(result, {"event": "web_cancelled", "web_generation": value})

    def test_new_shape_and_normal_eof_are_accepted(self):
        value = extended()
        self.assertTrue(reader.snapshot(value))
        value.update(upstream_eof_seen=True, upstream_eof_elapsed_ms=118240)
        self.assertTrue(reader.snapshot(value))

    def test_unknown_shape_remains_null_instead_of_empty(self):
        value = extended()
        for key in reader.SHAPE_BOOLEANS | reader.SHAPE_COUNTS | reader.SHAPE_TIMES:
            value["output_shape"][key] = None
        self.assertTrue(reader.snapshot(value))

    def test_partial_extensions_and_unknown_fields_are_rejected(self):
        for key in reader.EXTENDED_KEYS:
            value = extended()
            del value[key]
            self.assertFalse(reader.snapshot(value))
        value = extended()
        value["private-text"] = "private-marker"
        self.assertFalse(reader.snapshot(value))
        value = extended()
        value["output_shape"]["thoughts"] = "private-marker"
        self.assertFalse(reader.snapshot(value))

    def test_malformed_shape_types_and_bounds_are_rejected(self):
        invalid = {"text_nonempty": "private-marker", "thoughts_empty": 0,
                   "candidates_count": True, "media_count": -1,
                   "first_yield_elapsed_ms": 86400001, "text_outputs": 2147483648}
        for key, bad in invalid.items():
            value = extended()
            value["output_shape"][key] = bad
            self.assertFalse(reader.snapshot(value), key)

    def test_eof_requires_explicit_normal_completion_timestamp(self):
        for seen, timestamp in ((True, None), (False, 12), (True, True), ("yes", 12)):
            value = extended()
            value.update(upstream_eof_seen=seen, upstream_eof_elapsed_ms=timestamp)
            self.assertFalse(reader.snapshot(value))

    def test_closed_projection_never_exports_malformed_raw_input(self):
        value = {"attempt_id": "00000000-0000-4000-8000-000000000001", "web_generation": extended()}
        bad = copy.deepcopy(value)
        bad["web_generation"]["output_shape"]["thoughts"] = "private-marker"
        payload = "\n".join([
            "native-private-marker no accepted event",
            "nodia_ai_web_cancelled {malformed-private-marker",
            "nodia_ai_web_cancelled " + json.dumps(bad),
            "nodia_ai_web_cancelled " + json.dumps(value),
        ]) + "\n"
        completed = subprocess.run([sys.executable, str(READER)], input=payload,
                                   text=True, capture_output=True, check=True, timeout=10)
        projected = [json.loads(line) for line in completed.stdout.splitlines()]
        self.assertEqual(len(projected), 1)
        self.assertNotIn("private-marker", completed.stdout)
        self.assertNotIn("attempt_id", completed.stdout)
        self.assertEqual(completed.stderr, "")


if __name__ == "__main__":
    unittest.main()
