"""Revalidate unchanged compiled integration contracts on the AI38 packet."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path('/opt/nodia/verification/ai38-acceptance01')
packet = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
manifest_bytes = (packet / 'manifest.json').read_bytes()
digest = lambda content: hashlib.sha256(content).hexdigest()
manifest_hash = digest(manifest_bytes)
assert manifest_hash == '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
manifest = json.loads(manifest_bytes)
schema = root / 'scripts/nodia-ai-knowledge/contracts.schema.json'
assert digest(schema.read_bytes()) == 'd9045282b8ffaa175fee7ea2eca8cb810ca20de216246a62456bd62062a146fd'
fixture_paths = ['test/nodia-ai.integration.fixture.mjs', 'test/nodia-ai-unpublished.fixture.mjs', 'test/nodia-ai-ai34.integration.mjs', 'test/nodia-ai-ai36.integration.mjs']
for path in fixture_paths:
    assert digest((root / path).read_bytes()) == manifest['files'][path]
for path, sha in manifest['files'].items():
    assert digest((packet / path).read_bytes()) == sha
output = root / 'regression-r01'
output.mkdir(exist_ok=False)
def containers():
    names = subprocess.check_output(['docker', 'ps', '-a', '--format', '{{.Names}}'], text=True).splitlines()
    return [name for name in names if name.startswith(('template_ai34_', 'template_ai36_'))]
assert containers() == []
results = []
for stage in ('ai36', 'ai34'):
    started = time.monotonic()
    result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-' + stage + '.integration.mjs'], cwd=root, capture_output=True, text=True, timeout=240)
    (output / (stage + '-stdout.json')).write_text(result.stdout, encoding='utf-8')
    (output / (stage + '-stderr.log')).write_text(result.stderr, encoding='utf-8')
    parsed = None
    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError:
        pass
    results.append({'stage': stage, 'exit_code': result.returncode, 'elapsed_seconds': round(time.monotonic()-started, 3), 'report': parsed,
                    'stdout_sha256': digest(result.stdout.encode()), 'stderr_sha256': digest(result.stderr.encode()), 'owned_containers_after': containers()})
    if result.returncode or parsed is None or containers():
        break
assert digest((packet / 'manifest.json').read_bytes()) == manifest_hash
for path, sha in manifest['files'].items():
    assert digest((packet / path).read_bytes()) == sha
passed = len(results) == 2 and all(item['exit_code'] == 0 and item['report'] is not None and item['owned_containers_after'] == [] for item in results)
report = {
    'stage': 'AI-38', 'status': 'passed' if passed else 'failed',
    'scope': 'current_compiled_cross_product_and_long_context_regression',
    'context': {'environment_id': 'ai38-isolated-ui-api-sql', 'package_manifest_sha256': manifest_hash},
    'checked_at_vm_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'fixture_hashes': {path: digest((root / path).read_bytes()) for path in fixture_paths},
    'external_schema_fixture': {'path': 'nodia-server/scripts/nodia-ai-knowledge/contracts.schema.json', 'sha256': digest(schema.read_bytes()), 'copied_outside_packet': True},
    'results': results, 'packet_files_unchanged': True, 'containers_after': containers(),
    'boundaries': {'current_real_compiled_use_cases': True, 'postgresql_disposable': True,
                   'synthetic_auth_and_redis': True, 'synthetic_context_adapter': True,
                   'synthetic_next_release_registration': True, 'real_provider_calls': 0,
                   'configured_database_used': False, 'storage_operations': 0,
                   'hot_reload_or_new_product_publication_verified': False,
                   'operational_deployment': False},
}
(output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
raise SystemExit(0 if passed else 1)
