"""Safe structural metadata in an operator-exclusive synthetic Agentic window."""
import argparse
import json
import subprocess

parser=argparse.ArgumentParser()
parser.add_argument('--since',required=True)
parser.add_argument('--attempt',required=True)
args=parser.parse_args()
process=subprocess.run(['docker','logs','--timestamps','--since',args.since,'nodia-gemini-microservice'],
                       capture_output=True,text=True,check=False,timeout=20)
if process.returncode:raise RuntimeError('docker_log_observation_failed')
progress=[];failures=[]
for line in (process.stdout+'\n'+process.stderr).splitlines():
    marker='nodia_ai_attachment_cli_progress '
    if marker in line:
        try:value=json.loads(line.split(marker,1)[1])
        except ValueError:continue
        safe={key:value[key] for key in ['stage','phase','events','invalid_lines','stdout_bytes','initialized',
            'document_read_completed','result_seen','last_event_age_ms','result_status','denied_actions_count',
            'tool_error_categories'] if key in value}
        progress.append(safe)
    marker='nodia_ai_chat_failure '
    if marker in line:
        try:value=json.loads(line.split(marker,1)[1])
        except ValueError:continue
        if value.get('engine')!='agentic' or value.get('attempt_id')!=args.attempt:continue
        failures.append({key:value.get(key) for key in ['engine','attempt_id','phase','error_type','failure_category','elapsed_ms']})
report={'stage':'AI-32-R01','scope':'redacted_agentic_synthetic_window','window_since_utc':args.since,
        'attempt_id':args.attempt,'progress_correlation':'operator_exclusive_time_window_not_attempt_tag',
        'progress_records':progress,'progress_record_count':len(progress),'time_window_ambiguous':len(progress)>1,
        'attempt_correlated_failures':failures,'provider_response_text_stored':False,'credentials_stored':False,
        'additional_generations':0}
print(json.dumps(report,indent=2))
