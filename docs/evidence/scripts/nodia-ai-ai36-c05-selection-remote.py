"""Immutable C05 SQL integration: synthetic provider/proof transport, no accounts."""
from __future__ import annotations
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
archive = Path('/tmp/ai36-c05-selection-stage.tar')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
base = Path('/opt/nodia/verification/ai36-c05-selection-' + attempt)
base.mkdir(mode=0o700, exist_ok=False)
root = base / 'nodia-server'
root.mkdir(mode=0o700)
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        relative = PurePosixPath(member.name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert not member.issym() and not member.islnk()
        assert relative.parts[0] in ('dist', 'package.json', 'package-lock.json', 'test', '.tmp')
    bundle.extractall(root, filter='data')
manifest_path = root / '.tmp/ai36-c05-selection-stage-manifest.json'
manifest = json.loads(manifest_path.read_text())
assert manifest['fixture_namespace'] == 'ai3606'
for name, digest in manifest['files'].items():
    relative = PurePosixPath(name)
    assert not relative.is_absolute() and '..' not in relative.parts
    assert hashlib.sha256((root / relative).read_bytes()).hexdigest() == digest
assert not (root / '.env').exists()
os.symlink('/opt/nodia/verification/ai32-r02-20261018/node_modules', root / 'node_modules')
stdout, stderr = root / '.tmp/stdout.log', root / '.tmp/stderr.log'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
timeout = False
with stdout.open('x') as out, stderr.open('x') as err:
    try:
        result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai36-c05-selection.integration.mjs'],
                                cwd=root, stdout=out, stderr=err,
                                env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root',
                                     'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null'}, timeout=300)
        code = result.returncode
    except subprocess.TimeoutExpired:
        timeout, code = True, 124
remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai3606_', '--format', '{{.Names}}'], text=True).splitlines()
removed = []
for name in remaining:
    assert re.fullmatch(r'template_ai3606_[0-9]+_[a-f0-9]{8}', name)
    subprocess.run(['docker', 'rm', '-f', name], check=True, capture_output=True)
    removed.append(name)
left = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai3606_', '--format', '{{.Names}}'], text=True).splitlines()
raw, assertion = stdout.read_text(), None
for index, character in enumerate(raw):
    if character == '{':
        try:
            candidate = json.loads(raw[index:])
            if candidate.get('stage') == 'AI-36-C05':
                assertion = candidate
                break
        except (ValueError, AttributeError):
            pass
receipt = {'stage': 'AI-36-C05', 'scope': 'automatic_selection_actual_compiled_SQL_synthetic_transport',
           'attempt': attempt, 'status': 'passed' if code == 0 and not left else 'failed',
           'started_at_utc': started, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'exit_code': code, 'timeout': timeout, 'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
           'archive_sha256': expected, 'compiled_files_verified': manifest['compiled_files'],
           'harness_sha256': manifest['files']['test/nodia-ai-ai36-c05-selection.integration.mjs'],
           'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'stdout_sha256': hashlib.sha256(stdout.read_bytes()).hexdigest(),
           'stderr_sha256': hashlib.sha256(stderr.read_bytes()).hexdigest(), 'assertion_result': assertion,
           'actual_provider_generations': 0, 'configured_database_used': False, 'storage_operations': 0,
           'services_restarted': False, 'synthetic_publication_override': False,
           'disposable_containers_remaining': len(left), 'emergency_synthetic_fixture_cleanup': removed}
(root / '.tmp/receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
sys.exit(code)
