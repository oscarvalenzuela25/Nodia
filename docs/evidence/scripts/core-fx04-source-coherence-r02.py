"""Metadata-only successor: align authoring JSON with verified runtime publication.

No migration, provider request, capability change or Client change. Preserve the
original R01 package/receipts; create R02 and switch only drained Server writers.
"""
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,sys
from datetime import datetime,timezone
from pathlib import Path
PARENT=Path('/opt/nodia/verification/core-fx04-r01/core-fx04-delivery-r01.py')
PIN='bac8b134f16f7b81709516539c0dbd5ebd58ebb6c07535313303c346098e1753'
WORK=Path('/opt/nodia/verification/core-fx04-source-coherence-r02')
OLD=Path('/opt/nodia/releases/nodia-server-core-fx04-r01')
NEW=Path('/opt/nodia/releases/nodia-server-core-fx04-r02')
OLD_SHA='74b71bdb5f6b5ded314aaa3b73cbe9c6aa78d138af5a4588d43acb33527697da'
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(b):return hashlib.sha256(b).hexdigest()
def write(name,obj):
 with os.fdopen(os.open(WORK/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb') as f:f.write((json.dumps(obj,sort_keys=True)+'\n').encode());f.flush();os.fsync(f.fileno())
def load():
 raw=PARENT.read_bytes();require(sha(raw)==PIN,'parent_changed')
 m=importlib.util.module_from_spec(importlib.util.spec_from_loader('fx04_coherence_parent',loader=None));m.__file__=str(PARENT);exec(compile(raw,str(PARENT),'exec'),m.__dict__);return m
def main(args):
 require(os.getuid()==0 and sha(Path(__file__).read_bytes())==args.operator_sha256,'operator_changed')
 d=load();b,a,h=d.helpers();a.RELEASE=OLD
 receipt=json.loads((d.WORK/'adopt-receipt.json').read_bytes());require(receipt['status']=='adopted_verified','verified_R01_required')
 old=d.verify_release(OLD,OLD_SHA);runtime=json.loads((OLD/'dist/nodia-ai/knowledge/manifest.json').read_bytes())
 baseline=json.loads((Path('/opt/nodia/releases/nodia-server-ai36-c05-r09')/'dist/nodia-ai/knowledge/manifest.json').read_bytes())
 require(runtime['capability_contracts']==baseline['capability_contracts'] and runtime['fragments']==baseline['fragments'] and len(runtime['capability_contracts'])==150 and len(runtime['fragments'])==41,'publication_semantics_changed')
 before,env=d.snapshot(OLD,b,a,h)
 require(before['SQL']==receipt['after']['SQL'],'post_adoption_data_changed')
 require(not NEW.exists() and not (WORK/'intent.json').exists(),'fresh_successor_required')
 shutil.copytree(OLD,NEW,symlinks=True)
 manifest=json.loads(json.dumps(old));delta=[]
 for tail in ['nodia-ai/knowledge/manifest.json','nodia-ai-context/config/knowledge-pin.json']:
  source='src/'+tail;compiled='dist/'+tail;raw=(OLD/compiled).read_bytes()
  require(json.loads(raw).get('release_id',json.loads(raw).get('release'))==runtime['release_id'] or tail.endswith('knowledge-pin.json'),'runtime_metadata_invalid')
  delta.append({'path':source,'old_sha256':old['files'][source],'sha256':sha(raw)})
  (NEW/source).write_bytes(raw);manifest['files'][source]=sha(raw)
 manifest['stage']='Core-FX-04 R02 authoring coherence'
 raw=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode();(NEW/'release-manifest.json').write_bytes(raw)
 new_sha=sha(raw);d.verify_release(NEW,new_sha)
 for tail in ['nodia-ai/knowledge/manifest.json','nodia-ai-context/config/knowledge-pin.json']:require((NEW/('src/'+tail)).read_bytes()==(NEW/('dist/'+tail)).read_bytes(),'source_compiled_divergence')
 require(all(manifest['files'][p]==pin for p,pin in old['files'].items() if not p.startswith('src/nodia-ai/knowledge/manifest.json') and not p.startswith('src/nodia-ai-context/config/knowledge-pin.json')),'unexpected_delta')
 transitions=b.descriptor_bytes(OLD,NEW);write('intent.json',{'phase':'metadata_successor','before':before,'delta':delta,'server_manifest_sha256':new_sha,'parent_manifest_sha256':OLD_SHA})
 for i,(_,raw,_,_) in enumerate(transitions):(WORK/f'descriptor-{i}.private').write_bytes(raw);(WORK/f'descriptor-{i}.private').chmod(0o600)
 report={'status':'failed','before':before,'delta':delta,'new_manifest_sha256':new_sha,'migrations':0,'capabilities':150,'fragments':41,'provider_generations':0}
 stopped=False
 try:
  d.command(['systemctl','stop',*d.TIMERS]);b.oneshots_idle(a)
  began=datetime.now(timezone.utc);backup=json.loads(d.command(['sudo','-u','nodia','/usr/local/bin/node',str(OLD/'scripts/nodia-ai-backups.mjs'),'backup','/etc/nodia-ai-recovery/backup.json'],timeout=240,cwd=OLD));b.validate_backup(backup,began,datetime.now(timezone.utc));report['backup']=backup;write('fresh-backup.json',backup)
  stopped=True;d.command(['systemctl','stop','nodia-api'],timeout=60)
  quiet=h.chat_projection(int(before['services']['nodia-ai-worker']['MainPID']));require(quiet==before['quiet'],'worker_not_drained')
  b.codex_barrier(a,Path('/var/lib/nodia/codex'),frozenset({int(before['services']['nodia-ai-worker']['MainPID'])}));d.command(['systemctl','stop','nodia-ai-worker'],timeout=60);b.codex_barrier(a,Path('/var/lib/nodia/codex'))
  require(d.node(d.SQL_PREFIX+d.SQL_SNAPSHOT,OLD,env)==before['SQL'],'data_changed_during_cut')
  for path,original,desired,mode in transitions:b.atomic_replace(path,original,desired,mode,'fx04-coherence')
  d.command(['systemctl','daemon-reload']);d.command(['systemctl','start',*d.SERVICES],timeout=45);d.health()
  after,_=d.snapshot(NEW,b,a,h);require(after['SQL']==before['SQL'] and after['quiet']==before['quiet'] and after['Gemini']==before['Gemini'] and after['configuration_sha256']==before['configuration_sha256'],'protected_state_changed')
  a.RELEASE=NEW;report['journal']=b.journal_open(a);require(sorted(p.name for p in Path('/var/lib/nodia-ai-recovery/spool').iterdir())==['.backup.lock'],'spool_not_empty')
  d.command(['systemctl','start',*d.TIMERS]);require(all(d.state(n)['ActiveState']=='active' for n in d.TIMERS),'timers_not_restored')
  report.update(status='source_coherent_adopted_verified',after=after,timers_restored=True,Client_unchanged=True)
 except Exception as error:
  report['code']=str(error) if isinstance(error,ValueError) else 'private_dependency_failure'
  if stopped:d.command(['systemctl','stop','nodia-api'],timeout=60)
  else:d.command(['systemctl','start',*d.TIMERS])
  report['services_observed']={n:d.state(n) for n in d.SERVICES};raise
 finally:write('receipt.json',report)
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--operator-sha256',required=True);args=p.parse_args()
 try:
  with os.fdopen(os.open(PARENT.parent/'phase.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600),'r+b') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);print(json.dumps(main(args)))
 except Exception as error:print(json.dumps({'status':'failed','code':str(error) if isinstance(error,ValueError) else 'private_dependency_failure','automatic_retry':False}));sys.exit(1)
