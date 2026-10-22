"""Scoped, reversible nginx body-limit change for the Linux lab.

Root reviews and executes this file serially. No provider call, API restart,
token, database write, public listener or upload is performed by this driver.
The snippet is inlined so the deployed config has no workstation dependency.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


SITE = Path('/etc/nginx/sites-available/nodia-lab')
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')
BEGIN = b'    # BEGIN nodia-ai-attachment-content/1\n'
END = b'    # END nodia-ai-attachment-content/1\n'
API_LOCATION = b'    location /api/v1 {\n'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def command(args):
    result = subprocess.run(args, capture_output=True, timeout=30, check=False)
    if result.returncode:
        raise RuntimeError('command_failed_' + Path(args[0]).name)
    return result.stdout


def services():
    result = {}
    for name in UNITS:
        raw = command(['systemctl', 'show', name, '-p', 'ActiveState', '-p', 'MainPID',
                       '-p', 'ExecMainStartTimestampMonotonic']).decode()
        result[name] = dict(line.split('=', 1) for line in raw.splitlines() if '=' in line)
        assert result[name]['ActiveState'] == 'active', 'all_four_services_must_be_active'
        assert int(result[name]['MainPID']) >= 0
        if name != 'nodia-gemini-lab':
            assert int(result[name]['MainPID']) > 0
    return result


def freeze(path, value):
    with path.open('x', encoding='utf-8') as output:
        output.write(json.dumps(value, indent=2) + '\n')


def render(original, snippet):
    assert original.count(API_LOCATION) == 1, 'unexpected_API_location_shape'
    assert original.count(b'client_max_body_size 11m;') == 1, 'unexpected_global_limit'
    assert BEGIN not in original and END not in original, 'owned_block_already_present'
    assert b'client_max_body_size 20m;' in snippet
    assert snippet.count(b'location ') == 1
    assert b'proxy_pass http://127.0.0.1:3000;' in snippet
    assert b'include ' not in snippet and b'listen ' not in snippet
    # The comment says "Include", with an upper-case I; there are no directives.
    block = BEGIN + b''.join(b'    ' + line + b'\n' for line in snippet.splitlines()) + END
    return original.replace(API_LOCATION, block + API_LOCATION, 1)


def replace_site(data, mode, uid, gid):
    descriptor, temporary = tempfile.mkstemp(prefix='.nodia-ai38-proxy-', dir=SITE.parent)
    path = Path(temporary)
    try:
        os.fchmod(descriptor, mode)
        os.fchown(descriptor, uid, gid)
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(path, SITE)
    finally:
        if path.exists():
            path.unlink()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=('apply', 'revert'))
    parser.add_argument('--work', required=True)
    parser.add_argument('--expected-site-sha256', required=True)
    parser.add_argument('--snippet')
    parser.add_argument('--snippet-sha256')
    args = parser.parse_args()
    assert os.geteuid() == 0
    assert re.fullmatch(r'[0-9a-f]{64}', args.expected_site_sha256)
    work = Path(args.work)
    assert re.fullmatch(r'/opt/nodia/verification/ai38-proxy-r[0-9]{2}', str(work))
    assert work.resolve() == work and not work.is_symlink()
    assert SITE.is_file() and not SITE.is_symlink()
    original = SITE.read_bytes()
    assert sha(original) == args.expected_site_sha256, 'site_changed_since_review'
    before = services()
    stat = SITE.stat()
    report_path = work / (args.phase + '.json')
    report = {'phase': args.phase, 'status': 'failed',
              'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'source_sha256': sha(Path(__file__).read_bytes()),
              'site_before_sha256': sha(original), 'services_before': before,
              'API_or_provider_restarts_requested': False,
              'database_writes_or_provider_calls': 0}
    if args.phase == 'apply':
        assert not work.exists(), 'work_directory_already_exists'
        assert args.snippet and re.fullmatch(r'[0-9a-f]{64}', args.snippet_sha256 or '')
        snippet = Path(args.snippet).read_bytes()
        assert sha(snippet) == args.snippet_sha256, 'snippet_changed_since_review'
        desired = render(original, snippet)
        work.mkdir(mode=0o700)
        (work / 'original-site').write_bytes(original)
        os.chmod(work / 'original-site', 0o600)
        report['snippet_sha256'] = sha(snippet)
    else:
        assert work.is_dir() and work.stat().st_mode & 0o077 == 0
        applied = json.loads((work / 'apply.json').read_text())
        assert applied['status'] == 'passed'
        assert sha(original) == applied['site_after_sha256'], 'refuse_changed_owned_config'
        desired = (work / 'original-site').read_bytes()
        assert sha(desired) == applied['site_before_sha256']
    assert not report_path.exists(), 'refuse_receipt_overwrite'
    replaced = False
    try:
        command(['/usr/sbin/nginx', '-t'])
        replace_site(desired, stat.st_mode & 0o7777, stat.st_uid, stat.st_gid)
        replaced = True
        command(['/usr/sbin/nginx', '-t'])
        command(['systemctl', 'reload', 'nginx'])
        after = services()
        assert after == before, 'service_identity_changed'
        assert SITE.read_bytes() == desired
        report.update(status='passed', site_after_sha256=sha(desired),
                      nginx_test_passed=True, nginx_reload_passed=True,
                      services_after=after, rollback_of_database=False)
    except Exception as error:
        report['error_type'] = type(error).__name__
        if replaced:
            replace_site(original, stat.st_mode & 0o7777, stat.st_uid, stat.st_gid)
            command(['/usr/sbin/nginx', '-t'])
            command(['systemctl', 'reload', 'nginx'])
            report['failed_phase_config_restored'] = SITE.read_bytes() == original
        raise
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        freeze(report_path, report)
        print(json.dumps(report))


if __name__ == '__main__':
    main()
