"""Run the actual root launcher in disposable Docker, with only systemd control adapted.

The package/Node/actions, UID changes, protected FDs, files, lock and crypto are real.
The systemctl adapter is not a claim of PID1/sandbox qualification. No network or DB/R2.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import uuid

SYSTEMCTL = r'''#!/usr/local/bin/python3
import os,shlex,subprocess,sys,traceback
from pathlib import Path
def diagnostic(kind,error,stack):
 Path('/fixture/systemctl-error.log').write_text(''.join(traceback.format_exception(kind,error,stack)))
sys.excepthook=diagnostic
action=sys.argv[1]
with Path('/fixture/systemctl-calls.jsonl').open('a') as record:
 import json
 record.write(json.dumps(sys.argv[1:])+'\n')
if action in ('daemon-reload','stop','reset-failed'):sys.exit(0)
unit=next(value for value in sys.argv[2:] if not value.startswith('--'))
if action=='show':
 path=Path('/run/systemd/system')/unit
 print('LoadState=loaded\nActiveState=inactive\nMainPID=0\nUnitFileState=disabled\nFragmentPath='+str(path if path.exists() else ''))
 sys.exit(0)
assert action=='start'
lines=(Path('/run/systemd/system')/unit).read_text().splitlines()
values={}
env={}
for line in lines:
 if '=' not in line:continue
 key,value=line.split('=',1)
 if key=='EnvironmentFile':
  for entry in Path(value).read_text().splitlines():
   if entry and not entry.startswith('#'):
    name,text=entry.split('=',1);env[name]=shlex.split(text,comments=False,posix=True)[0]
 elif key=='Environment':
  name,text=value.split('=',1);env[name]=text
 else:values[key]=value
assert values['User']=='nodia' and values['Group']=='nodia'
assert values['ReadOnlyPaths']=='/var/lib/nodia' and values['ReadWritePaths']=='/var/lib/nodia/backups/spool'
out=os.open(values['StandardOutput'].removeprefix('file:'),os.O_WRONLY|os.O_TRUNC|os.O_NOFOLLOW)
err=os.open(values['StandardError'].removeprefix('file:'),os.O_WRONLY|os.O_TRUNC|os.O_NOFOLLOW)
try:
 result=subprocess.run(shlex.split(values['ExecStart']),env=env,cwd=values['WorkingDirectory'],
  user=900,group=900,extra_groups=[],stdin=subprocess.DEVNULL,stdout=out,stderr=err,timeout=20)
 sys.exit(result.returncode)
finally:os.close(out);os.close(err)
'''

CRYPTO = r'''
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash,createPublicKey,generateKeyPairSync} from 'node:crypto';
import {openCustody} from '/home/nodia-admin/nodia-setup/backend/configure-production-backups.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv[2]==='key'){
 const keys=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 fs.writeFileSync('/fixture/private.pem',keys.privateKey,{mode:0o600});
 fs.writeFileSync('/home/nodia-admin/nodia-setup/backend/recovery-public.pem',keys.publicKey,{mode:0o644});
 fs.chownSync('/home/nodia-admin/nodia-setup/backend/recovery-public.pem',1001,1001);
 fs.writeFileSync('/fixture/key-id',sha(createPublicKey(keys.publicKey).export({type:'spki',format:'der'})),{mode:0o600});
}else{
 const record=JSON.parse(fs.readFileSync('/var/lib/nodia-backend-setup/backup-preparation-status.json','utf8'));
 const cipher=fs.readFileSync('/home/nodia-admin/nodia-setup/backend/recovery-config-custody.enc');
 const payload=openCustody(cipher,fs.readFileSync('/fixture/private.pem','utf8'),record.custody.cipher_sha256);
 const files={'runtime.env':'/etc/nodia/runtime.env','redis.env':'/etc/nodia/redis.env','recovery.json':'/var/lib/nodia/config/recovery.json'};
 for(const entry of payload.files)assert.ok(Buffer.from(entry.content,'base64').equals(fs.readFileSync(files[entry.name])));
 console.log(JSON.stringify({custody_roundtrip_exact:true,files:Object.keys(files),cipher_digest_pinned:true,private_key_synthetic:true}));
}
'''

DRIVER = r'''
import contextlib,hashlib,importlib.util,io,json,os,pwd,stat,subprocess,sys
from pathlib import Path
root=Path('/opt/nodia/candidates')/sys.argv[1]
archive_sha=sys.argv[2]
source=Path('/home/nodia-admin/nodia-setup/backend')
def file(path,data,mode=0o600,uid=0,gid=0):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_bytes(data if isinstance(data,bytes) else data.encode());os.chown(path,uid,gid);os.chmod(path,mode)
def directory(path,mode=0o755,uid=0,gid=0):
 path.mkdir(parents=True,exist_ok=True);os.chown(path,uid,gid);os.chmod(path,mode)
def env(values):
 return ''.join(k+'="'+v.replace('\\','\\\\').replace('"','\\"')+'"\n' for k,v in values.items())
# Ephemeral image accounts only, not host/WSL accounts.
passwd=Path('/etc/passwd').read_text().splitlines()
passwd=[line for line in passwd if line.split(':')[0] not in ('nodia','nodia-admin') and line.split(':')[2] not in ('900','1001')]
passwd+=['nodia:x:900:900::/var/lib/nodia/home:/usr/sbin/nologin','nodia-admin:x:1001:1001::/home/nodia-admin:/bin/sh']
Path('/etc/passwd').write_text('\n'.join(passwd)+'\n')
groups=Path('/etc/group').read_text().splitlines()
groups=[line for line in groups if line.split(':')[0] not in ('nodia','nodia-admin') and line.split(':')[2] not in ('900','1001')]
groups+=['nodia:x:900:','nodia-admin:x:1001:'];Path('/etc/group').write_text('\n'.join(groups)+'\n')
for path in (Path('/home/nodia-admin'),Path('/home/nodia-admin/nodia-setup'),source):directory(path,0o750,1001,1001)
private=Path('/var/lib/nodia-backend-setup/private');directory(private,0o700);directory(private.parent)
directory(Path('/usr/local/lib/nodia'));directory(Path('/var/lib/nodia'),0o750,0,900);directory(Path('/var/lib/nodia/config'),0o750,0,900)
directory(Path('/var/lib/nodia/home'),0o700,900,900);directory(Path('/run/systemd/system'))
file(Path('/usr/bin/systemctl'),Path('/fixture/systemctl').read_bytes(),0o755)
file(Path('/usr/bin/systemd-analyze'),'#!/bin/sh\nexit 0\n',0o755)
if Path('/usr/local/bin/node').exists() or Path('/usr/local/bin/node').is_symlink():Path('/usr/local/bin/node').unlink()
Path('/usr/local/bin/node').symlink_to('/node/bin/node')
for name in ('pg_dump','pg_restore'):file(Path('/usr/lib/postgresql/16/bin')/name,'#!/bin/sh\nprintf "'+name+' (PostgreSQL) 16.15\\n"\n',0o755)
manifest_bytes=(root/'release-manifest.json').read_bytes();manifest=json.loads(manifest_bytes)
nodehash=hashlib.sha256(Path('/node/bin/node').read_bytes()).hexdigest();assert nodehash==manifest['runtime']['executable_sha256']
receipt={'schema_version':1,'release_id':root.name,'archive_sha256':archive_sha,'manifest_sha256':hashlib.sha256(manifest_bytes).hexdigest(),
 'source_provenance':'git_archive','deployment_eligible':True,'files_verified':len(manifest['files'])}
file(private.parent/'candidate-receipts'/f'{root.name}.json',json.dumps(receipt))
result={'status':'verified','source_sha':manifest['source_sha'],'release_id':root.name,'migrations_verified':45,'entity_tables_verified':68,
 'users':1,'core_assignments':4,'provider_credentials':0,'client_tls_authorized':True,'postcheck_read_only':True,
 'application_started':False,'worker_started':False}
installed={'schema_version':1,'phase':'complete','source_sha':manifest['source_sha'],'release_id':root.name,'archive_sha256':archive_sha,'result':result}
file(private/'installation-status.json',json.dumps(installed));file(private.parent/'installation-status.json',json.dumps(installed),0o644)
synthetic={'PGSSLMODE':'verify-full','NODIA_AI_RECOVERY_CONFIG_FILE':'/var/lib/nodia/config/recovery.json',
 'POSTGRES_HOST':'fixture.invalid','POSTGRES_PORT':'29102','POSTGRES_DB':'fixture_db','POSTGRES_USER':'synthetic_normal',
 'POSTGRES_PASSWORD':'synthetic-$;|literal"slash\\','JWT_ACCESS_TOKEN_SECRET':'synthetic-jwt-only'}
file(Path('/etc/nodia/runtime.env'),env(synthetic));file(Path('/etc/nodia/redis.env'),env({'REDIS_PASSWORD':'synthetic-redis-$;|'}))
file(Path('/var/lib/nodia/config/recovery.json'),json.dumps({'synthetic':'recovery-byte-custody-only'}),0o400,900,900)
originals={str(path):hashlib.sha256(path.read_bytes()).hexdigest() for path in
 (Path('/etc/nodia/runtime.env'),Path('/etc/nodia/redis.env'),Path('/var/lib/nodia/config/recovery.json'))}
file(private/'installation.lock',b'') # The real failure was a legitimate zero-byte lock.
assert (private/'installation.lock').stat().st_size==0
subprocess.run(['/node/bin/node','/fixture/crypto.mjs','key'],check=True,capture_output=True)
spec=importlib.util.spec_from_file_location('actual_configuration_wrapper',source/'configure-production-backups.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
module.KEY_ID=Path('/fixture/key-id').read_text() # Synthetic public fingerprint; check remains real.
launcher_hash=hashlib.sha256((source/'configure-production-backups.py').read_bytes()).hexdigest()
action_hash=hashlib.sha256((source/'configure-production-backups.mjs').read_bytes()).hexdigest()
captured=io.StringIO()
try:
 with contextlib.redirect_stdout(captured):module.main([str(root),'--source-sha',manifest['source_sha'],'--tree-sha256',manifest['package_tree_sha256'],
  '--helper-sha256',launcher_hash,'--action-sha256',action_hash])
except Exception:
 for diagnostic in (private/'backup-configuration-last-error.log',Path('/fixture/systemctl-error.log')):
  if diagnostic.exists():sys.stderr.write(diagnostic.read_text()+'\n')
 raise
published=json.loads(captured.getvalue());assert published['phase']=='complete'
assert synthetic['POSTGRES_PASSWORD'] not in captured.getvalue() and 'synthetic-jwt-only' not in captured.getvalue()
assert (private/'installation.lock').stat().st_size==0
for path,uid,mode in [(Path('/var/lib/nodia/config/backup-public.pem'),900,0o400),(Path('/var/lib/nodia/config/backup.json'),900,0o600),
 (Path('/var/lib/nodia/backups/spool'),900,0o700),(source/'recovery-config-custody.enc',1001,0o600)]:
 info=path.stat();assert info.st_uid==uid and stat.S_IMODE(info.st_mode)==mode
configuration=json.loads(Path('/var/lib/nodia/config/backup.json').read_text());assert configuration['database']['password']==synthetic['POSTGRES_PASSWORD']
assert configuration['database']['tls']['mode']=='verify-full'
crypto=subprocess.run(['/node/bin/node','/fixture/crypto.mjs','verify'],capture_output=True,text=True,check=True)
assert not list(Path('/run/systemd/system').glob('nodia-backup-configuration-*'))
assert not list(private.glob('backup-configuration-*.json'))
assert not list(private.glob('backup-configuration-*.log'))
for name,digest in originals.items():assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest
protected=[Path('/var/lib/nodia/config/backup-public.pem'),Path('/var/lib/nodia/config/backup.json'),
 private/'recovery-config-custody.enc',source/'recovery-config-custody.enc']
before_repeat={str(path):(hashlib.sha256(path.read_bytes()).hexdigest(),path.stat().st_uid,path.stat().st_mode) for path in protected}
second=io.StringIO();blocked=False
try:
 with contextlib.redirect_stdout(second):module.main([str(root),'--source-sha',manifest['source_sha'],'--tree-sha256',manifest['package_tree_sha256'],
  '--helper-sha256',launcher_hash,'--action-sha256',action_hash])
except ValueError as error:blocked=str(error)=='previous_or_partial_preparation_requires_inspection'
assert blocked
assert before_repeat=={str(path):(hashlib.sha256(path.read_bytes()).hexdigest(),path.stat().st_uid,path.stat().st_mode) for path in protected}
calls=[json.loads(line) for line in Path('/fixture/systemctl-calls.jsonl').read_text().splitlines()]
for call in calls:
 if call[0] in ('start','stop','reset-failed'):
  assert all(value.startswith('--') or value.startswith('nodia-backup-configuration-') for value in call[1:])
assert not Path('/opt/nodia/current').exists() and not Path('/opt/nodia/current').is_symlink()
print(json.dumps({'status':'passed','launcher_sha256':launcher_hash,'action_sha256':action_hash,'source_sha':manifest['source_sha'],
 'node_sha256':nodehash,'zero_byte_lock_accepted_and_preserved':True,'full_real_manifest_inventory_validated':True,
 'actual_main_executed':True,'actual_uid900_action_and_package_loader':True,'root_fd_private_json_to_nodia_config':True,
 'cipher_export_admin600':True,'repeat_refused_without_overwrite':True,'raw_secret_not_in_public_stdout':True,
 'original_configuration_bytes_unchanged':True,'no_api_worker_or_timer_action_requested':True,
 'custody':json.loads(crypto.stdout),'systemd_control_mocked':True,'pid1_qualified_by_this_fixture':False,
 'postgres_clients_metadata_fixture_only':True,'network':'none','remote_calls_requested':False,'units_cleaned':True}))
'''


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image',required=True)
    parser.add_argument('--package-archive',required=True)
    parser.add_argument('--node-archive',required=True)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    assert args.image.startswith('sha256:') and len(args.image)==71
    output=Path(args.output).resolve();assert not output.exists()
    root=Path(__file__).resolve().parents[3]
    package=Path(args.package_archive).resolve();node=Path(args.node_archive).resolve()
    package_sha=hashlib.sha256(package.read_bytes()).hexdigest()
    token=uuid.uuid4().hex;label='nodia.production.backup-wrapper-fixture'
    container=None;receipt={'schema_version':1,'status':'failed','image':args.image,'package_sha256':package_sha}
    def docker(*arguments):
        result=subprocess.run(['docker',*arguments],capture_output=True,timeout=120)
        if result.returncode:raise RuntimeError(result.stderr.decode())
        return result.stdout.decode().strip()
    try:
        assert docker('image','inspect',args.image,'--format','{{.Id}}')==args.image
        container=docker('create','--label',label+'='+token,'--name','nodia_backup_wrapper_'+token,'--network','none','--user','0:0',
                         '--entrypoint','/usr/bin/env',args.image,'-i','PATH=/usr/local/bin:/usr/bin:/bin','/bin/sh','-c','sleep 600')
        docker('start',container)
        docker('exec',container,'mkdir','-p','/fixture','/node','/opt/nodia/candidates','/home/nodia-admin/nodia-setup/backend')
        docker('cp',str(package),container+':/fixture/package.tar.gz');docker('cp',str(node),container+':/fixture/node.tar.gz')
        assert docker('exec',container,'sha256sum','/fixture/package.tar.gz').split()[0]==package_sha
        docker('exec',container,'tar','-xzf','/fixture/node.tar.gz','--no-same-owner','--strip-components=1','-C','/node')
        release=package.name.removesuffix('.tar.gz')
        docker('exec',container,'mkdir','-p','/opt/nodia/candidates/'+release)
        docker('exec',container,'tar','-xzf','/fixture/package.tar.gz','--no-same-owner','-C','/opt/nodia/candidates/'+release)
        for name in ('configure-production-backups.py','configure-production-backups.mjs','bootstrap-recovery-journal.py'):
            docker('cp',str(root/'ops/production'/name),container+':/home/nodia-admin/nodia-setup/backend/'+name)
        with tempfile.TemporaryDirectory(prefix='nodia-backup-wrapper-') as temporary:
            for filename,data in [('driver.py',DRIVER),('crypto.mjs',CRYPTO),('systemctl',SYSTEMCTL)]:
                target=Path(temporary)/filename;target.write_text(data,encoding='utf-8',newline='\n');docker('cp',str(target),container+':/fixture/'+filename)
        raw=docker('exec',container,'/usr/bin/env','-i','PATH=/usr/local/bin:/usr/bin:/bin',
                   '/usr/local/bin/python3','/fixture/driver.py',release,package_sha)
        receipt['result']=json.loads(raw);receipt['status']='passed'
    except Exception as error:
        output.parent.mkdir(parents=True,exist_ok=True)
        output.with_suffix('.log').write_text(str(error),encoding='utf-8')
    finally:
        receipt['cleanup']={'container_removed':False}
        if container:
            assert json.loads(docker('inspect',container))[0]['Config']['Labels'][label]==token
            docker('rm','--force','--volumes',container);receipt['cleanup']['container_removed']=True
        output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8',newline='\n')
        print(json.dumps(receipt))
    return 0 if receipt['status']=='passed' else 1


if __name__=='__main__':
    raise SystemExit(main())
