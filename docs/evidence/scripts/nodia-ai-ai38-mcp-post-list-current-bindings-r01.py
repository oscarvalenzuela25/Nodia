"""Pinned readonly connection2 capability snapshot; never invokes generation."""
import argparse,hashlib,importlib.util,json,subprocess
from datetime import datetime,timezone
from pathlib import Path
P=Path('/opt/nodia/verification/ai38-profile-modalities-r01/nodia-ai-ai38-profile-reattest-modalities-r01.py')
PIN='f51d16a67b73a5eb5f5eaa6beee4bad1ae06d0e1af0d7641487887835af843d3'
EXPECTED=dict(id='9b07866b018c51efcb481a47fa8d81ef94b98dab430c1535b54b5d098488f267',image='sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e',started_at='2026-10-22T19:48:35.342867871Z')
def epoch():
 r=subprocess.run(['docker','inspect','nodia-gemini-microservice'],capture_output=True,check=True,timeout=15);v=json.loads(r.stdout)[0];e=dict(id=v['Id'],image=v['Image'],started_at=v['State']['StartedAt']);assert e==EXPECTED and v['State']['Running'];return e
p=argparse.ArgumentParser();p.add_argument('--mode',choices=('configuration','agentic','web'),action='append',required=True);args=p.parse_args();assert len(args.mode)<=2 and len(set(args.mode))==len(args.mode)
assert hashlib.sha256(P.read_bytes()).hexdigest()==PIN
spec=importlib.util.spec_from_file_location('pinned_modalities_readonly',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
packet_files=m.verify_packet(m.PACKET);before=epoch();snapshots=[]
for mode in args.mode:
 began=datetime.now(timezone.utc).isoformat()
 r=subprocess.run(['/usr/local/bin/node','--input-type=module','-',str(m.PACKET),m.API_ENV,mode],input=m.SNAPSHOT.encode(),capture_output=True,timeout=60,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null','RATE_LIMIT_STORAGE':'memory'})
 assert r.returncode==0
 value=json.loads(r.stdout);assert value['connection_id']=='2' and value['provider_key']=='gemini' and all(x==0 for x in value['quiet'].values())
 snapshots.append({'mode':mode,'began_VM_utc':began,'ended_VM_utc':datetime.now(timezone.utc).isoformat(),'snapshot':value})
 assert epoch()==before
print(json.dumps({'schema':'ai38-post-list-current-capability-bindings-v1','status':'observed_read_only','pinned_helper_sha256':PIN,'packet_manifest_sha256':m.PACKET_SHA,'packet_files_verified':packet_files,'native_epoch_before':before,'native_epoch_after':epoch(),'same_native_epoch':True,'snapshots':snapshots,'configured_SQL_writes':0,'native_observe_requests':sum(x!='configuration' for x in args.mode),'provider_generation_requests':0,'raw_stderr_headers_or_credentials_emitted':False,'service_changes':0},indent=2))
