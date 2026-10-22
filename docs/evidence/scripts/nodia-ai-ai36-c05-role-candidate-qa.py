"""Applicable-image offline QA, with explicit absent C03 test exclusion."""
from datetime import datetime, timezone
import difflib
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

sha = lambda b: hashlib.sha256(b).hexdigest()
source = Path('/opt/nodia/verification/ai36-c05-role-candidate-build02')
target = Path('/opt/nodia/verification/ai36-c05-role-candidate-qa03')
assert not target.exists()
target.mkdir(mode=0o700)
manifest = json.loads((source / 'manifest.json').read_text())
expected = json.loads(Path(sys.argv[1]).read_text())
image = (source / 'candidate.iid').read_text().strip()
assert image == 'sha256:3f004c6c170ea79d16a544a788a5189f3afc17d3d68d465cb5092c3099cd0404'
tests = target / 'tests'
shutil.copytree(source / 'tests', tests)
excluded = 'test_invoice_mcp_contract.py'
excluded_bytes = (tests / excluded).read_bytes()
assert len(re.findall(rb'    def test_', excluded_bytes)) == 15
(tests / excluded).unlink()
for p in tests.rglob('*'):
    p.chmod(0o755 if p.is_dir() else 0o644)
tests.chmod(0o755)

def run(args, timeout=120):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout)

def public_source(image_id, name):
    assert re.fullmatch(r'[a-z_]+\.py', name)
    cmd = "from pathlib import Path;import sys;sys.stdout.buffer.write(Path('/app/' + sys.argv[1]).read_bytes())"
    p = run(['docker', 'run', '--rm', '--network=none', '--read-only', '--entrypoint=/usr/bin/python', image_id, '-B', '-c', cmd, name])
    assert p.returncode == 0
    return p.stdout

report = {'stage': 'AI-36-C05-R01', 'scope': 'immutable_candidate_applicable_Linux_unit_QA', 'status': 'running',
          'candidate_image_id': image, 'base_image_id': manifest['base_image_id'],
          'source_manifest_sha256': sha((source / 'manifest.json').read_bytes()),
          'source_runner_sha256': sha(Path(__file__).read_bytes()),
          'started_at_utc': datetime.now(timezone.utc).isoformat(),
          'excluded_test_file': {'path': excluded, 'sha256': sha(excluded_bytes), 'test_methods': 15,
             'reason': 'C03_invoice_MCP_contract_absent_from_approved_base_and_candidate_image'},
          'expected_applicable_tests': 430, 'expected_runtime_skips': 0,
          'provider_generations': 0, 'real_provider_requests': 0, 'candidate_activated': False,
          'service_restarts': 0, 'network': 'none', 'read_only_root_filesystem': True,
          'environment_profile_or_credentials_mounted': False,
          'test_files_read_only_mounted': True, 'image_sources_not_overridden': True,
          'production_dependency_comparison': {}}
try:
    # Checks local/candidate parity without replacing the consumed production code.
    for name, local_hash in expected.items():
        actual = sha(public_source(image, name))
        report['production_dependency_comparison'][name] = {'local_sha256': local_hash, 'candidate_sha256': actual, 'equal': actual == local_hash}
    diffs = []
    for name, new_hash in manifest['image_sources'].items():
        before = public_source(manifest['base_image_id'], name)
        after = public_source(image, name)
        assert sha(after) == new_hash
        diffs.extend(difflib.unified_diff(before.decode().splitlines(True), after.decode().splitlines(True), fromfile='base/' + name, tofile='candidate/' + name))
    (target / 'exact-public-source.diff').write_text(''.join(diffs))
    report['exact_public_source_diff_sha256'] = sha((target / 'exact-public-source.diff').read_bytes())
    qa = run(['docker', 'run', '--rm', '--network=none', '--read-only', '--user=10001:10001',
          '--memory=2g', '--cpus=2', '--pids-limit=128', '--tmpfs=/tmp:rw,nosuid,nodev,size=256m,mode=1777',
          '--mount', f'type=bind,src={tests},dst=/app/tests,readonly',
          '--entrypoint=/usr/bin/python', image, '-B', '/app/run_tests.py'], 240)
    (target / 'qa-stdout.log').write_bytes(qa.stdout)
    (target / 'qa-stderr.log').write_bytes(qa.stderr)
    report['QA_exit_code'] = qa.returncode
    text = qa.stderr.decode('utf-8', errors='replace')
    counts = re.search(r'Ran (\d+) tests? in ([\d.]+)s', text)
    report['Linux_tests_total'] = int(counts.group(1)) if counts else None
    report['Linux_test_seconds'] = float(counts.group(2)) if counts else None
    report['Linux_skips'] = int(re.search(r'skipped=(\d+)', text).group(1)) if re.search(r'skipped=(\d+)', text) else 0
    report['test_logs_sha256'] = {n: sha((target / n).read_bytes()) for n in ('qa-stdout.log', 'qa-stderr.log')}
    assert qa.returncode == 0 and report['Linux_tests_total'] == 430 and report['Linux_skips'] == 0
    report['status'] = 'passed'
except BaseException:
    report['status'] = 'failed'
    raise
finally:
    current = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
    report['operational_container_unchanged'] = current['Image'] == manifest['base_image_id'] and current['Id'] == 'c3cdfb9ca3ab71eff4735c344ae0c0d83400b497eb104af21496b593b1bad8af'
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    (target / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
