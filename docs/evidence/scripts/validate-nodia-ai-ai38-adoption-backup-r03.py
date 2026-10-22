"""Offline negative controls. No SSH, Docker, database, GPG or systemd execution."""
import argparse
import ast
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', required=True)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    source = root / 'docs/evidence/scripts/nodia-ai-ai38-adoption-backup-r03.py'
    expected = 'f66e2a7643d4f04d738a0eb752f090dc2fb7828bf8c26973bc07dc63f729af57'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
    specification = importlib.util.spec_from_file_location('ai38_reviewed_backup', source)
    helper = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(helper)
    checks = []
    blocked_calls = []

    def forbidden(*values, **kwargs):
        blocked_calls.append('unexpected_external_or_filesystem_operation')
        raise RuntimeError('Offline control forbids external actions')

    with patch.object(helper.subprocess, 'run', side_effect=forbidden), patch.object(helper.subprocess, 'Popen', side_effect=forbidden), patch.object(helper.Path, 'exists', side_effect=forbidden), patch.object(helper.Path, 'mkdir', side_effect=forbidden), patch.object(sys, 'argv', [str(source), '--dry-run']):
        out = io.StringIO()
        with redirect_stdout(out):
            assert helper.main() == 0
        plan = json.loads(out.getvalue())
        assert plan['status'] == 'prepared_not_executed' and plan['configured_database_backup'] is False
        assert plan['encryption'] == {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'}
        assert plan['provider_requests'] == 0 and plan['original_database_restored'] is False and plan['restored_content_served'] is False
        checks.append('dry run rejects any attempted process filesystem or network side effect')
    for hours in ('0', '-1', '169'):
        with patch.object(helper.subprocess, 'run', side_effect=forbidden), patch.object(helper.Path, 'exists', side_effect=forbidden), patch.object(sys, 'argv', [str(source), '--dry-run', '--retention-hours', hours]):
            try:
                helper.main()
            except AssertionError:
                checks.append('retention ' + hours + ' rejected before side effects')
            else:
                raise AssertionError('Invalid retention accepted')
    for hours in ('1', '168'):
        with patch.object(helper.subprocess, 'run', side_effect=forbidden), patch.object(sys, 'argv', [str(source), '--dry-run', '--retention-hours', hours]), redirect_stdout(io.StringIO()):
            assert helper.main() == 0
        checks.append('retention boundary ' + hours + ' accepted only as dry-run plan')
    with patch.object(helper.os, 'name', 'posix'), patch.object(helper.os, 'geteuid', create=True, return_value=0), patch.object(helper.Path, 'exists', side_effect=forbidden), patch.object(sys, 'argv', [str(source), '--execute']):
        try:
            helper.main()
        except AssertionError:
            checks.append('execute requires an explicit retention before filesystem access')
        else:
            raise AssertionError('Missing retention accepted')
    for name in ["users';DROP TABLE users;--", 'users"', '../users', 'UPPER', 'users\n', '', 'users.other']:
        try:
            helper.count_sql([name])
        except AssertionError:
            pass
        else:
            raise AssertionError('Unsafe identifier accepted')
    checks.append('count query rejects seven unsafe identifier cases')
    try:
        helper.count_sql([])
    except AssertionError:
        checks.append('count query refuses empty table inventory')
    else:
        raise AssertionError('Empty inventory accepted')
    assert helper.count_sql(['users', 'nodia_ai_jobs']).count('count(*)') == 2
    checks.append('safe table inventory generates two quoted read-only aggregates')
    # The first real branch must stop at the synthetic active-unit response,
    # before creating any directory or reading the private source environment.
    calls = []

    def active_unit(argv, **kwargs):
        calls.append(argv)
        assert argv[:2] == ['systemctl', 'show']
        return SimpleNamespace(stdout=b'active\n')

    with patch.object(helper.os, 'name', 'posix'), patch.object(helper.os, 'geteuid', create=True, return_value=0), patch.object(helper.Path, 'exists', return_value=False), patch.object(helper.Path, 'mkdir', side_effect=forbidden), patch.object(helper.Path, 'read_bytes', side_effect=forbidden), patch.object(helper.shutil, 'which', return_value='/synthetic/not-executed'), patch.object(helper.subprocess, 'run', side_effect=active_unit), patch.object(sys, 'argv', [str(source), '--execute', '--retention-hours', '24']):
        try:
            helper.main()
        except AssertionError:
            assert len(calls) == 1
            checks.append('active writer rejects execution before staging backup or private environment')
        else:
            raise AssertionError('Active writer accepted')
    assert not blocked_calls
    # Execute the actual readiness loop, extracted from the reviewed driver,
    # against a temporary-server fixture and an unavailable-database fixture.
    # No PostgreSQL process or copied substitute readiness implementation runs.
    syntax = ast.parse(source.read_text(encoding='utf-8'))
    loops = [node for node in ast.walk(syntax) if isinstance(node, ast.For)
             and any(isinstance(child, ast.Constant) and child.value == 'pg_isready'
                     for child in ast.walk(node))]
    assert len(loops) == 1
    probe_calls, sleeps = [], []
    scripted_results = [(1, b''), (0, b''), (1, b''), (0, b''), (0, b'1\n')]

    def fixture_probe(argv, **kwargs):
        assert argv[:3] == ['docker', 'exec', 'synthetic-restore']
        assert argv[argv.index('-h') + 1] == '127.0.0.1'
        assert argv[argv.index('-d') + 1] == 'ai38restore'
        probe_calls.append(argv)
        status, stdout = scripted_results.pop(0)
        return SimpleNamespace(returncode=status, stdout=stdout)

    readiness_report = {}
    namespace = {'subprocess': SimpleNamespace(run=fixture_probe), 'remaining': lambda cap: cap,
                 'time': SimpleNamespace(sleep=lambda duration: sleeps.append(duration)),
                 'restore_name': 'synthetic-restore', 'report': readiness_report}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[loops[0]], type_ignores=[])), '<reviewed-readiness-loop>', 'exec'), namespace)
    assert not scripted_results and len(probe_calls) == 5 and len(sleeps) == 2
    assert readiness_report == {'final_TCP_database_ready': True}
    assert [argv[3] for argv in probe_calls] == ['pg_isready', 'pg_isready', 'psql', 'pg_isready', 'psql']
    checks.append('real readiness loop rejects temporary socket-only server and missing database before final TCP SELECT1')
    # Fixtures identify logical schema versus dropped physical attributes.
    first = ['synthetic', 'id', 1, None, 'NO', 'bigint', 'int8', None, 64, 0, None, 'pg_catalog', None, 'NO', None, 'NEVER', None, None]
    second = ['synthetic', 'amount', 3, None, 'NO', 'numeric', 'numeric', None, 12, 2, None, 'pg_catalog', None, 'NO', None, 'NEVER', None, None]
    physical = [first, second]
    restored = [first.copy(), second.copy()]; restored[1][2] = 2
    assert helper.logical_columns(physical) == helper.logical_columns(restored)
    checks.append('one dropped physical ordinal canonicalizes to exact visible order')
    for index, replacement in [(7, 30), (9, 3), (16, 'changed_expression'), (17, 'changed_collation')]:
        altered = [row.copy() for row in restored]; altered[1][index] = replacement
        assert helper.logical_columns(physical) != helper.logical_columns(altered)
    checks.append('logical comparison retains length numeric scale generated expression and collation differences')
    original = [['synthetic', 'synthetic_check', 'CHECK ((amount > 0))']]
    target = [['synthetic', 'synthetic_check', 'CHECK ((amount > (0)))']]
    def fixture_parser(sql):
        assert original[0][2] in sql and 'CHECK (TRUE)' in sql
        return [target[0][2], 'CHECK (true)']
    canonical, proof = helper.native_CHECK_baseline(original, target, fixture_parser)
    assert canonical == target and proof['CHECKs_reparsed'] == 1 and proof['all_weakened_TRUE_counterexamples_rejected']
    checks.append('native parser bridge preserves exact original SQL and requires exact reparsed CHECK plus weakened counterexample')
    invalid = [([], target, fixture_parser),
               ([['synthetic', 'synthetic_check', 'PRIMARY KEY (id)']], [['synthetic', 'synthetic_check', 'PRIMARY KEY (amount)']], forbidden),
               (original, [['synthetic', 'synthetic_check', 'CHECK (TRUE)']], fixture_parser),
               (original, target, lambda sql: ['CHECK (amount >= 0)', 'CHECK (true)']),
               (original, target, lambda sql: [target[0][2], target[0][2]])]
    for a, b, parse in invalid:
        try:
            helper.native_CHECK_baseline(a, b, parse)
        except AssertionError:
            pass
        else:
            raise AssertionError('Changed constraint accepted')
    checks.append('missing identity non-CHECK change weakened CHECK changed operator and invalid counterexample all reject')
    report = {'stage': 'AI-38', 'scope': 'offline_backup_driver_negative_controls_no_external_execution',
              'status': 'passed', 'backup_source_sha256': expected,
              'validator_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'check_count': len(checks), 'checks': checks,
              'external_processes_started': 0, 'configured_database_access': False,
              'private_environment_read': False, 'VM_mutations': False, 'provider_requests': 0,
              'actual_GPG_or_restore_verified': False}
    if args.write:
        target = root / 'docs/evidence/nodia-ai-ai38-adoption-backup-control-r03.json'
        with target.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
