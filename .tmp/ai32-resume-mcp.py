import importlib.util,json,hashlib,secrets,time,urllib.request,urllib.error
from pathlib import Path
base=Path('/tmp/nodia-ai32-native-candidate');spec=importlib.util.spec_from_file_location('probe',base/'probe.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);config=m.configuration()
report=json.loads((base/'mcp-validation.json').read_text());attempt=report['attempt_id'];reference={'resource_key':'gemini-profile:'+hashlib.sha256(b'/home/nodia/agentic_profile').hexdigest(),'session_generation':report['session_generation'],'operation_ref':attempt}
def post(path,value):
 req=urllib.request.Request(config['url'].rstrip('/')+path,data=json.dumps(value).encode(),headers={'Content-Type':'application/json','X-Nodia-Service-Token':config['token']},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.loads(r.read(131072))
 except urllib.error.HTTPError as e:return e.code,{'code':json.loads(e.read(4096)).get('code')}
status,events=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/events',{**reference,'after':0});assert status==200
nonce='AI32_RECOVERY_'+secrets.token_hex(12);proof=None;calls=set();cursor=0;deadline=time.monotonic()+30
while True:
 for event in events.get('events',[]):
  cursor=max(cursor,event['seq'])
  if event['kind']=='tool_request' and events.get('state')=='running' and event['call_id'] not in calls:
   assert event['name']=='nodia_ai_canary_read' and event['arguments']=={}
   calls.add(event['call_id']);status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/results',{**reference,'call_id':event['call_id'],'result':{'nonce':nonce,'synthetic':True}});assert status==200
  if event['kind']=='answer':proof=event['terminal_proof'];report['nonce_returned']=nonce in event.get('text','')
 if events['state']!='running' or time.monotonic()>deadline:break
 time.sleep(.25);status,events=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/events',{**reference,'after':cursor});assert status==200
if events['state']=='running':post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/cancel',reference)
if proof is not None:
 status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/attest',reference);report['attested']=status==200 and value.get('verified') is True
if proof is None:
 status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/reconcile',reference);report['reconciliation_http_status']=status
 if status==200:proof=value
if proof is not None:
 status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/acknowledge',{**reference,'terminal_proof_id':proof['terminal_proof_id']});report['native_acknowledged']=status==200 and value.get('acknowledged') is True;report['native_outcome']=proof['outcome']
selection=config['selections']['agentic'];status,observed=post('/nodia-ai/agentic/observe',{k:selection[k] for k in ['model_id','effort_id','configuration_generation']});report['supports_mcp_after']=status==200 and observed.get('supports_mcp') is True
report['harness_recovery']={'error':'cursor_field_sequence_instead_of_seq','same_attempt':True,'new_inferences':0,'callbacks_after_recovery':len(calls)}
report['status']='passed' if report.get('attested') and report.get('nonce_returned') and report['native_acknowledged'] else 'gates_open';report['quiet_after']=m.configuration()['quiet'];report['completed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(base/'mcp-validation-recovered.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['status','native_acknowledged','supports_mcp_after','harness_recovery']}))
