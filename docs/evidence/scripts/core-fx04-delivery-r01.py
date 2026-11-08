"""Selective FX01/02/03 adoption in the authorized local Linux laboratory.

Explicit phases, fresh encrypted backup, drained writers, one transactional
migration and bounded Redis invalidation. Never restores data automatically.
Rollback is prepared separately; it discards configured order and requires
writers stopped and a fresh backup. Historical operators are imported as pure
utilities only, never replayed or edited.
"""
import argparse,fcntl,hashlib,importlib.util,json,os,re,shutil,stat,subprocess,sys,tarfile,time
from datetime import datetime,timezone
from pathlib import Path,PurePosixPath
WORK=Path('/opt/nodia/verification/core-fx04-r01')
UPLOAD=Path('/tmp/core-fx04-r01')
PLAN_SHA='d51190239dad78abf586b75936a40b1d4479890254462a60a1f99863108f80ed'
ARCHIVE_SHA='14cd1abdc8c39925c2c2d294aa22620259fd69339d0f4a0b66211c20bf8affd0'
SITE=Path('/etc/nginx/sites-available/nodia-lab')
TIMERS=('nodia-ai-backup.timer','nodia-ai-backup-rotate.timer')
SERVICES=('nodia-api','nodia-ai-worker')
MIGRATION='AddModuleSortOrder1793200000000'

def require(ok,code):
 if not ok:raise ValueError(code)
def digest(b):return hashlib.sha256(b).hexdigest()
def command(argv,timeout=30,**kwargs):
 p=subprocess.run(argv,capture_output=True,timeout=timeout,**kwargs)
 require(p.returncode==0,'private_command_failed');return p.stdout
def load(path,pin,name):
 p=Path(path);require(digest(p.read_bytes())==pin,'helper_pin_changed')
 m=importlib.util.module_from_spec(importlib.util.spec_from_loader(name,loader=None));m.__file__=str(p)
 exec(compile(p.read_bytes(),str(p),'exec'),m.__dict__);return m
def helpers():
 b=load('/opt/nodia/verification/ai40-operator-r05/nodia-ai-ai40-adopt-r01.py','c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000','fx04_base')
 a=load('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/materials/nodia-ai-ai38-journal-activate.py','56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b','fx04_journal')
 h=load('/opt/nodia/verification/ai40-image-operator-r01/nodia-ai-ai40-image-operator-r03.py','1996130038b546458ddd7f608ea23d690cc094ef8c7b5009c98d711356cfe957','fx04_sql')
 return b,a,h
