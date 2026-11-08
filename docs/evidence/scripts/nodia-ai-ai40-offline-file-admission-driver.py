"""Repeatable diagnostic runner with fresh isolated attempts and closed errors.

The immutable probe owns an allowlist excluding all inference/account methods.
"""
from pathlib import Path
import hashlib
import json
import re
import sys
import traceback

suffix = sys.argv[1]
assert re.fullmatch('r[0-9]{2}', suffix)
original = Path('/opt/nodia/verification/ai40-document-audio-r01/offline-file-admission.py')
source = original.read_bytes()
assert hashlib.sha256(source).hexdigest() == '0c58046be2fe837545e86c710dbd61781f27b10a877b773500df88bfa6734f26'
successor = source.replace(b"ROOT = Path('/opt/nodia/verification/ai40-offline-file-admission-r01')",
                           ("ROOT = Path('/opt/nodia/verification/ai40-offline-file-admission-" + suffix + "')").encode())
successor = successor.replace(b'home.mkdir(mode=0o700)', b"home.mkdir(mode=0o700)\n(home / 'empty-codex').mkdir(mode=0o700)")
state = {'__file__': str(original), '__name__': '__main__'}
try:
    exec(compile(successor, str(original), 'exec'), state)
except Exception as error:
    native_error = state.get('stderr', b'').lower()
    classes = {key: token in native_error for key, token in {
        'network_namespace_permission': b'unshare:', 'operation_not_permitted': b'operation not permitted',
        'config_load': b'config', 'toml': b'toml', 'invalid_value': b'invalid value',
        'unknown_variant': b'unknown variant', 'unknown_field': b'unknown field', 'keyring': b'keyring',
        'no_such_file': b'no such file', 'codex_home': b'codex_home', 'provider': b'provider', 'missing_required': b'missing', 'usage': b'usage:', 'unexpected_argument': b'unexpected argument',
        'url': b'url', 'read_only_fs': b'read-only file system', 'permission_denied': b'permission denied'}.items()}
    process = state.get('process')
    print(json.dumps({'schema': 'nodia-ai-ai40-offline-file-admission-diagnostic-v1', 'status': 'offline_probe_failed',
                      'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'attempt': suffix,
                      'original_source_sha256': hashlib.sha256(source).hexdigest(), 'exception_class': type(error).__name__,
                      'source_frames': [{'line': frame.lineno, 'function': frame.name} for frame in traceback.extract_tb(error.__traceback__) if frame.filename == str(original)],
                      'methods': state.get('methods', []), 'results_completed': state.get('results'),
                      'native_child_exit_code': process.poll() if process else None, 'stderr_classifications': classes, 'private_stderr_bytes': len(native_error),
                      'last_safe_response': state['summary'](next((m for m in reversed(state.get('messages', [])) if 'id' in m), {})) if 'summary' in state else None,
                      'native_group_absent': state.get('group_absent'), 'private_details_emitted': False,
                      'provider_generations': 0, 'provider_observations': 0, 'operational_profile_reads': 0}))
