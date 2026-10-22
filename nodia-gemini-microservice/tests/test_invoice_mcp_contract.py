"""Pure native invoice rules, private transport and no nested generation."""
import test_support
import importlib
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from invoice_mcp_contract import (
    INVOICE_MCP_CONTRACT_PATH, INVOICE_MCP_CONTRACT_VERSION,
    MAX_INVOICE_MCP_BYTES, InvoiceMcpContractRequest,
    invoice_mcp_contract, parse_invoice_mcp_contract,
)
from invoice_parser import build_invoice_prompt, clean_and_parse_invoice_json
from service_errors import InvalidExtraction, ServiceError
from test_support import AppTestCase, HEADERS


def extraction(**item):
    return {"code": " FACT-0 ", "total_amount": 0, "data": {
        "issue_date": "2026-10-18", "items": [{"name": "  Arroz  ", **item}],
    }}


def payload(action="prepare", **values):
    return {"action": action, "provider_fields": None, "tax": None, **values}


def parsed(value):
    return parse_invoice_mcp_contract(json.dumps(value, ensure_ascii=False).encode())


class InvoiceMcpPureContractTests(unittest.TestCase):
    def test_prepare_uses_exact_native_structured_prompt_and_real_zero_tax(self):
        fields = {"code": {"value": "SKU", "instructions": "Usar columna izquierda"},
                  "packages": "Cajas"}
        for tax in (None, 0, 19, 100):
            with self.subTest(tax=tax):
                result = invoice_mcp_contract(parsed(payload(provider_fields=fields, tax=tax)))
                self.assertEqual(result.contract_version, INVOICE_MCP_CONTRACT_VERSION)
                self.assertEqual(result.instructions, build_invoice_prompt(fields, tax, structured_output=True)[0])
                self.assertNotIn("entre bloques de código", result.instructions)
        self.assertEqual(build_invoice_prompt(None, 0)[-1], 0)
        self.assertEqual(build_invoice_prompt(None, None)[-1], 19)

    def test_normalize_reuses_native_parser_without_guessing_missing_values(self):
        original = extraction(quantity=0, packages=None, unit_price=0)
        result = invoice_mcp_contract(parsed(payload("normalize", extraction=original)))
        flags = build_invoice_prompt(None, None)
        native = clean_and_parse_invoice_json(json.dumps(original), *flags[1:], provider_fields=None)
        self.assertEqual(result.extraction.model_dump(), native)
        item = result.extraction.data.items[0]
        self.assertEqual(item.quantity, 0)
        self.assertEqual(item.unit_price, 0)
        self.assertIsNone(item.cost_price)
        self.assertIsNone(item.packages)
        self.assertEqual(item.name, "Arroz")
        self.assertEqual(result.extraction.total_amount, 0)

    def test_template_masks_only_fields_native_parser_masks_and_preserves_total(self):
        value = extraction(code="SKU", quantity=None, packages=2, units_per_package=3,
                           cost_price=8, cost_price_tax=9, unit_price=10, total_price=60)
        fields = {"code": "SKU", "packages": "Cajas"}
        result = invoice_mcp_contract(parsed(payload("normalize", provider_fields=fields, extraction=value)))
        item = result.extraction.data.items[0]
        self.assertEqual(item.code, "SKU")
        self.assertEqual(item.packages, 2)
        self.assertIsNone(item.units_per_package)
        self.assertIsNone(item.quantity)
        self.assertIsNone(item.cost_price)
        self.assertIsNone(item.cost_price_tax)
        self.assertIsNone(item.unit_price)
        self.assertEqual(item.total_price, 60)

    def test_derived_quantity_preserves_explicit_zero_and_missing_factor(self):
        for supplied, expected in (({"packages": 2, "units_per_package": 3}, 6),
                                   ({"packages": 2, "units_per_package": 3, "quantity": 0}, 0),
                                   ({"packages": 0, "units_per_package": 3}, 0),
                                   ({"packages": 2}, None)):
            with self.subTest(supplied=supplied):
                result = invoice_mcp_contract(parsed(payload("normalize", extraction=extraction(**supplied))))
                self.assertEqual(result.extraction.data.items[0].quantity, expected)

    def test_derived_quantity_overflow_is_rejected_by_native_parser(self):
        command = parsed(payload("normalize", extraction=extraction(packages=1e308, units_per_package=1e308)))
        with self.assertRaises(InvalidExtraction):
            invoice_mcp_contract(command)

    def test_native_dates_zero_null_and_closed_items_are_validated_before_masking(self):
        invalid = []
        for field, value in (("quantity", True), ("quantity", "3"), ("quantity", -1),
                             ("cost_price", -1), ("name", " "), ("name", "x" * 1025),
                             ("unexpected", "private")):
            invalid.append(extraction(**{field: value}))
        bad_date = extraction()
        bad_date["data"]["issue_date"] = "2026-02-30"
        invalid.append(bad_date)
        for value in invalid:
            with self.subTest(value=value):
                with self.assertRaises(ServiceError):
                    parsed(payload("normalize", provider_fields={"code": "SKU"}, extraction=value))

    def test_strict_action_envelope_and_provider_projection_reject_unknown_inputs(self):
        invalid = [payload(action="run"), payload("normalize"), payload(extraction=None),
                   payload(provider_fields={"name": "No es una columna configurable"}),
                   payload(provider_fields={"code": {"value": "SKU", "secret": "no"}}),
                   payload(provider_fields={"code": False}), payload(tax=True), payload(tax=-1),
                   payload(tax=101), payload(tax="19"), payload(model="must-not-select"),
                   {"action": "prepare", "provider_fields": None}]
        for value in invalid:
            with self.subTest(value=value):
                with self.assertRaises(ServiceError):
                    parsed(value)

    def test_item_count_is_bounded_without_silent_truncation(self):
        value = extraction()
        value["data"]["items"] = [{"name": "Arroz"}] * 100
        self.assertEqual(len(invoice_mcp_contract(parsed(payload("normalize", extraction=value))).extraction.data.items), 100)
        value["data"]["items"].append({"name": "Arroz"})
        with self.assertRaises(ServiceError):
            parsed(payload("normalize", extraction=value))

    def test_raw_json_rejects_duplicates_non_finite_depth_cardinality_and_bytes(self):
        bad = [b'{"action":"prepare","action":"normalize","provider_fields":null,"tax":null}',
               b'{"action":"prepare","provider_fields":null,"tax":NaN}',
               b'{"action":"prepare","provider_fields":null,"tax":Infinity}',
               b'{"action":"prepare","provider_fields":null,"tax":1e400}',
               json.dumps({"unexpected": [None] * 129}).encode(),
               b'[' * 18 + b'0' + b']' * 18, b' ' * (MAX_INVOICE_MCP_BYTES + 1)]
        for raw in bad:
            with self.subTest(length=len(raw)):
                with self.assertRaises(ServiceError):
                    parse_invoice_mcp_contract(raw)

    def test_import_has_no_environment_profile_or_filesystem_initialization(self):
        import invoice_mcp_contract
        with patch("dotenv.load_dotenv", side_effect=AssertionError("No environment")), \
             patch.object(Path, "mkdir", side_effect=AssertionError("No filesystem")), \
             patch("profile_admission.ProfileAdmission.reserve", side_effect=AssertionError("No profile")):
            importlib.reload(invoice_mcp_contract)


