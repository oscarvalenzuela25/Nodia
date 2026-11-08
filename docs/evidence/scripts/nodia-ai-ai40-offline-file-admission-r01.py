"""Offline admission only: synthetic PDF into an ephemeral, unauthenticated thread.

Network namespace and an empty private HOME exclude the operational account.
The allowlist cannot send a turn, login, account, model or realtime request.
"""
from pathlib import Path
import base64
import hashlib
import json
import os
import selectors
import signal
import subprocess
import time

ROOT = Path('/opt/nodia/verification/ai40-offline-file-admission-r01')
BINARY = Path('/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
PIN = '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c'
assert BINARY.is_file() and not BINARY.is_symlink() and hashlib.sha256(BINARY.read_bytes()).hexdigest() == PIN
assert not ROOT.exists() and not ROOT.is_symlink()
ROOT.mkdir(mode=0o700)
home = ROOT / 'home'
home.mkdir(mode=0o700)
env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(home), 'CODEX_HOME': str(home / 'empty-codex'),
       'XDG_CONFIG_HOME': str(home / 'config'), 'XDG_DATA_HOME': str(home / 'data'), 'XDG_CACHE_HOME': str(home / 'cache')}
settings = {'cli_auth_credentials_store': 'keyring', 'forced_login_method': 'chatgpt',
            'model_provider': 'nodia_codex', 'model_providers.nodia_codex.name': 'Offline PDF admission fixture',
            'model_providers.nodia_codex.wire_api': 'responses', 'model_providers.nodia_codex.requires_openai_auth': True,
            'model_providers.nodia_codex.request_max_retries': 0, 'model_providers.nodia_codex.stream_max_retries': 0,
            'model_providers.nodia_codex.supports_websockets': False,
            **{'features.' + key: False for key in ('shell_tool', 'unified_exec', 'apply_patch_freeform', 'multi_agent',
                'apps', 'plugins', 'code_mode', 'memories', 'remote_control', 'remote_plugin')},
            'web_search': 'disabled', 'check_for_update_on_startup': False, 'analytics.enabled': False,
            'feedback.enabled': False, 'project_doc_max_bytes': 0, 'shell_environment_policy.inherit': 'none', 'mcp_servers': {}}
args = ['/usr/bin/unshare', '--net', '--', str(BINARY), 'app-server', '--listen', 'stdio://']
for key, value in settings.items():
    args += ['-c', key + '=' + ('{}' if isinstance(value, dict) else json.dumps(value))]
process = subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE, start_new_session=True)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)
buffer, messages, methods = b'', [], []


def request(request_id, method, params):
    global buffer
    assert method in ('initialize', 'initialized', 'thread/start', 'thread/inject_items', 'thread/read')
    methods.append(method)
    frame = {'method': method, 'params': params}
    if request_id is not None:
        frame['id'] = request_id
    process.stdin.write(json.dumps(frame).encode() + b'\n')
    process.stdin.flush()
    if request_id is None:
        return None
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        for key, _ in selector.select(min(1, deadline - time.monotonic())):
            data = os.read(key.fileobj.fileno(), 65536)
            assert data, 'offline_stdout_closed'
            buffer += data
            assert len(buffer) <= 1024 * 1024, 'offline_frame_limit'
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                if not line.strip():
                    continue
                message = json.loads(line)
                messages.append(message)
                if message.get('id') == request_id:
                    return message
    raise ValueError('offline_response_timeout')


def summary(message):
    error = message.get('error', {})
    text = error.get('message')
    return {'result_received': 'result' in message, 'error_code': error.get('code'),
            'error_message': text if isinstance(text, str) and text.isascii() and len(text) <= 2048 else None}


results = {}
try:
    results['initialize'] = summary(request(1, 'initialize', {'clientInfo': {'name': 'nodia_ai40_offline_pdf', 'version': '1'}}))
    assert results['initialize']['result_received']
    request(None, 'initialized', {})
    thread = request(2, 'thread/start', {'cwd': str(ROOT), 'ephemeral': True, 'approvalPolicy': 'never',
                                       'sandbox': 'read-only', 'modelProvider': 'nodia_codex'})
    results['thread_start'] = summary(thread)
    assert thread.get('result', {}).get('thread', {}).get('ephemeral') is True
    thread_id = thread['result']['thread']['id']
    results['text_positive_control'] = summary(request(3, 'thread/inject_items', {'threadId': thread_id,
        'items': [{'type': 'message', 'role': 'user', 'content': [{'type': 'input_text', 'text': 'Offline synthetic admission control.'}]}]}))
    pdf = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'
    results['PDF_fixture'] = {'bytes': len(pdf), 'sha256': hashlib.sha256(pdf).hexdigest(), 'personal_data': False}
    results['PDF_input_file'] = summary(request(4, 'thread/inject_items', {'threadId': thread_id,
        'items': [{'type': 'message', 'role': 'user', 'content': [{'type': 'input_file', 'filename': 'offline-synthetic.pdf',
                    'file_data': 'data:application/pdf;base64,' + base64.b64encode(pdf).decode()}]}]}))
    read = request(5, 'thread/read', {'threadId': thread_id, 'includeTurns': True})
    results['thread_read_after_injection'] = summary(read)
    read_json = json.dumps(read.get('result', {}))
    results['read_projection'] = {'input_file_tag_present': 'input_file' in read_json,
                                   'PDF_filename_present': 'offline-synthetic.pdf' in read_json,
                                   'PDF_data_uri_present': 'data:application/pdf;base64,' in read_json,
                                   'control_text_present': 'Offline synthetic admission control.' in read_json}
finally:
    selector.close()
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        _, stderr = process.communicate(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        _, stderr = process.communicate(timeout=5)
    try:
        os.killpg(process.pid, 0)
        group_absent = False
    except ProcessLookupError:
        group_absent = True
assert group_absent
print(json.dumps({'schema': 'nodia-ai-ai40-offline-file-admission-v1', 'status': 'admission_observed_not_model_support',
                  'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'binary_sha256': PIN,
                  'network_namespace': True, 'empty_isolated_HOME': str(home), 'methods': methods, 'results': results,
                  'synthetic_auth_file_created': (home / 'empty-codex/auth.json').exists(), 'native_child_exit_code': process.returncode,
                  'native_process_group_absent': group_absent, 'private_stderr_bytes': len(stderr), 'private_stderr_emitted': False,
                  'provider_observations': 0, 'provider_generations': 0, 'operational_profile_reads': 0, 'SQL_writes': 0,
                  'services_changed': False, 'upstream_PDF_inference_proven': False}))
