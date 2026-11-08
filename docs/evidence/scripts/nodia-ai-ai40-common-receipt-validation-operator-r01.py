"""Own-chat common-helper receipt validation, private DB options through stdin.
No SDK, native profile, AppModule, handlers, service actions or SQL mutations.
"""
import argparse,base64,hashlib,importlib.util,json,os,re,stat,subprocess,sys
from pathlib import Path
ROOT='/opt/nodia/releases/nodia-server-ai40-r07'
RELEASE_SHA='1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
STAGE=Path('/opt/nodia/verification/ai40-common-receipt-validation-r01')
INSPECTOR=STAGE/'nodia-ai-ai40-common-receipt-validation-r01.mjs'
INSPECTOR_SHA='091d1366ffbe9a25d196dd0de23109354f1b5ffb1203ff7ae2a5faf19670a8f8'
SCHEMA=STAGE/'published-common-preparation.schema.json'
SCHEMA_SHA='f6fb6198795002f4378e890f2ff861fe32786e2e3021daa2c12c490449382d22'
BASE=Path('/opt/nodia/verification/ai40-r06-image-ui-inspection-r01/nodia-ai-ai40-r06-image-ui-inspect-operator-r01.py')
BASE_SHA='48324dbd99493d5e6ed202df21e7d686fe9fe9d0e5399d880e70e04e3840af20'
ACCESS=Path('/opt/nodia/verification/ai40-reservations-access-inspection-r01/nodia-ai-ai40-reservations-access-inspect-operator-r01.py')
ACCESS_SHA='12d83bece500081793746179a5076a1f3e07f88d93f830f929b92c7b1ddf3597'
def require(value,code):
 if not value:raise ValueError(code)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def private(path):
 info=path.lstat();require(path.resolve()==path and stat.S_ISREG(info.st_mode)and info.st_uid==0 and info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600,'private_source_changed')
def load(path,pin,name):
 private(path);require(sha(path)==pin,'dependency_changed');spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def run(a):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 import pwd
 for p in(Path(__file__).resolve(),INSPECTOR,SCHEMA):private(p)
 require(sha(Path(__file__).resolve())==a.operator_sha256 and sha(INSPECTOR)==INSPECTOR_SHA and sha(SCHEMA)==SCHEMA_SHA,'source_or_schema_changed')
 transport=load(BASE,BASE_SHA,'common_private_transport');transport.PACKAGES={ROOT:RELEASE_SHA};transport.INSPECTOR_SHA=INSPECTOR_SHA
 access=load(ACCESS,ACCESS_SHA,'common_database_resolver')
 guard=load(Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py'),'753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','common_R07_package_guard')
 release_before=guard.validate_release();before=transport.consumers();provenance=transport.package(ROOT)
 selected=transport.selected_environment(before['nodia-api']['pid'],False);configuration=Path(selected['DOTENV_CONFIG_PATH']);config_sha=sha(configuration)
 resolver=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',access.DB_RESOLVER],cwd=ROOT,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','DOTENV_CONFIG_QUIET':'true',**selected},capture_output=True,timeout=15,check=False)
 require(resolver.returncode==0 and 0<len(resolver.stdout)<=32768,'private_database_unavailable');database=json.loads(resolver.stdout)
 require(type(database)is dict and set(database)=={'host','port','database','username','password','ssl'}and database['host']=='127.0.0.1'and type(database['port'])is int and 0<database['port']<=65535 and type(database['ssl'])is bool,'private_database_contract_invalid')
 for name in('database','username','password'):require(type(database[name])is str and 0<len(database[name].encode())<=4096 and not re.search('[\0\r\n]',database[name]),'private_database_value_invalid')
 payload=json.dumps({'schema_version':1,'database':database,'published_preparation_schema_base64':base64.b64encode(SCHEMA.read_bytes()).decode()}).encode();require(len(payload)<=131072,'private_payload_exceeded')
 user=pwd.getpwnam('nodia');require(user.pw_uid==10000,'inspector_identity_changed')
 child=subprocess.run(['/usr/sbin/runuser','--preserve-environment','-u','nodia','--','/usr/local/bin/node','--input-type=module','-e',INSPECTOR.read_text()],input=payload,cwd=ROOT,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':user.pw_dir,'NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null','RATE_LIMIT_STORAGE':'memory'},capture_output=True,timeout=75,check=False)
 require(0<len(child.stdout)<=65536,'inspection_output_exceeded');result=json.loads(child.stdout)
 require(result.get('schema')=='nodia-ai-ai40-common-receipt-validation-v1'and result.get('status')in('validated_read_only','validation_failed')and result.get('SQL_writes')==0 and result.get('provider_requests')==0 and result.get('raw_payloads_emitted')is False,'inspection_receipt_invalid')
 after=transport.consumers();require(before==after and selected==transport.selected_environment(after['nodia-api']['pid'],False)and sha(configuration)==config_sha and transport.package(ROOT)==provenance and guard.validate_release()==release_before,'consumers_configuration_or_release_changed')
 return {'schema':'nodia-ai-ai40-common-receipt-validation-operator-v1','status':result['status'],'operator_sha256':a.operator_sha256,'inspector_sha256':INSPECTOR_SHA,'effective_published_preparation_schema_sha256':SCHEMA_SHA,'provenance':provenance,'consumers':after,'inspection':result,'child_exit_code':child.returncode,'private_stderr_bytes':len(child.stderr),'private_stderr_emitted':False,'private_database_options_persisted_or_emitted':False,'SDK_observations':0,'provider_requests':0,'SQL_writes':0,'services_changed':False},child.returncode
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--operator-sha256',required=True);a=parser.parse_args()
 try:report,code=run(a);print(json.dumps(report));sys.exit(code)
 except Exception as error:
  value=str(error);print(json.dumps({'schema':'nodia-ai-ai40-common-receipt-validation-operator-v1','status':'operator_failed','error_code':value if isinstance(error,ValueError)and re.fullmatch('[a-z_]{1,100}',value)else'private_dependency_or_protocol_failure','SQL_writes':0,'SDK_observations':0,'provider_requests':0,'private_details_emitted':False}));sys.exit(1)
