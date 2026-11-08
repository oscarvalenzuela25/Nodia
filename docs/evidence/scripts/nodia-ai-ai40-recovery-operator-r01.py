"""Pinned recovery scenarios on R07; never replay or restore acceptance files."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

GUARD = Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py')
GUARD_SHA = '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'
IMAGES = Path('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py')
IMAGES_SHA = 'b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355'
WORK = Path('/opt/nodia/verification/ai40-recovery-operator-r01')
MATERIALS = Path('/opt/nodia/verification/ai40-recovery-materials-r01')
MATERIAL_PINS = {'nodia-ai-ai40-recovery-sources-r01.mjs': '0affd05b19c7c2bdfff9f839a212392b484241e055ef34f501512340d58fa12d', 'nodia-ai-ai40-recovery-child-r01.mjs': '73b7bafd1867ee92170ca2afe0d4de2f1dc7ed7ce4c27091e2fffd8298ff3815', 'nodia-ai-ai40-recovery-parent-r01.mjs': '6f15b7807ba3f952113e971edd11ae993b7af480f8df13d7ff9cc2e2710a9927', 'nodia-ai-ai40-recovery-contenders-r01.mjs': 'cc1445395a4627b692491d09ed4f1b7dda53c19dd1b41272c12e8915dd360019'}

def require(value, code):
    if not value:
        raise ValueError(code)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path, pin, name):
    require(path.is_file() and not path.is_symlink() and sha(path) == pin, name + '_pin_mismatch')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def validate_parent(parent, returncode, args, selection):
    require(type(parent) is dict and parent.get('schema') == 'nodia-ai-ai40-recovery-parent-v1', 'parent_receipt_invalid')
    child = parent.get('child')
    require(type(child) is dict and child.get('schema') == 'nodia-ai-ai40-recovery-child-v1', 'child_receipt_invalid')
    success = returncode == 0 and parent.get('status') == child.get('status') == 'passed'
    if success:
        require(parent.get('fixture_resources_removed') is True and parent.get('retained_disposable_container') is None and parent.get('child_exit_code') == 0 and parent.get('child_timed_out') is False, 'fixture_cleanup_unproved')
        require(child.get('scenario') == args.scenario and child.get('selection') == selection, 'scenario_or_selection_changed')
        bootstrap = args.phase == 'bootstrap'
        require(child.get('total_provider_dispatches') == (0 if bootstrap else 1), 'dispatch_budget_changed')
        require(child.get('production_context_stage_used') is (not bootstrap) and child.get('diagnostic_inference_handler_used') is (not bootstrap), 'compiled_stage_usage_inconsistent')
        require(all(child.get(key) is False for key in ('runtime_policy_overridden', 'readiness_overridden', 'executable_overridden', 'publication_overridden', 'operational_database_accessed', 'operational_profile_removed')), 'authority_or_isolation_changed')
        assertions = child.get('scenario_assertions')
        require(type(assertions) is dict and assertions and all(value is True for value in assertions.values()), 'scenario_assertions_incomplete')
        receipts = child.get('native_terminal_ack_receipts')
        require(type(receipts) is list and len(receipts) == (0 if bootstrap else 1), 'terminal_receipts_invalid')
        for receipt in receipts:
            require(receipt.get('outcome') == receipt.get('journal_state') == 'abandoned_unknown' and receipt.get('exact_native_ack_settled') is True and receipt.get('journal_acknowledged') is True and receipt.get('exact_native_process_absent') is True and receipt.get('owned_native_process_group_empty') is True and receipt.get('image_staging_entries') == 0, 'native_closure_unproved')
        contenders = child.get('contenders')
        require(type(contenders) is list and len(contenders) == (5 if not bootstrap and args.scenario == 'cancel' else 0), 'contender_count_invalid')
        if contenders:
            require([c.get('case') for c in contenders] == ['chat', 'discovery', 'ocr', 'logout', 'login_start'], 'contender_cases_changed')
            require(all(c.get('exit_code') == 0 and c.get('exit_signal') is None and type(c.get('result')) is dict and c['result'].get('case') == c['case'] and c['result'].get('status') == 'passed' and c['result'].get('owner_unchanged') is True and c['result'].get('provider_generations') == 0 for c in contenders), 'contender_exclusion_unproved')
            for entry in contenders:
                contender = entry['result']
                require(type(contender.get('before')) is dict and {'session_generation_sha256', 'owner_record_sha256', 'lock_sha256', 'lock_inode', 'owner', 'native', 'owner_state', 'owner_rpc_count', 'proofs'} <= set(contender['before']) and contender['before'] == contender.get('after') and contender.get('account_or_credential_mutations') == 0 and contender.get('business_writes') == 0 and contender.get('physical_O_EXCL_contention_exercised') is False, 'contender_state_changed')
                if contender['case'] == 'login_start':
                    login = contender.get('login_result')
                    require(type(login) is dict and {'request_id', 'expires_at', 'native'} <= set(login) and login.get('state') == 'failed' and login.get('reason') == 'codex_login_failed' and login.get('native') is None and all(login.get(k) is True for k in ('acknowledged', 'original_expiry_preserved', 'supervisor_process_absent', 'supervisor_group_empty', 'socket_absent', 'user_code_and_verification_url_null')), 'blocked_login_closure_unproved')
                else:
                    require(contender.get('error_code') == 'codex_profile_busy' and contender.get('login_start_called') is False, 'contender_rejection_not_expected')
                if contender['case'] == 'chat':
                    require(contender.get('outcome') == 'not_dispatched' and contender.get('second_chat_attempt_absent') is True, 'second_chat_was_dispatched')
    return success

def validated_bootstrap(m, args, selection, public_configuration_sha256):
    summary_path, parent_path = m.WORK / 'receipt-bootstrap.json', m.WORK / 'parent-bootstrap.json'
    m.private_file(summary_path); m.private_file(parent_path)
    value = json.loads(summary_path.read_bytes())
    require(type(value) is dict and value.get('schema') == 'nodia-ai-ai40-recovery-bootstrap-v1' and value.get('status') == 'passed', 'successful_bootstrap_required')
    require(value.get('operator_sha256') == args.operator_sha256 and value.get('release_manifest_sha256') == m.RELEASE_SHA and value.get('materials') == MATERIAL_PINS and value.get('scenario') == args.scenario and value.get('selection') == selection and value.get('public_configuration_sha256') == public_configuration_sha256, 'bootstrap_identity_changed')
    require(value.get('provider_requests') == 0 and value.get('fixture_resources_removed') is True and value.get('parent_receipt_sha256') == sha(parent_path), 'bootstrap_cleanup_or_receipt_changed')
    blocked = value.get('blocked_login_request_id')
    require(type(blocked) is str and str(uuid.UUID(blocked, version=4)) == blocked if args.scenario == 'cancel' else blocked is None, 'bootstrap_login_identity_invalid')
    require(json.loads(parent_path.read_bytes()).get('blocked_login_request_id') == blocked, 'bootstrap_login_identity_changed')
    bootstrap_args = argparse.Namespace(**{**vars(args), 'phase': 'bootstrap'})
    require(validate_parent(json.loads(parent_path.read_bytes()), 0, bootstrap_args, selection), 'bootstrap_parent_not_passed')
    return {'summary_sha256': sha(summary_path), 'parent_sha256': sha(parent_path), 'provider_requests': 0, 'blocked_login_request_id': blocked}


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'unoptimized_linux_root_required')
    sys.dont_write_bytecode = True
    require(sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_source_changed')
    m = load(GUARD, GUARD_SHA, 'immutable_r07_guard')
    image = load(IMAGES, IMAGES_SHA, 'immutable_image_receipt_reader')
    m.private_file(GUARD); m.private_file(IMAGES); m.private_file(Path(__file__).resolve())
    m.WORK = WORK / args.scenario; m.private_work()
    for name, pin in MATERIAL_PINS.items():
        path = MATERIALS / name; m.historical_guard_file(path)
        require(sha(path) == pin, 'recovery_material_changed')
    helper = load(m.HELPER, m.HELPER_SHA, 'immutable_public_guard')
    legacy = helper.validate_candidate(m.LEGACY_MANIFEST_SHA)
    release = m.validate_release(); helper.ACTIVE = m.RELEASE
    services = {name: helper.service(name) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-keyring')}
    before = helper.public_preflight(services)
    api = helper.selected_environment(services['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'TZ', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
    require(api.get('TZ') in (None, 'UTC', 'Etc/UTC'), 'timezone_requires_review')
    read_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'AI40_CONNECTION_ID': '1', **{k: v for k, v in api.items() if k != 'TZ'}}
    source = (helper.CANDIDATE.parent / 'public-canary-input.mjs').read_text()
    observed = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source], cwd=m.RELEASE, env=read_env, timeout=25)
    require(observed.returncode == 0 and len(observed.stdout) < 1048576, 'public_config_read_failed')
    config = json.loads(observed.stdout)
    require(set(config) == {'schema_version', 'authorize_one_real_generation', 'selection', 'provider', 'expected_binary_sha256'} and config['schema_version'] == 1 and config['authorize_one_real_generation'] is True and config['expected_binary_sha256'] == helper.BINARY_SHA, 'public_config_contract_invalid')
    selection = config['selection']
    require(set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'} and selection['connection_id'] == '1' and selection['mode'] == 'token_plan_agentic' and isinstance(selection['model_id'], str) and selection['model_id'].strip(), 'selection_invalid')
    proofs = image.proof_snapshot(helper, selection, m.EXPECTED_RUNTIME_FINGERPRINT)
    require(not (m.WORK / 'intent-recovery.json').exists(), 'scenario_intention_already_consumed')
    report = {'schema': 'nodia-ai-ai40-recovery-operator-v1', 'phase': args.phase, 'scenario': args.scenario, 'operator_sha256': args.operator_sha256, 'release': release, 'materials': MATERIAL_PINS, 'services': services, 'before': before, 'selection': selection, 'acceptance_before': proofs, 'public_configuration_sha256': hashlib.sha256(observed.stdout).hexdigest(), 'legacy_guard_provenance': legacy, 'provider_requests': 0, 'configured_SQL_writes': 0, 'services_changed': False}
    if args.phase == 'preflight':
        require(not args.authorize_one_real_generation, 'preflight_cannot_authorize_generation')
        return {**report, 'status': 'preflight_passed'}, 0
    require(args.authorize_one_real_generation is (args.phase == 'probe'), 'generation_authorization_mismatch')
    bootstrap = None
    if args.phase == 'bootstrap':
        require(not (m.WORK / 'intent-bootstrap.json').exists() and not (m.WORK / 'receipt-bootstrap.json').exists() and not (m.WORK / 'parent-bootstrap.json').exists(), 'bootstrap_intention_already_consumed')
    if args.phase == 'probe':
        bootstrap = validated_bootstrap(m, args, selection, report['public_configuration_sha256'])
        require(all(p['present'] for p in proofs.values()) if args.scenario == 'cancel' else proofs['mcp']['present'] and all(not p['present'] for k, p in proofs.items() if k != 'mcp'), 'scenario_initial_acceptance_changed')
    broker = helper.selected_environment(services['nodia-keyring']['pid'], {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
    require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'} and broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_invalid')
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODIA_CODEX_ENABLED': 'true', 'NODIA_CODEX_PROFILE_ROOT': str(helper.PROFILE), **broker}
    blocked_login_request_id = bootstrap['blocked_login_request_id'] if bootstrap else str(uuid.uuid4()) if args.scenario == 'cancel' else None
    if args.phase == 'probe' and blocked_login_request_id:
        require(not (helper.PROFILE / 'login-jobs' / (blocked_login_request_id + '.json')).exists(), 'blocked_login_id_already_reserved')
    payload = {'schema_version': 1, 'authorize_recovery_workflow': True, 'scenario': args.scenario, 'execution_mode': 'bootstrap' if args.phase == 'bootstrap' else 'live', 'max_provider_dispatches': 1, 'selection': selection, 'provider': config['provider'], 'expected_binary_sha256': config['expected_binary_sha256'], 'blocked_login_request_id': blocked_login_request_id}
    if args.phase == 'bootstrap':
        m.write_once(m.WORK / 'intent-bootstrap.json', {'schema': 'nodia-ai-ai40-recovery-bootstrap-intent-v1', 'scenario': args.scenario, 'operator_sha256': args.operator_sha256, 'release_manifest_sha256': m.RELEASE_SHA, 'materials': MATERIAL_PINS, 'selection': selection, 'public_configuration_sha256': report['public_configuration_sha256'], 'provider_generations_allowed': 0, 'blocked_login_request_id': blocked_login_request_id})
    if args.phase == 'probe':
        m.write_once(m.WORK / 'intent-recovery.json', {'schema': 'nodia-ai-ai40-recovery-intent-v1', 'scenario': args.scenario, 'release_manifest_sha256': m.RELEASE_SHA, 'materials': MATERIAL_PINS, 'selection': selection, 'blocked_login_request_id': blocked_login_request_id, 'operator_sha256': args.operator_sha256, 'generation_may_have_started': True})
    result = helper.command(['/usr/local/bin/node', str(MATERIALS / 'nodia-ai-ai40-recovery-parent-r01.mjs')], cwd=m.RELEASE, env=env, source=json.dumps(payload).encode(), timeout=470)
    require(len(result.stdout) < 4194304, 'parent_output_exceeded')
    parent = json.loads(result.stdout)
    m.write_once(m.WORK / ('parent-bootstrap.json' if args.phase == 'bootstrap' else 'receipt-recovery.json'), parent)
    require(parent.get('blocked_login_request_id') == blocked_login_request_id, 'parent_login_request_identity_changed')
    success = validate_parent(parent, result.returncode, args, selection)
    after = helper.public_preflight(services)
    require({name: helper.service(name) for name in services} == services and before['SQL'] == after['SQL'], 'operational_state_changed')
    observed_after = helper.command(['/usr/local/bin/node', '--input-type=module', '-e', source], cwd=m.RELEASE, env=read_env, timeout=25)
    require(observed_after.returncode == 0 and hashlib.sha256(observed_after.stdout).digest() == hashlib.sha256(observed.stdout).digest(), 'public_configuration_changed')
    require(m.validate_release() == release, 'release_changed')
    after_presence = m.acceptance_presence(helper)
    if args.phase == 'bootstrap':
        require(image.proof_snapshot(helper, selection, m.EXPECTED_RUNTIME_FINGERPRINT) == proofs, 'bootstrap_changed_acceptance')
    elif success:
        require(not any(after_presence.values()), 'unknown_dispatch_did_not_invalidate_acceptances')
    if args.phase == 'bootstrap' and success:
        m.write_once(m.WORK / 'receipt-bootstrap.json', {'schema': 'nodia-ai-ai40-recovery-bootstrap-v1', 'status': 'passed', 'scenario': args.scenario, 'operator_sha256': args.operator_sha256, 'release_manifest_sha256': m.RELEASE_SHA, 'materials': MATERIAL_PINS, 'selection': selection, 'public_configuration_sha256': report['public_configuration_sha256'], 'parent_receipt_sha256': sha(m.WORK / 'parent-bootstrap.json'), 'provider_requests': 0, 'fixture_resources_removed': True, 'blocked_login_request_id': blocked_login_request_id})
    return {**report, 'validated_bootstrap': bootstrap, 'status': 'passed' if success else 'failed', 'parent': parent, 'after': after, 'acceptance_after': after_presence, 'provider_requests': parent['child']['total_provider_dispatches'], 'generation_not_replayed': True, 'operational_SQL_unchanged': True, 'public_configuration_unchanged': True, 'proofs_copied_or_restored': False}, 0 if success else 1

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'bootstrap', 'probe']); parser.add_argument('--scenario', choices=['cancel', 'revoke'], required=True)
    parser.add_argument('--operator-sha256', required=True); parser.add_argument('--authorize-one-real-generation', action='store_true')
    args = parser.parse_args()
    try:
        result, code = run(args); print(json.dumps(result)); sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-recovery-operator-v1', 'status': 'operator_failed', 'scenario': args.scenario, 'error_class': type(error).__name__, 'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else 'operator_dependency_timeout_or_protocol_error', 'generation_may_have_started': (WORK / args.scenario / 'intent-recovery.json').exists(), 'operator_retry_allowed': False, 'required_next_action': 'inspect_same_owner_and_blocked_login_identities_without_replay', 'private_details_emitted': False, 'services_changed': False})); sys.exit(1)
