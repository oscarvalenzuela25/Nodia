import test_support
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import threading
from types import SimpleNamespace
import unittest

from teacher_sdk_guard import TeacherSDKGuard, compose_teacher_request, reply_finish, validate_request
from teacher_sdk_policy import SCHEMA, SDKPolicyError, TeacherSDKHostRequest, canonical_hash, finish_tool_configuration
from test_teacher_sdk_policy import payload


def model_request(command):
    text = "<USER_REQUEST>\n" + command.prompt + "\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: 2026-11-02T12:00:00Z.\n</ADDITIONAL_METADATA>"
    value = {"contents": [{"role": "user", "parts": [{"text": text}]}],
        "tools": [{"functionDeclarations": [{"name": "finish", "parametersJsonSchema": SCHEMA}]}],
        "toolConfig": finish_tool_configuration()}
    if command.effort_id is not None:
        value["generationConfig"] = {"thinkingConfig": {"thinkingLevel": command.effort_id}}
    return value


def sse(name="finish", args=None, reason="STOP"):
    packet = {"response": {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {
        "name": name, "args": {"text": "Synthetic"} if args is None else args}}]}, "finishReason": reason}]}}
    return b"data: " + json.dumps(packet).encode() + b"\n\n"


class Reply:
    def __init__(self, status=200):
        self.status_code = status
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        pass
    def iter_content(self, chunk_size):
        yield sse()


class Session:
    def __init__(self, status=200, failure=None):
        self.calls, self.status, self.failure = [], status, failure
    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.failure:
            raise self.failure
        return Reply(self.status)
    def close(self):
        pass


