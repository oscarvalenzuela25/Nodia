"""Repair only five reviewed Compose metadata objects; no content or service changes."""
import argparse,hashlib,json,os,re,stat,subprocess,sys
from pathlib import Path
WORK=Path('/opt/nodia/verification/ai40-gemini-compose-metadata-repair-r01')
PLAN_SHA='54151a6463b5c1c44dd42ad4d84657e74f09eaac985484048ccea75910eea5da'
EXPECTED_CHANGES=[{'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.yml', 'before': {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.yml', 'uid': 0, 'gid': 0, 'mode': '0o666', 'nlink': 1, 'device': 2050, 'inode': 530202, 'bytes': 846, 'sha256': '328f17614085d997a7e4d50c8aa86bd8f58850dec529aeb3f8f6e2ac9a555c78'}, 'after': {'uid': 0, 'gid': 0, 'mode': '0o644'}, 'content_change': False}, {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.agentic.yml', 'before': {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.agentic.yml', 'uid': 0, 'gid': 0, 'mode': '0o666', 'nlink': 1, 'device': 2050, 'inode': 530201, 'bytes': 725, 'sha256': 'e8b9d2669a945f7eefc1320a1505c7a67ad66fb83fb7bd318b08d554d955f54f'}, 'after': {'uid': 0, 'gid': 0, 'mode': '0o644'}, 'content_change': False}, {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.lab.yml', 'before': {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.lab.yml', 'uid': 10001, 'gid': 986, 'mode': '0o644', 'nlink': 1, 'device': 2050, 'inode': 562046, 'bytes': 311, 'sha256': '510b294eaabb6fb0c1a97548081100a64e515a82d15dbcf09c854921961f1096'}, 'after': {'uid': 0, 'gid': 0, 'mode': '0o644'}, 'content_change': False}, {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.web-reasoning.yml', 'before': {'path': '/opt/nodia/nodia-gemini-microservice/docker-compose.web-reasoning.yml', 'uid': 0, 'gid': 0, 'mode': '0o666', 'nlink': 1, 'device': 2050, 'inode': 567326, 'bytes': 487, 'sha256': 'b76da4f17e29d0a524121fbec81cab3d7a568e8b4ad3c954246b62eac8438376'}, 'after': {'uid': 0, 'gid': 0, 'mode': '0o644'}, 'content_change': False}, {'path': '/opt/nodia/nodia-gemini-microservice', 'before': {'path': '/opt/nodia/nodia-gemini-microservice', 'uid': 10001, 'gid': 986, 'mode': '0o755', 'nlink': 9, 'device': 2050, 'inode': 530182, 'replacement_by_nonroot_possible': True}, 'after': {'uid': 0, 'gid': 0, 'mode': '0o755'}, 'recursive': False}]
CONTAINER='678d4f10274cf557590311af0bee81a7cb71be7015ec282a4154d48b71d6d38b'
IMAGE='sha256:15e8c319011ecfc7f792938cc4177ab0943af8894b204375bd1c1200728f935a'
PROOFS={'mcp':'a1f1ee2742324a87d8f96fc4207fb7845fa5deb51eb5d772d30faa6858e1eff0','mcp-image-png':'9a1848159f6e0756db7986233516e4fe6b6d180c37acf8fe26b6b0384cfea131','mcp-image-jpeg':'2b6426566681eaa95e0fa9a0c5686061069451a84f42c80a5967bd0608510772','mcp-image-webp':'744b7224928083c5703bc01a0e6575db9e10589a85b7dd86c43f99f4222e3c38'}
def require(v,code):
 if not v:raise ValueError(code)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def encoded(v):return(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def sync_dir(path):
 fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:os.fsync(fd)
 finally:os.close(fd)
def write_once(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(encoded(value));f.flush();os.fsync(f.fileno())
 sync_dir(path.parent)
def read_fd(fd,maximum=131072):
 os.lseek(fd,0,os.SEEK_SET);parts=[];size=0
 while True:
  raw=os.read(fd,min(65536,maximum+1-size))
  if not raw:break
  size+=len(raw);require(size<=maximum,'file_oversized');parts.append(raw)
 return b''.join(parts)
def metadata(s):return {'uid':s.st_uid,'gid':s.st_gid,'mode':oct(stat.S_IMODE(s.st_mode)),'nlink':s.st_nlink,'device':s.st_dev,'inode':s.st_ino}
def unchanged_path(path,fd):
 a=path.lstat();b=os.fstat(fd);require(not stat.S_ISLNK(a.st_mode)and(a.st_dev,a.st_ino)==(b.st_dev,b.st_ino),'pathname_replaced');return b
def command(argv):
 r=subprocess.run(argv,capture_output=True,timeout=20,check=False);require(r.returncode==0,'readonly_command_failed');return r.stdout
def protected():
 v=json.loads(command(['docker','inspect',CONTAINER]))[0];require(v['Id']==CONTAINER and v['Image']==IMAGE and v['State']['Running']and v['State']['Health']['Status']=='healthy','candidate_epoch_changed')
 root=Path('/proc')/str(v['State']['Pid'])/'root'
 files={root/'run/nodia-login-containment.json':'dd9d6eef9406a630677eadc551ade4a91cba3e80895f717eeacb8b9113562e08',root/'app/session_state/runtime_admission/attempts/c6cc8739-7de7-4c13-a5c9-6b230fb3b1de.json':'eec6a5f80405b2ba2a1510d7d5a3fd3bfe413a1dfee55256741d49da0865cf90',Path('/var/lib/nodia-login-containment/chat-bindings/c6cc8739-7de7-4c13-a5c9-6b230fb3b1de.json'):'fe2492548f2455d769e965070dea013ee89ccaaff25fc48ca6ba276e88403484'}
 files.update({Path('/var/lib/nodia/codex/1')/('nodia-chat-'+k):pin for k,pin in PROOFS.items()});hashes={}
 for path,pin in files.items():
  fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
  try:s=os.fstat(fd);require(stat.S_ISREG(s.st_mode)and s.st_nlink==1 and not s.st_mode&0o022,'protected_identity_changed');raw=read_fd(fd);require(sha(raw)==pin,'protected_file_changed');hashes[str(path).split('/root/')[-1]if'/root/'in str(path)else str(path)]=pin
  finally:os.close(fd)
 for unit in ('nodia-api','nodia-ai-worker'):
  fields=dict(line.split('=',1)for line in command(['systemctl','show',unit,'--property=ActiveState,MainPID','--no-pager']).decode().strip().splitlines());require(fields=={'MainPID':'0','ActiveState':'inactive'},'claims_not_closed')
 return {'container_id':CONTAINER,'image_id':IMAGE,'started_at':v['State']['StartedAt'],'init_pid':v['State']['Pid'],'healthy':True,'claims_closed':True,'protected_sha256':hashes}
def run(args):
 require(sys.platform=='linux'and os.geteuid()==0 and not sys.flags.optimize,'linux_root_required')
 source=Path(__file__).resolve();s=source.lstat();require(stat.S_IMODE(s.st_mode)==0o600 and s.st_uid==0 and s.st_nlink==1 and sha(source.read_bytes())==args.operator_sha256,'operator_identity_changed')
 info=WORK.lstat();require(WORK.resolve()==WORK and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'work_unsafe')
 path=WORK/'plan.json';s=path.lstat();require(stat.S_ISREG(s.st_mode)and s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o600 and s.st_nlink==1,'plan_identity_changed');raw=path.read_bytes();require(sha(raw)==PLAN_SHA,'plan_changed');plan=json.loads(raw)
 require(plan['proposed_file_changes']+plan['proposed_parent_changes']==EXPECTED_CHANGES,'changes_outside_reviewed_scope')
 fds={};dirs={};report={'schema':'nodia-ai-ai40-compose-metadata-repair-v1','operator_sha256':args.operator_sha256,'plan_sha256':PLAN_SHA,'status':'preflight_failed','provider_generations':0,'Native_calls':0,'SQL_writes':0,'services_mutated':False,'content_changed':False,'recursive_operations':False,'automatic_retry_allowed':False}
 try:
  for item in plan['ancestors']:
   p=Path(item['path']);fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);dirs[str(p)]=fd;s=unchanged_path(p,fd);require(p.resolve()==p and all(metadata(s)[k]==item[k]for k in ('uid','gid','mode','device','inode')),'ancestor_changed')
  for item in plan['files']:
   p=Path(item['path']);fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK);fds[str(p)]=fd;s=unchanged_path(p,fd);require(stat.S_ISREG(s.st_mode)and metadata(s)=={k:item[k]for k in metadata(s)}and sha(read_fd(fd))==item['sha256'],'config_identity_or_bytes_changed')
  before=protected();report['protected_before']=before
  if not args.execute:report['status']='metadata_plan_verified_read_only';return report
  require(not(WORK/'receipt.json').exists(),'metadata_receipt_already_present');write_once(WORK/'intent.json',report)
  try:
   for change in plan['proposed_parent_changes']:
    p=Path(change['path']);fd=dirs[str(p)];unchanged_path(p,fd);os.fchown(fd,change['after']['uid'],change['after']['gid']);os.fchmod(fd,int(change['after']['mode'],8));os.fsync(fd);sync_dir(p.parent)
   for change in plan['proposed_file_changes']:
    p=Path(change['path']);fd=fds[str(p)];s=unchanged_path(p,fd);require(sha(read_fd(fd))==change['before']['sha256'],'config_changed_before_metadata')
    if(s.st_uid,s.st_gid)!=(change['after']['uid'],change['after']['gid']):os.fchown(fd,change['after']['uid'],change['after']['gid'])
    if stat.S_IMODE(s.st_mode)!=int(change['after']['mode'],8):os.fchmod(fd,int(change['after']['mode'],8))
    os.fsync(fd);sync_dir(p.parent)
   after_files=[]
   desired={c['path']:c['after']for c in EXPECTED_CHANGES}
   for item in plan['files']:
    p=Path(item['path']);s=unchanged_path(p,fds[str(p)]);target=desired.get(str(p),item);require(all(metadata(s)[k]==target[k]for k in ('uid','gid','mode'))and s.st_nlink==1 and sha(read_fd(fds[str(p)]))==item['sha256'],'post_metadata_or_content_mismatch');after_files.append({'path':str(p),**metadata(s),'sha256':item['sha256'],'bytes':item['bytes']})
   for name,fd in dirs.items():
    s=unchanged_path(Path(name),fd);require(s.st_uid==0 and not s.st_mode&0o022,'ancestor_not_root_secure')
   after=protected();require(after==before,'protected_state_changed')
   report.update(status='metadata_repaired_verified',changed_objects=len(EXPECTED_CHANGES),files_after=after_files,ancestors_root_safe=True,protected_after=after,protected_before_after_equal=True)
  except Exception as error:
   value=str(error);report.update(status='metadata_repair_failed_closed',failure_code=value if re.fullmatch('[A-Za-z_]{1,100}',value)else type(error).__name__)
  write_once(WORK/'receipt.json',report);return report
 finally:
  for fd in (*fds.values(),*dirs.values()):os.close(fd)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--operator-sha256',required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
 try:result=run(args);print(json.dumps(result));sys.exit(0 if result['status']in('metadata_plan_verified_read_only','metadata_repaired_verified')else 1)
 except Exception as error:
  value=str(error);print(json.dumps({'schema':'nodia-ai-ai40-compose-metadata-repair-v1','status':'precondition_failed','failure_code':value if re.fullmatch('[A-Za-z_]{1,100}',value)else type(error).__name__,'private_details_emitted':False,'automatic_retry_allowed':False}));sys.exit(1)
