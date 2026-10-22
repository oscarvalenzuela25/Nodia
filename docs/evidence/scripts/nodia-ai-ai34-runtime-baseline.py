"""Read-only deployed file hashes and service metadata; no model or private data read."""
from __future__ import annotations
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
manifest = {file.relative_to(runtime).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted((runtime / 'dist').rglob('*')) if file.is_file()}
units = {}
for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'):
    status = subprocess.run(['systemctl', 'is-active', name], check=False, capture_output=True, text=True, timeout=10)
    units[name] = status.stdout.strip()
print(json.dumps({
    'stage': 'AI-34', 'scope': 'read_only_runtime_baseline',
    'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'compiled_files': len(manifest), 'manifest': manifest, 'units': units,
    'provider_generations': 0, 'provider_metadata_requests': 0,
    'configured_database_writes': 0, 'storage_operations': 0,
    'services_restarted': False,
}, indent=2))
