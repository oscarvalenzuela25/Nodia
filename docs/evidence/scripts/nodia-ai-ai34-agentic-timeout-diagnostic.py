"""Export only bounded, code-owned failure metadata; never provider text or raw logs."""
from __future__ import annotations
import json
import re
import subprocess

result = subprocess.run(['docker', 'logs', '--since', '2026-10-18T19:56:50Z', 'nodia-gemini-microservice'], capture_output=True, text=True, timeout=30)
assert result.returncode == 0
events = []
for line in (result.stdout + '\n' + result.stderr).splitlines():
    marker = line.find('nodia_ai_chat_failure ')
    if marker < 0:
        continue
    value = line[marker + len('nodia_ai_chat_failure '):]
    try:
        event = json.loads(value)
    except ValueError:
        continue
    if event.get('engine') != 'agentic':
        continue
    safe = {}
    for key in ('engine', 'phase', 'error_type', 'failure_category'):
        item = event.get(key)
        safe[key] = item if isinstance(item, str) and re.fullmatch(r'[A-Za-z0-9_:.-]{1,80}', item) else None
    attempt = event.get('attempt_id')
    safe['attempt_id'] = attempt if isinstance(attempt, str) and re.fullmatch(r'[a-f0-9-]{36}', attempt) else None
    elapsed = event.get('elapsed_ms')
    safe['elapsed_ms'] = elapsed if type(elapsed) is int and 0 <= elapsed <= 1000000000 else None
    shape = event.get('response_shape')
    safe['response_shape'] = None
    if isinstance(shape, dict):
        safe['response_shape'] = {key: item for key, item in shape.items() if key in ('text_bytes', 'leading_category') and (item is None or type(item) is int or item in ('object', 'fence', 'other'))}
    # No exit/gate values are inferred when plain chat did not emit them.
    safe['exit_code'] = event.get('exit_code') if type(event.get('exit_code')) is int else None
    safe['gate_result'] = None
    events.append(safe)
assert len(events) <= 10, 'Unexpected diagnostic cardinality'
print(json.dumps({'stage': 'AI-34', 'scope': 'read_only_filtered_agentic_generation_failure_metadata', 'status': 'observed' if events else 'not_found', 'events': events, 'raw_logs_exported': False, 'provider_text_exported': False, 'provider_generations': 0, 'services_restarted': False, 'limitations': ['Phase and timeout category do not identify the underlying cause; missing exit/gate fields remain unknown']}, indent=2))
