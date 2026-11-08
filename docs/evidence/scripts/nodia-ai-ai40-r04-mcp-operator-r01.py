"""One explicit candidate MCP probe, preserving independently accepted images.

Imports the immutable image operator's read-only checks. No adoption, settings,
login, credentials copy or replay; disposable SQL lifecycle belongs to parent.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

IMAGE_OPERATOR = Path('/opt/nodia/verification/ai40-image-operator-r01/nodia-ai-ai40-image-operator-r03.py')
IMAGE_SHA = '1996130038b546458ddd7f608ea23d690cc094ef8c7b5009c98d711356cfe957'
MANIFEST_SHA = 'df107764de9b1b53830263ac380d0e56ce9e38ef09cea5042f82a3be00f4bb2b'


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_once(path, value):
    with path.open('x', encoding='utf-8', newline='\n') as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def image_proofs(operator):
    values = {}
    for mime in ('png', 'jpeg', 'webp'):
        path = operator.PROFILE / '1' / ('nodia-chat-mcp-image-' + mime)
        value = json.loads(path.read_bytes())
        require(value.get('mediaType') == 'image/' + mime, 'image_proof_missing_or_changed')
        values[mime] = {'sha256': sha(path), 'scope': value['scope'], 'terminal_proof_id': value['terminalProofId']}
    require(all(value['scope'] == values['png']['scope'] for value in values.values()), 'image_scopes_differ')
    return values


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    require(sha(Path(__file__).resolve()) == args.operator_sha256 and sha(IMAGE_OPERATOR) == IMAGE_SHA, 'operator_pin_mismatch')
    spec = importlib.util.spec_from_file_location('pinned_image_operator', IMAGE_OPERATOR)
    operator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operator)
    candidate = operator.validate_candidate(MANIFEST_SHA)
    services = {name: operator.service(name) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-keyring')}
    before, images = operator.public_preflight(services), image_proofs(operator)
    report = {'schema': 'nodia-ai-ai40-r04-mcp-operator-v1', 'phase': args.phase,
              'operator_sha256': args.operator_sha256, 'candidate': candidate,
              'services': services, 'before': before, 'independent_image_proofs': images,
              'provider_requests': 0, 'settings_or_services_changed': False}
    if args.phase == 'preflight':
        require(not args.authorize_one_real_generation, 'preflight_cannot_authorize_generation')
        return {**report, 'status': 'preflight_passed'}, 0
    require(args.authorize_one_real_generation, 'explicit_generation_authorization_required')
    api = operator.selected_environment(services['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST',
        'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
    require(api.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'AI40_CONNECTION_ID': '1',
                   **{key: value for key, value in api.items() if key != 'TZ'}}
    source = (operator.CANDIDATE.parent / 'public-canary-input.mjs').read_text()
    read = operator.command(['/usr/local/bin/node', '--input-type=module', '-e', source], cwd=operator.ACTIVE,
                            env=environment, timeout=25)
    require(read.returncode == 0 and len(read.stdout) < 1024 * 1024, 'public_configuration_read_failed')
    config = json.loads(read.stdout)
    require('image_probe' not in config and config['selection']['connection_id'] == '1', 'mcp_configuration_invalid')
    require(config['expected_binary_sha256'] == operator.BINARY_SHA, 'native_binary_pin_mismatch')
    broker = operator.selected_environment(services['nodia-keyring']['pid'], {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
    require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'} and
            broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_invalid')
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODIA_CODEX_ENABLED': 'true',
                   'NODIA_CODEX_PROFILE_ROOT': str(operator.PROFILE), **broker}
    write_once(operator.CANDIDATE.parent / 'intent-mcp.json', {'schema': 'nodia-ai-ai40-mcp-intent-v1',
        'candidate_manifest_sha256': MANIFEST_SHA, 'selection': config['selection'], 'generation_may_have_started': True})
    result = operator.command(['/usr/local/bin/node', str(operator.CANDIDATE / 'test/nodia-ai-ai40-real-canary-parent.mjs')],
                              cwd=operator.CANDIDATE, env=environment, source=read.stdout, timeout=380)
    require(len(result.stdout) < 4 * 1024 * 1024, 'parent_output_exceeded')
    parent = json.loads(result.stdout)
    require(parent.get('schema') == 'nodia-ai-ai40-real-canary-parent-v1', 'parent_receipt_invalid')
    write_once(operator.CANDIDATE.parent / 'receipt-mcp.json', parent)
    after = operator.public_preflight(services)
    after_services = {name: operator.service(name) for name in services}
    after_images = image_proofs(operator)
    require(services == after_services and before['SQL'] == after['SQL'], 'operational_state_changed')
    require(images == after_images, 'independent_image_proofs_changed')
    child = parent.get('child')
    require(type(child) is dict, 'child_receipt_missing')
    success = parent['status'] == 'passed' and child['final_mcp_accepted'] is True and result.returncode == 0
    return {**report, 'status': 'passed' if success else 'failed', 'parent': parent,
            'provider_requests': child['provider_dispatches_armed'], 'after': after,
            'image_proofs_unchanged': True, 'images_after': after_images}, 0 if success else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'probe'])
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--authorize-one-real-generation', action='store_true')
    args = parser.parse_args()
    try:
        output, code = run(args)
        print(json.dumps(output))
        sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-r04-mcp-operator-v1', 'status': 'operator_failed',
            'error_class': type(error).__name__, 'error_code': message if re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else None,
            'generation_not_replayed': True, 'candidate_preserved_for_reconciliation': True, 'private_details_emitted': False}))
        sys.exit(1)
