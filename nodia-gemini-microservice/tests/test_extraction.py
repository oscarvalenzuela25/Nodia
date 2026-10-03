import test_support
import json
import unittest

from invoice_parser import clean_and_parse_invoice_json, build_invoice_prompt
from service_errors import InvalidExtraction


class ExtractionTest(unittest.TestCase):
    def parse(self, item=None, **overrides):
        payload = {"code": None, "total_amount": None, "data": {"items": [item or {"name": "Producto"}]}}
        payload.update(overrides)
        return clean_and_parse_invoice_json(json.dumps(payload))

    def test_missing_numbers_stay_missing(self):
        result = self.parse()
        self.assertIsNone(result["total_amount"])
        self.assertIsNone(result["data"]["items"][0]["quantity"])

    def test_zero_is_not_replaced_or_derived_over(self):
        item = self.parse({"name": "Producto", "quantity": 0, "packages": 5, "units_per_package": 12,
                           "cost_price": 0, "total_price": 0}, total_amount=0)["data"]["items"][0]
        self.assertEqual(item["quantity"], 0)
        self.assertEqual(item["cost_price"], 0)
        self.assertEqual(item["total_price"], 0)

    def test_quantity_can_be_derived_from_two_explicit_factors(self):
        item = self.parse({"name": "Producto", "packages": 1.5, "units_per_package": 2})["data"]["items"][0]
        self.assertEqual(item["quantity"], 3)
        self.assertIsNone(self.parse({"name": "Producto", "packages": 2})["data"]["items"][0]["quantity"])

    def test_invalid_numeric_values_are_not_coerced(self):
        for value in (-1, "12", "bad", True, float("nan"), float("inf")):
            with self.subTest(value=value), self.assertRaises(InvalidExtraction):
                self.parse({"name": "Producto", "quantity": value})

    def test_invalid_items_and_dates_are_rejected(self):
        for payload in ({"items": []}, {"items": [None]}, {"items": [{"quantity": 1}]},
                        {"items": [{"name": "Producto"}], "issue_date": "2026-02-30"}):
            with self.assertRaises(InvalidExtraction):
                clean_and_parse_invoice_json(json.dumps({"data": payload}))

    def test_json_must_be_one_unambiguous_object(self):
        for text in ('{"data":{},"data":{}}', '{"data":', 'Explanation {"data": {}}', '[]'):
            with self.assertRaises(InvalidExtraction):
                clean_and_parse_invoice_json(text)
        text = json.dumps({"data": {"items": [{"name": "Producto"}]}})
        self.assertEqual(clean_and_parse_invoice_json(f"```json\n{text}\n```")["data"]["items"][0]["name"], "Producto")

    def test_template_does_not_fabricate_unconfigured_prices(self):
        text = json.dumps({"data": {"items": [{"name": "Producto", "cost_price": 10, "unit_price": 10}]}})
        result = clean_and_parse_invoice_json(text, has_any_config=True, has_code_config=True)
        self.assertIsNone(result["data"]["items"][0]["cost_price"])
        self.assertIsNone(result["data"]["items"][0]["unit_price"])
        self.assertIn("nunca asumas 1", build_invoice_prompt()[0])

    def test_derived_quantity_overflow_is_rejected(self):
        with self.assertRaises(InvalidExtraction):
            self.parse({"name": "Producto", "packages": 1e308, "units_per_package": 1e308})

    def test_template_does_not_derive_quantity_from_unconfigured_packages(self):
        text = json.dumps({"data": {"items": [{"name": "Producto", "packages": 10, "units_per_package": 12}]}})
        result = clean_and_parse_invoice_json(text, has_any_config=True, has_code_config=True,
                                              provider_fields={"code": "SKU"})
        self.assertIsNone(result["data"]["items"][0]["quantity"])
        self.assertIsNone(result["data"]["items"][0]["packages"])
