"""Execute the live harness's exact assertions with synthetic transport only."""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

expected, attempt = sys.argv[1:3]
assert re.fullmatch(r'[a-f0-9]{64}', expected)
assert re.fullmatch(r'attempt[0-9]{2}', attempt)
archive = Path('/tmp/ai36-c05-semantic-control-stage.tar')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-semantic-control-' + attempt) / 'nodia-server'
root.mkdir(parents=True, mode=0o700, exist_ok=False)
with tarfile.open(archive) as packet:
    for member in packet.getmembers():
        name = PurePosixPath(member.name)
        assert not name.is_absolute() and '..' not in name.parts
        assert not member.issym() and not member.islnk()
        assert name.parts[0] in ('dist', 'test', '.tmp', 'package.json', 'package-lock.json')
    packet.extractall(root, filter='data')
manifest_path = root / '.tmp/ai36-c05-semantic-control-stage-manifest.json'
manifest = json.loads(manifest_path.read_text())
assert manifest['semantic_control_only'] is True and manifest['fixture_namespace'] == 'ai3607'
for name, digest in manifest['files'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
assert not (root / '.env').exists()
os.symlink('/opt/nodia/verification/ai32-r02-20261018/node_modules', root / 'node_modules')
stdout, stderr, report_path = (root / '.tmp' / name for name in ('stdout.log', 'stderr.log', 'control-report.json'))
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
timeout, code = False, 1
with stdout.open('x') as out, stderr.open('x') as err:
    try:
        process = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai36-c05-live.integration.mjs'],
            cwd=root, stdout=out, stderr=err, timeout=300,
            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test',
                 'DOTENV_CONFIG_PATH': '/dev/null', 'NODIA_AI_ALLOW_LIVE': 'no',
                 'NODIA_AI_C05_SEMANTIC_CONTROL': 'yes', 'NODIA_AI_C05_OUTPUT': str(report_path),
                 'NODIA_AI_C05_DISCOVERY_ONLY': 'yes' if manifest.get('discovery_only') else 'no'})
        code = process.returncode
    except subprocess.TimeoutExpired:
        timeout, code = True, 124
assertion = json.loads(report_path.read_text()) if report_path.exists() else None
remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai3607_', '--format', '{{.Names}}'], text=True).splitlines()
receipt = {'stage': 'AI-36-C05', 'scope': 'same_live_harness_all_semantic_assertions_real_SQL_synthetic_transport',
    'attempt': attempt, 'status': 'passed' if code == 0 and not remaining else 'failed',
    'started_at_utc': started, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'exit_code': code, 'timeout': timeout, 'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    'archive_sha256': expected, 'harness_sha256': manifest['files']['test/nodia-ai-ai36-c05-live.integration.mjs'],
    'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'stdout_sha256': hashlib.sha256(stdout.read_bytes()).hexdigest(),
    'stderr_sha256': hashlib.sha256(stderr.read_bytes()).hexdigest(),
    'assertion_result': assertion, 'actual_provider_generations': 0,
    'configured_database_used': False, 'operational_environment_read': False,
    'synthetic_publication_override': False, 'storage_operations': 0,
    'services_restarted': False, 'disposable_containers_remaining': len(remaining)}
(root / '.tmp/receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
sys.exit(code if code else 1 if remaining else 0)
