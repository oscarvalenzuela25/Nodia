"""One Client package update, with an independent reversible site descriptor.

No previous operator run, consumed intent, Server build, SQL write or SDK call.
Target manifest is frozen after two identical production builds.
"""
import argparse,hashlib,importlib.util,json,os,re,stat,sys
from pathlib import Path
PARENT=Path('/opt/nodia/verification/ai40-client-nginx-operator-r01/nodia-ai-ai40-client-nginx-operator-r01.py')
PARENT_SHA='60660f0c5b4f1383f910bbdc0068e97b8f08212f3bfb3e6228ad9fed38b722b0'
OLD=Path('/opt/nodia/releases/nodia-client-ai40-nginx-r01')
OLD_MANIFEST='5e30dc8ee9879eab0aed715ea76226efc6da0cb910eee2b254ce260a5bf194e0'
NEW=Path('/opt/nodia/releases/nodia-client-ai40-buttons-r01')
NEW_MANIFEST='65c1e83a9ab9219fcd02af6c766e6dd8b5f6c14bc6a12f25abf8e79bdefde8dd'
WORK=Path('/opt/nodia/verification/ai40-client-buttons-adopt-r01/work')
OLD_SITE_SHA='f22baabdc2f9b8c063b3bffb9268472456e99fbf89d41e491f1cbc34f44d7343'
API_SHA='7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'

def require(ok,code):
 if not ok:raise ValueError(code)

def sha(b):return hashlib.sha256(b).hexdigest()

def private(path,mode=0o600):
 s=path.lstat();require(path.resolve()==path and stat.S_ISREG(s.st_mode)and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==mode,'private_file_changed')

