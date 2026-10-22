"""Read-only, exact-attempt structural projection. Never export provider text."""
import json
import re
import subprocess
import time

attempt_id = 'e735c64b-5081-4dd6-8f40-47ef5c045db1'
result = subprocess.run(['docker', 'logs', '--since', '2026-10-18T20:00:45Z', '--until', '2026-10-18T20:03:00Z', 'nodia-gemini-microservice'], capture_output=True, text=True, timeout=30)
assert result.returncode == 0
allowed_keys = set('attempt_id phase state exception_type elapsed_ms rpc_messages callbacks exit_code gate_verified cli hook cli_log controlled_context scope initial_utf8_bytes used_utf8_bytes maximum_utf8_bytes provider_internal_context_tokens stage events invalid_lines stdout_bytes initialized document_read_completed result_seen last_event_age_ms result_status denied_actions_count tool_error_categories tool_event_counts tool_completed_counts tool_error_counts tool_steps last_tool terminal_status denied_count stderr_bytes receipt_class decision_count rejected_count categories_state categories interpretation bytes_read lines_scanned truncated transport_indicators provider_error_indicators http_statuses view_file finish task_boundary notify_user view_file_outline list_dir find_by_name grep_search run_command write_to_file read_url_content call_mcp_tool other'.split())

def safe(value):
    if value is None or type(value) is bool or type(value) is int:
        return value
    if isinstance(value, str):
        return value if re.fullmatch(r'[A-Za-z0-9_.:-]{1,100}', value) else None
    if isinstance(value, list):
        return [safe(item) for item in value[:32]]
    if isinstance(value, dict):
        return {key: safe(item) for key, item in value.items() if key in allowed_keys}
    return None

events = []
for line in (result.stdout + '\n' + result.stderr).splitlines():
    marker = line.find('nodia_ai_mcp_terminal ')
    if marker < 0:
        continue
    try:
        event = json.loads(line[marker + len('nodia_ai_mcp_terminal '):])
    except ValueError:
        continue
    if event.get('attempt_id') == attempt_id:
        events.append(safe(event))
assert len(events) <= 1
print(json.dumps({'stage': 'AI-34', 'scope': 'read_only_exact_attempt_native_mcp_terminal_projection', 'status': 'observed' if events else 'not_found', 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'events': events, 'raw_logs_exported': False, 'provider_text_exported': False, 'provider_generations': 0, 'services_restarted': False, 'limitations': ['Only emitted structural fields are exported; absent provider errors or exit codes do not establish upstream health or the failure cause']}, indent=2))
