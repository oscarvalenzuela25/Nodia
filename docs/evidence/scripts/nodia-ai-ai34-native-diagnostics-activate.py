"""Explicit native-only diagnostic activation. No migration, Node writes or inference."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

assert len(sys.argv) == 4 and sys.argv[1] == '--activate-ai34-native-diagnostics'
candidate_image, manifest_hash = sys.argv[2:]
assert candidate_image.startswith('sha256:') and len(candidate_image) == 71
assert len(manifest_hash) == 64
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
native = Path('/opt/nodia/nodia-gemini-microservice')
manifest = Path('/tmp/ai34-native-diagnostics-manifest.json')
expected_before = 'sha256:51336b00cb766e5e0031c06e1b2d17ce197b9b01c3d0ae6163785b2a567b8e52'

def run(args, timeout=30):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def quiet():
    result = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert result['migrations'] == 28 and all(result[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
    return result

def native_quiet():
    result = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
    assert all(result[key] == 0 for key in keys)
    return {key: result[key] for key in keys}

def current():
    return {file.relative_to(runtime).as_posix(): digest(file) for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}

def envmeta(file):
    value = file.stat()
    return digest(file), value.st_uid, value.st_gid, value.st_mode

def inspect():
    return json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]

def signature(container):
    return {'user': container['Config']['User'], 'mounts': sorted((mount['Type'], mount.get('Source', ''), mount['Destination'], mount.get('RW')) for mount in container['Mounts']), 'isolation': {key: container['HostConfig'].get(key) for key in ('Memory', 'MemorySwap', 'NanoCpus', 'PidsLimit', 'ShmSize', 'SecurityOpt', 'CapAdd', 'CapDrop', 'NetworkMode', 'CgroupnsMode', 'Privileged', 'PortBindings')}}

def chat():
    result = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert result['status'] == 'passed' and 'cloud_reads' not in result
    return {key: result[key] for key in ('total_attachment_rows', 'messages', 'message_parts', 'conversation', 'attachment_parts', 'runs', 'jobs', 'attempts', 'attachments', 'expected_synthetic_fixture_matches')}

def ready():
    for _ in range(45):
        try:
            assert all(run(['systemctl', 'is-active', name]) == 'active' for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'))
            for url in ('http://127.0.0.1:3000/api/v1/', 'http://127.0.0.1:8000/health', 'http://127.0.0.1:8080/api/v1/'):
                with urllib.request.urlopen(url, timeout=2) as response:
                    assert response.status == 200
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError('readiness_failed')

report = {'stage': 'AI-34', 'scope': 'native_only_safe_diagnostics_activation', 'status': 'running', 'provider_generations': 0, 'schema_migrations_applied': 0, 'node_files_written': 0, 'settings_changed': False, 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
stopped = native_changed = False
phase = 'preflight'
try:
    assert digest(manifest) == manifest_hash and len(json.loads(manifest.read_text())) == 98
    parity = json.loads(run(['python3', '/tmp/nodia-ai-ai34-native-source-verify.py', 'image', candidate_image, str(manifest)]))
    assert parity['status'] == 'passed' and parity['files'] == 98 and parity['drift_count'] == 0
    before = current()
    expected = json.loads(Path('/tmp/nodia-ai34-runtime-candidate/.tmp/ai34-runtime-candidate-manifest.json').read_text())
    assert before == expected and len(before) == 931
    baseline, native_before, chat_before = quiet(), native_quiet(), chat()
    previous = inspect()
    assert previous['Image'] == expected_before and previous['State']['Running']
    old_signature = signature(previous)
    old_env = envmeta(native / '.env'), envmeta(runtime / '.env')
    nginx = run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value'])
    backup = Path('/opt/nodia/verification-backups') / ('ai34-native-diagnostics-' + str(int(time.time() * 1000)))
    backup.mkdir(mode=0o700)
    (backup / 'native-before.json').write_text(json.dumps({'image': expected_before, 'signature': old_signature}, indent=2))
    (backup / 'dist-manifest-before.json').write_text(json.dumps(before, indent=2))
    (backup / 'configured-chat-before.json').write_text(json.dumps(chat_before, indent=2))
    (backup / 'native-candidate-source-manifest.json').write_bytes(manifest.read_bytes())
    run(['docker', 'tag', expected_before, 'nodia-ai34-gemini-before-diagnostics:' + backup.name.rsplit('-', 1)[1]])
    phase = 'stop_admissions'
    stopped = True
    run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
    quiet(); native_quiet()
    assert current() == before and chat() == chat_before
    phase = 'activate_native_only'
    native_changed = True
    run(['docker', 'tag', candidate_image, 'nodia-gemini-lab-nodia-gemini-microservice'])
    run(['systemctl', 'restart', 'nodia-gemini-lab'], 150)
    container = inspect()
    assert container['Image'] == candidate_image and container['State']['Running'] and signature(container) == old_signature
    assert (envmeta(native / '.env'), envmeta(runtime / '.env')) == old_env
    phase = 'start_admissions'
    run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60)
    ready(); stopped = False
    phase = 'postflight'
    final, native_after = quiet(), native_quiet()
    parity = json.loads(run(['python3', '/tmp/nodia-ai-ai34-native-source-verify.py', 'container', 'nodia-gemini-microservice', str(manifest)]))
    assert parity['files'] == 98 and parity['drift_count'] == 0
    assert current() == before and chat() == chat_before
    assert (envmeta(native / '.env'), envmeta(runtime / '.env')) == old_env
    assert signature(inspect()) == old_signature
    assert run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value']) == nginx
    report.update(status='passed', native_image_before=expected_before, native_image_after=candidate_image, backup_directory=str(backup), source_manifest_sha256=manifest_hash, source_files_verified=98, source_drift_count=0, compiled_files_unchanged=931, api_and_worker_restarted=True, native_restarted=True, environment_mounts_isolation_preserved=True, nginx_identity_preserved=True, configured_chat_preserved=True, quiet_before=baseline, quiet_after=final, native_artifact_counts=native_after)
except Exception:
    report.update(status='failed', safe_failure_phase=phase)
    safe_to_restore = True
    try:
        quiet(); native_quiet()
    except Exception:
        safe_to_restore = False
        report['rollback_deferred_due_to_nonterminal_activity'] = True
    if safe_to_restore:
        try:
            if stopped or native_changed:
                run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
            if native_changed:
                run(['docker', 'tag', expected_before, 'nodia-gemini-lab-nodia-gemini-microservice'])
                run(['systemctl', 'restart', 'nodia-gemini-lab'], 150)
                assert inspect()['Image'] == expected_before
                report['native_image_rolled_back'] = True
            if stopped or native_changed:
                run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready()
                report['services_recovered'] = True
        except Exception:
            report['services_recovered'] = False
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
Path('/tmp/ai34-native-diagnostics-activation-result.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
