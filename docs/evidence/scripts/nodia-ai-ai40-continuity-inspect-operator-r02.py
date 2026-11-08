"""Exact-run R08 continuity inspection after the verified legacy recovery.

Authority is the fixed root-private final continuation receipt, not user PIDs,
old readoption PIDs or a claimed deployment success. No SDK/profile calls."""
import argparse,hashlib,importlib.util,json,os,pwd,re,subprocess,sys
from pathlib import Path
STAGE=Path('/opt/nodia/verification/ai40-continuity-inspect-r02')
INSPECTOR=STAGE/'nodia-ai-ai40-continuity-inspect-r02.mjs'
INSPECTOR_SHA='2112dd930a472534a1d221f66df2c70f245923ecbb6444681c2448512d88b1f5'
BASE=Path('/opt/nodia/verification/ai40-reservations-access-inspection-r01/nodia-ai-ai40-reservations-access-inspect-operator-r01.py')
BASE_SHA='12d83bece500081793746179a5076a1f3e07f88d93f830f929b92c7b1ddf3597'
RELEASE='/opt/nodia/releases/nodia-server-ai40-r08'
MANIFEST='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
AUTHORITY=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/reconcile-retire.json')
AUTHORITY_SHA='177cc4f54c915289548e2fd5a84b6522c121307d63785ad04f64f354a9075437'
AUTHORITY_OPERATOR=AUTHORITY.with_name('nodia-ai-ai40-gemini-chat-recovery-continue-r01.py')
AUTHORITY_OPERATOR_SHA='2091ac4d85978a7258f4063fc97a94f440e4157e2d44885565f2ebb8a6957c97'

def validate_adoption_authority(value,before,manifest):
 require(type(value)is dict and value.get('schema')=='nodia-ai-ai40-gemini-chat-recovery-operation-v1'
  and value.get('phase')=='reconcile-retire'and value.get('status')=='reconciled_retired_claims_resumed'
  and value.get('operator_sha256')==AUTHORITY_OPERATOR_SHA and value.get('release')==RELEASE
  and value.get('server_manifest_sha256')==MANIFEST,'recovery_authority_identity_changed')
 require(value.get('failed_adopt_receipt_sha256')=='04c29353e56b371340304d3ed6dd7937268664d89c6e74ae0ae6f1a6ea48e60d'
  and value.get('current_controls_validator_sha256')=='bb90d77070fe67210c851bab4e07d4acc157a9e14fd8ac57fbead0876f01ea05'
  and value.get('current_controls_baseline_sha256')=='29c57d2d5fef28e7d3fb2c8edc782fb9d56029fc93200c782f9e8e5a65575e33'
  and value.get('old_HostConfig_parity_proven')is False and value.get('current_containment_verified')is True
  and value.get('host_retention_refreshed')is True and value.get('timers_restored')is True,'recovery_authority_lineage_changed')
 for unit,entry in [('nodia-api','main.js'),('nodia-ai-worker','nodia-ai-worker.js')]:
  recorded=value.get('post_consumers',{}).get(unit)
  require(type(recorded)is dict and recorded.get('active')=='active'and recorded.get('sub')=='running'
   and type(recorded.get('pid'))is int and recorded['pid']>0 and recorded.get('working_directory')==RELEASE
   and recorded.get('argv_exact_match')is True and recorded.get('recovery_config_path_verified')is True
   and recorded.get('original_dotenv_path_verified')is True and recorded.get('other_environment_fields_emitted')is False
   and recorded.get('entrypoint_sha256')==manifest['files']['dist/'+entry],'recovery_consumer_witness_changed')
  require(before[unit]=={'pid':recorded['pid'],'release':RELEASE,'state':'active'},'runtime_consumers_changed')
 return {'receipt_sha256':AUTHORITY_SHA,'operator_sha256':AUTHORITY_OPERATOR_SHA,
  'status':value['status'],'old_HostConfig_parity_proven':False,'current_containment_verified':True}

def current_adoption_authority(before,transport):
 for path in(AUTHORITY,AUTHORITY_OPERATOR):
  require(path.resolve()==path,'recovery_authority_path_changed');transport.private_file(path)
 require(AUTHORITY.stat().st_size<=131072 and sha(AUTHORITY)==AUTHORITY_SHA
  and sha(AUTHORITY_OPERATOR)==AUTHORITY_OPERATOR_SHA,'recovery_authority_bytes_changed')
 require(sha(Path(RELEASE)/'release-manifest.json')==MANIFEST,'release_manifest_changed')
 manifest=json.loads((Path(RELEASE)/'release-manifest.json').read_bytes())
 value=json.loads(AUTHORITY.read_bytes());result=validate_adoption_authority(value,before,manifest)
 for unit,entry in [('nodia-api','main.js'),('nodia-ai-worker','nodia-ai-worker.js')]:
  path=Path(RELEASE)/'dist'/entry;proc=Path('/proc')/str(before[unit]['pid'])
  require(sha(path)==manifest['files']['dist/'+entry]
   and(proc/'cmdline').read_bytes().rstrip(b'\0').split(b'\0')==[b'/usr/local/bin/node',str(path).encode()]
   and os.readlink(proc/'cwd')==RELEASE,'current_consumer_executable_changed')
 return result

