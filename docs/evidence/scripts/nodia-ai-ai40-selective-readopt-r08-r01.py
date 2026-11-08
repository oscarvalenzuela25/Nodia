"""Exact R08 rollback preflight and fresh R07 -> R08 re-adoption lineage.

Mutation rollback uses the already reviewed c00bd driver and its unconsumed
rollback intention. This successor never reuses its consumed adoption work.
"""
import argparse,hashlib,importlib.util,json,re,stat,sys
from pathlib import Path
R08=Path('/opt/nodia/verification/ai40-r08-operator-r01/nodia-ai-ai40-selective-adopt-r08.py')
R08_SHA='c00bd83406208dfa8c78bf364c4d1214f74a1e98121f813003abd71182863710'
FORWARD_PLAN='ab88bfd04ce3cd6494e1a6c3f5b92129eed191ed970256809c77eaf5d8ab6441'
REVERSE_PLAN='e829082c4dd93322cdb9325721622a3787bbb72ff704caa2eed208fa279c005d'
WORK=Path('/opt/nodia/verification/ai40-selective-readopt-r08-r01')
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p,pin,name):
 require(p.is_file()and not p.is_symlink()and sha(p)==pin,'immutable_transition_source_changed')
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def run(a):
 require(sha(Path(__file__).resolve())==a.operator_sha256,'operator_source_changed');sys.dont_write_bytecode=True
 reverse=a.phase=='preflight-rollback';require(a.plan_sha256==(REVERSE_PLAN if reverse else FORWARD_PLAN),'direction_plan_changed')
 previous=load(R08,R08_SHA,'immutable_r08_coordinates');prior=load(previous.R06,previous.R06_SHA,'immutable_r06_protocol');scope=load(previous.R07,previous.R07_SHA,'immutable_unchanged_scope')
 old,new=(previous.NEW,previous.OLD)if reverse else(previous.OLD,previous.NEW)
 old_sha,new_sha=(previous.NEW_SHA,previous.OLD_SHA)if reverse else(previous.OLD_SHA,previous.NEW_SHA)
 prior.OLD,prior.NEW,prior.OLD_SHA,prior.NEW_SHA=old,new,old_sha,new_sha
 prior.PLAN_SHA,prior.WORK=a.plan_sha256,WORK;prior.__file__=str(Path(__file__).resolve())
 scope.OLD,scope.NEW=old,new;prior.scope_guard=scope.unchanged_scope
 original_snapshot=prior.proof_snapshot
 def proof_snapshot(_allow,fingerprint):
  value=original_snapshot(True,fingerprint)
  if a.phase!='rollback':require(len(value)==4 and all(v=={'present':False}for v in value.values()),'absent_acceptance_snapshot_changed')
  return value
 prior.proof_snapshot=proof_snapshot
 def delta_guard():
  manifests=[json.loads((p/'release-manifest.json').read_bytes())for p in(old,new)];o,n=[v['files']for v in manifests]
  expected=[{'path':v['path'],'old_sha256':v['sha256'],'sha256':v['old_sha256']}for v in previous.EXPECTED_DELTA]if reverse else previous.EXPECTED_DELTA
  actual=[{'path':k,'old_sha256':o.get(k),'sha256':n.get(k)}for k in sorted(set(o)|set(n))if o.get(k)!=n.get(k)]
  require(actual==expected and len(o)==(4082 if reverse else 4069)and len(n)==(4069 if reverse else 4082),'selective_transition_delta_changed')
  require(all(m['knowledge_release']==prior.KNOWLEDGE for m in manifests),'knowledge_release_changed')
  return {'source_files':len(o),'target_files':len(n),'changed_files':len(actual),'delta':actual,'knowledge_assets_preserved_exactly':True,'unaccepted_audio_not_ported':True}
 prior.delta_guard=delta_guard
 original_load=prior.load
 def checked_rollback():
  lineage=[]
  for name in('rollback-before.json','rollback-after.json'):
   p=previous.WORK/name;st=p.lstat();require(p.resolve()==p and stat.S_ISREG(st.st_mode)and st.st_uid==0 and st.st_nlink==1 and stat.S_IMODE(st.st_mode)==0o600,'rollback_receipt_identity_changed')
   v=json.loads(p.read_bytes());require(v.get('operator_wrapper_sha256')==R08_SHA and v.get('plan_sha256')==FORWARD_PLAN and v.get('phase')=='rollback','rollback_receipt_lineage_changed')
   require(v.get('source')==str(previous.NEW)and v.get('target')==str(previous.OLD)and v.get('old_manifest_sha256')==previous.OLD_SHA and v.get('new_manifest_sha256')==previous.NEW_SHA,'rollback_direction_changed')
   if name=='rollback-after.json':
    require(v.get('status')=='rollback_completed'and v.get('timers_restored')is True and v.get('journal_era_preserved')is True and v.get('journal_bootstrap_or_close')is False and v.get('knowledge_release')==prior.KNOWLEDGE,'rollback_not_completed')
    require(all(type(v.get(k))is int and v[k]==0 for k in('migrations','SQL_restores','configured_SQL_writes','provider_requests','business_effects'))and v.get('new_publication')is False,'rollback_side_effects_changed')
    require(len(v.get('acceptance_proofs',{}))==4 and all(x=={'present':False}for x in v['acceptance_proofs'].values()),'rollback_absence_not_preserved')
   lineage.append({'path':str(p),'sha256':sha(p)})
  require(not(previous.WORK/'rollback-failure.json').exists(),'failed_rollback_not_replayed')
  return {'work':str(previous.WORK),'status':'rollback_completed','receipts':lineage,'readoption_uses_fresh_work':True}
 def load_guard(path,pin,name):
  module=original_load(path,pin,name)
  if name=='immutable_availability_guards':
   original_check=module.completed_prior_attempt
   def lineage_check():
    if not reverse:return checked_rollback()
    module.PRIOR_WORK=previous.WORK;module.PRIOR_WRAPPER_SHA=R08_SHA;module.PRIOR_PLAN_SHA=FORWARD_PLAN
    module.PRIOR_SOURCE=previous.OLD;module.PRIOR_SOURCE_SHA=previous.OLD_SHA
    return original_check()
   module.completed_prior_attempt=lineage_check
  return module
 prior.load=load_guard
 if reverse:a.phase='preflight'
 a.cycle='initial';result=prior.run(a)
 return {**result,'schema':'nodia-ai-ai40-r08-roundtrip-transition-v1','read_only_reverse_preflight':reverse,'fresh_readoption_work':str(WORK),'technical_scope_changed':False,'native_runtime_changed':False,'fresh_MCP_and_images_required':True,'historical_proofs_restored':False}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=['preflight-rollback','preflight','adopt','rollback']);p.add_argument('--base-driver',required=True);p.add_argument('--plan',required=True);p.add_argument('--plan-sha256',required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--execute',action='store_true');a=p.parse_args()
 try:
  v=run(a);print(json.dumps(v));sys.exit(0 if v.get('status')in('preflight_passed_no_mutations','adopt_completed','rollback_completed')else 1)
 except Exception as e:
  code=str(e);print(json.dumps({'status':'precondition_failed','exception_class':type(e).__name__,'failure_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else None,'private_details_emitted':False,'no_replay':True}));sys.exit(1)
