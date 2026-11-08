"""Typed native ACK reads for exact product attempts on R07; no SDK, SQL or mutation."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

BASE = Path('/opt/nodia/verification/ai40-r06-image-ui-inspection-r01/nodia-ai-ai40-r06-image-ui-inspect-operator-r01.py')
BASE_SHA = '48324dbd99493d5e6ed202df21e7d686fe9fe9d0e5399d880e70e04e3840af20'
STAGE = Path('/opt/nodia/verification/ai40-r08-completed-native-ack-r01')
INSPECTOR = STAGE / 'nodia-ai-ai40-r08-completed-native-ack-r01.mjs'
INSPECTOR_SHA = '08f8c2d725d6e39d806dee2f03521e46cf38912bd7452752c4fa46ef2c275988'
RELEASE = '/opt/nodia/releases/nodia-server-ai40-r08'
RELEASE_SHA = '08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    import pwd
    sys.dont_write_bytecode = True
    require(BASE.is_file() and not BASE.is_symlink() and sha(BASE) == BASE_SHA, 'readonly_transport_source_changed')
    spec = importlib.util.spec_from_file_location('immutable_readonly_transport', BASE)
    transport = importlib.util.module_from_spec(spec); spec.loader.exec_module(transport)
    transport.PACKAGES = {RELEASE: RELEASE_SHA}; transport.INSPECTOR_SHA = INSPECTOR_SHA
    for path in (BASE, Path(__file__).resolve(), INSPECTOR):
        require(path.resolve() == path, 'operator_path_not_canonical'); transport.private_file(path)
    require(sha(Path(__file__).resolve()) == args.operator_sha256 and sha(INSPECTOR) == INSPECTOR_SHA, 'operator_or_inspector_source_changed')
    raw = sys.stdin.buffer.read(8193); require(0 < len(raw) <= 8192, 'descriptor_size_invalid')
    descriptor = json.loads(raw)
    require(type(descriptor) is dict and set(descriptor) == {'schema_version', 'conversation_id', 'expected_owner_id', 'run_id', 'job_id', 'sql_receipt_sha256', 'attempts','proof_sha256'}
            and type(descriptor['schema_version']) is int and descriptor['schema_version'] == 1
            and type(descriptor['attempts']) is list and 0 < len(descriptor['attempts']) <= 4, 'descriptor_envelope_invalid')
    before = transport.consumers(); provenance = transport.package(before['nodia-api']['release'])
    user = pwd.getpwnam('nodia'); require(user.pw_uid == 10000, 'inspector_user_changed')
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': user.pw_dir, 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    child = subprocess.run(['/usr/sbin/runuser', '--preserve-environment', '-u', 'nodia', '--', '/usr/local/bin/node', '--input-type=module', '-e', INSPECTOR.read_text()],
                           input=raw, cwd=RELEASE, env=env, capture_output=True, timeout=30, check=False)
    require(len(child.stdout) <= 65536, 'inspection_output_exceeded')
    result = json.loads(child.stdout)
    require(type(result) is dict and result.get('schema') == 'nodia-ai-ai40-R08-completed-native-ack-v1'
            and result.get('status') in ('passed', 'inspection_failed') and result.get('provider_requests') == 0
            and result.get('SDK_observations') == 0 and result.get('SQL_reads') == 0 and result.get('SQL_writes') == 0, 'inspection_receipt_invalid')
    if result['status'] == 'passed':
        require(result.get('proofs_and_session_byte_exact') is True and result.get('credentials_or_private_content_emitted') is False
                and len(result.get('records', [])) == len(descriptor['attempts']), 'native_closure_receipt_invalid')
    after = transport.consumers(); require(before == after, 'consumer_changed_during_inspection')
    return {'schema': 'nodia-ai-ai40-product-read-native-ack-operator-v1', 'status': result['status'], 'operator_sha256': args.operator_sha256,
            'inspector_sha256': INSPECTOR_SHA, 'inherited_readonly_transport_sha256': BASE_SHA, 'provenance': provenance, 'consumers': after,
            'inspection': result, 'child_exit_code': child.returncode, 'private_stderr_bytes': len(child.stderr), 'private_stderr_emitted': False,
            'profile_access_read_only': True, 'provider_requests': 0, 'SDK_observations': 0, 'SQL_reads': 0, 'SQL_writes': 0,
            'mutations': 0, 'R2_accessed': False, 'services_changed': False}, child.returncode


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--operator-sha256', required=True); args = parser.parse_args()
    try:
        report, code = run(args); print(json.dumps(report)); sys.exit(code)
    except Exception as error:
        value = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-product-read-native-ack-operator-v1', 'status': 'operator_failed',
                          'error_class': type(error).__name__, 'error_code': value if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', value) else 'readonly_dependency_or_protocol_error',
                          'provider_requests': 0, 'SDK_observations': 0, 'SQL_reads': 0, 'SQL_writes': 0, 'mutations': 0, 'private_details_emitted': False})); sys.exit(1)
