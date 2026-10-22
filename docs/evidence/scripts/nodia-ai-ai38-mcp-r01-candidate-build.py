"""Build and test the minimal diagnostic image offline; never activate it."""
from datetime import datetime, timezone
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

version, expected_archive_sha = sys.argv[1:]
assert re.fullmatch(r'0[1-9]', version)
assert re.fullmatch(r'[a-f0-9]{64}', expected_archive_sha)
label = 'ai38-mcp-r01-candidate-build' + version
archive = Path('/tmp') / (label + '.tar')
target = Path('/opt/nodia/verification') / label
sha = lambda raw: hashlib.sha256(raw).hexdigest()
assert sha(archive.read_bytes()) == expected_archive_sha
assert not target.exists(), 'preserve_closed_build'
target.mkdir(mode=0o700)
with tarfile.open(archive) as bundle:
    assert all(not member.issym() and not member.islnk() and not member.name.startswith('/')
               and '..' not in Path(member.name).parts for member in bundle)
    bundle.extractall(target, filter='data')
manifest_file = target / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
assert manifest['label'] == label
assert set(path.name for path in (target / 'context').iterdir()) == {'Dockerfile', *manifest['image_sources']}
assert set(manifest['image_sources']) <= {'native_mcp_sessions.py', 'native_mcp_stdio.py', 'native_cli_diagnostics.py'}
assert {'native_mcp_sessions.py', 'native_mcp_stdio.py'} <= set(manifest['image_sources'])
for name, digest in manifest['image_sources'].items():
    assert sha((target / 'context' / name).read_bytes()) == digest
assert sha((target / 'context/Dockerfile').read_bytes()) == manifest['dockerfile_sha256']
test_root = target / 'tests'
assert set(path.relative_to(test_root).as_posix() for path in test_root.rglob('*') if path.is_file()) == set(manifest['test_files'])
for name, digest in manifest['test_files'].items():
    assert sha((test_root / name).read_bytes()) == digest
for path in test_root.rglob('*'):
    path.chmod(0o755 if path.is_dir() else 0o644)
test_root.chmod(0o755)
owned_offline_containers = []

def run(argv, timeout=120, env=None):
    if argv[:2] != ['docker', 'run']:
        return subprocess.run(argv, capture_output=True, check=False, timeout=timeout, env=env)
    name = label + '-check-' + str(len(owned_offline_containers) + 1).zfill(2)
    probe = subprocess.run(['docker', 'container', 'inspect', name], capture_output=True, timeout=30)
    assert probe.returncode != 0, 'owned_offline_container_name_exists'
    owned_offline_containers.append(name)
    try:
        return subprocess.run([*argv[:2], '--name', name, *argv[2:]], capture_output=True,
                              check=False, timeout=timeout, env=env)
    finally:
        # The exact newly reserved name is owned by this build, including when
        # the Docker client timed out before --rm could finish.
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=30)

def inspect_container():
    result = run(['docker', 'inspect', 'nodia-gemini-microservice'])
    assert result.returncode == 0
    value = json.loads(result.stdout)[0]
    return {'id': value['Id'], 'image': value['Image'], 'started_at': value['State']['StartedAt']}

baseline = inspect_container()
assert baseline == {'id': manifest['expected_active_container_id'],
                    'image': manifest['base_image_id'],
                    'started_at': manifest['expected_active_started_at']}
report = {'stage': 'AI-38-MCP-R01', 'scope': manifest['scope'], 'status': 'running',
          'started_at_utc': datetime.now(timezone.utc).isoformat(),
          'archive_sha256': expected_archive_sha, 'manifest_sha256': sha(manifest_file.read_bytes()),
          'source_runner_sha256': sha(Path(__file__).read_bytes()),
          'baseline_container': baseline, 'image_sources': manifest['image_sources'],
          'excluded_test_files': manifest['excluded_test_files'],
          'expected_applicable_tests': manifest['expected_applicable_tests'],
          'test_sources_mount_only': True, 'image_sources_not_overridden_in_QA': True,
          'provider_requests': 0, 'candidate_activated': False, 'service_restarts': 0,
          'operational_environment_or_profiles_mounted': False,
          'build_and_QA_network': 'none', 'QA_read_only_root': True,
          'full_local_suite_parity_claimed': False}

def public_source_hashes(image):
    projection = "import hashlib,json,pathlib;print(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('/app').glob('*.py') if p.is_file()},sort_keys=True))"
    result = run(['docker', 'run', '--rm', '--network=none', '--read-only',
                  '--entrypoint=/usr/bin/python', image, '-B', '-c', projection])
    assert result.returncode == 0
    return json.loads(result.stdout)

