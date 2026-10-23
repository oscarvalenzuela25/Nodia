"""Synthetic SDK-equivalent envelopes; no account, transport or private frames."""
import test_support
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from gemini_webapi.utils import StreamingFrameParser
from web_generation_diagnostics import WebGenerationDiagnostics, _Response, _StreamContext
from web_stream_frame_diagnostics import MAX_BYTES, MAX_PARTS, StreamFrameDiagnostics


def envelope(parts):
    text = json.dumps(parts, ensure_ascii=False)
    units = len(text.encode("utf-16-le")) // 2 + 1
    return (str(units) + "\n" + text + "\n").encode()


def part(inner=None, status=None):
    return ["wrb.fr", "private-method", json.dumps(inner) if inner is not None else None,
            None, None, status]


def inner():
    value = [None] * 28
    value[1] = ["private-cid", "private-rid"]
    candidate = [None] * 9
    candidate[0], candidate[1], candidate[8] = "private-rcid", ["secret 😀 text"], [2]
    value[4], value[6], value[25] = [candidate], [None, ["data_analysis_tool"]], "private-context"
    return value


class StreamFrameDiagnosticsTests(unittest.TestCase):
    def observe(self, chunks):
        trace = StreamFrameDiagnostics()
        trace.start()
        for chunk in chunks:
            trace.feed(chunk)
        trace.close()
        return trace

    def test_fragmented_utf8_utf16_matches_actual_sdk_frame_completion(self):
        # The independent diagnostic framing must agree with the actual SDK,
        # including an emoji split inside UTF-8 bytes and Google's XSSI prefix.
        raw = b")]}'\n" + envelope([part(inner())])
        for step in (1, 2, 7, len(raw)):
            with self.subTest(step=step):
                trace = self.observe([raw[i:i + step] for i in range(0, len(raw), step)])
                parser = StreamingFrameParser()
                parts = parser.feed(raw.decode()) + parser.flush()
                snapshot = trace.snapshot()
                self.assertEqual(snapshot["parts"], len(parts))
                self.assertEqual(snapshot["frames"], 1)
                self.assertEqual(snapshot["candidate_list_parts"], 1)
                self.assertEqual(snapshot["candidates"], 1)
                self.assertEqual(snapshot["candidate_id_parts"], 1)
                self.assertEqual(snapshot["completed_indicator_parts"], 1)
                self.assertEqual(snapshot["data_analysis_parts"], 1)
                self.assertEqual(snapshot["final_context_parts"], 1)
                self.assertIs(snapshot["cid_present"], True)
                self.assertIs(snapshot["rid_present"], True)
                self.assertFalse(snapshot["incomplete_at_close"])
                self.assertEqual(trace._buffer, "")

    def test_status_and_known_error_categories_never_export_numeric_unknowns(self):
        statuses = [[None, None, [[None, [code]]]] for code in (1037, 1050, 1052, 1060, 1013, 999999)]
        trace = self.observe([envelope([part(status=status) for status in statuses])])
        snapshot = trace.snapshot()
        self.assertEqual(snapshot["status_list_parts"], 6)
        self.assertEqual(snapshot["error_categories"], {
            "usage_limit": 1, "model_inconsistent": 1, "model_header_invalid": 1,
            "ip_blocked": 1, "temporary_1013": 1, "other": 1})
        self.assertNotIn("999999", json.dumps(snapshot))
        self.assertIsNone(snapshot["cid_present"])

    def test_metadata_absent_is_observed_false_only_after_inner_json(self):
        trace = self.observe([envelope([part([None] * 5)])])
        self.assertIs(trace.snapshot()["cid_present"], False)
        self.assertIs(trace.snapshot()["rid_present"], False)

    def test_no_output_and_partial_frame_are_not_an_empty_answer(self):
        trace = self.observe([envelope([part(status=[1])]), b"100\n[unfinished"])
        snapshot = trace.snapshot()
        self.assertEqual(snapshot["parts"], 1)
        self.assertEqual(snapshot["candidates"], 0)
        self.assertIsNone(snapshot["cid_present"])
        self.assertTrue(snapshot["incomplete_at_close"])
        self.assertEqual(trace._buffer, "")
        self.assertIsNone(trace._decoder)

    def test_malformed_outer_and_inner_json_do_not_log_or_escape(self):
        invalid = "[private-secret-invalid]"
        outer = (str(len(invalid) + 1) + "\n" + invalid + "\n").encode()
        with patch("gemini_webapi.utils.parsing.logger.debug") as sdk_logger:
            trace = self.observe([outer, envelope([["wrb.fr", None, invalid]])])
        snapshot = trace.snapshot()
        self.assertEqual(snapshot["invalid_json_frames"], 1)
        self.assertEqual(snapshot["invalid_inner_json_parts"], 1)
        sdk_logger.assert_not_called()
        self.assertNotIn("private-secret", json.dumps(snapshot))

    def test_snapshot_is_content_free_and_mutating_it_does_not_mutate_observer(self):
        trace = self.observe([envelope([part(inner(), status=["private-status"]),
                                      ["private-unknown", None, '{"private-json": "secret"}']])])
        snapshot = trace.snapshot()
        encoded = json.dumps(snapshot)
        for marker in ("private", "secret", "😀", "wrb.fr", "data_analysis_tool"):
            self.assertNotIn(marker, encoded)
        snapshot["error_categories"]["other"] = 99
        self.assertEqual(trace.snapshot()["error_categories"]["other"], 0)

    def test_byte_budget_stops_and_clears_private_partial_buffer(self):
        trace = StreamFrameDiagnostics()
        trace.start()
        trace.feed(b"65536\n" + b"private" * 100)
        trace.feed(b"x" * MAX_BYTES)
        snapshot = trace.snapshot()
        self.assertTrue(snapshot["limit_exceeded"])
        self.assertLessEqual(snapshot["inspected_bytes"], MAX_BYTES)
        self.assertEqual(trace._buffer, "")
        self.assertIsNone(trace._decoder)
        trace.feed(envelope([part(inner())]))
        self.assertEqual(trace.snapshot(), snapshot)

    def test_huge_declared_frame_and_part_count_are_bounded(self):
        trace = self.observe([b"999999999999999999999\nprivate"])
        self.assertTrue(trace.snapshot()["limit_exceeded"])
        trace = self.observe([envelope([[None]] * (MAX_PARTS + 1))])
        self.assertEqual(trace.snapshot()["parts"], MAX_PARTS)
        self.assertTrue(trace.snapshot()["limit_exceeded"])

    def test_version_mismatch_disables_only_diagnostics(self):
        with patch("web_stream_frame_diagnostics.version", return_value="unverified"):
            trace = self.observe([envelope([part(inner())])])
        self.assertFalse(trace.snapshot()["enabled"])
        self.assertEqual(trace.snapshot()["inspected_bytes"], 0)

    def test_internal_diagnostic_error_is_swallowed_and_discards_frame_text(self):
        trace = StreamFrameDiagnostics()
        trace.start()
        with patch.object(trace, "_describe", side_effect=RuntimeError("private-native-detail")):
            trace.feed(envelope([part(inner())]))
        self.assertEqual(trace.snapshot()["observer_errors"], 1)
        self.assertEqual(trace._buffer, "")
        self.assertNotIn("private", json.dumps(trace.snapshot()))


