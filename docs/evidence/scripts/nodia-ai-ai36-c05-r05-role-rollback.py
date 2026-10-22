"""Restore the exact private R05 baseline descriptor; never restore credentials."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess

os.umask(0o077)
source = Path('/opt/nodia/verification/ai36-c05-r05-role-activation')
root = Path('/opt/nodia/verification/ai36-c05-r05-role-restoration01')
assert not root.exists()
root.mkdir(mode=0o700)
before = json.loads((source / 'private-original-container.json').read_text())
assert before['Image'] == 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa'
original_dropin = (source / 'private-original-role-override.conf').read_bytes()
assert hashlib.sha256(original_dropin).hexdigest() == '4d322139517dbcf55a0750af722ed9b54719bcc49ea60f52545225ace8054a87'

def run(args, timeout=120):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout)

def checked(args, timeout=120):
    result = run(args, timeout)
    assert result.returncode == 0, 'restoration_command_failed'
    return result.stdout

def unit_state(name):
    result = run(['systemctl', 'is-active', name])
    state = result.stdout.decode().strip()
    assert (state, result.returncode) in (('active', 0), ('inactive', 3)), 'invalid_unit_state_exit_pair'
    return state

report = {'stage': 'AI-36-C05-R05', 'scope': 'exact_061_CLI131_baseline_restoration_no_old_credentials_or_proofs_restored',
          'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
          'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'target_image': before['Image'], 'provider_generations': 0,
          'credential_contents_read_copied_or_restored': False, 'old_MCP_proofs_transferred': False,
          'Node_runtime_files_modified': 0, 'configured_selection_modified': False}

def save():
    (root / 'report.json').write_text(json.dumps(report, indent=2) + '\n')

save()
resume_consumers = False
try:
    checked(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'])
    quiet = json.loads(checked(['python3', '/tmp/ai32-r04-cleanup.py']))
    SQL = json.loads(checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs', '/opt/nodia/releases/nodia-server-ai15-20261016']))
    assert SQL['pending_jobs'] == SQL['open_attempts'] == SQL['retained_slots'] == 0 and SQL['preserved_r05_chat'] == 1
    assert all(quiet[k] == 0 for k in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
    report['pre_restoration_quiet'] = {'SQL': SQL, 'native': quiet}
    checked(['systemctl', 'stop', 'nodia-gemini-lab'])
    dropin = Path('/etc/systemd/system/nodia-gemini-lab.service.d/ai36-c05-role.conf')
    replacement = source / 'baseline-restoration.replacement'
    replacement.write_bytes(original_dropin)
    os.replace(replacement, dropin)
    checked(['systemctl', 'daemon-reload'])
    checked(['systemctl', 'start', 'nodia-gemini-lab'], 120)
    after = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert after['Image'] == before['Image'] and after['State']['Running']
    assert sorted(after['Mounts'], key=lambda v: v['Destination']) == sorted(before['Mounts'], key=lambda v: v['Destination'])
    envmap = lambda c: dict(value.split('=', 1) for value in c['Config']['Env'])
    assert len(envmap(after)) == len(after['Config']['Env']) and len(envmap(before)) == len(before['Config']['Env'])
    assert envmap(after) == envmap(before)
    for key in ('PortBindings', 'Memory', 'NanoCpus', 'Tmpfs'):
        assert after['HostConfig'][key] == before['HostConfig'][key]
    assert after['Config']['User'] == before['Config']['User']
    assert hashlib.sha256(dropin.read_bytes()).hexdigest() == hashlib.sha256(original_dropin).hexdigest()
    final_quiet = json.loads(checked(['python3', '/tmp/ai32-r04-cleanup.py']))
    final_SQL = json.loads(checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs', '/opt/nodia/releases/nodia-server-ai15-20261016']))
    assert final_SQL['pending_jobs'] == final_SQL['open_attempts'] == final_SQL['retained_slots'] == 0 and final_SQL['preserved_r05_chat'] == 1
    assert all(final_quiet[k] == 0 for k in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
    report['post_restoration_quiet'] = {'SQL': final_SQL, 'native': final_quiet}
    report['restored_epoch'] = {'id': after['Id'], 'image': after['Image'], 'started_at': after['State']['StartedAt']}
    report['descriptor_environment_unique_six_mounts_UID_port_resources_exact'] = True
    report['MCP_after_restart'] = 'unknown_requires_new_current_instance_evidence'
    report['status'] = 'passed_restore_requires_fresh_non_generative_metadata'
    resume_consumers = True
except BaseException:
    report['status'] = 'failed_restoration_requires_operator_review'
    raise
finally:
    if resume_consumers:
        report['API_worker_restore_exit_code'] = run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'], 120).returncode
    else:
        report['consumers_remain_paused'] = 'baseline_descriptor_or_quiescence_not_fully_verified_no_automatic_restart'
    report['service_states_after'] = {name: unit_state(name)
                                    for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    save()
    print(json.dumps(report))
