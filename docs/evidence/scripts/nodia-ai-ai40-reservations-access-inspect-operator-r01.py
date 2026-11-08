"""R07 reservations authority snapshot: private DB stdin, no SDK or profile access."""
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
STAGE = Path('/opt/nodia/verification/ai40-reservations-access-inspection-r01')
INSPECTOR = STAGE / 'nodia-ai-ai40-reservations-access-inspect-r01.mjs'
INSPECTOR_SHA = '6f4c1df5d610f55ed087264375050cf1b505251f0f198c5caf9e7c3bd31f8264'
RELEASE = '/opt/nodia/releases/nodia-server-ai40-r07'
RELEASE_SHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
BASELINE_SHA = '66adee8d18b2da94f43404107c81bec3ff9df77910a82d98607415a9380bd474'

# Only the six database options leave this resolver through its private pipe.
DB_RESOLVER = r"""
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(process.cwd()+'/package.json');
const parsed=require('dotenv').parse(await readFile(process.env.DOTENV_CONFIG_PATH));
const names=['POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'];
const selected=Object.fromEntries(names.map(key=>[key,process.env[key]??parsed[key]]));
assert.equal(selected.POSTGRES_HOST,'127.0.0.1');
assert.match(selected.POSTGRES_PORT,/^[0-9]{1,5}$/u);
const port=Number(selected.POSTGRES_PORT);assert.ok(port>0&&port<=65535);
for(const key of ['POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD'])assert.ok(typeof selected[key]==='string'&&selected[key].length>0&&Buffer.byteLength(selected[key])<=4096&&!/[\0\r\n]/u.test(selected[key]));
assert.ok(selected.POSTGRES_SSL===undefined||selected.POSTGRES_SSL==='true'||selected.POSTGRES_SSL==='false');
console.log(JSON.stringify({host:selected.POSTGRES_HOST,port,database:selected.POSTGRES_DB,username:selected.POSTGRES_USER,password:selected.POSTGRES_PASSWORD,ssl:selected.POSTGRES_SSL==='true'}));
"""


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_descriptor(value):
    require(type(value) is dict and set(value) == {'schema_version', 'conversation_id', 'expected_owner_id', 'authority_run_id'}, 'descriptor_keys_invalid')
    require(type(value['schema_version']) is int and value['schema_version'] == 1, 'descriptor_version_invalid')
    for key in ('conversation_id', 'authority_run_id'):
        require(type(value[key]) is str and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', value[key]), 'descriptor_identity_invalid')
    owner = value['expected_owner_id']
    require(type(owner) is str and re.fullmatch('[1-9][0-9]{0,18}', owner) and int(owner) <= 9223372036854775807, 'descriptor_owner_invalid')
    return value


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
    descriptor = validate_descriptor(json.loads(raw))
    before = transport.consumers(); provenance = transport.package(before['nodia-api']['release'])
    selected = transport.selected_environment(before['nodia-api']['pid'], False)
    require(selected.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
    configuration = Path(selected['DOTENV_CONFIG_PATH']); metadata_before = configuration.stat()
    resolver = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-e', DB_RESOLVER], cwd=RELEASE,
                             env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'DOTENV_CONFIG_QUIET': 'true', **selected},
                             capture_output=True, timeout=15, check=False)
    require(resolver.returncode == 0 and len(resolver.stdout) <= 32768, 'private_database_configuration_unavailable')
    database = json.loads(resolver.stdout)
    require(type(database) is dict and set(database) == {'host', 'port', 'database', 'username', 'password', 'ssl'}, 'private_database_contract_invalid')
    require(database['host'] == '127.0.0.1' and type(database['port']) is int and 0 < database['port'] <= 65535 and type(database['ssl']) is bool, 'private_database_transport_invalid')
    for name in ('database', 'username', 'password'):
        require(type(database[name]) is str and 0 < len(database[name].encode()) <= 4096 and not re.search('[\0\r\n]', database[name]), 'private_database_value_invalid')
    payload = json.dumps({**descriptor, 'database': database}).encode()
    require(len(payload) <= 16384, 'private_descriptor_size_invalid')
    user = pwd.getpwnam('nodia'); require(user.pw_uid == 10000, 'inspector_user_changed')
    clean_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': user.pw_dir, 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    child = subprocess.run(['/usr/sbin/runuser', '--preserve-environment', '-u', 'nodia', '--', '/usr/local/bin/node', '--input-type=module', '-e', INSPECTOR.read_text()],
                           input=payload, cwd=RELEASE, env=clean_env, capture_output=True, timeout=75, check=False)
    require(len(child.stdout) <= 65536, 'inspection_output_exceeded')
    result = json.loads(child.stdout)
    require(type(result) is dict and result.get('schema') == 'nodia-ai-ai40-reservations-access-inspection-v1'
            and result.get('status') in ('observed_read_only', 'inspection_failed') and result.get('SQL_read_only') is True
            and result.get('SQL_writes') == 0 and result.get('provider_requests') == 0 and result.get('provider_methods_invoked') == []
            and all(result.get(key) is False for key in ('domain_handler_invoked', 'profile_accessed_by_script', 'seed_executed', 'modules_permissions_or_configuration_changed', 'credentials_or_private_content_emitted')), 'inspection_receipt_invalid')
    after = transport.consumers()
    metadata_after = configuration.stat()
    require(before == after and selected == transport.selected_environment(after['nodia-api']['pid'], False)
            and (metadata_before.st_dev, metadata_before.st_ino, metadata_before.st_mtime_ns, metadata_before.st_size)
            == (metadata_after.st_dev, metadata_after.st_ino, metadata_after.st_mtime_ns, metadata_after.st_size), 'consumer_or_configuration_changed')
    return {'schema': 'nodia-ai-ai40-reservations-access-inspection-operator-v1', 'status': result['status'], 'operator_sha256': args.operator_sha256,
            'inspector_sha256': INSPECTOR_SHA, 'inherited_readonly_transport_sha256': BASE_SHA, 'baseline_scope_reference_sha256': BASELINE_SHA,
            'baseline_proofs_reobserved_by_this_reader': False, 'provenance': provenance, 'consumers': after, 'inspection': result,
            'child_exit_code': child.returncode, 'private_stderr_bytes': len(child.stderr), 'private_stderr_emitted': False,
            'private_database_options_persisted_or_emitted': False, 'profile_accessed': False, 'SDK_observations': 0,
            'provider_requests': 0, 'SQL_writes': 0, 'R2_accessed': False, 'services_changed': False, 'configuration_changed': False}, child.returncode


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--operator-sha256', required=True); args = parser.parse_args()
    try:
        report, code = run(args); print(json.dumps(report)); sys.exit(code)
    except Exception as error:
        value = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-reservations-access-inspection-operator-v1', 'status': 'operator_failed',
                          'error_class': type(error).__name__, 'error_code': value if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', value) else 'readonly_dependency_or_protocol_error',
                          'provider_requests': 0, 'SQL_writes': 0, 'SDK_observations': 0, 'profile_accessed': False, 'R2_accessed': False, 'private_details_emitted': False})); sys.exit(1)
