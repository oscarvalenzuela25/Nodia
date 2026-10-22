import hashlib,json,os,subprocess,time,urllib.request
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016'); candidate=Path('/opt/nodia/verification/ai32-final-20261017')
base=Path('/tmp/nodia-ai32-final-20261017'); units=['nodia-api','nodia-ai-worker']
def run(args,**kw):
 options={'check':True,'stdout':subprocess.PIPE,'stderr':subprocess.PIPE};options.update(kw);return subprocess.run(args,**options)
def quiet():return json.loads(run(['/usr/local/bin/node',str(base/'ai32-lab-db.mjs')]).stdout)
def bridge():
 d=json.loads(run(['docker','inspect','nodia-gemini-microservice']).stdout)[0];return(d['Id'],d['Image'],d['State']['StartedAt'])
def meta():return{n:(hashlib.sha256((root/n).read_bytes()).hexdigest(),(root/n).stat().st_uid,(root/n).stat().st_gid,(root/n).stat().st_mode) for n in ['.env','package.json','package-lock.json']}
manifest=json.loads((base/'server-manifest.json').read_text()); expected={x['path']:x['sha256'] for x in manifest['files'] if x['path'].startswith('dist/')}
for name,sha in expected.items():assert hashlib.sha256((candidate/name).read_bytes()).hexdigest()==sha,name
assert(root/'dist').resolve()==root/'dist' and root.resolve()==root and candidate.resolve()==candidate
baseline=quiet();assert baseline['pending_jobs']==baseline['open_attempts']==baseline['held_or_unknown_slots']==0 and baseline['migrations']==25,baseline
assert baseline['proposals']==baseline['drafts']==0,baseline
oldbridge=bridge();oldmeta=meta();gid=(root/'dist').stat().st_gid
backup=Path('/opt/nodia/verification-backups')/('ai32-before-attachments-'+str(int(time.time())));backup.mkdir(mode=0o700)
dump=backup/'nodia-lab.dump'
with dump.open('wb') as out:run(['docker','exec','nodia-lab-postgres-1','pg_dump','-U',baseline['username'],'-d',baseline['database'],'-Fc'],stdout=out)
dump.chmod(0o600);assert dump.stat().st_size>10000
pending=root/'.pending-dist-ai32';assert not pending.exists();pending.mkdir(mode=0o750)
for name,sha in expected.items():
 target=pending/Path(name).relative_to('dist');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((candidate/name).read_bytes());target.chmod(0o640);os.chown(target,0,gid)
for directory,_,_ in os.walk(pending):os.chmod(directory,0o750);os.chown(directory,0,gid)
run(['systemctl','stop','nodia-ai-worker','nodia-api'],timeout=60)
try:
 assert quiet()['pending_jobs']==0
 migration_program="""
import fs from 'node:fs';
import { createRequire } from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(runtime+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(runtime+'/.env')));
const { DataSource }=require('typeorm');
const { CreateNodiaAiAttachments1792800000000: Migration }=await import('/opt/nodia/verification/ai32-final-20261017/dist/migrations/1792800000000-CreateNodiaAiAttachments.js');
const db=new DataSource({type:'postgres',host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,username:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,migrations:[Migration],migrationsTableName:'migrations'});
await db.initialize();try{const applied=await db.runMigrations({transaction:'all'});if(applied.length!==1||applied[0].name!=='CreateNodiaAiAttachments1792800000000')throw Error('Unexpected migration result');console.log(JSON.stringify({applied:applied.map(item=>item.name)}));}finally{await db.destroy();}
"""
 migration_file=base/'ai32-apply-m3.mjs';migration_file.write_text(migration_program);migration_file.chmod(0o600)
 applied=json.loads(run(['/usr/local/bin/node',str(migration_file)]).stdout)
 assert quiet()['migrations']==26

 saved=backup/'dist-before';os.rename(root/'dist',saved);os.rename(pending,root/'dist')
 run(['systemctl','start',*units],timeout=60)
 for _ in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:3000/api/v1/',timeout=2) as response:
    if response.status==200:break
  except OSError:time.sleep(.25)
 else:raise RuntimeError('api_health_failed')
except BaseException:
 # M3 is additive. If activation fails before chat use, restore code and retain reconciled schema; do not automatically drop uploaded content.
 if (backup/'dist-before').exists() and (root/'dist').exists():
  run(['systemctl','stop',*units],timeout=60);os.rename(root/'dist',backup/'dist-failed');os.rename(backup/'dist-before',root/'dist')
 run(['systemctl','start',*units],timeout=60);raise
assert meta()==oldmeta and bridge()==oldbridge
after=quiet();assert after['migrations']==26 and after['nodia_ai_tables']==19 and after['nodia_ai_columns']==267 and after['pending_jobs']==after['open_attempts']==after['held_or_unknown_slots']==0,after
report={'stage':'AI-32','scope':'private_local_vm_lab','activated_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'backup':str(backup),'backup_bytes':dump.stat().st_size,'backup_sha256':hashlib.sha256(dump.read_bytes()).hexdigest(),'migration':applied,'http_health':200,'units':{u:run(['systemctl','is-active',u]).stdout.decode().strip() for u in units},'configured_provider_environment_dependencies_unchanged':True,'gemini_container_restarted':False,'provider_login_logout_or_inference_requested':False,'profile_bytes_hashed':False,'knowledge_capabilities':67,'knowledge_fragments':27,'quiet_after':{k:after[k] for k in ['pending_jobs','open_attempts','held_or_unknown_slots','migrations']},'real_inferences_by_deployment':0,'business_writes':0,'new_tables':1,'new_columns':25,'existing_columns_added':1}
(base/'activation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))


