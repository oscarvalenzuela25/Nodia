"""GO12 one-shot canary, using the immutable compiled candidate and original AI15."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

os.umask(0o077)
root = Path('/opt/nodia/verification/ai36-c05-role-canary12')
assert not root.exists()
root.mkdir(mode=0o700)
stage = root / 'nodia-server'
(stage / 'test').mkdir(parents=True)
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
compiled = Path('/opt/nodia/verification/ai36-c05-cases-live-attempt08-reads/nodia-server')
for name in ('package.json', 'package-lock.json'):
    shutil.copyfile(compiled / name, stage / name)
(stage / 'dist').symlink_to(compiled / 'dist')
(stage / 'node_modules').symlink_to(compiled / 'node_modules')
for name in ('nodia-ai-ai15-live-attest.mjs', 'nodia-ai-ai36-c05-role-canary.mjs'):
    shutil.copyfile('/tmp/' + name, stage / 'test' / name)
sha = lambda b: hashlib.sha256(b).hexdigest()
def run(args, timeout=120, env=None):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout, env=env)
def checked(args, timeout=120):
    p = run(args, timeout)
    assert p.returncode == 0, 'preflight_or_metadata_failed'
    return p.stdout
report = {'stage': 'AI-36-C05-R01', 'scope': 'GO12_new_owned_role_one_native_MCP_canary',
          'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
          'maximum_native_start_requests': 1, 'business_effects': 0, 'configured_SQL_writes': 0,
          'runner_source_sha256': sha(Path(__file__).read_bytes()),
          'wrapper_source_sha256': sha((stage / 'test/nodia-ai-ai36-c05-role-canary.mjs').read_bytes()),
          'original_AI15_source_sha256': sha((stage / 'test/nodia-ai-ai15-live-attest.mjs').read_bytes()),
          'Node_operational_files_modified': 0}
def save(): (root / 'runner-report.json').write_text(json.dumps(report, indent=2) + '\n')
save()
try:
    current = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    candidate = 'sha256:3f004c6c170ea79d16a544a788a5189f3afc17d3d68d465cb5092c3099cd0404'
    assert current['Image'] == candidate and current['State']['Health']['Status'] == 'healthy'
    before = json.loads(Path('/opt/nodia/verification/ai36-c05-role-maintenance12/private-original-container.json').read_text())
    envdict = lambda c: dict(v.split('=', 1) for v in c['Config']['Env'])
    assert len(envdict(current)) == len(current['Config']['Env'])
    assert len(envdict(before)) == len(before['Config']['Env'])
    assert envdict(current) == envdict(before)
    assert sorted(current['Mounts'], key=lambda m: m['Destination']) == sorted(before['Mounts'], key=lambda m: m['Destination'])
    assert all(current['HostConfig'][k] == before['HostConfig'][k] for k in ('PortBindings','Memory','NanoCpus','Tmpfs','NetworkMode','SecurityOpt','CapAdd','PidsLimit'))
    report['activation_semantic_postverification'] = {'environment_names_unique': True, 'environment_values_unchanged': True, 'mounts_unchanged': True, 'resources_and_security_unchanged': True,
       'candidate_container_id': current['Id'], 'started_at_utc': current['State']['StartedAt'], 'healthy': True}
    for unit in ('nodia-api', 'nodia-ai-worker'):
        assert run(['systemctl', 'is-active', unit]).stdout.strip() == b'inactive'
    policy = checked(['docker', 'run', '--rm', '--network=none', '--read-only', '--entrypoint=/usr/bin/python', candidate,
       '-B', '-c', 'from native_execution_agents import mcp_execution_policy_hash; print(mcp_execution_policy_hash())']).decode().strip()
    assert len(policy) == 64
    checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-role-canary-input.mjs', str(runtime), str(stage), str(root),
       '/tmp/nodia-ai-ai36-c05-current-modalities-before-role.json', policy])
    modality = checked(['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-current-modalities.mjs', str(runtime), str(stage)], 90)
    (root / 'postactivation-modalities.json').write_bytes(modality)
    observed = json.loads(modality)
    high = next(v for v in observed['observations'] if v['selection']['mode'] == 'token_plan_agentic')
    binding = json.loads((root / 'binding.json').read_text())
    assert high['available'] is True and high['supports_mcp'] is False
    assert high['selection'] == binding['selection']
    assert high['configuration_generation'] == binding['configuration_generation']
    assert high['verified_attachment_media_types'] == []
    report['preflight_High_available_MCP_false'] = True
    report['policy_sha256'] = policy
    report['binding_sha256'] = sha((root / 'binding.json').read_bytes())
    report['canary_command_started_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    env = {**os.environ, 'NODIA_AI_ALLOW_LIVE': 'yes', 'NODIA_AI_ATTEST_CONFIGURED_DB': 'read_only',
       'NODIA_AI_LAB_API_ENV': str(runtime / '.env'), 'NODIA_AI_LAB_SELECTION_JSON': str(root / 'selection.json'),
       'NODIA_AI_LAB_REPORT_JSON': str(root / 'original-ai15-report.json'),
       'NODIA_AI_C05_ROLE_CANARY_REPORT': str(root / 'canary-report.json'),
       'NODIA_AI_C05_ROLE_CANDIDATE_BINDING': str(root / 'binding.json')}
    result = run(['/usr/local/bin/node', str(stage / 'test/nodia-ai-ai36-c05-role-canary.mjs')], 300, env)
    (root / 'canary-stdout.log').write_bytes(result.stdout)
    (root / 'canary-stderr.log').write_bytes(result.stderr)
    report['canary_exit_code'] = result.returncode
    canary = json.loads((root / 'canary-report.json').read_text())
    report['accepted_native_starts'] = canary['accepted_native_starts']
    report['canary_status'] = canary['status']
    report['canary_report_sha256'] = sha((root / 'canary-report.json').read_bytes())
    report['status'] = 'passed' if result.returncode == 0 and canary['status'] == 'passed' else 'failed'
except BaseException:
    report['status'] = 'failed'
    raise
finally:
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat(); save()
    print(json.dumps(report))
