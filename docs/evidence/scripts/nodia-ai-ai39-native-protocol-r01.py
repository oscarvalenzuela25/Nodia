"""Offline-only Codex protocol observation in a private disposable Linux profile.

Never opens Nodia's credential profiles, invokes login/model-list/turn-start, or
uses the desktop Codex runtime. Public schemas and structured booleans only.
Run with stdin under sudo on the lab VM; a network namespace enforces isolation.
"""
from pathlib import Path
import hashlib
import json
import os
import selectors
import signal
import subprocess
import time

SERVER = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
ROOT = Path('/opt/nodia/verification/ai39-native-protocol-r01')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    if os.name != 'posix' or ROOT.exists():
        raise RuntimeError('isolated_path_or_platform_invalid')
    resolver = """import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const r=createRequire(process.argv[1]);
const p=r.resolve('@openai/codex-linux-x64/package.json');
console.log(JSON.stringify({packagePath:p,binary:join(dirname(p),'vendor/x86_64-unknown-linux-musl/bin/codex')}));"""
    resolved = subprocess.run(
        ['/usr/local/bin/node', '--input-type=module', '-e', resolver,
         str(SERVER / 'package.json')], capture_output=True, timeout=15,
        env={'PATH': '/usr/bin:/bin'}, cwd='/tmp', check=True,
    )
    locations = json.loads(resolved.stdout)
    binary = Path(locations['binary']).resolve(strict=True)
    package_path = Path(locations['packagePath']).resolve(strict=True)
    package = json.loads(package_path.read_text())
    if not str(binary).startswith('/opt/nodia/'):
        raise RuntimeError('binary_outside_nodia')
    ROOT.mkdir(mode=0o700)
    home, profile, cwd = [ROOT / name for name in ('home', 'profile', 'work')]
    for path in (home, profile, cwd):
        path.mkdir(mode=0o700)
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8',
           'HOME': str(home), 'CODEX_HOME': str(profile),
           'XDG_CONFIG_HOME': str(home / 'config'),
           'XDG_DATA_HOME': str(home / 'data'),
           'XDG_CACHE_HOME': str(home / 'cache')}
    prefix = ['/usr/bin/unshare', '--net', '--']

    def run(args, timeout=30):
        return subprocess.run(prefix + [str(binary), *args],
                              cwd=cwd, env=env, capture_output=True,
                              timeout=timeout, check=True)

    version = run(['--version']).stdout.decode().strip()
    help_reply = run(['app-server', 'generate-json-schema', '--help'])
    schema_dir = ROOT / 'schemas'
    run(['app-server', 'generate-json-schema', '--out', str(schema_dir)], 60)
    schema_files = sorted(schema_dir.rglob('*.json'))
    manifest = [{'path': str(p.relative_to(schema_dir)), 'sha256': sha(p.read_bytes()),
                 'bytes': p.stat().st_size} for p in schema_files]
    interesting = {}
    for path in schema_files:
        if any(term in path.name.lower() for term in (
            'threadstartparams', 'dynamictool', 'toolcall', 'initializeparams',
            'turnstartparams', 'turninterrupt', 'threadarchive',
        )):
            obj = json.loads(path.read_text())
            interesting[str(path.relative_to(schema_dir))] = {
                'type': obj.get('type'), 'required': obj.get('required'),
                'properties': obj.get('properties'), '$defs': obj.get('$defs'),
                'definitions': obj.get('definitions'),
            }
    settings = {
        'cli_auth_credentials_store': 'keyring',
        'forced_login_method': 'chatgpt',
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
    # Empty inline tables are valid TOML; JSON scalar encoding matches the
    # settings already used by Nodia, without importing its .env or runtime.
    args = ['app-server', '--listen', 'stdio://']
    for key, value in settings.items():
        encoded = '{}' if isinstance(value, dict) else json.dumps(value)
        args.extend(['-c', f'{key}={encoded}'])
    process = subprocess.Popen(prefix + [str(binary), *args], cwd=cwd, env=env,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, start_new_session=True)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    buffer = b''
    received = []

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
                    received.append(message)
                    if message.get('id') == request_id:
                        return message
        raise RuntimeError('native_response_timeout')

    try:
        send({'id': 1, 'method': 'initialize', 'params': {
            'clientInfo': {'name': 'nodia_ai39_offline', 'version': '1'},
            'capabilities': {'experimentalApi': True}}})
        initialized = response(1)
        send({'method': 'initialized', 'params': {}})
        # thread/start creates metadata only. No turn/start, model/list,
        # auth read/login or inference requests are sent.
        send({'id': 2, 'method': 'thread/start', 'params': {
            'cwd': str(cwd), 'ephemeral': True, 'approvalPolicy': 'never',
            'sandbox': 'read-only', 'modelProvider': 'nodia_codex',
            'dynamicTools': [{'name': 'nodia_ai39_protocol_probe',
                              'description': 'Synthetic offline schema probe.',
                              'inputSchema': {'type': 'object',
                                              'additionalProperties': False,
                                              'properties': {}, 'required': []}}],
        }})
        thread = response(2)
        thread_obj = thread.get('result', {}).get('thread', {})
        thread_id = thread_obj.get('id')
        if isinstance(thread_id, str):
            send({'id': 3, 'method': 'thread/archive', 'params': {'threadId': thread_id}})
            archived = response(3)
        else:
            archived = None
        summary = {
            'initialize_result': 'result' in initialized,
            'initialize_error_code': initialized.get('error', {}).get('code'),
            'thread_start_result': 'result' in thread,
            'thread_start_error_code': thread.get('error', {}).get('code'),
            'thread_start_error_message': thread.get('error', {}).get('message'),
            'thread_created': isinstance(thread_id, str),
            'ephemeral_observed': thread_obj.get('ephemeral'),
            'archive_result': bool(archived and 'result' in archived),
            'archive_error_code': archived.get('error', {}).get('code') if archived else None,
            'notification_methods': sorted({m['method'] for m in received if 'method' in m}),
        }
    finally:
        selector.close()
        process.stdin.close()
        try:
            process.wait(10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(5)
        private_stderr = process.stderr.read()
    result = {
        'task': 'AI39-C01', 'scope': 'native_protocol_without_account_or_inference',
        'version': version, 'package_version': package['version'],
        'binary_path': str(binary), 'binary_sha256': sha(binary.read_bytes()),
        'network_namespace': True, 'isolated_home': True,
        'inherited_environment_keys': sorted(env),
        'requested_methods': ['initialize', 'initialized', 'thread/start', 'thread/archive'],
        'inference_requests': 0, 'model_list_requests': 0, 'login_requests': 0,
        'account_read_requests': 0, 'personal_or_connection_profiles_opened': False,
        'schema_count': len(manifest),
        'schema_manifest_sha256': sha(json.dumps(manifest, sort_keys=True).encode()),
        'schema_details': interesting, 'native': summary,
        'child_exit_code': process.returncode,
        'private_stderr_bytes': len(private_stderr), 'private_stderr_emitted': False,
        'synthetic_profile_auth_file_present': (profile / 'auth.json').exists(),
        'profile_retained_for_inspection': str(ROOT),
    }
    (ROOT / 'schema-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
