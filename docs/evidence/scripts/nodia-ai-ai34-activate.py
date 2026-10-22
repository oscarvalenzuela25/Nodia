"""Explicit lab activation only: additive schema, measured native adapter, then API/worker."""
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

assert len(sys.argv) == 5 and sys.argv[1] == '--activate-ai34'
packet_hash, manifest_hash, candidate_image = sys.argv[2:]
assert candidate_image.startswith('sha256:') and len(candidate_image) == 71
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
native = Path('/opt/nodia/nodia-gemini-microservice')
stage = Path('/tmp/nodia-ai34-runtime-candidate')
packet = Path('/tmp/ai34-runtime-packet.tar')


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def run(args, timeout=30):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()


def current():
    return {file.relative_to(runtime).as_posix(): digest(file) for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}


def quiet():
    result = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert all(result[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
    return result


def native_quiet():
    result = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
    assert all(result[key] == 0 for key in keys)
    return {key: result[key] for key in keys}


def chat():
    result = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert result['status'] == 'passed' and 'cloud_reads' not in result
    return {key: result[key] for key in ('total_attachment_rows', 'messages', 'message_parts', 'conversation', 'attachment_parts', 'runs', 'jobs', 'attempts', 'attachments', 'expected_synthetic_fixture_matches')}


def ready():
    for _ in range(45):
        try:
            assert run(['systemctl', 'is-active', 'nodia-api']) == 'active'
            assert run(['systemctl', 'is-active', 'nodia-ai-worker']) == 'active'
            with urllib.request.urlopen('http://127.0.0.1:3000/api/v1/', timeout=2) as response:
                assert response.status == 200
            with urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2) as response:
                assert response.status == 200
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError('readiness_failed')


def inspect():
    return json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]


def signature(container):
    return {'user': container['Config']['User'], 'mounts': sorted((mount['Type'], mount.get('Source', ''), mount['Destination'], mount.get('RW')) for mount in container['Mounts']), 'isolation': {key: container['HostConfig'].get(key) for key in ('Memory', 'MemorySwap', 'NanoCpus', 'PidsLimit', 'ShmSize', 'SecurityOpt', 'CapAdd', 'CapDrop', 'NetworkMode', 'CgroupnsMode', 'Privileged', 'PortBindings')}}


def envmeta(file):
    metadata = file.stat()
    return (digest(file), metadata.st_uid, metadata.st_gid, metadata.st_mode)


