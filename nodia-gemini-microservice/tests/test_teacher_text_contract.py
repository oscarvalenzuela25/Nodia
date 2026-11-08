import test_support
from datetime import datetime, timedelta, timezone
import json
import unittest
from uuid import uuid4

from pydantic import ValidationError
from teacher_text_contract import TeacherStart, TeacherAnswer, command_hash
from teacher_text_execution import (parse_terminal, AGENT_NAME, TeacherExecutionError,
    TeacherFailure, classify_failure)
from service_errors import ServiceError
from pathlib import Path
import tempfile


def start_payload(**updates):
    value = dict(contract="teacher-agentic-text/1", operation_id=str(uuid4()), session_id=str(uuid4()),
        job_id=str(uuid4()), attempt_id=str(uuid4()), actor_id="1", connection_id="4",
        model_id="synthetic-model", effort_id="synthetic-effort", prompt="Synthetic private input",
        deadline_at=(datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat(),
        resource_key="gemini-profile:" + "a" * 64, configuration_generation="b" * 64,
        session_generation="c" * 32, runtime_hash="d" * 64, policy_hash="e" * 64)
    value.update(updates)
    value["request_hash"] = command_hash(value)
    return value


class TeacherContractTests(unittest.TestCase):
    def test_failure_classification_has_closed_codes_and_never_exception_or_provider_text(self):
        secret = "SYNTHETIC_PRIVATE_PROVIDER_OUTPUT_NOT_FOR_STORAGE"
        for error, expected in [
            (ValueError(secret), "runtime_failed"), (OSError(secret), "local_io_failed"),
            (ServiceError("agentic_timeout", secret), "cli_timeout"),
            (ServiceError(secret, secret), "cli_failed"),
        ]:
            failure = classify_failure(error)
            self.assertEqual(failure.code, expected)
            self.assertNotIn(secret, failure.model_dump_json())
        with self.assertRaises(ValidationError):
            TeacherFailure(stage="terminal", code=secret)
        with self.assertRaises(ValidationError):
            TeacherFailure(stage="terminal", code="runtime_failed", output=secret)

    def test_terminal_failures_distinguish_shape_policy_hook_and_answer_without_relaxing_acceptance(self):
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        receipt = root / "receipts.jsonl"
        receipt.write_text('{"tool":"finish","allowed":true}\n')
        init = {"event": "init", "init": {"model": "synthetic-model", "agent": AGENT_NAME, "tools": ["finish"]}}
        terminal = {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"text": "Synthetic"}}}
        encode = lambda events: "\n".join(json.dumps(event) for event in events)
        variants = [
            ("not-json", 0, "invalid_json"), (encode([terminal]), 0, "initialization_count"),
            (encode([{**init, "init": {**init["init"], "tools": ["finish", "shell"]}}, terminal]), 0, "tool_catalog_mismatch"),
            (encode([init, terminal]), 17, "process_exit_nonzero"),
            (encode([init]), 0, "result_count"),
            (encode([init, {"event": "result", "result": {"status": "ERROR", "error": "SYNTHETIC_PRIVATE"}}]), 0, "result_status_invalid"),
            (encode([init, {"event": "result", "result": {"status": "SUCCESS", "response": "SYNTHETIC_PRIVATE"}}]), 0, "answer_missing"),
            (encode([init, {"event": "result", "result": {"status": "SUCCESS", "structured_output": "SYNTHETIC_PRIVATE"}}]), 0, "answer_not_object"),
        ]
        for raw, code, expected in variants:
            with self.subTest(code=expected), self.assertRaises(TeacherExecutionError) as caught:
                parse_terminal(raw, code, receipt, "synthetic-model")
            self.assertEqual(caught.exception.failure.code, expected)
            self.assertNotIn("SYNTHETIC_PRIVATE", caught.exception.failure.model_dump_json())
        receipt.write_text('{"tool":"finish","allowed":true}\n' * 2)
        with self.assertRaises(TeacherExecutionError) as caught:
            parse_terminal(encode([init, terminal]), 0, receipt, "synthetic-model")
        self.assertEqual(caught.exception.failure.code, "hook_policy_rejected")

    def test_hash_binds_every_start_field_and_preserves_unicode(self):
        original = start_payload(prompt="Espa\u00f1a \U0001f9e0\n", model_id="sint\u00e9tico")
        command = TeacherStart.model_validate(original)
        self.assertEqual(command.request_hash, command_hash(dict(reversed(list(original.items())))))
        self.assertIn("Espa\u00f1a", json.dumps(original, ensure_ascii=False))
        for field, replacement in {"actor_id": "2", "session_id": str(uuid4()), "prompt": "changed",
                "effort_id": None, "deadline_at": "2026-11-02T00:00:00Z"}.items():
            with self.subTest(field=field), self.assertRaises(ValidationError):
                TeacherStart.model_validate({**original, field: replacement})

    def test_closed_contract_rejects_tools_and_ambiguous_identity(self):
        for field, value in {"actor_id": 1, "connection_id": "0", "session_id": "0" * 36,
                "job_id": "00000000-0000-0000-0000-000000000000", "effort_id": " ",
                "model_id": " synthetic", "deadline_at": "2026-11-01T12:00:00"}.items():
            with self.subTest(field=field), self.assertRaises(ValidationError):
                TeacherStart.model_validate(start_payload(**{field: value}))
        for field in ("tools", "attachments", "callback_url", "profile", "api_key", "chat_id"):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                TeacherStart.model_validate(start_payload(**{field: []}))

    def test_utf8_budgets_reject_overflow_without_truncating(self):
        self.assertEqual(len(TeacherStart.model_validate(start_payload(prompt="x" * 131072)).prompt), 131072)
        self.assertEqual(len(TeacherAnswer(text="x" * 32768).text), 32768)
        with self.assertRaises(ValidationError):
            TeacherStart.model_validate(start_payload(prompt="\u00e9" * 65537))
        with self.assertRaises(ValidationError):
            TeacherAnswer(text="\u00e9" * 16385)
        with self.assertRaises(ValidationError):
            TeacherAnswer(text=" ")
        self.assertEqual(len(TeacherStart.model_validate(start_payload(model_id="é" * 512)).model_id), 512)
        with self.assertRaises(ValidationError):
            TeacherStart.model_validate(start_payload(model_id="é" * 513))
        with self.assertRaises(ValidationError):
            TeacherStart.model_validate(start_payload(effort_id="é" * 129))

    def test_terminal_requires_exact_role_model_schema_and_single_finish_hook(self):
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        receipt = root / "receipts.jsonl"
        good = [{"event": "init", "init": {"model": "synthetic-model", "agent": AGENT_NAME, "tools": ["finish"]}},
            {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"text": "Synthetic"}}}]
        encode = lambda events: "\n".join(json.dumps(event) for event in events)
        receipt.write_text('{"tool":"finish","allowed":true}\n')
        self.assertEqual(parse_terminal(encode(good), 0, receipt, "synthetic-model").text, "Synthetic")
        variants = [
            [{"event": "init", "init": {**good[0]["init"], "model": "other-model"}}, good[1]],
            [{"event": "init", "init": {**good[0]["init"], "agent": "default"}}, good[1]],
            [*good, good[1]],
            [good[0], {"event": "result", "result": {"status": "SUCCESS", "denied_actions": ["shell"]}}],
            [good[0], {"event": "step_update", "step_update": {"tool_name": "view_file"}}, good[1]],
            [good[0], {"event": "step_update", "step_update": {"tool_name": "call_mcp_tool"}}, good[1]],
            [good[0], {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"text": "ok", "tools": []}}}],
        ]
        for events in variants:
            with self.subTest(events=events), self.assertRaises(ValueError):
                parse_terminal(encode(events), 0, receipt, "synthetic-model")
        for content in ('', '{"tool":"other","allowed":false}\n',
                '{"tool":"finish","allowed":true}\n' * 2, 'x' * 8193):
            receipt.write_text(content)
            with self.subTest(receipt=content[:40]), self.assertRaises(ValueError):
                parse_terminal(encode(good), 0, receipt, "synthetic-model")

    def test_terminal_requires_exact_advertised_catalog_even_without_tool_calls(self):
        root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        receipt = root / "receipts.jsonl"
        receipt.write_text('{"tool":"finish","allowed":true}\n')
        terminal = {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"text": "Synthetic"}}}
        for catalog in ([], ["finish", "run_command"], ["finish", "finish"], ["view_file"],
                "finish", {"finish": True}, None):
            init = {"event": "init", "init": {"model": "synthetic-model", "agent": AGENT_NAME, "tools": catalog}}
            with self.subTest(catalog=catalog), self.assertRaises(ValueError):
                parse_terminal(json.dumps(init) + "\n" + json.dumps(terminal), 0, receipt, "synthetic-model")
        missing = {"event": "init", "init": {"model": "synthetic-model", "agent": AGENT_NAME}}
        with self.assertRaises(ValueError):
            parse_terminal(json.dumps(missing) + "\n" + json.dumps(terminal), 0, receipt, "synthetic-model")
