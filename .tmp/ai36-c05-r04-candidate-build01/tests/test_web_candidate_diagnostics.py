"""Offline selection metadata against the pinned SDK; no provider/session I/O."""
import test_support
import hashlib
import json
import unittest

from gemini_webapi import GeminiClient
from gemini_webapi.types import Candidate
from nodia_ai_chat import parse_reply
from web_candidate_diagnostics import describe_preparser


def candidate(primary, card=None, *, card_slot=True):
    data = [None] * (23 if card_slot else 9)
    data[0], data[1] = "synthetic-private-candidate-id", [primary]
    if card_slot:
        data[22] = [card]
    return data


class WebCandidateDiagnosticsTests(unittest.TestCase):
    def parsed(self, value):
        # The pure candidate parser creates no HTTP client, tasks or session.
        return GeminiClient._parse_candidate(GeminiClient("synthetic", "synthetic"),
            value, "synthetic-cid", "synthetic-rid", "synthetic-rcid")[0]

    def assert_digest(self, metadata, text):
        value = metadata["selected_payload"]
        self.assertEqual(value["sha256"], hashlib.sha256(text.encode()).hexdigest())
        self.assertEqual(value["text_bytes"], len(text.encode()))

    def test_primary_selection_matches_actual_sdk_without_artifacts(self):
        text = '{"kind":"answer","text":"synthetic private marker"}'
        data = candidate(text, '{"unused":"synthetic alternate marker"}')
        value = describe_preparser(data)
        self.assertEqual(value["selection_source"], "primary")
        self.assertFalse(value["card_prefix_detected"])
        self.assertIsNone(value["card_payload_available"])
        self.assert_digest(value, self.parsed(data))
        self.assertTrue(value["selected_payload"]["json_parseable"])
        self.assertEqual(value["selected_payload"]["top_level_kind"], "object")
        serialized = json.dumps(value)
        for private in ("synthetic private marker", "synthetic alternate marker", data[0]):
            self.assertNotIn(private, serialized)

    def test_card_selection_fingerprints_selected_slot_before_sdk_artifact_cleanup(self):
        primary = "https://googleusercontent.com/card_content/123"
        selected = '{"kind":"answer","text":"https://googleusercontent.com/image_generation_content/987"}'
        data = candidate(primary, selected)
        value = describe_preparser(data)
        self.assertEqual(value["selection_source"], "card")
        self.assertTrue(value["card_prefix_detected"])
        self.assertTrue(value["card_payload_available"])
        self.assert_digest(value, selected)
        cleaned = self.parsed(data)
        self.assertEqual(cleaned, '{"kind":"answer","text":""}')
        self.assertNotEqual(value["selected_payload"]["sha256"], hashlib.sha256(cleaned.encode()).hexdigest())
        self.assertNotIn("googleusercontent", json.dumps(value))

    def test_card_fallback_uses_exact_sdk_falsy_rule(self):
        primary = "https://googleusercontent.com/card_content/123"
        for alternate in (None, "", [], {}, False, 0):
            with self.subTest(alternate_type=type(alternate).__name__):
                data = candidate(primary, alternate)
                value = describe_preparser(data)
                self.assertEqual(value["selection_source"], "fallback")
                self.assertFalse(value["card_payload_available"])
                self.assert_digest(value, primary)
                self.assertEqual(self.parsed(data), "")
        data = candidate(primary, card_slot=False)
        self.assertEqual(describe_preparser(data)["selection_source"], "fallback")
        self.assertEqual(self.parsed(data), "")

    def test_malformed_truthy_card_does_not_invent_a_fallback(self):
        for alternate in ([1], {"unexpected": True}, True, 1):
            data = candidate("https://googleusercontent.com/card_content/123", alternate)
            value = describe_preparser(data)
            self.assertEqual(value["selection_source"], "card")
            self.assertIsNone(value["selected_payload"])
            with self.assertRaises(TypeError):
                self.parsed(data)

    def test_entities_are_observed_before_the_legacy_candidate_validator(self):
        text = '{"kind":"answer","text":"literal &quot;private&quot; &#10;"}'
        value = describe_preparser(candidate(text))
        self.assertTrue(value["selected_payload"]["json_parseable"])
        self.assert_digest(value, self.parsed(candidate(text)))
        legacy = Candidate(rcid="synthetic", text=self.parsed(candidate(text)))
        with self.assertRaises(ValueError):
            parse_reply(legacy.text, "web")
        self.assertNotIn("private", json.dumps(value))

    def test_top_level_kind_detects_wrapping_without_a_second_json_decode(self):
        sources = [('{}', "object"), ('[]', "array"), ('"literal"', "string"),
                   ('12', "number"), ('1.2', "number"), ('true', "boolean"), ('null', "null")]
        wrapped = json.dumps('{"kind":"answer","text":"synthetic"}')
        sources.append((wrapped, "string"))
        for source, kind in sources:
            with self.subTest(kind=kind):
                value = describe_preparser(candidate(source))["selected_payload"]
                self.assertTrue(value["json_parseable"])
                self.assertEqual(value["top_level_kind"], kind)
                self.assertEqual(value["sha256"], hashlib.sha256(source.encode()).hexdigest())
        with self.assertRaises(ValueError):
            parse_reply(wrapped, "web")

    def test_json_failures_only_export_closed_punctuation_categories_and_offsets(self):
        symbols = {"&": "ampersand", "(": "paren_open", ")": "paren_close", "/": "slash",
                   ";": "semicolon", "<": "angle_open", ">": "angle_close"}
        for character, category in symbols.items():
            source = '{"text":"synthetic private marker"' + character + ']}'
            value = describe_preparser(candidate(source))["selected_payload"]
            self.assertFalse(value["json_parseable"])
            self.assertEqual(value["top_level_kind"], "invalid")
            self.assertEqual(value["syntax"]["category"], "comma_delimiter")
            self.assertEqual(value["syntax"]["character_category"], category)
            self.assertEqual(value["syntax"]["previous_category"], "double_quote")
            self.assertEqual(value["syntax"]["next_category"], "array_close")
            self.assertEqual(value["syntax"]["position"], len(source) - 3)
            self.assertNotIn("synthetic private marker", json.dumps(value))

    def test_missing_primary_matches_sdk_empty_text_without_becoming_a_success(self):
        for data in ([], [None], candidate(None), [None, {}]):
            value = describe_preparser(data)
            self.assertEqual(value["selection_source"], "primary")
            self.assertFalse(value["selected_payload"]["json_parseable"])
            self.assert_digest(value, self.parsed(data))

    def test_utf8_limits_and_invalid_surrogates_return_unknown_metadata_without_raising(self):
        for text in ("x" * 65537, "🧪" * 20000):
            value = describe_preparser(candidate(text))["selected_payload"]
            self.assertTrue(value["diagnostic_limit_exceeded"])
            self.assertIsNone(value["sha256"])
            self.assertIsNone(value["json_parseable"])
            self.assertEqual(value["top_level_kind"], "unknown")
        value = describe_preparser(candidate("\ud800"))["selected_payload"]
        self.assertIsNone(value["sha256"])
        self.assertIsNone(value["json_parseable"])
        boundary = "x" * 65536
        self.assert_digest(describe_preparser(candidate(boundary)), boundary)

    def test_nonfinite_and_deep_json_never_escape_as_diagnostic_errors(self):
        for text in ('NaN', 'Infinity', '-Infinity'):
            value = describe_preparser(candidate(text))["selected_payload"]
            self.assertFalse(value["json_parseable"])
            self.assertEqual(value["top_level_kind"], "invalid")
        # The installed Python decoder's supported depth can differ by version;
        # this observer reports it without imposing an alternate JSON policy.
        value = describe_preparser(candidate('[' * 2000 + '0' + ']' * 2000))["selected_payload"]
        self.assertIs(type(value["json_parseable"]), bool)
        self.assertEqual(value["top_level_kind"], "array" if value["json_parseable"] else "invalid")

    def test_hostile_unknown_types_do_not_run_getters_truthiness_or_repr(self):
        class Hostile:
            def __getattribute__(self, name):
                raise AssertionError("private getter")
            def __bool__(self):
                raise AssertionError("private truthiness")
            def __repr__(self):
                raise AssertionError("private repr")
        class HostileList(list):
            def __len__(self):
                raise AssertionError("private length")
            def __getitem__(self, key):
                raise AssertionError("private index")
        for data in (Hostile(), HostileList(), candidate(Hostile()), [None, HostileList()],
                     candidate("https://googleusercontent.com/card_content/123", Hostile())):
            value = describe_preparser(data)
            self.assertEqual(value["selection_source"], "unknown")
            self.assertIsNone(value["selected_payload"])
            self.assertNotIn("private", json.dumps(value))

    def test_snapshots_are_independent_of_input_and_other_descriptions(self):
        data = candidate('{"kind":"answer","text":"first"}')
        value = describe_preparser(data)
        digest = value["selected_payload"]["sha256"]
        data[1][0] = '{"kind":"answer","text":"second"}'
        second = describe_preparser(data)
        second["selected_payload"]["sha256"] = "modified"
        self.assertEqual(value["selected_payload"]["sha256"], digest)
        self.assertNotIn("first", json.dumps(value))
        self.assertNotIn("second", json.dumps(value))


if __name__ == "__main__":
    unittest.main()
