"""Resume legacy consumers only after a qualified R05 epoch and exact quiet/descriptor guards."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,subprocess,os
os.umask(0o077)
root=Path('/opt/nodia/verification/ai36-c05-r05-final01');root.mkdir(mode=0o700,exist_ok=False)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,timeout=120):return subprocess.run(args,capture_output=True,timeout=timeout,check=False)
def checked(args,timeout=120):
 p=run(args,timeout);assert p.returncode==0,'final_control_failed';return p.stdout
def units():
 out={}
 for n in ('nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx'):
  p=run(['systemctl','is-active',n]);state=p.stdout.decode().strip()
  assert(state,p.returncode) in (('active',0),('inactive',3)),'invalid_systemd_pair'
  out[n]={'state':state,'exit_code':p.returncode}
 return out
def quiet():
 sql=json.loads(checked(['/usr/local/bin/node','/tmp/nodia-ai-ai36-c05-live-health.mjs','/opt/nodia/releases/nodia-server-ai15-20261016']))
 native=json.loads(checked(['python3','/tmp/ai32-r04-cleanup.py']))
 assert sql['pending_jobs']==sql['open_attempts']==sql['retained_slots']==0 and sql['preserved_r05_chat']==1
 assert all(native[k]==0 for k in ('unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'))
 return {'SQL':sql,'native':native}
def descriptor():return json.loads(checked(['docker','inspect','nodia-gemini-microservice']))[0]
def public(c):return {'id':c['Id'],'image':c['Image'],'started_at':c['State']['StartedAt']}
def env(c):
 x=dict(v.split('=',1)for v in c['Config']['Env']);assert len(x)==len(c['Config']['Env']);return x
report={'stage':'AI-36-C05-R05','scope':'qualified_Python_fix_retained_CLI131_Node932_not_deployed','status':'running','started_at_utc':datetime.now(timezone.utc).isoformat(),'source_sha256':sha(Path(__file__)),'provider_generations':0,'consumers_resumed':False,'old_proofs_transferred':False}
def save():(root/'report.json').write_text(json.dumps(report,indent=2)+'\n')
save()
try:
 ep=Path('/opt/nodia/verification/ai36-c05-r05-role-canary02')
 runner=json.loads((ep/'runner-report.json').read_text());canary=json.loads((ep/'canary-report.json').read_text())
 assert runner['status']==canary['status']=='passed' and canary['accepted_native_starts']==1
 proof,ack=canary['proofs'][0],canary['acknowledgements'][0]
 assert proof['attempt_id']==ack['attempt_id']==canary['attempt_id'] and proof['outcome']=='completed' and proof['process_closed'] is True
 assert ack['acknowledged']is True and ack['terminal_proof_sha256']==proof['terminal_proof_sha256']
 assert canary['attestation']['verified'] is True
 report['pre_resume_quiet']=quiet();report['service_states_before']=units()
 assert {k:v['state']for k,v in report['service_states_before'].items()}=={'nodia-api':'inactive','nodia-ai-worker':'inactive','nodia-gemini-lab':'active','nginx':'active'}
 c=descriptor();b=json.loads(Path('/opt/nodia/verification/ai36-c05-r05-role-activation/private-original-container.json').read_text())
 assert c['Image']=='sha256:1a483f3f72de21374e9ba2546dba2df5e07e5a5e7bd4a159a5ee6ca7a444a3fb' and c['State']['Running']
 assert public(c)=={k:runner['epoch'][k]for k in ('id','image','started_at')}
 assert env(c)==env(b) and env(c).get('ANTIGRAVITY_CLI_VERSION','1.3.1')=='1.3.1'
 assert len(c['Mounts'])==6 and sorted(c['Mounts'],key=lambda m:m['Destination'])==sorted(b['Mounts'],key=lambda m:m['Destination'])
 for group,key in (('Config','User'),('HostConfig','PortBindings'),('HostConfig','Memory'),('HostConfig','NanoCpus'),('HostConfig','Tmpfs')):assert c[group][key]==b[group][key]
 runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
 files={f.relative_to(runtime).as_posix():sha(f)for f in sorted((runtime/'dist').rglob('*'))if f.is_file()}
 aggregate=hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()
 assert len(files)==932 and aggregate=='bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
 activation=json.loads(Path('/opt/nodia/verification/ai36-c05-r05-role-activation/report.json').read_text())
 assert sha(Path('/etc/systemd/system/nodia-gemini-lab.service.d/ai36-c05-role.conf'))==activation['systemd_override_sha256']
 report.update({'epoch':runner['epoch'],'canary_report_sha256':sha(ep/'canary-report.json'),'binary_observation':runner['binary_observation'],'compiled_files':len(files),'operational_Node_manifest_sha256':aggregate,'six_mounts_env_UID_resources_unchanged':True,'role_policy_sha256':canary['image_binding']['role_policy_sha256']})
 save();checked(['systemctl','start','nodia-api','nodia-ai-worker']);report['consumers_resumed']=True
 report['service_states_after']=units();assert all(v['state']=='active'for v in report['service_states_after'].values())
 assert public(descriptor())==public(c)
 report['post_resume_quiet']=quiet()
 metadata=run(['/usr/local/bin/node','/tmp/nodia-ai-ai36-c05-r05-current-modalities.mjs',str(runtime),'/opt/nodia/verification/ai36-c05-r05-node-candidate01'],90)
 (root/'current-modalities.json').write_bytes(metadata.stdout);(root/'current-modalities-stderr.log').write_bytes(metadata.stderr)
 report['current_metadata_exit_code']=metadata.returncode
 assert metadata.returncode==0,'current_metadata_control_failed'
 report['current_modalities_sha256']=sha(root/'current-modalities.json')
 report['final_quiet']=quiet();assert public(descriptor())==public(c)
 report['status']='passed'
except BaseException:
 report['status']='failed_guard_or_current_metadata_requires_operator_review';raise
finally:
 report['finished_at_utc']=datetime.now(timezone.utc).isoformat();save();print(json.dumps(report))
