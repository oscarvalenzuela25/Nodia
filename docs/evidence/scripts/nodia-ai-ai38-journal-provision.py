"""Private operator stdin -> new mode-0600 recovery config; never emit secret bytes."""
from pathlib import Path
import hashlib
import json
import os
import pwd
import subprocess
import sys

payload = json.load(sys.stdin)
assert set(payload) == {'era_id', 'deployment_id', 'public_key_pem', 'journal_encryption_key'}
assert payload['deployment_id'] == 'linux-lab-20261020-r01'
base = Path('/etc/nodia-ai-recovery')
spool = Path('/var/lib/nodia-ai-recovery/spool')
assert not base.exists() and not spool.parent.exists(), 'refuse_existing_operator_configuration'
identity = pwd.getpwnam('nodia')
original = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
code = "const fs=require('fs'); const values=require('dotenv').parse(fs.readFileSync('.env')); process.stdout.write(JSON.stringify(values));"
result = subprocess.run(['/usr/local/bin/node', '-e', code], cwd=original, capture_output=True, check=True, timeout=10)
values = json.loads(result.stdout)
required = ['R2_BUCKET_NAME', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
            'POSTGRES_DB', 'POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD']
assert all(isinstance(values.get(name), str) and values[name] for name in required)
assert Path('/usr/lib/postgresql/16/bin/pg_dump').is_file()
release = Path('/opt/nodia/releases/nodia-server-ai38-journal-r01')
assert (release / 'scripts/nodia-ai-journal.mjs').is_file()
base.mkdir(mode=0o750)
os.chown(base, 0, identity.pw_gid)
spool.parent.mkdir(mode=0o700)
os.chown(spool.parent, identity.pw_uid, identity.pw_gid)
spool.mkdir(mode=0o700)
os.chown(spool, identity.pw_uid, identity.pw_gid)
config = {'schema_version': 1, 'deployment_id': payload['deployment_id'], 'era_id': payload['era_id'],
          'endpoint': values.get('R2_ENDPOINT') or 'https://' + values['R2_ACCOUNT_ID'] + '.r2.cloudflarestorage.com',
          'bucket': values['R2_BUCKET_NAME'], 'access_key_id': values['R2_ACCESS_KEY_ID'],
          'secret_access_key': values['R2_SECRET_ACCESS_KEY'], 'journal_encryption_key': payload['journal_encryption_key']}
backup = {'recovery_config': str(base / 'recovery.json'), 'public_key_file': str(base / 'backup-public.pem'),
          'spool_directory': str(spool), 'pg_dump_binary': '/usr/lib/postgresql/16/bin/pg_dump',
          'database': {'host': values['POSTGRES_HOST'], 'port': int(values.get('POSTGRES_PORT', '5432')),
                       'username': values['POSTGRES_USER'], 'password': values['POSTGRES_PASSWORD'], 'database': values['POSTGRES_DB']},
          'max_dump_bytes': 268435456, 'timeout_seconds': 180}
for path, text, mode, owner in [
    (base / 'recovery.json', json.dumps(config), 0o600, identity.pw_uid),
    (base / 'backup.json', json.dumps(backup), 0o600, identity.pw_uid),
    (base / 'backup-public.pem', payload['public_key_pem'], 0o644, identity.pw_uid),
    (base / 'backup-runner.env', 'NODIA_AI_BACKUP_SCRIPT=' + str(release / 'scripts/nodia-ai-backups.mjs') + '\n'
     + 'NODIA_AI_JOURNAL_SCRIPT=' + str(release / 'scripts/nodia-ai-journal.mjs') + '\n'
     + 'NODIA_AI_BACKUP_CONFIG=' + str(base / 'backup.json') + '\n'
     + 'NODIA_AI_RECOVERY_CONFIG=' + str(base / 'recovery.json') + '\n', 0o600, 0),
]:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        os.write(fd, text.encode()); os.fsync(fd)
    finally:
        os.close(fd)
    os.chown(path, owner, identity.pw_gid)
print(json.dumps({'stage': 'AI-38', 'status': 'private_configuration_provisioned_not_activated',
                  'era_id': payload['era_id'], 'deployment_id': payload['deployment_id'],
                  'public_key_sha256': hashlib.sha256(payload['public_key_pem'].encode()).hexdigest(),
                  'private_backup_key_in_VM': False, 'secrets_emitted': False,
                  'service_changes': 0, 'R2_operations': 0, 'configured_SQL_writes': 0}))
