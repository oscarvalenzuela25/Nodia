"""Stage a hashed code-only archive at one new release path. Never activate services."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import tarfile

archive = Path('/tmp/nodia-ai-ai38-journal-r01.tar.gz')
target = Path('/opt/nodia/releases/nodia-server-ai38-journal-r01')
expected = json.loads(input())
assert set(expected) == {'archive_sha256', 'manifest_sha256'}
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected['archive_sha256']
assert not target.exists()
with tarfile.open(archive, 'r:gz') as source:
    members = source.getmembers()
    assert all(member.isfile() and not PurePosixPath(member.name).is_absolute() and '..' not in PurePosixPath(member.name).parts for member in members)
    assert len({member.name for member in members}) == len(members)
    manifest_bytes = source.extractfile('release-manifest.json').read()
    assert hashlib.sha256(manifest_bytes).hexdigest() == expected['manifest_sha256']
    manifest = json.loads(manifest_bytes)
    assert set(member.name for member in members) == set(manifest['files']) | {'release-manifest.json'}
    for member in members:
        payload = source.extractfile(member).read()
        if member.name != 'release-manifest.json':
            assert hashlib.sha256(payload).hexdigest() == manifest['files'][member.name]
        assert not member.name.endswith('.env') and 'node_modules' not in PurePosixPath(member.name).parts
    target.mkdir(mode=0o755)
    for member in members:
        destination = target / member.name
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        with destination.open('xb') as stream:
            stream.write(source.extractfile(member).read())
        os.chmod(destination, 0o644)
os.symlink('/opt/nodia/nodia-server/node_modules', target / 'node_modules')
print(json.dumps({'stage': 'AI-38', 'status': 'staged_not_activated', 'release': str(target),
                  'archive_sha256': expected['archive_sha256'], 'manifest_sha256': expected['manifest_sha256'],
                  'members': len(members), 'service_changes': 0, 'configured_SQL_writes': 0, 'provider_requests': 0}))
