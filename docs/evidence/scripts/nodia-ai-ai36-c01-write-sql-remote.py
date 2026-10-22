"""Immutable private staging and disposable SQL execution; never reads service settings."""
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
assert re.fullmatch(r"[a-f0-9]{64}", expected)
assert re.fullmatch(r"attempt[0-9]{2}", attempt)
archive = Path('/tmp/ai36-c01-write-sql-stage.tar')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
base = Path('/opt/nodia/verification/ai36-c01-write-' + attempt)
base.mkdir(mode=0o700, exist_ok=False)
root = base / 'nodia-server'
root.mkdir(mode=0o700)
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        relative = PurePosixPath(member.name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert not member.issym() and not member.islnk()
        assert relative.parts[0] in ('dist', 'package.json', 'package-lock.json', 'test', 'scripts', '.tmp')
    bundle.extractall(root, filter='data')
manifest_path = root / '.tmp/ai36-c01-write-sql-stage-manifest.json'
manifest = json.loads(manifest_path.read_text())
for name, digest in manifest['files'].items():
    relative = PurePosixPath(name)
    assert not relative.is_absolute() and '..' not in relative.parts
    assert hashlib.sha256((root / relative).read_bytes()).hexdigest() == digest
assert not (root / '.env').exists()
assert manifest['fixture_namespace'] == 'ai3601'
os.symlink('/opt/nodia/verification/ai32-r02-20261018/node_modules', root / 'node_modules')
versions = {}
for package in ('@nestjs/common', '@nestjs/core', '@nestjs/testing', '@nestjs/typeorm', 'typeorm', 'pg'):
    versions[package] = json.loads((root / 'node_modules' / package / 'package.json').read_text())['version']
stdout, stderr = root / '.tmp/stdout.log', root / '.tmp/stderr.log'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
timeout = False
with stdout.open('x') as out, stderr.open('x') as err:
    try:
        result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai36-write-preparation.integration.mjs'], cwd=root, stdout=out, stderr=err, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null'}, timeout=300)
        code = result.returncode
    except subprocess.TimeoutExpired:
        timeout = True
        code = 124
remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai3601_', '--format', '{{.Names}}'], text=True).splitlines()
emergency_cleanup = []
for name in remaining:
    assert re.fullmatch(r'template_ai3601_[0-9]+_[a-f0-9]{8}', name)
    subprocess.run(['docker', 'rm', '-f', name], check=True, capture_output=True)
    emergency_cleanup.append(name)
left = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai3601_', '--format', '{{.Names}}'], text=True).splitlines()
raw = stdout.read_text()
assertion = None
for index in range(len(raw)):
    if raw[index] == '{':
        try:
            candidate = json.loads(raw[index:])
            if candidate.get('stage') == 'AI-36-C01':
                assertion = candidate
                break
        except (ValueError, AttributeError):
            pass
receipt = {'stage': 'AI-36-C01', 'scope': 'compiled_worker_mcp_write_preparation_disposable_sql', 'attempt': attempt, 'status': 'passed' if code == 0 and not left else 'failed', 'started_at_utc': started, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exit_code': code, 'timeout': timeout, 'fixture_namespace': 'ai3601', 'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(), 'archive_sha256': expected, 'compiled_files_verified': manifest['compiled_files'], 'source_sha256': manifest['files']['test/nodia-ai-ai36-write-preparation.integration.mjs'], 'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'stdout_sha256': hashlib.sha256(stdout.read_bytes()).hexdigest(), 'stderr_sha256': hashlib.sha256(stderr.read_bytes()).hexdigest(), 'dependency_versions': versions, 'assertion_result': assertion, 'configured_database_used': False, 'actual_provider_generations': 0, 'storage_operations': 0, 'production_services_restarted': False, 'production_publication': False, 'disposable_containers_remaining': len(left), 'emergency_cleanup': emergency_cleanup}
(root / '.tmp/receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
sys.exit(code)
