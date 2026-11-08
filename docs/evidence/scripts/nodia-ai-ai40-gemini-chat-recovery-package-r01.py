"""Offline four-file COPY overlay on the immutable deployed Gemini image.

Preserves deployed CLI1.3.1 compatibility. Working-tree1.4.2 changes in main/
agentic_cli are excluded. No dependencies, sessions, profile, env or credentials
are packaged. QA assets live outside Docker context and are never COPY'd.
"""
import ast
import difflib
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[3]
TARGET = ROOT / 'ops/lab/artifacts/ai40-gemini-chat-recovery-r01'
SOURCE = ROOT / 'nodia-gemini-microservice'
BASE_IMAGE = 'sha256:6b9e2f7e3273f89c4c2285c852135213bb82a3391bfe06895f523554033acb49'
BASE_REPORT_SHA = '9ba3354509f89f4d798819f26eb3034ace06865b8235153c52138d831548ef48'
PINS = {
    'native_chat_owner_bindings.py': '3891b8370ce610b833f2c8de305052035033342199bdf702df9696602b56be67',
    'login_cgroups.py': 'ca25d346190bcc3cd28abadb65be1dbce8d81f695c1572915bf73887e6d87442',
    'profile_admission.py': 'a68d9127f396fa90ae291d46d8a1061418e2054266b0d7517ae520dc48d9d34b',
    'nodia_ai_chat.py': 'ebfaffc697f76e33e678b52cd6c7959c981d8c9f0e383750649da6e71751c5bf',
}
TEST_PINS = {
    'test_support.py': 'f5bdfa0bed7b78cd9812a676b210a13cb29766fb2514bb0efbcfbd8a5dd6d0f3',
    'test_native_chat_owner_bindings.py': '142b191cc1a0e2d0fa33afc1619a426c2e5c46753a21ce45f458782e06a97cf6',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    report_raw = (ROOT / 'docs/evidence/nodia-ai-ai38-web-recovery-final-r01.json').read_bytes()
    assert sha(report_raw) == BASE_REPORT_SHA
    report = json.loads(report_raw)
    assert report['Gemini']['image'] == BASE_IMAGE and len(report['native_public_source_hashes']) == 49
    baseline_pins = report['native_public_source_hashes']
    sources = {name: (SOURCE / name).read_bytes() for name in PINS}
    assert all(sha(raw) == PINS[name] for name, raw in sources.items())
    assert all(b'\r' not in raw for raw in sources.values())
    for name, raw in sources.items():
        ast.parse(raw, filename=name)
    # Two preexisting compatibility deltas only, inside the artifact copy.
    chat = sources['nodia_ai_chat.py']
    old = b'from agentic_cli import CHAT_CLI_VERSIONS, CliRunner, prepare_cli_home, permission_path\n'
    gate = b'if self.agentic.runner.config.version not in CHAT_CLI_VERSIONS:'
    assert chat.count(old) == chat.count(gate) == 1
    chat = chat.replace(old, b'from agentic_cli import CliRunner, prepare_cli_home, permission_path\n')
    chat = chat.replace(gate, b'if self.agentic.runner.config.version != "1.3.1":')
    assert b'CHAT_CLI_VERSIONS' not in chat
    ast.parse(chat, filename='ported/nodia_ai_chat.py')
    sources['nodia_ai_chat.py'] = chat
    baseline = (ROOT / '.tmp/ai40-continuity-r01/observed-runtime/nodia_ai_chat.py').read_bytes()
    assert sha(baseline) == baseline_pins['nodia_ai_chat.py']
    tests = {name: (SOURCE / 'tests' / name).read_bytes() for name in TEST_PINS}
    assert all(sha(raw) == TEST_PINS[name] for name, raw in tests.items())
    dockerfile = ('FROM ' + BASE_IMAGE + '\nCOPY --chown=0:0 --chmod=0644 ' + ' '.join(sorted(PINS)) + ' /app/\n').encode()
    manifest = {'schema': 'nodia-ai-ai40-gemini-chat-selective-package-v1', 'base_image_id': BASE_IMAGE,
        'base_public_python_hashes': baseline_pins, 'base_inventory_receipt_sha256': BASE_REPORT_SHA,
        'frozen_consumer_source_sha256': PINS, 'target_image_source_sha256': {name: sha(raw) for name, raw in sources.items()},
        'test_assets_sha256': TEST_PINS, 'dockerfile_sha256': sha(dockerfile), 'base_chat_raw_sha256': sha(baseline),
        'compatibility_port': {'paths': ['nodia_ai_chat.py'], 'changes': ['remove preexisting CHAT_CLI_VERSIONS import, retain new CliRunner import', 'restore deployed exact CLI1.3.1 observe gate'],
            'main_and_agentic_cli_unchanged': True, 'repo_sources_modified': False},
        'production_paths': sorted('/app/' + name for name in PINS), 'new_production_paths': ['/app/native_chat_owner_bindings.py'],
        'Config_CMD_Entrypoint_User_ENV_ports_limits_mounts_unchanged': True,
        'contains_credentials_profiles_env_dependencies': False, 'operational_acceptance': False}
    manifest_raw = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
    members = {'manifest.json': manifest_raw, 'context/Dockerfile': dockerfile, 'baseline/nodia_ai_chat.py': baseline}
    members.update({'context/' + name: raw for name, raw in sources.items()})
    members.update({'qa/' + name: raw for name, raw in tests.items()})
    TARGET.mkdir(parents=True, exist_ok=False)
    archive_path = TARGET / 'package.tar'
    with archive_path.open('xb') as stream, tarfile.open(fileobj=stream, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name, raw in sorted(members.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime, info.uid, info.gid = len(raw), 0o644, 0, 0, 0
            archive.addfile(info, io.BytesIO(raw))
    (TARGET / 'manifest.json').write_bytes(manifest_raw)
    (TARGET / 'consumer-compatibility-port.patch').write_bytes(''.join(difflib.unified_diff(
        (SOURCE / 'nodia_ai_chat.py').read_text(encoding='utf8').splitlines(True), chat.decode().splitlines(True),
        fromfile='frozen-consumer/nodia_ai_chat.py', tofile='artifact/nodia_ai_chat.py')).encode())
    (TARGET / 'chat-vs-deployed-baseline.patch').write_bytes(''.join(difflib.unified_diff(
        baseline.decode().replace('\r\n', '\n').splitlines(True), chat.decode().splitlines(True),
        fromfile='deployed/nodia_ai_chat.py (LF view only)', tofile='artifact/nodia_ai_chat.py')).encode())
    catalog = {'schema': 'nodia-ai-ai40-gemini-chat-selective-catalog-v1', 'archive': str(archive_path.relative_to(ROOT)),
        'archive_sha256': sha(archive_path.read_bytes()), 'archive_bytes': archive_path.stat().st_size,
        'manifest_sha256': sha(manifest_raw), 'entries': len(members),
        'members': {name: {'sha256': sha(raw), 'bytes': len(raw)} for name, raw in sorted(members.items())},
        'packager_sha256': sha(Path(__file__).read_bytes()), 'Docker_builds': 0, 'VM_changes': 0, 'SDK_requests': 0}
    (TARGET / 'catalog.json').write_bytes((json.dumps(catalog, indent=2) + '\n').encode())
    print(json.dumps({key: catalog[key] for key in ('archive', 'archive_sha256', 'archive_bytes', 'manifest_sha256', 'entries')}))


if __name__ == '__main__':
    main()
