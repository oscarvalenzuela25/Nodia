"""AI-38: bounded, read-only VM retention metadata. No secret/backup payload output.

Run as root through SSH stdin. No VM files, services, clocks or database data are
changed. A lexical cron match, timer or timestamp never proves backup coverage.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess


SAFE_NAME = re.compile(r'[A-Za-z0-9_.@-]{1,180}\Z')
SIGNAL = re.compile(rb'nodia|backup|pg_dump|pg_restore|pgbackrest|restic|borg|wal-g|rclone|snapshot|deletion|retention|journal', re.I)
UNIT_SIGNAL = re.compile(r'nodia|backup|restic|borg|pgbackrest|wal-g|rclone|snapshot|delet|retention|journal', re.I)
SERVICES = ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')


def run(argv, timeout=15):
    try:
        result = subprocess.run(argv, capture_output=True, check=False, timeout=timeout,
                                env={**os.environ, 'LC_ALL': 'C', 'PGCONNECT_TIMEOUT': '3', 'PGAPPNAME': 'ai38_retention_readonly'})
        return result.returncode, result.stdout
    except (OSError, subprocess.TimeoutExpired):
        return None, b''


def metadata(path):
    report = {'path': str(path), 'exists': False, 'contents_read': False}
    try:
        value = path.lstat()
    except (FileNotFoundError, PermissionError):
        return report
    report.update(exists=True, kind='symlink' if stat.S_ISLNK(value.st_mode) else
                  'directory' if stat.S_ISDIR(value.st_mode) else 'file' if stat.S_ISREG(value.st_mode) else 'other',
                  mode=oct(stat.S_IMODE(value.st_mode)), uid=value.st_uid, byte_count=value.st_size,
                  mtime_utc=datetime.fromtimestamp(value.st_mtime, timezone.utc).isoformat())
    return report


def children(path, limit, name_pattern=None):
    info = metadata(path)
    if info.get('kind') != 'directory':
        return info, []
    result = []
    skipped = 0
    with os.scandir(path) as stream:
        for index, entry in enumerate(stream):
            if index >= limit:
                info['truncated'] = True
                break
            if not SAFE_NAME.fullmatch(entry.name) or (name_pattern and not name_pattern.search(entry.name)):
                skipped += 1
                continue
            result.append(Path(entry.path))
    info.update(entries_examined_limit=limit, name_filter_skipped=skipped)
    return info, sorted(result)


def cron_file(path):
    result = metadata(path)
    if result.get('kind') != 'file' or result['byte_count'] > 65536:
        result['lexical_inspection'] = 'not_regular_or_over_64KiB_or_missing'
        return result
    # These standard cron definitions may contain argv/secrets: never emit lines.
    with path.open('rb') as stream:
        content = stream.read(65537)
    if len(content) > 65536:
        result['lexical_inspection'] = 'changed_over_limit'
        return result
    active = [line for line in content.splitlines() if line.strip() and not line.lstrip().startswith(b'#')]
    result.update(contents_read=True, content_emitted=False, sha256=hashlib.sha256(content).hexdigest(),
                  noncomment_line_count=len(active), selected_keyword_line_count=sum(bool(SIGNAL.search(line)) for line in active),
                  interpretation='lexical_only_not_a_proven_schedule_or_coverage')
    return result


def services():
    result = {}
    for unit in SERVICES:
        code, payload = run(['systemctl', 'show', unit, '--no-pager',
                             '--property=ActiveState,MainPID,ActiveEnterTimestampMonotonic'])
        result[unit] = {'exit_code': code, 'metadata': dict(line.split('=', 1) for line in
                        payload.decode('utf-8', errors='replace').splitlines() if '=' in line)}
    return result


def pg_observation():
    # No connection string, role password, archive/restore command or data directory is printed.
    sql = """BEGIN READ ONLY;
SET LOCAL statement_timeout='3000ms';
SELECT json_build_object(
 'settings',(SELECT json_object_agg(name,setting) FROM pg_settings WHERE name IN
 ('wal_level','archive_mode','archive_timeout','max_wal_senders','wal_keep_size','max_slot_wal_keep_size')),
 'archive_command_nonempty_when_archiving_on',(SELECT CASE WHEN current_setting('archive_mode')='off' THEN NULL ELSE length(setting)>0 END FROM pg_settings WHERE name='archive_command'),
 'archive_library_configured',(SELECT length(setting)>0 FROM pg_settings WHERE name='archive_library'),
 'restore_command_configured',(SELECT length(setting)>0 FROM pg_settings WHERE name='restore_command'),
 'archiver',(SELECT json_build_object('archived_count',archived_count,'last_archived_time',last_archived_time,
 'failed_count',failed_count,'last_failed_time',last_failed_time,'stats_reset',stats_reset) FROM pg_stat_archiver),
 'replication_slots',(SELECT json_build_object('count',count(*),'active_count',count(*) FILTER (WHERE active)) FROM pg_replication_slots),
 'WAL_directory',(SELECT json_build_object('file_count',count(*),'bytes',sum(size)) FROM pg_ls_waldir()));
