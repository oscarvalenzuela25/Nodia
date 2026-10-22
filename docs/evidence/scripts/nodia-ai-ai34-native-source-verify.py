"""Verify source hashes inside an isolated image or active container; no sessions are read."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import sys

mode, target, manifest_path = sys.argv[1:4]
assert mode in ('image', 'container')
manifest_file = Path(manifest_path)
manifest = json.loads(manifest_file.read_text())
assert isinstance(manifest, dict) and 0 < len(manifest) < 1000
code = '''import hashlib,json,sys
from pathlib import Path,PurePosixPath
m=json.load(sys.stdin)
assert isinstance(m,dict)
assert all(not PurePosixPath(p).is_absolute() and '..' not in PurePosixPath(p).parts and '.env' not in PurePosixPath(p).parts for p in m)
drift=[p for p,h in m.items() if not (Path('/app')/p).is_file() or (Path('/app')/p).is_symlink() or hashlib.sha256((Path('/app')/p).read_bytes()).hexdigest()!=h]
print(json.dumps({'files':len(m),'drift_count':len(drift),'drift_paths':drift}))
if drift: raise SystemExit(1)
'''
if mode == 'image':
    args = ['docker', 'run', '--rm', '-i', '--network', 'none', '--read-only', '--memory', '128m', '--cpus', '1', target, 'python', '-c', code]
else:
    assert target == 'nodia-gemini-microservice'
    args = ['docker', 'exec', '-i', '--user', '10001:10001', target, 'python', '-c', code]
result = subprocess.run(args, input=json.dumps(manifest), capture_output=True, text=True, timeout=30)
assert result.returncode == 0, 'Native source parity failed'
verified = json.loads(result.stdout)
assert verified['drift_count'] == 0 and verified['files'] == len(manifest)
print(json.dumps({'stage': 'AI-34', 'scope': 'native_source_parity_' + mode, 'status': 'passed', 'target': target, 'source_manifest_sha256': hashlib.sha256(manifest_file.read_bytes()).hexdigest(), **verified, 'provider_generations': 0, 'configured_sessions_used': False, 'services_restarted': False}, indent=2))
