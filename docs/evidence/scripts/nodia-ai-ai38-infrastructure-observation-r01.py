"""Bounded metadata-only infrastructure observation; never reads backup/profile bytes.

Only known Nodia paths, selected unit metadata and executable locations are inspected.
No application imports, database access, secrets, object storage or provider calls.
"""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import shutil
import stat
import subprocess


def checked(argv):
    result = subprocess.run(argv, capture_output=True, check=False, timeout=30)
    assert result.returncode == 0, 'metadata_command_failed'
    return result.stdout.decode('utf-8')


def metadata(path):
    result = {'path': str(path), 'exists': False, 'contents_read': False}
    try:
        value = path.lstat()
    except FileNotFoundError:
        return result
    result.update(exists=True, kind='symlink' if stat.S_ISLNK(value.st_mode) else
                  'directory' if stat.S_ISDIR(value.st_mode) else 'file' if stat.S_ISREG(value.st_mode) else 'other',
                  mode=oct(value.st_mode & 0o777), uid=value.st_uid, gid=value.st_gid,
                  byte_count=value.st_size, modified_at_utc=datetime.fromtimestamp(value.st_mtime, timezone.utc).isoformat())
    return result


def directory(path, limit=100):
    result = metadata(path)
    if result.get('kind') != 'directory':
        return result
    entries = []
    for ordinal, item in enumerate(path.iterdir()):
        if ordinal >= limit:
            result['listing_truncated_at'] = limit
            break
        # Never open children, follow symlinks or descend into a profile/dump.
        child = metadata(item)
        child.pop('path')
        child['name'] = item.name if re.fullmatch(r'[A-Za-z0-9_.-]{1,160}', item.name) else '<name_omitted>'
        entries.append(child)
    result['immediate_entries'] = sorted(entries, key=lambda item: item['name'])
    result['listing_scope'] = 'immediate_children_only_no_recursive_search'
    return result


services_text = checked(['systemctl', 'list-unit-files', '--type=service', '--no-legend', '--no-pager'])
timers_text = checked(['systemctl', 'list-unit-files', '--type=timer', '--no-legend', '--no-pager'])
units = {}
for line in (services_text + '\n' + timers_text).splitlines():
    fields = line.split()
    if not fields:
        continue
    name = fields[0]
    if not re.fullmatch(r'[A-Za-z0-9_.@-]+\.(?:service|timer)', name):
        continue
    if not re.search(r'nodia|backup|restic|borg|pgbackrest|wal-g|rclone|delet|snapshot|logrotate|journald', name, re.I):
        continue
    if '@.' in name:
        units[name] = {'template_without_instance_not_queried': True}
        continue
    properties = subprocess.run(['systemctl', 'show', name, '--no-pager',
        '--property=LoadState,ActiveState,SubState,UnitFileState,FragmentPath,Result,LastTriggerUSec,NextElapseUSecRealtime'],
        capture_output=True, check=False, timeout=30)
    units[name] = dict(item.split('=', 1) for item in properties.stdout.decode('utf-8').splitlines() if '=' in item)
    units[name]['metadata_query_exit_code'] = properties.returncode

roots = [Path('/var/backups/nodia'), Path('/opt/nodia/verification-backups'), Path('/etc/nodia')]
directories = [directory(path) for path in roots]
# These exact paths are cited by the preserved migration/deployment scripts.
known_artifacts = [
    Path('/opt/nodia/verification-backups/ai33-1792349337883'),
    Path('/opt/nodia/verification-backups/ai33-1792349337883/configured-db-before.dump'),
    Path('/var/backups/nodia/nodia-inicial.dump'),
    Path('/opt/nodia/releases/nodia-server-ai15-20261016/scripts/prepare-nodia-ai-restore.mjs'),
    Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server/scripts/prepare-nodia-ai-restore.mjs'),
]
known = [metadata(path) for path in known_artifacts]
binaries = {name: shutil.which(name) for name in ('pg_dump', 'pg_restore', 'age', 'gpg', 'openssl',
             'restic', 'borg', 'pgbackrest', 'wal-g', 'rclone', 'systemctl', 'docker')}
native = json.loads(checked(['docker', 'inspect', '--format', '{{json .State}}', 'nodia-gemini-microservice']))
identity = checked(['docker', 'inspect', '--format', '{{.Id}} {{.Image}}', 'nodia-gemini-microservice']).split()
report = {'schema_version': 1, 'stage': 'AI-38', 'scope': 'bounded_VM_metadata_not_retention_backup_acceptance',
          'status': 'observed_infrastructure_gates_not_proven',
          'observed_at_VM_utc': datetime.now(timezone.utc).isoformat(),
          'systemd_selected_units': units, 'known_directory_metadata': directories,
          'known_artifact_metadata': known, 'host_executable_locations': binaries,
          'native_epoch': {'container_id': identity[0], 'image': identity[1],
                           'running': native['Running'], 'started_at': native['StartedAt']},
          'gates': {'encrypted_rotated_backups': 'not_proven_by_this_observation',
                    'trusted_continuous_deletion_journal': 'not_proven_by_this_observation',
                    'all_reconstructible_versions_inventory': 'not_proven_by_this_observation',
                    'external_operational_quarantine_restore': 'not_proven_by_this_observation'},
          'limits': {'filesystem_search': 'three_known_roots_immediate_children_and_five_explicit_paths',
                     'cron_hypervisor_host_backup_external_services_searched': False,
                     'absence_is_not_global_nonexistence_proof': True,
                     'dump_profile_env_object_contents_read': False, 'binary_execution': False,
                     'database_queries': 0, 'provider_requests': 0, 'R2_requests': 0,
                     'services_restarted': False, 'data_writes': 0, 'remote_files_written': False}}
print(json.dumps(report, indent=2))
