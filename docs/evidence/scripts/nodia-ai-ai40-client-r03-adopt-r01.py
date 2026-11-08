"""R03 Client successor: frozen R08 backend, fresh reversible nginx-root intent."""
import argparse,hashlib,importlib.util,json,os,re,stat,sys
from pathlib import Path,PurePosixPath
BASE=Path('/opt/nodia/verification/ai40-client-buttons-adopt-r01/nodia-ai-ai40-client-buttons-adopt-r01.py')
BASE_SHA='2aad45bfaa6be9ae283ad5e9157b56f58fc7b8161491a4e31178089aedb3de38'
SERVER_DRIVER_SHA='c00bd83406208dfa8c78bf364c4d1214f74a1e98121f813003abd71182863710'
WORK=Path('/opt/nodia/verification/ai40-client-r03-adopt/work')
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(b):return hashlib.sha256(b).hexdigest()
def private(path,mode=0o600):
 st=path.lstat();require(path.resolve()==path and stat.S_ISREG(st.st_mode)and st.st_uid==0 and st.st_nlink==1 and stat.S_IMODE(st.st_mode)==mode,'private_file_changed')
def snapshot(op):
 g=op.load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','buttons_release_guard')
 g.RELEASE=Path('/opt/nodia/releases/nodia-server-ai40-r08');g.RELEASE_SHA='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
 h=op.load(g.HELPER,g.HELPER_SHA,'buttons_public_guard');h.ACTIVE=g.RELEASE;h.validate_candidate(g.LEGACY_MANIFEST_SHA);g.validate_release()
 status=op.load('/opt/nodia/verification/ai40-journal-status-read-r01/nodia-ai-ai40-journal-status-read-r01.py','5e5b710b0210e82228593401f0480e54970666ef4151251e930c16bb85da6c38','buttons_status_guard')
 images=op.load('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py','b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355','buttons_proof_guard')
 receipt_path=Path('/opt/nodia/verification/ai40-selective-adopt-r08/adopt-after.json');private(receipt_path)
 receipt=json.loads(receipt_path.read_bytes());require(receipt.get('status')=='adopt_completed'and receipt.get('new_manifest_sha256')==g.RELEASE_SHA and receipt.get('operator_wrapper_sha256')==SERVER_DRIVER_SHA and receipt.get('timers_restored')is True,'server_adoption_receipt_changed')
 services={n:h.service(n)for n in('nodia-api','nodia-ai-worker','nodia-keyring')}
 require([services[n]['pid']for n in('nodia-api','nodia-ai-worker')]==[receipt['post_consumers'][n]['pid']for n in('nodia-api','nodia-ai-worker')]and services['nodia-keyring']['pid']==3630841,'backend_services_changed')
 events=[];public=status.public_preflight(h,services,events)
 require(all(public['SQL'].get(k)==v for k,v in {'messages':46,'runs':24,'dispatches':35,'executions':2,'effect_receipts':3,'financial_effects':1,'pending_jobs':0,'open_attempts':0,'retained_slots':0}.items()),'operational_chat_changed')
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
 op.CLIENT,op.MANIFEST=path,pin
 require(path.resolve()==path and path.stat().st_uid==0 and sha((path/'manifest.json').read_bytes())==pin,'client_manifest_changed')
 m=json.loads((path/'manifest.json').read_bytes());require(m['schema']=='nodia-ai-ai40-client-nginx-package-v1'and 0<len(m['files'])<10000 and m['build']['api_url']=='/api/v1'and m['build']['base']=='/'and m['build']['expected_browser_origin']=='http://localhost:5174','client_contract_changed')
 actual=set()
 for p in path.rglob('*'):
  st=p.lstat();require(not p.is_symlink()and st.st_uid==0 and st.st_mode&0o022==0,'client_file_identity_changed')
  if p.is_file():actual.add(p.relative_to(path).as_posix())
 require(actual=={'manifest.json'}|{'dist/'+n for n in m['files']},'client_inventory_changed')
 for name,v in m['files'].items():
  p=PurePosixPath(name);require(not p.is_absolute()and '..'not in p.parts and str(p)==name and '\\'not in name,'client_path_invalid')
  b=(path/'dist'/name).read_bytes();require(len(b)==v['bytes']and sha(b)==v['sha256'],'client_file_changed')
 return m

def run(a):
 private(BASE);require(sha(BASE.read_bytes())==BASE_SHA,'predecessor_changed')
 spec=importlib.util.spec_from_file_location('immutable_client_update',BASE);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 base.OLD=Path('/opt/nodia/releases/nodia-client-ai40-buttons-r01');base.OLD_MANIFEST='65c1e83a9ab9219fcd02af6c766e6dd8b5f6c14bc6a12f25abf8e79bdefde8dd'
 base.NEW=Path('/opt/nodia/releases/nodia-client-ai40-r03');base.NEW_MANIFEST='a856091f5b1055da020d989bc73d4a188df6e282db0a357a2c0097ec4cedb92f'
 base.OLD_SITE_SHA='3bb3822773cb679a1c7201d77e04f59ab7dcaee939b69217f7453c08393bd82f'
 base.WORK,base.__file__=WORK,str(Path(__file__).resolve())
 base.snapshot,base.set_package=snapshot,set_package
 value=base.guarded_run(a)
 return {**value,'schema':'nodia-ai-ai40-client-r03-adoption-v1','predecessor_operator_sha256':BASE_SHA,'server_manifest_sha256':'08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--operator-sha256',required=True);p.add_argument('--phase',choices=['preflight','adopt','rollback'],required=True);p.add_argument('--execute',action='store_true');a=p.parse_args()
 try:
  r=run(a);print(json.dumps(r));sys.exit(0 if r.get('status')in('preflight_passed','adopted_verified','rolled_back_verified')else 1)
 except Exception as e:
  code=str(e);print(json.dumps({'status':'operation_failed','phase':a.phase,'failure_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else None,'private_details_emitted':False,'no_replay':True}));sys.exit(1)
