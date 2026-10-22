"""Read-only R05 health/parity/quiet snapshot. No observe or inference requests."""
import hashlib
import json
import subprocess
import time
from pathlib import Path

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=30).stdout

runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
report = json.loads(run(['python3', '/tmp/ai32-r05-r2-vm-health.py']))
report.update(scope='final_read_only_r2_app_runtime_health_and_parity',
              observed_at_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              provider_generations=0, provider_metadata_requests=0, status='running')
phase = 'quiet'
try:
    quiet = json.loads(run(['/usr/local/bin/node', '/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    report['sql_quiet'] = quiet
    assert quiet['pending_jobs'] == quiet['open_attempts'] == quiet['held_or_unknown_slots'] == 0
    assert quiet['migrations'] == 26
    phase = 'native_artifact_counts'
    native = json.loads(run(['python3', '/tmp/ai32-r04-cleanup.py']))
    report['native_runtime_artifact_counts'] = {key: native[key] for key in [
        'unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
        'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories']}
    assert all(value == 0 for value in report['native_runtime_artifact_counts'].values())
    report['acknowledgement_count_observed'] = None
    report['terminal_proofs_remaining'] = 0
    phase = 'compiled_parity'
    manifest_path = Path('/tmp/nodia-ai32-r05-storage-candidate/dist-manifest.json')
    data = manifest_path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == '0293d34fe9d320be6b9f696ebdc094e839d5cf5919f25091aa480ee262dfc3b5'
    manifest = json.loads(data)
    actual = {p.relative_to(runtime).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in (runtime/'dist').rglob('*') if p.is_file()}
    assert actual == manifest and len(manifest) == 909
    report['compiled_files_verified'] = len(manifest)
    report['compiled_drift_files'] = []
    report['compiled_manifest_sha256'] = hashlib.sha256(data).hexdigest()
    phase = 'native_source_parity'
    native_data = Path('/tmp/ai32-r04-final-source-manifest.json').read_bytes()
    native_manifest = json.loads(native_data)
    code = """import hashlib,json,sys
from pathlib import Path
manifest=json.load(sys.stdin)
drift=[]
for relative,expected in manifest.items():
 p=Path(relative)
 if p.is_absolute() or '..' in p.parts:raise ValueError('invalid_allowlist')
 source=Path('/app')/p
 if source.is_symlink() or not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=expected:drift.append(relative)
print(json.dumps({'files':len(manifest),'drift_count':len(drift)}))
"""
    proc = subprocess.run(['docker','exec','-i','--user','10001:10001',
                           'nodia-gemini-microservice','python','-c',code],
                          input=json.dumps(native_manifest), check=True,
                          capture_output=True, text=True, timeout=20)
    parity = json.loads(proc.stdout)
    assert parity['files'] == 92 and parity['drift_count'] == 0
    report['native_source_files_verified'] = parity['files']
    report['native_source_drift_count'] = 0
    report['native_manifest_sha256'] = hashlib.sha256(native_data).hexdigest()
    assert report['gemini_image'] == 'sha256:212cffaeefdd5e93f1abae290c4f387a891ddbd65357c223c6f0a3c0224488f3'
    assert all(value == 'active' for value in report['units'].values())
    assert all(value == 200 for value in report['http'].values())
    report['status'] = 'passed'
except Exception:
    report.update(status='failed',safe_failure_phase=phase)
report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
print(json.dumps(report, indent=2))
if report['status'] != 'passed':
    raise SystemExit(1)
