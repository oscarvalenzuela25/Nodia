"""Readonly R08 continuity receipts; private DB pipe, no SDK or profile calls."""
import argparse,hashlib,importlib.util,json,os,pwd,re,subprocess,sys
from pathlib import Path
STAGE=Path('/opt/nodia/verification/ai40-continuity-inspect-r01')
INSPECTOR=STAGE/'nodia-ai-ai40-continuity-inspect-r01.mjs'
INSPECTOR_SHA='6a3db018987d390a1b9561adba5a21d8d3d5cf25aa108efd8ee725ef2af44446'
BASE=Path('/opt/nodia/verification/ai40-reservations-access-inspection-r01/nodia-ai-ai40-reservations-access-inspect-operator-r01.py')
BASE_SHA='12d83bece500081793746179a5076a1f3e07f88d93f830f929b92c7b1ddf3597'
RELEASE='/opt/nodia/releases/nodia-server-ai40-r08'
MANIFEST='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
READOPT=Path('/opt/nodia/verification/ai40-selective-readopt-r08-r01/adopt-after.json')
READOPT_OPERATOR='026648cbc7aeda86f168305f92396e714c2be228ac39e65ffbe0569e6691f315'
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p,pin,name):
 require(p.is_file()and not p.is_symlink()and sha(p)==pin,'pinned_readonly_dependency_changed')
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def run(a):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 config=load(BASE,BASE_SHA,'immutable_private_DB_resolver');transport=load(config.BASE,config.BASE_SHA,'immutable_readonly_transport')
 for p in(BASE,Path(__file__).resolve(),INSPECTOR,READOPT):transport.private_file(p)
 require(sha(Path(__file__).resolve())==a.operator_sha256 and sha(INSPECTOR)==INSPECTOR_SHA,'inspection_source_changed')
 raw=sys.stdin.buffer.read(8193);require(0<len(raw)<=8192,'descriptor_size_invalid');v=json.loads(raw)
 require(type(v)is dict and set(v)=={'schema_version','conversation_id','expected_owner_id','authority_run_id','expected_runs','selections'},'closed_descriptor_invalid')
 config.validate_descriptor({k:v[k]for k in('schema_version','conversation_id','expected_owner_id','authority_run_id')})
 require(v['expected_runs']in('gemini','both')and type(v['selections'])is dict and set(v['selections'])=={'gemini','codex'},'continuity_request_invalid')
 transport.PACKAGES={RELEASE:MANIFEST};before=transport.consumers();provenance=transport.package(before['nodia-api']['release'])
 readopt=json.loads(READOPT.read_bytes());require(readopt.get('status')=='adopt_completed'and readopt.get('operator_wrapper_sha256')==READOPT_OPERATOR and readopt.get('new_manifest_sha256')==MANIFEST,'readoption_receipt_changed')
 require(all(before[k]['pid']==readopt['post_consumers'][k]['pid']for k in('nodia-api','nodia-ai-worker')),'runtime_consumers_changed')
 selected=transport.selected_environment(before['nodia-api']['pid'],False);configuration=Path(selected['DOTENV_CONFIG_PATH']);configuration_pin=sha(configuration)
 require(configuration_pin=='63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105','configuration_changed')
 p=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',config.DB_RESOLVER],cwd=RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','DOTENV_CONFIG_QUIET':'true',**selected},capture_output=True,timeout=15)
 require(p.returncode==0 and len(p.stdout)<=32768,'private_database_unavailable');payload=json.dumps({**v,'database':json.loads(p.stdout)}).encode();require(len(payload)<=16384,'private_descriptor_exceeded')
 user=pwd.getpwnam('nodia');require(user.pw_uid==10000,'inspector_uid_changed')
 p=subprocess.run(['/usr/sbin/runuser','--preserve-environment','-u','nodia','--','/usr/local/bin/node','--input-type=module','-e',INSPECTOR.read_text()],input=payload,cwd=RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':user.pw_dir,'NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null','RATE_LIMIT_STORAGE':'memory'},capture_output=True,timeout=60)
 require(len(p.stdout)<=131072,'private_receipt_exceeded');result=json.loads(p.stdout)
 require(result.get('schema')=='nodia-ai-ai40-provider-continuity-readonly-v1'and result.get('status')in('validated_read_only','validation_failed','inspection_failed'),'readonly_receipt_invalid')
 require(all(result.get(k)==0 for k in('SQL_writes','SDK_requests','provider_observations','provider_generations'))and result.get('profile_accessed_by_script')is False and result.get('credentials_or_raw_messages_emitted')is False,'readonly_limits_changed')
 after=transport.consumers();require(after==before and sha(configuration)==configuration_pin,'consumers_or_configuration_changed')
 return {'schema':'nodia-ai-ai40-continuity-inspect-operator-v1','status':result['status'],'operator_sha256':a.operator_sha256,'inspector_sha256':INSPECTOR_SHA,'readoption_receipt_sha256':sha(READOPT),'release_manifest_sha256':MANIFEST,'provenance':provenance,'consumers':after,'inspection':result,'child_exit':p.returncode,'private_stderr_bytes':len(p.stderr),'private_stderr_emitted':False,'SQL_writes':0,'SDK_requests':0,'profile_accessed':False,'private_database_options_persisted_or_emitted':False},p.returncode
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--operator-sha256',required=True);a=p.parse_args()
 try:
  v,code=run(a);print(json.dumps(v));sys.exit(code)
 except Exception as e:
  code=str(e);print(json.dumps({'status':'operator_failed','failure_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else'private_dependency_or_protocol_error','SDK_requests':0,'SQL_writes':0,'profile_accessed':False,'private_details_emitted':False}));sys.exit(1)
