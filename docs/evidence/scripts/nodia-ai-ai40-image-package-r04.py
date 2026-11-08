"""Freeze R04 from the exact image-tested build; preserve immutable recovery code.

No build, installation, services, SQL, credentials or provider operation. Full
inventories stay with local recovery artifacts, not duplicated in evidence.
"""
from pathlib import Path
import hashlib
import io
import json
import tarfile

ROOT = Path(__file__).resolve().parents[3]
SERVER = ROOT / 'nodia-server'
ARTIFACTS = ROOT / 'ops/lab/artifacts'
CANDIDATE = ROOT / '.tmp/ai40-image-candidate-r01.tar.gz'
CANDIDATE_MANIFEST_SHA = 'df107764de9b1b53830263ac380d0e56ce9e38ef09cea5042f82a3be00f4bb2b'
R03_MANIFEST_SHA = '0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341'


def sha(value):
    return hashlib.sha256(value).hexdigest()


def write_once(path, value):
    with path.open('xb') as stream:
        stream.write(value)


with tarfile.open(CANDIDATE) as archive:
    raw = archive.extractfile('candidate-manifest.json').read()
    assert sha(raw) == CANDIDATE_MANIFEST_SHA
    candidate = json.loads(raw)
    for name, digest in candidate['source_sha256'].items():
        assert sha((SERVER / name).read_bytes()) == digest, 'source_changed_since_image_acceptance'
    for name, digest in candidate['files'].items():
        assert sha((SERVER / name).read_bytes()) == digest, 'build_changed_since_image_acceptance'

payloads = {}
with tarfile.open(ARTIFACTS / 'ai40-server-r03.tar.gz') as archive:
    raw = archive.extractfile('release-manifest.json').read()
    assert sha(raw) == R03_MANIFEST_SHA
    old = json.loads(raw)
    for name, digest in old['files'].items():
        if name.startswith('ops/') or name == 'scripts/nodia-ai-backups.mjs':
            value = archive.extractfile(name).read()
            assert sha(value) == digest
            payloads[name] = value

for folder in ('src', 'dist', 'scripts', 'config', 'test'):
    for path in sorted((SERVER / folder).rglob('*')):
        if not path.is_file() or path.is_symlink() or path.name.endswith('.spec.ts'):
            continue
        name = path.relative_to(SERVER).as_posix()
        parts = path.relative_to(SERVER).parts
        if any(part in ('node_modules', '__pycache__', '.cache', '.tmp') or part.startswith('.env') for part in parts):
            continue
        if path.suffix not in ('.ts', '.js', '.mjs', '.cjs', '.json', '.map', '.md', '.txt'):
            continue
        assert path.resolve().is_relative_to(SERVER.resolve())
        if name == 'scripts/nodia-ai-backups.mjs':
            assert sha(path.read_bytes()) == old['files'][name], 'recovery_entry_changed'
        else:
            payloads[name] = path.read_bytes()
for name in ('package.json', 'package-lock.json'):
    payloads[name] = (SERVER / name).read_bytes()
for name, digest in candidate['files'].items():
    assert sha(payloads[name]) == digest
assert {name for name in payloads if name.startswith('dist/')} == {
    name for name in candidate['files'] if name.startswith('dist/')}, 'compiled_inventory_changed'
pin = json.loads(payloads['dist/nodia-ai-context/config/knowledge-pin.json'])['release_id']
manifest = {'schema_version': 1, 'stage': 'AI40', 'knowledge_release': pin,
            'deployment_performed': False, 'release_authorized': False,
            'files': {name: sha(value) for name, value in sorted(payloads.items())}}
manifest_raw = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
write_once(ARTIFACTS / 'ai40-server-r04-manifest.json', manifest_raw)
archive_path = ARTIFACTS / 'ai40-server-r04.tar.gz'
with archive_path.open('xb') as stream:
    with tarfile.open(fileobj=stream, mode='w:gz') as archive:
        for name, value in sorted({**payloads, 'release-manifest.json': manifest_raw}.items()):
            member = tarfile.TarInfo(name)
            member.size, member.mode = len(value), 0o644
            archive.addfile(member, io.BytesIO(value))
plan = {'release': '/opt/nodia/releases/nodia-server-ai40-r04', 'manifest_sha256': sha(manifest_raw),
        'files': len(payloads), 'dist_outputs': sum(name.startswith('dist/') for name in payloads),
        'knowledge_release': pin, 'codex_profile_root': '/var/lib/nodia/codex'}
plan_raw = (json.dumps(plan, indent=2) + '\n').encode()
write_once(ROOT / 'docs/evidence/nodia-ai-ai40-adopt-plan-r04.json', plan_raw)
print(json.dumps({'stage': 'AI40', 'status': 'frozen_not_adopted', 'plan': plan,
                  'plan_sha256': sha(plan_raw), 'archive_sha256': sha(archive_path.read_bytes()),
                  'archive_bytes': archive_path.stat().st_size, 'candidate_manifest_sha256': CANDIDATE_MANIFEST_SHA,
                  'source_hashes_compared': len(candidate['source_sha256']),
                  'candidate_files_compared': len(candidate['files']),
                  'recovery_ops_and_backup_entry_preserved': True, 'provider_requests': 0}))
