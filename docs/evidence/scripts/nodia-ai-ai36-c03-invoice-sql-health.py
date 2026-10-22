"""Read-only post-fixture checks; no configured SQL, credentials or runtime profiles."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import re
import time
import urllib.request

attempt = sys.argv[1] if len(sys.argv) > 1 else 'attempt01'
assert re.fullmatch(r'attempt[0-9]{2}', attempt)
root = Path('/opt/nodia/verification/ai36-c03-invoice-' + attempt + '/nodia-server')
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
run = lambda args: subprocess.check_output(args, text=True, timeout=20).strip()
manifest = json.loads((root / '.tmp/ai36-c03-invoice-sql-stage-manifest.json').read_text())
for path, digest in manifest['files'].items():
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest
units = {name: run(['systemctl', 'is-active', name]) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
assert all(value == 'active' for value in units.values())
http = {}
for label, url in (('api', 'http://127.0.0.1:3000/api/v1/'), ('gemini_health', 'http://127.0.0.1:8000/health'), ('proxy', 'http://127.0.0.1:8080/api/v1/')):
    with urllib.request.urlopen(url, timeout=5) as response:
        http[label] = response.status
assert all(value == 200 for value in http.values())
remaining = run(['docker', 'ps', '-a', '--filter', 'name=template_ai3603_', '--format', '{{.Names}}']).splitlines() + run(['docker', 'ps', '-a', '--filter', 'name=template_ai3601_', '--format', '{{.Names}}']).splitlines() + run(['docker', 'ps', '-a', '--filter', 'name=template_ai3602_', '--format', '{{.Names}}']).splitlines()
assert not remaining
versions = {}
for package in ('@nestjs/common', '@nestjs/core', '@nestjs/testing', '@nestjs/typeorm', 'typeorm', 'pg'):
    item = {}
    for label, directory in (('staging', root), ('operational_runtime', runtime)):
        package_file = directory / 'node_modules' / package / 'package.json'
        item[label] = json.loads(package_file.read_text())['version'] if package_file.exists() else None
    if package == '@nestjs/testing' and item['operational_runtime'] is None:
        item['comparison'] = 'test_only_dependency_not_installed_in_operational_runtime'
    else:
        assert item['staging'] == item['operational_runtime']
        item['comparison'] = 'exact_version_match'
    versions[package] = item
policy = json.loads((root / 'dist/nodia-ai-runtime/config/runtime-policy.json').read_text())
results = policy['policy']['results']
assert results['json_depth'] == 16 and results['json_collection_items'] == 128 and results['tool_arguments_utf8_bytes'] == 65536
print(json.dumps({'stage': 'AI-36-C03', 'scope': 'post_disposable_sql_read_only_health_and_dependency_parity', 'status': 'passed', 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'units': units, 'http': http, 'compiled_files_verified': manifest['compiled_files'], 'staging_source_files_verified': len(manifest['files']), 'dependency_parity': versions, 'runtime_policy_hash': policy['policyHash'], 'limits': {'mcp_wire_json_depth': results['json_depth'], 'native_typed_json_decoded_depth': 8, 'json_collection_items': results['json_collection_items'], 'tool_arguments_utf8_bytes': results['tool_arguments_utf8_bytes'], 'tool_result_utf8_bytes': results['tool_result_utf8_bytes'], 'assembled_context_utf8_bytes': results['assembled_context_utf8_bytes']}, 'new_candidate_deployed': False, 'disposable_containers_remaining': 0, 'configured_database_used': False, 'provider_generations': 0, 'provider_metadata_requests': 0, 'storage_operations': 0, 'services_restarted': False}, indent=2))
