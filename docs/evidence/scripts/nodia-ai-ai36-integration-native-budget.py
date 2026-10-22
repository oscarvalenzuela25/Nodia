"""Measure a captured synthetic catalog in a fresh, networkless native image.

Only pure native_context_budget is imported. No service entrypoint, SDK,
credentials, account, profile, volume, inference or live container is used.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import uuid

source = Path(sys.argv[1]).resolve()
assert source.name == 'ai36-full-catalog-context.json'
assert source.parent.name == '.tmp'
assert source.is_relative_to(Path('/opt/nodia/verification/ai36-regressions-attempt03/nodia-server'))
payload = source.read_bytes()
assert len(payload) <= 1048576
value = json.loads(payload)
assert value['selection']['model_id'] == 'synthetic-fixture-model'
image = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
name = 'template_ai36_budget_' + uuid.uuid4().hex
program = '''
import hashlib, json, sys
from native_context_budget import ContextMeasureRequest, measure_context
source = json.load(sys.stdin)
request = ContextMeasureRequest(model_id=source['selection']['model_id'], effort_id=None, canonical_prompt=source['canonical_prompt'], tools=source['tools'])
result = measure_context('agentic', request, {})
print(json.dumps({'measurement': result.model_dump(), 'tool_count': len(request.tools), 'initial_and_first_listing_utf8_bytes': result.total_utf8_bytes + result.first_mcp_listing_upper_bound_utf8_bytes, 'within_budget': result.total_utf8_bytes + result.first_mcp_listing_upper_bound_utf8_bytes <= result.max_utf8_bytes}))
'''
command = ['docker', 'run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '-e', 'PYTHONDONTWRITEBYTECODE=1', '--entrypoint', 'python', '-i', image, '-c', program]
try:
    completed = subprocess.run(command, input=payload, capture_output=True, timeout=30)
    assert completed.returncode == 0, completed.stderr.decode()
    result = json.loads(completed.stdout)
finally:
    subprocess.run(['docker', 'rm', '-f', name], capture_output=True, check=False)
print(json.dumps({'stage': 'AI-36', 'scope': 'pure_native_context_measurement_synthetic_catalog', 'status': 'passed', 'native_image': image, 'payload_sha256': hashlib.sha256(payload).hexdigest(), 'payload_source_remote': str(source), 'payload_source_local': '.tmp/ai36-native-budget-synthetic-input.json', 'source_sha256': hashlib.sha256(payload).hexdigest(), 'extractor_script_path': 'docs/evidence/scripts/nodia-ai-ai36-integration-native-budget.py', 'extractor_script_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), **result, 'network': 'none', 'read_only_filesystem': True, 'live_native_container_used': False, 'profiles_or_credentials_mounted': False, 'provider_generations': 0, 'provider_metadata_requests': 0}, indent=2))