try:
    built = run(['docker', 'build', '--pull=false', '--network=none', '--no-cache', '--force-rm',
                 '--iidfile', str(target / 'candidate.iid'), str(target / 'context')], 300,
                env={**os.environ, 'DOCKER_BUILDKIT': '0'})
    (target / 'build-stdout.log').write_bytes(built.stdout)
    (target / 'build-stderr.log').write_bytes(built.stderr)
    report['build_exit_code'] = built.returncode
    assert built.returncode == 0, 'candidate_build_failed'
    image = (target / 'candidate.iid').read_text(encoding='utf-8').strip()
    report['candidate_image_id'] = image
    base_meta = json.loads(run(['docker', 'image', 'inspect', manifest['base_image_id']]).stdout)[0]
    candidate_meta = json.loads(run(['docker', 'image', 'inspect', image]).stdout)[0]
    assert base_meta['Config'] == candidate_meta['Config'], 'runtime_image_Config_changed'
    assert candidate_meta['RootFS']['Layers'][:-1] == base_meta['RootFS']['Layers'], 'base_layers_changed'
    report['runtime_image_Config_unchanged'] = True
    report['added_layers'] = 1
    old, new = public_source_hashes(manifest['base_image_id']), public_source_hashes(image)
    assert old == manifest['base_public_sources'], 'base_source_inventory_changed'
    assert set(old) == set(new), 'public_source_set_changed'
    delta = {name: {'old_sha256': old[name], 'new_sha256': new[name]}
             for name in sorted(new) if old[name] != new[name]}
    assert set(delta) == set(manifest['image_sources']), 'unexpected_public_source_delta'
    assert all(new[name] == digest for name, digest in manifest['image_sources'].items())
    report['public_source_files_compared'] = len(new)
    report['public_source_delta'] = delta
    report['all_unchanged_public_dependencies_pinned'] = True
    diff = []
    for name in manifest['image_sources']:
        sources = []
        for image_id in (manifest['base_image_id'], image):
            command = "import pathlib,sys;sys.stdout.buffer.write(pathlib.Path('/app',sys.argv[1]).read_bytes())"
            result = run(['docker', 'run', '--rm', '--network=none', '--read-only',
                          '--entrypoint=/usr/bin/python', image_id, '-B', '-c', command, name])
            assert result.returncode == 0
            sources.append(result.stdout.decode('utf-8').splitlines(keepends=True))
        diff.extend(difflib.unified_diff(*sources, fromfile='base/' + name, tofile='candidate/' + name))
    (target / 'exact-public-source.diff').write_text(''.join(diff), encoding='utf-8')
    report['exact_public_source_diff_sha256'] = sha((target / 'exact-public-source.diff').read_bytes())
    policy = run(['docker', 'run', '--rm', '--network=none', '--read-only',
                  '--entrypoint=/usr/bin/python', image, '-B', '-c',
                  'from native_execution_agents import mcp_execution_policy_hash;print(mcp_execution_policy_hash())'])
    assert policy.returncode == 0
    report['MCP_execution_policy_sha256'] = policy.stdout.decode().strip()
    assert report['MCP_execution_policy_sha256'] == manifest['expected_MCP_execution_policy_sha256']
    qa = run(['docker', 'run', '--rm', '--network=none', '--read-only', '--user=10001:10001',
              '--memory=2g', '--cpus=2', '--pids-limit=128',
              '--tmpfs=/tmp:rw,nosuid,nodev,size=256m,mode=1777',
              '--mount', f'type=bind,src={test_root},dst=/app/tests,readonly',
              '--entrypoint=/usr/bin/python', image, '-B', '/app/run_tests.py'], 240)
    (target / 'qa-stdout.log').write_bytes(qa.stdout)
    (target / 'qa-stderr.log').write_bytes(qa.stderr)
    report['QA_exit_code'] = qa.returncode
    text = qa.stderr.decode('utf-8', errors='replace')
    count = re.search(r'Ran (\d+) tests? in ([\d.]+)s', text)
    report['Linux_tests_discovered_and_executed'] = int(count[1]) if count else None
    report['Linux_test_seconds'] = float(count[2]) if count else None
    skips = re.search(r'skipped=(\d+)', text)
    report['Linux_runtime_skips'] = int(skips[1]) if skips else 0
    report['QA_logs_sha256'] = {name: sha((target / name).read_bytes()) for name in
                               ('build-stdout.log', 'build-stderr.log', 'qa-stdout.log', 'qa-stderr.log')}
    assert qa.returncode == 0 and report['Linux_tests_discovered_and_executed'] == manifest['expected_applicable_tests']
    assert report['Linux_runtime_skips'] == 0
    report['status'] = 'passed'
except BaseException:
    report['status'] = 'failed'
    raise
finally:
    report['operational_container_unchanged'] = inspect_container() == baseline
    report['owned_offline_container_names'] = owned_offline_containers
    report['owned_offline_containers_remaining'] = sum(
        subprocess.run(['docker', 'container', 'inspect', name], capture_output=True, timeout=30).returncode == 0
        for name in owned_offline_containers)
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    (target / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
