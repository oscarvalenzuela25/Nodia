"""Receive exact public code archive via stdin; validate every member before staging."""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import io
import json
import os
import sys
import tarfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--archive-sha256', required=True)
p.add_argument('--manifest-sha256', required=True)
a = p.parse_args()
root = Path('/opt/nodia/releases/nodia-server-ai40-r03')
assert not root.exists()
data = sys.stdin.buffer.read(128 * 1024 * 1024 + 1)
assert len(data) <= 128 * 1024 * 1024 and hashlib.sha256(data).hexdigest() == a.archive_sha256
with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
    members = archive.getmembers()
    assert len(members) <= 20001 and len({m.name for m in members}) == len(members)
    for m in members:
        path = PurePosixPath(m.name)
        assert m.isfile() and m.name == path.as_posix() and not path.is_absolute() and '..' not in path.parts
        assert '\\' not in m.name and 'node_modules' not in path.parts and not any(p.startswith('.env') for p in path.parts)
        assert m.size <= 32 * 1024 * 1024
    raw = archive.extractfile('release-manifest.json').read()
    assert hashlib.sha256(raw).hexdigest() == a.manifest_sha256
    manifest = json.loads(raw)
    assert manifest['stage'] == 'AI40'
    assert set(m.name for m in members) == set(manifest['files']) | {'release-manifest.json'}
    for m in members:
        if m.name != 'release-manifest.json':
            assert hashlib.sha256(archive.extractfile(m).read()).hexdigest() == manifest['files'][m.name]
    root.mkdir(mode=0o755)
    for m in members:
        path = root / m.name
        path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        with path.open('xb') as out: out.write(archive.extractfile(m).read())
        path.chmod(0o644)
os.symlink('/opt/nodia/nodia-server/node_modules', root / 'node_modules')
print(json.dumps({'stage': 'AI40', 'status': 'staged_not_activated', 'root': str(root),
    'manifest_sha256': a.manifest_sha256, 'files': len(manifest['files']),
    'service_changes': 0, 'provider_requests': 0, 'configured_SQL_writes': 0}))
