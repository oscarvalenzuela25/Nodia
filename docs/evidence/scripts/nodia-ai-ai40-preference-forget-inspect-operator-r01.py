"""Own preference-forgetting evidence. Readonly SQL/private DB pipe, no SDK.

The Node inspector never confirms a proposal or reads the external journal.
Journal acknowledgement is a separate read-only operator receipt.
"""
import argparse,base64,hashlib,importlib.util,json,os,pwd,re,stat,subprocess,sys
from pathlib import Path
STAGE=Path('/opt/nodia/verification/ai40-preference-forget-inspect-r01')
INSPECTOR=STAGE/'nodia-ai-ai40-preference-forget-inspect-r01.mjs'
INSPECTOR_SHA='a17cc99b7ae657e2175fc5745b94dd556f080502089c03f2654a68bb5fc3d81f'
SCHEMA_FILE=STAGE/'public-common-preparation.schema.json'
SCHEMA_SHA='f6fb6198795002f4378e890f2ff861fe32786e2e3021daa2c12c490449382d22'
CONTINUITY=Path('/opt/nodia/verification/ai40-continuity-inspect-r02/nodia-ai-ai40-continuity-inspect-operator-r02.py')
CONTINUITY_SHA='774c3ec0b4a631a49a6a01bff01cde295ffc6626324b82453fc0ea03fe5fb9ee'
RELEASE='/opt/nodia/releases/nodia-server-ai40-r08'
MANIFEST='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
CONFIG_SHA='63bc843ea102795ffee40cf5d3a7bbe42bb71ea40795b30897c10872ca129105'

def require(ok,code):
 if not ok:raise ValueError(code)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def private_file(path):
 info=path.lstat();require(path.resolve()==path and stat.S_ISREG(info.st_mode)and info.st_uid==0 and info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600,'private_file_identity_changed')

def load(path,pin,name):
 private_file(path);require(sha(path)==pin,'readonly_dependency_changed')
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def uuid(value):return type(value)is str and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',value)is not None

def hash_valid(value):return type(value)is str and re.fullmatch('[a-f0-9]{64}',value)is not None

def validate_request(value):
 require(type(value)is dict and set(value)=={'schema_version','phase','conversation_id','expected_owner_id','authority_run_id','preparation_run_id','proposal','execution_id','readback_run_id','baseline'},'closed_descriptor_invalid')
 require(type(value['schema_version'])is int and value['schema_version']==1 and value['conversation_id']=='ec626b72-1f32-4486-9f3a-8263cffce267'and value['expected_owner_id']=='1'and value['authority_run_id']=='8e4c0db1-6b07-4524-a1cf-f33d09210766','owned_descriptor_invalid')
 require(value['phase']in('prepared','committed','readback')and uuid(value['preparation_run_id']),'inspection_phase_invalid')
 p=value['proposal'];require(type(p)is dict and set(p)=={'id','revision','hash'}and uuid(p['id'])and type(p['revision'])is int and 0<p['revision']<=2147483647 and hash_valid(p['hash']),'proposal_identity_invalid')
 if value['phase']=='prepared':require(value['execution_id']is None and value['readback_run_id']is None and value['baseline']is None,'prepared_effect_identity_not_allowed')
 else:
  b=value['baseline'];require(uuid(value['execution_id'])and type(b)is dict and set(b)=={'survivor_sql_sha256','finance_sql_sha256'}and all(hash_valid(v)for v in b.values()),'effect_baseline_invalid')
  require(uuid(value['readback_run_id'])if value['phase']=='readback'else value['readback_run_id']is None,'readback_identity_invalid')
 return value

