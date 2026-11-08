"""One exact R05 administrative reconciliation; no inference and no SQL bypass."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path('/opt/nodia/releases/nodia-server-ai40-r05')
STAGE = Path('/opt/nodia/verification/ai40-exact-runtime-reconcile-r01')
CHILD = STAGE / 'nodia-ai-ai40-exact-runtime-reconcile-r01.mjs'
MANIFEST = '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'

def require(value, code):
    if not value:
        raise ValueError(code)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def service(name):
    p = subprocess.run(['systemctl','show',name,'--property=MainPID,WorkingDirectory,ActiveState,User'],capture_output=True,timeout=15,check=True)
    d = dict(x.split('=',1) for x in p.stdout.decode().splitlines() if '=' in x)
    require(d.get('ActiveState')=='active' and d.get('User')=='nodia' and d.get('WorkingDirectory')==str(ROOT),'consumer_changed')
    require(Path('/proc',d['MainPID'],'cwd').resolve()==ROOT,'consumer_cwd_changed')
    return {'pid':int(d['MainPID']),'release':str(ROOT),'state':'active'}

def main(a):
    require(os.getuid()==0 and sys.platform=='linux','linux_root_required')
    require(digest(Path(__file__))==a.operator_sha256,'operator_changed')
    require(digest(CHILD)==a.child_sha256,'child_changed')
    require(digest(ROOT/'release-manifest.json')==MANIFEST,'release_changed')
    m=json.loads((ROOT/'release-manifest.json').read_bytes())
    for name,pin in m['files'].items():
        if name.startswith('dist/') or name=='package-lock.json':
            target=ROOT/name
            require(target.is_file() and target.resolve().is_relative_to(ROOT) and digest(target)==pin,'compiled_package_changed')
    before={x:service(x) for x in ('nodia-api','nodia-ai-worker')}
    allowed={'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL','NODIA_CODEX_PROFILE_ROOT'}
    selected={}
    for entry in Path('/proc',str(before['nodia-api']['pid']),'environ').read_bytes().split(b'\0'):
        k,sep,v=entry.partition(b'=')
        if sep and k.decode(errors='ignore') in allowed:
            selected[k.decode()]=v.decode()
    config=Path(selected['DOTENV_CONFIG_PATH'])
    require(config.is_absolute() and config.resolve().is_relative_to('/opt/nodia') or config.is_absolute() and config.resolve().is_relative_to('/etc/nodia'),'config_path_changed')
    require(config.stat().st_mode&0o077==0,'config_not_private')
    config_before=digest(config)
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/var/lib/nodia','DOTENV_CONFIG_QUIET':'true',**selected}
    command=['/usr/local/bin/node',str(CHILD),a.mode]
    if a.mode=='execute_once':
        require(a.descriptor_sha256 and len(a.descriptor_sha256)==64,'descriptor_pin_required')
        # Persist single administrative intent before calling the use case.
        intent=STAGE/'execute-once.intent.json'
        with intent.open('xb') as f:
            os.chmod(intent,0o600)
            f.write(json.dumps({'job_id':'e0b2c06f-db4f-4ac7-9583-96bbabd909ad','descriptor_sha256':a.descriptor_sha256,'child_sha256':a.child_sha256}).encode());f.flush();os.fsync(f.fileno())
        d=os.open(STAGE,os.O_RDONLY)
        try:os.fsync(d)
        finally:os.close(d)
        command.append(a.descriptor_sha256)
    child=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,timeout=75,check=False)
    require(len(child.stdout)<=65536,'output_too_large')
    result=json.loads(child.stdout)
    after={x:service(x) for x in before}
    require(before==after and config_before==digest(config),'consumer_or_config_changed')
    require(result['schema']=='nodia-ai-ai40-exact-runtime-reconciliation-v1','receipt_invalid')
    receipt={'schema':'nodia-ai-ai40-exact-runtime-reconciliation-operator-v1','status':result['status'],'operator_sha256':a.operator_sha256,'child_sha256':a.child_sha256,'manifest_sha256':MANIFEST,'consumers':after,'configuration_file_sha256':config_before,'configuration_changed':False,'services_changed':False,'child_exit':child.returncode,'stderr_bytes':len(child.stderr),'private_stderr_emitted':False,'result':result}
    if a.mode=='execute_once':
        with (STAGE/'execute-once.receipt.json').open('xb') as f:
            os.chmod(STAGE/'execute-once.receipt.json',0o600);f.write(json.dumps(receipt).encode());f.flush();os.fsync(f.fileno())
        d=os.open(STAGE,os.O_RDONLY)
        try:os.fsync(d)
        finally:os.close(d)
    print(json.dumps(receipt))
    return child.returncode

p=argparse.ArgumentParser();p.add_argument('--mode',choices=['readiness','execute_once'],required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--child-sha256',required=True);p.add_argument('--descriptor-sha256');a=p.parse_args()
try:sys.exit(main(a))
except Exception as e:
    print(json.dumps({'schema':'nodia-ai-ai40-exact-runtime-reconciliation-operator-v1','status':'operator_failed','error_type':type(e).__name__,'private_error_emitted':False}));sys.exit(1)