class InvoiceMcpHttpContractTests(AppTestCase):
    def post(self, value=None, **options):
        return self.client.post(INVOICE_MCP_CONTRACT_PATH, headers=HEADERS,
                                json=payload() if value is None else value, **options)

    def test_private_auth_happens_before_json_parsing_and_has_safe_errors(self):
        with patch("invoice_mcp_contract.parse_invoice_mcp_contract", side_effect=AssertionError("No parsing")):
            for headers in ({}, {"X-Nodia-Service-Token": "wrong"}):
                result = self.client.post(INVOICE_MCP_CONTRACT_PATH, headers=headers, content=b"not json")
                self.assertEqual(result.status_code, 401)
                self.assertEqual(result.json()["code"], "service_unauthorized")

    def test_prepare_and_normalize_do_not_touch_profile_generation_or_storage(self):
        with patch("profile_admission.ProfileAdmission.reserve", side_effect=AssertionError("No profile")), \
             patch("main.execute_analysis", side_effect=AssertionError("No OCR")), \
             patch.object(Path, "read_bytes", side_effect=AssertionError("No attachment")):
            prepared = self.post()
            self.assertEqual(prepared.status_code, 200)
            self.assertEqual(set(prepared.json()), {"contract_version", "instructions"})
            normalized = self.post(payload("normalize", extraction=extraction(quantity=0)))
            self.assertEqual(normalized.status_code, 200)
            self.assertEqual(set(normalized.json()), {"contract_version", "extraction"})
            self.assertEqual(normalized.json()["extraction"]["data"]["items"][0]["quantity"], 0)
        self.web.analyze_invoice.assert_not_awaited()
        self.assertEqual(list(Path(self.directory).iterdir()), [])

    def test_64k_actual_body_limit_is_enforced_before_parser(self):
        with patch("invoice_mcp_contract.parse_invoice_mcp_contract", side_effect=AssertionError("No parsing")):
            bodies = [b"x" * (MAX_INVOICE_MCP_BYTES + 1),
                      iter([b"x" * 32768, b"x" * 32768, b"x"])]
            for body in bodies:
                result = self.client.post(INVOICE_MCP_CONTRACT_PATH, headers=HEADERS, content=body)
                self.assertEqual(result.status_code, 413)
                self.assertEqual(result.json()["code"], "body_too_large")

    def test_invalid_extraction_and_derived_overflow_never_leak_input(self):
        result = self.post(payload("normalize", extraction=extraction(packages=1e308, units_per_package=1e308)))
        self.assertEqual(result.status_code, 422)
        self.assertEqual(result.json()["code"], "invalid_invoice_extraction")
        result = self.post(payload(secret="synthetic-private-marker"))
        self.assertEqual(result.status_code, 422)
        self.assertNotIn("synthetic-private-marker", result.text)
        self.assertIn("request_id", result.json())

    def test_openapi_documents_closed_request_and_private_response_shapes(self):
        schema = self.client.get("/openapi.json", headers=HEADERS).json()
        operation = schema["paths"][INVOICE_MCP_CONTRACT_PATH]["post"]
        request = operation["requestBody"]["content"]["application/json"]["schema"]
        self.assertIs(request["additionalProperties"], False)
        self.assertEqual(set(request["required"]), {"action", "provider_fields", "tax"})
        self.assertIn("responses", operation)
