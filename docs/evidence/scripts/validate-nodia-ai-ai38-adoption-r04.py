"""Offline operational-continuation controls; no VM, services, DB or provider."""
import argparse
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch


def module(path, label):
    spec = importlib.util.spec_from_file_location(label, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', required=True)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    scripts = root / 'docs/evidence/scripts'
    with patch.dict(sys.modules, {'fcntl': SimpleNamespace()}):
        controller = module(scripts / 'nodia-ai-ai38-adoption-r04.py', 'controller_r04')
    backup = module(scripts / 'nodia-ai-ai38-adoption-backup-r04.py', 'backup_r04')
    cleanup = module(scripts / 'nodia-ai-ai38-adoption-backup-cleanup-r04.py', 'cleanup_r04')
    checks = []

    def forbidden(*values, **options):
        raise RuntimeError('offline_external_action_forbidden')

    with patch.dict(sys.modules, {'fcntl': SimpleNamespace()}), patch('subprocess.run', side_effect=forbidden), patch('subprocess.Popen', side_effect=forbidden):
        h = controller.load_source(scripts / 'nodia-ai-ai38-adoption-r03.py')
        assert 'main' not in h and callable(h['stop_quiet']) and callable(h['quiet'])
        checks.append('pinned controller helpers loaded without historical entry point or operations')
        b = backup.load_source(scripts / 'nodia-ai-ai38-adoption-backup-r03.py')
        assert b['WORK'] == Path('/opt/nodia/verification/ai38-adoption-backup-r04') and b['UNIT'].endswith('-r04')
        assert b['__file__'] == backup.__file__
        checks.append('backup work unit and reporting source belong exclusively to R04')
        c = cleanup.load_source(scripts / 'nodia-ai-ai38-adoption-backup-cleanup-template-r02.py')
        assert c['DRILL'] == controller.WORK and c['__file__'] == cleanup.__file__
        checks.append('cleanup uses R04 rollback and wrapper provenance')
        for loader in (controller, backup, cleanup):
            try:
                loader.load_source(Path(__file__))
            except AssertionError:
                checks.append('modified source rejected before executing ' + loader.__name__)
            else:
                raise AssertionError('untrusted source accepted')
        with patch.object(sys, 'argv', ['backup', '--dry-run']), patch.object(Path, 'exists', side_effect=forbidden), patch.object(Path, 'mkdir', side_effect=forbidden), redirect_stdout(io.StringIO()) as output:
            assert b['main']() == 0
        assert json.loads(output.getvalue())['configured_database_backup'] is False
        checks.append('backup dry-run performs no process or filesystem mutations')
        with patch.object(sys, 'argv', ['cleanup', '--check']), patch.object(Path, 'exists', side_effect=forbidden), patch.object(Path, 'mkdir', side_effect=forbidden), redirect_stdout(io.StringIO()) as output:
            assert c['main']() == 0
        assert json.loads(output.getvalue())['status'] == 'prepared_not_executed'
        checks.append('cleanup check performs no process or filesystem mutations')
    now = datetime.now(timezone.utc)
    q = {'finished_at_utc': (now - timedelta(minutes=5)).isoformat()}
    receipt = {'status': 'passed', 'configured_database_backup': True, 'disposable_restore_verified': True,
        'original_database_restored': False, 'encryption': {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'},
        'backup_retained_for_closed_drill': True, 'passphrase_retained_privately': True,
        'owned_containers_remaining': 0, 'expiry_timer_active_after': True,
        'source_snapshot_finished_at_utc': (now - timedelta(minutes=1)).isoformat(),
        'backup_expires_at_utc': (now + timedelta(hours=23)).isoformat()}
    controller.require_receipt(receipt, q, 'a' * 64)
    checks.append('fresh completed encrypted isolated restore accepted')
    bad_values = {'status': 'failed', 'configured_database_backup': False, 'disposable_restore_verified': False,
        'original_database_restored': True, 'encryption': {'cipher': 'plaintext'},
        'backup_retained_for_closed_drill': False, 'passphrase_retained_privately': False,
        'owned_containers_remaining': 1, 'expiry_timer_active_after': False,
        'source_snapshot_finished_at_utc': (now - timedelta(hours=2)).isoformat(),
        'backup_expires_at_utc': (now - timedelta(seconds=1)).isoformat()}
    for key, value in bad_values.items():
        try:
            controller.require_receipt({**receipt, key: value}, q, 'a' * 64)
        except AssertionError:
            checks.append('backup guard rejects ' + key)
        else:
            raise AssertionError('invalid receipt accepted ' + key)
    try:
        controller.require_receipt(receipt, {'finished_at_utc': now.isoformat()}, 'a' * 64)
    except AssertionError:
        checks.append('snapshot preceding new quiescence rejected')
    else:
        raise AssertionError('old backup accepted')
    report = {'stage': 'AI-38', 'scope': 'offline_R04_operational_continuation_controls', 'status': 'passed',
        'checks': checks, 'checks_passed': len(checks), 'VM_operations': 0, 'provider_requests': 0,
        'configured_database_writes': 0, 'sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (Path(controller.__file__), Path(backup.__file__), Path(cleanup.__file__))}}
    if args.write:
        target = root / 'docs/evidence/nodia-ai-ai38-adoption-offline-r04.json'
        with target.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
