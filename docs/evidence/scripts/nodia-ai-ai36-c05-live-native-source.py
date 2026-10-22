"""Hash fixed native implementation files; never inspect sessions or credentials."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

container = 'nodia-gemini-microservice'
info = json.loads(subprocess.check_output(['docker', 'inspect', container], text=True, timeout=15))[0]
assert info['Config']['WorkingDir'] == '/app'
script = """
import hashlib,json
from pathlib import Path
names=('native_mcp_sessions.py','native_mcp_stdio.py','agentic_tool_gate.py',
       'agentic_progress.py','native_cli_diagnostics.py','agentic_cli.py')
print(json.dumps({name:hashlib.sha256((Path('/app')/name).read_bytes()).hexdigest() for name in names}))
"""
hashes = json.loads(subprocess.check_output(
    ['docker', 'exec', container, 'python', '-c', script], text=True, timeout=15))
print(json.dumps({
    'stage': 'AI-36-C05',
    'scope': 'read_only_native_image_and_fixed_source_hashes',
    'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'container': {'id': info['Id'], 'image': info['Image'], 'started_at': info['State']['StartedAt']},
    'source_files_sha256': hashes,
    'source_version': None,
    'source_version_reason': 'No verified version identifier read; immutable image and file hashes identify this implementation.',
    'sessions_or_profiles_read': False,
    'provider_requests': 0,
    'services_restarted': False,
    'extractor_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
}, indent=2))
