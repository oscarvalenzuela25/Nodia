"""Freeze a reviewed narrow successor, preserving recovery code from its predecessor.

Local files only. The separately reviewed transition lists every changed path;
no build, installation, services, SQL, credentials or provider operation occurs.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile


def sha(value):
    return hashlib.sha256(value).hexdigest()


def require(value, code):
    if not value:
        raise ValueError(code)


def freeze(args):
    root = Path(__file__).resolve().parents[3]
    server, artifacts = root / 'nodia-server', root / 'ops/lab/artifacts'
    require(re.fullmatch('r[0-9]{2}', args.revision), 'revision_invalid')
    transition_raw = Path(args.transition).read_bytes()
    require(sha(transition_raw) == args.transition_sha256, 'package_transition_pin_mismatch')
    transition = json.loads(transition_raw)
    require(set(transition) == {'source_archive_sha256', 'source_manifest_sha256', 'knowledge_release', 'changed_paths'},
            'package_transition_keys_invalid')
    source = Path(args.source_archive)
    require(sha(source.read_bytes()) == transition['source_archive_sha256'], 'source_archive_pin_mismatch')
    payloads = {}
    with tarfile.open(source) as archive:
        old_raw = archive.extractfile('release-manifest.json').read()
        require(sha(old_raw) == transition['source_manifest_sha256'], 'source_manifest_pin_mismatch')
        old = json.loads(old_raw)
        for name, digest in old['files'].items():
            if name.startswith('ops/') or name == 'scripts/nodia-ai-backups.mjs':
                value = archive.extractfile(name).read()
                require(sha(value) == digest, 'recovery_source_changed')
                payloads[name] = value
    for folder in ('src', 'dist', 'scripts', 'config', 'test'):
        for path in sorted((server / folder).rglob('*')):
            if not path.is_file() or path.is_symlink() or path.name.endswith('.spec.ts'):
                continue
            relative = path.relative_to(server)
            if any(part in ('node_modules', '__pycache__', '.cache', '.tmp') or part.startswith('.env') for part in relative.parts):
                continue
            if path.suffix not in ('.ts', '.js', '.mjs', '.cjs', '.json', '.map', '.md', '.txt'):
                continue
            require(path.resolve().is_relative_to(server.resolve()), 'source_path_escape')
            name, value = relative.as_posix(), path.read_bytes()
            if name == 'scripts/nodia-ai-backups.mjs':
                require(sha(value) == old['files'][name], 'recovery_entry_changed')
            else:
                payloads[name] = value
    for name in ('package.json', 'package-lock.json'):
        payloads[name] = (server / name).read_bytes()
    require(set(payloads) == set(old['files']), 'successor_inventory_changed')
    changed = {name: {'old': old['files'][name], 'new': sha(value)} for name, value in payloads.items()
               if sha(value) != old['files'][name]}
    require(changed == transition['changed_paths'], 'successor_delta_mismatch')
    pin = json.loads(payloads['dist/nodia-ai-context/config/knowledge-pin.json'])['release_id']
    require(pin == transition['knowledge_release'], 'successor_knowledge_pin_mismatch')
    manifest = {'schema_version': 1, 'stage': 'AI40', 'knowledge_release': pin,
                'deployment_performed': False, 'release_authorized': False,
                'files': {name: sha(value) for name, value in sorted(payloads.items())}}
    raw = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    manifest_path = artifacts / ('ai40-server-' + args.revision + '-manifest.json')
    with manifest_path.open('xb') as stream:
        stream.write(raw)
    archive_path = artifacts / ('ai40-server-' + args.revision + '.tar.gz')
    with archive_path.open('xb') as stream, tarfile.open(fileobj=stream, mode='w:gz') as archive:
        for name, value in sorted({**payloads, 'release-manifest.json': raw}.items()):
            member = tarfile.TarInfo(name)
            member.size, member.mode = len(value), 0o644
            archive.addfile(member, io.BytesIO(value))
    plan = {'release': '/opt/nodia/releases/nodia-server-ai40-' + args.revision, 'manifest_sha256': sha(raw),
            'files': len(payloads), 'dist_outputs': sum(name.startswith('dist/') for name in payloads),
            'knowledge_release': pin, 'codex_profile_root': '/var/lib/nodia/codex'}
    plan_raw = (json.dumps(plan, indent=2) + '\n').encode()
    with (root / ('docs/evidence/nodia-ai-ai40-adopt-plan-' + args.revision + '.json')).open('xb') as stream:
        stream.write(plan_raw)
    return {'status': 'frozen_not_adopted', 'plan': plan, 'plan_sha256': sha(plan_raw),
            'archive_sha256': sha(archive_path.read_bytes()), 'archive_bytes': archive_path.stat().st_size,
            'transition_sha256': sha(transition_raw), 'changed_paths': changed,
            'recovery_ops_and_backup_entry_preserved': True, 'provider_requests': 0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--source-archive', required=True)
    parser.add_argument('--transition', required=True)
    parser.add_argument('--transition-sha256', required=True)
    print(json.dumps(freeze(parser.parse_args())))
