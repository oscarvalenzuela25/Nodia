"""Build immutable public candidate and test it offline; never activate services."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

archive = Path('/tmp/ai36-c05-role-candidate-build01.tar')
expected_archive_sha = sys.argv[1]
assert re.fullmatch(r'[a-f0-9]{64}', expected_archive_sha)
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha(archive.read_bytes()) == expected_archive_sha
target = Path('/opt/nodia/verification/ai36-c05-role-candidate-build02')
assert not target.exists()
target.mkdir(mode=0o700)
with tarfile.open(archive) as bundle:
    assert all(not m.issym() and not m.islnk() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in bundle)
    bundle.extractall(target, filter='data')
manifest = json.loads((target / 'manifest.json').read_text())
assert set(p.name for p in (target / 'context').iterdir()) == {'Dockerfile', *manifest['image_sources']}
for name, digest in manifest['image_sources'].items():
    assert sha((target / 'context' / name).read_bytes()) == digest
assert sha((target / 'context/Dockerfile').read_bytes()) == manifest['dockerfile_sha256']
assert set(p.relative_to(target / 'tests').as_posix() for p in (target / 'tests').rglob('*') if p.is_file()) == set(manifest['test_files'])
for name, digest in manifest['test_files'].items():
    assert sha((target / 'tests' / name).read_bytes()) == digest
for p in (target / 'tests').rglob('*'):
    p.chmod(0o755 if p.is_dir() else 0o644)
(target / 'tests').chmod(0o755)

def run(args, timeout=120, env=None):
    return subprocess.run(args, capture_output=True, timeout=timeout, check=False, env=env)

base = manifest['base_image_id']
current = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
assert current['Image'] == base
baseline = {'container_id': current['Id'], 'image_id': current['Image'], 'started_at': current['State']['StartedAt']}
report = {'stage': 'AI-36-C05-R01', 'scope': manifest['scope'], 'started_at_utc': datetime.now(timezone.utc).isoformat(),
          'status': 'running', 'baseline_container': baseline, 'archive_sha256': expected_archive_sha,
          'manifest_sha256': sha((target / 'manifest.json').read_bytes()),
          'image_source_hashes': manifest['image_sources'], 'public_test_files': len(manifest['test_files']),
          'provider_generations': 0, 'services_restarted': False, 'candidate_activated': False,
          'test_sources_mount_only': True, 'operational_environment_or_profile_mounts': False,
          'network': 'none', 'root_filesystem_read_only': True}
try:
    # Classic builder accepts the verified local image ID; BuildKit treats its
    # sha256 prefix as a registry repository, even with --pull=false.
    built = run(['docker', 'build', '--pull=false', '--network=none', '--no-cache', '--iidfile', str(target / 'candidate.iid'), str(target / 'context')], 300,
                env={**os.environ, 'DOCKER_BUILDKIT': '0'})
    (target / 'build-stdout.log').write_bytes(built.stdout)
    (target / 'build-stderr.log').write_bytes(built.stderr)
    report['build_exit_code'] = built.returncode
    assert built.returncode == 0, 'candidate_build_failed'
    image = (target / 'candidate.iid').read_text().strip()
    report['candidate_image_id'] = image
    base_meta = json.loads(run(['docker', 'image', 'inspect', base]).stdout)[0]
    new_meta = json.loads(run(['docker', 'image', 'inspect', image]).stdout)[0]
    assert base_meta['Config'] == new_meta['Config'], 'image_runtime_config_changed'
    assert new_meta['RootFS']['Layers'][:-1] == base_meta['RootFS']['Layers'], 'base_layers_changed'
    report['runtime_image_config_unchanged'] = True
    report['added_image_layers'] = 1
    # Public app source hashes only. No recursive account/profile enumeration.
    projection = "import hashlib,json,pathlib;print(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('/app').glob('*.py') if p.is_file()},sort_keys=True))"
    def source_hashes(image_id):
        proc = run(['docker', 'run', '--rm', '--network=none', '--read-only', '--entrypoint=/usr/bin/python', image_id, '-B', '-c', projection])
        assert proc.returncode == 0
        return json.loads(proc.stdout)
    old = source_hashes(base)
    new = source_hashes(image)
    assert set(old) == set(new)
    changed = {name: {'old_sha256': old[name], 'new_sha256': new[name]} for name in sorted(new) if old[name] != new[name]}
    assert set(changed) == set(manifest['image_sources'])
    assert all(new[n] == h for n, h in manifest['image_sources'].items())
    report['public_source_delta'] = changed
    report['public_source_files_compared'] = len(new)
    qa = run(['docker', 'run', '--rm', '--network=none', '--read-only', '--user=10001:10001',
              '--memory=2g', '--cpus=2', '--pids-limit=128', '--tmpfs=/tmp:rw,nosuid,nodev,size=256m,mode=1777',
              '--mount', f'type=bind,src={target / "tests"},dst=/app/tests,readonly',
              '--entrypoint=/usr/bin/python', image, '-B', '/app/run_tests.py'], 240)
    (target / 'qa-stdout.log').write_bytes(qa.stdout)
    (target / 'qa-stderr.log').write_bytes(qa.stderr)
    report['QA_exit_code'] = qa.returncode
    text = qa.stderr.decode('utf-8', errors='replace')
    counts = re.search(r'Ran (\d+) tests? in ([\d.]+)s', text)
    report['Linux_tests_total'] = int(counts.group(1)) if counts else None
    report['Linux_test_seconds'] = float(counts.group(2)) if counts else None
    report['Linux_skips'] = int(re.search(r'skipped=(\d+)', text).group(1)) if re.search(r'skipped=(\d+)', text) else 0
    report['QA_logs'] = {n: sha((target / n).read_bytes()) for n in ('qa-stdout.log', 'qa-stderr.log', 'build-stdout.log', 'build-stderr.log')}
    assert qa.returncode == 0 and report['Linux_tests_total'] == 445, 'isolated_candidate_QA_failed'
    report['status'] = 'passed'
except BaseException:
    report['status'] = 'failed'
    raise
finally:
    after = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
    report['operational_container_unchanged'] = baseline == {'container_id': after['Id'], 'image_id': after['Image'], 'started_at': after['State']['StartedAt']}
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    (target / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
