import test_support
import asyncio
from copy import deepcopy
import json
import tempfile
from pathlib import Path
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, Mock, patch

from gemini_webapi import GeminiClient
from curl_cffi.requests import AsyncSession
from gemini_webapi.constants import Endpoint, MODEL_HEADER_KEY
from gemini_webapi.types import AvailableModel
from web_reasoning_adapter import ObservedProfile, ReasoningWebClient, rewrite_generation, load_profiles

# Synthetic model and codes, not an executable provider catalog.
MODEL = "a" * 16
CODES = (11, 22, 33)


def observations():
    result = []
    for level, code in zip(("low", "medium", "high"), CODES):
        body, header = [None] * 99, [None] * 20
        body[79], header[14] = 1, 1
        body[80], header[15] = code, code
        result.append(dict(level=level, model_id=MODEL, body_shape=body,
                           header_shape=header, http_status=200))
    return result


def request():
    header, body = [None] * 17, [None] * 81
    header[4], header[14], header[15], header[16] = MODEL, 1, 1, "synthetic-session"
    body[0], body[79], body[80] = ["synthetic-prompt", 0, None, ["synthetic-upload"]], 1, 1
    return ({MODEL_HEADER_KEY: json.dumps(header), "other": "preserved"},
            {"at": "synthetic-token", "f.req": json.dumps([None, json.dumps(body)])})


