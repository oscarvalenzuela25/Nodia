"""Preserve a private Docker log window and emit closed, exact-attempt diagnostics.

Usage: workdir report_json container_id started_at_utc mcp|plain
No provider calls, process restarts, profile reads or native reconciliation.
"""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


FIELDS = frozenset('''attempt_id phase state exception_type elapsed_ms rpc_messages callbacks
exit_code gate_verified cli hook cli_log rpc controlled_context stage events invalid_lines
stdout_bytes initialized document_read_completed result_seen last_event_age_ms result_status
denied_actions_count tool_error_categories tool_event_counts tool_completed_counts tool_error_counts
tool_steps last_tool terminal_status denied_count stderr_bytes error_indicator_interpretation
stderr_error_categories result_error_categories result_error_json_utf8_bytes interpretation
bytes_read lines_scanned truncated transport_indicators provider_error_indicators http_statuses
receipt_class decision_count rejected_count categories_state categories scope unknown_events methods
responses tools_list_successes last_response method response error_code initial_utf8_bytes
used_utf8_bytes maximum_utf8_bytes provider_internal_context_tokens outcome has_attachments
execution_phase total_elapsed_ms model_preflight_elapsed_ms bootstrap_elapsed_ms cli_elapsed_ms
unrecognized_count finish_count engine error_type failure_category agentic_generation
initialize notifications_initialized tools_list tools_call ping other success error notification
unknown allowed_finish finish_arguments dispatcher_envelope dispatcher_extra_fields foreign_server
unregistered_tool arguments_type arguments_json arguments_shape allowed_registered unregistered_native
payload_shape invalid_json allowed_attachment finish call_mcp_tool view_file text terminal init
step_update started completed failed denied invalid timeout authentication permission quota transport
unknown_tool invalid_agent schema unclassified context_deadline io_timeout tls_timeout dns_failure
connection_refused network_unreachable'''.split())
VALUES = frozenset('''workspace_setup running_cli closing_native_proof completed unknown running
queued validating_cli_events validating_model validating_terminal validating_hook generation
reply_validation cookie_persistence terminal_record model_preflight bootstrap cli_generation
terminal_validation succeeded failed cancelled success error notification initialize
notifications_initialized tools_list tools_call ping other finish call_mcp_tool view_file
none absent unrecognized missing valid verified invalid_shape denied_tool unregistered
invalid_json observed empty oversize partial unsafe_file read_error denied allowed_finish
finish_arguments dispatcher_envelope dispatcher_extra_fields foreign_server unregistered_tool
arguments_type arguments_json arguments_shape allowed_registered unregistered_native payload_shape
allowed_attachment initialized prompt_received tools_running document_read result_received
waiting_for_result terminal_started finished unknown_tool invalid_agent schema authentication
permission quota timeout transport unclassified context_deadline io_timeout tls_timeout
dns_failure connection_refused network_unreachable SUCCESS ERROR CANCELED INTERRUPTED INVALID
WAITING RUNNING RESOURCE_EXHAUSTED UNAUTHENTICATED PERMISSION_DENIED DEADLINE_EXCEEDED
TimeoutError ServiceError ValueError OSError TypeError KeyError AttributeError CancelledError Other
agentic web chat_result_unknown mcp_result_unknown'''.split()) | frozenset({
    'text_indicator_not_verified_cause', 'bridge_reply_constructed_not_cli_consumption',
    'initial_prompt_and_mcp_stdout',
})
MARKERS = ('nodia_ai_mcp_terminal', 'nodia_ai_agentic_terminal', 'nodia_ai_chat_failure')


def closed_projection(value, attempt_id, counters, field=None, depth=0):
    if depth > 12:
        counters['excess_depth_omitted'] += 1
        return None
    if value is None or type(value) is bool:
        return value
    if type(value) is int and -1_000_000_000_000 <= value <= 1_000_000_000_000:
        return value
    if isinstance(value, str):
        if field == 'attempt_id' and value == attempt_id:
            return value
        if value in VALUES:
            return value
        counters['unknown_string_values_omitted'] += 1
        return None
    if isinstance(value, list) and len(value) <= 128:
        return [closed_projection(item, attempt_id, counters, field, depth + 1) for item in value]
    if isinstance(value, dict) and len(value) <= 128:
        result = {}
        for key, child in value.items():
            if key in FIELDS:
                result[key] = closed_projection(child, attempt_id, counters, key, depth + 1)
            else:
                counters['unknown_field_names_omitted'] += 1
        return result
    counters['invalid_values_omitted'] += 1
    return None


