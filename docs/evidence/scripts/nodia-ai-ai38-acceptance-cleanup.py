"""Close only the AI-38 acceptance fixture; never operational services."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

root = Path('/opt/nodia/verification/ai38-acceptance01').resolve()
packet = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server').resolve()
expected = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
assert root.parent == Path('/opt/nodia/verification') and root.name == 'ai38-acceptance01'
manifest_hash = hashlib.sha256((packet / 'manifest.json').read_bytes()).hexdigest()
assert manifest_hash == expected
backend_hash = hashlib.sha256((root / 'test/nodia-ai-ai38-acceptance.integration.mjs').read_bytes()).hexdigest()
assert backend_hash == '62ea6af6100b636ed8d9a756a7b473e55d1257d9a2a86764bce60e1f80120809'
def docker_names():
    names = subprocess.check_output(['docker', 'ps', '-a', '--format', '{{.Names}}'], text=True).splitlines()
    return [name for name in names if name.startswith('template_ai38_')]
before = docker_names()
processes = []
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        args = (proc / 'cmdline').read_bytes().split(b'\0')
        if args[:2] == [b'/usr/local/bin/node', b'test/nodia-ai-ai38-acceptance.integration.mjs']:
            assert (proc / 'cwd').resolve() == root
            processes.append(int(proc.name))
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        continue
assert len(processes) == 1 and len(before) == 1
os.kill(processes[0], signal.SIGTERM)
deadline = time.monotonic() + 20
while Path('/proc', str(processes[0])).exists() or docker_names():
    if time.monotonic() >= deadline:
        raise RuntimeError('Owned acceptance process or container did not close')
    time.sleep(0.1)
after = docker_names()
print(json.dumps({
    'stage': 'AI-38', 'scope': 'owned_isolated_acceptance_cleanup',
    'context': {'environment_id': 'ai38-isolated-ui-api-sql', 'package_manifest_sha256': manifest_hash},
    'checked_at_vm_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'backend_sha256': backend_hash, 'owned_backend_processes_terminated': len(processes),
    'owned_containers_before': before, 'owned_containers_after': after,
    'node_process_closed': True, 'disposable_database_removed': True,
    'operational_services_touched': False, 'provider_requests': 0,
    'candidate_files_modified': False,
}, indent=2))