class ObservedProtocolTest(TestCase):
    def test_configuration_is_bounded_versioned_and_never_has_duplicate_models(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "profiles.json"
            path.write_text(json.dumps({"sdk_version": "2.1.1", "observations": [observations()]}))
            profiles = load_profiles(path)
            self.assertEqual(profiles[MODEL].codes, CODES)
            with self.assertRaises(TypeError):
                profiles["b" * 16] = profiles[MODEL]
            for document in ({"sdk_version": "future", "observations": [observations()]},
                             {"sdk_version": "2.1.1", "observations": [observations(), observations()]},
                             {"sdk_version": "2.1.1", "observations": []}):
                path.write_text(json.dumps(document))
                with self.assertRaises(ValueError):
                    load_profiles(path)
            path.write_text(" " * 131073)
            with self.assertRaises(ValueError):
                load_profiles(path)

    def test_all_three_levels_have_distinct_transport_and_preserve_other_fields(self):
        profile = ObservedProfile.from_observations(observations())
        for level, code in zip(("low", "medium", "high"), CODES):
            headers, data = request()
            before = deepcopy((headers, data))
            changed_headers, changed_data = rewrite_generation(headers, data, profile, level)
            self.assertEqual((headers, data), before)
            original_header = json.loads(headers[MODEL_HEADER_KEY])
            original_body = json.loads(json.loads(data["f.req"])[1])
            header = json.loads(changed_headers[MODEL_HEADER_KEY])
            body = json.loads(json.loads(changed_data["f.req"])[1])
            self.assertEqual((header[15], body[80]), (code, code))
            header[15], body[80] = original_header[15], original_body[80]
            self.assertEqual((header, body), (original_header, original_body))
            self.assertEqual(changed_data["at"], data["at"])
            self.assertEqual(changed_headers["other"], headers["other"])

    def test_missing_collapsed_mixed_invalid_and_inconsistent_observations_rejected(self):
        variants = [None, [], observations()[:2]]
        for path, value in (("level", "unknown"), ("model_id", "b" * 16),
                            ("http_status", 403), ("body_shape", [])):
            records = observations()
            records[1][path] = value
            variants.append(records)
        records = observations()
        records[1]["body_shape"][80] = records[1]["header_shape"][15] = CODES[0]
        variants.append(records)
        repeated = observations() + [deepcopy(observations()[0])]
        repeated[-1]["body_shape"][80] = repeated[-1]["header_shape"][15] = 99
        variants.append(repeated)
        for records in variants:
            with self.subTest(records=records), self.assertRaises(ValueError):
                ObservedProfile.from_observations(records)

    def test_malformed_or_drifted_sdk_request_is_rejected_before_transport(self):
        profile = ObservedProfile.from_observations(observations())
        variants = [(None, {}), ({}, {}), ({MODEL_HEADER_KEY: "broken"}, {})]
        for index, value in ((4, "b" * 16), (15, True), (14, "1")):
            headers, data = request()
            header = json.loads(headers[MODEL_HEADER_KEY])
            header[index] = value
            headers[MODEL_HEADER_KEY] = json.dumps(header)
            variants.append((headers, data))
        headers, data = request()
        body = json.loads(json.loads(data["f.req"])[1]) + [None]
        data["f.req"] = json.dumps([None, json.dumps(body)])
        variants.append((headers, data))
        for headers, data in variants:
            with self.assertRaises(ValueError):
                rewrite_generation(headers, data, profile, "medium")


class ExperimentClientTest(IsolatedAsyncioTestCase):
    def client(self):
        return ReasoningWebClient("synthetic", "synthetic", observed_profile=ObservedProfile(MODEL, CODES, 1))

    async def test_sdk_upload_receives_real_session_and_preserves_file_data_for_all_levels(self):
        class Captured(BaseException):
            pass
        client = self.client()
        session = AsyncSession()
        session.post = AsyncMock(return_value=Mock(text="/synthetic/upload", raise_for_status=Mock()))
        session.stream = Mock(side_effect=Captured)
        client.client = session
        client._running = True
        client._sync_activity = AsyncMock()
        model = AvailableModel(model_id=MODEL, model_name="synthetic", display_name="synthetic",
                               description="fixture", capacity=2, model_number=1)
        try:
            for level, code in zip(("low", "medium", "high"), CODES):
                with self.assertRaises(Captured):
                    await client.generate_content("synthetic-prompt", model=model, thinking_level=level,
                                                  files=[b"synthetic-file"])
                sent = session.stream.call_args.kwargs
                body = json.loads(json.loads(sent["data"]["f.req"])[1])
                self.assertEqual(body[80], code)
                self.assertEqual(body[0][3][0][0], ["/synthetic/upload"])
                self.assertIs(client._live_client, session)
            self.assertEqual(session.post.await_count, 3)
            self.assertEqual(session.stream.call_count, 3)
        finally:
            await session.close()

    async def test_cancelling_active_generation_closes_sdk_iterator_and_restores_context(self):
        client = self.client()
        client.client = Mock()
        client._sync_activity = AsyncMock()
        started, closed = asyncio.Event(), asyncio.Event()
        async def pending(instance, **kwargs):
            self.assertIsNot(instance._live_client, instance.client)
            started.set()
            try:
                await asyncio.Event().wait()
                yield None
            finally:
                closed.set()
        with patch.object(GeminiClient, "_generate", pending):
            task = asyncio.create_task(client.generate_content("synthetic", model=MODEL, thinking_level="high"))
            await started.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertTrue(closed.is_set())
        self.assertIs(client._live_client, client.client)
        self.assertFalse(client._experiment_lock.locked())

    async def test_installed_sdk_request_builder_sends_three_distinct_values_once_each(self):
        class Captured(BaseException):
            pass
        client = self.client()
        client._running = True
        client._sync_activity = AsyncMock()
        client.client = Mock()
        client.client.stream.side_effect = Captured
        model = AvailableModel(model_id=MODEL, model_name="synthetic", display_name="synthetic",
                               description="fixture", capacity=2, model_number=1)
        for level, code in zip(("low", "medium", "high"), CODES):
            before = client.client.stream.call_count
            with self.assertRaises(Captured):
                await client.generate_content("synthetic-prompt", model=model, thinking_level=level)
            sent = client.client.stream.call_args.kwargs
            header = json.loads(sent["headers"][MODEL_HEADER_KEY])
            body = json.loads(json.loads(sent["data"]["f.req"])[1])
            self.assertEqual((header[4], header[15], body[80], body[0][0]),
                             (MODEL, code, code, "synthetic-prompt"))
            self.assertEqual(client.client.stream.call_count, before + 1)
            self.assertIs(client._live_client, client.client)
        with self.assertRaises(Captured):
            await client.generate_content("synthetic-prompt", model=model,
                                          extended_thinking=True, current_retry=0)
        sent = client.client.stream.call_args.kwargs
        header = json.loads(sent["headers"][MODEL_HEADER_KEY])
        body = json.loads(json.loads(sent["data"]["f.req"])[1])
        self.assertEqual((header[15], body[80]), (2, 2))

    async def test_invalid_options_never_call_sdk_and_version_drift_is_rejected(self):
        client = self.client()
        with patch.object(GeminiClient, "generate_content", AsyncMock()) as generate:
            for kwargs in (dict(thinking_level="invalid", model=MODEL),
                           dict(thinking_level="low", model="b" * 16),
                           dict(thinking_level="low"),
                           dict(thinking_level="low", model=MODEL, extended_thinking=False),
                           dict(thinking_level="low", model=MODEL, current_retry=1)):
                with self.assertRaises(ValueError):
                    await client.generate_content("synthetic", **kwargs)
            generate.assert_not_awaited()
        with patch("web_reasoning_adapter.version", return_value="new-version"):
            with self.assertRaises(ValueError):
                self.client()

    async def test_cancellation_error_and_concurrency_release_context_without_cross_client_leak(self):
        client, other = self.client(), self.client()
        client.client, other.client = Mock(), Mock()
        started = asyncio.Event()
        async def pending(instance, prompt, **kwargs):
            self.assertIs(other._live_client, other.client)
            started.set()
            await asyncio.Event().wait()
        with patch.object(GeminiClient, "generate_content", pending):
            task = asyncio.create_task(client.generate_content("synthetic", model=MODEL, thinking_level="high"))
            await started.wait()
            with self.assertRaises(RuntimeError):
                await client.generate_content("synthetic", model=MODEL, thinking_level="low")
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertIs(client._live_client, client.client)
        with patch.object(GeminiClient, "generate_content", AsyncMock(side_effect=RuntimeError("synthetic"))):
            with self.assertRaises(RuntimeError):
                await client.generate_content("synthetic", model=MODEL, thinking_level="medium")
        self.assertIs(client._live_client, client.client)
        with patch.object(GeminiClient, "generate_content", AsyncMock(return_value="OK")):
            self.assertEqual(await client.generate_content("synthetic", model=MODEL, thinking_level="low"), "OK")
