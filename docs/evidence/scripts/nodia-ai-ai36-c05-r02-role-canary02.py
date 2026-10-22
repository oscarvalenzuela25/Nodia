"""Conditional single canary after successful metadata03, without another restart."""
from datetime import datetime, timezone
import hashlib,json,os,shutil,subprocess
from pathlib import Path
os.umask(0o077)
root=Path('/opt/nodia/verification/ai36-c05-r02-role-canary02');assert not root.exists();root.mkdir(mode=0o700)
prior=Path('/opt/nodia/verification/ai36-c05-r02-role-canary01')
meta_root=Path('/opt/nodia/verification/ai36-c05-r02-metadata03')
meta=json.loads((meta_root/'diagnostic-report.json').read_text());observed=meta['HTTP_observation']['observations'][0]
assert observed['available'] is True and observed['supports_mcp'] is False
def run(a,timeout=120,env=None):return subprocess.run(a,capture_output=True,timeout=timeout,env=env,check=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
state=json.loads(run(['docker','inspect','nodia-gemini-microservice']).stdout)[0]
baseline=json.loads((meta_root/'operational-baseline.json').read_text())
assert state['Image']==baseline['container']['image'] and state['Id']==baseline['container']['id'] and state['State']['StartedAt']==baseline['container']['started_at']
quiet=json.loads(run(['/usr/local/bin/node','/tmp/nodia-ai-ai36-c05-live-health.mjs','/opt/nodia/releases/nodia-server-ai15-20261016']).stdout)
assert quiet['pending_jobs']==quiet['open_attempts']==quiet['retained_slots']==0 and quiet['preserved_r05_chat']==1
for name in ('binding.json','selection.json'):shutil.copyfile(prior/name,root/name)
binding=json.loads((root/'binding.json').read_text());assert binding['configuration_generation']==observed['configuration_generation'] and binding['selection']==observed['selection']
report={'stage':'AI-36-C05-R02','scope':'one_conditional_original_MCP_canary_same_successful_metadata_epoch','status':'running','started_at_utc':datetime.now(timezone.utc).isoformat(),'source_sha256':sha(Path(__file__).read_bytes()),'metadata03_sha256':sha((meta_root/'diagnostic-report.json').read_bytes()),'epoch':baseline['container'],'native_start_requests':0,'accepted_native_starts':0,'maximum_native_start_requests':1,'automatic_inference_retries':0,'services_restarted':False,'business_effects':0}
def save():(root/'runner-report.json').write_text(json.dumps(report,indent=2)+'\n')
save()
env={**os.environ,'NODIA_AI_ALLOW_LIVE':'yes','NODIA_AI_ATTEST_CONFIGURED_DB':'read_only','NODIA_AI_LAB_API_ENV':'/opt/nodia/releases/nodia-server-ai15-20261016/.env','NODIA_AI_LAB_SELECTION_JSON':str(root/'selection.json'),'NODIA_AI_LAB_REPORT_JSON':str(root/'original-ai15-report.json'),'NODIA_AI_C05_ROLE_CANARY_REPORT':str(root/'canary-report.json'),'NODIA_AI_C05_ROLE_CANDIDATE_BINDING':str(root/'binding.json')}
try:
 result=run(['/usr/local/bin/node',str(prior/'nodia-server/test/nodia-ai-ai36-c05-role-canary.mjs')],300,env)
 (root/'stdout.log').write_bytes(result.stdout);(root/'stderr.log').write_bytes(result.stderr)
 canary=json.loads((root/'canary-report.json').read_text());report['native_start_requests']=canary['native_start_requests'];report['accepted_native_starts']=canary['accepted_native_starts'];report['canary_exit_code']=result.returncode;report['canary_report_sha256']=sha((root/'canary-report.json').read_bytes());report['canary_status']=canary['status'];report['status']='passed' if canary['status']=='passed' and result.returncode==0 else 'failed'
 if report['status']=='passed':assert canary['session_generation_sha256']==observed['session_generation_sha256']
finally:
 report['finished_at_utc']=datetime.now(timezone.utc).isoformat();save();print(json.dumps(report))