def encoded(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()

def write_once(path,b):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(b);f.flush();os.fsync(f.fileno())
 d=os.open(WORK,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(d)
 finally:os.close(d)

def stable(v):return {k:x for k,x in v.items()if k!='status_read_attempts'}

def snapshot(op):
 g=op.load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','buttons_release_guard')
 h=op.load(g.HELPER,g.HELPER_SHA,'buttons_public_guard');h.ACTIVE=g.RELEASE;h.validate_candidate(g.LEGACY_MANIFEST_SHA);g.validate_release()
 status=op.load('/opt/nodia/verification/ai40-journal-status-read-r01/nodia-ai-ai40-journal-status-read-r01.py','5e5b710b0210e82228593401f0480e54970666ef4151251e930c16bb85da6c38','buttons_status_guard')
 images=op.load('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py','b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355','buttons_proof_guard')
 services={n:h.service(n)for n in('nodia-api','nodia-ai-worker','nodia-keyring')};require([services[n]['pid']for n in services]==[3630848,3630849,3630841],'backend_services_changed')
 events=[];public=status.public_preflight(h,services,events)
 require(all(public['SQL'].get(k)==v for k,v in {'messages':38,'runs':20,'dispatches':28,'executions':2,'effect_receipts':3,'financial_effects':1,'pending_jobs':0,'open_attempts':0,'retained_slots':0}.items()),'operational_chat_changed')
 require(public['codex']['pending']==public['codex']['locks_or_sockets']==0,'native_not_quiet')
 env=h.selected_environment(services['nodia-api']['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
 source=(h.CANDIDATE.parent/'public-canary-input.mjs').read_text()
 r=h.command(['/usr/local/bin/node','--input-type=module','-e',source],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','AI40_CONNECTION_ID':'1',**env},timeout=25)
 require(r.returncode==0 and sha(r.stdout)=='506e4c436bc22152c9aa632565d470450206d5ffdb1c9b976c0d0c7b5116f8b2','public_configuration_changed')
 proofs=images.proof_snapshot(h,json.loads(r.stdout)['selection'],g.EXPECTED_RUNTIME_FINGERPRINT)
 require({k:v.get('sha256')for k,v in proofs.items()}==op.PROOFS and all(v['present']and v['scope']==proofs['mcp']['scope']for v in proofs.values()),'current_proofs_changed')
 query="""
 try{await db.initialize();const output=await db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');const [row]=await m.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_preferences WHERE owner_id=1) preferences,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_preferences p WHERE owner_id=1) preferences_sha256,
 (SELECT count(*)::int FROM finance_movements) finance_count,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sha256,
 (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments`,['ec626b72-1f32-4486-9f3a-8263cffce267']);return row;});console.log(JSON.stringify(output));}finally{if(db.isInitialized)await db.destroy();}
 """
 r=h.command(['/usr/local/bin/node','--input-type=module','-e',source.split('try {',1)[0]+query],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root',**env},timeout=25)
 require(r.returncode==0 and len(r.stdout)<4096,'domain_read_unavailable');domain=json.loads(r.stdout)
 require(domain=={'preferences':2,'preferences_sha256':'b3cffd91df324d06e640ff3c9e169db2d2fb5a24692ff11dbbc2cc7297443237','finance_count':2,'finance_sha256':'5335e312c7b542552f924cf266fc007ff1a3691e522e6c682bb20e374b5b7871','attachments':6},'accepted_preferences_or_finance_changed')
 protected={n:op.command(['systemctl','show',n,'--property=MainPID,ActiveState,Type,RemainAfterExit','--no-pager']).decode()for n in('nginx','nodia-gemini-lab')}
 require(all('ActiveState=active\n'in v for v in protected.values()),'protected_service_not_active')
 epoch=sha(op.command(['docker','inspect','--format','{{json .Id}} {{json .Image}} {{json .State.StartedAt}} {{json .State.Running}}','c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3']))
 return {'services':services,'protected':protected,'Gemini_epoch_sha256':epoch,'SQL':public['SQL'],'physical_Codex':public['codex'],'domain':domain,'public_configuration_sha256':'506e4c436bc22152c9aa632565d470450206d5ffdb1c9b976c0d0c7b5116f8b2','proof_sha256':op.PROOFS,'scope':proofs['mcp']['scope'],'status_read_attempts':events}

def set_package(op,path,pin):
 op.CLIENT=path;op.MANIFEST=pin;return op.package()

def api(op):
 code,body,_=op.http('/api/v1/');require(code==200 and sha(body)==API_SHA,'API_proxy_body_changed')

def run(a):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 private(Path(__file__).resolve());require(sha(Path(__file__).resolve().read_bytes())==a.operator_sha256,'operator_changed')
 require(re.fullmatch('[a-f0-9]{64}',NEW_MANIFEST)is not None,'target_not_frozen')
 info=WORK.lstat();require(WORK.resolve()==WORK and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'private_work_required')
 private(PARENT);require(sha(PARENT.read_bytes())==PARENT_SHA,'frozen_parent_changed')
 spec=importlib.util.spec_from_file_location('frozen_client_functions',PARENT);op=importlib.util.module_from_spec(spec);spec.loader.exec_module(op)
 old_package=set_package(op,OLD,OLD_MANIFEST);new_package=set_package(op,NEW,NEW_MANIFEST)
 private(op.SITE,0o644);current=op.SITE.read_bytes()
 if a.phase in('preflight','adopt'):
  require(sha(current)==OLD_SITE_SHA and current.count(str(OLD/'dist').encode())==1,'old_site_changed');original=current
 else:
  private(WORK/'old-site.conf');original=(WORK/'old-site.conf').read_bytes();require(sha(original)==OLD_SITE_SHA,'old_backup_changed')
 desired_new=original.replace(str(OLD/'dist').encode(),str(NEW/'dist').encode())
 require(current in(original,desired_new),'site_state_not_determined')
 before=snapshot(op);api(op)
 report={'schema':'nodia-ai-ai40-client-buttons-adoption-v1','phase':a.phase,'status':'preflight_passed','operator_sha256':a.operator_sha256,'parent_operator_sha256':PARENT_SHA,'old_manifest_sha256':OLD_MANIFEST,'new_manifest_sha256':NEW_MANIFEST,'site_before_sha256':sha(current),'site_old_sha256':sha(original),'site_new_sha256':sha(desired_new),'before':before,'SDK_requests':0,'SQL_writes':0,'API_worker_restarted':False,'automatic_retry_allowed':False,'previous_operator_intents_modified':False}
 if a.phase=='preflight':
  require(not a.execute,'preflight_execute_invalid');set_package(op,OLD,OLD_MANIFEST);report['HTTP']=op.verify_http(old_package,True);return report
 require(a.execute and not(WORK/(a.phase+'-intent.json')).exists()and not(WORK/(a.phase+'-receipt.json')).exists(),'fresh_explicit_execute_required')
 if a.phase=='adopt':
  require(not(WORK/'rollback-intent.json').exists(),'rollback_already_used');write_once(WORK/'old-site.conf',original);write_once(WORK/'baseline.json',encoded(stable(before)));desired=desired_new;package=new_package;set_package(op,NEW,NEW_MANIFEST)
 else:
  private(WORK/'adopt-intent.json');intent=json.loads((WORK/'adopt-intent.json').read_bytes());private(WORK/'baseline.json')
  require(intent['operator_sha256']==a.operator_sha256 and intent['new_manifest_sha256']==NEW_MANIFEST and intent['site_new_sha256']==sha(desired_new)and json.loads((WORK/'baseline.json').read_bytes())==stable(before),'rollback_lineage_or_backend_changed')
  desired=original;package=old_package;set_package(op,OLD,OLD_MANIFEST)
 report.update(status='operation_failed',site_target_sha256=sha(desired));write_once(WORK/(a.phase+'-intent.json'),encoded(report))
 try:
  op.replace_site(desired)
  try:op.command(['nginx','-t'])
  except Exception:
   op.replace_site(current);op.command(['nginx','-t']);report['invalid_config_restored_before_reload']=True;raise
  op.command(['systemctl','reload','nginx']);report['nginx_reload_commands']=1;report['HTTP']=op.verify_http(package,True);api(op);after=snapshot(op)
  require(stable(after)==stable(before)and op.SITE.read_bytes()==desired,'postconditions_changed');report.update(status='adopted_verified'if a.phase=='adopt'else'rolled_back_verified',after=after)
 except Exception as error:
  value=str(error);report['error_code']=value if isinstance(error,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',value)else'private_dependency_or_protocol_failure';report['observed_site_sha256']=sha(op.SITE.read_bytes())
 finally:write_once(WORK/(a.phase+'-receipt.json'),encoded(report))
 return report

def guarded_run(a):
 if not a.execute:return run(a)
 import fcntl
 info=WORK.lstat();require(WORK.resolve()==WORK and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'private_work_required')
 fd=os.open(WORK/'.phase.lock',os.O_WRONLY|os.O_CREAT|os.O_NOFOLLOW,0o600)
 try:
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);return run(a)
 finally:os.close(fd)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--operator-sha256',required=True);parser.add_argument('--phase',choices=('preflight','adopt','rollback'),required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
 try:
  result=guarded_run(args);print(json.dumps(result));sys.exit(1 if result['status']=='operation_failed'else 0)
 except Exception as error:
  value=str(error);print(json.dumps({'schema':'nodia-ai-ai40-client-buttons-adoption-v1','phase':args.phase,'status':'operation_failed','code':value if isinstance(error,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',value)else'private_dependency_or_protocol_failure','no_automatic_retry':True,'private_details_emitted':False}));sys.exit(1)
