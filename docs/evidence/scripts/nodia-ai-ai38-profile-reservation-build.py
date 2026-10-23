"""Build COPY-only diagnostic overlay and run Linux QA without live mounts/network.

Input is an exact reviewed archive. Never activate an image or call a provider.
Only new owned offline containers, build files, images and private QA logs exist.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile

ALLOWED_DIAG = {'profile_admission.py', 'main.py', 'nodia_ai_chat.py', 'durable_login.py', 'native_mcp_sessions.py'}


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(payload):
    return hashlib.sha256(payload).hexdigest()


def main(args):
    label = 'ai38-profile-reservation-' + args.phase + '-build-r01'
    archive = Path('/tmp') / (label + '.tar')
    root = Path('/opt/nodia/verification') / label
    require(sha(archive.read_bytes()) == args.archive_sha256 and not root.exists(), 'archive_pin_or_new_work_failed')
    with tarfile.open(archive) as bundle:
        members = bundle.getmembers()
        require(all(m.isfile() and not PurePosixPath(m.name).is_absolute() and
                    '..' not in PurePosixPath(m.name).parts and '\\' not in m.name for m in members), 'unsafe_archive_member')
        require(len({m.name for m in members}) == len(members), 'duplicate_archive_member')
        manifest_bytes = bundle.extractfile('manifest.json').read()
        require(sha(manifest_bytes) == args.manifest_sha256, 'manifest_pin_mismatch')
        manifest = json.loads(manifest_bytes)
        require(manifest['phase'] == args.phase and manifest['label'] == label, 'manifest_phase_invalid')
        expected_files = {'manifest.json', 'context/Dockerfile'} | {'context/' + n for n in manifest['image_sources']} | {'tests/' + n for n in manifest['test_files']}
        require({m.name for m in members} == expected_files, 'archive_inventory_mismatch')
        if args.phase == 'diag':
            require(set(manifest['image_sources']) == ALLOWED_DIAG, 'DIAG_requires_exact_five_sources')
        require(manifest['image_sources'] and len(manifest['image_sources']) <= 12, 'too_many_image_sources')
        expected_dockerfile = ('FROM ' + manifest['base_image_id'] + '\nCOPY ' + ' '.join(sorted(manifest['image_sources'])) + ' /app/\n').encode()
        require(bundle.extractfile('context/Dockerfile').read() == expected_dockerfile, 'COPY_only_Dockerfile_mismatch')
        root.mkdir(mode=0o700)
        for member in members:
            payload = bundle.extractfile(member).read()
            if member.name == 'context/Dockerfile':
                require(sha(payload) == manifest['dockerfile_sha256'], 'Dockerfile_hash_mismatch')
            elif member.name.startswith('context/'):
                require(sha(payload) == manifest['image_sources'][member.name.removeprefix('context/')], 'source_hash_mismatch')
            elif member.name.startswith('tests/'):
                require(sha(payload) == manifest['test_files'][member.name.removeprefix('tests/')], 'test_hash_mismatch')
            target = root / member.name
            target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(payload)
            target.chmod(0o644)
    test_root = root / 'tests'
    test_root.chmod(0o755)
    for path in test_root.rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)
    owned = []

    def run(argv, timeout=120, env=None):
        if argv[:2] != ['docker', 'run']:
            return subprocess.run(argv, capture_output=True, timeout=timeout, check=False, env=env)
        name = label + '-offline-' + str(len(owned) + 1).zfill(2)
        probe = subprocess.run(['docker', 'container', 'inspect', name], capture_output=True, timeout=20, check=False)
        require(probe.returncode == 1 and b'No such' in probe.stderr, 'offline_container_name_not_available')
        owned.append(name)
        try:
            return subprocess.run([*argv[:2], '--name', name, *argv[2:]], capture_output=True, timeout=timeout, check=False, env=env)
        finally:
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=20, check=False)

    def checked(argv, timeout=120, env=None):
        value = run(argv, timeout, env)
        require(value.returncode == 0, 'isolated_command_failed')
        return value.stdout

    def active():
        value = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
        require(value['State']['Running'], 'operational_container_not_running')
        return dict(id=value['Id'], image=value['Image'], started_at=value['State']['StartedAt'])

    def metadata(image):
        program = """import hashlib,json,pathlib,importlib.metadata
