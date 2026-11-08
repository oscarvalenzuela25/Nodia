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
TARGET = ROOT / 'ops/lab/artifacts/ai40-gemini-chat-recovery-r03'
SOURCE = ROOT / 'nodia-gemini-microservice'
BASE_IMAGE = 'sha256:6b9e2f7e3273f89c4c2285c852135213bb82a3391bfe06895f523554033acb49'
LOCAL_BASE_ALIAS = 'nodia-ai40-gemini-rollback:base-6b9e2f7e3273-r01'
LIFECYCLE_PATCH_SHA = '72fff7eca748d14e875aec083d8d7a61db8cfed247dd572053abc4a07c73d55a'
BASE_REPORT_SHA = '9ba3354509f89f4d798819f26eb3034ace06865b8235153c52138d831548ef48'
PINS = {
    'agentic_cli.py': '82eedadb16ec4d43af568e5ab2ba0fe0c24357532150cbf23f8239b9d36a37bd',
    'native_chat_owner_bindings.py': '3891b8370ce610b833f2c8de305052035033342199bdf702df9696602b56be67',
    'login_cgroups.py': 'ca25d346190bcc3cd28abadb65be1dbce8d81f695c1572915bf73887e6d87442',
    'profile_admission.py': 'a68d9127f396fa90ae291d46d8a1061418e2054266b0d7517ae520dc48d9d34b',
    'nodia_ai_chat.py': 'cd0a2f1f290304638622c464af3d64c9ba869b093575d5e0a1fcf88d69be8cfc',
}
TEST_PINS = {
    'test_agentic_cleanup.py': 'e5a8deb05ea87cd3d0b1ae1a2d7534bc17030a31a31d319572521ebb301de6ce',
    'test_support.py': 'f5bdfa0bed7b78cd9812a676b210a13cb29766fb2514bb0efbcfbd8a5dd6d0f3',
    'test_native_chat_owner_bindings.py': '142b191cc1a0e2d0fa33afc1619a426c2e5c46753a21ce45f458782e06a97cf6',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()



def lifecycle_hunks(raw):
    lines = raw.decode('utf8').splitlines(keepends=True)
    result, body = [], None
    for line in lines[2:]:
        if line.startswith('@@ '):
            if body is not None:
                result.append(body)
            body = []
        else:
            assert body is not None and line[:1] in (' ', '-', '+')
            body.append(line)
    if body is not None:
        result.append(body)
    assert len(result) == 9
    return [(''.join(x[1:] for x in body if x[:1] in (' ', '-')).encode(),
             ''.join(x[1:] for x in body if x[:1] in (' ', '+')).encode()) for body in result]


def apply_lifecycle(raw, hunks, reverse=False):
    for before, after in (reversed(hunks) if reverse else hunks):
        old, new = (after, before) if reverse else (before, after)
        assert raw.count(old) == 1, 'ambiguous_or_missing_exact_lifecycle_context'
        raw = raw.replace(old, new, 1)
    return raw


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
    chat_inverse = chat.replace(b'from agentic_cli import CliRunner, prepare_cli_home, permission_path\n', old)
    chat_inverse = chat_inverse.replace(b'if self.agentic.runner.config.version != "1.3.1":', gate)
    assert chat_inverse == (SOURCE / 'nodia_ai_chat.py').read_bytes()
    patch = (ROOT / '.tmp/ai40-agentic-cleanup-r01/lifecycle-delta-r02.patch').read_bytes()
    assert sha(patch) == LIFECYCLE_PATCH_SHA and b'\r' not in patch
    hunks = lifecycle_hunks(patch)
    deployed_cli = (ROOT / '.tmp/ai40-continuity-r01/observed-runtime/agentic_cli.py').read_bytes()
    assert sha(deployed_cli) == baseline_pins['agentic_cli.py'] == '3605f0f300c15cf8bc66b94b38ee8b09da40f3427a88844c0d3cd47785903d08'
    frozen_before = (ROOT / '.tmp/ai40-agentic-cleanup-r01/agentic_cli.before.py').read_bytes()
    assert sha(frozen_before) == '0397bfc364326036d77bf8c65e4c8162312d27ac23fd025c2b10e6d6199625ff'
    assert apply_lifecycle(frozen_before, hunks) == sources['agentic_cli.py']
    cli = apply_lifecycle(deployed_cli, hunks)
    assert apply_lifecycle(cli, hunks, reverse=True) == deployed_cli
    assert b'CHAT_CLI_VERSIONS' not in cli and b'1.4.2' not in cli
    ast.parse(cli, filename='ported/agentic_cli.py')
    sources['agentic_cli.py'] = cli
    inverse_proof = {'lifecycle_patch_sha256': LIFECYCLE_PATCH_SHA, 'lifecycle_hunks': len(hunks),
        'deployed_CLI_before_sha256': sha(deployed_cli), 'ported_CLI_sha256': sha(cli),
        'inverse_CLI_sha256': sha(apply_lifecycle(cli, hunks, reverse=True)), 'inverse_CLI_byte_equal': True,
        'patch_on_frozen_before_equals_frozen_current_CLI': True, 'frozen_CLI_source_sha256': PINS['agentic_cli.py'],
        'chat_inverse_equals_frozen_current': chat_inverse == (SOURCE / 'nodia_ai_chat.py').read_bytes(),
        'chat_frozen_source_sha256': PINS['nodia_ai_chat.py'], 'chat_ported_sha256': sha(chat),
        'CLI_1_3_1_configuration_and_compatibility_preserved': True}
    baseline = (ROOT / '.tmp/ai40-continuity-r01/observed-runtime/nodia_ai_chat.py').read_bytes()
    assert sha(baseline) == baseline_pins['nodia_ai_chat.py']
    tests = {name: (SOURCE / 'tests' / name).read_bytes() for name in TEST_PINS}
    assert all(sha(raw) == TEST_PINS[name] for name, raw in tests.items())
    dockerfile = ('FROM ' + LOCAL_BASE_ALIAS + '\nCOPY --chown=0:0 --chmod=0644 ' + ' '.join(sorted(PINS)) + ' /app/\n').encode()
    manifest = {'schema': 'nodia-ai-ai40-gemini-chat-selective-package-v2', 'base_image_id': BASE_IMAGE, 'local_base_alias': LOCAL_BASE_ALIAS,
        'base_alias_guard': 'Reviewed permanent rollback reference -> exact base image ID before and after build; --pull=false; no registry fallback; preserve this rollback reference.',
        'base_public_python_hashes': baseline_pins, 'base_inventory_receipt_sha256': BASE_REPORT_SHA,
        'frozen_consumer_source_sha256': PINS, 'target_image_source_sha256': {name: sha(raw) for name, raw in sources.items()},
        'test_assets_sha256': TEST_PINS, 'dockerfile_sha256': sha(dockerfile), 'base_chat_raw_sha256': sha(baseline),
        'compatibility_port': {'paths': ['nodia_ai_chat.py'], 'changes': ['remove preexisting CHAT_CLI_VERSIONS import, retain new CliRunner import', 'restore deployed exact CLI1.3.1 observe gate'],
            'main_unchanged': True, 'agentic_cli_only_lifecycle_hunks_on_deployed_base': True, 'repo_sources_modified': False},
        'production_paths': sorted('/app/' + name for name in PINS), 'new_production_paths': ['/app/native_chat_owner_bindings.py'],
        'inverse_proof': inverse_proof, 'Config_CMD_Entrypoint_User_ENV_ports_limits_mounts_unchanged': True,
        'contains_credentials_profiles_env_dependencies': False, 'operational_acceptance': False}
    manifest_raw = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
    members = {'manifest.json': manifest_raw, 'context/Dockerfile': dockerfile, 'baseline/nodia_ai_chat.py': baseline, 'baseline/agentic_cli.py': deployed_cli, 'provenance/lifecycle-delta-r02.patch': patch}
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
    (TARGET / 'inverse-proof.json').write_bytes((json.dumps(inverse_proof, indent=2) + '\n').encode())
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
