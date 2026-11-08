import test_support
from datetime import datetime, timedelta, timezone
import unittest
from uuid import uuid4

from pydantic import ValidationError
from teacher_sdk_policy import (SDKPolicyError, TeacherSDKHostRequest, TeacherSDKObserveRequest,
    canonical_hash, source_finish, strict_json)


def payload(**updates):
    value = dict(contract="teacher-sdk-host/1", operation_id=str(uuid4()), request_hash="a" * 64,
        host_nonce="b" * 32, model_id="synthetic-selected-model", effort_id="high", prompt="Synthetic Unicode: España 🧪",
        deadline_at=(datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat())
    value.update(updates)
    return value


class TeacherSDKPolicyTests(unittest.TestCase):
    def test_closed_input_rejects_authority_paths_tools_and_byte_overflow(self):
        valid = payload()
        for change in ({"profile": "/private"}, {"tools": []}, {"model_id": " fallback "},
                       {"effort_id": ""}, {"prompt": "é" * 65537}, {"operation_id": "0" * 36}):
            with self.subTest(change=list(change)), self.assertRaises(ValidationError):
                TeacherSDKHostRequest.model_validate({**valid, **change})
        self.assertEqual(len(TeacherSDKHostRequest.model_validate(payload(prompt="x" * 131072)).prompt), 131072)
        self.assertIsNone(TeacherSDKObserveRequest.model_validate(dict(contract="teacher-sdk-host/1", model_id="dynamic", effort_id=None)).effort_id)

    def test_binding_preserves_every_field_and_deadline_never_defaults(self):
        original = TeacherSDKHostRequest.model_validate(payload())
        digest = original.binding()["binding_hash"]
        self.assertEqual(digest, canonical_hash(dict(reversed(list(original.model_dump().items())))))
        for field, replacement in (("prompt", "other"), ("effort_id", None), ("host_nonce", "c" * 32), ("request_hash", "d" * 64)):
            value = original.model_dump()
            value[field] = replacement
            self.assertNotEqual(digest, TeacherSDKHostRequest.model_validate(value).binding()["binding_hash"])
        for seconds in (-1, 601):
            value = TeacherSDKHostRequest.model_validate(payload(deadline_at=(datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()))
            with self.assertRaisesRegex(SDKPolicyError, "deadline_expired"):
                value.remaining()

    def test_strict_json_rejects_duplicates_and_nonfinite_values(self):
        for raw in (b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'):
            with self.assertRaises(SDKPolicyError):
                strict_json(raw)

    def test_finish_must_be_last_current_done_bound_to_first_reply(self):
        result = {"text": "Synthetic"}
        digest = canonical_hash(result)
        step = dict(type="FINISH", status="DONE", source="MODEL", target="TARGET_USER", root_trajectory_matches=True,
            depth=0, complete_response=True, structured_hash=digest, error_present=False)
        self.assertEqual(source_finish(result, [step], digest, "MAX_MODEL_CALLS_EXCEEDED", 0, 1).text, "Synthetic")
        for changed in ({"status": "ACTIVE"}, {"root_trajectory_matches": False}, {"depth": 1}, {"structured_hash": "other"}):
            with self.assertRaises(SDKPolicyError):
                source_finish(result, [{**step, **changed}], digest, "MAX_MODEL_CALLS_EXCEEDED", 0, 1)
        for rows, reply, reason, history in (([step, {"status": "ACTIVE"}], digest, "UNSPECIFIED", 0),
                ([step], "other", "UNSPECIFIED", 0), ([step], digest, "UNSPECIFIED", 1), ([step], digest, "CANCELLED", 0)):
            with self.assertRaises(SDKPolicyError):
                source_finish(result, rows, reply, reason, history, 1)
