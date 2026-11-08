"""Pinned offline help/version metadata, in a new empty isolated profile."""
from pathlib import Path
import hashlib
import json
import subprocess

binary = Path('/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
pin = '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c'
assert binary.is_file() and not binary.is_symlink() and hashlib.sha256(binary.read_bytes()).hexdigest() == pin
root = Path('/opt/nodia/verification/ai40-document-audio-help-r01')
root.mkdir(mode=0o700)
home, profile = root / 'home', root / 'empty-codex'
home.mkdir(mode=0o700)
profile.mkdir(mode=0o700)
env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(home), 'CODEX_HOME': str(profile),
       'XDG_CONFIG_HOME': str(home / 'config'), 'XDG_DATA_HOME': str(home / 'data'), 'XDG_CACHE_HOME': str(home / 'cache')}
results = []
for args in (['--version'], ['--help'], ['exec', '--help'], ['app-server', '--help']):
    child = subprocess.run(['/usr/bin/unshare', '--net', '--', str(binary), *args], cwd=root, env=env,
                           capture_output=True, timeout=20, check=True)
    assert len(child.stdout) <= 32768
    text = child.stdout.decode('utf-8')
    results.append({'argv_suffix': args, 'exit_code': child.returncode, 'stdout_sha256': hashlib.sha256(child.stdout).hexdigest(),
                    'stdout_bytes': len(child.stdout), 'private_stderr_bytes': len(child.stderr),
                    'version': text.strip() if args == ['--version'] else None,
                    'relevant_lines': [line.strip() for line in text.splitlines() if any(word in line.lower()
                                        for word in ('audio', 'voice', 'transcri', 'realtime', '--image', 'pdf', 'generate-json-schema', 'experimental'))]})
print(json.dumps({'schema': 'nodia-ai-ai40-offline-cli-help-v1', 'status': 'passed', 'binary_sha256': pin,
                  'network_namespace': True, 'isolated_empty_profile': str(profile), 'results': results,
                  'auth_file_created': (profile / 'auth.json').exists(), 'provider_generations': 0,
                  'provider_observations': 0, 'operational_profile_reads': 0, 'services_changed': False}))
