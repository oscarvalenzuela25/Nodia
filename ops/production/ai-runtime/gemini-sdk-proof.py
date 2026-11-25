"""Production evidence for the private, read-only Gemini CV observation."""

import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import urllib.error
import urllib.request

RECORD = Path('/var/lib/nodia-ai-runtime-setup/gemini-cv-sdk-current.json')
PROFILE = Path('/var/lib/nodia-gemini/profile/teacher_sdk')
ENV = Path('/etc/nodia/ai-runtime/gemini.env')
SDK_ROOT = '/opt/nodia/teacher-gemini-sdk/20261102-r01'
MANIFEST_SHA256 = 'fe412d1059c2f9ac9d8637cc90b2007c72a664175f73b5246a27ebf6e7e7ccfa'
ADAPTER = 'nodia-gemini-microservice'
ENDPOINT = 'http://127.0.0.1:8000/cv/agentic-text/observe'
RECEIPT_KEYS = {'schema_version', 'image_id', 'source_sha', 'source_tree_sha',
                'manifest_sha256', 'runtime_hash', 'policy_hash'}

# Run with isolated system Python. Importing mutable application code would
# let the very files being measured control their attestation.
MATERIAL = """
import hashlib, json, os, pathlib, stat, sys, sysconfig
def digest(path, algorithm, limit):
    path = pathlib.Path(path)
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        raise ValueError('invalid_material')
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()
def canonical(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),
                                     ensure_ascii=False,allow_nan=False).encode()).hexdigest()
root=pathlib.Path(sys.argv[1])
expected=sys.argv[2]
if os.environ.get('NODIA_TEACHER_SDK_ROOT') != str(root) or os.environ.get('NODIA_TEACHER_SDK_MANIFEST_SHA256') != expected:
    raise ValueError('material_configuration_changed')
for directory in (root,*root.parents):
    info=directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022:
        raise ValueError('material_directory_unsafe')
manifest_path=root/'runtime-manifest.json'
if digest(manifest_path,'sha256',65536)!=expected: raise ValueError('manifest_changed')
manifest=json.loads(manifest_path.read_bytes())
python=digest(pathlib.Path(sys.executable).resolve(),'sha512',33554432)
if digest(root/'venv/bin/python3','sha512',33554432)!=python: raise ValueError('python_abi_changed')
library=(pathlib.Path(sysconfig.get_config_var('LIBDIR'))/sysconfig.get_config_var('LDLIBRARY')).resolve()
pins=manifest['host_source_pins']
for name, pin in pins.items():
    if digest(root/'host'/name,'sha256',262144)!=pin or digest(pathlib.Path('/app')/name,'sha256',262144)!=pin:
        raise ValueError('host_changed')
if digest(root/'requirements.lock','sha256',65536)!=manifest['requirements_lock_sha256']:
    raise ValueError('requirements_changed')
for row in manifest['vendor_files']:
    path=root/row['path']
    if path.stat().st_size!=row['bytes'] or digest(path,'sha256',262144)!=row['sha256']:
        raise ValueError('vendor_changed')
binary=root/'venv'/manifest['harness_relative_to_prefix']
if digest(binary,'sha256',160000000)!=manifest['harness_sha256']: raise ValueError('harness_changed')
files=('teacher_sdk_runtime.py','teacher_sdk_owner.py','teacher_sdk_launch.py','teacher_sdk_diagnostics.py',
       'teacher_runtime_backend.py','native_teacher_text.py','teacher_text_contract.py',
       'teacher_text_execution.py','owned_process.py','login_cgroups.py','native_attempts.py','profile_admission.py')
sources={name:digest(pathlib.Path('/app')/name,'sha256',524288) for name in files}
runtime=canonical({'contract':'teacher-sdk-native/1','manifest':expected,'native_sources':sources,
                   'python_sha512':python,'libpython_sha512':digest(library,'sha512',67108864),
                   'python_version':sys.version})
entry=canonical({name:digest(pathlib.Path('/app')/name,'sha256',524288)
                 for name in ('main.py','run.py','request_guard.py','service_auth.py')})
print(json.dumps({'runtime_hash':runtime,'policy_hash':canonical(pins),
                  'binary_sha512':digest(binary,'sha512',160000000),'adapter_entry_hash':entry}))
"""


def require(condition, code):
    if not condition:
        raise ValueError(code)


