"""AI34 current compiled context, with all publication families explicitly empty."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path('/opt/nodia/verification/ai38-acceptance01')
packet = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
digest = lambda value: hashlib.sha256(value).hexdigest()
manifest_hash = digest((packet / 'manifest.json').read_bytes())
assert manifest_hash == '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
manifest = json.loads((packet / 'manifest.json').read_bytes())
paths = [
    'test/nodia-ai.integration.fixture.mjs',
    'test/nodia-ai-unpublished.fixture.mjs',
    'test/nodia-ai-ai34.integration.mjs',
    'test/nodia-ai-ai38-context-profile.mjs',
    'test/nodia-ai-ai38-empty-publication.fixture.mjs',
    'scripts/nodia-ai-knowledge/contracts.schema.json',
]
hashes = {path: digest((root / path).read_bytes()) for path in paths}
for path in paths[:3]:
    assert hashes[path] == manifest['files'][path]
assert hashes[paths[-1]] == 'd9045282b8ffaa175fee7ea2eca8cb810ca20de216246a62456bd62062a146fd'
for path, sha in manifest['files'].items():
    assert digest((packet / path).read_bytes()) == sha
output = root / 'context-r02'
output.mkdir(exist_ok=False)
def containers():
    names = subprocess.check_output(['docker', 'ps', '-a', '--format', '{{.Names}}'], text=True).splitlines()
    return [name for name in names if name.startswith('template_ai34_')]
assert containers() == []
started = time.monotonic()
result = subprocess.run(['/usr/local/bin/node', '--import', './test/nodia-ai-ai38-context-profile.mjs', 'test/nodia-ai-ai34.integration.mjs'], cwd=root, capture_output=True, text=True, timeout=240)
(output / 'stdout.json').write_text(result.stdout, encoding='utf-8')
(output / 'stderr.log').write_text(result.stderr, encoding='utf-8')
parsed = None
try:
    parsed = json.loads(result.stdout)
except json.JSONDecodeError:
    pass
for path, sha in manifest['files'].items():
    assert digest((packet / path).read_bytes()) == sha
report = {
    'stage': 'AI-38', 'status': 'passed' if result.returncode == 0 and parsed and containers() == [] else 'failed',
    'scope': 'current_compiled_long_context_empty_publication_compatibility_profile',
    'context': {'environment_id': 'ai38-isolated-ui-api-sql', 'package_manifest_sha256': manifest_hash},
    'checked_at_vm_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'elapsed_seconds': round(time.monotonic()-started, 3), 'exit_code': result.returncode,
    'fixture_hashes': hashes, 'historical_test_body_unchanged': True,
    'publication_families_explicitly_empty': ['product_reads', 'write_tools', 'invoice_analysis', 'common_reads', 'common_preparation'],
    'report': parsed, 'stdout_sha256': digest(result.stdout.encode()), 'stderr_sha256': digest(result.stderr.encode()),
    'packet_files_unchanged': True, 'containers_after': containers(),
    'boundaries': {'synthetic_context_adapter': True, 'real_provider_calls': 0, 'configured_database_used': False,
                   'storage_operations': 0, 'actual_published_content_acceptance': False,
                   'new_product_or_hot_reload_verified': False, 'operational_deployment': False},
}
(output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['status'] == 'passed' else 1)