def write(name,obj):
 p=WORK/name;raw=(json.dumps(obj,sort_keys=True,separators=(',',':'))+'\n').encode()
 with os.fdopen(os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
def state(name):
 return dict(line.split('=',1) for line in command(['systemctl','show',name,'--property=MainPID,WorkingDirectory,ActiveState']).decode().splitlines())
def verify_release(path,pin):
 raw=(path/'release-manifest.json').read_bytes();require(digest(raw)==pin,'manifest_changed')
 obj=json.loads(raw)
 for rel,p in obj['files'].items():require(digest((path/rel).read_bytes())==p,'release_file_changed')
 return obj
def process_env(pid):
 return dict(v.split('=',1) for v in Path('/proc/'+str(pid)+'/environ').read_text().split('\0') if '=' in v)
def node(program,release,env):
 return json.loads(command(['/usr/local/bin/node','--input-type=module','-e',program],cwd=release,env=env,timeout=45))
SQL_PREFIX="""import 'dotenv/config';import {DataSource} from 'typeorm';const db=new DataSource({type:'postgres',host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT||5432),username:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,database:process.env.POSTGRES_DB});"""
SQL_SNAPSHOT=r'''
try{await db.initialize();const v=await db.transaction('REPEATABLE READ',async m=>{await m.query('SET TRANSACTION READ ONLY');
const tables=await m.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");const hashes={};
for(const {tablename:n} of tables){if(n==='auth_sessions'||n==='migrations')continue;if(!/^[a-z_]+$/.test(n))throw Error('invalid_table');
const expr=['modules','module_groups'].includes(n)?"to_jsonb(t)-'sort_order'":"to_jsonb(t)";
const [r]=await m.query(`SELECT count(*)::int AS count,encode(sha256(convert_to(COALESCE(jsonb_agg(${expr} ORDER BY (${expr})::text)::text,'[]'),'UTF8')),'hex') AS sha256 FROM "${n}" t`);hashes[n]=r;}
const order=await m.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('modules','module_groups') AND column_name='sort_order' ORDER BY table_name");
return {hashes,migrations:await m.query('SELECT id,timestamp::text,name FROM migrations ORDER BY id'),sort_columns:order,
sort_column_contract:await m.query("SELECT table_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('modules','module_groups') AND column_name='sort_order' ORDER BY table_name"),
sort_constraints:await m.query("SELECT conname,contype,condeferrable,condeferred FROM pg_constraint WHERE conname IN ('ck_module_groups_sort_order_nonnegative','uq_module_groups_sort_order','ck_modules_sort_order_nonnegative','uq_modules_group_sort_order') ORDER BY conname"),
groups:await m.query(`SELECT id::text,key,is_active${order.length?',sort_order':''} FROM module_groups ORDER BY ${order.length?'sort_order,':''}id`),
modules:await m.query(`SELECT m.id::text,m.key,m.module_group_id::text,m.is_active${order.length?',m.sort_order':''} FROM modules m JOIN module_groups g ON g.id=m.module_group_id ORDER BY ${order.length?'g.sort_order,g.id,m.sort_order,':''}m.id`)};});console.log(JSON.stringify(v));}finally{if(db.isInitialized)await db.destroy();}
'''
def snapshot(release,b,a,h):
 b.NEW=release
 states={n:state(n) for n in SERVICES};require(all(s['ActiveState']=='active' and s['WorkingDirectory']==str(release) for s in states.values()),'service_source_changed')
 pid=int(states['nodia-api']['MainPID']);env=process_env(pid);h.ACTIVE=release
 quiet=h.chat_projection(pid);require(all(quiet[k]==0 for k in ['pending_jobs','open_attempts','retained_slots']),'executions_not_quiet')
 physical=b.codex_barrier(a,Path('/var/lib/nodia/codex'),frozenset(int(states[n]['MainPID']) for n in SERVICES))
 sql=node(SQL_PREFIX+SQL_SNAPSHOT,release,env)
 return {'services':states,'SQL':sql,'quiet':quiet,'native':physical,'Gemini':b.native_epoch(a),'configuration_sha256':digest(Path(env['DOTENV_CONFIG_PATH']).read_bytes())},env
def prepare(plan):
 require(not (WORK/'prepare-receipt.json').exists(),'prepare_already_consumed')
 old=Path(plan['server_old']);new=Path(plan['server_new']);client=Path(plan['client_new'])
 require(not new.exists() and not client.exists(),'target_exists')
 require(os.statvfs('/opt/nodia').f_bavail*os.statvfs('/opt/nodia').f_frsize>150*1024*1024,'insufficient_disk')
 verify_release(old,plan['server_old_manifest_sha256'])
 archive=UPLOAD/'payload.tar.gz';require(digest(archive.read_bytes())==ARCHIVE_SHA,'archive_changed')
 with tarfile.open(archive,'r:gz') as tar:
  members=tar.getmembers();require(len(members)==len(plan['payload']),'archive_member_count')
  for m in members:
   require(m.isfile() and m.name in plan['payload'] and not PurePosixPath(m.name).is_absolute() and '..' not in PurePosixPath(m.name).parts,'archive_path_invalid')
   require(digest(tar.extractfile(m).read())==plan['payload'][m.name],'archive_member_changed')
  shutil.copytree(old,new,symlinks=True);client.mkdir(mode=0o755)
  for m in members:
   base,rel=m.name.split('/',1);target=(new if base=='server' else client if base=='client' else WORK/'inputs')/rel
   target.parent.mkdir(parents=True,exist_ok=True);require(not target.is_symlink(),'target_symlink_rejected');target.write_bytes(tar.extractfile(m).read());target.chmod(0o644)
 verify_release(new,plan['server_new_manifest_sha256']);verify_release(client,plan['client_new_manifest_sha256'])
 return {'phase':'prepare','status':'prepared_verified','server_files':len(json.loads((new/'release-manifest.json').read_bytes())['files']),'client_files':len(json.loads((client/'release-manifest.json').read_bytes())['files']),'server_delta':len(plan['delta'])}
def health():
 import urllib.request
 deadline=time.monotonic()+45
 while True:
  try:
   with urllib.request.urlopen('http://127.0.0.1:3000/api/v1/',timeout=3) as r:
    if r.status==200:return
  except Exception:pass
  require(time.monotonic()<deadline,'health_not_ready');time.sleep(.5)
def migrate(release,env,reverse=False):
 program=SQL_PREFIX+"import {AddModuleSortOrder1793200000000 as Migration} from './dist/migrations/1793200000000-AddModuleSortOrder.js';"+r'''
try{await db.initialize();const r=db.createQueryRunner();await r.connect();await r.startTransaction();try{
await r.query("SET LOCAL lock_timeout='10s'");await r.query("SET LOCAL statement_timeout='30s'");
const rows=await r.query('SELECT id,timestamp::text,name FROM migrations ORDER BY id');
'''+('''if(rows.length!==30||rows.at(-1).name!=='AddModuleSortOrder1793200000000')throw Error('migration_history_changed');await new Migration().down(r);await r.query('DELETE FROM migrations WHERE id=$1',[rows.at(-1).id]);''' if reverse else '''if(rows.length!==29||rows.at(-1).name!=='AddNodiaAiTextSearchIndex1793100000000')throw Error('migration_history_changed');await new Migration().up(r);await r.query('INSERT INTO migrations(timestamp,name) VALUES($1,$2)',['1793200000000','AddModuleSortOrder1793200000000']);''')+'''await r.commitTransaction();console.log(JSON.stringify({status:'committed',migration:'AddModuleSortOrder1793200000000',direction:''' + json.dumps('down' if reverse else 'up')+'''}));}catch(e){await r.rollbackTransaction();throw e;}finally{await r.release();}}finally{if(db.isInitialized)await db.destroy();}'''
 return node(program,release,env)
def invalidate(release,env):
 return node("""import 'dotenv/config';import {Redis} from 'ioredis';const r=new Redis({host:process.env.REDIS_HOST||'localhost',port:Number(process.env.REDIS_PORT||6379),password:process.env.REDIS_PASSWORD||undefined,maxRetriesPerRequest:1});try{let c='0',n=0;do{const v=await r.scan(c,'MATCH','auth:context:*','COUNT',100);c=v[0];if(v[1].length)n+=await r.del(...v[1]);}while(c!=='0');let left=0;do{const v=await r.scan(c,'MATCH','auth:context:*','COUNT',100);c=v[0];left+=v[1].length;}while(c!=='0');if(left)throw Error('cache_not_empty');console.log(JSON.stringify({removed:n,remaining:left,pattern:'auth:context:*'}));}finally{await r.quit();}""",release,env)
def verify_schema(before,after):
 require(after['migrations'][:-1]==before['migrations'] and after['migrations'][-1]['name']==MIGRATION,'migration_history_postcondition')
 require(len(after['sort_column_contract'])==2 and all(c['data_type']=='integer' and c['is_nullable']=='NO' and c['column_default'] is None for c in after['sort_column_contract']),'column_contract_postcondition')
 require(len(after['sort_constraints'])==4 and all(c['contype']=='c' and not c['condeferrable'] or c['contype']=='u' and c['condeferrable'] and not c['condeferred'] for c in after['sort_constraints']),'constraint_contract_postcondition')
 def priority(g):
  key=re.sub('[-_]','',g['key'].lower())
  return (1 if 'business' in key or 'negocio' in key else 99 if any(x in key for x in ['setting','ajuste','admin']) else 50,int(g['id']))
 groups=sorted(before['groups'],key=priority)
 require({g['id']:g['sort_order'] for g in after['groups']}=={g['id']:i for i,g in enumerate(groups)},'group_backfill_postcondition')
 module_ranks={}
 for group in groups:
  for i,m in enumerate(sorted([m for m in before['modules'] if m['module_group_id']==group['id']],key=lambda m:int(m['id']))):module_ranks[m['id']]=i
 require({m['id']:m['sort_order'] for m in after['modules']}==module_ranks,'module_backfill_postcondition')
def main(args):
 require(sys.platform=='linux' and os.getuid()==0,'root_linux_required')
 require(digest(Path(__file__).read_bytes())==args.operator_sha256,'operator_changed')
 raw=(WORK/'plan.json').read_bytes();require(digest(raw)==PLAN_SHA,'plan_changed');plan=json.loads(raw)
 if args.phase=='prepare':
  value=prepare(plan);write('prepare-receipt.json',value);return value
 b,a,h=helpers();old=Path(plan['server_old']);new=Path(plan['server_new']);a.RELEASE=old
 verify_release(old,plan['server_old_manifest_sha256']);verify_release(new,plan['server_new_manifest_sha256']);verify_release(Path(plan['client_new']),plan['client_new_manifest_sha256'])
 before,env=snapshot(old,b,a,h);require(len(before['SQL']['migrations'])==29 and not before['SQL']['sort_columns'],'unexpected_schema')
 require(digest(SITE.read_bytes())==plan['site_old_sha256'],'site_changed')
 transitions=b.descriptor_bytes(old,new)
 require(all(state(n)['ActiveState']=='active' for n in TIMERS),'timers_not_active')
 preflight={'phase':args.phase,'status':'preflight_passed','before':before,'server_new':str(new),'knowledge_preserves_contracts':150,'SDK_generations':0}
 if args.phase=='preflight':return preflight
 require(args.execute and not (WORK/'adopt-intent.json').exists(),'fresh_execute_required')
 write('adopt-intent.json',preflight);original_site=SITE.read_bytes();(WORK/'site-before.private').write_bytes(original_site);(WORK/'site-before.private').chmod(0o600)
 for i,(_,original,_,_) in enumerate(transitions):
  (WORK/f'descriptor-{i}.private').write_bytes(original);(WORK/f'descriptor-{i}.private').chmod(0o600)
 report={'phase':'adopt','status':'adopt_failed','before':before,'migration_committed':False,'descriptors_changed':False,'provider_generations':0}
 stopped=False
 try:
  command(['systemctl','stop',*TIMERS]);b.oneshots_idle(a)
  began=datetime.now(timezone.utc)
  backup=json.loads(command(['sudo','-u','nodia','/usr/local/bin/node',str(old/'scripts/nodia-ai-backups.mjs'),'backup','/etc/nodia-ai-recovery/backup.json'],timeout=240,cwd=old))
  b.validate_backup(backup,began,datetime.now(timezone.utc));write('fresh-backup.json',backup);report['backup']=backup
  fresh,_=snapshot(old,b,a,h);require(fresh['SQL']==before['SQL'] and fresh['quiet']==before['quiet'],'data_changed_during_backup')
  stopped=True;command(['systemctl','stop','nodia-api'],timeout=60)
  require(state('nodia-api')['ActiveState']=='inactive','api_not_stopped')
  quiet=h.chat_projection(int(before['services']['nodia-ai-worker']['MainPID']));require(quiet==before['quiet'],'worker_not_drained')
  b.codex_barrier(a,Path('/var/lib/nodia/codex'),frozenset({int(before['services']['nodia-ai-worker']['MainPID'])}))
  command(['systemctl','stop','nodia-ai-worker'],timeout=60);require(state('nodia-ai-worker')['ActiveState']=='inactive','worker_not_stopped')
  b.codex_barrier(a,Path('/var/lib/nodia/codex'))
  require(node(SQL_PREFIX+SQL_SNAPSHOT,old,env)==before['SQL'],'data_changed_before_migration')
  report['migration']=migrate(new,env);report['migration_committed']=True;write('migration-receipt.json',report['migration'])
  for path,expected,desired,mode in transitions:b.atomic_replace(path,expected,desired,mode,'core-fx04')
  report['descriptors_changed']=True
  require(original_site.count(plan['client_old'].encode())==1,'client_source_not_unique')
  desired_site=original_site.replace(plan['client_old'].encode(),plan['client_new'].encode());b.atomic_replace(SITE,original_site,desired_site,0o644,'core-fx04')
  command(['nginx','-t']);report['cache']=invalidate(new,env)
  command(['systemctl','daemon-reload']);require(all(state(n)['WorkingDirectory']==str(new) for n in SERVICES),'effective_target_wrong')
  command(['systemctl','start',*SERVICES],timeout=45);health();command(['systemctl','reload','nginx'])
  after,_=snapshot(new,b,a,h)
  require(before['SQL']['hashes']==after['SQL']['hashes'],'unrelated_data_changed')
  require(len(after['SQL']['sort_columns'])==2 and len(after['SQL']['migrations'])==30 and after['SQL']['migrations'][-1]['name']==MIGRATION,'schema_postcondition_failed')
  verify_schema(before['SQL'],after['SQL'])
  require(after['Gemini']==before['Gemini'] and after['configuration_sha256']==before['configuration_sha256'] and after['quiet']==before['quiet'],'protected_state_changed')
  command(['systemctl','start',*TIMERS]);require(all(state(n)['ActiveState']=='active' for n in TIMERS),'timers_not_restored')
  report.update(status='adopted_verified',after=after,site_new_sha256=digest(desired_site),timers_restored=True)
 except Exception as error:
  report['code']=str(error) if isinstance(error,ValueError) else 'private_dependency_failure'
  report['services_observed']={n:state(n) for n in SERVICES}
  if not stopped:
   command(['systemctl','start',*TIMERS]);report['timers_restored']=True
  else:
   # Never reopen R09 on the new schema or replay an uncertain migration.
   command(['systemctl','stop','nodia-api'],timeout=60);report['admission_closed']=True
   worker=state('nodia-ai-worker')
   if worker['ActiveState']=='active':
    try:
     q=h.chat_projection(int(worker['MainPID']))
     require(all(q[k]==0 for k in ['pending_jobs','open_attempts','retained_slots']),'worker_still_draining')
     b.codex_barrier(a,Path('/var/lib/nodia/codex'),frozenset({int(worker['MainPID'])}))
     command(['systemctl','stop','nodia-ai-worker'],timeout=60)
    except Exception:report['worker_left_draining']=True
   report['services_after_failure']={n:state(n) for n in SERVICES}
  raise
 finally:write('adopt-receipt.json',report)
 return report
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--phase',choices=['prepare','preflight','adopt'],required=True);parser.add_argument('--operator-sha256',required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
 try:
  with os.fdopen(os.open(WORK/'phase.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600),'r+b') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);print(json.dumps(main(args)))
 except Exception as error:
  print(json.dumps({'status':'failed','phase':args.phase,'code':str(error) if isinstance(error,ValueError) else 'private_dependency_failure','automatic_retry':False}));sys.exit(1)