def project_log(path, attempt_id):
    statuses, routes, guard_errors = Counter(), Counter(), Counter()
    terminals, projection_counts = [], Counter()
    line_count = matched_other_attempts = invalid_diagnostics = 0
    route_patterns = (
        ('health', r'/health'),
        ('mcp_events', r'/nodia-ai/agentic/attempts/[a-f0-9-]{36}/mcp/events'),
        ('mcp_cancel', r'/nodia-ai/agentic/attempts/[a-f0-9-]{36}/mcp/cancel'),
        ('mcp_start', r'/nodia-ai/agentic/mcp/start'),
        ('mcp_attest', r'/nodia-ai/agentic/attempts/[a-f0-9-]{36}/mcp/attest'),
        ('reconcile', r'/nodia-ai/agentic/attempts/[a-f0-9-]{36}/reconcile'),
        ('acknowledge', r'/nodia-ai/agentic/attempts/[a-f0-9-]{36}/acknowledge'),
        ('observe', r'/nodia-ai/agentic/observe'),
        ('plain_turn', r'/nodia-ai/agentic/turn'),
    )
    with path.open('r', encoding='utf-8', errors='replace') as source:
        for line in source:
            line_count += 1
            match = re.search(r'"(GET|POST|PUT|PATCH|DELETE|OPTIONS) ([^"\n]{1,512}) HTTP/[0-9.]+" (\d{3})\b', line)
            if match:
                method, route, status = match.groups()
                statuses[status] += 1
                route = route.split('?', 1)[0]
                category = next((label for label, pattern in route_patterns if re.fullmatch(pattern, route)), 'other')
                routes[(method, category, status)] += 1
            match = re.search(r'error=([A-Za-z0-9_.-]{1,80}) duration_ms=', line)
            if match:
                guard_errors['none' if match[1] == 'none' else 'non_none'] += 1
            for marker in MARKERS:
                if marker + ' ' not in line:
                    continue
                try:
                    text = line.split(marker + ' ', 1)[1]
                    if len(text.encode('utf-8')) > 131072:
                        raise ValueError('diagnostic_too_large')
                    value = json.loads(text)
                    if not isinstance(value, dict):
                        raise ValueError('diagnostic_not_object')
                    if attempt_id is None or value.get('attempt_id') != attempt_id:
                        matched_other_attempts += 1
                        continue
                    terminals.append({'marker': marker,
                                      'diagnostic': closed_projection(value, attempt_id, projection_counts)})
                except (ValueError, UnicodeError, RecursionError):
                    invalid_diagnostics += 1
    return {'lines': line_count, 'http_status_counts': dict(statuses),
            'http_route_counts': [{'method': key[0], 'route_category': key[1], 'status': key[2], 'count': count}
                                  for key, count in routes.most_common()],
            'request_guard_error_counts': dict(guard_errors), 'exact_attempt_terminals': terminals,
            'foreign_attempt_diagnostics_not_emitted': matched_other_attempts,
            'invalid_diagnostic_records': invalid_diagnostics,
            'closed_projection_omissions': dict(projection_counts)}


def main():
    work, input_report, container_id, started_at, mode = sys.argv[1:]
    work, input_report = Path(work), Path(input_report)
    assert re.fullmatch(r'/opt/nodia/verification/ai38-mcp-r01-live0[1-9]', str(work))
    assert work.is_dir() and not work.is_symlink()
    assert input_report.is_file() and not input_report.is_symlink()
    assert input_report.resolve().is_relative_to(work.resolve())
    assert input_report.stat().st_size <= 262144
    assert re.fullmatch(r'[a-f0-9]{64}', container_id)
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z', started_at)
    assert mode in ('mcp', 'plain')
    before = json.loads(subprocess.run(['docker', 'inspect', container_id], capture_output=True,
                                      check=True, timeout=20).stdout)[0]
    assert before['Id'] == container_id and before['State']['StartedAt'] == started_at
    original_report = json.loads(input_report.read_text(encoding='utf-8'))
    native = original_report.get('native_result', original_report)
    attempt_id = native.get('diagnostics', {}).get('attempt_id', native.get('attempt_id'))
    assert attempt_id is None or re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', attempt_id)
    os.umask(0o077)
    private = work / ('private-docker-window-' + mode + '.log')
    public = work / ('public-terminal-capture-' + mode + '.json')
    assert not private.exists() and not public.exists(), 'preserve_closed_capture'
    until = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    with private.open('xb') as output:
        os.chmod(private, 0o600)
        captured = subprocess.run(['docker', 'logs', '--timestamps', '--since', started_at,
                                   '--until', until, container_id], stdout=output,
                                  stderr=subprocess.STDOUT, check=False, timeout=45)
    assert captured.returncode == 0, 'docker_log_capture_failed_private_output_retained'
    digest = hashlib.sha256()
    with private.open('rb') as source:
        for chunk in iter(lambda: source.read(65536), b''):
            digest.update(chunk)
    report = {'stage': 'AI-38-MCP-R01', 'scope': 'closed_exact_attempt_terminal_projection',
              'captured_at_utc': until, 'container_id': container_id,
              'container_started_at_utc': started_at, 'container_image': before['Image'],
              'mode': mode, 'attempt_id': attempt_id,
              'input_report_sha256': hashlib.sha256(input_report.read_bytes()).hexdigest(),
              'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'private_log': {'sha256': digest.hexdigest(), 'bytes': private.stat().st_size,
                              'permissions_octal': oct(private.stat().st_mode & 0o777),
                              'raw_emitted': False},
              'projection': project_log(private, attempt_id), 'provider_requests': 0,
              'services_restarted': False, 'reconciliation_or_ACK_performed': False,
              'profile_or_credentials_read': False}
    after = json.loads(subprocess.run(['docker', 'inspect', container_id], capture_output=True,
                                     check=True, timeout=20).stdout)[0]
    report['same_container_epoch_after_capture'] = (
        after['Id'] == before['Id'] and after['State']['StartedAt'] == before['State']['StartedAt'])
    assert report['same_container_epoch_after_capture']
    with public.open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
