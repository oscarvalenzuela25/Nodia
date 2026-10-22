"""Read-only AI37 closure snapshot; no inference, observe, restart or credential access."""
from pathlib import Path
from datetime import datetime,timezone
import subprocess,json,hashlib
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def checked(args):
 p=subprocess.run(args,capture_output=True,check=False,timeout=45);assert p.returncode==0;return p.stdout
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
files={p.relative_to(root).as_posix():sha(p)for p in sorted((root/'dist').rglob('*'))if p.is_file()}
units={}
for n in ('nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx'):
 p=subprocess.run(['systemctl','is-active',n],capture_output=True,check=False)
 state=p.stdout.decode().strip();assert(state,p.returncode)==('active',0)
 units[n]={'state':state,'exit_code':p.returncode}
c=json.loads(checked(['docker','inspect','nodia-gemini-microservice']))[0]
b=json.loads(Path('/opt/nodia/verification/ai36-c05-r05-role-activation/private-original-container.json').read_text())
def env(c):
 v=dict(x.split('=',1)for x in c['Config']['Env']);assert len(v)==len(c['Config']['Env']);return v
assert c['Image']==b['Image']=='sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa' and c['State']['Running']
assert env(c)==env(b) and sorted(c['Mounts'],key=lambda m:m['Destination'])==sorted(b['Mounts'],key=lambda m:m['Destination'])
for group,key in (('Config','User'),('HostConfig','PortBindings'),('HostConfig','Memory'),('HostConfig','NanoCpus'),('HostConfig','Tmpfs')):assert c[group][key]==b[group][key]
aggregate=hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()
assert len(files)==932 and aggregate=='bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
SQL=json.loads(checked(['/usr/local/bin/node','/tmp/nodia-ai-ai36-c05-live-health.mjs',str(root)]))
native=json.loads(checked(['python3','/tmp/ai32-r04-cleanup.py']))
assert SQL['pending_jobs']==SQL['open_attempts']==SQL['retained_slots']==0 and SQL['preserved_r05_chat']==1
assert all(native[k]==0 for k in ('unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'))
drop=sha(Path('/etc/systemd/system/nodia-gemini-lab.service.d/ai36-c05-role.conf'));assert drop=='4d322139517dbcf55a0750af722ed9b54719bcc49ea60f52545225ace8054a87'
print(json.dumps({'stage':'AI-37','scope':'read_only_unchanged_operational_runtime_after_disposable_AI37_checks','status':'passed','observed_at_utc':datetime.now(timezone.utc).isoformat(),'source_sha256':sha(Path(__file__)),'units':units,'container':{'id':c['Id'],'image':c['Image'],'started_at':c['State']['StartedAt']},'binary_version_configured':env(c).get('ANTIGRAVITY_CLI_VERSION','1.3.1'),'binary_sha512_configured':env(c)['ANTIGRAVITY_CLI_SHA512'],'binary_configuration_scope':'frozen_baseline_image_and_configuration_not_fresh_version_command','six_mounts_unique_env_UID_ports_resources_match_private_baseline':True,'dropin_sha256':drop,'compiled_files':len(files),'operational_Node_manifest_sha256':aggregate,'SQL':SQL,'native':native,'provider_generations':0,'metadata_requests':0,'profile_contents_read':False,'services_restarted':False},indent=2))
