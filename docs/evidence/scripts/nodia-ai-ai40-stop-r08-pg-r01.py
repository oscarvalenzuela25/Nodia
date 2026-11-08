"""One isolated PostgreSQL check of the immutable Stop-only preview; no adoption."""
import argparse,hashlib,json,os,re,stat,subprocess,sys
from pathlib import Path
ROOT=Path('/opt/nodia/verification/ai40-r08-final-pg-r01')
SERVER=Path('/opt/nodia/releases/nodia-server-ai40-r08')
WORK=ROOT/'work'
MANIFEST='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
TEST='test/nodia-ai-run-cancellation.integration.mjs'
TEST_SHA='8fad0092341dbebfdf0e52b7e7d195b245df4e016f7a323ecd5d6305dacfecd6'
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(b):return hashlib.sha256(b).hexdigest()
def command(argv):
 r=subprocess.run(argv,capture_output=True,timeout=15,check=False);require(r.returncode==0,'metadata_command_failed');return r.stdout
def durable(name,value):
 fd=os.open(WORK/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write((json.dumps(value,sort_keys=True)+'\n').encode());f.flush();os.fsync(f.fileno())
 d=os.open(WORK,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(d)
 finally:os.close(d)
def services():return {n:command(['systemctl','show',n,'--property=MainPID,ActiveState,WorkingDirectory','--no-pager']).decode()for n in('nodia-api','nodia-ai-worker','nodia-keyring','nginx','nodia-gemini-lab')}
def fixtures():return command(['docker','ps','-a','--filter','name=^template_ai40_','--format','{{.Names}}']).decode().splitlines()
def main(a):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 require(sha(Path(__file__).resolve().read_bytes())==a.operator_sha256 and a.execute_isolated_pg,'source_pin_and_explicit_flag_required')
 for p in(ROOT,WORK):
  info=p.lstat();require(p.resolve()==p and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'private_work_changed')
 require(not(WORK/'intent-pg.json').exists()and not(WORK/'receipt-pg.json').exists(),'isolated_intent_consumed')
 mb=(SERVER/'release-manifest.json').read_bytes();require(sha(mb)==MANIFEST,'preview_manifest_changed');m=json.loads(mb)
 require(len(m['files'])==4082 and m['files'][TEST]==TEST_SHA,'preview_inventory_changed')
 for name,pin in m['files'].items():
  p=SERVER/name;require(not p.is_symlink()and p.is_file()and sha(p.read_bytes())==pin,'preview_member_changed')
 require((SERVER/'node_modules').is_symlink()and(SERVER/'node_modules').resolve()==Path('/opt/nodia/nodia-server/node_modules'),'dependency_link_changed')
 before=services();require('WorkingDirectory=/opt/nodia/releases/nodia-server-ai40-r07\n'in before['nodia-api']and'WorkingDirectory=/opt/nodia/releases/nodia-server-ai40-r07\n'in before['nodia-ai-worker'],'operative_release_changed')
 require(not fixtures(),'another_isolated_suite_present')
 image=command(['docker','image','inspect','--format','{{.Id}}','postgres:16-alpine']).decode().strip();require(image==command(['docker','inspect','--format','{{.Image}}','nodia-lab-postgres-1']).decode().strip()and re.fullmatch('sha256:[a-f0-9]{64}',image),'installed_postgres_image_changed')
 report={'schema':'nodia-ai-ai40-stop-final-r08-PG-v1','status':'test_failed','manifest_sha256':MANIFEST,'operator_sha256':a.operator_sha256,'test_sha256':TEST_SHA,'services_before':before,'PostgreSQL_image_id':image,'operational_database_accessed':False,'native_profile_accessed':False,'SDK_requests':0,'provider_requests':0,'configured_SQL_writes':0,'fixture_SQL_writes':True,'adopted':False,'no_replay':True}
 durable('intent-pg.json',report)
 try:
  r=subprocess.run(['/usr/local/bin/node',str(SERVER/TEST)],cwd=SERVER,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null','RATE_LIMIT_STORAGE':'memory'},capture_output=True,timeout=150,check=False)
  report.update(child_exit=r.returncode,private_stderr_bytes=len(r.stderr),private_stderr_emitted=False)
  diagnostics=[]
  for line in r.stderr.decode('utf8','replace').splitlines():
   try:d=json.loads(line)
   except ValueError:continue
   if type(d)is dict and set(d)=={'status','phase','test_id','exception_class','sqlstate','first_party_frame','checks_completed','provider_calls','fixture_database_only'}and d.get('status')=='failed'and d.get('provider_calls')==0 and d.get('fixture_database_only')is True:diagnostics.append(d)
  report['closed_diagnostics']=diagnostics
  values=[]
  for line in r.stdout.decode('utf8','replace').splitlines():
   try:v=json.loads(line)
   except ValueError:continue
   if type(v)is dict and v.get('fixture_database_only')is True:values.append(v)
  report['services_after']=services();report['remaining_fixture_containers']=fixtures()
  require(r.returncode==0 and len(values)==1 and values[0].get('status')=='passed'and len(values[0].get('checks',[]))==13 and values[0].get('provider_calls')==0 and values[0].get('physical_ack_tested')is False,'isolated_test_not_passed')
  require(report['services_after']==before and not report['remaining_fixture_containers'],'services_changed_or_fixture_retained')
  report.update(status='passed_isolated_PG',test=values[0],fixture_removed=True)
 except Exception as e:
  text=str(e);report['error_code']=text if isinstance(e,ValueError)and re.fullmatch('[a-z_]{1,100}',text)else'private_dependency_or_timeout';report['remaining_fixture_containers']=fixtures()
 finally:durable('receipt-pg.json',report)
 return report
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--operator-sha256',required=True);parser.add_argument('--execute-isolated-pg',action='store_true');a=parser.parse_args()
 try:
  r=main(a);print(json.dumps(r));sys.exit(0 if r['status']=='passed_isolated_PG'else 1)
 except Exception as e:
  value=str(e);print(json.dumps({'schema':'nodia-ai-ai40-stop-final-r08-PG-v1','status':'precondition_failed','code':value if isinstance(e,ValueError)and re.fullmatch('[a-z_]{1,100}',value)else'private_dependency_failure','no_replay':True,'private_details_emitted':False}));sys.exit(1)
