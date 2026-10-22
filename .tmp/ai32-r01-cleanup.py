"""Read-only counts of known runtime artifacts; never reads cookie/profile bytes."""
import json
import subprocess
import time

code = r'''
import json,os
from pathlib import Path
admission=Path('/app/session_state/runtime_admission')
proofs=[];invalid=0
for path in (admission/'attempts').glob('*.json'):
    try:
        if path.is_symlink() or path.stat().st_size>4096:raise ValueError('invalid_proof')
        value=json.loads(path.read_text(encoding='utf-8'))
        if value.get('state') not in ['dispatch_armed','completed','abandoned_unknown']:raise ValueError('invalid_state')
        proofs.append(value.get('state'))
    except (OSError,ValueError):invalid+=1
home=os.environ.get('ANTIGRAVITY_CLI_HOME','').strip()
homes=[Path(home)] if home else []
value={'unknown_markers':sum(1 for _ in admission.glob('*.unknown')),
       'armed_native_proofs':proofs.count('dispatch_armed'),
       'terminal_native_proofs':sum(state!='dispatch_armed' for state in proofs),
       'invalid_native_proofs':invalid,
       'temporary_attachment_directories':sum(1 for _ in Path('/app/temp_uploads').glob('native-attachment-*')),
       'temporary_cli_directories':sum(sum(1 for _ in root.glob(pattern)) for root in homes for pattern in ['nodia-chat-*','nodia-mcp-*']),
       'agentic_home_configured':bool(home)}
print(json.dumps(value))
'''
process = subprocess.run(['docker', 'exec', '--user', '10001:10001', 'nodia-gemini-microservice', 'python', '-c', code],
                         check=False, capture_output=True, text=True, timeout=20)
if process.returncode:
    raise RuntimeError('runtime_artifact_count_failed')
report = json.loads(process.stdout)
report.update(stage='AI-32-R01', scope='read_only_native_runtime_artifact_counts',
              observed_at_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
              provider_calls=0, configured_database_modified=False, profile_bytes_read=False)
print(json.dumps(report, indent=2))