def unique_json(data):
    def pairs(rows):
        result = dict(rows)
        require(len(result) == len(rows), 'duplicate_gemini_cv_proof_key')
        return result
    return json.loads(data, object_pairs_hook=pairs)


def matches(value, expression):
    return isinstance(value, str) and re.fullmatch(expression, value) is not None


def protected_file(path, maximum):
    for directory in path.parents:
        info = directory.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == 0 and not info.st_mode & 0o022,
                'gemini_cv_proof_parent_unsafe')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600
                and info.st_uid == info.st_gid == 0 and info.st_nlink == 1 and 0 < info.st_size <= maximum,
                'gemini_cv_proof_file_unsafe')
        data = source.read(maximum + 1)
    require(0 < len(data) <= maximum, 'gemini_cv_proof_file_unsafe')
    return data


def profile_epoch(profile=PROFILE):
    for part in (profile.parent, profile, profile / 'antigravity-acp'):
        entry = part.lstat()
        require(stat.S_ISDIR(entry.st_mode) and entry.st_uid == 10001 and stat.S_IMODE(entry.st_mode) == 0o700,
                'gemini_cv_profile_unverified')
    token = (profile / 'antigravity-acp/acp_token.json').lstat()
    require(stat.S_ISREG(token.st_mode) and token.st_uid == 10001 and token.st_nlink == 1
            and stat.S_IMODE(token.st_mode) == 0o600 and 0 < token.st_size <= 65536, 'gemini_cv_token_unverified')
    descriptor = os.open(profile / 'session_epoch', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600
                and info.st_uid == 10001 and info.st_nlink == 1 and 0 < info.st_size <= 64,
                'gemini_cv_session_epoch_unverified')
        epoch = source.read(65).strip()
    require(re.fullmatch(rb'[0-9a-f]{32}', epoch), 'gemini_cv_session_epoch_unverified')
    return hashlib.sha256(epoch).hexdigest()


def docker_json(arguments, timeout=20):
    command = subprocess.run(['/usr/bin/docker', *arguments], stdin=subprocess.DEVNULL,
                             capture_output=True, timeout=timeout, check=False)
    require(command.returncode == 0 and 0 < len(command.stdout) <= 8192, 'gemini_cv_local_probe_failed')
    result = unique_json(command.stdout)
    require(type(result) is dict, 'gemini_cv_local_probe_invalid')
    return result


def generation(expected_image):
    row = docker_json(['inspect', '--type', 'container', '--format',
                       '{"container_id":{{json .Id}},"image_id":{{json .Image}},"pid":{{json .State.Pid}},'
                       '"started_at":{{json .State.StartedAt}},"running":{{json .State.Running}}}', ADAPTER])
    require(set(row) == {'container_id', 'image_id', 'pid', 'started_at', 'running'}
            and row['image_id'] == expected_image and type(row['pid']) is int and row['pid'] > 1
            and row['running'] is True and matches(row['container_id'], r'[a-f0-9]{64}')
            and matches(row['started_at'], r'[0-9-]{10}T[0-9:]{8}(?:\.[0-9]{1,9})?Z'),
            'gemini_cv_container_generation_unverified')
    return row


def runtime_material(container_id):
    require(matches(container_id, r'[a-f0-9]{64}'), 'gemini_cv_container_generation_unverified')
    material = docker_json(['exec', '--user', '10001:10001', container_id, '/usr/local/bin/python3', '-I', '-c',
                            MATERIAL, SDK_ROOT, MANIFEST_SHA256])
    require(set(material) == {'runtime_hash', 'policy_hash', 'binary_sha512', 'adapter_entry_hash'} and
            all(matches(material[name], r'[a-f0-9]{64}') for name in ('runtime_hash', 'policy_hash', 'adapter_entry_hash'))
            and matches(material['binary_sha512'], r'[a-f0-9]{128}'), 'gemini_cv_material_unverified')
    return material


