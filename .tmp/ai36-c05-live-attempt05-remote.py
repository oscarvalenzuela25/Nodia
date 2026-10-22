"""Real-provider candidate acceptance, isolated SQL; no deployment or restart.

No emergency container deletion on uncertainty: the durable SQL recovery data
must survive until native terminal proof and ACK are reconciled.
"""
from __future__ import annotations
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

expected, attempt = sys.argv[1:3]
assert re.fullmatch(r'[a-f0-9]{64}', expected)
assert re.fullmatch(r'attempt[0-9]{2}', attempt)
archive = Path('/tmp/ai36-c05-live-stage.tar')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
base = Path('/opt/nodia/verification/ai36-c05-live-' + attempt)
base.mkdir(mode=0o700, exist_ok=False)
root = base / 'nodia-server'
root.mkdir(mode=0o700)
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        relative = PurePosixPath(member.name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert not member.issym() and not member.islnk()
        assert relative.parts[0] in ('dist', 'package.json', 'package-lock.json', 'test', '.tmp')
    bundle.extractall(root, filter='data')
manifest_path = root / '.tmp/ai36-c05-live-stage-manifest.json'
manifest = json.loads(manifest_path.read_text())
assert manifest['fixture_namespace'] == 'ai3605'
for name, digest in manifest['files'].items():
    relative = PurePosixPath(name)
    assert not relative.is_absolute() and '..' not in relative.parts
    assert hashlib.sha256((root / relative).read_bytes()).hexdigest() == digest
assert not (root / '.env').exists()
os.symlink('/opt/nodia/verification/ai32-r02-20261018/node_modules', root / 'node_modules')

def runtime_baseline():
    operational = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
    files = {file.relative_to(operational).as_posix(): hashlib.sha256(file.read_bytes()).hexdigest()
             for file in sorted((operational / 'dist').rglob('*')) if file.is_file()}
    units = {name: subprocess.check_output(['systemctl', 'is-active', name], text=True).strip()
             for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}
    containers = []
    for line in subprocess.check_output(['docker', 'ps', '--format', '{{.ID}} {{.Names}}'], text=True).splitlines():
        if 'gemini' in line:
            value = json.loads(subprocess.check_output(['docker', 'inspect', line.split()[0]], text=True))[0]
            containers.append({'id': value['Id'], 'image': value['Image'], 'started_at': value['State']['StartedAt']})
    return {'compiled_files': len(files), 'manifest_sha256': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest(),
            'units': units, 'gemini_containers': containers}

before = runtime_baseline()
assert all(value == 'active' for value in before['units'].values())
assert len(before['gemini_containers']) == 1
assert before['gemini_containers'][0]['image'] == 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
observer_preflight = None
observer_env = {}
if manifest.get('owned_log_observer'):
    assert manifest.get('discovery_only') is True
    expected_tools = {
        '.tmp/c05-owned-log-observer.py': ('/tmp/nodia-ai-ai36-c05-owned-log-observer.py', '7b5962f6c8e8f7f5e41763714c7d91e77e457c28e17cac43b747f0b2b0420c30'),
        '.tmp/c05-native-cli-diagnostics.py': ('/tmp/nodia-ai-ai36-c05-native-cli-diagnostics.py', 'fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe'),
    }
    for source, (destination, digest) in expected_tools.items():
        assert manifest['files'][source] == digest
        subprocess.run(['docker', 'cp', str(root / source), 'nodia-gemini-microservice:' + destination], check=True, capture_output=True)
    python = subprocess.check_output(['docker', 'exec', '--user', '10001:10001', 'nodia-gemini-microservice',
        'python', '-c', 'import sys;print(sys.executable)'], text=True).strip()
    assert re.fullmatch(r'/[a-zA-Z0-9_./-]+', python) and '..' not in PurePosixPath(python).parts
    preflight = '''import hashlib,json,os,stat
from pathlib import Path
home=Path('/home/nodia/agentic_profile');parent=Path('/app/session_state/runtime_admission')
a=home.lstat();b=parent.lstat()
assert stat.S_ISDIR(a.st_mode) and not home.is_symlink() and stat.S_ISDIR(b.st_mode) and not parent.is_symlink()
assert os.getuid()==a.st_uid==b.st_uid
assert not list(home.glob('nodia-mcp-*')) and not list(parent.glob('*.unknown'))
expected={'/tmp/nodia-ai-ai36-c05-owned-log-observer.py':'7b5962f6c8e8f7f5e41763714c7d91e77e457c28e17cac43b747f0b2b0420c30','/tmp/nodia-ai-ai36-c05-native-cli-diagnostics.py':'fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe'}
for name,digest in expected.items():
 p=Path(name);assert p.is_file() and not p.is_symlink()
 data=p.read_bytes();assert hashlib.sha256(data).hexdigest()==digest;compile(data,'<verified-standalone-tool>','exec')
namespace={'__name__':'nodia_observer_structural_preflight_tool'}
exec(compile(Path('/tmp/nodia-ai-ai36-c05-native-cli-diagnostics.py').read_bytes(),'<verified-classifier-tool>','exec'),namespace)
assert namespace['_classify_admitted_log_windows']((b'',))=={'transport_indicators':[],'provider_error_indicators':[],'http_statuses':[]}
print(json.dumps({'status':'passed','exec_uid':os.getuid(),'home_uid':a.st_uid,'marker_parent_uid':b.st_uid,'baseline_directories':0,'baseline_unknown_markers':0,'provider_requests':0,'profile_bytes_read':False,'native_app_imports_or_changes':False}))
'''
    observer_preflight = json.loads(subprocess.check_output(['docker', 'exec', '--user', '10001:10001',
        'nodia-gemini-microservice', 'env', '-i', 'PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/tmp', python, '-I', '-B', '-c', preflight], text=True))
    observer_env = {'NODIA_AI_C05_OBSERVER_SCRIPT': expected_tools['.tmp/c05-owned-log-observer.py'][0],
        'NODIA_AI_C05_OBSERVER_PARSER': expected_tools['.tmp/c05-native-cli-diagnostics.py'][0],
        'NODIA_AI_C05_OBSERVER_PARSER_SHA256': expected_tools['.tmp/c05-native-cli-diagnostics.py'][1],
        'NODIA_AI_C05_OBSERVER_PROFILE_HOME': '/home/nodia/agentic_profile', 'NODIA_AI_C05_OBSERVER_PYTHON': python}
stdout, stderr = root / '.tmp/stdout.log', root / '.tmp/stderr.log'
live_report = root / '.tmp/live-report.json'
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
timeout = False
with stdout.open('x') as out, stderr.open('x') as err:
    try:
        result = subprocess.run(['/usr/local/bin/node', 'test/nodia-ai-ai36-c05-live.integration.mjs'],
                                cwd=root, stdout=out, stderr=err,
                                env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root',
                                     'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null',
                                     'NODIA_AI_ALLOW_LIVE': 'yes',
                                     'NODIA_AI_C05_OPERATIONAL_RUNTIME': '/opt/nodia/releases/nodia-server-ai15-20261016',
                                     'NODIA_AI_C05_OUTPUT': str(live_report),
                                     'NODIA_AI_C05_DISCOVERY_ONLY': 'yes' if manifest.get('discovery_only') else 'no',
                                     **observer_env}, timeout=900)
        code = result.returncode
    except subprocess.TimeoutExpired:
        timeout, code = True, 124
