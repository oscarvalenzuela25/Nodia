"""R04 Client-only adoption; waits for the exact original Gemini recovery receipt.

Prepared offline. READY_SHA must be frozen from the real reconcile-retire result;
there is no PID/epoch input, old-PID fallback, SDK call or Server mutation.
"""
import argparse,hashlib,importlib.util,json,os,re,stat,sys
from pathlib import Path

BASE=Path('/opt/nodia/verification/ai40-client-buttons-adopt-r01/nodia-ai-ai40-client-buttons-adopt-r01.py')
BASE_SHA='2aad45bfaa6be9ae283ad5e9157b56f58fc7b8161491a4e31178089aedb3de38'
PREVIOUS=Path('/opt/nodia/verification/ai40-client-r03-adopt/nodia-ai-ai40-client-r03-adopt-r01.py')
PREVIOUS_SHA='9001c0b69cc503fbd1c587171dff9eed52fb1515207b6940c3ff128462e0974b'
READY=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/reconcile-retire.json')
READY_SHA='177cc4f54c915289548e2fd5a84b6522c121307d63785ad04f64f354a9075437'
WORK=Path('/opt/nodia/verification/ai40-client-r04-adopt/work')
SERVER=Path('/opt/nodia/releases/nodia-server-ai40-r08')
SERVER_SHA='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
CONFIG_SHA='506e4c436bc22152c9aa632565d470450206d5ffdb1c9b976c0d0c7b5116f8b2'

def require(ok,code):
 if not ok:raise ValueError(code)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def private(path):
 info=path.lstat();require(path.resolve()==path and stat.S_ISREG(info.st_mode)and info.st_uid==0 and info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600,'private_file_changed')

def authority():
 require(isinstance(READY_SHA,str)and re.fullmatch('[a-f0-9]{64}',READY_SHA)is not None,'recovery_receipt_not_frozen')
 private(READY);raw=READY.read_bytes();require(sha(raw)==READY_SHA,'recovery_receipt_changed');value=json.loads(raw)
 require(value.get('schema')=='nodia-ai-ai40-gemini-chat-recovery-operation-v1'and value.get('phase')=='reconcile-retire'and value.get('status')=='reconciled_retired_claims_resumed','recovery_not_complete')
 require(value.get('release')==str(SERVER)and value.get('server_manifest_sha256')==SERVER_SHA,'recovered_server_changed')
 return value

