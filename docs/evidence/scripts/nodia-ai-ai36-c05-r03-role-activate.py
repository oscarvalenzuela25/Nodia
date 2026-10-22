"""Explicit R03 GO: current 902d to frozen corrected-role immutable candidate."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess

root = Path('/opt/nodia/verification/ai36-c05-r03-role-activation')
assert not root.exists()
root.mkdir(mode=0o700)
os.umask(0o077)
build_report_file = Path('/opt/nodia/verification/ai36-c05-r03-candidate-build01/report.json')
build_report = json.loads(build_report_file.read_text())
assert build_report['status'] == 'passed'
assert hashlib.sha256(build_report_file.read_bytes()).hexdigest() == '7332694f79027adaccb3b0b80fb1d808e507d8a03caa0689ecfeb21dbb213af0'
candidate = build_report['candidate_image_id']
base = 'sha256:902d0edc51ae2153d02bd32ad77c496bf1d16ee09d89d98d8dce86bb7cffd8c5'
def run(args, timeout=120):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout)
def checked(args, timeout=120):
    p = run(args, timeout)
    assert p.returncode == 0, 'maintenance_command_failed'
    return p.stdout
before = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
assert before['Image'] == base and before['State']['Running']
# Full descriptor can contain env values: private root-only backup, never emitted.
(root / 'private-original-container.json').write_text(json.dumps(before, indent=2) + '\n')
unit = checked(['systemctl', 'cat', 'nodia-gemini-lab'])
(root / 'private-original-unit.txt').write_bytes(unit)
assert b'ExecStart=' in unit
labels = before['Config']['Labels']
files = labels['com.docker.compose.project.config_files'].split(',')
project = labels['com.docker.compose.project']
workdir = labels['com.docker.compose.project.working_dir']
service = labels['com.docker.compose.service']
assert project == 'nodia-gemini-lab' and service == 'nodia-gemini-microservice'
assert before['Config']['User'] == 'nodia'
assert before['HostConfig']['PortBindings'] == {'8000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '8000'}]}
dropin = Path('/etc/systemd/system/nodia-gemini-lab.service.d/ai36-c05-role.conf')
assert hashlib.sha256(dropin.read_bytes()).hexdigest() == '83a08794a6bfe2ea05b4480c1c754135c7a1c7f65f288e5b1290eab6d881ac3d'
(root / 'private-original-role-override.conf').write_bytes(dropin.read_bytes())
override = root / 'docker-compose.candidate.yml'
override.write_text(f'services:\n  {service}:\n    image: "{candidate}"\n    pull_policy: never\n')
compose = ['/usr/bin/docker', 'compose', '-p', project]
for file in files: compose += ['-f', file]
compose += ['-f', str(override)]
report = {'stage': 'AI-36-C05-R03', 'scope': 'current_902d_to_stdio_fix_candidate_single_owner_activation',
 'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
 'original_image_id': base, 'candidate_image_id': candidate, 'provider_generations': 0,
 'Node_runtime_files_modified': 0, 'configured_selection_modified': False,
 'private_original_descriptor_preserved': True, 'private_original_unit_preserved': True,
 'original_bind_mounts': [{'destination': m['Destination'], 'read_write': m['RW'], 'type': m['Type']} for m in before['Mounts']],
 'original_bind_source_hashes': {m['Destination']: hashlib.sha256(m['Source'].encode()).hexdigest() for m in before['Mounts']},
 'original_environment_paths_only': [m['Source'] for m in before['Mounts'] if m['Destination'] == '/app/.env'],
 'original_container_id': before['Id'], 'service_states_before': {}, 'steps': []}
def save():
    (root / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
save()
try:
 for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab'):
    report['service_states_before'][name] = run(['systemctl', 'is-active', name]).stdout.decode().strip()
 assert report['service_states_before'] == {'nodia-api': 'active', 'nodia-ai-worker': 'active', 'nodia-gemini-lab': 'active'}
 checked(['systemctl', 'stop', 'nodia-ai-worker', 'nodia-api'])
 report['steps'].append('API_and_worker_paused'); save()
 # Recheck SQL and exact native durable state after all possible consumers stop.
 health = json.loads(checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs', '/opt/nodia/releases/nodia-server-ai15-20261016']))
 assert health['pending_jobs'] == health['open_attempts'] == health['retained_slots'] == 0
 assert health['preserved_r05_chat'] == 1
 quiet = json.loads(checked(['python3', '/tmp/ai32-r04-cleanup.py']))
 assert all(quiet[k] == 0 for k in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
 report['quiet_after_consumers_paused'] = {'SQL': health, 'native': quiet}; save()
 checked(['systemctl', 'stop', 'nodia-gemini-lab'])
 report['steps'].append('original_unique_Gemini_owner_stopped'); save()
 # Durable deployment descriptor: no writable-container source overlay or patch.
 dropin.parent.mkdir(parents=True, exist_ok=True)
 argv = compose + ['up', '-d', '--wait', '--wait-timeout', '90', '--no-build', '--pull', 'never']
 assert all(' ' not in a for a in argv)
 replacement = root / 'role-override.replacement'
 replacement.write_text('[Service]\nExecStart=\nExecStart=' + ' '.join(argv) + '\n')
 os.replace(replacement, dropin)
 report['systemd_override_sha256'] = hashlib.sha256(dropin.read_bytes()).hexdigest()
 report['compose_override_sha256'] = hashlib.sha256(override.read_bytes()).hexdigest()
 checked(['systemctl', 'daemon-reload'])
 checked(['systemctl', 'start', 'nodia-gemini-lab'], 120)
 report['steps'].append('candidate_unique_Gemini_owner_started'); save()
 after = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
 assert after['Image'] == candidate and after['State']['Running']
 assert sorted(after['Mounts'], key=lambda m: m['Destination']) == sorted(before['Mounts'], key=lambda m: m['Destination'])
 envdict = lambda c: dict(v.split('=', 1) for v in c['Config']['Env'])
 assert len(envdict(after)) == len(after['Config']['Env']) and len(envdict(before)) == len(before['Config']['Env'])
 assert envdict(after) == envdict(before)
 assert after['Config']['User'] == before['Config']['User']
 assert after['HostConfig']['PortBindings'] == before['HostConfig']['PortBindings']
 assert after['HostConfig']['Memory'] == before['HostConfig']['Memory']
 assert after['HostConfig']['NanoCpus'] == before['HostConfig']['NanoCpus']
 assert after['HostConfig']['Tmpfs'] == before['HostConfig']['Tmpfs']
 report['candidate_container_id'] = after['Id']
 report['candidate_started_at_utc'] = after['State']['StartedAt']
 report['environment_mounts_UID_port_resources_unchanged'] = True
 report['API_and_worker_remain_paused_for_single_canary'] = True
 report['status'] = 'passed'
except BaseException:
 report['status'] = 'failed_requires_operator_review_no_automatic_native_retry'
 raise
finally:
 report['finished_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
 print(json.dumps(report))