def observe_selection(value, model, effort):
    require(matches(model, r'[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}') and matches(effort, r'[a-z][a-z0-9_-]{0,31}'),
            'gemini_cv_exact_selection_required')
    token_raw = protected_file(ENV, 8192).decode('ascii')
    token = re.fullmatch(r'GEMINI_SERVICE_TOKEN=([a-fA-F0-9]{64})\n', token_raw)
    require(token is not None, 'gemini_cv_service_token_unverified')
    basis = (value['source_tree_sha'] + ':' + model + ':' + effort).encode()
    payload = json.dumps({'contract': 'cv-agentic-text/1', 'model_id': model, 'effort_id': effort,
                          'configuration_generation': hashlib.sha256(basis).hexdigest()}).encode()
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(ENDPOINT, data=payload, headers={'X-Nodia-Service-Token': token.group(1),
                                                                     'Content-Type': 'application/json'})
    with opener.open(request, timeout=25) as response:
        require(response.status == 200 and response.url == ENDPOINT, 'gemini_cv_observation_unverified')
        data = response.read(8193)
    require(len(data) <= 8192, 'gemini_cv_observation_unverified')
    row = unique_json(data)
    require(type(row) is dict and set(row) == {'contract', 'available', 'reason', 'observed_at', 'resource_key',
            'session_generation', 'runtime_hash', 'binary_sha512', 'policy_hash', 'tool_policy', 'native_io'}
            and row['contract'] == 'cv-agentic-text/1' and row['available'] is True and row['reason'] is None
            and row['tool_policy'] == 'finish_only' and row['native_io'] is False
            and matches(row['resource_key'], r'gemini-profile:[a-f0-9]{64}')
            and matches(row['session_generation'], r'[a-f0-9]{32}'), 'gemini_cv_observation_unverified')
    return row


def capture_attestation(gemini_runtime, model, effort):
    before = generation(gemini_runtime['image_id'])
    epoch = profile_epoch()
    observed = observe_selection(gemini_runtime, model, effort)
    material = runtime_material(before['container_id'])
    require(all(observed[key] == material[key] for key in ('runtime_hash', 'policy_hash', 'binary_sha512')),
            'gemini_cv_observation_identity_mismatch')
    require(generation(gemini_runtime['image_id']) == before and profile_epoch() == epoch,
            'gemini_cv_observation_generation_changed')
    return {'receipt': {**gemini_runtime, 'manifest_sha256': MANIFEST_SHA256,
                        'runtime_hash': material['runtime_hash'], 'policy_hash': material['policy_hash']},
            'container': before, 'epoch_sha256': epoch, 'binary_sha512': material['binary_sha512'],
            'adapter_entry_hash': material['adapter_entry_hash']}


def cv_sdk_attestation(verified_gemini_runtime):
    try:
        RECORD.lstat()
    except FileNotFoundError:
        return None
    raw = protected_file(RECORD, 8192)
    record = unique_json(raw)
    require(type(record) is dict and set(record) == {'receipt', 'container', 'epoch_sha256', 'binary_sha512', 'adapter_entry_hash'},
            'gemini_cv_attestation_invalid')
    proof = record['receipt']
    require(type(verified_gemini_runtime) is dict
            and set(verified_gemini_runtime) == {'image_id', 'source_sha', 'source_tree_sha', 'schema_version'}
            and type(proof) is dict and set(proof) == RECEIPT_KEYS
            and type(proof['schema_version']) is int and proof['schema_version'] == 1
            and proof['manifest_sha256'] == MANIFEST_SHA256
            and all(proof.get(k) == v for k, v in verified_gemini_runtime.items())
            and matches(proof['image_id'], r'sha256:[a-f0-9]{64}')
            and all(matches(proof[k], r'[a-f0-9]{40}') for k in ('source_sha', 'source_tree_sha'))
            and all(matches(proof[key], r'[a-f0-9]{64}') for key in ('runtime_hash', 'policy_hash'))
            and all(matches(record[k], r'[a-f0-9]{64}') for k in ('epoch_sha256', 'adapter_entry_hash'))
            and matches(record['binary_sha512'], r'[a-f0-9]{128}'),
            'gemini_cv_attestation_invalid')
    container = generation(proof['image_id'])
    require(container == record['container'] and profile_epoch() == record['epoch_sha256'],
            'gemini_cv_attestation_generation_changed')
    material = runtime_material(container['container_id'])
    require(material == {'runtime_hash': proof['runtime_hash'], 'policy_hash': proof['policy_hash'],
                         'binary_sha512': record['binary_sha512'], 'adapter_entry_hash': record['adapter_entry_hash']}
            and generation(proof['image_id']) == container and profile_epoch() == record['epoch_sha256']
            and protected_file(RECORD, 8192) == raw, 'gemini_cv_attestation_material_changed')
    return proof
