"""AI-02 offline fixtures. No provider, profile, secrets or business writes."""
import asyncio
import json
import unittest

from experiments.nodia_ai_web_protocol import (
    Answer, FixtureGateway, PrepareRequest, ProbeTurn, ReadRequest, parse_reply,
)


def read_data() -> dict[str, object]:
    return {"kind": "tool_request", "call_id": "read-1", "tool": "fixture.availability.read",
            "arguments": {"property_id": "fixture-house", "start_date": "2026-11-10",
                          "end_date": "2026-11-12"}}


def prepare_data() -> dict[str, object]:
    return {"kind": "tool_request", "call_id": "prepare-1", "tool": "fixture.expense.prepare",
            "arguments": {"name": "Comida", "amount": "20000", "category_id": "fixture-food", "status": "paid"}}


class ProtocolTests(unittest.TestCase):
    def test_read_and_prepare_validate(self):
        self.assertIsInstance(parse_reply(json.dumps(read_data())), ReadRequest)
        self.assertIsInstance(parse_reply(json.dumps(prepare_data())), PrepareRequest)

    def test_complete_json_fence_is_explicitly_supported(self):
        self.assertIsInstance(parse_reply('```json\n{"kind":"answer","text":"OK"}\n```'), Answer)

    def test_free_text_multiple_objects_and_salvage_rejected(self):
        for reply in ('OK', '[]', 'prefix {"kind":"answer","text":"OK"}',
                      '{"kind":"answer","text":"OK"} {}'):
            with self.subTest(reply=reply), self.assertRaises(ValueError):
                parse_reply(reply)

    def test_duplicate_keys_and_nonfinite_values_rejected(self):
        for reply in ('{"kind":"answer","kind":"answer","text":"OK"}',
                      '{"kind":"answer","text":NaN}', '{"kind":"answer","text":Infinity}'):
            with self.subTest(reply=reply), self.assertRaises(ValueError):
                parse_reply(reply)

    def test_confirmation_execute_sql_and_http_are_not_dispatchable(self):
        for tool in ("confirm", "execute", "sql", "http", "fixture.expense.confirm"):
            data = prepare_data()
            data["tool"] = tool
            with self.subTest(tool=tool), self.assertRaises(ValueError):
                parse_reply(json.dumps(data))

    def test_hidden_identity_command_and_token_fields_rejected(self):
        for field in ("actor_id", "owner_id", "sql", "approval_token", "endpoint"):
            data = prepare_data()
            data["arguments"][field] = "untrusted"
            with self.subTest(field=field), self.assertRaises(ValueError):
                parse_reply(json.dumps(data))

    def test_paid_not_assumed_when_missing(self):
        data = prepare_data()
        del data["arguments"]["status"]
        with self.assertRaises(ValueError):
            parse_reply(json.dumps(data))

    def test_money_strict_no_coercion_or_fraction(self):
        for amount in (True, 20000, 20.5, "20.5", "0", "-1", "02", None):
            data = prepare_data()
            data["arguments"]["amount"] = amount
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                parse_reply(json.dumps(data))

    def test_invalid_empty_reverse_dates_rejected(self):
        for start, end in (("2026-02-30", "2026-03-02"), ("2026-11-12", "2026-11-10"),
                           ("2026-11-10", "2026-11-10")):
            data = read_data()
            data["arguments"].update(start_date=start, end_date=end)
            with self.subTest(start=start), self.assertRaises(ValueError):
                parse_reply(json.dumps(data))

    def test_reply_bytes_and_empty_text_bounded(self):
        for text in (" ", "x" * 16385):
            with self.subTest(size=len(text)), self.assertRaises(ValueError):
                parse_reply(json.dumps({"kind": "answer", "text": text}))

    def test_prepare_is_only_preview_without_confirmation_secrets(self):
        gateway = FixtureGateway("SYNTHETIC")
        result = gateway.dispatch(parse_reply(json.dumps(prepare_data())))
        self.assertFalse(result["executed"])
        self.assertEqual(result["state"], "awaiting_human_confirmation")
        self.assertNotIn("approval_token", json.dumps(result))
        self.assertEqual(len(gateway.receipts), 1)

    def test_duplicate_dispatch_is_deduplicated_and_result_is_copied(self):
        gateway = FixtureGateway("SYNTHETIC")
        request = parse_reply(json.dumps(read_data()))
        first = gateway.dispatch(request)
        first["available"] = False
        self.assertTrue(gateway.dispatch(request)["available"])
        self.assertEqual(len(gateway.receipts), 1)

    def test_reused_identity_different_intent_rejected(self):
        gateway = FixtureGateway("SYNTHETIC")
        gateway.dispatch(parse_reply(json.dumps(prepare_data())))
        data = prepare_data()
        data["arguments"]["amount"] = "21000"
        with self.assertRaises(ValueError):
            gateway.dispatch(parse_reply(json.dumps(data)))

    def test_answer_cannot_dispatch(self):
        with self.assertRaises(ValueError):
            FixtureGateway("SYNTHETIC").dispatch(Answer(kind="answer", text="Confirmo"))


class TurnTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_is_not_resent(self):
        async def send(_: str) -> str:
            return '{"kind":"answer","text":"OK"}'
        turn = ProbeTurn(send)
        self.assertIsInstance(await turn.run("synthetic"), Answer)
        with self.assertRaises(ValueError):
            await turn.run("synthetic")
        self.assertEqual(turn.sends, 1)

    async def test_lost_response_unknown_no_retry(self):
        async def send(_: str) -> str:
            raise ConnectionError("synthetic lost response after acceptance")
        turn = ProbeTurn(send)
        with self.assertRaises(ConnectionError):
            await turn.run("synthetic")
        self.assertEqual(turn.state, "unknown")
        with self.assertRaises(ValueError):
            await turn.run("synthetic")
        self.assertEqual(turn.sends, 1)

    async def test_timeout_unknown_no_retry(self):
        async def send(_: str) -> str:
            await asyncio.Event().wait()
            return "unreachable"
        turn = ProbeTurn(send, timeout=0.01)
        with self.assertRaises(TimeoutError):
            await turn.run("synthetic")
        self.assertEqual((turn.state, turn.sends), ("unknown", 1))

    async def test_cancel_propagates_and_preserves_unknown(self):
        started = asyncio.Event()
        async def send(_: str) -> str:
            started.set()
            await asyncio.Event().wait()
            return "unreachable"
        turn = ProbeTurn(send)
        task = asyncio.create_task(turn.run("synthetic"))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual((turn.state, turn.sends), ("unknown", 1))

    async def test_invalid_output_is_not_success_or_automatically_repaired(self):
        async def send(_: str) -> str:
            return "not JSON"
        turn = ProbeTurn(send)
        with self.assertRaises(ValueError):
            await turn.run("synthetic")
        self.assertEqual((turn.state, turn.sends), ("invalid_response", 1))


if __name__ == "__main__":
    unittest.main()
