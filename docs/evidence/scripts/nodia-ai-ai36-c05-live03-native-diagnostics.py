"""Read existing structural native logs for exact C05 cohort03 attempt IDs.

No provider, profile, temporary bridge file or service mutations. Use --stdin
only for isolated validation; normal execution reads the named container logs.
"""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

FIELDS = {
    'terminal': {'attempt_id', 'phase', 'state', 'exception_type', 'elapsed_ms',
                 'rpc_messages', 'callbacks', 'exit_code', 'gate_verified'},
    'cli': {'stage', 'events', 'invalid_lines', 'stdout_bytes', 'initialized',
            'document_read_completed', 'result_seen', 'last_event_age_ms', 'phase',
            'result_status', 'denied_actions_count', 'tool_steps', 'last_tool',
            'terminal_status', 'denied_count', 'stderr_bytes',
            'error_indicator_interpretation', 'result_error_json_utf8_bytes'},
    'hook': {'receipt_class', 'decision_count', 'rejected_count', 'categories_state'},
    'cli_log': {'state', 'interpretation', 'bytes_read', 'lines_scanned', 'truncated'},
    'controlled_context': {'scope', 'initial_utf8_bytes', 'used_utf8_bytes',
                           'maximum_utf8_bytes', 'provider_internal_context_tokens'},
}
COUNT_MAPS = {'tool_event_counts', 'tool_completed_counts', 'tool_error_counts', 'categories'}
CATEGORY_LISTS = {'tool_error_categories', 'stderr_error_categories', 'result_error_categories',
                  'transport_indicators', 'provider_error_indicators'}
LABEL = re.compile(r'[A-Za-z][A-Za-z0-9_]{0,95}')


def scalar(value):
    return (value is None or type(value) in (int, bool)
            or isinstance(value, str) and LABEL.fullmatch(value) is not None)


def project(value):
    """Only declared structural fields escape; payload-like fields are discarded."""
    result = {key: item for key, item in value.items()
              if key in FIELDS['terminal'] and scalar(item)}
    for group in ('cli', 'hook', 'cli_log', 'controlled_context'):
        source = value.get(group)
        if source is None:
            result[group] = None
            continue
        if not isinstance(source, dict):
            continue
        target = {key: item for key, item in source.items()
                  if key in FIELDS[group] and scalar(item)}
        for key in COUNT_MAPS:
            items = source.get(key)
            if isinstance(items, dict) and len(items) <= 128:
                target[key] = {label: count for label, count in items.items()
                               if LABEL.fullmatch(label) and type(count) is int and count >= 0}
        for key in CATEGORY_LISTS:
            items = source.get(key)
            if isinstance(items, list) and len(items) <= 128:
                target[key] = [item for item in items
                               if isinstance(item, str) and LABEL.fullmatch(item)]
        if group == 'cli_log' and isinstance(source.get('http_statuses'), list):
            target['http_statuses'] = [item for item in source['http_statuses'][:128]
                                       if type(item) is int and 100 <= item <= 599]
        result[group] = target
    # Attempt UUID is separately validated by the exact requested-ID filter.
    result['attempt_id'] = value['attempt_id']
    return result


def main():
    args = sys.argv[1:]
    isolated_input = bool(args and args[0] == '--stdin')
    if isolated_input:
        args = args[1:]
    since, *attempts = args
    assert re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', since)
    assert 1 <= len(attempts) <= 6 and len(set(attempts)) == len(attempts)
    assert all(re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', item) for item in attempts)
    if isolated_input:
        log = sys.stdin.read(16 * 1024 * 1024 + 1)
    else:
        process = subprocess.run(['docker', 'logs', '--since', since, '--tail', '4096',
                                  'nodia-gemini-microservice'], capture_output=True,
                                 text=True, check=True, timeout=20)
        log = process.stdout + '\n' + process.stderr
    assert len(log.encode('utf-8')) <= 16 * 1024 * 1024, 'Diagnostic log window exceeds bound'
    records = []
    for line in log.splitlines():
        marker = 'nodia_ai_mcp_terminal '
        if marker not in line:
            continue
        try:
            value = json.loads(line.split(marker, 1)[1])
        except (ValueError, RecursionError):
            continue
        if isinstance(value, dict) and value.get('attempt_id') in attempts:
            assert len(records) < 24, 'Unexpected duplicate diagnostic records'
            records.append(project(value))
    print(json.dumps({
        'stage': 'AI-36-C05', 'cohort': '03',
        'scope': 'existing_structural_native_terminal_diagnostics_exact_owned_attempts',
        'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'requested_attempt_ids': attempts, 'diagnostics': records,
        'missing_attempt_ids': [item for item in attempts if not any(record['attempt_id'] == item for record in records)],
        'input_source': 'isolated_stdin' if isolated_input else 'existing_container_logs',
        'extractor_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'native_source_attestation': 'separate_fixed_source_hash_extractor_required',
        'raw_container_logs_included': False, 'provider_requests': 0,
        'services_restarted': False, 'profiles_or_temporary_bridge_files_read': False,
        'progress_counts_interpretation': 'step_update_events_not_distinct_invocations',
    }, indent=2))


if __name__ == '__main__':
    main()