root=pathlib.Path('/app'); distributions=sorted((d.metadata['Name'],d.version) for d in importlib.metadata.distributions())
print(json.dumps({'public_python_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*.py') if p.is_file() and not p.is_symlink()},'requirements_sha256':hashlib.sha256((root/'requirements.txt').read_bytes()).hexdigest(),'distribution_inventory':distributions,'distribution_count':len(distributions)}))
"""
        return json.loads(checked(['docker', 'run', '--rm', '--network=none', '--read-only', '--user=10001:10001',
                      '--entrypoint=/usr/bin/python', image, '-B', '-c', program]))

    baseline = active()
    require(baseline == manifest['expected_operational_epoch'], 'operational_epoch_pin_mismatch')
    report = dict(scope='COPY_only_profile_reservation_image_offline_build_and_Linux_tests', status='running',
                  phase=args.phase, started_at_utc=datetime.now(timezone.utc).isoformat(),
                  manifest_sha256=args.manifest_sha256, archive_sha256=args.archive_sha256,
                  source_sha256=sha(Path(__file__).read_bytes()), baseline=baseline,
                  image_sources=manifest['image_sources'], test_files=manifest['test_files'],
                  build_and_QA_network='none', QA_user='10001:10001', QA_root_read_only=True,
                  only_tests_mounted=True, operational_profiles_environment_or_credentials_mounted=False,
                  service_changes=0, provider_requests=0, candidate_activated=False)
    try:
        old_meta = metadata(manifest['base_image_id'])
        require(old_meta['public_python_hashes'] == manifest['base_public_python_hashes'], 'base_source_pin_mismatch')
        report['baseline_public_source_count'] = len(old_meta['public_python_hashes'])
        report['baseline_requirements_sha256'] = old_meta['requirements_sha256']
        report['baseline_distribution_inventory'] = old_meta['distribution_inventory']
        report['baseline_distribution_count'] = old_meta['distribution_count']
        built = run(['docker', 'build', '--pull=false', '--network=none', '--no-cache', '--force-rm',
                     '--iidfile', str(root / 'candidate.iid'), str(root / 'context')], 300,
                    env={**os.environ, 'DOCKER_BUILDKIT': '0'})
        for name, payload in (('build-stdout.log', built.stdout), ('build-stderr.log', built.stderr)):
            (root / name).write_bytes(payload)
        report['build_exit'] = built.returncode
        require(built.returncode == 0, 'candidate_build_failed')
        image = (root / 'candidate.iid').read_text().strip()
        require(re.fullmatch('sha256:[a-f0-9]{64}', image), 'image_id_invalid')
        report['candidate_image_id'] = image
        old_config, new_config = [json.loads(checked(['docker', 'image', 'inspect', item]))[0] for item in (manifest['base_image_id'], image)]
        require(old_config['Config'] == new_config['Config'], 'image_Config_changed')
        require(new_config['RootFS']['Layers'][:-1] == old_config['RootFS']['Layers'], 'image_base_layers_changed')
        new_meta = metadata(image)
        require(old_meta['requirements_sha256'] == new_meta['requirements_sha256'] and
                old_meta['distribution_inventory'] == new_meta['distribution_inventory'], 'dependency_inventory_changed')
        old, new = old_meta['public_python_hashes'], new_meta['public_python_hashes']
        require(set(old) == set(new), 'public_source_set_changed')
        delta = {n for n in new if old[n] != new[n]}
        require(delta == set(manifest['image_sources']) and
                all(new[n] == pin for n, pin in manifest['image_sources'].items()), 'unexpected_public_source_delta')
        report.update(public_source_count=len(new), public_source_delta={n: dict(old_sha256=old[n], new_sha256=new[n]) for n in sorted(delta)},
                      target_public_python_hashes=new, image_Config_unchanged=True, added_layers=1,
                      requirements_unchanged=True, distribution_inventory_unchanged=True)
        qa = run(['docker', 'run', '--rm', '--network=none', '--read-only', '--user=10001:10001',
                  '--memory=2g', '--cpus=2', '--pids-limit=128',
                  '--tmpfs=/tmp:rw,nosuid,nodev,size=256m,mode=1777',
                  '--mount', 'type=bind,src=' + str(test_root) + ',dst=/app/tests,readonly',
                  '--entrypoint=/usr/bin/python', image, '-B', '/app/run_tests.py'], 300)
        for name, payload in (('qa-stdout.log', qa.stdout), ('qa-stderr.log', qa.stderr)):
            (root / name).write_bytes(payload)
        text = qa.stderr.decode('utf-8', errors='replace')
        count = re.search(r'Ran (\d+) tests? in ([\d.]+)s', text)
        skipped = re.search(r'skipped=(\d+)', text)
        report.update(Linux_QA_exit=qa.returncode, Linux_tests_discovered_and_executed=int(count[1]) if count else None,
                      Linux_runtime_skips=int(skipped[1]) if skipped else 0,
                      QA_log_hashes={name: sha((root / name).read_bytes()) for name in ('qa-stdout.log', 'qa-stderr.log', 'build-stdout.log', 'build-stderr.log')})
        require(qa.returncode == 0 and count is not None and int(count[1]) > 0 and report['Linux_runtime_skips'] == 0,
                'isolated_Linux_QA_failed')
        report['status'] = 'passed'
    except Exception as error:
        report.update(status='failed', failure_code=str(error) if isinstance(error, ValueError) and
                      re.fullmatch('[A-Za-z_]{1,100}', str(error)) else 'isolated_operation_failed')
    finally:
        report['operational_epoch_unchanged'] = active() == baseline
        report['owned_offline_containers_remaining'] = sum(subprocess.run(['docker', 'container', 'inspect', name],
            capture_output=True, timeout=15, check=False).returncode == 0 for name in owned)
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        require(not (root / 'report.json').exists(), 'report_replacement_forbidden')
        (root / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' and report['operational_epoch_unchanged'] and report['owned_offline_containers_remaining'] == 0 else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=('diag', 'fix'), required=True)
    parser.add_argument('--archive-sha256', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    arguments = parser.parse_args()
    raise SystemExit(main(arguments))