assertion = json.loads(live_report.read_text()) if live_report.exists() else None
after = runtime_baseline()
unchanged = before == after
remaining = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'name=template_ai3605_', '--format', '{{.Names}}'], text=True).splitlines()
for name in remaining:
    assert re.fullmatch(r'template_ai3605_[0-9]+_[a-f0-9]{8}', name)
receipt = {'stage': 'AI-36-C05', 'scope': 'explicit_published_candidate_real_Gemini_disposable_SQL',
           'attempt': attempt, 'status': 'passed' if code == 0 and unchanged and not remaining else 'failed',
           'started_at_utc': started, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'exit_code': code, 'timeout': timeout, 'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
           'archive_sha256': expected, 'compiled_files_verified': manifest['compiled_files'],
           'harness_sha256': manifest['files']['test/nodia-ai-ai36-c05-live.integration.mjs'],
           'runner_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'stdout_sha256': hashlib.sha256(stdout.read_bytes()).hexdigest(),
           'stderr_sha256': hashlib.sha256(stderr.read_bytes()).hexdigest(),
           'assertion_result': assertion, 'operational_runtime_before': before, 'operational_runtime_after': after,
           'operational_runtime_unchanged': unchanged, 'services_restarted': False,
           'configured_SQL_layer': 'read_only_public_selection_and_quiet_check',
           'business_effects_layer': 'synthetic_disposable_PostgreSQL_only_after_operator_HTTP_confirmation',
           'physical_UI_accepted': False, 'productive_acceptance': False,
           'disposable_containers_remaining': len(remaining),
           'automatic_container_cleanup_after_uncertainty': False}
receipt['discovery_only_diagnostic'] = manifest.get('discovery_only', False)
receipt['observer_tool_preflight'] = observer_preflight
receipt['native_application_sources_modified'] = False
(root / '.tmp/receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
sys.exit(code if code else 1 if not unchanged or remaining else 0)