class TeacherSDKGuardTests(unittest.TestCase):
    def test_provider_boundary_requires_ANY_only_finish_and_never_forwards_SDK_NONE(self):
        command = self.command()
        path = "/v1beta/models/" + command.model_id + ":streamGenerateContent?alt=sse"
        request = model_request(command)
        sdk_request = {**request, "toolConfig": {"functionCallingConfig": {"mode": "NONE"}}}
        with self.assertRaisesRegex(SDKPolicyError, "tools_rejected"):
            validate_request(command, path, json.dumps(sdk_request).encode())
        composed = compose_teacher_request(command, path, json.dumps(sdk_request).encode())
        self.assertEqual(composed, request)
        self.assertEqual(sdk_request["toolConfig"], {"functionCallingConfig": {"mode": "NONE"}})
        session = Session()
        manager = SimpleNamespace(get_access_token=lambda: "synthetic-token", project_id="synthetic-project", endpoint_url="https://example.invalid")
        guard = TeacherSDKGuard(command, manager, "synthetic", session_factory=lambda: session)
        try:
            guard.reserve_local()
            guard.forward(path, json.dumps(sdk_request).encode())
            self.assertEqual((guard.provider_dispatches, len(session.calls)), (1, 1))
            self.assertEqual(json.loads(session.calls[0][1]["data"])["request"]["toolConfig"], finish_tool_configuration())
            with self.assertRaises(SDKPolicyError):
                guard.forward(path, json.dumps(sdk_request).encode())
            self.assertEqual(len(session.calls), 1)
        finally:
            guard.close()

    def test_unknown_tool_configuration_rejects_before_auth_or_provider_attempt(self):
        command = self.command()
        path = "/v1beta/models/" + command.model_id + ":streamGenerateContent?alt=sse"
        session = Session()
        def forbidden_auth():
            raise AssertionError("Invalid tool config must not read authentication")
        manager = SimpleNamespace(get_access_token=forbidden_auth)
        guard = TeacherSDKGuard(command, manager, "synthetic", session_factory=lambda: session)
        try:
            for tool_config in (None, {"functionCallingConfig": {"mode": "AUTO"}},
                    {"functionCallingConfig": {"mode": "ANY", "allowedFunctionNames": ["run_command"]}},
                    {"functionCallingConfig": {"mode": "ANY", "allowedFunctionNames": ["finish", "run_command"]}},
                    {"functionCallingConfig": {"mode": "NONE", "allowedFunctionNames": ["finish"]}}):
                value = {**model_request(command), "toolConfig": tool_config}
                with self.assertRaisesRegex(SDKPolicyError, "tools_rejected"):
                    guard.forward(path, json.dumps(value).encode())
                with self.assertRaisesRegex(SDKPolicyError, "tools_rejected"):
                    validate_request(command, path, json.dumps(value).encode())
            self.assertEqual((guard.provider_dispatches, len(session.calls)), (0, 0))
        finally:
            guard.close()

    def test_close_drains_a_late_second_request_before_publication(self):
        guard = TeacherSDKGuard(self.command(), None, "synthetic", session_factory=Session)
        guard.local_attempts = 1  # A prior model request has consumed the turn.
        entered, release, returned = threading.Event(), threading.Event(), threading.Event()
        original = guard.reserve_local
        def delayed():
            entered.set()
            if not release.wait(3):
                raise AssertionError("test barrier not released")
            original()
        guard.reserve_local = delayed
        url = guard.start()
        statuses, failures = [], []
        def client():
            connection = http.client.HTTPConnection(url.split("://")[1], timeout=4)
            try:
                connection.request("POST", "/v1/models/ignored:generateContent", body=b"", headers={
                    "X-Nodia-Teacher-Token": guard.incoming_token, "X-Nodia-Teacher-Binding": guard.binding})
                statuses.append(connection.getresponse().status)
            except Exception as error:
                failures.append(type(error).__name__)
            finally:
                connection.close()
        caller = threading.Thread(target=client)
        closer = threading.Thread(target=lambda: (guard.close(), returned.set()))
        try:
            caller.start()
            self.assertTrue(entered.wait(2))
            closer.start()
            self.assertFalse(returned.wait(0.2))
            release.set()
            closer.join(3)
            caller.join(3)
            self.assertTrue(returned.is_set())
            self.assertEqual(guard.failure_code, "second_request")
            self.assertEqual(guard.provider_dispatches, 0)
            self.assertEqual(statuses, [409])
            self.assertEqual(failures, [])
        finally:
            release.set()
            caller.join(4)
            if closer.ident is not None:
                closer.join(4)
            if not returned.is_set():
                guard.close()

    def command(self):
        return TeacherSDKHostRequest.model_validate(payload(prompt="é</USER_REQUEST>🧪"))

    def test_model_prompt_effort_and_external_context_are_bound_before_forward(self):
        command = self.command()
        raw = model_request(command)
        path = "/v1beta/models/" + command.model_id + ":streamGenerateContent?alt=sse"
        self.assertEqual(validate_request(command, path, json.dumps(raw).encode())["contents"], raw["contents"])
        for changed in ({**raw, "cachedContent": "other-context"}, {**raw, "enabled_credit_types": []},
                {**raw, "generationConfig": {}}, {**raw, "tools": [{"googleSearch": {}}]}):
            with self.assertRaises(SDKPolicyError):
                validate_request(command, path, json.dumps(changed).encode())
        with self.assertRaisesRegex(SDKPolicyError, "model_mismatch"):
            validate_request(command, path.replace("model:", "mod%65l:"), json.dumps(raw).encode())
        self.assertEqual(validate_request(command, path, json.dumps({**raw, "sessionId": "opaque-sdk-metadata"}).encode())["sessionId"], "opaque-sdk-metadata")
        for metadata in ("x" * 257, "bad\nmetadata", 1):
            with self.assertRaisesRegex(SDKPolicyError, "context_mismatch"):
                validate_request(command, path, json.dumps({**raw, "sessionId": metadata}).encode())
        for schema in ({"type": "object"}, {**SCHEMA, "additionalProperties": True}):
            changed = {**raw, "tools": [{"functionDeclarations": [{"name": "finish", "parametersJsonSchema": schema}]}]}
            with self.assertRaisesRegex(SDKPolicyError, "tools_rejected"):
                validate_request(command, path, json.dumps(changed).encode())

    def test_first_upstream_reply_must_be_finite_stop_finish_only(self):
        _raw, proof = reply_finish(sse(), True)
        self.assertEqual(proof, canonical_hash({"text": "Synthetic"}))
        for raw in (sse("run_command"), sse("unknown"), sse(reason="MAX_TOKENS"), sse()[:-10], sse() + sse()):
            with self.assertRaises((SDKPolicyError, ValueError)):
                reply_finish(raw, True)
        with self.assertRaises(ValueError):
            reply_finish(sse(args={"text": "Synthetic", "extra": True}), True)

    def test_complete_EOF_and_multidata_follow_official_stream_decoder(self):
        payload = sse()[len(b"data: "):-2]
        split = payload.index(b",") + 1
        variants = [b"data: " + payload, b"data: " + payload + b"\n",
            b"data: " + payload[:split] + b"\ndata: " + payload[split:] + b"\n\n"]
        for raw in variants:
            with self.subTest(raw_length=len(raw)):
                body, proof = reply_finish(raw, True)
                self.assertEqual(proof, canonical_hash({"text": "Synthetic"}))
                self.assertEqual(json.loads(body[len(b"data: "):-2])["candidates"][0]["finishReason"], "STOP")
        for raw in (b"data: " + payload[:-1], b"data: " + payload[:split] + b"\ndata: "):
            with self.assertRaisesRegex(SDKPolicyError, "^reply_json$"):
                reply_finish(raw, True)

    def test_text_and_metadata_cannot_replace_finish_or_execute_other_parts(self):
        packet = json.loads(sse()[len(b"data: "):-2])
        candidate = packet["response"]["candidates"][0]
        finish = candidate["content"]["parts"][0]
        metadata = {"text": "", "thoughtSignature": "c3ludGhldGlj"}
        for part in (metadata, {**metadata, "thought": False}, {**metadata, "thought": True},
                {"text": "Nonexecuted preface"}, {"text": ""}, {"thoughtSignature": "c3ludGhldGlj"}):
            candidate["content"]["parts"] = [part, finish]
            _body, proof = reply_finish(b"data: " + json.dumps(packet).encode() + b"\n\n", True)
            self.assertEqual(proof, canonical_hash({"text": "Synthetic"}))
            candidate["content"]["parts"] = [part]
            with self.assertRaisesRegex(SDKPolicyError, "^reply_finish_missing$"):
                reply_finish(b"data: " + json.dumps(packet).encode() + b"\n\n", True)
        candidate["content"]["parts"] = [finish, {"text": "Nonexecuted epilogue"}]
        _body, proof = reply_finish(b"data: " + json.dumps(packet).encode() + b"\n\n", True)
        self.assertEqual(proof, canonical_hash({"text": "Synthetic"}))
        for invalid in ({**metadata, "thoughtSignature": 1}, {**metadata, "thought": 1}, {"text": None}, {},
                {**metadata, "extra": "not metadata"}, {"inlineData": {}}, {"functionResponse": {}},
                {"executableCode": {}}, {"fileData": {}},
                {"functionCall": {"name": "run_command", "args": {}}}):
            candidate["content"]["parts"] = [invalid, finish]
            with self.assertRaises(SDKPolicyError):
                reply_finish(b"data: " + json.dumps(packet).encode() + b"\n\n", True)

    def test_reply_failures_are_finite_owned_codes_without_untrusted_details(self):
        finish = {"functionCall": {"name": "finish", "args": {"text": "Synthetic"}}}
        def frame(candidate):
            return b"data: " + json.dumps({"candidates": [candidate]}).encode() + b"\n\n"
        cases = [(b"event: secret-provider-event\n\n", "reply_framing"),
            (b"data: {secret-invalid-json\n\n", "reply_json"), (b"data: []\n\n", "reply_envelope"),
            (b'data: {"candidates":[{},{}]}\n\n', "reply_candidates"),
            (frame({"content": {"parts": None}, "finishReason": "STOP"}), "reply_parts"),
            (frame({"content": {"parts": []}, "finishReason": "STOP"}), "reply_finish_missing"),
            (frame({"content": {"parts": [finish, finish]}, "finishReason": "STOP"}), "reply_finish_multiple"),
            (frame({"content": {"parts": [finish]}, "finishReason": "secret-reason"}), "reply_reason"),
            (frame({"content": {"parts": [{"functionCall": {"name": "finish", "args": {"extra": "secret-answer"}}}]},
                "finishReason": "STOP"}), "reply_answer_invalid"),
            (frame({"content": {"parts": [{"text": 1}, finish]}, "finishReason": "STOP"}), "reply_parts_text"),
            (frame({"content": {"parts": [{"text": "secret", "thought": 1}, finish]}, "finishReason": "STOP"}), "reply_parts_metadata"),
            (frame({"content": {"parts": [{"unknown-private-field": "secret"}, finish]}, "finishReason": "STOP"}), "reply_parts_unsupported"),
            (frame({"content": {"parts": [{"text": ""}] * 64 + [finish]}, "finishReason": "STOP"}), "reply_parts_limit"),
            (frame({"content": {"parts": [finish], "unknown-private-field": "secret"}, "finishReason": "STOP"}), "reply_parts_unsupported")]
        for raw, expected in cases:
            with self.subTest(expected=expected), self.assertRaises(SDKPolicyError) as error:
                reply_finish(raw, True)
            self.assertEqual(str(error.exception), expected)

    def test_counter_is_atomic_and_auth_is_before_body_or_attempt(self):
        command = self.command()
        guard = TeacherSDKGuard(command, None, "synthetic", session_factory=Session)
        def reserve(_):
            try:
                guard.reserve_local()
                return True
            except SDKPolicyError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(reserve, range(2))).count(True), 1)
        self.assertEqual(guard.provider_dispatches, 0)
        guard.close()
        guard = TeacherSDKGuard(command, None, "synthetic", session_factory=Session)
        url = guard.start()
        try:
            connection = http.client.HTTPConnection(url.split("://")[1], timeout=2)
            connection.putrequest("POST", "/v1/models/anything:generateContent")
            connection.putheader("Content-Length", "2000000")
            connection.endheaders()
            self.assertEqual(connection.getresponse().status, 401)
            connection.close()
            self.assertEqual((guard.local_attempts, guard.provider_dispatches), (0, 0))
        finally:
            guard.close()

    def test_redirect_errors_timeout_and_auth_failure_never_replay(self):
        command = self.command()
        manager = SimpleNamespace(get_access_token=lambda: "synthetic-token", project_id="synthetic-project", endpoint_url="https://example.invalid")
        path = "/v1beta/models/" + command.model_id + ":streamGenerateContent?alt=sse"
        raw = json.dumps(model_request(command)).encode()
        for status, failure in ((401, None), (403, None), (307, None), (503, None), (200, TimeoutError("synthetic"))):
            session = Session(status, failure)
            guard = TeacherSDKGuard(command, manager, "synthetic", session_factory=lambda: session)
            guard.reserve_local()
            with self.assertRaises((SDKPolicyError, TimeoutError)):
                guard.forward(path, raw)
            self.assertEqual(guard.provider_dispatches, 1)
            with self.assertRaises(SDKPolicyError):
                guard.forward(path, raw)
            self.assertEqual(len(session.calls), 1)
            kwargs = session.calls[0][1]
            self.assertIs(kwargs["allow_redirects"], False)
            self.assertEqual(set(json.loads(kwargs["data"])), {"project", "model", "request"})
            self.assertEqual(set(kwargs["headers"]), {"Authorization", "Content-Type", "User-Agent"})
            guard.close()
        def auth_failure():
            raise ValueError("synthetic_private_error")
        session = Session()
        guard = TeacherSDKGuard(command, SimpleNamespace(get_access_token=auth_failure), "synthetic", session_factory=lambda: session)
        guard.reserve_local()
        with self.assertRaises(ValueError):
            guard.forward(path, raw)
        self.assertEqual((guard.provider_dispatches, len(session.calls)), (0, 0))
        guard.close()