def snapshot(op):
 ready=authority()
 g=op.load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','r04_release_guard')
 g.RELEASE,g.RELEASE_SHA=SERVER,SERVER_SHA
 h=op.load(g.HELPER,g.HELPER_SHA,'r04_public_guard');h.ACTIVE=SERVER;h.validate_candidate(g.LEGACY_MANIFEST_SHA);g.validate_release()
 status=op.load('/opt/nodia/verification/ai40-journal-status-read-r01/nodia-ai-ai40-journal-status-read-r01.py','5e5b710b0210e82228593401f0480e54970666ef4151251e930c16bb85da6c38','r04_status_guard')
 images=op.load('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py','b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355','r04_proof_guard')
 services={n:h.service(n)for n in('nodia-api','nodia-ai-worker','nodia-keyring')}
 for name in('nodia-api','nodia-ai-worker'):
  expected=ready['post_consumers'][name]
  require(expected['active']=='active'and expected['working_directory']==str(SERVER)and expected['argv_exact_match']is True and expected['pid']>0,'recovered_service_invalid')
  require(services[name]=={k:expected[k]for k in('pid','active','working_directory')},'backend_services_changed')
 require(services['nodia-keyring']['pid']==3630841 and services['nodia-keyring']['active']=='active','keyring_changed')
 events=[];public=status.public_preflight(h,services,events)
 require(public['SQL']==ready['SQL_after'],'operational_chat_changed')
 require(all(public['SQL'][k]==0 for k in('pending_jobs','open_attempts','retained_slots'))and public['codex']['pending']==public['codex']['locks_or_sockets']==0,'work_not_quiet')
 env=h.selected_environment(services['nodia-api']['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
 source=(h.CANDIDATE.parent/'public-canary-input.mjs').read_text(encoding='utf-8')
 result=h.command(['/usr/local/bin/node','--input-type=module','-e',source],cwd=SERVER,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','AI40_CONNECTION_ID':'1',**env},timeout=25)
 require(result.returncode==0 and sha(result.stdout)==CONFIG_SHA,'public_configuration_changed')
 proofs=images.proof_snapshot(h,json.loads(result.stdout)['selection'],g.EXPECTED_RUNTIME_FINGERPRINT)
 require(proofs==ready['codex_proofs']and all(v['present']and v['scope']==proofs['mcp']['scope']for v in proofs.values()),'current_proofs_changed')
 query="""
 try{await db.initialize();const output=await db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');const [row]=await m.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_preferences WHERE owner_id=1) preferences,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_preferences p WHERE owner_id=1) preferences_sha256,
 (SELECT count(*)::int FROM finance_movements) finance_count,
 (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sha256,
 (SELECT count(*)::int FROM nodia_ai_attachments WHERE conversation_id=$1) attachments`,['ec626b72-1f32-4486-9f3a-8263cffce267']);return row;});console.log(JSON.stringify(output));}finally{if(db.isInitialized)await db.destroy();}
 """
 result=h.command(['/usr/local/bin/node','--input-type=module','-e',source.split('try {',1)[0]+query],cwd=SERVER,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root',**env},timeout=25)
 require(result.returncode==0 and len(result.stdout)<4096,'domain_read_unavailable');domain=json.loads(result.stdout)
 require(domain=={'preferences':2,'preferences_sha256':'b3cffd91df324d06e640ff3c9e169db2d2fb5a24692ff11dbbc2cc7297443237','finance_count':2,'finance_sha256':'5335e312c7b542552f924cf266fc007ff1a3691e522e6c682bb20e374b5b7871','attachments':6},'accepted_preferences_or_finance_changed')
 protected={n:op.command(['systemctl','show',n,'--property=MainPID,ActiveState,Type,RemainAfterExit','--no-pager']).decode()for n in('nginx','nodia-gemini-lab')}
 require(all('ActiveState=active\n'in v for v in protected.values()),'protected_service_not_active')
 projection='{"container_id":{{json .Id}},"image_id":{{json .Image}},"started_at":{{json .State.StartedAt}},"running":{{json .State.Running}}}'
 actual=json.loads(op.command(['docker','inspect','--format',projection,ready['gemini_after']['container_id']]))
 require({k:v for k,v in actual.items()if k!='running'}==ready['gemini_after']and actual['running']is True,'Gemini_epoch_changed')
 return {'services':services,'protected':protected,'Gemini_epoch':ready['gemini_after'],'SQL':public['SQL'],'physical_Codex':public['codex'],'domain':domain,'public_configuration_sha256':CONFIG_SHA,'proof_sha256':{k:v['sha256']for k,v in proofs.items()},'scope':proofs['mcp']['scope'],'recovery_receipt_sha256':READY_SHA,'status_read_attempts':events}

def run(args):
 authority();private(BASE);require(sha(BASE.read_bytes())==BASE_SHA,'predecessor_changed');private(PREVIOUS);require(sha(PREVIOUS.read_bytes())==PREVIOUS_SHA,'package_validator_changed')
 spec=importlib.util.spec_from_file_location('immutable_r04_base',BASE);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 previous_spec=importlib.util.spec_from_file_location('immutable_r03_package',PREVIOUS);previous=importlib.util.module_from_spec(previous_spec);previous_spec.loader.exec_module(previous)
 base.OLD=Path('/opt/nodia/releases/nodia-client-ai40-r03');base.OLD_MANIFEST='a856091f5b1055da020d989bc73d4a188df6e282db0a357a2c0097ec4cedb92f'
 base.NEW=Path('/opt/nodia/releases/nodia-client-ai40-r04');base.NEW_MANIFEST='c40c15e5e616a7d1d257c1a072141a93e02ba7f1f91ade7187b997e82092a821'
 base.OLD_SITE_SHA='14c71510180a5108ed2525187836b6600fba70a5ac2af175fb68955d7f1570fc'
 base.WORK,base.__file__=WORK,str(Path(__file__).resolve());base.snapshot=snapshot
 def package(op,path,pin):
  value=previous.set_package(op,path,pin);require(len(value['files'])==172,'client_file_count_changed');return value
 base.set_package=package
 result=base.guarded_run(args)
 return {**result,'schema':'nodia-ai-ai40-client-r04-adoption-v1','predecessor_operator_sha256':BASE_SHA,'package_validator_sha256':PREVIOUS_SHA,'server_manifest_sha256':SERVER_SHA,'recovery_receipt_sha256':READY_SHA}

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--operator-sha256',required=True);parser.add_argument('--phase',choices=('preflight','adopt','rollback'),required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
 try:
  result=run(args);print(json.dumps(result));sys.exit(0 if result.get('status')in('preflight_passed','adopted_verified','rolled_back_verified')else 1)
 except Exception as error:
  code=str(error);print(json.dumps({'status':'operation_failed','phase':args.phase,'failure_code':code if isinstance(error,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else None,'private_details_emitted':False,'no_replay':True}));sys.exit(1)
