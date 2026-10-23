"""Verify the compiled journal in its isolated snapshot; no accounts or app bootstrap."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--work-name', required=True)
args = p.parse_args()
assert re.fullmatch(r'ai39-worker-integration-r[0-9]{2}', args.work_name)
root = Path('/opt/nodia/verification') / args.work_name
manifest = json.loads((root / 'verification-manifest.json').read_bytes())
for name, pin in manifest['files'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == pin
before = sorted(path.name for path in Path('/tmp').glob('nodia-ai39-journal-*'))
began = datetime.now(timezone.utc).isoformat()
result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai39-journal.integration.mjs'],
    cwd=root / 'nodia-server', timeout=40, capture_output=True,
    env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(root), 'LANG': 'C.UTF-8',
         'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null'})
after = sorted(path.name for path in Path('/tmp').glob('nodia-ai39-journal-*'))
fixture = None
try:
    fixture = json.loads(result.stdout)
except ValueError:
    pass
report = {'stage': 'AI39', 'scope': 'isolated_compiled_Linux_journal',
    'status': 'passed' if result.returncode == 0 and fixture is not None and before == after else 'failed',
    'began_VM_utc': began, 'finished_VM_utc': datetime.now(timezone.utc).isoformat(),
    'fixture': fixture, 'exit_code': result.returncode, 'fixture_resources_cleaned': before == after,
    'source_manifest_sha256': hashlib.sha256((root / 'verification-manifest.json').read_bytes()).hexdigest(),
    'stdout_bytes': len(result.stdout), 'stderr_bytes': len(result.stderr),
    'private_output_emitted': False, 'provider_requests': 0, 'operational_services_changed': 0,
    'configured_database_or_credentials_used': False}
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['status'] == 'passed' else 1)
