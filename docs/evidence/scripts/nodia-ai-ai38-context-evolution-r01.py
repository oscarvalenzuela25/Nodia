"""VM-only isolated evolution runner; no operational env, service or provider calls.

DRIVER PAYLOAD_TAR TAR_SHA CANDIDATE_ROOT CANDIDATE_MANIFEST_SHA ATTEMPT_ID
Only this attempt's exact fixture prefix is eligible for emergency cleanup.
"""
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import tarfile


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def docker_inventory():
    result = subprocess.run(['docker', 'ps', '-a', '--format', '{{.ID}} {{.Names}}'],
                            capture_output=True, check=True, timeout=15)
    return dict(line.split(' ', 1)[::-1] for line in result.stdout.decode().splitlines())


def main():
    assert len(sys.argv) == 6
    payload, expected, candidate, expected_manifest, attempt = sys.argv[1:]
    payload, candidate = Path(payload), Path(candidate)
    assert payload.is_absolute() and candidate.is_absolute()
    assert candidate.resolve().is_relative_to('/opt/nodia/verification')
    assert re.fullmatch(r'[a-z0-9-]{1,40}', attempt)
    assert digest(payload.read_bytes()) == expected
    manifest_raw = (candidate / 'manifest.json').read_bytes()
    assert digest(manifest_raw) == expected_manifest
    manifest = json.loads(manifest_raw)
    for name, sha in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert digest((candidate / relative).read_bytes()) == sha
    os.umask(0o077)
    work = Path('/opt/nodia/verification') / ('ai38-context-evolution-' + attempt)
    work.mkdir(mode=0o700, exist_ok=False)
    overlay = work / 'nodia-server'
    overlay.mkdir(mode=0o700)
    with tarfile.open(payload) as archive:
        members = archive.getmembers()
        for member in members:
            relative = PurePosixPath(member.name)
            assert member.isfile() and not relative.is_absolute() and '..' not in relative.parts
            assert relative.parts[0] in ('test', 'scripts', 'fixture-contract-sources')
            assert not any(part.startswith('.') for part in relative.parts)
            assert member.size <= 2 * 1024 * 1024
        archive.extractall(overlay, members=members, filter='data')
    for name in ('dist', 'package.json', 'package-lock.json', 'node_modules'):
        (overlay / name).symlink_to(candidate / name, target_is_directory=name in ('dist', 'node_modules'))
    before = docker_inventory()
    report = {'stage': 'AI-38', 'scope': 'isolated_product_context_evolution_runner',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'payload_sha256': expected, 'candidate_manifest_sha256': expected_manifest,
              'driver_sha256': digest(Path(__file__).read_bytes()), 'provider_generations': 0,
              'configured_database_access': False, 'operational_publication': False,
              'operational_adoption': False, 'candidate_files_unchanged': None}
    target = work / 'report.json'

    def save():
        target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    save()
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(work),
                   'NODE_ENV': 'test', 'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null',
                   'NODIA_AI_EVOLUTION_OUTPUT': str(work / 'integration.json')}
    process = None
    try:
        with (work / 'stdout.log').open('xb') as out, (work / 'stderr.log').open('xb') as err:
            process = subprocess.Popen(['/usr/local/bin/node', str(overlay / 'test/nodia-ai-ai38-context-evolution.mjs')],
                                       cwd=overlay, env=environment, stdout=out, stderr=err, start_new_session=True)
            try:
                code = process.wait(timeout=300)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                code = 124
        report['exit_code'] = code
        if (work / 'integration.json').exists():
            report['integration'] = json.loads((work / 'integration.json').read_text(encoding='utf-8'))
        report['status'] = 'passed' if code == 0 and report.get('integration', {}).get('status') == 'passed' else 'failed'
    finally:
        current = docker_inventory()
        owned_prefix = 'template_ai3801_' + str(process.pid) + '_' if process else None
        removed = []
        for name in current:
            if owned_prefix and name.startswith(owned_prefix) and re.fullmatch(re.escape(owned_prefix) + r'[a-f0-9]{8}', name):
                assert name not in before
                subprocess.run(['docker', 'rm', '-f', name], capture_output=True, check=True, timeout=20)
                removed.append(name)
        report['emergency_fixture_containers_removed'] = removed
        after = docker_inventory()
        report['preexisting_container_identities_preserved'] = all(after.get(name) == identity for name, identity in before.items())
        report['owned_fixture_containers_remaining'] = [name for name in after if owned_prefix and name.startswith(owned_prefix)]
        report['candidate_files_unchanged'] = all(digest((candidate / name).read_bytes()) == sha for name, sha in manifest['files'].items())
        report['log_sha256'] = {name: digest((work / name).read_bytes()) for name in ('stdout.log', 'stderr.log')}
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        if not report['preexisting_container_identities_preserved'] or report['owned_fixture_containers_remaining'] or not report['candidate_files_unchanged']:
            report['status'] = 'failed'
        save()
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
