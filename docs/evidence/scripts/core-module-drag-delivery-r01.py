"""Selective reversible DnD release: three backend sources and a complete Client.

No migrations, data restores, provider dispatch or permission changes. Each
transition requires a fresh encrypted backup, quiet writers and CAS descriptors.
The prior and target Server share schema30 and persisted rank representation.
"""
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,sys,tarfile
from datetime import datetime,timezone
from pathlib import Path,PurePosixPath
WORK=Path('/opt/nodia/verification/core-module-dnd-r01')
UPLOAD=Path('/tmp/core-module-dnd-r01')
PARENT=Path('/opt/nodia/verification/core-fx04-r01/core-fx04-delivery-r01.py')
PARENT_SHA='bac8b134f16f7b81709516539c0dbd5ebd58ebb6c07535313303c346098e1753'
PLAN_SHA='1e4a209b4f00679ba30c2c3ca47112b7712a3a17500664d65cefc7e5882664d2'
ARCHIVE_SHA='787f13e6f282e3d45d73b55153317fd995a8241ebec360cd62121f1c390d5e6f'
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def write(name,value):
 with os.fdopen(os.open(WORK/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb') as f:f.write((json.dumps(value,sort_keys=True)+'\n').encode());f.flush();os.fsync(f.fileno())
def load():
 raw=PARENT.read_bytes();require(sha(raw)==PARENT_SHA,'parent_changed')
 m=importlib.util.module_from_spec(importlib.util.spec_from_loader('drag_release_utilities',loader=None));m.__file__=str(PARENT);exec(compile(raw,str(PARENT),'exec'),m.__dict__);return m
def publication(d,old,new):
 for tail in ['nodia-ai/knowledge/manifest.json','nodia-ai-context/config/knowledge-pin.json']:
  raw=(old/('dist/'+tail)).read_bytes()
  require(raw==(old/('src/'+tail)).read_bytes()==(new/('src/'+tail)).read_bytes()==(new/('dist/'+tail)).read_bytes(),'publication_changed')
 require(json.loads((new/'dist/nodia-ai/knowledge/manifest.json').read_bytes())['release_id']=='df1780ad39433af1671467cc3f93285b01b0596155518f6c14330e27b65b80ba','unexpected_publication')
def prepare(d,plan):
 old=Path(plan['server_old']);new=Path(plan['server_new']);client=Path(plan['client_new'])
 require(not new.exists() and not client.exists(),'target_exists');require(os.statvfs('/opt/nodia').f_bavail*os.statvfs('/opt/nodia').f_frsize>120*1024*1024,'insufficient_disk')
 original=d.verify_release(old,plan['server_old_sha256'])
 raw=(UPLOAD/'payload.tar.gz').read_bytes();require(sha(raw)==ARCHIVE_SHA,'archive_changed')
 with tarfile.open(UPLOAD/'payload.tar.gz','r:gz') as tar:
  members=tar.getmembers();require(len(members)==len(plan['payload']) and len({m.name for m in members})==len(members),'archive_members_invalid')
  for m in members:
   require(m.isfile() and m.name in plan['payload'] and not PurePosixPath(m.name).is_absolute() and '..' not in PurePosixPath(m.name).parts and sha(tar.extractfile(m).read())==plan['payload'][m.name],'payload_invalid')
  shutil.copytree(old,new,symlinks=True);client.mkdir(mode=0o755)
  for m in members:
   kind,rel=m.name.split('/',1);require(kind in ['server','client'],'payload_kind_invalid');target=(new if kind=='server' else client)/rel
   target.parent.mkdir(parents=True,exist_ok=True);require(not target.is_symlink(),'target_symlink');target.write_bytes(tar.extractfile(m).read());target.chmod(0o644)
 target=d.verify_release(new,plan['server_new_sha256']);d.verify_release(client,plan['client_new_sha256']);publication(d,old,new)
 expected={v['path'] for v in plan['delta']};require({p for p in target['files'] if target['files'][p]!=original['files'].get(p)}==expected and set(original['files'])==set(target['files']),'unexpected_server_delta')
 require(all(p.startswith(('src/module-order/','dist/module-order/')) for p in expected),'out_of_scope_source')
 return {'phase':'prepare','status':'prepared_verified','server_delta':len(expected),'client_files':len(json.loads((client/'release-manifest.json').read_bytes())['files'])}
def main(args):
 require(os.getuid()==0 and sha(Path(__file__).read_bytes())==args.operator_sha256,'operator_changed')
 d=load();raw=(WORK/'plan.json').read_bytes();require(sha(raw)==PLAN_SHA,'plan_changed');plan=json.loads(raw)
 if args.phase=='prepare':
  result=prepare(d,plan);write('prepare.json',result);return result
 reverse=args.phase=='rollback';old=Path(plan['server_old']);new=Path(plan['server_new']);source,target=(new,old) if reverse else (old,new)
 d.verify_release(old,plan['server_old_sha256']);d.verify_release(new,plan['server_new_sha256']);d.verify_release(Path(plan['client_old']),plan['client_old_sha256']);d.verify_release(Path(plan['client_new']),plan['client_new_sha256']);publication(d,old,new)
 b,a,h=d.helpers();a.RELEASE=source;before,env=d.snapshot(source,b,a,h)
 require(len(before['SQL']['migrations'])==30 and before['SQL']['migrations'][-1]['name']==d.MIGRATION,'schema_changed')
 transitions=b.descriptor_bytes(source,target);site=d.SITE.read_bytes()
 if reverse:
  adopted=json.loads((WORK/'adopt-receipt.json').read_bytes());require(adopted['status']=='adopted_verified','successful_adoption_required')
  require(sha(site)==adopted['site_sha256'],'site_changed');desired_site=(WORK/'original-site.private').read_bytes()
  require(site.replace(plan['client_new'].encode(),plan['client_old'].encode())==desired_site,'rollback_site_invalid')
  for i,(_,_,desired,_) in enumerate(transitions):require(desired==(WORK/f'descriptor-{i}.private').read_bytes(),'rollback_descriptor_invalid')
 else:
  require(sha(site)==plan['site_old_sha256'] and site.count(plan['client_old'].encode())==1,'site_changed');desired_site=site.replace(plan['client_old'].encode(),plan['client_new'].encode())
 preflight={'phase':args.phase,'status':'preflight_passed','before':before,'migrations':0,'provider_generations':0}
 if args.phase=='preflight':return preflight
 require(args.execute and not (WORK/(args.phase+'-intent.json')).exists(),'fresh_execute_required')
 write(args.phase+'-intent.json',preflight)
 if not reverse:
  (WORK/'original-site.private').write_bytes(site);(WORK/'original-site.private').chmod(0o600)
  for i,(_,original,_,_) in enumerate(transitions):(WORK/f'descriptor-{i}.private').write_bytes(original);(WORK/f'descriptor-{i}.private').chmod(0o600)
 report={**preflight,'status':'failed'};stopped=False
 try:
  d.command(['systemctl','stop',*d.TIMERS]);b.oneshots_idle(a)
  began=datetime.now(timezone.utc);backup=json.loads(d.command(['sudo','-u','nodia','/usr/local/bin/node',str(source/'scripts/nodia-ai-backups.mjs'),'backup','/etc/nodia-ai-recovery/backup.json'],cwd=source,timeout=240));b.validate_backup(backup,began,datetime.now(timezone.utc));write(args.phase+'-backup.json',backup);report['backup']=backup
  fresh,_=d.snapshot(source,b,a,h);require(fresh['SQL']==before['SQL'] and fresh['quiet']==before['quiet'],'data_changed_during_backup')
  stopped=True;d.command(['systemctl','stop','nodia-api'],timeout=60)
  q=h.chat_projection(int(before['services']['nodia-ai-worker']['MainPID']));require(q==before['quiet'],'worker_not_quiet')
  b.codex_barrier(a,Path('/var/lib/nodia/codex'),frozenset({int(before['services']['nodia-ai-worker']['MainPID'])}));d.command(['systemctl','stop','nodia-ai-worker'],timeout=60);b.codex_barrier(a,Path('/var/lib/nodia/codex'))
  require(d.node(d.SQL_PREFIX+d.SQL_SNAPSHOT,source,env)==before['SQL'],'data_changed_before_switch')
  for path,original,desired,mode in transitions:b.atomic_replace(path,original,desired,mode,'module-drag-'+args.phase)
  b.atomic_replace(d.SITE,site,desired_site,0o644,'module-drag-'+args.phase);d.command(['nginx','-t']);d.command(['systemctl','daemon-reload']);d.command(['systemctl','start',*d.SERVICES],timeout=45);d.health();d.command(['systemctl','reload','nginx'])
  after,_=d.snapshot(target,b,a,h);require(after['SQL']==before['SQL'] and after['quiet']==before['quiet'] and after['Gemini']==before['Gemini'] and after['configuration_sha256']==before['configuration_sha256'],'protected_state_changed')
  a.RELEASE=target;report['journal']=b.journal_open(a);require(sorted(p.name for p in Path('/var/lib/nodia-ai-recovery/spool').iterdir())==['.backup.lock'],'spool_not_empty')
  d.command(['systemctl','start',*d.TIMERS]);require(all(d.state(n)['ActiveState']=='active' for n in d.TIMERS),'timers_not_restored')
  report.update(status='rolled_back_verified' if reverse else 'adopted_verified',after=after,site_sha256=sha(desired_site),timers_restored=True)
 except Exception as error:
  report['code']=str(error) if isinstance(error,ValueError) else 'private_dependency_failure'
  if stopped:
   d.command(['systemctl','stop','nodia-api'],timeout=60)
   worker=d.state('nodia-ai-worker')
   if worker['ActiveState']=='active':
    try:
     q=h.chat_projection(int(worker['MainPID']));require(all(q[k]==0 for k in ['pending_jobs','open_attempts','retained_slots']),'worker_draining');b.codex_barrier(a,Path('/var/lib/nodia/codex'),frozenset({int(worker['MainPID'])}));d.command(['systemctl','stop','nodia-ai-worker'],timeout=60)
    except Exception:report['worker_left_draining']=True
  else:d.command(['systemctl','start',*d.TIMERS])
  report['services_observed']={n:d.state(n) for n in d.SERVICES};raise
 finally:write(args.phase+'-receipt.json',report)
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--phase',choices=['prepare','preflight','adopt','rollback'],required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--execute',action='store_true');args=p.parse_args()
 try:
  with os.fdopen(os.open(WORK/'phase.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600),'r+b') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);print(json.dumps(main(args)))
 except Exception as error:print(json.dumps({'status':'failed','code':str(error) if isinstance(error,ValueError) else 'private_dependency_failure','automatic_retry':False}));sys.exit(1)
