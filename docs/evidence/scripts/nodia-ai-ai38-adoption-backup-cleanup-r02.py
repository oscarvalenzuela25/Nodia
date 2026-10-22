"""Delete only this drill's encrypted copy/key and expiry units after verified rollback.

--check is offline. --execute requires exact backup/rollback receipt hashes.
Deletion proves absence of these live files, not physical erasure or external rotation.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


WORK = Path('/opt/nodia/verification/ai38-adoption-backup-r02')
DRILL = Path('/opt/nodia/verification/ai38-adoption-r02')
UNIT = 'nodia-ai38-backup-expiry-r02'
NATIVE = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
          'temporary_attachment_directories', 'temporary_cli_directories')
SQL = ('pending_jobs', 'open_attempts', 'retained_slots')


def file_sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(part)
    return value.hexdigest()


def verify_receipts(backup, rollback):
    assert backup['status'] == 'passed' and backup['configured_database_backup'] is True
    assert backup['disposable_restore_verified'] is True and backup['original_database_restored'] is False
    assert backup['encryption'] == {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'}
    assert backup['backup_retained_for_closed_drill'] is True and backup['passphrase_retained_privately'] is True
    assert rollback['status'] == 'passed' and rollback['phase'] == 'rollback'
    assert rollback['rollback_descriptors_byte_exact'] is True and rollback['only_owned_IPv4_IPv6_fences_removed'] is True
    assert rollback['migrations_executed'] == rollback['database_restores'] == rollback['direct_business_SQL_writes'] == 0
    assert rollback['public_traffic_opened'] is False and rollback['full_environment_release_authorized'] is False
    assert all(value == 'active' for value in rollback['services'].values()) and len(rollback['services']) == 4
    assert all(rollback['quiet']['native'][key] == 0 for key in NATIVE)
    assert all(rollback['quiet']['SQL'][key] == 0 for key in SQL)
    assert datetime.fromisoformat(rollback['finished_at_utc']) >= datetime.fromisoformat(backup['source_snapshot_finished_at_utc'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--check', action='store_true')
    action.add_argument('--execute', action='store_true')
    parser.add_argument('--backup-receipt-sha256')
    parser.add_argument('--rollback-receipt-sha256')
    args = parser.parse_args()
    if args.check:
        print(json.dumps({'status': 'prepared_not_executed', 'scope': 'owned_backup_key_and_expiry_units_only',
                          'original_database_restored': False, 'configured_SQL_writes': 0,
                          'provider_requests': 0, 'physical_erasure_or_external_rotation_proven': False}))
        return 0
    assert os.name == 'posix' and os.geteuid() == 0
    assert re.fullmatch(r'[a-f0-9]{64}', args.backup_receipt_sha256 or '')
    assert re.fullmatch(r'[a-f0-9]{64}', args.rollback_receipt_sha256 or '')
    assert WORK.is_dir() and not WORK.is_symlink() and WORK.stat().st_mode & 0o777 == 0o700
    assert not (WORK / 'public-purge-report.json').exists()
    backup_path, rollback_path = WORK / 'public-report.json', DRILL / 'rollback.json'
    assert file_sha(backup_path) == args.backup_receipt_sha256
    assert file_sha(rollback_path) == args.rollback_receipt_sha256
    backup = json.loads(backup_path.read_text(encoding='utf-8'))
    rollback = json.loads(rollback_path.read_text(encoding='utf-8'))
    verify_receipts(backup, rollback)
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(rollback['finished_at_utc'])).total_seconds()
    assert 0 <= age <= 900, 'Rollback proof stale: inspect closure again before purging'
    raw = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], check=True, capture_output=True, timeout=15).stdout
    current = json.loads(raw)[0]
    assert current['State']['Running'] is True
    assert current['Id'] == rollback['epoch']['id'] and current['Image'] == rollback['epoch']['image'] and current['State']['StartedAt'] == rollback['epoch']['started_at']
    copy, key = WORK / 'private-original-db.pgdump.gpg', WORK / 'private-passphrase'
    for value in (copy, key):
        assert value.is_file() and not value.is_symlink() and value.stat().st_mode & 0o777 == 0o600
    assert file_sha(copy) == backup['encrypted_backup_sha256']
    cleanup = WORK / 'private-expiry.py'
    expected_cleanup = "from pathlib import Path\nroot=Path(" + repr(str(WORK)) + ")\nassert root.is_dir() and not root.is_symlink()\nfor name in ('private-original-db.pgdump.gpg','private-passphrase'):\n p=root/name\n assert not p.is_symlink()\n p.unlink(missing_ok=True)\n"
    assert not cleanup.is_symlink() and cleanup.read_text(encoding='utf-8') == expected_cleanup
    service, timer = [Path('/etc/systemd/system') / (UNIT + suffix) for suffix in ('.service', '.timer')]
    assert service.is_file() and timer.is_file() and not service.is_symlink() and not timer.is_symlink()
    expected_service = '[Unit]\nDescription=NodiaAI closed-drill private backup expiry\n[Service]\nType=oneshot\nUser=root\nUMask=0077\nExecStart=/usr/bin/python3 ' + str(cleanup) + '\n'
    expiry = datetime.fromisoformat(backup['backup_expires_at_utc'])
    expected_timer = '[Unit]\nDescription=NodiaAI closed-drill bounded backup retention\n[Timer]\nOnCalendar=' + expiry.strftime('%Y-%m-%d %H:%M:%S UTC') + '\nPersistent=true\nAccuracySec=1s\nUnit=' + UNIT + '.service\n[Install]\nWantedBy=timers.target\n'
    assert service.read_text(encoding='utf-8') == expected_service and timer.read_text(encoding='utf-8') == expected_timer
    report = {'stage': 'AI-38', 'scope': 'early_purge_of_owned_encrypted_copy_and_key_after_closed_drill',
              'status': 'running', 'source_sha256': file_sha(Path(__file__)),
              'backup_receipt_sha256': args.backup_receipt_sha256, 'rollback_receipt_sha256': args.rollback_receipt_sha256,
              'configured_SQL_writes': 0, 'original_database_restored': False, 'provider_requests': 0,
              'physical_erasure_or_external_rotation_proven': False,
              'started_at_utc': datetime.now(timezone.utc).isoformat()}
    try:
        subprocess.run(['systemctl', 'start', UNIT + '.service'], check=True, capture_output=True, timeout=15)
        assert not copy.exists() and not key.exists()
        subprocess.run(['systemctl', 'disable', '--now', UNIT + '.timer'], check=True, capture_output=True, timeout=15)
        service.unlink(); timer.unlink()
        subprocess.run(['systemctl', 'daemon-reload'], check=True, capture_output=True, timeout=15)
        report.update(status='passed', encrypted_copy_absent=True, passphrase_file_absent=True,
                      only_owned_expiry_units_removed=True, expiry_units_remaining=0)
    except Exception as error:
        report['status'] = 'failed_requires_review'
        report['failure_class'] = type(error).__name__
        raise
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        with (WORK / 'public-purge-report.json').open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
