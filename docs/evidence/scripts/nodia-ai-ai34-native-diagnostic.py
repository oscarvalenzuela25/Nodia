"""Exact-attempt native failure metadata only, with closed output keys and no raw text."""
import datetime
import json
import re
import subprocess
import sys

assert len(sys.argv) == 4
since, until, attempt = sys.argv[1:]
assert re.fullmatch(r'[a-f0-9-]{36}', attempt)
for stamp in (since, until):
    assert re.fullmatch(r'2026-[0-9TZ:.-]+', stamp)
    datetime.datetime.fromisoformat(stamp.replace('Z', '+00:00'))
keys = set('error_indicator_interpretation stderr_error_categories result_error_categories result_error_json_utf8_bytes engine attempt_id phase state outcome has_attachments exception_type error_type failure_category elapsed_ms total_elapsed_ms rpc_messages callbacks exit_code gate_verified cli hook cli_log controlled_context scope initial_utf8_bytes used_utf8_bytes maximum_utf8_bytes provider_internal_context_tokens stage events invalid_lines stdout_bytes initialized document_read_completed result_seen last_event_age_ms result_status denied_actions_count tool_error_categories tool_event_counts tool_completed_counts tool_error_counts tool_steps last_tool terminal_status denied_count stderr_bytes receipt_class decision_count rejected_count unrecognized_count finish_count categories_state categories interpretation bytes_read lines_scanned truncated transport_indicators provider_error_indicators http_statuses view_file finish task_boundary notify_user view_file_outline list_dir find_by_name grep_search run_command write_to_file read_url_content call_mcp_tool other agentic_generation execution_phase model_preflight_elapsed_ms bootstrap_elapsed_ms cli_elapsed_ms reply_format utf8_bytes has_bom stripped_utf8_bytes first_character_class last_character_class json_syntax line column position document_utf8_bytes'.split())

def safe(value, depth=0):
    assert depth <= 8
    if value is None or type(value) is bool or type(value) is int:
        return value
    if isinstance(value, str):
        return value if re.fullmatch(r'[A-Za-z0-9_.:-]{1,100}', value) else None
    if isinstance(value, list):
        return [safe(item, depth + 1) for item in value[:32]]
    if isinstance(value, dict):
        return {key: safe(item, depth + 1) for key, item in value.items() if key in keys}
    return None

result = subprocess.run(['docker', 'logs', '--since', since, '--until', until, 'nodia-gemini-microservice'], check=True, capture_output=True, text=True, timeout=30)
events = []
for line in (result.stdout + '\n' + result.stderr).splitlines():
    for marker in ('nodia_ai_chat_failure ', 'nodia_ai_mcp_terminal ', 'nodia_ai_agentic_terminal '):
        offset = line.find(marker)
        if offset < 0:
            continue
        try:
            value = json.loads(line[offset + len(marker):])
        except ValueError:
            continue
        if value.get('attempt_id') == attempt:
            events.append({'kind': marker.strip(), 'metadata': safe(value)})
assert len(events) <= 3
print(json.dumps({'stage': 'AI-34', 'scope': 'exact_attempt_read_only_native_structural_diagnostics', 'status': 'observed' if events else 'not_found', 'attempt_id': attempt, 'window_utc': [since, until], 'events': events, 'provider_generations': 0, 'services_restarted': False, 'provider_text_exported': False, 'raw_logs_exported': False, 'limitations': ['Text indicators and missing terminal fields do not independently prove a provider failure cause']}, indent=2))
