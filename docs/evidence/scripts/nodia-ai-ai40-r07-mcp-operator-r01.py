"""One explicit MCP qualification against frozen R07; no required image proofs.

The immutable historical helper contributes read-only process/profile/journal/
SQL guards and the public configuration SELECT. The packaged R05-ABI parent
owns disposable SQL; no production DB writes, settings, adoption or replay.
A consumed intent or uncertain parent is never rerun: inspect exact SQL/native
identities and reconcile through a new pinned operator; keep the parent fixture
until closure/ACK. Successful cleanup deletes its job rather than leaving done.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys

RELEASE = Path('/opt/nodia/releases/nodia-server-ai40-r07')
RELEASE_SHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
EXPECTED_RUNTIME_FINGERPRINT = '1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a'
# Exact R07 candidate fingerprint is bound to the offline preparation receipt; it is not account acceptance.
WORK = Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01')
HELPER = Path('/opt/nodia/verification/ai40-image-operator-r01/nodia-ai-ai40-image-operator-r03.py')
HELPER_SHA = '1996130038b546458ddd7f608ea23d690cc094ef8c7b5009c98d711356cfe957'
LEGACY_MANIFEST_SHA = 'df107764de9b1b53830263ac380d0e56ce9e38ef09cea5042f82a3be00f4bb2b'
HARNESSES = {
 'test/nodia-ai-ai40-real-canary.mjs': '04d008e977afecd008165086d86277e5e51fae0dbec85562b038b56e5232d055',
 'test/nodia-ai-ai40-real-canary-parent.mjs': 'b954adf3d2f63ec8b09103fbd3ac5ec40a304a65ad206c158be0e1e53a3c63a9',
 'test/nodia-ai.integration.fixture.mjs': '6d595c1fa88e29c42149573dc9bdcb805a7b495aee39ac5cac4c50147bc806df',
}


def require(value, code):
 if not value:
  raise ValueError(code)


def sha(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()


def private_file(path):
 info = path.lstat()
 require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
         and stat.S_IMODE(info.st_mode) == 0o600 and path.resolve() == path, 'private_operator_file_invalid')


def historical_guard_file(path):
 info = path.lstat()
 require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
         and stat.S_IMODE(info.st_mode) == 0o644 and path.resolve() == path, 'historical_guard_identity_invalid')


def private_work():
 info = WORK.lstat()
 require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700
         and WORK.resolve() == WORK, 'operator_work_invalid')


def write_once(path, value):
 require(path.parent == WORK, 'operator_receipt_path_invalid')
 fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
 with os.fdopen(fd, 'w', encoding='utf8', newline='\n') as stream:
  json.dump(value, stream)
  stream.flush()
  os.fsync(stream.fileno())
 directory = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
 try:
  os.fsync(directory)
 finally:
  os.close(directory)


def validate_release():
 require(type(RELEASE_SHA) is str and re.fullmatch('[a-f0-9]{64}', RELEASE_SHA), 'release_pin_not_frozen')
 require(RELEASE.resolve() == RELEASE and RELEASE.is_dir(), 'release_path_invalid')
 manifest_path = RELEASE / 'release-manifest.json'
 require(sha(manifest_path) == RELEASE_SHA, 'release_manifest_changed')
 manifest = json.loads(manifest_path.read_bytes())
 files = manifest.get('files')
 require(type(files) is dict and 100 < len(files) < 20000, 'release_inventory_invalid')
 for name, pin in files.items():
  require(type(name) is str and type(pin) is str and re.fullmatch('[a-f0-9]{64}', pin), 'release_member_invalid')
  relative = PurePosixPath(name)
  require(not relative.is_absolute() and '..' not in relative.parts and '\\' not in name
          and all(not p.startswith('.env') for p in relative.parts), 'release_member_invalid')
  path = RELEASE.joinpath(*relative.parts)
  info = path.lstat()
  require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and path.resolve().is_relative_to(RELEASE)
          and sha(path) == pin, 'release_bytes_changed')
 for name, pin in HARNESSES.items():
  require(files.get(name) == pin, 'packaged_r05_abi_harness_changed')
 return {'release': str(RELEASE), 'manifest_sha256': RELEASE_SHA, 'files': len(files),
         'packaged_R05_ABI_harness_pins': HARNESSES}



def nodia_uid():
 import pwd
 return pwd.getpwnam('nodia').pw_uid


def acceptance_presence(helper):
 values = {}
 for suffix in ('mcp', 'mcp-image-png', 'mcp-image-jpeg', 'mcp-image-webp'):
  path = helper.PROFILE / '1' / ('nodia-chat-' + suffix)
  try:
   info = path.lstat()
  except FileNotFoundError:
   values[suffix] = False
   continue
  require(stat.S_ISREG(info.st_mode) and info.st_uid == nodia_uid()
          and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1 and info.st_size <= 4096,
          'acceptance_identity_invalid')
  values[suffix] = True
 return values


def mcp_acceptance(helper, child, selection):
 path = helper.PROFILE / '1' / 'nodia-chat-mcp'
 fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
 with os.fdopen(fd, 'rb') as stream:
  info = os.fstat(stream.fileno())
  require(stat.S_ISREG(info.st_mode) and info.st_uid == nodia_uid()
          and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1 and info.st_size <= 4096,
          'acceptance_identity_invalid')
  raw = stream.read(4097)
 require(len(raw) == info.st_size, 'acceptance_size_changed')
 value = json.loads(raw)
 require(type(value) is dict and set(value) == {'version', 'scope', 'verifiedAt', 'terminalProofId', 'nonceSha256'}
         and value['version'] == 1 and value['terminalProofId'] == child['terminal_proof_id']
         and type(value['nonceSha256']) is str and re.fullmatch('[a-f0-9]{64}', value['nonceSha256']),
         'acceptance_provenance_invalid')
 scope = value['scope']
 require(type(scope) is dict and set(scope) == {'connectionId', 'resourceKey', 'sessionGeneration',
         'configurationGeneration', 'modelId', 'effortId', 'runtimeFingerprint'}
         and scope['connectionId'] == selection['connection_id'] and scope['modelId'] == selection['model_id']
         and scope['effortId'] == selection['effort_id']
         and type(scope['resourceKey']) is str and re.fullmatch('codex-profile:[a-f0-9]{64}', scope['resourceKey'])
         and type(scope['sessionGeneration']) is str and re.fullmatch('[a-f0-9]{32}', scope['sessionGeneration'])
         and type(scope['configurationGeneration']) is str and re.fullmatch('[a-f0-9]{64}', scope['configurationGeneration'])
         and scope['runtimeFingerprint'] == EXPECTED_RUNTIME_FINGERPRINT, 'acceptance_scope_mismatch')
 return {'sha256': hashlib.sha256(raw).hexdigest(), 'scope': scope, 'verified_at': value['verifiedAt'],
         'terminal_proof_id': value['terminalProofId'], 'nonce_sha256': value['nonceSha256']}


def validate_parent(value, returncode, selection):
 require(type(value) is dict and value.get('schema') == 'nodia-ai-ai40-real-canary-parent-v1', 'parent_receipt_invalid')
 child = value.get('child')
 require(type(child) is dict and child.get('schema') == 'nodia-ai-ai40-real-canary-v1', 'child_receipt_missing')
 # Do not mistake cleanup after a failed generation for successful MCP acceptance.
 success = returncode == 0 and value.get('status') == 'passed' and child.get('status') == 'passed'
 if success:
  require(value.get('fixture_resources_removed') is True and value.get('retained_disposable_container') is None
          and value.get('child_exit_code') == 0 and value.get('child_exit_signal') is None
          and value.get('child_timed_out') is False, 'parent_success_cleanup_invalid')
  require(child.get('selection') == selection and child.get('acceptance_kind') == 'mcp_transport'
          and child.get('provider_dispatches_armed') == 1 and child.get('gateway_callbacks') == 1
          and child.get('final_mcp_accepted') is True and child.get('run_state') == 'completed'
          and child.get('assistant_message_sealed') is False, 'mcp_success_semantics_invalid')
  require(child.get('readiness_overridden') is False and child.get('executable_overridden') is False
          and child.get('publication_overridden') is False and child.get('operational_database_accessed') is False
          and value.get('operational_database_accessed') is False
          and child.get('operational_profile_removed') is False
          and value.get('operational_profile_removed') is False, 'mcp_success_authority_invalid')
  require(type(child.get('terminal_proof_id')) is str
          and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', child['terminal_proof_id'])
          and type(child.get('response_sha256')) is str and re.fullmatch('[a-f0-9]{64}', child['response_sha256']),
          'mcp_success_terminal_missing')
 return success


def run(args):
 sys.dont_write_bytecode = True
 require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
 private_work()
 private_file(Path(__file__).resolve())
 require(sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_source_changed')
 historical_guard_file(HELPER)
 require(sha(HELPER) == HELPER_SHA, 'historical_guard_changed')
 spec = importlib.util.spec_from_file_location('pinned_image_guard', HELPER)
 helper = importlib.util.module_from_spec(spec)
 spec.loader.exec_module(helper)
 # Pin all historical helper dependencies, including its public-config SELECT.
 legacy = helper.validate_candidate(LEGACY_MANIFEST_SHA)
 release = validate_release()
 helper.ACTIVE = RELEASE
 services = {name: helper.service(name) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-keyring')}
 before = helper.public_preflight(services)
 before_acceptance = acceptance_presence(helper)
 require(not any(before_acceptance.values()), 'fresh_qualification_requires_no_historical_proofs')
 intent = WORK / 'intent-mcp.json'
 require(not intent.exists(), 'generation_intention_already_consumed')
 api = helper.selected_environment(services['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST',
       'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
 require(api.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
 env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'AI40_CONNECTION_ID': '1',
        **{key: value for key, value in api.items() if key != 'TZ'}}
 source = (helper.CANDIDATE.parent / 'public-canary-input.mjs').read_text()
 observed = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source], cwd=RELEASE, env=env, timeout=25)
 require(observed.returncode == 0 and len(observed.stdout) < 1024 * 1024, 'public_configuration_read_failed')
 config = json.loads(observed.stdout)
 require(type(config) is dict and set(config) == {'schema_version', 'authorize_one_real_generation', 'selection', 'provider', 'expected_binary_sha256'}
         and config.get('schema_version') == 1 and config.get('authorize_one_real_generation') is True, 'mcp_configuration_invalid')
 selection = config.get('selection')
 require(type(selection) is dict and set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'}
         and selection['connection_id'] == '1' and selection['mode'] == 'token_plan_agentic'
         and type(selection['model_id']) is str and selection['model_id'].strip()
         and (selection['effort_id'] is None or type(selection['effort_id']) is str), 'observed_selection_invalid')
 require(config['expected_binary_sha256'] == helper.BINARY_SHA, 'native_binary_changed')
 report = {'schema': 'nodia-ai-ai40-r07-mcp-operator-v1', 'phase': args.phase,
           'operator_sha256': args.operator_sha256, 'predecessor_sha256': '287f1673da85074275c0595e6ab245c113fe9ff949fd0514c16a39493d999588',
           'historical_guard_metadata': {'uid': 0, 'mode': '0644', 'nlink': 1}, 'release': release, 'legacy_guard_provenance': legacy,
           'services': services, 'before': before, 'selection': selection,
           'public_configuration_sha256': hashlib.sha256(observed.stdout).hexdigest(),
           'acceptance_before': before_acceptance,
           'provider_requests': 0, 'settings_or_services_changed': False, 'profile_copied_or_restored': False,
           'credentials_emitted': False, 'image_proofs_required': False}
 if args.phase == 'preflight':
  require(not args.authorize_one_real_generation, 'preflight_cannot_authorize_generation')
  return {**report, 'status': 'preflight_passed'}, 0
 require(args.authorize_one_real_generation, 'explicit_generation_authorization_required')
 broker = helper.selected_environment(services['nodia-keyring']['pid'], {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
 require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'}
         and broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_invalid')
 env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODIA_CODEX_ENABLED': 'true',
        'NODIA_CODEX_PROFILE_ROOT': str(helper.PROFILE), **broker}
 write_once(intent, {'schema': 'nodia-ai-ai40-r07-mcp-intent-v1', 'release_manifest_sha256': RELEASE_SHA,
                    'selection': selection, 'operator_sha256': args.operator_sha256,
                    'generation_may_have_started': True})
 result = helper.command(['/usr/local/bin/node', str(RELEASE / 'test/nodia-ai-ai40-real-canary-parent.mjs')],
                         cwd=RELEASE, env=env, source=observed.stdout, timeout=380)
 require(len(result.stdout) < 4 * 1024 * 1024, 'parent_output_exceeded')
 # Keep the exact parent receipt private before any projection/assertion can fail.
 parent = json.loads(result.stdout)
 write_once(WORK / 'receipt-mcp.json', parent)
 success = validate_parent(parent, result.returncode, selection)
 after = helper.public_preflight(services)
 after_services = {name: helper.service(name) for name in services}
 require(services == after_services and before['SQL'] == after['SQL'], 'operational_state_changed')
 # Read the same public fields from the active API configuration again. A proof
 # from the disposable mirror never certifies an externally changed provider.
 observed_after = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source],
                                cwd=RELEASE, env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root',
                                'AI40_CONNECTION_ID': '1', **{key: value for key, value in api.items() if key != 'TZ'}}, timeout=25)
 require(observed_after.returncode == 0 and len(observed_after.stdout) < 1024 * 1024
         and hashlib.sha256(observed_after.stdout).digest() == hashlib.sha256(observed.stdout).digest(),
         'active_public_configuration_changed')
 require(validate_release() == release, 'release_changed_during_canary')
 after_acceptance = acceptance_presence(helper)
 require(not any(value for key, value in after_acceptance.items() if key != 'mcp'), 'unrelated_image_acceptance_created')
 proof = mcp_acceptance(helper, parent['child'], selection) if success else None
 return {**report, 'status': 'passed' if success else 'failed', 'parent': parent,
         'provider_requests': parent['child']['provider_dispatches_armed'], 'after': after,
         'acceptance_after': after_acceptance, 'new_exact_mcp_acceptance': proof,
         'active_public_configuration_unchanged': True,
         'public_configuration_sha256_after': hashlib.sha256(observed_after.stdout).hexdigest(),
         'generation_not_replayed': True, 'operational_SQL_unchanged': True,
         'limits': ['Technical MCP qualification only; operator diagnostic handler, not autonomous worker/UI family acceptance.',
                    'No image/PDF/audio proof or business write is accepted by this canary.']}, 0 if success else 1


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
  print(json.dumps({'schema': 'nodia-ai-ai40-r07-mcp-operator-v1', 'status': 'operator_failed',
        'error_class': type(error).__name__,
        'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message)
                      else 'operator_command_timeout' if isinstance(error, subprocess.TimeoutExpired)
                      else 'operator_dependency_or_protocol_error',
        'generation_may_have_started': (WORK / 'intent-mcp.json').exists(),
        'required_next_action': 'inspect_exact_identities_and_reconcile_without_replay',
        'operator_retry_allowed': False,
        'generation_not_replayed': True, 'candidate_preserved_for_reconciliation': True,
        'private_details_emitted': False, 'services_changed': False, 'configuration_changed': False}))
  sys.exit(1)
