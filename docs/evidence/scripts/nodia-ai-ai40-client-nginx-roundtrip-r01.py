"""A compiled Client -> original 404 -> same compiled Client, separate intents.

Imports only functions from the frozen one-shot operator. Never calls its run,
reuses a consumed intent, changes Server/SQL, or dispatches a provider.
"""
import argparse,hashlib,importlib.util,json,os,re,stat,sys
from pathlib import Path
PARENT=Path('/opt/nodia/verification/ai40-client-nginx-operator-r01/nodia-ai-ai40-client-nginx-operator-r01.py')
PARENT_SHA='60660f0c5b4f1383f910bbdc0068e97b8f08212f3bfb3e6228ad9fed38b722b0'
WORK=Path('/opt/nodia/verification/ai40-client-nginx-roundtrip-r01/work')
A_SHA='f22baabdc2f9b8c063b3bffb9268472456e99fbf89d41e491f1cbc34f44d7343'
B_SHA='2f96d9f04d2bc2eba6e1d8bc126ec7d4a5c5b5202bfa3238d87d23e94c52a857'
API_SHA='7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(b):return hashlib.sha256(b).hexdigest()
def private(path,mode=0o600):
 s=path.lstat();require(path.resolve()==path and stat.S_ISREG(s.st_mode)and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==mode,'private_file_identity_changed')
def stable(snapshot):return {k:v for k,v in snapshot.items()if k!='status_read_attempts'}
def encoded(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def write_once(path,b):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(b);f.flush();os.fsync(f.fileno())
 d=os.open(WORK,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(d)
 finally:os.close(d)
def api(op):
 status,body,_=op.http('/api/v1/');require(status==200 and sha(body)==API_SHA,'original_API_body_changed')
def phase(a):
 private(PARENT);require(sha(PARENT.read_bytes())==PARENT_SHA,'frozen_parent_changed')
 spec=importlib.util.spec_from_file_location('frozen_client_protocol',PARENT);op=importlib.util.module_from_spec(spec);spec.loader.exec_module(op)
 package=op.package();current=op.SITE.read_bytes();private(op.SITE,0o644)
 private(op.WORK/'original-site.conf');original=(op.WORK/'original-site.conf').read_bytes()
 require(sha(original)==B_SHA and original.count(b'location / { return 404; }')==1,'original_backup_changed')
 compiled=original.replace(b'location / { return 404; }',op.PATCH);require(sha(compiled)==A_SHA,'compiled_config_changed')
 require(current in(original,compiled),'site_state_not_determined')
 private(op.WORK/'adopt-receipt.json');adopted=json.loads((op.WORK/'adopt-receipt.json').read_bytes())
 require(adopted['status']=='adopted_verified'and adopted['phase']=='adopt'and adopted['operator_sha256']==PARENT_SHA and adopted['manifest_sha256']==op.MANIFEST and adopted['site_target_sha256']==A_SHA,'prior_adoption_not_verified')
 before=op.snapshot();api(op);state='A_compiled'if current==compiled else'B_original_404'
 report={'schema':'nodia-ai-ai40-client-nginx-roundtrip-v1','phase':a.phase,'status':'preflight_passed','operator_sha256':a.operator_sha256,'parent_operator_sha256':PARENT_SHA,'manifest_sha256':op.MANIFEST,'state_before':state,'site_before_sha256':sha(current),'before':before,'API_body_sha256':API_SHA,'SDK_requests':0,'SQL_writes':0,'API_worker_restarted':False,'automatic_retry_allowed':False,'original_one_shot_intents_modified':False}
 if a.phase=='preflight':
  require(not a.execute,'preflight_cannot_execute');report['HTTP']=op.verify_http(package,current==compiled);return report
 require(a.execute,'explicit_execute_required')
 require(not(WORK/(a.phase+'-intent.json')).exists()and not(WORK/(a.phase+'-receipt.json')).exists(),'phase_intent_already_consumed')
 if a.phase=='revert':
  require(current==compiled and not(WORK/'restore-intent.json').exists(),'revert_requires_original_A')
  op.verify_http(package,True)
  write_once(WORK/'baseline.json',encoded(stable(before)));write_once(WORK/'compiled-site.conf',compiled);write_once(WORK/'original-site.conf',original)
  desired=original
 else:
  for name in('revert-intent.json','baseline.json','compiled-site.conf','original-site.conf'):private(WORK/name)
  intent=json.loads((WORK/'revert-intent.json').read_bytes())
  require(intent['operator_sha256']==a.operator_sha256 and intent['parent_operator_sha256']==PARENT_SHA and intent['phase']=='revert'and intent['manifest_sha256']==op.MANIFEST and intent['site_target_sha256']==B_SHA,'revert_lineage_changed')
  require((WORK/'compiled-site.conf').read_bytes()==compiled and (WORK/'original-site.conf').read_bytes()==original and json.loads((WORK/'baseline.json').read_bytes())==stable(before),'backend_or_backup_changed_before_restore')
  # A failed B postcheck never authorizes bypassing current backend guards.
  # Restore can proceed from exact B even when the prior receipt is failed.
  desired=compiled
 report.update(status='operation_failed',site_target_sha256=sha(desired))
 write_once(WORK/(a.phase+'-intent.json'),encoded(report))
 try:
  if current!=desired or a.phase=='restore':
   op.replace_site(desired)
   try:op.command(['nginx','-t'])
   except Exception:
    op.replace_site(current);op.command(['nginx','-t']);report['invalid_config_restored_before_reload']=True;raise
   op.command(['systemctl','reload','nginx']);report['nginx_reload_commands']=1
  else:report['nginx_reload_commands']=0
  report['HTTP']=op.verify_http(package,desired==compiled);api(op);after=op.snapshot()
  require(stable(after)==stable(before)and op.SITE.read_bytes()==desired,'postconditions_changed')
  report.update(status='reverted_B_verified'if a.phase=='revert'else'restored_A_verified',after=after)
 except Exception as error:
  code=str(error);report['error_code']=code if isinstance(error,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',code)else'private_dependency_or_protocol_failure'
  report['observed_disk_config_sha256']=sha(op.SITE.read_bytes())
 finally:write_once(WORK/(a.phase+'-receipt.json'),encoded(report))
 return report
def run(a):
 require(sys.platform=='linux'and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
 private(Path(__file__).resolve());require(sha(Path(__file__).resolve().read_bytes())==a.operator_sha256,'operator_changed')
 info=WORK.lstat();require(WORK.resolve()==WORK and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'private_work_required')
 if not a.execute:return phase(a)
 import fcntl
 fd=os.open(WORK/'.phase.lock',os.O_WRONLY|os.O_CREAT|os.O_NOFOLLOW,0o600)
 try:
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);return phase(a)
 finally:os.close(fd)
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--operator-sha256',required=True);p.add_argument('--phase',choices=('preflight','revert','restore'),required=True);p.add_argument('--execute',action='store_true');a=p.parse_args()
 try:
  result=run(a);print(json.dumps(result))
  if result['status']=='operation_failed':sys.exit(1)
 except Exception as error:
  code=str(error);print(json.dumps({'schema':'nodia-ai-ai40-client-nginx-roundtrip-v1','status':'operation_failed','phase':a.phase,'code':code if isinstance(error,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',code)else'private_dependency_or_protocol_failure','no_automatic_retry':True,'private_details_emitted':False}));sys.exit(1)
