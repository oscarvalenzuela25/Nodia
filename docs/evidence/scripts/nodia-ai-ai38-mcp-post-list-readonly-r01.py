"""Read-only public installed CLI/source inventory and exact-attempt closed metadata."""
from datetime import datetime, timezone
import hashlib,json,mmap,re,subprocess
from pathlib import Path
EXPECTED={'id':'9b07866b018c51efcb481a47fa8d81ef94b98dab430c1535b54b5d098488f267','image':'sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e','started_at':'2026-10-22T19:48:35.342867871Z'}
ATTEMPT='486e16be-f1e1-4b53-b19b-b34fe2a62ae2'
def run(args):
 r=subprocess.run(args,capture_output=True,timeout=30,check=True);return r.stdout

def epoch():
 v=json.loads(run(['docker','inspect','nodia-gemini-microservice']))[0]
 x=dict(id=v['Id'],image=v['Image'],started_at=v['State']['StartedAt'])
 assert x==EXPECTED and v['State']['Running'];return x
before=epoch()
program=r'''
import hashlib,json,mmap,re
from pathlib import Path
cli=Path('/opt/nodia/antigravity-cli/1.3.1/agy');assert cli.is_file() and cli.stat().st_size<512*1024*1024
h=hashlib.sha512()
with cli.open('rb') as f:
 for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
with cli.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as b:
 methods=[x for x in ('initialize','notifications/initialized','notifications/cancelled','notifications/progress','notifications/tools/list_changed','tools/list','tools/call','resources/list','resources/templates/list','prompts/list','logging/setLevel','ping') if x.encode() in b]
 symbols=sorted(set(x.decode('ascii') for x in re.findall(rb'(?:github\.com/modelcontextprotocol/go-sdk|github\.com/mark3labs/mcp-go|github\.com/modelcontextprotocol/python-sdk)[A-Za-z0-9_./*()\[\]<>-]{0,140}',b)))
 header=b[:4].hex()
 names=sorted(p.name for p in cli.parent.iterdir() if p.is_file() and not p.is_symlink())
root=Path('/app');files={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*.py') if p.is_file() and not p.is_symlink()}
# Do not inspect the CLI home/profile. Only /app's static public files and install directory.
print(json.dumps({'cli':{'static_path':str(cli),'bytes':cli.stat().st_size,'sha512':h.hexdigest(),'magic_hex':header,'install_regular_files':names,'protocol_literals_present_not_execution_evidence':methods,'public_MCP_library_symbols':symbols[:150],'symbol_count':len(symbols),'binary_executed':False},'public_python_hashes':files,'public_python_count':len(files)}))
'''
native=json.loads(run(['docker','exec','--user','10001:10001','nodia-gemini-microservice','python','-B','-c',program]))
r=subprocess.run(['docker','logs','--timestamps','--since','2026-10-22T19:55:16Z','--until','2026-10-22T19:57:26Z','--tail','10000','nodia-gemini-microservice'],capture_output=True,timeout=20,check=True)
assert len(r.stdout)+len(r.stderr)<=8*1024*1024
term=[]
for line in (r.stdout+b'\n'+r.stderr).splitlines():
 m=re.fullmatch(rb'([^ ]+) nodia_ai_mcp_terminal (.+)',line)
 if not m:continue
 v=json.loads(m[2])
 if not isinstance(v,dict) or v.get('attempt_id')!=ATTEMPT:continue
 rpc=v.get('rpc');assert isinstance(rpc,dict)
 z=rpc.get('last_response');assert z is None or (isinstance(z,dict) and set(z)=={'method','response','error_code'})
 if z:
  assert z['method'] in {'initialize','notifications_initialized','tools_list','tools_call','ping','other'}
  assert z['response'] in {None,'success','error','notification'}
  assert z['error_code'] is None or type(z['error_code']) is int
 term.append({'timestamp_utc':m[1].decode('ascii'),'attempt_id':ATTEMPT,'last_response':z,'events':rpc.get('events'),'methods':rpc.get('methods'),'responses':rpc.get('responses'),'tools_list_successes':rpc.get('tools_list_successes')})
assert epoch()==before
print(json.dumps({'schema':'ai38-mcp-post-list-readonly-v1','observed_at_VM_utc':datetime.now(timezone.utc).isoformat(),'native_epoch':before,'native_public_inventory':native,'exact_finished_attempt_terminal_metadata':term,'full_method_sequence_retained':False,'reason':'Bridge diagnostics map unknown methods to other and aggregate; temporary IPC removed after execution. No raw message is reconstructed.','provider_generation_requests':0,'HTTP_requests':0,'service_changes':0,'profile_or_session_bytes_opened':False,'raw_logs_or_message_bodies_saved':False},indent=2))
