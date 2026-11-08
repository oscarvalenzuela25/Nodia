"""Bounded R07 compaction/reuse acceptance with disposable SQL and the existing account.

preflight reads metadata only. bootstrap provisions SQL and compiles real Nest DI,
loads seeded sources and builds/measures their prompt without a native process or
account method. probe authorizes exactly two chat
intentions (2+1 dispatches). Intent and parent receipt are private write-once files.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

WORK = Path('/opt/nodia/verification/ai40-r07-compaction-operator-r01')
MATERIALS = Path('/opt/nodia/verification/ai40-r07-compaction-materials-r01')
RELEASE = Path('/opt/nodia/releases/nodia-server-ai40-r07')
RELEASE_SHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
FINGERPRINT = '1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a'
POLICY_SHA = '7ff3c624496ace6514100d03b2e1f236683b235bfe7d4fa68da7cd268c419521'
MATERIAL_PINS = {'nodia-ai-ai40-compaction-sources-r07-r01.mjs': '05d19a8179dccfb37d13ac4aae910d7876c6e16b17f0ae00fc93f05a15869e5a', 'nodia-ai-ai40-compaction-parent-r07-r01.mjs': '608d1a4a30e98302227eb8b070a3eafc67d5bca087227649cadc90f51fa8076f', 'nodia-ai-ai40-compaction-child-r07-r01.mjs': '329406ca4cf4ec97087bd72ed7e9cd171c21be54a3096c24945ba6efd755170e', 'nodia-ai-ai40-r07-mcp-operator-r01.py': '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'}


def require(value, code):
 if not value:
  raise ValueError(code)


def sha(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()


def import_pinned(path, pin, name, mode):
 info = path.lstat()
 require(path.resolve() == path and stat.S_ISREG(info.st_mode) and info.st_uid == 0
         and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == mode and sha(path) == pin,
         'pinned_source_identity_changed')
 spec = importlib.util.spec_from_file_location(name, path)
 module = importlib.util.module_from_spec(spec)
 spec.loader.exec_module(module)
 return module


def write_once(name, value):
 path = WORK / name
 require(path.parent == WORK and re.fullmatch(r'[a-z][a-z0-9-]+\.json', name), 'private_receipt_name_invalid')
 fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
 with os.fdopen(fd, 'w', encoding='utf8', newline='\n') as stream:
  json.dump(value, stream)
  stream.flush()
  os.fsync(stream.fileno())
 fd = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
 try:
  os.fsync(fd)
 finally:
  os.close(fd)


def material_guard():
 require(set(MATERIAL_PINS) == {'nodia-ai-ai40-compaction-sources-r07-r01.mjs',
     'nodia-ai-ai40-compaction-parent-r07-r01.mjs', 'nodia-ai-ai40-compaction-child-r07-r01.mjs',
     'nodia-ai-ai40-r07-mcp-operator-r01.py'}, 'materials_not_frozen')
 info = MATERIALS.lstat()
 require(MATERIALS.resolve() == MATERIALS and stat.S_ISDIR(info.st_mode) and info.st_uid == 0
         and stat.S_IMODE(info.st_mode) == 0o755, 'public_materials_directory_invalid')
 require(set(path.name for path in MATERIALS.iterdir()) == set(MATERIAL_PINS), 'material_inventory_changed')
 for name, pin in MATERIAL_PINS.items():
  path = MATERIALS / name
  info = path.lstat()
  require(path.resolve() == path and stat.S_ISREG(info.st_mode) and info.st_uid == 0
          and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o644 and sha(path) == pin,
          'public_material_identity_changed')
 return dict(MATERIAL_PINS)


def pure_scope(helper):
 # Import only a pure fingerprint function and policy validator. No runtime, account or SDK is constructed.
 source = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [root,binary,expectedBinary,expectedPolicy,expectedFingerprint]=process.argv.slice(1);
createRequire(root+'/package.json')('reflect-metadata');
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
assert.equal(process.version,'v24.20.0');assert.equal(sha(readFileSync(binary)),expectedBinary);
const raw=readFileSync(root+'/dist/nodia-ai-runtime/config/runtime-policy.json');assert.equal(sha(raw),expectedPolicy);
const {ValidateNodiaAiRuntimePolicyUseCase:Validate}=await import(pathToFileURL(root+'/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js'));
const policy=new Validate().execute(JSON.parse(raw));
const {codexChatRuntimeFingerprint:fingerprint}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-acceptance.js'));
const actual=sha(await fingerprint(binary)+JSON.stringify(canonical(policy)));assert.equal(actual,expectedFingerprint);
console.log(JSON.stringify({runtime_fingerprint:actual,policy_asset_sha256:sha(raw),validated_policy_sha256:sha(JSON.stringify(canonical(policy))),provider_observations:0,provider_generations:0}));
'''
 binary = '/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex'
 value = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source,
     str(RELEASE), binary, helper.BINARY_SHA, POLICY_SHA, FINGERPRINT], cwd=RELEASE,
     env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root'}, timeout=30)
 require(value.returncode == 0 and len(value.stdout) < 16384, 'pure_runtime_scope_changed')
 return json.loads(value.stdout)


def validate_parent(parent, code, mode, selection):
 require(type(parent) is dict and parent.get('schema') == 'nodia-ai-ai40-compaction-parent-r07-v1', 'parent_receipt_invalid')
 child = parent.get('child')
 require(type(child) is dict and child.get('schema') == 'nodia-ai-ai40-compaction-child-r07-v1', 'child_receipt_invalid')
 require(child.get('selection') == selection and child.get('release_manifest_sha256') == RELEASE_SHA, 'child_scope_changed')
 success = code == 0 and parent.get('status') == 'passed' and child.get('status') == 'passed'
 if success:
  require(parent.get('fixture_resources_removed') is True and parent.get('retained_disposable_container') is None
          and parent.get('child_exit_code') == 0 and parent.get('child_exit_signal') is None
          and parent.get('child_timed_out') is False and child.get('fixture_sql_safe_to_remove') is True,
          'successful_parent_not_closed')
  require(child.get('production_stage_handler_used') is True and child.get('readiness_overridden') is False
          and child.get('executable_overridden') is False and child.get('publication_overridden') is False
          and child.get('runtime_policy_overridden') is False and child.get('operational_database_accessed') is False
          and parent.get('operational_database_accessed') is False, 'production_authority_changed')
  require(child.get('dry_bootstrap_complete_before_account_or_dispatch') is (mode == 'bootstrap'), 'bootstrap_barrier_not_proven')
  require(type(child.get('total_provider_dispatches')) is int
          and child['total_provider_dispatches'] == (0 if mode == 'bootstrap' else 3), 'dispatch_count_changed')
  if mode == 'bootstrap':
   require(child.get('turns') == [] and child.get('native_terminal_ack_receipts') == [], 'bootstrap_invoked_native_pipeline')
   metrics = child.get('source_metrics')
   require(type(metrics) is dict and metrics.get('source_text_utf8_bytes') == 159744
           and metrics.get('actual_SQL_loader_complete') is True and metrics.get('prepared_transport') == 'plain_text'
           and type(metrics.get('source_hash')) is str and re.fullmatch('[a-f0-9]{64}', metrics['source_hash'])
           and type(metrics.get('prepared_prompt_utf8_bytes')) is int
           and metrics['prepared_prompt_utf8_bytes'] <= metrics['assembly_ceiling_utf8_bytes'], 'bootstrap_source_builder_not_proven')
  else:
   turns = child.get('turns')
   require(type(turns) is list and len(turns) == 2
           and [[turn.get(k) for k in ('provider_dispatches', 'compactions', 'tools', 'semantic_exact_match')] for turn in turns]
             == [[2, 1, 0, True], [1, 0, 0, True]], 'compaction_continuity_semantics_failed')
   receipts = child.get('native_terminal_ack_receipts')
   require(type(receipts) is list and len(receipts) == 3
           and len({proof['attempt_id'] for proof in receipts}) == 3
           and len({proof['terminal_proof_id'] for proof in receipts}) == 3, 'terminal_identity_count_changed')
   for proof in receipts:
    require(proof.get('process_closed') is True and proof.get('outcome') == 'completed'
            and proof.get('exact_native_ack_settled') is True and proof.get('journal_acknowledged') is True
            and proof.get('exact_native_process_absent') is True and proof.get('owned_native_process_group_empty') is True
            and type(proof.get('image_staging_entries')) is int and proof['image_staging_entries'] == 0,
            'exact_native_ack_closure_missing')
 return success


def run(args):
 sys.dont_write_bytecode = True
 require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
 info = WORK.lstat()
 require(WORK.resolve() == WORK and stat.S_ISDIR(info.st_mode) and info.st_uid == 0
         and stat.S_IMODE(info.st_mode) == 0o700, 'private_work_identity_changed')
 info = Path(__file__).lstat()
 require(Path(__file__).resolve() == Path(__file__) and stat.S_ISREG(info.st_mode) and info.st_uid == 0
         and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600
         and sha(Path(__file__)) == args.operator_sha256, 'operator_source_identity_changed')
 materials = material_guard()
 mcp = import_pinned(MATERIALS / 'nodia-ai-ai40-r07-mcp-operator-r01.py',
     '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58', 'pinned_r07_mcp_guard', 0o644)
 mcp.historical_guard_file(mcp.HELPER)
 helper = import_pinned(mcp.HELPER, mcp.HELPER_SHA, 'pinned_original_availability_guard', 0o644)
 legacy = helper.validate_candidate(mcp.LEGACY_MANIFEST_SHA)
 release = mcp.validate_release()
 helper.ACTIVE = RELEASE
 scope = pure_scope(helper)
 services = {name: helper.service(name) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-keyring')}
 before = helper.public_preflight(services)
 acceptance_before = mcp.acceptance_presence(helper)
 require(acceptance_before.get('mcp') is True, 'fresh_r07_mcp_acceptance_required')
 intent = WORK / ('intent-bootstrap.json' if args.phase == 'bootstrap' else 'intent-live.json')
 require(not intent.exists(), 'workflow_intention_already_consumed')
 api = helper.selected_environment(services['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST',
     'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
 require(api.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
 select_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'AI40_CONNECTION_ID': '1',
     **{key: value for key, value in api.items() if key != 'TZ'}}
 source = (helper.CANDIDATE.parent / 'public-canary-input.mjs').read_text()
 public = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source], cwd=RELEASE, env=select_env, timeout=25)
 require(public.returncode == 0 and len(public.stdout) < 1024 * 1024, 'public_configuration_read_failed')
 config = json.loads(public.stdout)
 require(type(config) is dict and set(config) == {'schema_version', 'authorize_one_real_generation', 'selection', 'provider', 'expected_binary_sha256'}
         and config.get('schema_version') == 1 and config.get('authorize_one_real_generation') is True, 'public_configuration_shape_changed')
 selection = config['selection']
 require(type(selection) is dict and set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'}
         and selection['connection_id'] == '1' and selection['mode'] == 'token_plan_agentic'
         and type(selection['model_id']) is str and selection['model_id'].strip(), 'public_selection_changed')
 require(config['expected_binary_sha256'] == helper.BINARY_SHA, 'public_native_binary_changed')
 # Strict store decoder/scope check uses only already-present proof bytes; no account observation.
 proof_path = helper.PROFILE / '1' / 'nodia-chat-mcp'
 fd = os.open(proof_path, os.O_RDONLY | os.O_NOFOLLOW)
 with os.fdopen(fd, 'rb') as stream:
  raw_proof = stream.read(4097)
 require(len(raw_proof) <= 4096, 'acceptance_metadata_exceeded')
 proof_value = json.loads(raw_proof)
 before_mcp = mcp.mcp_acceptance(helper, {'terminal_proof_id': proof_value['terminalProofId']}, selection)
 report = {'schema': 'nodia-ai-ai40-r07-compaction-operator-v1', 'phase': args.phase,
     'operator_sha256': args.operator_sha256, 'release': release, 'materials': materials,
     'scope': scope, 'legacy_guard_provenance': legacy, 'services': services, 'before': before,
     'selection': selection, 'public_configuration_sha256': hashlib.sha256(public.stdout).hexdigest(),
     'acceptance_before': acceptance_before, 'mcp_before': before_mcp, 'provider_dispatches': 0,
     'provider_observations_in_preflight': 0, 'operational_SQL_writes': 0, 'settings_or_services_changed': False}
 if args.phase == 'preflight':
  require(not args.authorize_two_intentions_three_dispatches, 'preflight_cannot_authorize_inference')
  return {**report, 'status': 'preflight_passed'}, 0
 require((args.phase == 'probe') == args.authorize_two_intentions_three_dispatches,
         'explicit_workflow_authorization_required')
 if args.phase == 'probe':
  for name in ('intent-bootstrap.json', 'receipt-bootstrap.json'):
   path = WORK / name
   info = path.lstat()
   require(path.resolve() == path and stat.S_ISREG(info.st_mode) and info.st_uid == 0
           and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600, 'bootstrap_receipt_identity_changed')
  bootstrap_intent = json.loads((WORK / 'intent-bootstrap.json').read_bytes())
  require(bootstrap_intent.get('operator_sha256') == args.operator_sha256
          and bootstrap_intent.get('release_manifest_sha256') == RELEASE_SHA
          and bootstrap_intent.get('materials') == materials and bootstrap_intent.get('mode') == 'bootstrap'
          and bootstrap_intent.get('maximum_provider_dispatches') == 0, 'bootstrap_predecessor_changed')
  require(validate_parent(json.loads((WORK / 'receipt-bootstrap.json').read_bytes()), 0, 'bootstrap', selection),
          'zero_dispatch_bootstrap_required')
 broker = helper.selected_environment(services['nodia-keyring']['pid'], {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
 require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'}
         and broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_invalid')
 env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODIA_CODEX_ENABLED': 'true',
     'NODIA_CODEX_PROFILE_ROOT': str(helper.PROFILE), **broker}
 mode = 'bootstrap' if args.phase == 'bootstrap' else 'live'
 workflow = {key: value for key, value in config.items() if key != 'authorize_one_real_generation'}
 workflow.update({'authorize_compaction_workflow': True, 'max_provider_dispatches': 3, 'execution_mode': mode})
 write_once(intent.name, {'schema': 'nodia-ai-ai40-r07-compaction-intent-v1', 'mode': mode,
     'release_manifest_sha256': RELEASE_SHA, 'selection': selection, 'operator_sha256': args.operator_sha256,
     'materials': materials, 'explicit_intentions': 0 if mode == 'bootstrap' else 2,
     'maximum_provider_dispatches': 0 if mode == 'bootstrap' else 3,
     'inference_may_have_started': mode == 'live'})
 result = helper.command(['/usr/local/bin/node', str(MATERIALS / 'nodia-ai-ai40-compaction-parent-r07-r01.mjs')],
     cwd=RELEASE, env=env, source=json.dumps(workflow).encode('utf8'), timeout=180 if mode == 'bootstrap' else 980)
 require(len(result.stdout) < 4 * 1024 * 1024, 'parent_output_exceeded')
 parent = json.loads(result.stdout)
 write_once('receipt-' + mode + '.json', parent)
 success = validate_parent(parent, result.returncode, mode, selection)
 after = helper.public_preflight(services)
 require(services == {name: helper.service(name) for name in services}
         and before['SQL'] == after['SQL'], 'operational_services_or_SQL_changed')
 public_after = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source], cwd=RELEASE, env=select_env, timeout=25)
 require(public_after.returncode == 0 and len(public_after.stdout) < 1024 * 1024
         and hashlib.sha256(public.stdout).digest() == hashlib.sha256(public_after.stdout).digest(),
         'active_public_configuration_changed')
 require(mcp.validate_release() == release and material_guard() == materials and pure_scope(helper) == scope,
         'release_material_or_scope_changed')
 acceptance_after = mcp.acceptance_presence(helper)
 after_mcp = None
 if acceptance_after.get('mcp'):
  after_mcp = mcp.mcp_acceptance(helper, {'terminal_proof_id': before_mcp['terminal_proof_id']}, selection)
 if success:
  require(acceptance_after == acceptance_before and after_mcp == before_mcp, 'preexisting_acceptance_changed')
 return {**report, 'status': 'passed' if success else 'failed', 'parent': parent,
     'provider_dispatches': parent['child']['total_provider_dispatches'], 'after': after,
     'acceptance_after': acceptance_after, 'mcp_after': after_mcp,
     'operational_SQL_unchanged': True, 'active_public_configuration_unchanged': True,
     'workflow_not_replayed': True, 'full_C40_09_accepted': False}, 0 if success else 1


if __name__ == '__main__':
 parser = argparse.ArgumentParser(description=__doc__)
 parser.add_argument('phase', choices=['preflight', 'bootstrap', 'probe'])
 parser.add_argument('--operator-sha256', required=True)
 parser.add_argument('--authorize-two-intentions-three-dispatches', action='store_true')
 try:
  report, code = run(parser.parse_args())
  print(json.dumps(report))
  sys.exit(code)
 except Exception as error:
  message = str(error)
  print(json.dumps({'schema': 'nodia-ai-ai40-r07-compaction-operator-v1', 'status': 'operator_failed',
      'error_class': type(error).__name__, 'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message)
      else 'operator_command_timeout' if isinstance(error, subprocess.TimeoutExpired) else 'operator_dependency_or_protocol_error',
      'inference_intent_consumed': (WORK / 'intent-live.json').exists(),
      'required_next_action': 'inspect_exact_owned_fixture_and_native_receipts_without_generation_replay', 'private_details_emitted': False}))
  sys.exit(1)
