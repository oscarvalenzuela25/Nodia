"""Pinned real routing acceptance runner; never activate, restart, overwrite or retry.

Preflight performs SQL/DI/metadata only. Live permits at most five adapter starts:
Web plain, Web delegation, Agentic discovery, Agentic execution, next-turn Web.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect():
    value = json.loads(subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'],
                                     capture_output=True, timeout=15, check=True).stdout)[0]
    return {'id': value['Id'], 'image': value['Image'], 'started_at_utc': value['State']['StartedAt'],
            'running': value['State']['Running']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', choices=('preflight', 'routing'), required=True)
    parser.add_argument('--attempt', required=True)
    for name in ('candidate', 'manifest-sha', 'harness', 'harness-sha', 'expected-mcp-report',
                 'expected-mcp-sha', 'api-env', 'container-id', 'container-started-at'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    assert re.fullmatch(r'0[1-9]', args.attempt)
    for digest in (args.manifest_sha, args.harness_sha, args.expected_mcp_sha, args.container_id):
        assert re.fullmatch(r'[a-f0-9]{64}', digest)
    assert re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z', args.container_started_at)
    candidate, harness, expected_mcp, api_env = map(Path, (args.candidate, args.harness, args.expected_mcp_report, args.api_env))
    assert candidate == Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
    assert all(value.is_absolute() and value.is_file() for value in (harness, expected_mcp, api_env))
    assert sha(candidate / 'manifest.json') == args.manifest_sha
    assert sha(harness) == args.harness_sha and sha(expected_mcp) == args.expected_mcp_sha
    manifest = json.loads((candidate / 'manifest.json').read_text(encoding='utf-8'))
    for name, digest in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert sha(candidate / relative) == digest
    assert not (candidate / '.env').exists()
    assert (candidate / 'node_modules').resolve(strict=True) == Path('/opt/nodia/nodia-server/node_modules')
    before = inspect()
    assert before['id'] == args.container_id and before['started_at_utc'] == args.container_started_at and before['running'] is True
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-routing-' + args.phase + args.attempt)
    work.mkdir(mode=0o700, exist_ok=False)
    overlay = work / 'nodia-server'
    (overlay / 'test').mkdir(mode=0o700, parents=True)
    for name in ('dist', 'package.json', 'package-lock.json', 'node_modules'):
        (overlay / name).symlink_to(candidate / name)
    fixture_name = 'test/nodia-ai.integration.fixture.mjs'
    fixture_bytes = (candidate / fixture_name).read_bytes()
    assert hashlib.sha256(fixture_bytes).hexdigest() == manifest['files'][fixture_name]
    with (overlay / fixture_name).open('xb') as stream:
        stream.write(fixture_bytes)
    target = overlay / 'test/nodia-ai-ai38-live-routing.mjs'
    with target.open('xb') as stream:
        stream.write(harness.read_bytes())
    private_output = work / 'private-native-report.json'
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(Path.home()), 'NODE_ENV': 'test',
                   'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null',
                   'NODIA_AI_ALLOW_LIVE': 'yes', 'NODIA_AI_ATTEST_CONFIGURED_DB': 'read_only',
                   'NODIA_AI_LAB_API_ENV': str(api_env), 'NODIA_AI38_EXPECTED_MCP_REPORT': str(expected_mcp),
                   'NODIA_AI_LAB_REPORT_JSON': str(private_output)}
    public = {'stage': 'AI-38', 'scope': 'pinned_Web_Agentic_opt_in_routing_disposable_SQL',
              'phase': args.phase, 'attempt': args.attempt, 'status': 'running',
              'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'runner_sha256': sha(Path(__file__)), 'harness_sha256': args.harness_sha,
              'candidate_manifest_sha256': args.manifest_sha, 'expected_MCP_report_sha256': args.expected_mcp_sha,
              'maximum_provider_dispatch_requests': 0 if args.phase == 'preflight' else 5,
              'maximum_provider_dispatch_requests_per_delegated_run': 3,
              'automatic_inference_retries': 0, 'configured_SQL_writes': 0,
              'operational_Node_modified': False, 'services_restarted': False, 'storage_operations': 0,
              'dependencies_reused_existing_installation': True, 'npm_ci_executed': False,
              'container_before': before, 'native_pending_identity': None,
              'raw_logs_retained_privately': True}
    code = 1
    with (work / 'private-stdout.log').open('xb') as stdout, (work / 'private-stderr.log').open('xb') as stderr:
        try:
            command = ['/usr/local/bin/node', str(target)] + (['--preflight-only'] if args.phase == 'preflight' else [])
            result = subprocess.run(command, cwd=overlay, env=environment, stdout=stdout, stderr=stderr,
                                    timeout=300 if args.phase == 'preflight' else 1200)
            code = result.returncode
            if private_output.is_file():
                assert private_output.stat().st_size <= 1048576
                native = json.loads(private_output.read_text(encoding='utf-8'))
                # The pinned harness emits this closed structural report, not provider
                # bodies, prompts, nonce values, SQL records or native error messages.
                assert native['stage'] == 'AI-38' and native['scope'] == 'real_Web_opt_in_Agentic_next_turn_Web_disposable_SQL'
                assert native['maximum_provider_dispatch_requests'] == public['maximum_provider_dispatch_requests']
                assert type(native['provider_dispatch_requests']) is int and 0 <= native['provider_dispatch_requests'] <= public['maximum_provider_dispatch_requests']
                public['native_result'] = native
                public['native_pending_identity'] = native['native_pending_identity']
                public['status'] = 'passed' if code == 0 and native['status'] == 'passed' and native['native_pending_identity'] is False else 'failed_no_replay'
            else:
                public['status'] = 'native_report_missing_manual_reconciliation_before_retry'
            after = inspect()
            public['container_after'] = after
            assert before == after, 'Provider epoch must remain unchanged'
        except subprocess.TimeoutExpired:
            code = 124
            public['status'] = 'runner_timeout_preserve_fixture_and_native_identity_no_replay'
        except Exception:
            code = 1
            public['status'] = 'driver_control_failed_manual_inspection_no_replay'
    public['exit_code'] = code
    public['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    public['private_log_hashes'] = {name: sha(work / name) for name in ('private-stdout.log', 'private-stderr.log')}
    with (work / 'public-report.json').open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(public, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(public, ensure_ascii=False, indent=2))
    return code


if __name__ == '__main__':
    sys.exit(main())
