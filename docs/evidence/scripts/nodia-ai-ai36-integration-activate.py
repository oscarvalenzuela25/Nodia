"""Prepare or activate exactly the two reviewed AI-36 runtime JavaScript files.

No migrations, publication, environment, native restart, generations or cloud IO.
Preparation is read-only on the activated release; activate needs explicit GO.
"""
from __future__ import annotations
import datetime
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys
import urllib.request

mode, attempt = sys.argv[1:3]
assert mode in ('prepare', 'activate') and re.fullmatch(r'attempt[0-9]{2}', attempt)
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
candidate = Path('/opt/nodia/verification/ai36-regressions-' + attempt) / 'nodia-server'
receipt = candidate / '.tmp/ai36-runtime-activation-plan.json'
paths = ['dist/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.js', 'dist/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.js']
baseline = Path('/tmp/nodia-ai35-runtime-candidate/.tmp/ai35-runtime-candidate-manifest.json')
expected_image = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
expected_pin = 'b4a790219b41687d2bc4ac7ad70f436d5b9a3aa83cbdfc812533a06f8027dc23'
os.umask(0o077)

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=40).stdout.strip()

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def manifest():
    return {file.relative_to(runtime).as_posix(): digest(file) for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}

def quiet():
    result = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert result['migrations'] == 29 and all(result[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
    return result

def native():
    identity = run(['docker', 'inspect', 'nodia-gemini-microservice', '--format', '{{.Id}} {{.Image}}'])
    assert identity.split()[1] == expected_image
    counts = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    selected = {key: counts[key] for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')}
    assert all(value == 0 for value in selected.values())
    return {'container_id': identity.split()[0], 'image': expected_image, 'artifact_counts': selected}

def chat():
    result = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert result['status'] == 'passed' and 'cloud_reads' not in result
    result.pop('observed_at_utc', None)
    result.pop('completed_at_utc', None)
    return result

def health():
    units = {name: run(['systemctl', 'is-active', name]) for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    assert all(value == 'active' for value in units.values())
    statuses = {}
    for name, address in (('api', 'http://127.0.0.1:3000/api/v1/'), ('native', 'http://127.0.0.1:8000/health'), ('proxy', 'http://127.0.0.1:8080/api/v1/')):
        for trial in range(30):
            try:
                with urllib.request.urlopen(address, timeout=3) as response:
                    statuses[name] = response.status
                break
            except Exception:
                if trial == 29:
                    raise
                import time
                time.sleep(0.5)
        assert statuses[name] == 200
    return {'units': units, 'http': statuses}

def pin():
    assert json.loads((runtime / 'dist/nodia-ai-context/config/knowledge-pin.json').read_text())['release_id'] == expected_pin
    assert json.loads((runtime / 'dist/nodia-ai/knowledge/manifest.json').read_text())['release_id'] == expected_pin

def replace(source, relative):
    assert relative in paths
    target = (runtime / relative).resolve()
    assert target.is_relative_to(runtime.resolve()) and target.is_file()
    temporary = target.with_name(target.name + '.ai36-replace-' + str(os.getpid()))
    with temporary.open('xb') as output:
        output.write(source.read_bytes())
        output.flush()
        os.fsync(output.fileno())
    owner = pwd.getpwnam('nodia')
    os.chown(temporary, owner.pw_uid, owner.pw_gid)
    os.chmod(temporary, 0o644)
    os.replace(temporary, target)

if mode == 'prepare':
    assert not receipt.exists()
    original = json.loads(baseline.read_text())
    assert manifest() == original and len(original) == 932
    staged = json.loads((candidate / '.tmp/ai36-regressions-stage-manifest.json').read_text())
    other_drift = [relative for relative, expected in original.items()
                   if relative not in paths and Path(relative).suffix in ('.js', '.json', '.md')
                   and staged['files'].get(relative) != expected]
    assert not other_drift, other_drift
    for relative in paths:
        assert digest(candidate / relative) == staged['files'][relative]
        assert original[relative] != staged['files'][relative]
    expected = dict(original)
    expected.update({relative: staged['files'][relative] for relative in paths})
    pin()
    plan = {'stage': 'AI-36', 'status': 'prepared_not_activated', 'attempt': attempt, 'created_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'paths': paths, 'before': original, 'after': expected, 'sql_quiet': quiet(), 'native': native(), 'protected_chat': chat(), 'health': health(), 'provider_generations': 0, 'storage_operations': 0, 'configured_database_writes': 0, 'services_restarted': False}
    receipt.write_text(json.dumps(plan, indent=2) + '\n')
    print(json.dumps({key: value for key, value in plan.items() if key not in ('before', 'after', 'protected_chat')}, indent=2))
    sys.exit(0)

plan = json.loads(receipt.read_text())
assert plan['status'] == 'prepared_not_activated' and plan['attempt'] == attempt
assert manifest() == plan['before'] and native() == plan['native'] and chat() == plan['protected_chat']
pin()
quiet()
for relative in paths:
    assert digest(candidate / relative) == plan['after'][relative]
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/var/backups/nodia/ai36-runtime-' + stamp + '-' + str(os.getpid()))
backup.mkdir(mode=0o700, parents=True, exist_ok=False)
for relative in paths:
    destination = backup / relative
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    shutil.copyfile(runtime / relative, destination)
    os.chmod(destination, 0o600)
assert all(digest(backup / relative) == plan['before'][relative] for relative in paths)
(backup / 'before-manifest.json').write_text(json.dumps(plan['before'], indent=2) + '\n')
stopped = changed = False
result = {'stage': 'AI-36', 'scope': 'two_javascript_files_scoped_lab_activation', 'attempt': attempt, 'backup_directory': str(backup), 'provider_generations': 0, 'provider_metadata_requests': 0, 'storage_operations': 0, 'configured_database_writes': 0, 'migrations_run': 0, 'native_restarted': False, 'publication_changed': False}
try:
    stopped = True  # A partially failed stop must restart both unchanged services.
    run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'])
    quiet()
    for relative in paths:
        replace(candidate / relative, relative)
        changed = True
    assert manifest() == plan['after']
    run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'])
    stopped = False
    result.update(health())
    assert native() == plan['native'] and chat() == plan['protected_chat']
    pin()
    result.update(sql_quiet=quiet(), configured_chat_preserved=True, native_container_unchanged=True, compiled_files_verified=932, changed_paths=paths, status='passed', services_restarted=['nodia-api', 'nodia-ai-worker'])
    output_manifest = candidate / '.tmp/ai36-runtime-candidate-manifest.json'
    output_manifest.write_text(json.dumps(plan['after'], indent=2) + '\n')
    result['compiled_manifest_sha256'] = digest(output_manifest)
except Exception:
    if changed:
        run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'])
        for relative in paths:
            replace(backup / relative, relative)
        assert manifest() == plan['before']
    if changed or stopped:
        run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'])
    result.update(health())
    result.update(status='failed_rolled_back' if changed else 'failed_before_change', rollback_verified=manifest() == plan['before'], services_restarted=['nodia-api', 'nodia-ai-worker'])
result['completed_at_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
(candidate / '.tmp/ai36-runtime-activation-result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
sys.exit(0 if result['status'] == 'passed' else 1)
