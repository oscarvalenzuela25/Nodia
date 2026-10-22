"""Read existing structural terminal log records for exact owned attempt IDs.

Never print arbitrary container logs, prompts, model output or credentials.
"""
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

since, *attempts = sys.argv[1:]
assert re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', since)
assert attempts and len(attempts) <= 6
assert all(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', value) for value in attempts)
result = subprocess.run(['docker', 'logs', '--since', since, 'nodia-gemini-microservice'],
                        capture_output=True, text=True, check=True, timeout=20)
allowed = {'attempt_id', 'phase', 'state', 'exception_type', 'elapsed_ms', 'rpc_messages',
           'callbacks', 'exit_code', 'gate_verified', 'cli', 'hook', 'cli_log', 'controlled_context'}
records = []
for line in (result.stdout + '\n' + result.stderr).splitlines():
    marker = 'nodia_ai_mcp_terminal '
    if marker not in line:
        continue
    try:
        value = json.loads(line.split(marker, 1)[1])
    except ValueError:
        continue
    if isinstance(value, dict) and value.get('attempt_id') in attempts:
        records.append({key: item for key, item in value.items() if key in allowed})
print(json.dumps({'stage': 'AI-36-C05', 'scope': 'existing_structural_native_terminal_diagnostics_exact_owned_attempts',
                  'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'requested_attempt_ids': attempts, 'diagnostics': records,
                  'raw_container_logs_included': False, 'provider_requests': 0,
                  'services_restarted': False,
                  'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}, indent=2))