def run(args):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 for path in(Path(__file__).resolve(),INSPECTOR,SCHEMA_FILE):private_file(path)
 require(sha(Path(__file__).resolve())==args.operator_sha256 and sha(INSPECTOR)==INSPECTOR_SHA and SCHEMA_FILE.stat().st_size<=131072 and sha(SCHEMA_FILE)==SCHEMA_SHA,'source_or_schema_changed')
 raw=sys.stdin.buffer.read(16385);require(0<len(raw)<=16384,'descriptor_size_invalid');value=validate_request(json.loads(raw))
 continuity=load(CONTINUITY,CONTINUITY_SHA,'immutable_recovery_authority_reader')
 config=load(continuity.BASE,continuity.BASE_SHA,'immutable_private_DB_resolver');transport=load(config.BASE,config.BASE_SHA,'immutable_readonly_transport')
 config.validate_descriptor({k:value[k]for k in('schema_version','conversation_id','expected_owner_id','authority_run_id')})
 transport.PACKAGES={RELEASE:MANIFEST};before=transport.consumers();provenance=transport.package(before['nodia-api']['release']);authority=continuity.current_adoption_authority(before,transport)
 selected=transport.selected_environment(before['nodia-api']['pid'],False);configuration=Path(selected['DOTENV_CONFIG_PATH']);require(sha(configuration)==CONFIG_SHA,'configuration_changed')
 resolved=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',config.DB_RESOLVER],cwd=RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','DOTENV_CONFIG_QUIET':'true',**selected},capture_output=True,timeout=15)
 require(resolved.returncode==0 and len(resolved.stdout)<=32768,'private_database_unavailable')
 payload=json.dumps({**value,'database':json.loads(resolved.stdout),'published_preparation_schema_base64':base64.b64encode(SCHEMA_FILE.read_bytes()).decode()}).encode();require(len(payload)<=131072,'private_descriptor_exceeded')
 user=pwd.getpwnam('nodia');require(user.pw_uid==10000,'inspector_uid_changed')
 child=subprocess.run(['/usr/sbin/runuser','--preserve-environment','-u','nodia','--','/usr/local/bin/node','--input-type=module','-e',INSPECTOR.read_text()],input=payload,cwd=RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':user.pw_dir,'NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null','RATE_LIMIT_STORAGE':'memory'},capture_output=True,timeout=60)
 require(len(child.stdout)<=131072,'private_receipt_exceeded');result=json.loads(child.stdout)
 require(result.get('schema')=='nodia-ai-ai40-preference-forget-inspection-v1'and result.get('status')in('validated_read_only','validation_failed','inspection_failed'),'readonly_receipt_invalid')
 require(all(result.get(k)==0 for k in('SQL_writes','SDK_requests','confirmation_requests','journal_reads','journal_writes'))and result.get('credentials_or_raw_messages_emitted')is False,'readonly_limits_changed')
 after=transport.consumers();require(after==before and sha(configuration)==CONFIG_SHA and continuity.current_adoption_authority(after,transport)==authority,'consumers_configuration_or_authority_changed')
 require(sha(INSPECTOR)==INSPECTOR_SHA and sha(SCHEMA_FILE)==SCHEMA_SHA,'inspection_source_changed')
 return {'schema':'nodia-ai-ai40-preference-forget-inspect-operator-v1','status':result['status'],'operator_sha256':args.operator_sha256,'inspector_sha256':INSPECTOR_SHA,'public_preparation_schema_sha256':SCHEMA_SHA,'adoption_authority':authority,'release_manifest_sha256':MANIFEST,'provenance':provenance,'consumers':after,'inspection':result,'child_exit':child.returncode,'private_stderr_bytes':len(child.stderr),'private_stderr_emitted':False,'SQL_writes':0,'SDK_requests':0,'confirmation_requests':0,'journal_reads':0,'journal_writes':0,'private_database_options_persisted_or_emitted':False},child.returncode

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--operator-sha256',required=True);args=parser.parse_args()
 try:
  result,code=run(args);print(json.dumps(result));sys.exit(code)
 except Exception as error:
  code=str(error);print(json.dumps({'status':'operator_failed','failure_code':code if isinstance(error,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else'private_dependency_or_protocol_error','SQL_writes':0,'SDK_requests':0,'confirmation_requests':0,'journal_reads':0,'journal_writes':0,'private_details_emitted':False}));sys.exit(1)
