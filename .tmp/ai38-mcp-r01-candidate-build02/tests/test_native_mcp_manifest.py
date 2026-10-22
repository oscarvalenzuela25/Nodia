"""Manifest structural depth must not consume the separately admitted catalog budget."""
import test_support
import copy
import json
from pathlib import Path
import tempfile
import unittest

from native_context_budget import McpTool, validate_catalog
from native_mcp_stdio import MAX_CATALOG_BYTES, MAX_MANIFEST_BYTES, StdioBridge, atomic, bounded_json, gate_detail, read_manifest


def boundary_tool():
    schema = {'type': 'object', 'additionalProperties': False, 'properties': {}}
    node = schema
    for _ in range(6):
        child = {'type': 'object', 'additionalProperties': False, 'properties': {}}
        node['properties']['child'] = child
        node = child
    node['properties']['leaf'] = {}
    return {'name': 'synthetic_prepare', 'description': 'Synthetic transport depth boundary, no business handler.', 'input_schema': schema}


def policy(tools):
    return {'tools': tools, 'rpc_budget': 128, 'tool_budget': 12, 'timeout_seconds': 1,
        'cli_json_string_arguments': True, 'documents': [],
        'context_budget': {'schema_version': 1, 'initial_utf8_bytes': 0, 'maximum_utf8_bytes': 262144}}


class NativeMcpManifestTests(unittest.TestCase):
    def test_admitted_depth16_catalog_materializes_and_lists_exact_schema(self):
        tool = boundary_tool()
        accepted = validate_catalog([McpTool.model_validate(tool)])
        self.assertEqual(accepted[0].model_dump(), tool)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'requests').mkdir()
            (root / 'responses').mkdir()
            manifest = root / 'manifest.json'
            atomic(manifest, policy([tool]), max_bytes=MAX_MANIFEST_BYTES)
            self.assertEqual(read_manifest(manifest)['tools'], [tool])
            bridge = StdioBridge(manifest)
            bridge.handle({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-11-25'}})
            bridge.handle({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
            listed = bridge.handle({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})
            self.assertEqual(listed['result']['tools'], [{'name': tool['name'], 'description': tool['description'], 'inputSchema': tool['input_schema']}])
            # Ordinary inputs still receive depth16, not the manifest's structural allowance.
            with self.assertRaisesRegex(ValueError, 'JSON depth'):
                bounded_json(manifest.read_bytes(), MAX_MANIFEST_BYTES)

    def test_one_extra_catalog_level_is_rejected_without_borrowing_envelope_allowance(self):
        tool = boundary_tool()
        node = tool['input_schema']
        for _ in range(6):
            node = node['properties']['child']
        node['properties']['leaf'] = {'description': 'one level too deep'}
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'manifest.json'
            atomic(manifest, policy([tool]), max_bytes=MAX_MANIFEST_BYTES)
            with self.assertRaisesRegex(ValueError, 'JSON depth'):
                read_manifest(manifest)

    def test_manifest_envelope_rejects_unknown_fields_and_deep_bombs(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'manifest.json'
            for extra in ('synthetic', {'deep': boundary_tool()}):
                value = {**policy([boundary_tool()]), 'extra': extra}
                atomic(manifest, value, max_bytes=MAX_MANIFEST_BYTES)
                with self.subTest(extra_type=type(extra).__name__), self.assertRaises(ValueError):
                    read_manifest(manifest)
            value = policy([boundary_tool()])
            value['context_budget']['extra'] = {'deep': boundary_tool()}
            atomic(manifest, value, max_bytes=MAX_MANIFEST_BYTES)
            with self.assertRaises(ValueError):
                read_manifest(manifest)

    def test_closed_budget_fields_preserve_smaller_limits_and_reject_invalid_values(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'manifest.json'
            value = policy([boundary_tool()])
            value.update(rpc_budget=3, tool_budget=1)
            atomic(manifest, value, max_bytes=MAX_MANIFEST_BYTES)
            self.assertEqual(read_manifest(manifest)['rpc_budget'], 3)
            for field, invalid in [('rpc_budget', 129), ('rpc_budget', True), ('tool_budget', 13), ('tool_budget', 0),
                    ('timeout_seconds', 121), ('timeout_seconds', False), ('cli_json_string_arguments', 1)]:
                changed = {**value, field: invalid}
                atomic(manifest, changed, max_bytes=MAX_MANIFEST_BYTES)
                with self.subTest(field=field, value=invalid), self.assertRaisesRegex(ValueError, 'Manifest budgets'):
                    read_manifest(manifest)

    def test_duplicates_nonfinite_collections_and_byte_caps_remain_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'manifest.json'
            raw = json.dumps(policy([boundary_tool()]), separators=(',', ':')).encode()
            for malformed in (raw[:-1] + b',"rpc_budget":128}', raw.replace(b'"rpc_budget":128', b'"rpc_budget":NaN'),
                    b'x' * (MAX_MANIFEST_BYTES + 1)):
                manifest.write_bytes(malformed)
                with self.subTest(length=len(malformed)), self.assertRaises(ValueError):
                    read_manifest(manifest)
            for field in ('tools', 'documents'):
                value = policy([boundary_tool()])
                value[field] = [copy.deepcopy(boundary_tool())] * 129
                atomic(manifest, value, max_bytes=MAX_MANIFEST_BYTES)
                with self.subTest(field=field), self.assertRaises(ValueError):
                    read_manifest(manifest)
            with self.assertRaisesRegex(ValueError, 'Message budget'):
                bounded_json(b'"' + b'x' * MAX_CATALOG_BYTES + b'"', MAX_CATALOG_BYTES)

    def test_envelope_change_cannot_authorize_foreign_server_tool_or_confirmation(self):
        names = {'synthetic_prepare'}
        valid = {'ServerName': 'nodia_runtime', 'ToolName': 'synthetic_prepare', 'Arguments': '{}'}
        self.assertTrue(gate_detail({'toolCall': {'name': 'call_mcp_tool', 'args': valid}}, names)[1])
        for changed in ({**valid, 'ServerName': 'foreign'}, {**valid, 'ToolName': 'nodia_confirm'}):
            self.assertFalse(gate_detail({'toolCall': {'name': 'call_mcp_tool', 'args': changed}}, names)[1])
        deep = {}
        for _ in range(17):
            deep = {'next': deep}
        self.assertFalse(gate_detail({'toolCall': {'name': 'call_mcp_tool', 'args': {**valid, 'Arguments': json.dumps(deep)}}}, names)[1])


if __name__ == '__main__':
    unittest.main()
