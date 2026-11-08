"""One WAV candidate probe; reuse pinned image checks and durable intent writer.

R05 services and its MCP/image proofs stay intact. Only a distinct scoped WAV
proof may be created after native ACK. No profile/account fallback or replay.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys

IMAGE = Path('/opt/nodia/verification/ai40-image-operator-r01/nodia-ai-ai40-image-operator-r03.py')
IMAGE_SHA = '1996130038b546458ddd7f608ea23d690cc094ef8c7b5009c98d711356cfe957'
MCP = Path('/opt/nodia/verification/ai40-r04-operator-r01/nodia-ai-ai40-r04-mcp-operator-r01.py')
MCP_SHA = '5abbbf8bf1cd5f8b90089052cca71148a91e5aadd9bd76b959704b1dd825e2d8'
ACTIVE = Path('/opt/nodia/releases/nodia-server-ai40-r05')
ACTIVE_SHA = '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'


def require(value, code):
    if not value:
        raise ValueError(code)


def load(path, pin, name):
    import hashlib
    require(path.is_file() and not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest() == pin,
            'inherited_operator_pin_mismatch')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def private_json(path, uid):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_uid == uid
            and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1 and info.st_size <= 16384,
            'private_probe_metadata_invalid')
    return json.loads(path.read_bytes())


def protected_proofs(operator, uid):
    result = {}
    for suffix in ('', '-image-png', '-image-jpeg', '-image-webp'):
        path = operator.PROFILE / '1' / ('nodia-chat-mcp' + suffix)
        value = private_json(path, uid)
        result[suffix or 'mcp'] = {'sha256': operator.sha(path), 'scope': value['scope'],
                                 'terminal_proof_id': value['terminalProofId']}
    require(all(item['scope'] == result['mcp']['scope'] for item in result.values()), 'active_proof_scopes_differ')
    return result


def dependencies(operator):
    lock = json.loads((operator.CANDIDATE / 'package-lock.json').read_bytes())
    result = []
    for name in ('@nestjs/common', '@nestjs/core', '@nestjs/testing', '@nestjs/typeorm', 'typeorm',
                 'reflect-metadata', 'dotenv', '@openai/codex', '@openai/codex-linux-x64'):
        path = operator.DEPENDENCIES / name / 'package.json'
        version = json.loads(path.read_bytes())['version']
        require(version == lock['packages']['node_modules/' + name]['version'], 'installed_dependency_lock_mismatch')
        result.append({'name': name, 'version': version, 'package_json_sha256': operator.sha(path)})
    return result


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    operator = load(IMAGE, IMAGE_SHA, 'immutable_image_checks')
    writer = load(MCP, MCP_SHA, 'immutable_intent_writer').write_once
    require(operator.sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_source_changed')
    require(re.fullmatch('/opt/nodia/verification/ai40-audio-candidate-r[0-9]{2}', args.candidate_root),
            'candidate_root_invalid')
    require(re.fullmatch('[a-f0-9]{64}', args.manifest_sha256) and
            re.fullmatch('[a-f0-9]{64}', args.expected_runtime_fingerprint), 'candidate_pin_invalid')
    operator.ACTIVE, operator.CANDIDATE = ACTIVE, Path(args.candidate_root) / 'server'
    require(operator.sha(ACTIVE / 'release-manifest.json') == ACTIVE_SHA, 'active_release_pin_mismatch')
    candidate = operator.validate_candidate(args.manifest_sha256)
    manifest = json.loads((operator.CANDIDATE.parent / 'candidate-manifest.json').read_bytes())
    require(all(name in manifest['files'] for name in ('dist/common/ai/codex/codex-chat-audio.js',
                'dist/common/ai/codex/codex-chat-audio-acceptance.js', 'dist/common/ai/codex/codex-chat-media-storage.js')) and
            'src/common/ai/codex/codex-chat-audio.ts' in manifest['source_sha256'], 'audio_candidate_boundary_missing')
    uid = pwd.getpwnam('nodia').pw_uid
    services = {name: operator.service(name) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-keyring')}
    before, proofs, deps = operator.public_preflight(services), protected_proofs(operator, uid), dependencies(operator)
    audio_file = operator.PROFILE / '1' / 'nodia-chat-mcp-audio-wav'
    require(not audio_file.exists() and not audio_file.is_symlink(), 'existing_audio_proof_requires_review')
    private_file = operator.CANDIDATE.parent / 'fixtures/private-audio-probe.json'
    probe = private_json(private_file, uid)
    require(set(probe) == {'path', 'media_type', 'sha256', 'expected_transcript'} and probe['media_type'] == 'audio/wav'
            and isinstance(probe['expected_transcript'], str) and len(probe['expected_transcript'].encode()) <= 512,
            'audio_probe_descriptor_invalid')
    audio = Path(probe['path'])
    require(audio.parent == private_file.parent and audio.resolve() == audio and operator.sha(audio) == probe['sha256'],
            'audio_fixture_bytes_changed')
    info = audio.lstat()
    require(stat.S_ISREG(info.st_mode) and not audio.is_symlink() and info.st_uid == uid
            and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1 and 0 < info.st_size <= 20971520,
            'audio_fixture_not_private')
    report = {'schema': 'nodia-ai-ai40-audio-operator-v1', 'mode': args.mode, 'operator_sha256': args.operator_sha256,
              'candidate': candidate, 'services': services, 'before': before, 'protected_R05_proofs': proofs,
              'dependencies': deps, 'expected_runtime_fingerprint': args.expected_runtime_fingerprint,
              'audio_fixture_sha256': probe['sha256'], 'audio_fixture_bytes': info.st_size,
              'provider_requests': 0, 'settings_or_services_changed': False, 'expected_transcript_emitted': False}
    if args.mode == 'preflight':
        require(not args.authorize_one_real_generation, 'preflight_cannot_authorize_generation')
        return {**report, 'status': 'preflight_passed'}, 0
    require(args.authorize_one_real_generation, 'explicit_one_generation_authorization_required')
    api = operator.selected_environment(services['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST',
        'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
    require(api.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
    read = operator.command(['/usr/local/bin/node', '--input-type=module', '-e',
                             (operator.CANDIDATE.parent / 'public-canary-input.mjs').read_text()],
                            cwd=ACTIVE, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root',
                             'AI40_CONNECTION_ID': '1', **{k: v for k, v in api.items() if k != 'TZ'}}, timeout=25)
    require(read.returncode == 0 and len(read.stdout) < 1024 * 1024, 'public_configuration_read_failed')
    config = json.loads(read.stdout)
    require('audio_probe' not in config and 'image_probe' not in config and config['selection']['connection_id'] == '1'
            and config['expected_binary_sha256'] == operator.BINARY_SHA, 'selection_identity_changed')
    config['audio_probe'] = probe
    broker = operator.selected_environment(services['nodia-keyring']['pid'], {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
    require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'} and
            broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_invalid')
    writer(operator.CANDIDATE.parent / 'intent-wav.json', {'schema': 'nodia-ai-ai40-audio-intent-v1',
        'candidate_manifest_sha256': args.manifest_sha256, 'audio_sha256': probe['sha256'],
        'selection': config['selection'], 'generation_may_have_started': True})
    try:
        result = operator.command(['/usr/local/bin/node', str(operator.CANDIDATE / 'test/nodia-ai-ai40-real-canary-parent.mjs')],
            cwd=operator.CANDIDATE, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODIA_CODEX_ENABLED': 'true',
                'NODIA_CODEX_PROFILE_ROOT': str(operator.PROFILE), **broker}, source=json.dumps(config).encode(), timeout=380)
    except subprocess.TimeoutExpired:
        writer(operator.CANDIDATE.parent / 'receipt-wav.json', {'status': 'unknown', 'error_code': 'parent_timeout',
               'generation_not_replayed': True, 'candidate_preserved_for_reconciliation': True})
        raise ValueError('parent_timeout_result_unknown') from None
    require(len(result.stdout) < 4 * 1024 * 1024, 'parent_output_exceeded')
    try:
        parent = json.loads(result.stdout)
    except (ValueError, UnicodeDecodeError):
        writer(operator.CANDIDATE.parent / 'receipt-wav.json', {'status': 'unknown', 'error_code': 'parent_receipt_invalid',
               'generation_not_replayed': True, 'candidate_preserved_for_reconciliation': True})
        raise ValueError('parent_receipt_invalid') from None
    writer(operator.CANDIDATE.parent / 'receipt-wav.json', parent)
    require(parent.get('schema') == 'nodia-ai-ai40-real-canary-parent-v1', 'parent_receipt_invalid')
    after = operator.public_preflight(services)
    require(services == {name: operator.service(name) for name in services} and before['SQL'] == after['SQL'],
            'operational_state_changed')
    require(proofs == protected_proofs(operator, uid) and deps == dependencies(operator), 'active_proofs_or_dependencies_changed')
    child = parent.get('child')
    success = isinstance(child, dict) and result.returncode == 0 and parent['status'] == 'passed' and \
        child['acceptance_kind'] == 'audio_original' and child['audio_media_type'] == 'audio/wav' and \
        child['audio_source_sha256'] == probe['sha256'] and child['provider_dispatches_armed'] == 1 and \
        child['gateway_callbacks'] == 0 and child['final_verified_audio_media_types'] == ['audio/wav']
    accepted = None
    if success:
        value = private_json(audio_file, uid)
        require(value['mediaType'] == 'audio/wav' and value['scope']['runtimeFingerprint'] == args.expected_runtime_fingerprint
                and value['terminalProofId'] == child['terminal_proof_id'], 'audio_scope_acceptance_mismatch')
        accepted = {'sha256': operator.sha(audio_file), 'scope': value['scope'], 'terminal_proof_id': value['terminalProofId']}
    return {**report, 'status': 'passed' if success else 'failed', 'parent': parent,
            'provider_requests': child.get('provider_dispatches_armed') if isinstance(child, dict) else None,
            'after': after, 'R05_MCP_images_preserved': True, 'audio_acceptance': accepted}, 0 if success else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['preflight', 'probe'], required=True)
    parser.add_argument('--candidate-root', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--expected-runtime-fingerprint', required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--authorize-one-real-generation', action='store_true')
    args = parser.parse_args()
    try:
        output, code = run(args)
        print(json.dumps(output))
        sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-audio-operator-v1', 'status': 'operator_failed',
            'error_class': type(error).__name__, 'error_code': message if re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else None,
            'generation_not_replayed': True, 'candidate_preserved_for_reconciliation': True, 'private_details_emitted': False}))
        sys.exit(1)
