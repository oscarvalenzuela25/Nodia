"""Fresh non-generative post-resume observation; no restart, /start or replay.

Usage: python3 SCRIPT LIVE_ROOT LIVE_REPORT_SHA CONTAINER_ID STARTED_AT API_ENV
One immutable output: /opt/nodia/verification/ai38-mcp-r01-postresume-observe01.
"""
from datetime import datetime, timezone
from http.client import HTTPConnection
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def container():
    result = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'],
                            capture_output=True, timeout=15, check=True)
    value = json.loads(result.stdout)[0]
    return {'id': value['Id'], 'image': value['Image'], 'started_at_utc': value['State']['StartedAt'],
            'running': value['State']['Running']}


def main():
    assert len(sys.argv) == 6
    live, expected_report, expected_container, expected_started, api_env = sys.argv[1:]
    live, api_env = Path(live), Path(api_env)
    assert live == Path('/opt/nodia/verification/ai38-mcp-r01-live01') and api_env.is_absolute() and api_env.is_file()
    assert re.fullmatch(r'[a-f0-9]{64}', expected_report)
    assert re.fullmatch(r'[a-f0-9]{64}', expected_container)
    assert re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z', expected_started)
    live_report = live / 'public-report.json'
    assert sha(live_report) == expected_report
    previous = json.loads(live_report.read_text(encoding='utf-8'))
    assert previous['status'] == 'passed' and previous['native_pending_identity'] is False
    previous_native = previous['native_result']
    assert previous_native['diagnostic_nonce_verified'] is True and previous_native['supports_mcp_after'] is True
    expected = previous_native['diagnostics']
    overlay = live / 'nodia-server'
    harness = overlay / 'test/nodia-ai-ai38-mcp-diagnostic.mjs'
    assert sha(harness) == previous['harness_sha256']
    candidate = (overlay / 'dist').resolve(strict=True).parent
    assert sha(candidate / 'manifest.json') == previous['candidate_manifest_sha256']
    assert (overlay / 'node_modules').resolve(strict=True) == Path('/opt/nodia/nodia-server/node_modules')
    private_selection = live / 'private-selection.json'
    assert sha(private_selection) == previous['selection_sha256']
    before = container()
    assert before['running'] is True and before['id'] == expected_container and before['started_at_utc'] == expected_started
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-mcp-r01-postresume-observe01')
    work.mkdir(mode=0o700, exist_ok=False)
    private_report = work / 'private-native-report.json'
    report = {'stage': 'AI-38-MCP-R01', 'scope': 'post_resume_exact_epoch_non_generative_MCP_observation',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'source_sha256': sha(Path(__file__)), 'live_report_sha256': expected_report,
              'harness_sha256': previous['harness_sha256'], 'container_before': before,
              'provider_generations': 0, 'configured_SQL_writes': 0,
              'services_restarted': False, 'native_ACK_or_reconcile_requested': False,
              'resource_key_historical_comparison': 'not_recorded_in_live_report',
              'raw_logs_retained_privately': True}
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(Path.home()),
                   'NODE_ENV': 'test', 'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null',
                   'NODIA_AI_ALLOW_LIVE': 'yes', 'NODIA_AI_ATTEST_CONFIGURED_DB': 'read_only',
                   'NODIA_AI_LAB_API_ENV': str(api_env), 'NODIA_AI_LAB_SELECTION_JSON': str(private_selection),
                   'NODIA_AI_LAB_REPORT_JSON': str(private_report)}
    code = 1
    with (work / 'private-stdout.log').open('xb') as stdout, (work / 'private-stderr.log').open('xb') as stderr:
        try:
            # AppController exposes GET / with main.ts global /api/v1 prefix. This is HTTP availability,
            # not a database/dependency readiness claim; no response body is retained.
            health = HTTPConnection('127.0.0.1', 3000, timeout=10)
            try:
                health.request('GET', '/api/v1/')
                response = health.getresponse()
                report['api_public_root_http_status'] = response.status
                response.read(1024)
                assert response.status == 200
            finally:
                health.close()
            result = subprocess.run(['/usr/local/bin/node', str(harness), '--observe-only'], cwd=overlay,
                                    env=environment, stdout=stdout, stderr=stderr, timeout=120)
            code = result.returncode
            assert code == 0
            native = json.loads(private_report.read_text(encoding='utf-8'))
            assert native['status'] == 'passed' and native['native_pending_identity'] is False
            assert native['real_provider_dispatch_requests'] == native['maximum_provider_dispatch_requests'] == 0
            assert native['configured_database_read_only'] is True
            assert native['configured_database_modified'] is False and native['configured_selection_modified'] is False
            assert native['supports_mcp_before'] is True and native['supports_mcp_after'] is True
            diagnostic = native['diagnostics']
            for key in ('selection', 'configuration_generation', 'session_generation'):
                assert diagnostic[key] == expected[key]
            endpoints = diagnostic['endpoints']
            assert endpoints['observe'] == {'requests': 2, 'completed': 2, 'failed': 0}
            for endpoint in ('start', 'events', 'results', 'attest', 'cancel', 'reconcile', 'acknowledge'):
                assert endpoints[endpoint] == {'requests': 0, 'completed': 0, 'failed': 0}
            assert diagnostic['attempt_id'] is None and diagnostic['start_admission'] == 'not_requested'
            assert diagnostic['callbacks'] is None and diagnostic['last_rpc_messages'] is None
            after = container()
            assert after == before
            services = {}
            for unit in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'):
                observation = subprocess.run(['systemctl', 'show', unit, '-p', 'ActiveState', '--value'],
                                             capture_output=True, timeout=15, check=True)
                services[unit] = observation.stdout.decode().strip()
            assert set(services.values()) == {'active'}
            report.update(status='passed', same_selection_configuration_session_and_epoch=True,
                          supports_mcp_before=True, supports_mcp_after=True,
                          metadata_requests=2, container_after=after, services=services,
                          native_pending_identity=False, provider_dispatch_requests=0,
                          selection=expected['selection'], configuration_generation=expected['configuration_generation'],
                          session_generation=expected['session_generation'])
        except Exception as error:
            code = 1
            report['status'] = 'failed_non_generative_observation_no_retry'
            report['failure_class'] = type(error).__name__
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    report['private_log_hashes'] = {name: sha(work / name) for name in ('private-stdout.log', 'private-stderr.log')}
    with (work / 'public-report.json').open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return code


if __name__ == '__main__':
    sys.exit(main())