class StreamFrameTransportTests(unittest.IsolatedAsyncioTestCase):
    async def test_transport_forwards_original_chunks_options_and_native_error(self):
        chunks = [bytearray(b"malformed private chunk"), memoryview(b"second")]
        error = RuntimeError("private-upstream-error")
        class Response:
            async def aiter_content(self, *args, **kwargs):
                self.options = (args, kwargs)
                for chunk in chunks:
                    yield chunk
                raise error
        response = Response()
        trace = WebGenerationDiagnostics("synthetic-attempt")
        wrapped = _Response(response, object(), trace)
        received = []
        with self.assertRaises(RuntimeError) as caught:
            async for chunk in wrapped.aiter_content("native-option", chunk_size=4):
                received.append(chunk)
        self.assertIs(caught.exception, error)
        self.assertEqual(response.options, (("native-option",), {"chunk_size": 4}))
        for actual, expected in zip(received, chunks, strict=True):
            self.assertIs(actual, expected)
        self.assertFalse(trace.upstream_eof_seen)
        trace.stream_frames.close()

    async def test_context_cancellation_closes_diagnostic_buffer_without_changing_exit(self):
        class Context:
            async def __aenter__(self):
                return SimpleNamespace(status_code=200)
            async def __aexit__(self, *exception):
                self.exception = exception
                return False
        context = Context()
        trace = WebGenerationDiagnostics("synthetic-attempt")
        wrapped = _StreamContext(context, object(), trace)
        await wrapped.__aenter__()
        trace.stream_frames.feed(b"100\nprivate-partial")
        error = asyncio.CancelledError()
        self.assertFalse(await wrapped.__aexit__(type(error), error, None))
        self.assertIs(context.exception[1], error)
        self.assertTrue(trace.stream_frames.snapshot()["incomplete_at_close"])
        self.assertEqual(trace.stream_frames._buffer, "")
