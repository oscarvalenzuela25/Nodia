import hashlib,json,os,pwd,secrets,subprocess,tempfile,time
from pathlib import Path
runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
stage=Path('/opt/nodia/verification/ai29-r01-20261017')
private=Path(tempfile.mkdtemp(prefix='nodia-ai29-agentic-',dir='/run'));private.chmod(0o700)
selection=private/'selection.json';report=private/'report.json'
user=subprocess.check_output(['systemctl','show','nodia-api','--property=User','--value'],text=True).strip() or 'root'
pwd.getpwnam(user)
observer=(stage/'scripts/observe-nodia-ai-lab-selection.mjs').read_text()
observed=subprocess.run(['runuser','-u',user,'--','env','-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/nonexistent','DOTENV_CONFIG_PATH='+str(runtime/'.env'),'node','--input-type=module'],cwd=runtime,input=observer,text=True,capture_output=True,check=False,timeout=20)
if observed.returncode:raise RuntimeError('selection_observation_failed_without_payload')
metadata=json.loads(observed.stdout);assert metadata['observation']=='configured_selection_only'
rows=[r for r in metadata['rows'] if r['provider_key']=='gemini' and r['is_active']]
assert len(rows)==1 and rows[0]['use_token_plan_agentic'] is True and rows[0]['can_use_token_plan_agentic'] is True and rows[0]['agentic_model']
selection.write_text(json.dumps(metadata));selection.chmod(0o600)
dist=[{'path':p.relative_to(stage).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((stage/'dist').rglob('*')) if p.is_file()]
dist_hash=hashlib.sha256(json.dumps(dist,sort_keys=True,separators=(',',':')).encode()).hexdigest()
pin=json.loads((stage/'dist/nodia-ai-context/config/knowledge-pin.json').read_text())
environment={'PATH':'/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','HOME':'/root','NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null',
 'NODIA_AI_ALLOW_LIVE':'yes','NODIA_AI_LAB_API_ENV':str(runtime/'.env'),'NODIA_AI_LAB_SELECTION_JSON':str(selection),
 'NODIA_AI_LAB_KNOWLEDGE_ROOT':str(stage/'dist/nodia-ai/knowledge'),'NODIA_AI_LAB_KNOWLEDGE_PIN':str(stage/'dist/nodia-ai-context/config/knowledge-pin.json'),
 'NODIA_AI_LAB_REPORT_JSON':str(report),'AI_SECRET_MASTER_KEY':secrets.token_hex(32)}
started=time.monotonic()
result=subprocess.run(['node','test/nodia-ai-ai15-live.integration.mjs','--phase=local'],cwd=stage,env=environment,umask=0o077,text=True,capture_output=True,check=False)
print(result.stdout,end='');print(result.stderr,end='')
assert report.is_file(),'live_harness_did_not_write_report'
data=json.loads(report.read_text());assert data['adapter_dispatch_requests']<=2
data['stage']='AI-29-R01';data['scope']='real_gemini_agentic_mcp_readonly_synthetic_postgresql';data['elapsed_seconds']=round(time.monotonic()-started,2)
data['provenance']={'dist_files':len(dist),'dist_tree_sha256':dist_hash,'dist_tree_hash_algorithm':'sha256 of compact sorted-key JSON path/sha256 array sorted by file path',
 'knowledge_release_id':pin['release_id'],'live_harness_sha256':hashlib.sha256((stage/'test/nodia-ai-ai15-live.integration.mjs').read_bytes()).hexdigest(),
 'selection_observer_sha256':hashlib.sha256(observer.encode()).hexdigest(),'selection_observation_readonly':True,'selection_observer_user':user,
 'actual_model_resolved_from_configured_selection':True,'web_generation_requested':False,'provider_logout_requested':False}
destination=Path('/tmp/nodia-ai29-cgroup-helper/agentic-mcp-report.json');destination.write_text(json.dumps(data,indent=2)+'\n');destination.chmod(0o600)
print(json.dumps({'r01_agentic_mcp_summary':{'exit_code':result.returncode,'status':data['status'],'checks':data['checks'],
 'generation_requests':data['adapter_dispatch_requests'],'cleanup':data.get('cleanup'),'dist_files':len(dist),'dist_tree_sha256':dist_hash,'knowledge_pin':pin['release_id']}}))
if data.get('cleanup',{}).get('completed'):
 selection.unlink();report.unlink();private.rmdir()
raise SystemExit(result.returncode)
