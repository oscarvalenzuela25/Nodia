"""Read-only closure after the bounded Web cohort; never restart/login/replay."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(argv):
    return subprocess.run(argv, capture_output=True, check=True, timeout=60).stdout


def states():
    return {unit: command(['systemctl', 'show', unit, '-p', 'ActiveState', '--value']).decode().strip()
            for unit in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}


def main():
    assert len(sys.argv) == 3
    cohort_path, expected = Path(sys.argv[1]), sys.argv[2]
    assert cohort_path == Path('/opt/nodia/verification/ai38-modalities-web-cohort-01/public-report.json')
    assert re.fullmatch(r'[a-f0-9]{64}', expected) and sha(cohort_path) == expected
    cohort = json.loads(cohort_path.read_text(encoding='utf-8'))
    assert cohort['status'] == 'passed' and cohort['unknown_native_state'] is False
    assert len(cohort['cases']) == 4 and cohort['probe_requests_declared_in_reports'] == 4
    assert all(case['native_state'] == 'closed_acknowledged' and case['probe_result']['native_pending_identity'] is False for case in cohort['cases'])
    native_helper, sql_helper = Path('/tmp/ai32-r04-cleanup.py'), Path('/tmp/nodia-ai-ai36-c05-live-health.mjs')
    assert sha(native_helper) == 'a42831dce6f458af03f8a405014ebd8de8aafda6d39ca60fb00cd24829c243b7'
    assert sha(sql_helper) == 'e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395'
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-modalities-web-closure-01')
    work.mkdir(mode=0o700, exist_ok=False)
    prior_states = states()
    native_bytes = command(['python3', str(native_helper)])
    sql_bytes = command(['/usr/local/bin/node', str(sql_helper), '/opt/nodia/releases/nodia-server-ai15-20261016'])
    (work / 'private-native.json').write_bytes(native_bytes)
    (work / 'private-SQL.json').write_bytes(sql_bytes)
    native, sql = json.loads(native_bytes), json.loads(sql_bytes)
    keys = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
            'temporary_attachment_directories', 'temporary_cli_directories')
    assert all(native[key] == 0 for key in keys)
    assert all(sql[key] == 0 for key in ('pending_jobs', 'open_attempts', 'retained_slots'))
    info = json.loads(command(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    epoch = {'id': info['Id'], 'image': info['Image'], 'started_at_utc': info['State']['StartedAt'], 'running': info['State']['Running']}
    assert epoch == cohort['epoch_before']
    assert states() == prior_states
    root = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
    outputs = {path.relative_to(root).as_posix(): sha(path) for path in sorted((root / 'dist').rglob('*')) if path.is_file()}
    digest = hashlib.sha256(json.dumps(outputs, sort_keys=True).encode()).hexdigest()
    assert len(outputs) == 932 and digest == 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
    report = {'stage': 'AI-38', 'scope': 'post_Web_modalities_read_only_native_SQL_operational_closure',
              'status': 'passed', 'observed_at_utc': datetime.now(timezone.utc).isoformat(),
              'source_sha256': sha(Path(__file__)), 'cohort_sha256': expected,
              'helper_sha256': {'native': sha(native_helper), 'SQL': sha(sql_helper)},
              'native': {key: native[key] for key in keys},
              'SQL': {key: sql[key] for key in ('pending_jobs', 'open_attempts', 'retained_slots')},
              'epoch': epoch, 'service_states_unchanged': prior_states,
              'Node_outputs': 932, 'Node_manifest_sha256': digest,
              'provider_generations': 0, 'configured_SQL_writes': 0, 'profile_bytes_read': False,
              'services_restarted_or_reconfigured': False, 'logout_or_session_reset': False}
    with (work / 'public-report.json').open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
