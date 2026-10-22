"""Read-only final projections; no profile bytes or provider generation."""
import importlib.util
import hashlib
import json
import subprocess
import time
import urllib.request
from pathlib import Path

def run(args):
    return subprocess.run(args, check=True, capture_output=True, timeout=40).stdout

prior = json.loads(run(['python3', '/tmp/nodia-ai32-r02-20261018/ai32-r02-node-health.py']))
spec = importlib.util.spec_from_file_location('safe_config', '/tmp/nodia-ai-ai32-native-probe.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
config = helper.configuration()
observations = {}
for engine, selection in config['selections'].items():
    payload = {key: selection[key] for key in ['model_id', 'effort_id', 'configuration_generation']}
    request = urllib.request.Request(config['url'].rstrip('/')+'/nodia-ai/'+engine+'/observe',
        data=json.dumps(payload).encode(), headers={'Content-Type':'application/json',
        'X-Nodia-Service-Token':config['token']}, method='POST')
    with urllib.request.urlopen(request, timeout=35) as response:
        observed = json.loads(response.read(16385))
    observations[engine] = {**payload, **{key: observed.get(key) for key in [
        'available', 'resource_key', 'session_generation', 'verified_modalities', 'verified_attachment_media_types', 'supports_mcp', 'reason']}}

manifest = json.loads(Path('/tmp/ai32-r02-final-source-manifest.json').read_text(encoding='utf-8'))
code = '''import hashlib,json,sys
from pathlib import Path
manifest=json.load(sys.stdin);drift=[]
for relative,expected in manifest.items():
 p=Path(relative)
 if p.is_absolute() or '..' in p.parts:raise ValueError('invalid allowlist')
 file=Path('/app')/p
 if file.is_symlink() or not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=expected:drift.append(relative)
print(json.dumps({'files':len(manifest),'drift':drift}))
'''
parity = subprocess.run(['docker','exec','-i','--user','10001:10001','nodia-gemini-microservice',
    'python','-c',code], input=json.dumps(manifest).encode(), check=True, capture_output=True, timeout=20)
parity = json.loads(parity.stdout)
image = run(['docker','inspect','--format','{{.Image}}','nodia-gemini-microservice']).decode().strip()
cleanup = json.loads(run(['python3','/tmp/ai32-r02-cleanup.py']))
report = {**prior, 'stage':'AI-32-R02', 'scope':'current_read_only_native_and_compiled_runtime_parity',
    'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()), 'gemini_image':image,
    'native_sessions':{engine:item.get('session_generation') for engine,item in observations.items()},
    'native_observations':observations, 'source_drift_files':parity['drift'],
    'native_source_files_verified':parity['files'], 'native_cleanup':cleanup,
    'native_manifest_sha256':hashlib.sha256(Path('/tmp/ai32-r02-final-source-manifest.json').read_bytes()).hexdigest(),
    'provider_generations_requested_by_health':0}
assert not parity['drift']
assert all(cleanup[key]==0 for key in ['unknown_markers','armed_native_proofs','terminal_native_proofs',
    'invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'])
print(json.dumps(report,indent=2))
