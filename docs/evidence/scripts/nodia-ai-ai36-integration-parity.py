"""Read-only parity of the executed disposable candidate and activated JS/assets."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

attempt = sys.argv[1]
assert re.fullmatch(r"attempt[0-9]{2}", attempt)
kind = sys.argv[2] if len(sys.argv) > 2 else 'integration'
assert kind in ('integration', 'regressions')
candidate = Path('/opt/nodia/verification/ai36-' + ('compiled-' if kind == 'integration' else 'regressions-') + attempt)
layout = sys.argv[3] if len(sys.argv) > 3 else 'flat'
assert layout in ('flat', 'workspace')
if layout == 'workspace':
    candidate = candidate / 'nodia-server'
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
manifest_file = candidate / ('.tmp/ai36-stage-manifest.json' if kind == 'integration' else '.tmp/ai36-regressions-stage-manifest.json')
manifest = json.loads(manifest_file.read_text())
for name, expected in manifest['files'].items():
    assert digest(candidate / name) == expected, name
checked, mismatches, excluded = [], [], []
for file in sorted((runtime / 'dist').rglob('*')):
    if not file.is_file():
        continue
    relative = file.relative_to(runtime).as_posix()
    if file.suffix not in ('.js', '.json', '.md'):
        excluded.append(relative)
        continue
    checked.append(relative)
    expected = manifest['files'].get(relative)
    if expected is None or digest(candidate / relative) != expected or digest(file) != expected:
        mismatches.append(relative)
assert checked and not mismatches, mismatches
containers = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai36_', '--format', '{{.Names}}'], text=True).splitlines()
assert not containers
units = {unit: subprocess.check_output(['systemctl', 'is-active', unit], text=True).strip() for unit in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
assert all(value == 'active' for value in units.values())
print(json.dumps({
    'stage': 'AI-36', 'scope': 'read_only_executed_candidate_runtime_parity',
    'status': 'passed', 'attempt': attempt,
    'staging_compiled_outputs': manifest['compiled_files'],
    'runtime_files': len(checked) + len(excluded),
    'runtime_javascript_json_and_knowledge_fragments_verified': len(checked),
    'runtime_non_executable_maps_and_declarations_excluded': excluded,
    'mismatches': mismatches,
    'manifest_sha256': digest(manifest_file),
    'staging_source_and_compiled_manifest_files_verified': len(manifest['files']),
    'integration_test_sha256': manifest['files']['test/nodia-ai-ai36.integration.mjs'],
    'disposable_containers_remaining': len(containers), 'units': units,
    'configured_database_used': False, 'provider_generations': 0,
    'storage_operations': 0, 'services_restarted': False,
}, indent=2))
