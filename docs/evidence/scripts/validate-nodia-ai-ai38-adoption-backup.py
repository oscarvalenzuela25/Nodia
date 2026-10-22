"""Offline negative controls. No SSH, Docker, database, GPG or systemd execution."""
import argparse
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
    source = root / 'docs/evidence/scripts/nodia-ai-ai38-adoption-backup.py'
    expected = '745662e7a0941f5fb8f265d761f8d94f1e002090cc196837731fb54296d69199'
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
    report = {'stage': 'AI-38', 'scope': 'offline_backup_driver_negative_controls_no_external_execution',
              'status': 'passed', 'backup_source_sha256': expected,
              'validator_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'check_count': len(checks), 'checks': checks,
              'external_processes_started': 0, 'configured_database_access': False,
              'private_environment_read': False, 'VM_mutations': False, 'provider_requests': 0,
              'actual_GPG_or_restore_verified': False}
    if args.write:
        target = root / 'docs/evidence/nodia-ai-ai38-adoption-backup-control-r01.json'
        with target.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
