"""Explicit two-JSON knowledge metadata refresh. Native image/code/schema stay intact."""
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

assert len(sys.argv) == 4 and sys.argv[1] == '--refresh-ai34-metadata'
packet_hash, candidate_hash = sys.argv[2:]
assert all(len(value) == 64 for value in (packet_hash, candidate_hash))
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
native = Path('/opt/nodia/nodia-gemini-microservice')
packet = Path('/tmp/ai34-metadata-packet.tar')
stage = Path('/tmp/nodia-ai34-metadata-candidate')
before_file = Path('/tmp/ai34-runtime-node-before-metadata.json')
expected_native_image = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
allowed_changes = ['dist/nodia-ai-context/config/knowledge-pin.json', 'dist/nodia-ai/knowledge/manifest.json']

def run(args, timeout=30):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def current():
    return {file.relative_to(runtime).as_posix(): digest(file) for file in (runtime / 'dist').rglob('*') if file.is_file()}

def quiet():
    value = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert value['migrations'] == 28 and all(value[key] == 0 for key in ('pending_jobs', 'open_attempts', 'held_or_unknown_slots'))
    native_value = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    native_keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')
    assert all(native_value[key] == 0 for key in native_keys)
    return {'sql': value, 'native': {key: native_value[key] for key in native_keys}}

def schema():
    return json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai-ai34-schema-observation.mjs']))

def chat():
    value = json.loads(run(['/usr/local/bin/node', '/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert value['status'] == 'passed' and 'cloud_reads' not in value
    return {key: value[key] for key in ('total_attachment_rows', 'messages', 'message_parts', 'conversation', 'attachment_parts', 'runs', 'jobs', 'attempts', 'attachments', 'expected_synthetic_fixture_matches')}

def native_identity():
    value = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert value['Image'] == expected_native_image and value['State']['Running']
    return {'id': value['Id'], 'image': value['Image'], 'started_at': value['State']['StartedAt'], 'user': value['Config']['User'], 'mounts': value['Mounts'], 'host_config': value['HostConfig']}

def environment_metadata():
    result = []
    for file in (runtime / '.env', native / '.env'):
        value = file.stat()
        result.append((digest(file), value.st_uid, value.st_gid, value.st_mode))
    return result

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
    previous = target.stat()
    temporary = target.with_name(target.name + '.ai34-metadata')
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(source.read_bytes()); output.flush(); os.fsync(output.fileno())
            os.fchown(output.fileno(), previous.st_uid, previous.st_gid); os.fchmod(output.fileno(), previous.st_mode & 0o777)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()

report = {'stage': 'AI-34', 'scope': 'two_json_published_knowledge_metadata_refresh', 'status': 'running', 'provider_generations': 0, 'schema_migrations_applied': 0, 'native_restarted': False, 'node_executable_code_changed': False, 'settings_changed': False, 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
stopped = changed = False
phase = 'preflight'
try:
    assert digest(before_file) == '0d7e3ade11f4a40695ebae89a597c606480f8818d22aca61d42bcb3eff78bc2c'
    before = json.loads(before_file.read_text())
    assert len(before) == 931 and current() == before and digest(packet) == packet_hash
    stage.mkdir(mode=0o700)
    with tarfile.open(packet) as bundle:
        for member in bundle.getmembers():
            relative = PurePosixPath(member.name)
            assert not relative.is_absolute() and '..' not in relative.parts and not member.issym() and not member.islnk() and relative.parts[0] in ('dist', '.tmp')
        bundle.extractall(stage, filter='data')
    candidate_file = stage / '.tmp/ai34-runtime-candidate-manifest.json'
    assert digest(candidate_file) == candidate_hash
    expected = json.loads(candidate_file.read_text())
    assert expected.keys() == before.keys() and sorted(name for name in before if before[name] != expected[name]) == allowed_changes
    for name in allowed_changes:
        assert digest(stage / name) == expected[name]
    old_knowledge = json.loads((runtime / allowed_changes[1]).read_text())
    new_knowledge = json.loads((stage / allowed_changes[1]).read_text())
    new_pin = json.loads((stage / allowed_changes[0]).read_text())
    assert new_pin['release_id'] == new_knowledge['release_id'] and new_pin['release_id'] != old_knowledge['release_id']
    assert new_knowledge['fragments'] == old_knowledge['fragments'] and len(new_knowledge['fragments']) == 27
    assert new_knowledge['capability_contracts'] == old_knowledge['capability_contracts'] and len(new_knowledge['capability_contracts']) == 67
    for key in ('registry_sha256', 'contract_schema_sha256', 'catalog_release', 'context_module_route'):
        assert new_knowledge[key] == old_knowledge[key]
    baseline, schema_before, chat_before = quiet(), schema(), chat()
    native_before, environment_before = native_identity(), environment_metadata()
    nginx_before = run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value'])
    backup = Path('/opt/nodia/verification-backups') / ('ai34-metadata-' + str(int(time.time() * 1000)))
    backup.mkdir(mode=0o700)
    (backup / 'before-manifest.json').write_bytes(before_file.read_bytes())
    (backup / 'schema-before.json').write_text(json.dumps(schema_before, indent=2))
    for name in allowed_changes:
        (backup / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(runtime / name, backup / name)
    phase = 'stop_admissions'; stopped = True
    run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
    quiet()
    assert current() == before and schema() == schema_before and chat() == chat_before
    phase = 'refresh_metadata'; changed = True
    for name in allowed_changes:
        install(stage / name, runtime / name)
    assert current() == expected
    phase = 'start_admissions'
    run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready(); stopped = False
    phase = 'postflight'
    final = quiet()
    assert current() == expected and schema() == schema_before and chat() == chat_before
    assert native_identity() == native_before and environment_metadata() == environment_before
    assert run(['systemctl', 'show', 'nginx', '--property=MainPID', '--property=ActiveEnterTimestampMonotonic', '--value']) == nginx_before
    report.update(status='passed', backup_directory=str(backup), compiled_files_verified=931, compiled_manifest_sha256=candidate_hash, changed_paths=allowed_changes, knowledge_release_before=old_knowledge['release_id'], knowledge_release_after=new_pin['release_id'], published_fragments_unchanged=27, capability_contracts_unchanged=67, schema_and_snapshot_revision_preserved=True, native_image=expected_native_image, native_container_identity_preserved=True, environment_mounts_isolation_preserved=True, nginx_identity_preserved=True, configured_chat_preserved=True, quiet_before=baseline, quiet_after=final)
except Exception:
    report.update(status='failed', safe_failure_phase=phase)
    safe_to_restore = True
    try:
        quiet()
    except Exception:
        safe_to_restore = False
        report['rollback_deferred_due_to_nonterminal_activity'] = True
    if safe_to_restore:
        try:
            if stopped or changed:
                run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'], 60)
            if changed:
                for name in allowed_changes:
                    install(backup / name, runtime / name)
                assert current() == before
                report['metadata_rolled_back'] = True
            if stopped or changed:
                run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 60); ready()
                report['services_recovered'] = True
        except Exception:
            report['services_recovered'] = False
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
Path('/tmp/ai34-metadata-refresh-result.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