ROLLBACK;"""
    candidates = []
    if shutil.which('psql') and shutil.which('sudo'):
        candidates.append(('host_postgres_peer', ['sudo', '-n', '-u', 'postgres', 'psql']))
    if shutil.which('docker'):
        code, payload = run(['docker', 'ps', '--format', '{{.Names}}\t{{.Image}}'])
        if code == 0:
            for line in payload.decode('utf-8', errors='replace').splitlines():
                fields = line.split('\t')
                if len(fields) == 2 and SAFE_NAME.fullmatch(fields[0]) and re.fullmatch(r'(?:docker\.io/library/)?postgres(?::[A-Za-z0-9_.-]+)?(?:@sha256:[a-f0-9]{64})?', fields[1]):
                    candidates.append(('running_postgres_container', ['docker', 'exec', '-u', 'postgres', fields[0], 'psql']))
    attempts = []
    for label, command in candidates[:4]:
        code, payload = run([*command, '-X', '-w', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-c', sql], 12)
        attempts.append({'surface': label, 'exit_code': code})
        if code != 0:
            continue
        try:
            parsed = json.loads(payload)
        except (ValueError, UnicodeDecodeError):
            continue
        if isinstance(parsed, dict) and set(parsed) == {'settings', 'archive_command_nonempty_when_archiving_on', 'archive_library_configured', 'restore_command_configured', 'archiver', 'replication_slots', 'WAL_directory'}:
            return {'status': 'observed_read_only', 'surface': label, 'attempts': attempts, 'metadata': parsed,
                    'limits': 'settings_and_aggregate_metadata_not_archive_destination_inventory_or_recoverability',
                    'archive_command_observation': 'null_when_archive_mode_off_to_avoid_disabled_sentinel_as_configured_command'}
    return {'status': 'not_observed_no_successful_local_peer_connection', 'attempts': attempts,
            'zero_is_not_inferred_from_missing_data': True}


def main():
    assert os.name == 'posix' and os.geteuid() == 0
    before = services()
    cron = [cron_file(Path(name)) for name in ('/etc/crontab', '/etc/anacrontab')]
    scopes = []
    for name in ('/etc/cron.d', '/var/spool/cron/crontabs'):
        scope, entries = children(Path(name), 100)
        scopes.append(scope)
        cron.extend(cron_file(path) for path in entries)
    selected_units = {}
    for unit_type in ('service', 'timer'):
        code, payload = run(['systemctl', 'list-unit-files', '--type=' + unit_type, '--no-legend', '--no-pager'])
        if code != 0:
            selected_units['listing_' + unit_type] = {'exit_code': code}
            continue
        names = [line.split()[0] for line in payload.decode('utf-8', errors='replace').splitlines() if line.split()]
        for name in names[:2000]:
            if not SAFE_NAME.fullmatch(name) or not UNIT_SIGNAL.search(name) or '@.' in name:
                continue
            exit_code, value = run(['systemctl', 'show', name, '--no-pager',
                '--property=LoadState,ActiveState,SubState,UnitFileState,FragmentPath,Result,LastTriggerUSec,NextElapseUSecRealtime'])
            selected_units[name] = {'exit_code': exit_code, 'metadata': dict(line.split('=', 1) for line in value.decode('utf-8', errors='replace').splitlines() if '=' in line)}
    local_units_scope, local_units = children(Path('/etc/systemd/system'), 300, UNIT_SIGNAL)
    artifacts = []
    for name in ('/var/backups/nodia', '/opt/nodia/verification-backups', '/opt/nodia/verification'):
        root = Path(name)
        scope, entries = children(root, 300, re.compile(r'backup|ai[0-9]', re.I))
        scopes.append(scope)
        for entry in entries:
            entry_info = metadata(entry)
            artifacts.append(entry_info)
            # One extra metadata level only in technically named AI backup directories.
            if entry_info.get('kind') == 'directory' and re.search('backup|ai[0-9]', entry.name, re.I):
                child_scope, files = children(entry, 120, re.compile(r'backup|dump|\.gpg$|\.asc$|\.age$|\.enc$|snapshot|journal|manifest|report', re.I))
                scopes.append(child_scope)
                artifacts.extend(metadata(path) for path in files)
    postgres = pg_observation()
    after = services()
    report = {'schema_version': 1, 'stage': 'AI-38', 'scope': 'bounded_VM_cron_units_backup_metadata_and_postgres_WAL_settings',
              'status': 'observed_gates_not_proven', 'observed_at_VM_utc': datetime.now(timezone.utc).isoformat(),
              'standard_cron_metadata': cron, 'selected_unit_metadata': selected_units,
              'systemd_local_directory_scope': local_units_scope,
              'selected_local_unit_files': [metadata(path) for path in local_units],
              'directory_scopes': scopes, 'known_root_artifact_metadata': artifacts,
              'postgres': postgres, 'service_metadata_before': before, 'service_metadata_after': after,
              'service_metadata_unchanged': before == after,
              'limits': {'backup_payloads_or_keys_read': False, 'cron_lines_command_argv_or_secrets_emitted': False,
                         'dump_capture_dates_encryption_and_retention_proven_from_mtime': False,
                         'entire_filesystem_or_remote_destinations_inventoried': False, 'symlinks_followed': False,
                         'HyperV_Windows_cloud_and_R2_consulted': False, 'R2_requests': 0, 'provider_requests': 0,
                         'VM_files_written': 0, 'data_mutations': 0, 'services_changed': False,
                         'journal_completeness_or_external_restore_proven': False, 'release_authorized': False}}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
