"""Read-only closed terminal diagnostic projection for one already-ended MCP attempt."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ATTEMPT = '486e16be-f1e1-4b53-b19b-b34fe2a62ae2'
IMAGE = 'sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e'
BEGIN = '2026-10-22T19:55:16Z'
END = '2026-10-22T19:57:26Z'
ERRORS = {'unknown_tool', 'invalid_agent', 'schema', 'authentication', 'permission', 'quota', 'timeout', 'transport', 'unclassified'}
PHASES = {'admitted', 'awaiting_cli_terminal', 'closing_native_proof', 'completed', 'workspace_setup', 'running_cli',
          'validating_cli_events', 'validating_model', 'validating_terminal', 'validating_hook', 'awaiting_server_callback', 'context_budget_failed'}


def count(value):
    return value if type(value) is int and 0 <= value <= 2 ** 31 else None


def enum(value, allowed):
    return value if value is None or (isinstance(value, str) and value in allowed) else 'unknown_not_projected'


def indicators(value, allowed):
    return value if isinstance(value, list) and len(value) <= 32 and all(isinstance(v, str) and v in allowed for v in value) else None


def epoch():
    result = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], capture_output=True, timeout=10, check=True)
    value = json.loads(result.stdout)[0]
    assert value['Image'] == IMAGE and value['State']['Running']
    return dict(id=value['Id'], image=value['Image'], started_at=value['State']['StartedAt'])


before = epoch()
result = subprocess.run(['docker', 'logs', '--timestamps', '--since', BEGIN, '--until', END, '--tail', '10000',
                         'nodia-gemini-microservice'], capture_output=True, timeout=20, check=True)
assert len(result.stdout) + len(result.stderr) <= 8 * 1024 * 1024
records = []
for line in (result.stdout + b'\n' + result.stderr).splitlines():
    # Require the actual stdlib logger origin, not a provider stdout message.
    match = re.fullmatch(rb'([^ ]+) (?:WARNING|INFO):native_mcp_sessions:nodia_ai_mcp_terminal (.+)', line)
    if not match:
        continue
    value = json.loads(match[2])
    if not isinstance(value, dict) or value.get('attempt_id') != ATTEMPT:
        continue
    item = dict(timestamp_utc=match[1].decode('ascii'), attempt_id=ATTEMPT,
        phase=enum(value.get('phase'), PHASES), state=enum(value.get('state'), {'running', 'completed', 'unknown'}),
        exception_type=enum(value.get('exception_type'), {'CancelledError', 'TimeoutError', 'ServiceError', 'ValueError', 'OSError', 'TypeError', 'KeyError', 'AttributeError', 'Other'}),
        elapsed_ms=count(value.get('elapsed_ms')), rpc_messages=count(value.get('rpc_messages')),
        callbacks=count(value.get('callbacks')), exit_code=value.get('exit_code') if type(value.get('exit_code')) is int else None,
        gate_verified=value.get('gate_verified') if type(value.get('gate_verified')) is bool else None)
    cli = value.get('cli')
    item['cli'] = None if not isinstance(cli, dict) else dict(
        tool_steps=count(cli.get('tool_steps')), last_tool=enum(cli.get('last_tool'), {'none', 'finish', 'call_mcp_tool', 'other'}),
        terminal_status=enum(cli.get('terminal_status'), {'absent', 'SUCCESS', 'ERROR', 'CANCELED', 'INTERRUPTED', 'INVALID', 'WAITING', 'RUNNING', 'unrecognized'}),
        denied_count=count(cli.get('denied_count')), stderr_bytes=count(cli.get('stderr_bytes')),
        stderr_error_categories=indicators(cli.get('stderr_error_categories'), ERRORS),
        result_error_categories=indicators(cli.get('result_error_categories'), ERRORS))
    diagnostic = value.get('cli_log')
    item['cli_log'] = None if not isinstance(diagnostic, dict) else dict(
        state=enum(diagnostic.get('state'), {'missing', 'unsafe_file', 'observed', 'empty', 'read_error'}),
        transport_indicators=indicators(diagnostic.get('transport_indicators'), {'context_deadline', 'io_timeout', 'tls_timeout', 'dns_failure', 'connection_refused', 'network_unreachable'}),
        provider_error_indicators=indicators(diagnostic.get('provider_error_indicators'), {'RESOURCE_EXHAUSTED', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'DEADLINE_EXCEEDED'}),
        text_indicators_are_not_verified_cause=True)
    rpc = value.get('rpc')
    methods = {'initialize', 'notifications_initialized', 'tools_list', 'tools_call', 'ping', 'other'}
    responses = {'success', 'error', 'notification', 'unknown'}
    item['rpc'] = None if not isinstance(rpc, dict) else dict(
        state=enum(rpc.get('state'), {'missing', 'oversize', 'observed', 'partial'}),
        events=count(rpc.get('events')), unknown_events=count(rpc.get('unknown_events')),
        methods={name: count(rpc.get('methods', {}).get(name)) for name in sorted(methods)},
        responses={name: count(rpc.get('responses', {}).get(name)) for name in sorted(responses)},
        tools_list_successes=count(rpc.get('tools_list_successes')),
        reply_construction_not_cli_consumption=True)
    records.append(item)
assert epoch() == before
print(json.dumps(dict(scope='closed_terminal_metadata_for_exact_finished_attempt_not_provider_cause',
    observed_at_VM_utc=datetime.now(timezone.utc).isoformat(), source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    native_epoch=before, window_begin_utc=BEGIN, window_end_utc=END, terminal_records=records,
    terminal_record_count=len(records), raw_logs_headers_bodies_or_account_files_saved=False,
    HTTP_requests=0, provider_generation_requests=0, service_changes=0), indent=2))
