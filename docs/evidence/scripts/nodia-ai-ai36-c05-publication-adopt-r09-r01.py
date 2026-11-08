"""Pinned R08 <-> R09 publication transition. No migration, SQL restore or inference.

Only knowledge assets, their source registry and reviewed authoring inputs change.
Runtime boundaries and policy remain exact; current acceptances are observed,
never copied. Each mutation has its own fsynced intent and fresh encrypted backup.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import time
OLD = Path('/opt/nodia/releases/nodia-server-ai40-r08')
OLD_SHA = '08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
NEW = Path('/opt/nodia/releases/nodia-server-ai36-c05-r09')
# Fail closed until Native supplies the reviewed package/plan pins.
NEW_SHA = 'edd279fa5f5f99a7529adcf4cf75b7016505bf6581fc57cb85a3000cf802ff85'
PLAN_SHA = '505fa8dca968e6ddd6b8c9e36aa98302fff8e6018962eca74c3b124b2773e170'
KNOWLEDGE = '6763cef6423d2cc511844351a384358e0e5141e4f597d19a291a5cf1feeb3c73'
WORK = Path('/opt/nodia/verification/ai36-c05-publication-adopt-r09-r01')
PLAN = Path('/opt/nodia/verification/ai36-c05-publication-r09/adopt-plan-r09.json')
UTILITY = Path('/opt/nodia/verification/ai40-operator-r05/nodia-ai-ai40-adopt-r01.py')
UTILITY_SHA = 'c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000'
ACTIVATION = Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/materials/nodia-ai-ai38-journal-activate.py')
ACTIVATION_SHA = '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
R07 = Path('/opt/nodia/verification/ai40-r07-operator-r01/nodia-ai-ai40-selective-adopt-r07.py')
R07_SHA = '4a2fd6d22845ffcb61c442a813d19ce6a8b2c84969a73112d0a3e3d05800398d'
R06 = Path('/opt/nodia/verification/ai40-r06-operator-r01/nodia-ai-ai40-selective-adopt-r06.py')
R06_SHA = '272c5d44a1a6774c6587c32448facebcecd7729fbd645f65a719ae4ce9920d98'
MCP = Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py')
MCP_SHA = '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'
READY = Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/reconcile-retire.json')
READY_SHA = '177cc4f54c915289548e2fd5a84b6522c121307d63785ad04f64f354a9075437'
CONFIG = Path('/opt/nodia/releases/nodia-server-ai15-20261016/.env')
CONFIG_SHA = '63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105'
SCOPE = '1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a'

def require(value, code):
    if not value:
        raise ValueError(code)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def private(path, pin=None, mode=0o600):
    info = path.lstat()
    require(path.resolve() == path
        and stat.S_ISREG(info.st_mode)
        and (info.st_uid == 0)
        and (info.st_nlink == 1)
        and (stat.S_IMODE(info.st_mode) == mode),
         'private_file_changed')
    require(info.st_size <= 4 * 1024 * 1024 and (pin is None or sha(path) == pin), 'private_file_pin_changed')
    return path.read_bytes()

def load(path, pin, name, mode=0o600):
    raw = private(path, pin, mode)
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader(name, loader=None))
    module.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module

def write(name, value):
    path = WORK / name
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write((json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode())
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)

def publication_guard(base):
    require(type(NEW_SHA) is str and re.fullmatch('[a-f0-9]{64}',
             NEW_SHA) and (type(PLAN_SHA) is str) and re.fullmatch('[a-f0-9]{64}',
             PLAN_SHA),
         'R09_package_not_frozen')
    plan = json.loads(private(PLAN, PLAN_SHA))
    require(plan['schema'] == 'nodia-ai-ai36-c05-r09-publication-plan-v1'
        and plan['source'] == str(OLD)
        and (plan['target'] == str(NEW))
        and (plan['source_manifest_sha256'] == OLD_SHA)
        and (plan['target_manifest_sha256'] == NEW_SHA),
         'publication_plan_coordinates_changed')
    require(plan['publication_changed'] is True
        and plan['runtime_code_and_policy_unchanged'] is True
        and (plan['total_capabilities'] == 150)
        and (plan['previous_capabilities'] == 74)
        and (plan['migrations'] == 0)
        and (plan['SDK_generations'] == 0)
        and (plan['bulk_included'] is False),
         'publication_plan_scope_changed')
    old = json.loads((OLD / 'release-manifest.json').read_bytes())
    old = base.manifest(OLD, OLD_SHA, old['knowledge_release'])
    new = base.manifest(NEW, NEW_SHA, KNOWLEDGE)
    delta = [{'path': p,
             'old_sha256': old['files'].get(p),
             'sha256': new['files'].get(p)} for p in sorted(set(old['files']) | set(new['files'])) if old['files'].get(p) != new['files'].get(p)]
    require(delta == plan['delta'] and len(new['files']) == plan['target_files'], 'publication_delta_changed')
    assets = ('src/nodia-ai/knowledge/', 'dist/nodia-ai/knowledge/')
    context = {p + n for p in ('src/nodia-ai-context/config/',
             'dist/nodia-ai-context/config/') for n in ('knowledge-pin.json',
             'knowledge-schema.json')}
    authoring = {'scripts/build-nodia-ai-knowledge.mjs',
         'scripts/build-nodia-ai-context.mjs',
         'scripts/nodia-ai-knowledge/compiler.mjs',
         'scripts/nodia-ai-knowledge/contracts.schema.json',
         'scripts/nodia-ai-knowledge/frontmatter.cjs'}
    for row in delta:
        p = row['path']
        require(p.startswith(assets)
            or p in context
            or p == 'config/nodia-ai-knowledge.registry.json'
            or (p in authoring),
             'unexpected_publication_file')
        require(not (p.startswith(('src/',
                         'dist/')) and p.endswith(('.ts',
                         '.js',
                         '.map'))),
             'runtime_code_delta_rejected')
    for p, pin in old['files'].items():
        if p.startswith(('src/',
                 'dist/')) and p.endswith(('.ts',
                 '.js',
                 '.map')) or p.startswith(('node_modules/',
                 'ops/')) or 'runtime-policy' in p:
            require(new['files'].get(p) == pin, 'runtime_policy_or_dependency_changed')
    before = json.loads((OLD / 'dist/nodia-ai/knowledge/manifest.json').read_bytes())
    after = json.loads((NEW / 'dist/nodia-ai/knowledge/manifest.json').read_bytes())
    left = {c['capability_id']: c for c in before['capability_contracts']}
    right = {c['capability_id']: c for c in after['capability_contracts']}
    require(len(left) == 74 and len(right) == 150 and all((right.get(k) == v for k,
                 v in left.items())),
         'prior_74_contracts_changed')
    added = {k: v for k, v in right.items() if k not in left}
    require(set(added) == set(plan['new_capabilities'])
        and sum((v['kind'] == 'prepare_change' for v in added.values())) == 72
        and (sum((v['kind'] == 'prepare_secure_flow' for v in added.values())) == 4),
         'new_contract_set_changed')
    require(all((v['publication'] == 'published' for v in added.values())) and 'nodia_invoices_analyze' not in right,
         'unexpected_analyzer_or_unpublished_contract')
    fragments = {(f['document_id'], f['fragment_id']): f for f in after['fragments']}
    require(len(before['fragments']) == 31 and len(after['fragments']) == 41, 'fragment_count_changed')
    for f in before['fragments']:
        require(fragments.get((f['document_id'], f['fragment_id'])) == f, 'historical_fragment_changed')
        for prefix in assets:
            require(sha(OLD / prefix / f['asset_path']) == sha(NEW / prefix / f['asset_path']) == f['sha256'],
                 'historical_fragment_asset_changed')
    require(after['release_id'] == KNOWLEDGE
        and before['catalog_release'] == after['catalog_release']
        and (old['knowledge_release'] != KNOWLEDGE),
         'knowledge_transition_invalid')
    return (plan,
         {'source': old['knowledge_release'],
             'target': KNOWLEDGE,
             'old_contracts_exact': 74,
             'added_prepare_change': 72,
             'added_prepare_secure_flow': 4,
             'old_fragment_assets_exact': 31,
             'runtime_code_policy_unchanged': True})

def quiet_sql(h, pid):
    value = h.chat_projection(pid)
    require(type(value) is dict and all((type(value.get(k)) is int and value[k] == 0 for k in ('pending_jobs',
                     'open_attempts',
                     'retained_slots'))),
         'operational_SQL_not_quiet')
    return value

def snapshot(a, base, h, proof, release):
    a.RELEASE = release
    h.ACTIVE = release
    proof.OLD = release
    consumers = a.active_new_processes()
    sql = quiet_sql(h, consumers['nodia-ai-worker']['pid'])
    require(sha(CONFIG) == CONFIG_SHA, 'configuration_changed')
    selected = h.selected_environment(consumers['nodia-ai-worker']['pid'], {
        'DOTENV_CONFIG_PATH', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB',
        'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL',
    })
    program = (h.CANDIDATE.parent / 'public-canary-input.mjs').read_text(encoding='utf-8')
    observed = h.command(
        ['/usr/local/bin/node', '--input-type=module', '-e', program],
        cwd=release,
        env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root',
             'AI40_CONNECTION_ID': '1', **selected},
        timeout=25,
    )
    public_configuration_sha = hashlib.sha256(observed.stdout).hexdigest()
    require(observed.returncode == 0 and len(observed.stdout) <= 131072 and
            public_configuration_sha == '506e4c436bc22152c9aa632565d470450206d5ffdb1c9b976c0d0c7b5116f8b2',
            'public_configuration_changed')
    epoch = base.native_epoch(a)
    require(epoch['id'] == '678d4f10274cf557590311af0bee81a7cb71be7015ec282a4154d48b71d6d38b'
        and epoch['image'] == 'sha256:15e8c319011ecfc7f792938cc4177ab0943af8894b204375bd1c1200728f935a'
        and (epoch['started_at'] == '2026-10-24T22:32:30.628979004Z'),
         'Gemini_epoch_changed')
    return {'consumers': consumers,
         'SQL': sql,
         'public_configuration_sha256': public_configuration_sha,
         'proofs': proof.proof_snapshot(True,
             SCOPE),
         'Gemini': epoch,
         'codex': base.codex_barrier(a,
             Path('/var/lib/nodia/codex'),
             frozenset((v['pid'] for v in consumers.values()))),
         'operator': a.operator_configuration(),
         'nginx_sha256': sha(a.NGINX),
         'journal': base.journal_open(a),
         'unrelated': {u: a.state(u) for u in ('nodia-keyring',
                 'nginx',
                 'nodia-gemini-lab')},
         'codex_binary': base.codex_sdk_binary()}

def invariants(a, base, before, after):
    for key in ('SQL', 'public_configuration_sha256', 'proofs', 'Gemini', 'nginx_sha256', 'unrelated', 'codex_binary'):
        require(before[key] == after[key], 'runtime_snapshot_changed')
    for key in ('recovery.json', 'backup.json', 'backup-public.pem'):
        require(before['operator'][key] == after['operator'][key], 'operator_configuration_changed')
    for key in ('coverage_from', 'first_sequence', 'last_sequence'):
        require(before['journal'][key] == after['journal'][key], 'journal_era_or_entries_changed')

def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and (not sys.flags.optimize),
         'unoptimized_linux_root_required')
    require(sha(Path(__file__).resolve()) == args.operator_sha256
        and args.plan_sha256 == PLAN_SHA
        and (Path(args.plan) == PLAN),
         'operator_or_plan_changed')
    require(args.phase == 'preflight' or args.execute, 'explicit_execute_required')
    base = load(UTILITY, UTILITY_SHA, 'publication_immutable_transition_utilities')
    a = load(ACTIVATION, ACTIVATION_SHA, 'publication_journal_operations')
    plan, publication = publication_guard(base)
    scope = load(R07, R07_SHA, 'publication_pure_native_scope')
    scope.OLD, scope.NEW = (OLD, NEW)
    scope_value = scope.unchanged_scope()
    require(scope_value['target']['runtime_fingerprint'] == SCOPE, 'native_scope_changed')
    proof = load(R06, R06_SHA, 'publication_typed_acceptance_reader')
    g = load(MCP, MCP_SHA, 'publication_private_runtime_sources')
    g.historical_guard_file(g.HELPER)
    h = load(g.HELPER, g.HELPER_SHA, 'publication_private_database_read', mode=0o644)
    h.validate_candidate(g.LEGACY_MANIFEST_SHA)
    reverse = args.phase == 'rollback' or (args.phase == 'preflight' and args.direction == 'rollback')
    source, target = (NEW, OLD) if reverse else (OLD, NEW)
    base.NEW = target
    a.RELEASE = source
    before = snapshot(a, base, h, proof, source)
    base.NEW = target
    if reverse:
        previous = json.loads(private(WORK / 'adopt-after.json'))
        require(previous['status'] == 'adopt_completed'
            and previous['operator_sha256'] == args.operator_sha256
            and (previous['plan_sha256'] == PLAN_SHA)
            and (previous['post_consumers'] == before['consumers']),
             'rollback_adoption_lineage_changed')
    else:
        ready = json.loads(private(READY, READY_SHA))
        require(before['consumers'] == ready['post_consumers'], 'R08_owner_changed_since_READY')
    transitions = base.descriptor_bytes(source, target)
    timers = {u: a.state(u)['active'] for u in a.TIMERS}
    require(all((v == 'active' for v in timers.values())), 'backup_timers_not_active')
    info = WORK.lstat()
    require(WORK.resolve() == WORK
        and stat.S_ISDIR(info.st_mode)
        and (info.st_uid == 0)
        and (stat.S_IMODE(info.st_mode) == 0o700),
         'private_work_changed')
    common = {'schema': 'nodia-ai-ai36-c05-publication-transition-v1',
         'phase': args.phase,
         'operator_sha256': args.operator_sha256,
         'plan_sha256': PLAN_SHA,
         'source': str(source),
         'target': str(target),
         'publication': publication,
         'technical_scope_transition': scope_value,
         'before': before,
         'old_manifest_sha256': OLD_SHA,
         'new_manifest_sha256': NEW_SHA,
         'provider_requests': 0,
         'SQL_restores': 0,
         'migrations': 0}
    if args.phase == 'preflight':
        return {**common, 'status': 'preflight_passed_no_mutations', 'services_changed': False}
    fd = os.open(WORK / 'deployment.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'r+b') as lock:
        private(WORK / 'deployment.lock')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        write(args.phase + '-before.json', common)
        if not reverse:
            for i, (_, raw, _, mode) in enumerate(transitions):
                path = WORK / ('descriptor-' + str(i) + '.private')
                a.write_new(path, raw, mode)
        else:
            for i, (_, _, desired, _) in enumerate(transitions):
                require((WORK / ('descriptor-' + str(i) + '.private')).read_bytes() == desired,
                     'rollback_descriptor_snapshot_changed')
        admission_closed = False
        timers_stopped = False
        try:
            timers_stopped = True
            a.checked(['systemctl', 'stop', *a.TIMERS])
            base.oneshots_idle(a)
            began = datetime.now(timezone.utc)
            backup = json.loads(a.checked(['sudo',
                         '-u',
                         'nodia',
                         '/usr/local/bin/node',
                         str(source / 'scripts/nodia-ai-backups.mjs'),
                         'backup',
                         str(a.BACKUP)],
                     timeout=240, cwd=str(source)))
            base.validate_backup(backup, began, datetime.now(timezone.utc))
            write(args.phase + '-backup.json', backup)
            fresh = snapshot(a, base, h, proof, source)
            invariants(a, base, before, fresh)
            require(fresh['consumers'] == before['consumers'], 'writers_changed_during_backup')
            admission_closed = True
            a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
            require(a.stopped('nodia-api'), 'API_not_stopped')
            deadline = time.monotonic() + 45
            while True:
                value = h.chat_projection(before['consumers']['nodia-ai-worker']['pid'])
                if all((value.get(k) == 0 for k in ('pending_jobs', 'open_attempts', 'retained_slots'))):
                    break
                require(time.monotonic() < deadline, 'worker_not_drained_no_forced_stop')
                time.sleep(0.5)
            require(value == before['SQL'], 'operational_SQL_changed_during_drain')
            worker = h.service('nodia-ai-worker')
            require(worker['pid'] == before['consumers']['nodia-ai-worker']['pid'],
                    'worker_changed_during_drain')
            base.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset({worker['pid']}))
            a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
            require(all((a.stopped(u) for u in a.CONSUMERS)), 'claims_not_closed')
            base.codex_barrier(a, Path('/var/lib/nodia/codex'))
            for p, expected, desired, mode in transitions:
                base.atomic_replace(p, expected, desired, mode, args.phase)
            a.checked(['systemctl', 'daemon-reload'])
            a.RELEASE = target
            h.ACTIVE = target
            require(all((a.state(u)['working_directory'] == str(target) for u in a.CONSUMERS)),
                 'effective_target_changed')
            a.checked(['systemctl', 'start', *a.CONSUMERS], timeout=45)
            a.wait_health()
            after = snapshot(a, base, h, proof, target)
            invariants(a, base, before, after)
            require(scope.unchanged_scope() == scope_value, 'native_scope_changed_after_transition')
            require(sorted((p.name for p in Path('/var/lib/nodia-ai-recovery/spool').iterdir())) == ['.backup.lock'],
                 'backup_spool_not_empty')
            a.checked(['systemctl', 'start', *a.TIMERS])
            require(all((a.state(u)['active'] == timers[u] for u in a.TIMERS)), 'timers_not_restored')
            timers_stopped = False
            require(a.active_new_processes() == after['consumers'], 'post_consumers_changed')
            result = {**common,
                 'status': args.phase + '_completed',
                 'post_consumers': after['consumers'],
                 'after': after,
                 'fresh_backup': backup,
                 'timers_restored': True,
                 'journal_bootstrap_or_close': False,
                 'new_publication': not reverse,
                 'SQL_restore_performed': False,
                 'proofs_copied_or_restored': False,
                 'sessions_or_login_modified_by_operator': False,
                 'current_proof_snapshot_preserved': True}
            write(args.phase + '-after.json', result)
            return result
        except Exception as error:
            code = str(error) if isinstance(error,
                 ValueError) and re.fullmatch('[A-Za-z_]{1,100}',
                 str(error)) else 'closed_transition_failure'
            failure = {**common,
                 'status': args.phase + '_failed',
                 'failure_code': code,
                 'admission_closed': admission_closed,
                 'automatic_replay_allowed': False,
                 'raw_details_emitted': False}
            if admission_closed:
                try:
                    a.checked(['systemctl', 'stop', *a.TIMERS])
                    a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
                    require(a.stopped('nodia-api'), 'API_failed_to_reclose')
                    state = a.state('nodia-ai-worker')
                    if state['active'] == 'active':
                        quiet_sql(h, state['pid'])
                        worker = h.service('nodia-ai-worker')
                        require(worker['pid'] == state['pid'], 'worker_changed_before_failure_drain')
                        base.codex_barrier(a, Path('/var/lib/nodia/codex'), frozenset({worker['pid']}))
                        a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
                    failure['worker_stopped_after_quiet'] = a.stopped('nodia-ai-worker')
                except Exception:
                    failure['worker_left_draining_no_forced_kill'] = True
                failure['timers_left_stopped_requires_operator'] = True
            elif timers_stopped:
                try:
                    a.active_new_processes()
                    a.checked(['systemctl', 'start', *a.TIMERS])
                    failure['timers_restored'] = all((a.state(u)['active'] == 'active' for u in a.TIMERS))
                except Exception:
                    failure['timers_left_stopped_requires_operator'] = True
            try:
                failure['observed_consumers'] = {u: a.state(u) for u in a.CONSUMERS}
            except Exception:
                failure['consumer_observation_failed'] = True
            write(args.phase + '-failure.json', failure)
            return failure
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('preflight', 'adopt', 'rollback'))
    parser.add_argument('--direction', choices=('adopt', 'rollback'), default='adopt')
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    try:
        result = run(parser.parse_args())
        print(json.dumps(result))
        sys.exit(0 if result.get('status') in ('preflight_passed_no_mutations',
                 'adopt_completed',
                 'rollback_completed') else 1)
    except Exception as error:
        code = str(error) if isinstance(error,
             ValueError) and re.fullmatch('[A-Za-z_]{1,100}',
             str(error)) else 'closed_precondition_failure'
        print(json.dumps({'schema': 'nodia-ai-ai36-c05-publication-transition-v1',
                     'status': 'precondition_failed',
                     'failure_code': code,
                     'automatic_replay_allowed': False,
                     'raw_details_emitted': False}))
        sys.exit(1)
