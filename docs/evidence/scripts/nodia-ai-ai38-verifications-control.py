"""Pause/resume ordinary consumers for serial live verification, without restarting Gemini."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path('/opt/nodia/verification/ai38-verifications-session01')
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')
os.umask(0o077)


def run(argv):
    return subprocess.run(argv, capture_output=True, check=True, timeout=90).stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def states():
    return {unit: run(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).decode().strip() for unit in UNITS}


def baseline():
    root = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
    files = {path.relative_to(root).as_posix(): sha(path) for path in sorted((root / 'dist').rglob('*')) if path.is_file()}
    assert len(files) == 932 and hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest() == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
    info = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    assert info['State']['Running'] and info['Image'] == 'sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e'
    return {'Node932_manifest_sha256': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(),
            'container_id': info['Id'], 'image': info['Image'], 'started_at_utc': info['State']['StartedAt'],
            'private_descriptor_sha256': hashlib.sha256(json.dumps({'Env': sorted(info['Config']['Env']), 'Mounts': sorted(info['Mounts'], key=lambda item: item['Destination']),
                'User': info['Config']['User'], 'HostConfig': info['HostConfig']}, sort_keys=True).encode()).hexdigest()}


def quiet():
    assert sha(Path('/tmp/ai32-r04-cleanup.py')) == 'a42831dce6f458af03f8a405014ebd8de8aafda6d39ca60fb00cd24829c243b7'
    assert sha(Path('/tmp/nodia-ai-ai36-c05-live-health.mjs')) == 'e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395'
    native = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    sql = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs', '/opt/nodia/releases/nodia-server-ai15-20261016']))
    assert all(native[key] == 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'))
    assert all(sql[key] == 0 for key in ('pending_jobs', 'open_attempts', 'retained_slots'))
    return {'native': native, 'SQL': sql}


mode = sys.argv[1]
assert mode in ('pause', 'resume') and os.geteuid() == 0
if mode == 'pause':
    assert states() == dict.fromkeys(UNITS, 'active')
    prior = baseline()
    quiet()
    ROOT.mkdir(mode=0o700, exist_ok=False)
else:
    prior = json.loads((ROOT / 'pause.json').read_text(encoding='utf-8'))['baseline']
    assert prior == baseline(), 'operational_runtime_changed'
    assert not (ROOT / 'resume.json').exists()
report = {'stage': 'AI-38', 'scope': 'serial_verification_consumer_' + mode,
          'started_at_utc': datetime.now(timezone.utc).isoformat(), 'source_sha256': sha(Path(__file__)),
          'baseline': prior, 'status': 'running', 'native_restarts': 0, 'provider_generations': 0}
try:
    if mode == 'pause':
        run(['systemctl', 'stop', 'nodia-api', 'nodia-ai-worker'])
    report['quiet_before'] = quiet()
    assert baseline() == prior
    if mode == 'resume':
        run(['systemctl', 'start', 'nodia-api', 'nodia-ai-worker'])
    report['services'] = states()
    expected_states = dict.fromkeys(UNITS, 'active') if mode == 'resume' else {'nodia-api': 'inactive', 'nodia-ai-worker': 'inactive', 'nodia-gemini-lab': 'active', 'nginx': 'active'}
    assert report['services'] == expected_states
    assert baseline() == prior
    report['status'] = 'passed'
except Exception as error:
    report['status'] = 'failed_requires_quiescence_review_no_native_restart'
    report['failure_class'] = type(error).__name__
    raise
finally:
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    with (ROOT / (mode + '.json')).open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
