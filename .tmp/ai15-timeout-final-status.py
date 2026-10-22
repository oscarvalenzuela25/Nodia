import collections,hashlib,json,subprocess,time,urllib.request
from pathlib import Path
def cmd(args):return subprocess.check_output(args)
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016');base=Path('/tmp/ai15-timeout-deploy')
status=json.loads(cmd(['node',str(base/'newchat-status.mjs')]));quiet=json.loads(cmd(['node',str(base/'quiet.mjs')]))
assert quiet=={'pending_jobs':0,'open_attempts':0,'held_or_unknown_slots':0,'migrations':20};assert len(status['runs'])==1 and status['runs'][0]['state']=='completed'
units={}
for unit in ['nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx']:
 d=dict(x.split('=',1) for x in cmd(['systemctl','show',unit,'-p','ActiveState','-p','SubState','-p','MainPID','-p','NRestarts']).decode().splitlines());assert d['ActiveState']=='active';units[unit]=d
c=json.loads(cmd(['docker','inspect','nodia-gemini-microservice']))[0]
assert c['Image']=='sha256:e1fcee82dd54afbb0d386e406169f85613085a5b1cdb8a3148962409a0b4a695' and c['State']['StartedAt']=='2026-10-16T20:30:54.516799401Z'
rows=cmd(['docker','top','nodia-gemini-microservice','-eo','pid,ppid,comm']).decode().splitlines()[1:];names=[x.split()[-1] for x in rows];native_names={'agy','chrome','chromium','chromium-browse'};native_count=sum(n in native_names for n in names)
assert native_count==0
health={}
for label,url in [('api','http://127.0.0.1:3000/api/v1/'),('bridge','http://127.0.0.1:8000/health')]:
 with urllib.request.urlopen(url,timeout=3) as response:health[label]=response.status
assert all(n==200 for n in health.values())
module=root/'dist/nodia-ai-products/nodia-ai-product-reads.module.js';module_sha=hashlib.sha256(module.read_bytes()).hexdigest();assert module_sha=='f3901351353411d51d7a20a5ef9e74235f7be4736416c8b52263172c5d0b5299'
mem={}
for line in Path('/proc/meminfo').read_text().splitlines():
 k,v=line.split(':',1)
 if k in {'MemTotal','MemAvailable','SwapTotal','SwapFree'}:mem[k+'_kib']=int(v.split()[0])
raw=cmd(['journalctl','-u','nodia-ai-worker','--since','2026-10-16 21:08:52 UTC','-n','400','--no-pager','-o','json']);projected=subprocess.run(['python3',str(base/'read-nodia-ai-worker-diagnostics.py')],input=raw,capture_output=True,check=True).stdout
errors=[json.loads(x) for x in projected.splitlines() if x]
report={'checked_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'services_left_running':True,'units':units,'public_health_http':health,'new_chat_sql':status,'quiet_sql':quiet,'native_cli_or_browser_process_count':native_count,'runtime_admission_file_count':sum(p.is_file() for p in Path('/opt/nodia/nodia-gemini-microservice/session_state/runtime_admission').rglob('*')),'bridge':{'image':c['Image'],'started_at':c['State']['StartedAt'],'healthy':c['State']['Health']['Status']=='healthy','restarted_after_success':False},'server_product_reads_module_sha256':module_sha,'knowledge_pin':json.loads((root/'dist/nodia-ai-context/config/knowledge-pin.json').read_text())['release_id'],'memory':mem,'load_average':list(os for os in Path('/proc/loadavg').read_text().split()[:3]),'worker_closed_failure_events_after_fix':errors,'new_generations_by_infrastructure_agent':0,'provider_status_probes_after_success':0,'limitations':'Provider availability was demonstrated by the completed real UI turn and its receipt audit; no new provider observation or MCP attestation was invoked for this final infrastructure snapshot.'}
assert report['runtime_admission_file_count']==0
(base/'final-status.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
