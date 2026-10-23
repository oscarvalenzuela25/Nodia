"""Native experimental schema and admission checks; zero inference or credentials."""
from pathlib import Path
import hashlib
import json
import os
import selectors
import signal
import subprocess
import time

ROOT = Path('/opt/nodia/verification/ai39-experimental-protocol-r02')
BINARY = Path('/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
EXPECTED_BINARY_SHA = '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    assert not ROOT.exists()
    assert sha(BINARY.read_bytes()) == EXPECTED_BINARY_SHA
    ROOT.mkdir(mode=0o700)
    home = ROOT / 'home'
    home.mkdir(mode=0o700)
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(home),
           'CODEX_HOME': str(home / 'empty-codex'),
           'XDG_CONFIG_HOME': str(home / 'config'),
           'XDG_DATA_HOME': str(home / 'data'), 'XDG_CACHE_HOME': str(home / 'cache')}
    prefix = ['/usr/bin/unshare', '--net', '--', str(BINARY)]
    schema_dir = ROOT / 'schemas'
    export = subprocess.run(prefix + ['app-server', 'generate-json-schema',
                            '--experimental', '--out', str(schema_dir)],
                            cwd=ROOT, env=env, capture_output=True, timeout=60, check=True)
    files = sorted(schema_dir.rglob('*.json'))
    manifest = [{'path': str(p.relative_to(schema_dir)), 'sha256': sha(p.read_bytes()),
                 'bytes': p.stat().st_size} for p in files]
    selected = {}
    for path in files:
        if path.name in ('ThreadStartParams.json', 'DynamicToolSpec.json',
                          'DynamicToolCallParams.json', 'DynamicToolCallResponse.json',
                          'DynamicToolCallOutputContentItem.json', 'InitializeCapabilities.json',
                          'ServerRequest.json', 'TurnStartParams.json', 'TurnCompletedNotification.json'):
            selected[str(path.relative_to(schema_dir))] = json.loads(path.read_text())
    thread_schema = json.loads((schema_dir / 'v2/ThreadStartParams.json').read_text())
    assert 'dynamicTools' in thread_schema['properties']
    settings = {
        'cli_auth_credentials_store': 'keyring', 'forced_login_method': 'chatgpt',
        'model_provider': 'nodia_codex',
        'model_providers.nodia_codex.name': 'Nodia Codex offline protocol',
        'model_providers.nodia_codex.wire_api': 'responses',
        'model_providers.nodia_codex.requires_openai_auth': True,
        'model_providers.nodia_codex.request_max_retries': 0,
        'model_providers.nodia_codex.stream_max_retries': 0,
        'model_providers.nodia_codex.supports_websockets': False,
        'features.shell_tool': False, 'features.unified_exec': False,
        'features.apply_patch_freeform': False, 'features.multi_agent': False,
        'features.apps': False, 'features.plugins': False,
        'features.code_mode': False, 'features.memories': False,
        'features.remote_control': False, 'features.remote_plugin': False,
        'web_search': 'disabled', 'check_for_update_on_startup': False,
        'analytics.enabled': False, 'feedback.enabled': False,
        'project_doc_max_bytes': 0, 'shell_environment_policy.inherit': 'none',
        'mcp_servers': {},
    }
    results = []
    valid_tool = {'name': 'nodia_ai39_protocol_probe',
                  'description': 'Synthetic offline schema probe.',
                  'inputSchema': {'type': 'object', 'additionalProperties': False,
                                  'properties': {}, 'required': []}}
    cases = [('experimental_valid', True, [valid_tool]),
             ('experimental_disabled', False, [valid_tool]),
             ('experimental_invalid_tool', True, [{**valid_tool, 'name': 7}])]
    for index, (name, experimental, tools) in enumerate(cases):
        case_root = ROOT / f'case-{index}'
        case_root.mkdir(mode=0o700)
        case_profile = case_root / 'profile'
        case_profile.mkdir(mode=0o700)
        case_env = {**env, 'CODEX_HOME': str(case_profile)}
        args = ['app-server', '--listen', 'stdio://']
        for key, value in settings.items():
            args.extend(['-c', f'{key}=' + ('{}' if isinstance(value, dict) else json.dumps(value))])
        process = subprocess.Popen(prefix + args, cwd=case_root, env=case_env,
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True)
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        buffer = b''
        observed = []

        def send(value):
            process.stdin.write(json.dumps(value).encode() + b'\n')
            process.stdin.flush()

        def response(request_id):
            nonlocal buffer
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                for key, _ in selector.select(min(1, deadline - time.monotonic())):
                    data = os.read(key.fileobj.fileno(), 65536)
                    if not data:
                        raise RuntimeError('native_stdout_closed')
                    buffer += data
                    if len(buffer) > 2 * 1024 * 1024:
                        raise RuntimeError('native_frame_limit')
                    while b'\n' in buffer:
                        line, buffer = buffer.split(b'\n', 1)
                        if not line.strip():
                            continue
                        message = json.loads(line)
                        observed.append(message)
                        if message.get('id') == request_id:
                            return message
            raise RuntimeError('native_response_timeout')

        try:
            send({'id': 1, 'method': 'initialize', 'params': {
                'clientInfo': {'name': 'nodia_ai39_offline', 'version': '2'},
                'capabilities': {'experimentalApi': experimental}}})
            initialize = response(1)
            send({'method': 'initialized', 'params': {}})
            send({'id': 2, 'method': 'thread/start', 'params': {
                'cwd': str(case_root), 'ephemeral': True,
                'approvalPolicy': 'never', 'sandbox': 'read-only',
                'modelProvider': 'nodia_codex', 'dynamicTools': tools}})
            thread = response(2)
            results.append({
                'name': name, 'experimental_api': experimental,
                'initialize_result': 'result' in initialize,
                'thread_result': 'result' in thread,
                'thread_error_code': thread.get('error', {}).get('code'),
                'thread_error_message': thread.get('error', {}).get('message'),
                'ephemeral_observed': thread.get('result', {}).get('thread', {}).get('ephemeral'),
                'warning_messages': [m.get('params', {}).get('message') for m in observed
                                     if m.get('method') == 'configWarning'],
                'notification_methods': sorted({m['method'] for m in observed if 'method' in m}),
                'auth_file_present': (case_profile / 'auth.json').exists(),
            })
        finally:
            selector.close()
            process.stdin.close()
            try:
                process.wait(10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(5)
            stderr = process.stderr.read()
            if results and results[-1]['name'] == name:
                results[-1]['child_exit_code'] = process.returncode
                results[-1]['private_stderr_bytes'] = len(stderr)
    assert results[0]['thread_result']
    assert not results[1]['thread_result']
    assert not results[2]['thread_result']
    (ROOT / 'schema-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({
        'task': 'AI39-C01', 'scope': 'native_experimental_admission_without_inference',
        'binary_sha256': EXPECTED_BINARY_SHA, 'network_namespace': True,
        'schema_count': len(manifest),
        'schema_manifest_sha256': sha(json.dumps(manifest, sort_keys=True).encode()),
        'schemas': selected, 'native_cases': results,
        'inference_requests': 0, 'model_list_requests': 0, 'login_requests': 0,
        'account_read_requests': 0, 'personal_or_connection_profiles_opened': False,
        'private_stderr_emitted': False, 'native_tool_callback_verified': False,
        'profile_retained_for_inspection': str(ROOT),
    }, indent=2))


if __name__ == '__main__':
    main()
