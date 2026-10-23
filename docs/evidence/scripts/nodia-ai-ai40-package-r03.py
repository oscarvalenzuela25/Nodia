"""Freeze complete code/assets and preserve pinned recovery operations. No VM or secrets."""
from pathlib import Path, PurePosixPath
import hashlib
import io
import json
import tarfile

ROOT = Path(__file__).resolve().parents[3]
SERVER = ROOT / 'nodia-server'
base_path = ROOT / 'docs/evidence/nodia-ai-ai38-owner-deploy-package-r01.json'
assert hashlib.sha256(base_path.read_bytes()).hexdigest() == '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
base = json.loads(base_path.read_bytes())
payloads = {}
# Recovery ops are immutable public code absent from the workspace, retained from the frozen archive.
with tarfile.open(ROOT / 'ops/lab/artifacts/ai38-owner-deploy-r01.tar.gz') as old:
    for name, pin in base['files'].items():
        if name.startswith('ops/'):
            value = old.extractfile(name).read()
            assert hashlib.sha256(value).hexdigest() == pin
            payloads[name] = value
for folder in ('src', 'dist', 'scripts', 'config', 'test'):
    for path in sorted((SERVER / folder).rglob('*')):
        if not path.is_file() or path.is_symlink() or path.name.endswith('.spec.ts'):
            continue
        relative = path.relative_to(SERVER).as_posix()
        parts = PurePosixPath(relative).parts
        if any(p in ('node_modules', '__pycache__', '.cache') for p in parts):
            continue
        if path.suffix not in ('.ts', '.js', '.mjs', '.cjs', '.json', '.map', '.md', '.txt'):
            continue
        assert not any(p.startswith('.env') for p in parts)
        assert path.resolve().is_relative_to(SERVER.resolve())
        payloads[relative] = path.read_bytes()
for name in ('package.json', 'package-lock.json'):
    payloads[name] = (SERVER / name).read_bytes()
for name in base['files']:
    if name.startswith('ops/') or name == 'scripts/nodia-ai-backups.mjs':
        assert hashlib.sha256(payloads[name]).hexdigest() == base['files'][name]
pin = json.loads((SERVER / 'dist/nodia-ai-context/config/knowledge-pin.json').read_bytes())['release_id']
manifest = {'schema_version': 1, 'stage': 'AI40', 'knowledge_release': pin,
    'deployment_performed': False, 'release_authorized': False,
    'files': {k: hashlib.sha256(v).hexdigest() for k, v in sorted(payloads.items())}}
raw = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
manifest_name = 'docs/evidence/nodia-ai-ai40-server-package-r03.json'
with (ROOT / manifest_name).open('xb') as out: out.write(raw)
archive = ROOT / '.tmp/ai40-server-r03.tar.gz'
with archive.open('xb') as file:
    with tarfile.open(fileobj=file, mode='w:gz') as output:
        for name, value in sorted({**payloads, 'release-manifest.json': raw}.items()):
            member = tarfile.TarInfo(name); member.size = len(value); member.mode = 0o644
            output.addfile(member, io.BytesIO(value))
plan = {'release': '/opt/nodia/releases/nodia-server-ai40-r03',
    'manifest_sha256': hashlib.sha256(raw).hexdigest(), 'files': len(payloads),
    'dist_outputs': sum(p.startswith('dist/') for p in payloads),
    'knowledge_release': pin, 'codex_profile_root': '/var/lib/nodia/codex'}
plan_raw = (json.dumps(plan, indent=2) + '\n').encode()
with (ROOT / 'docs/evidence/nodia-ai-ai40-adopt-plan-r03.json').open('xb') as out: out.write(plan_raw)
receipt = {'stage': 'AI40', 'status': 'frozen_not_activated', 'plan': plan,
    'plan_sha256': hashlib.sha256(plan_raw).hexdigest(), 'manifest_path': manifest_name,
    'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'ops_and_backup_entry_preserved': True, 'secret_or_dependencies_embedded': False,
    'service_changes': 0, 'provider_requests': 0}
with (ROOT / 'docs/evidence/nodia-ai-ai40-package-r03.json').open('xb') as out:
    out.write(json.dumps(receipt, indent=2).encode() + b'\n')
print(json.dumps(receipt))