def require(ok,code):
 if not ok:raise ValueError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p,pin,name):
 require(p.is_file()and not p.is_symlink()and sha(p)==pin,'pinned_readonly_dependency_changed')
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def run(a):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 config=load(BASE,BASE_SHA,'immutable_private_DB_resolver');transport=load(config.BASE,config.BASE_SHA,'immutable_readonly_transport')
 for p in(BASE,Path(__file__).resolve(),INSPECTOR):transport.private_file(p)
 require(sha(Path(__file__).resolve())==a.operator_sha256 and sha(INSPECTOR)==INSPECTOR_SHA,'inspection_source_changed')
 raw=sys.stdin.buffer.read(8193);require(0<len(raw)<=8192,'descriptor_size_invalid');v=json.loads(raw)
 require(type(v)is dict and set(v)=={'schema_version','conversation_id','expected_owner_id','authority_run_id','expected_runs','run_bindings'},'closed_descriptor_invalid')
 require(v['schema_version']==2,'continuity_schema_version_invalid')
 config.validate_descriptor({'schema_version':1,**{k:v[k]for k in('conversation_id','expected_owner_id','authority_run_id')}})
 require(v['expected_runs']in('gemini','both')and type(v['run_bindings'])is dict and set(v['run_bindings'])=={'gemini','codex'},'continuity_request_invalid')
 transport.PACKAGES={RELEASE:MANIFEST};before=transport.consumers();provenance=transport.package(before['nodia-api']['release'])
 authority=current_adoption_authority(before,transport)
 selected=transport.selected_environment(before['nodia-api']['pid'],False);configuration=Path(selected['DOTENV_CONFIG_PATH']);configuration_pin=sha(configuration)
 require(configuration_pin=='63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105','configuration_changed')
 p=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',config.DB_RESOLVER],cwd=RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','DOTENV_CONFIG_QUIET':'true',**selected},capture_output=True,timeout=15)
 require(p.returncode==0 and len(p.stdout)<=32768,'private_database_unavailable');payload=json.dumps({**v,'database':json.loads(p.stdout)}).encode();require(len(payload)<=16384,'private_descriptor_exceeded')
 user=pwd.getpwnam('nodia');require(user.pw_uid==10000,'inspector_uid_changed')
 p=subprocess.run(['/usr/sbin/runuser','--preserve-environment','-u','nodia','--','/usr/local/bin/node','--input-type=module','-e',INSPECTOR.read_text()],input=payload,cwd=RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':user.pw_dir,'NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null','RATE_LIMIT_STORAGE':'memory'},capture_output=True,timeout=60)
 require(len(p.stdout)<=131072,'private_receipt_exceeded');result=json.loads(p.stdout)
 require(result.get('schema')=='nodia-ai-ai40-provider-continuity-readonly-v2'and result.get('status')in('validated_read_only','validation_failed','inspection_failed'),'readonly_receipt_invalid')
 require(all(result.get(k)==0 for k in('SQL_writes','SDK_requests','provider_observations','provider_generations'))and result.get('profile_accessed_by_script')is False and result.get('credentials_or_raw_messages_emitted')is False,'readonly_limits_changed')
 after=transport.consumers();require(after==before and sha(configuration)==configuration_pin,'consumers_or_configuration_changed')
 require(current_adoption_authority(after,transport)==authority,'recovery_authority_changed_during_inspection')
 return {'schema':'nodia-ai-ai40-continuity-inspect-operator-v2','status':result['status'],'operator_sha256':a.operator_sha256,'inspector_sha256':INSPECTOR_SHA,'adoption_authority':authority,'release_manifest_sha256':MANIFEST,'provenance':provenance,'consumers':after,'inspection':result,'child_exit':p.returncode,'private_stderr_bytes':len(p.stderr),'private_stderr_emitted':False,'SQL_writes':0,'SDK_requests':0,'profile_accessed':False,'private_database_options_persisted_or_emitted':False},p.returncode
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--operator-sha256',required=True);a=p.parse_args()
 try:
  v,code=run(a);print(json.dumps(v));sys.exit(code)
 except Exception as e:
  code=str(e);print(json.dumps({'status':'operator_failed','failure_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else'private_dependency_or_protocol_error','SDK_requests':0,'SQL_writes':0,'profile_accessed':False,'private_details_emitted':False}));sys.exit(1)
