"""Private VM driver: one pinned nonce probe, read-only SQL, no activation/replay.

Usage: python3 DRIVER CANDIDATE MANIFEST_SHA HARNESS HARNESS_SHA API_ENV --execute-one-live
The immutable work directory is /opt/nodia/verification/ai38-mcp-r01-live01.
Do not retry this driver after a failure; inspect its private files and reconcile first.
"""
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import re
import subprocess
import sys


def sha(data):
    return hashlib.sha256(data).hexdigest()


def freeze(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')


def bounded_count(value):
    assert type(value) is int and 0 <= value <= 100000
    return value


def safe_native(value):
    """Closed projection; never forward arbitrary native JSON or exception text."""
    assert isinstance(value, dict)
    public = {}
    for name in ('task', 'scope', 'status', 'error_code'):
        if name in value:
            assert isinstance(value[name], str) and re.fullmatch(r'[A-Za-z0-9_:-]{1,160}', value[name])
            public[name] = value[name]
    for name in ('configured_database_read_only', 'configured_database_modified',
                 'configured_selection_modified', 'available_before', 'supports_mcp_before',
                 'supports_mcp_after', 'diagnostic_nonce_verified',
                 'native_terminal_proof_acknowledged', 'inference_replayed', 'native_pending_identity'):
        if name in value:
            assert type(value[name]) is bool
            public[name] = value[name]
    for name in ('real_provider_dispatch_requests', 'maximum_provider_dispatch_requests'):
        if name in value:
            public[name] = bounded_count(value[name])
            assert public[name] <= 1
    diagnostics = value.get('diagnostics')
    assert isinstance(diagnostics, dict) and diagnostics.get('schema_version') == 1
    projection = {'schema_version': 1}
    for name in ('callbacks', 'protocol_progress_notifications', 'last_rpc_messages',
                 'last_unforwarded_tool_requests', 'valid_progress_snapshots'):
        item = diagnostics[name]
        projection[name] = None if item is None else bounded_count(item)
    assert diagnostics['start_admission'] in (
        'not_requested', 'requested', 'running', 'uncertain', 'rejected_no_admission')
    projection['start_admission'] = diagnostics['start_admission']
    assert type(diagnostics['post_start_not_dispatched_error']) is bool
    projection['post_start_not_dispatched_error'] = diagnostics['post_start_not_dispatched_error']
    attempt = diagnostics['attempt_id']
    assert attempt is None or (isinstance(attempt, str) and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', attempt))
    projection['attempt_id'] = attempt
    for name, length in (('configuration_generation', 64), ('session_generation', 32)):
        item = diagnostics[name]
        assert item is None or (isinstance(item, str) and re.fullmatch('[a-f0-9]{' + str(length) + '}', item))
        projection[name] = item
    selection = diagnostics['selection']
    if selection is not None:
        assert set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'}
        assert re.fullmatch(r'[1-9][0-9]{0,18}', selection['connection_id'])
        assert selection['mode'] == 'token_plan_agentic'
        assert isinstance(selection['model_id'], str) and 0 < len(selection['model_id'].encode()) <= 1024
        assert selection['effort_id'] is None or (isinstance(selection['effort_id'], str) and 0 < len(selection['effort_id'].encode()) <= 256)
    projection['selection'] = selection
    allowed_phases = {'verify_configured_selection', 'observe_before', 'probe', 'probe_returned',
                      'acknowledge_completed', 'observe_after', 'passed', 'failed', 'reconcile',
                      'acknowledge_recovered', 'cleanup'}
    assert isinstance(diagnostics['phases'], dict) and set(diagnostics['phases']) <= allowed_phases
    projection['phases'] = {key: bounded_count(item) for key, item in diagnostics['phases'].items()}
    endpoints = {'observe', 'start', 'events', 'results', 'attest', 'cancel', 'reconcile', 'acknowledge'}
    assert isinstance(diagnostics['endpoints'], dict) and set(diagnostics['endpoints']) == endpoints
    projection['endpoints'] = {}
    for endpoint in sorted(endpoints):
        counters = diagnostics['endpoints'][endpoint]
        assert isinstance(counters, dict) and set(counters) == {'requests', 'completed', 'failed'}
        projection['endpoints'][endpoint] = {key: bounded_count(item) for key, item in counters.items()}
    assert projection['endpoints']['start']['requests'] <= 1
    public['diagnostics'] = projection
    return public


SELECTION_SCRIPT = r'''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const [candidate, envFile, output] = process.argv.slice(2);
const require = createRequire(path.join(candidate, 'package.json'));
require('reflect-metadata');
const { parse } = require('dotenv'), { DataSource } = require('typeorm');
const config = parse(fs.readFileSync(envFile));
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(config.GEMINI_MICROSERVICE_URL).hostname));
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL;
const { projectNodiaAiConnection: project } = await import(pathToFileURL(path.join(candidate,
  'dist/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js')).href);
const source = await new DataSource({ type: 'postgres', host: config.POSTGRES_HOST,
  port: Number(config.POSTGRES_PORT), username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
  database: config.POSTGRES_DB, entities: [], migrations: [], synchronize: false, migrationsRun: false,
  extra: { options: '-c default_transaction_read_only=on' } }).initialize();
try {
  const [mode] = await source.query('SHOW default_transaction_read_only');
  assert.equal(mode.default_transaction_read_only, 'on');
  const [quiet] = await source.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
  assert.ok(Object.values(quiet).every(value => value === 0), 'Configured runtime must be quiet');
  const rows = await source.query(`SELECT p.id::text,p.is_active,p.use_api_key,p.use_token_plan_web,
    p.use_token_plan_agentic,p.fields,c.key provider_key,c.is_active catalog_active,
    c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
    WHERE c.key='gemini' AND p.is_active AND c.is_active`);
  assert.equal(rows.length, 1, 'One exact active Gemini connection required');
  const modeSelection = project(rows[0]).modes.find(item => item.mode === 'token_plan_agentic');
  assert.equal(modeSelection.configuration, 'configured');
  const selected = modeSelection.configured_selection;
  assert.ok(selected);
  const snapshot = { rows: [{ connection_id: selected.connection_id, provider_key: 'gemini',
    is_active: true, agentic_model: selected.model_id, agentic_effort: selected.effort_id }],
    configured_database_read_only: true, quiet };
  fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
} finally { await source.destroy(); }
'''


def main():
    assert len(sys.argv) == 7 and sys.argv[6] == '--execute-one-live'
    candidate, expected_manifest, harness, expected_harness, api_env = sys.argv[1:6]
    candidate, harness, api_env = Path(candidate), Path(harness), Path(api_env)
    assert candidate.is_absolute() and candidate.resolve().is_relative_to('/opt/nodia/verification')
    assert candidate.name == 'nodia-server' and candidate.parent.name == 'ai38-node-candidate01'
    assert harness.is_absolute() and harness.is_file() and api_env.is_absolute() and api_env.is_file()
    assert re.fullmatch(r'[a-f0-9]{64}', expected_manifest) and re.fullmatch(r'[a-f0-9]{64}', expected_harness)
    manifest_file = candidate / 'manifest.json'
    assert sha(manifest_file.read_bytes()) == expected_manifest
    assert sha(harness.read_bytes()) == expected_harness
    manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
    assert not (candidate / '.env').exists()
    for name, digest in manifest['files'].items():
        relative = PurePosixPath(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        assert sha((candidate / relative).read_bytes()) == digest
    dependency = (candidate / 'node_modules').resolve(strict=True)
    # Read-only SSH observation: candidate01 and the historical ai32 link both
    # resolve to this existing installation. Reuse is not a fresh npm ci proof.
    assert dependency == Path('/opt/nodia/nodia-server/node_modules') and dependency.is_dir()
    os.umask(0o077)
    work = Path('/opt/nodia/verification/ai38-mcp-r01-live01')
    work.mkdir(mode=0o700, exist_ok=False)
    overlay = work / 'nodia-server'
    (overlay / 'test').mkdir(mode=0o700, parents=True)
    for name in ('dist', 'package.json', 'package-lock.json'):
        (overlay / name).symlink_to(candidate / name)
    (overlay / 'node_modules').symlink_to(dependency, target_is_directory=True)
    target = overlay / 'test/nodia-ai-ai38-mcp-diagnostic.mjs'
    with target.open('xb') as stream:
        stream.write(harness.read_bytes())
    assert sha(target.read_bytes()) == expected_harness
    private_selection, private_result = work / 'private-selection.json', work / 'private-native-report.json'
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(Path.home()),
                   'NODE_ENV': 'test', 'RATE_LIMIT_STORAGE': 'memory', 'DOTENV_CONFIG_PATH': '/dev/null'}
    started = datetime.now(timezone.utc).isoformat()
    public = {'stage': 'AI-38-MCP-R01', 'scope': 'one_real_MCP_nonce_not_domain_acceptance',
              'started_at_utc': started, 'candidate_manifest_sha256': expected_manifest,
              'harness_sha256': expected_harness, 'runner_sha256': sha(Path(__file__).read_bytes()),
              'maximum_provider_dispatch_requests': 1, 'automatic_inference_retries': 0,
              'configured_SQL_writes': 0, 'business_effects': 0, 'candidate_adopted': False,
              'services_restarted_by_driver': False, 'raw_logs_retained_privately': True,
              'dependencies_reused_existing_installation': True, 'npm_ci_executed': False,
              'provider_harness_started': False, 'native_pending_identity': False}
    code = 1
    with (work / 'private-stdout.log').open('xb') as stdout, (work / 'private-stderr.log').open('xb') as stderr:
        try:
            selection = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(candidate),
                                        str(api_env), str(private_selection)], input=SELECTION_SCRIPT.encode(),
                                       cwd=overlay, env=environment, stdout=stdout, stderr=stderr, timeout=45)
            assert selection.returncode == 0 and private_selection.is_file()
            selection_bytes = private_selection.read_bytes()
            selected = json.loads(selection_bytes)
            public['selection_sha256'] = sha(selection_bytes)
            public['quiet_before'] = selected['quiet']
            environment.update(NODIA_AI_ALLOW_LIVE='yes', NODIA_AI_ATTEST_CONFIGURED_DB='read_only',
                               NODIA_AI_LAB_API_ENV=str(api_env), NODIA_AI_LAB_SELECTION_JSON=str(private_selection),
                               NODIA_AI_LAB_REPORT_JSON=str(private_result))
            public['provider_harness_started'] = True
            public['native_pending_identity'] = None
            result = subprocess.run(['/usr/local/bin/node', str(target)], cwd=overlay, env=environment,
                                    stdout=stdout, stderr=stderr, timeout=300)
            code = result.returncode
            public['exit_code'] = code
            if private_result.is_file():
                native = safe_native(json.loads(private_result.read_text(encoding='utf-8')))
                public['native_result'] = native
                public['native_pending_identity'] = native.get('native_pending_identity')
                public['status'] = 'passed' if code == 0 and native.get('status') == 'passed' else 'failed_no_replay'
            else:
                public['status'] = 'native_report_missing_requires_reconciliation_no_replay'
        except subprocess.TimeoutExpired:
            code = 124
            public['status'] = 'runner_timeout_native_state_requires_reconciliation_no_replay'
            public['exit_code'] = code
        except Exception:
            code = 1
            public['status'] = 'driver_control_failed_native_state_requires_inspection_no_replay'
            public['exit_code'] = code
    public['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    public['private_log_hashes'] = {name: sha((work / name).read_bytes())
                                  for name in ('private-stdout.log', 'private-stderr.log')}
    freeze(work / 'public-report.json', public)
    print(json.dumps(public, ensure_ascii=False, indent=2))
    return code


if __name__ == '__main__':
    sys.exit(main())