def install(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    previous = target.stat() if target.exists() else (runtime / 'dist/main.js').stat()
    temporary = target.with_name(target.name + '.ai34')
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(source.read_bytes()); output.flush(); os.fsync(output.fileno())
            os.fchown(output.fileno(), previous.st_uid, previous.st_gid)
            os.fchmod(output.fileno(), previous.st_mode & 0o777)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()


report = {'stage': 'AI-34', 'scope': 'additive_M4_measured_context_lab_activation', 'status': 'running', 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'provider_generations': 0, 'provider_metadata_requests': 0, 'r2_object_operations': 0, 'configuration_modified': False, 'profile_files_copied_or_hashed': False}
phase = 'preflight'
stopped = changed = native_changed = migrated = False
backup = None
try:
    assert digest(packet) == packet_hash
    stage.mkdir(mode=0o700, exist_ok=False)
    with tarfile.open(packet) as bundle:
        for member in bundle.getmembers():
            relative = PurePosixPath(member.name)
            assert not relative.is_absolute() and '..' not in relative.parts and not member.issym() and not member.islnk() and relative.parts[0] in ('dist', '.tmp')
        bundle.extractall(stage, filter='data')
    manifest_path = stage / '.tmp/ai34-runtime-candidate-manifest.json'
    assert digest(manifest_path) == manifest_hash
    manifest = json.loads(manifest_path.read_text())
    before = json.loads((stage / '.tmp/ai34-runtime-before-manifest.json').read_text())
    assert len(before) == 923 and len(manifest) > len(before) and current() == before
    differences = sorted(name for name in before if before[name] != manifest[name])
    added = sorted(set(manifest) - set(before))
    assert set(before) <= set(manifest)
    for name in differences + added:
        assert digest(stage / name) == manifest[name]
    assert not any('.fixture' in name or name.endswith('.map') or name.endswith('.d.ts') for name in added)
    baseline = quiet(); assert baseline['migrations'] == 27
    native_before = native_quiet(); chat_before = chat()
    previous_native = inspect(); old_image = previous_native['Image']
    assert previous_native['State']['Running']
    assert run(['docker', 'image', 'inspect', 'nodia-gemini-ai34-candidate:20261018', '--format', '{{.Id}}']) == candidate_image
    old_signature = signature(previous_native)
    old_native_env, old_server_env = envmeta(native / '.env'), envmeta(runtime / '.env')
    nginx = run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value'])
    backup = Path('/opt/nodia/verification-backups') / ('ai34-' + str(int(time.time() * 1000)))
    backup.mkdir(mode=0o700)
    (backup / 'dist-manifest-before.json').write_text(json.dumps(before, indent=2))
    (backup / 'configured-chat-before.json').write_text(json.dumps(chat_before, indent=2))
    (backup / 'native-before.json').write_text(json.dumps({'old_image': old_image, 'signature': old_signature}, indent=2))
    run(['docker', 'tag', old_image, 'nodia-ai34-gemini-before:' + backup.name[5:]])
    for name in differences:
        (backup / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(runtime / name, backup / name)
    phase = 'stop_api_worker'; stopped = True
    run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
    quiet(); native_quiet(); assert current() == before and chat() == chat_before
    phase = 'backup_and_additive_schema'
    migration = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai-ai34-migrate.mjs', str(backup)], 100))
    assert migration['status'] == 'passed'; migrated = True
    (backup / 'migration.json').write_text(json.dumps(migration, indent=2)); report['migration'] = migration
    phase = 'activate_measured_native_adapter'; native_changed = True
    run(['docker', 'tag', candidate_image, 'nodia-gemini-lab-nodia-gemini-microservice'])
    run(['systemctl', 'restart', 'nodia-gemini-lab'], 150)
    now_native = inspect()
    assert now_native['Image'] == candidate_image and now_native['State']['Running'] and signature(now_native) == old_signature
    assert envmeta(native / '.env') == old_native_env
    phase = 'install_additive_server_outputs'; changed = True
    for name in differences + added:
        install(stage / name, runtime / name)
    assert current() == manifest
    phase = 'start_api_worker'
    run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready(); stopped = False
    phase = 'postflight'
    final = quiet(); assert final['migrations'] == 28
    native_after = native_quiet(); chat_after = chat()
    assert current() == manifest and envmeta(runtime / '.env') == old_server_env and envmeta(native / '.env') == old_native_env and chat_after == chat_before
    assert signature(inspect()) == old_signature
    assert run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value']) == nginx
    report.update(status='passed', compiled_files_verified=len(manifest), previous_compiled_files_verified=len(before), changed_paths=differences, added_output_paths=added, compiled_manifest_sha256=digest(manifest_path), backup_directory=str(backup), api_and_worker_restarted=True, gemini_restarted=True, native_image_before=old_image, native_image_after=candidate_image, native_mounts_limits_namespace_preserved=True, nginx_identity_preserved=True, server_and_native_environment_unchanged=True, quiet_before=baseline, quiet_after=final, native_runtime_artifact_counts=native_after, configured_chat_preserved=True, configured_chat_metadata_sha256=hashlib.sha256(json.dumps(chat_after, sort_keys=True, separators=(',', ':')).encode()).hexdigest())
except Exception:
    report.update(status='failed', safe_failure_phase=phase, migration_applied=migrated)
    safe_to_restore = True
    try:
        quiet()
        native_quiet()
    except Exception:
        safe_to_restore = False
        report['rollback_deferred_due_to_nonterminal_activity'] = True
    if safe_to_restore:
        try:
            if stopped or changed or native_changed:
                run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
            if changed:
                for name in differences:
                    install(backup / name, runtime / name)
                for name in added:
                    if (runtime / name).exists():
                        (runtime / name).unlink()
                assert current() == before
                report['compiled_code_rolled_back'] = True
            if native_changed:
                run(['docker', 'tag', old_image, 'nodia-gemini-lab-nodia-gemini-microservice'])
                run(['systemctl', 'restart', 'nodia-gemini-lab'], 150)
                assert inspect()['Image'] == old_image
                report['native_image_rolled_back'] = True
            if stopped or changed or native_changed:
                run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready()
                report['services_recovered'] = True
        except Exception:
            report['services_recovered'] = False
    report['additive_schema_retained_if_applied'] = True
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
Path('/tmp/ai34-activation-result.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
