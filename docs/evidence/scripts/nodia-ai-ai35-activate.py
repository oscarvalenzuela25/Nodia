"""Explicit AI-35 lab rollout: private backup, exact index, API/worker only."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request

assert len(sys.argv) == 4 and sys.argv[1] == '--activate-ai35'
packet_hash, candidate_hash = sys.argv[2:]
assert all(len(value) == 64 for value in (packet_hash, candidate_hash))
os.umask(0o077)
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
native = Path('/opt/nodia/nodia-gemini-microservice')
packet = Path('/tmp/ai35-runtime-packet.tar')
stage = Path('/tmp/nodia-ai35-runtime-candidate')
expected_native = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'

def run(args, timeout=30):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def current():
    return {file.relative_to(runtime).as_posix(): digest(file) for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}

def quiet():
    value = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert all(value[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
    native_value = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
    assert all(native_value[key] == 0 for key in keys)
    return {'sql': value, 'native': {key: native_value[key] for key in keys}}

def native_identity():
    container = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert container['Image'] == expected_native and container['State']['Running']
    return {key: container[key] for key in ('Id', 'Image', 'Mounts', 'HostConfig')} | {'started_at': container['State']['StartedAt'], 'user': container['Config']['User']}

def environment():
    return [(digest(file), file.stat().st_uid, file.stat().st_gid, file.stat().st_mode) for file in (runtime / '.env', native / '.env')]

def chat():
    value = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert value['status'] == 'passed' and 'cloud_reads' not in value
    return {key: value[key] for key in ('total_attachment_rows', 'messages', 'message_parts', 'conversation', 'attachment_parts', 'runs', 'jobs', 'attempts', 'attachments', 'expected_synthetic_fixture_matches')}

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

def install(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    old = target.stat() if target.exists() else (runtime / 'dist/main.js').stat()
    temporary = target.with_name(target.name + '.ai35')
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(source.read_bytes()); output.flush(); os.fsync(output.fileno())
            os.fchown(output.fileno(), old.st_uid, old.st_gid); os.fchmod(output.fileno(), old.st_mode & 0o777)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()

report = {'stage': 'AI-35', 'scope': 'additive_search_index_api_worker_lab_activation', 'status': 'running',
    'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'provider_generations': 0, 'provider_metadata_requests': 0,
    'storage_operations': 0, 'configuration_modified': False, 'native_restarted': False, 'profile_bytes_read': False,
    'packet_sha256': packet_hash, 'activation_script_sha256': digest(Path(__file__)),
    'migration_script_sha256': digest(Path('/tmp/nodia-ai-ai35-migrate.mjs'))}
phase = 'packet_preflight'
stopped = changed = False
backup = None
try:
    assert digest(packet) == packet_hash
    stage.mkdir(mode=0o700, exist_ok=False)
    with tarfile.open(packet) as bundle:
        for member in bundle.getmembers():
            relative = PurePosixPath(member.name)
            assert member.isfile() and not relative.is_absolute() and '..' not in relative.parts and relative.parts[0] in ('dist', '.tmp')
        bundle.extractall(stage, filter='data')
    manifest_path = stage / '.tmp/ai35-runtime-candidate-manifest.json'
    assert digest(manifest_path) == candidate_hash
    expected = json.loads(manifest_path.read_text())
    before = json.loads((stage / '.tmp/ai35-runtime-before-manifest.json').read_text())
    assert len(before) == 931 and len(expected) == 932 and current() == before and set(before) < set(expected)
    differences = sorted(name for name in before if before[name] != expected[name])
    added = sorted(set(expected) - set(before))
    assert added == ['dist/migrations/1793100000000-AddNodiaAiTextSearchIndex.js']
    for name in expected:
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0] == 'dist'
    for name in differences + added:
        assert digest(stage / name) == expected[name]
    baseline = quiet(); assert baseline['sql']['migrations'] == 28
    native_before, environment_before, chat_before = native_identity(), environment(), chat()
    nginx = run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value'])
    old_knowledge = json.loads((runtime / 'dist/nodia-ai/knowledge/manifest.json').read_text())
    new_knowledge_path = stage / 'dist/nodia-ai/knowledge/manifest.json'
    new_knowledge = json.loads(new_knowledge_path.read_text()) if new_knowledge_path.exists() else old_knowledge
    for key, count in (('fragments', 27), ('capability_contracts', 67)):
        assert new_knowledge[key] == old_knowledge[key] and len(new_knowledge[key]) == count
    backup = Path('/opt/nodia/verification-backups') / ('ai35-' + str(int(time.time() * 1000)))
    backup.mkdir(mode=0o700)
    (backup / 'dist-manifest-before.json').write_text(json.dumps(before, indent=2))
    (backup / 'configured-chat-before.json').write_text(json.dumps(chat_before, indent=2))
    shutil.copytree(runtime / 'dist', backup / 'dist', copy_function=shutil.copy2)
    assert {file.relative_to(backup).as_posix(): digest(file) for file in (backup / 'dist').rglob('*') if file.is_file()} == before
    phase = 'stop_api_worker'; stopped = True
    run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
    assert quiet()['sql']['migrations'] == 28 and current() == before and chat() == chat_before
    phase = 'private_backup_and_exact_migration'
    migration_process = subprocess.run(['/usr/local/bin/node', '/tmp/nodia-ai-ai35-migrate.mjs', str(backup)], check=False, capture_output=True, text=True, timeout=120)
    migration = json.loads(migration_process.stdout); report['migration'] = migration
    (backup / 'migration.json').write_text(json.dumps(migration, indent=2))
    assert migration_process.returncode == 0 and migration['status'] == 'passed'
    phase = 'install_incremental_node'; changed = True
    for name in differences + added:
        install(stage / name, runtime / name)
    assert current() == expected
    phase = 'start_api_worker'
    run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready(); stopped = False
    phase = 'postflight'
    final = quiet(); assert final['sql']['migrations'] == 29
    pin = json.loads((runtime / 'dist/nodia-ai-context/config/knowledge-pin.json').read_text())
    assert pin['release_id'] == new_knowledge['release_id']
    assert current() == expected and chat() == chat_before and native_identity() == native_before and environment() == environment_before
    assert run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value']) == nginx
    report.update(status='passed', compiled_files_verified=len(expected), previous_compiled_files_verified=len(before), changed_paths=differences,
        added_output_paths=added, compiled_manifest_sha256=candidate_hash, backup_directory=str(backup), api_and_worker_restarted=True,
        native_image=expected_native, native_container_identity_preserved=True, environment_mounts_isolation_preserved=True,
        nginx_identity_preserved=True, configured_chat_preserved=True, quiet_before=baseline, quiet_after=final,
        knowledge_release_before=old_knowledge['release_id'], knowledge_release=pin['release_id'], published_fragments_unchanged=27, published_capabilities_unchanged=67)
except Exception:
    report.update(status='failed', safe_failure_phase=phase, additive_schema_retained_if_applied=True)
    safe_to_restore = True
    try:
        quiet()
    except Exception:
        safe_to_restore = False; report['rollback_deferred_due_to_nonterminal_activity'] = True
    if safe_to_restore:
        try:
            if stopped or changed:
                run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
            if changed:
                for name in differences:
                    install(backup / name, runtime / name)
                for name in added:
                    if (runtime / name).exists():
                        (runtime / name).unlink()
                assert current() == before; report['compiled_code_rolled_back'] = True
            if stopped or changed:
                run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready(); report['services_recovered'] = True
        except Exception:
            report['services_recovered'] = False
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
Path('/tmp/ai35-activation-result.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
