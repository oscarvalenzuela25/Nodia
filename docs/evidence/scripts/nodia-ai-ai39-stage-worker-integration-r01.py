"""Stage a code-only, hashed snapshot for isolated tests; never activate services."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive-sha256', required=True)
parser.add_argument('--work-name', required=True)
args = parser.parse_args()
assert re.fullmatch(r'ai39-worker-integration-r[0-9]{2}', args.work_name)
assert re.fullmatch(r'[0-9a-f]{64}', args.archive_sha256)
raw = sys.stdin.buffer.read(64 * 1024 * 1024 + 1)
assert len(raw) <= 64 * 1024 * 1024
assert hashlib.sha256(raw).hexdigest() == args.archive_sha256
root = Path('/opt/nodia/verification') / args.work_name
assert not root.exists()
dependency_source = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
assert hashlib.sha256((dependency_source / 'release-manifest.json').read_bytes()).hexdigest() == '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
    members = archive.getmembers()
    assert len(members) <= 12000
    assert all(item.isfile() for item in members)
    names = [item.name for item in members]
    assert len(names) == len(set(names))
    assert sum(item.size for item in members) <= 128 * 1024 * 1024
    manifest = json.loads(archive.extractfile('verification-manifest.json').read())
    assert set(manifest) == {'stage', 'kind', 'files'}
    assert manifest['stage'] == 'AI39' and manifest['kind'] == 'isolated_code_snapshot_not_deployment'
    assert set(names) == set(manifest['files']) | {'verification-manifest.json'}
    for item in members:
        path = PurePosixPath(item.name)
        assert not path.is_absolute() and '..' not in path.parts
        assert 'node_modules' not in path.parts and not any(part.startswith('.env') for part in path.parts)
        assert item.name == 'verification-manifest.json' or path.parts[0] == 'nodia-server'
        assert item.name == 'verification-manifest.json' or (
            len(path.parts) >= 3 and path.parts[1] in {'dist', 'src', 'test', 'scripts'}
            or item.name in {'nodia-server/package.json', 'nodia-server/package-lock.json'})
        payload = archive.extractfile(item).read()
        if item.name != 'verification-manifest.json':
            assert hashlib.sha256(payload).hexdigest() == manifest['files'][item.name]
    root.mkdir(mode=0o700)
    for item in members:
        dest = root / item.name
        dest.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with dest.open('xb') as stream:
            stream.write(archive.extractfile(item).read())
        dest.chmod(0o600)
os.symlink(dependency_source / 'node_modules', root / 'nodia-server/node_modules', target_is_directory=True)
print(json.dumps(dict(stage='AI39', status='staged_isolated_not_activated',
    root=str(root), archive_sha256=args.archive_sha256,
    manifest_sha256=hashlib.sha256((root / 'verification-manifest.json').read_bytes()).hexdigest(),
    files=len(manifest['files']), source_dependencies='existing_read_only_Linux_node_modules',
    services_changed=0, configured_SQL_writes=0, provider_requests=0), indent=2))
