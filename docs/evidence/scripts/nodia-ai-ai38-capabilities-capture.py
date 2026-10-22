"""Read-only per-case Docker log preservation; no provider/session operations."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    root = Path(sys.argv[1])
    assert re.fullmatch(r'/opt/nodia/verification/ai38-live-capabilities-r01/(?:preferences|finance)', str(root))
    assert root.is_dir() and not root.is_symlink()
    driver_path, case_path, guard_path = (root / name for name in ('driver-report.json', 'case-report.json', 'guard-report.json'))
    driver = json.loads(driver_path.read_text(encoding='utf-8'))
    case = json.loads(case_path.read_text(encoding='utf-8'))
    guard = json.loads(guard_path.read_text(encoding='utf-8'))
    attempts = [value['attempt_id'] for value in guard['starts']]
    assert len(set(attempts)) == len(attempts) <= 2
    assert all(re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', value) for value in attempts)
    baseline = driver['runtime_before']
    container_id = baseline['container_id']
    assert re.fullmatch(r'[a-f0-9]{64}', container_id)
    inspected = json.loads(subprocess.run(['docker', 'inspect', container_id], capture_output=True,
                                         check=True, timeout=20).stdout)[0]
    assert inspected['Id'] == container_id and inspected['State']['StartedAt'] == baseline['started_at']
    assert inspected['Image'] == baseline['image']
    since = case['started_at_utc']
    datetime.fromisoformat(since.replace('Z', '+00:00'))
    parser_path = Path('/tmp/nodia-ai-ai38-mcp-r01-terminal-capture.py')
    assert sha(parser_path) == '54e894bc1fe14c3a45fb3b76b81bd17a125611679625adb41f813f4409e0bdc5'
    spec = importlib.util.spec_from_file_location('closed_ai38_projection', parser_path)
    assert spec and spec.loader
    parser = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parser)
    os.umask(0o077)
    raw_path, report_path = root / 'private-docker-window.log', root / 'public-native-capture.json'
    assert not raw_path.exists() and not report_path.exists(), 'preserve_closed_case_capture'
    until = case['finished_at_utc']
    datetime.fromisoformat(until.replace('Z', '+00:00'))
    observed_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    with raw_path.open('xb') as output:
        os.chmod(raw_path, 0o600)
        result = subprocess.run(['docker', 'logs', '--timestamps', '--since', since, '--until', until,
                                 container_id], stdout=output, stderr=subprocess.STDOUT, timeout=45, check=False)
    assert result.returncode == 0, 'private_log_capture_failed'
    projected = {attempt: parser.project_log(raw_path, attempt) for attempt in attempts}
    shared = next(iter(projected.values())) if projected else parser.project_log(raw_path, None)
    after = json.loads(subprocess.run(['docker', 'inspect', container_id], capture_output=True,
                                     check=True, timeout=20).stdout)[0]
    assert after['Id'] == inspected['Id'] and after['State']['StartedAt'] == inspected['State']['StartedAt']
    report = {'stage': 'AI-38', 'scope': 'closed_native_diagnostics_for_one_capability_case',
              'case_id': driver['case_id'], 'observed_at_utc': observed_at,
              'log_window_since_utc': since, 'log_window_until_utc': until,
              'container_id': container_id, 'image': baseline['image'], 'started_at': baseline['started_at'],
              'driver_report_sha256': sha(driver_path), 'case_report_sha256': sha(case_path),
              'guard_report_sha256': sha(guard_path), 'source_sha256': sha(Path(__file__)),
              'parser_sha256': sha(parser_path), 'attempt_ids': attempts,
              'same_container_epoch_after_capture': True,
              'private_log': {'sha256': sha(raw_path), 'bytes': raw_path.stat().st_size,
                              'permissions_octal': oct(raw_path.stat().st_mode & 0o777), 'raw_emitted': False},
              'http_status_counts': shared['http_status_counts'], 'http_route_counts': shared['http_route_counts'],
              'request_guard_error_counts': shared['request_guard_error_counts'],
              'exact_attempt_terminal_diagnostics': {attempt: {
                  'terminals': value['exact_attempt_terminals'],
                  'closed_projection_omissions': value['closed_projection_omissions'],
              } for attempt, value in projected.items()},
              'provider_requests': 0, 'services_restarted': False,
              'reconciliation_or_ACK_performed': False, 'profile_or_credentials_read': False}
    with report_path.open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
