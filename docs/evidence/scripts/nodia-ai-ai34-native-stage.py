"""Prepare/build an isolated native candidate. No active tag, service, credential or profile changes."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

base = Path(__file__).resolve().parents[3]
root = base / 'nodia-gemini-microservice'
out = base / '.tmp/ai34-native-candidate.tar.gz'
files = []
for file in root.rglob('*'):
    relative = file.relative_to(root)
    if any(part in {'.venv', 'browser_profile', 'session_state', 'temp_uploads', '__pycache__'} for part in relative.parts):
        continue
    if relative.parts[0] == 'experiments' and relative.name not in {'nodia_ai_mcp_fixture.py', 'nodia_ai_agentic_diagnostics.py', 'nodia_ai_web_protocol.py'}:
        continue
    if file.is_file() and not file.is_symlink() and (file.suffix == '.py' or relative.as_posix() in {'requirements.txt', 'antigravity-cli.lock.json', 'Dockerfile', '.dockerignore'} or relative.parts[0] == 'tests' and file.suffix == '.json'):
        files.append(file)
files.sort()
with tarfile.open(out, 'w:gz') as archive:
    for file in files:
        archive.add(file, arcname=file.relative_to(root).as_posix(), recursive=False)
manifest = {file.relative_to(root).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest() for file in files}
(base / '.tmp/ai34-native-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
options = ['-i', 'C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab', '-o', 'BatchMode=yes', '-o', 'UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts', '-o', 'HostKeyAlias=nodia-vps-lab', '-o', 'StrictHostKeyChecking=yes']
host = 'operador@172.31.209.214'
sha = hashlib.sha256(out.read_bytes()).hexdigest()
context = '/tmp/nodia-ai34-native-build-' + sha[:16]
subprocess.run(['ssh', *options, host, 'mkdir -p ' + context], check=True)
subprocess.run(['scp', *options, str(out), host + ':' + context + '/source.tar.gz'], check=True)
subprocess.run(['ssh', *options, host, 'tar -xzf ' + context + '/source.tar.gz -C ' + context], check=True)
subprocess.run(['ssh', *options, host, 'rm ' + context + '/source.tar.gz'], check=True)
subprocess.run(['ssh', *options, host, 'sudo -n docker build -t nodia-gemini-ai34-candidate:20261018 ' + context], check=True)
print(json.dumps({'stage': 'AI-34', 'scope': 'isolated_native_candidate_build', 'source_files': len(files), 'archive_sha256': sha, 'archive_bytes': out.stat().st_size, 'active_tag_modified': False, 'services_restarted': False, 'profile_or_credential_files_copied': False}))
