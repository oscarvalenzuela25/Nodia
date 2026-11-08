"""Exact R07 -> R08 selective deployment; no inference or migration.

Retains the immutable deployment protocol, fresh encrypted backup, drain,
external deletion journal, timers and descriptor guards. The unchanged native
scope permits preserving current typed acceptances; none are copied or restored.
"""
import argparse,hashlib,importlib.util,json,re,sys
from pathlib import Path
R06=Path('/opt/nodia/verification/ai40-r06-operator-r01/nodia-ai-ai40-selective-adopt-r06.py')
R06_SHA='272c5d44a1a6774c6587c32448facebcecd7729fbd645f65a719ae4ce9920d98'
R07=Path('/opt/nodia/verification/ai40-r07-operator-r01/nodia-ai-ai40-selective-adopt-r07.py')
R07_SHA='4a2fd6d22845ffcb61c442a813d19ce6a8b2c84969a73112d0a3e3d05800398d'
OLD=Path('/opt/nodia/releases/nodia-server-ai40-r07')
NEW=Path('/opt/nodia/releases/nodia-server-ai40-r08')
OLD_SHA='1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
NEW_SHA='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
PLAN_SHA='ab88bfd04ce3cd6494e1a6c3f5b92129eed191ed970256809c77eaf5d8ab6441'
WORK=Path('/opt/nodia/verification/ai40-selective-adopt-r08')
PROOFS={'nodia-chat-mcp':'970510a8b38137e3168c74c8322bd33b90994659523977d492339cba6501cf0a',
'nodia-chat-mcp-image-png':'6f72f27340f46a397954b6a6e2b024fd117a617cfbe7cddd64ab429c6f030cc7',
'nodia-chat-mcp-image-jpeg':'7f196301cd8cc616f090d478622e59f4a0eb60d86b5400f2bb1e4e4decaefff5',
'nodia-chat-mcp-image-webp':'b33981d06c07e487c841a088c938446fb8920b00a646509e401fbe8beb08a35c'}
EXPECTED_DELTA=[{'path': 'dist/nodia-ai-conversation/dto/cancel-nodia-ai-run.dto.d.ts', 'old_sha256': None, 'sha256': 'b1d86f403674a6f486f8db4276333809437b39acf533759cfae911b82ff2cddc'}, {'path': 'dist/nodia-ai-conversation/dto/cancel-nodia-ai-run.dto.js', 'old_sha256': None, 'sha256': 'c982c7fa779046b0ccf0e6dd62b6ef38855c3e2bcf546ca217a4ba3a8b154d69'}, {'path': 'dist/nodia-ai-conversation/dto/cancel-nodia-ai-run.dto.js.map', 'old_sha256': None, 'sha256': '7f0e13cae83605198d7cca0e4c3f522e8c4e7661da4943c48c71d21fb64fcaa5'}, {'path': 'dist/nodia-ai-conversation/nodia-ai-conversation.module.js', 'old_sha256': '5a571598fe1b728b8f09aad9fd48d628cbaf0a9ae7cc253d770b3eb2d07b8f99', 'sha256': '9c530128b467464686646fb592958b81078104674252bb32e960b0bc8ee0ffb5'}, {'path': 'dist/nodia-ai-conversation/nodia-ai-conversation.module.js.map', 'old_sha256': 'd9845e1f0c3d2e2f030b978141d458850660e79fa44b9be7302de863a7c263a4', 'sha256': 'b9ca7729c21004069cca7da7b02564cd0345a27abe2903657586d6cd1dbb4882'}, {'path': 'dist/nodia-ai-conversation/nodia-ai-run-control.controller.d.ts', 'old_sha256': None, 'sha256': '5d258a2f4f33fd64b0a7d18c19c73d1d4f33eb41e4bc9f4bc1e83dee90ad8f0a'}, {'path': 'dist/nodia-ai-conversation/nodia-ai-run-control.controller.js', 'old_sha256': None, 'sha256': '563c34f97260240ca1d7b076152cdc7b5dc50acabef5feb1202846f123aaa74f'}, {'path': 'dist/nodia-ai-conversation/nodia-ai-run-control.controller.js.map', 'old_sha256': None, 'sha256': 'cdf4b53f589ff991bc7c5fb1fedb67c50ae5f002e1c7e741085ca48cd99251ff'}, {'path': 'dist/nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case.d.ts', 'old_sha256': None, 'sha256': 'ad1943415afe2303c79ca7492da934b1ba7f818ef6dadd87b8680f2d67bbe7e2'}, {'path': 'dist/nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case.js', 'old_sha256': None, 'sha256': 'be8388971e12d2356128de75a50b47acb42330f4d9f53dfa3220474ade8bf775'}, {'path': 'dist/nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case.js.map', 'old_sha256': None, 'sha256': '8e9eea1c4d509d76c4cf5ca596c6b1b5fcdfbb313453752f99c2fdb24149206d'}, {'path': 'dist/nodia-ai-observation/use-case/observe-nodia-ai-run.use-case.d.ts', 'old_sha256': '6653b1bf33c3ebd7c7b6619d79b816af42a36d2269d26b3c7fd2d0de73dd323d', 'sha256': 'd85f5588dbfc5a5945c4a00d678c040f84001250ef2276c1595a2f2613ea3583'}, {'path': 'dist/nodia-ai-observation/use-case/observe-nodia-ai-run.use-case.js', 'old_sha256': '4915aa9fa90f51315dd0a08f35af2b988c4c5e232eccd47a6fa9ebf7af146c88', 'sha256': '8c3a32dbb773d4b84659dfad3c04336d10babb3d95b6e4545e04e5ce9c3be379'}, {'path': 'dist/nodia-ai-observation/use-case/observe-nodia-ai-run.use-case.js.map', 'old_sha256': '364f8661ebd4ae14b3435a390179c704faf6b4f28c17199d85ccc2cac0019b40', 'sha256': '1f9cc8b136235687c992ad3984db5acc72035021e8eed492b6da3459fa66b548'}, {'path': 'dist/nodia-ai-runtime/nodia-ai-runtime.service.js', 'old_sha256': '2c4e7d1a7313e6bd7c60a53e98085d5cba754ca88976b1f4bb47e48e489743b0', 'sha256': '273cdd6ca17a45349bbe76c2d7b9bc0b5ab0c68154c5c07de1dbcfd33478fd6b'}, {'path': 'src/nodia-ai-conversation/dto/cancel-nodia-ai-run.dto.ts', 'old_sha256': None, 'sha256': 'ef94494ae6b652bed0c05a8eedad33fa942c00b42dd9e0961a2415a456e2c751'}, {'path': 'src/nodia-ai-conversation/nodia-ai-conversation.module.ts', 'old_sha256': '7d832322830e5730df144c327ade2718737c601e52147ec85dc74e0332490e8e', 'sha256': '936f549e6bc86dd8cb28a80be13619a25eabaf533ab995aabd0924e048051859'}, {'path': 'src/nodia-ai-conversation/nodia-ai-run-control.controller.ts', 'old_sha256': None, 'sha256': '425165e56a18be2affb2b824ce773e906e7dfe2e2bb3065d05a5118ec631d38a'}, {'path': 'src/nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case.ts', 'old_sha256': None, 'sha256': 'cc15f279feec70ac80debf98afaaa9ab9ca1bda2ec51f2096ae235f53237ddb1'}, {'path': 'src/nodia-ai-observation/use-case/observe-nodia-ai-run.use-case.ts', 'old_sha256': '59c4f22d93511596c2cc05974cc7cbc3cb552b58400b70d45107e03aab62bf1e', 'sha256': 'cad6040ec6b992be53ce50c24268d1e5ca9a7eb70ac556a2179de1432d4d0b57'}, {'path': 'src/nodia-ai-runtime/nodia-ai-runtime.service.ts', 'old_sha256': 'e4e1510e3feb78027b0bc3d07656d68c060fbc8a74ef1e10cb60cb8f368fafc8', 'sha256': '5832e09fcdf9ac701a78256840b8b0b95732d6ed23752e9920dc315305962e07'}, {'path': 'test/nodia-ai-run-cancellation.integration.mjs', 'old_sha256': None, 'sha256': '8fad0092341dbebfdf0e52b7e7d195b245df4e016f7a323ecd5d6305dacfecd6'}]

def require(ok,code):
 if not ok:raise ValueError(code)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def run(args):
 require(sha(Path(__file__).resolve())==args.operator_sha256 and args.plan_sha256==PLAN_SHA,'source_or_plan_pin_mismatch')
 require(R06.is_file() and not R06.is_symlink() and sha(R06)==R06_SHA,'immutable_r06_driver_changed')
 spec=importlib.util.spec_from_file_location('immutable_r06_transition',R06);prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
 scope_module=prior.load(R07,R07_SHA,'immutable_r07_scope')
 scope_module.OLD,scope_module.NEW=OLD,NEW
 prior.OLD,prior.NEW,prior.OLD_SHA,prior.NEW_SHA=OLD,NEW,OLD_SHA,NEW_SHA
 prior.PLAN_SHA,prior.WORK=PLAN_SHA,WORK
 prior.__file__=str(Path(__file__).resolve())
 prior.scope_guard=scope_module.unchanged_scope
 original_proof=prior.proof_snapshot
 def proof_snapshot(_allow,fingerprint):
  # The pinned typed decoder still enforces owner/mode/native scope. Existing
  # proofs are valid for both releases only because every scope byte is equal.
  value=original_proof(True,fingerprint)
  if args.phase!='rollback':
   require(set(value)==set(PROOFS) and all(value[k].get('present')is True and value[k].get('sha256')==pin for k,pin in PROOFS.items()),'current_typed_acceptance_changed')
  return value
 prior.proof_snapshot=proof_snapshot
 def delta_guard():
  old,new=[json.loads((p/'release-manifest.json').read_bytes())for p in(OLD,NEW)]
  require(set(old['files']).issubset(new['files']),'source_inventory_removed')
  actual=[{'path':n,'old_sha256':old['files'].get(n),'sha256':new['files'][n]}for n in sorted(new['files'])if old['files'].get(n)!=new['files'][n]]
  require(actual==EXPECTED_DELTA and len(old['files'])==4069 and len(new['files'])==4082,'selective_delta_changed')
  require(old['knowledge_release']==new['knowledge_release']==prior.KNOWLEDGE,'knowledge_release_changed')
  return {'source_files':4069,'target_files':4082,'changed_files':len(actual),'delta':actual,'knowledge_assets_preserved_exactly':True,'unaccepted_audio_not_ported':True}
 prior.delta_guard=delta_guard
 original_load=prior.load
 def load(path,pin,name):
  module=original_load(path,pin,name)
  if name=='immutable_availability_guards':
   original_check=module.completed_prior_attempt
   def completed_r07_adoption():
    # Keep the original strict before/after receipt validator; only these
    # predecessor coordinates replace the historical R05 coordinates.
    module.PRIOR_WORK=Path('/opt/nodia/verification/ai40-selective-adopt-r07')
    module.PRIOR_WRAPPER_SHA=R07_SHA
    module.PRIOR_PLAN_SHA='e829082c4dd93322cdb9325721622a3787bbb72ff704caa2eed208fa279c005d'
    module.PRIOR_SOURCE=Path('/opt/nodia/releases/nodia-server-ai40-r06')
    module.PRIOR_SOURCE_SHA='5aa5b74dd43cfbc61615f766ba8e17dd12bb3c8bb0a695bd85fc68c6d519c2bd'
    return original_check()
   module.completed_prior_attempt=completed_r07_adoption
  return module
 prior.load=load
 args.cycle='initial'
 result=prior.run(args)
 return {**result,'technical_scope_changed':False,'native_runtime_changed':False,'fresh_MCP_and_images_required':False,'existing_acceptances_preserved_by_exact_scope':True,'migration_executed':False,'SDK_requests':0}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=['preflight','adopt','rollback']);p.add_argument('--base-driver',required=True);p.add_argument('--plan',required=True);p.add_argument('--plan-sha256',required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--execute',action='store_true')
 try:
  value=run(p.parse_args());print(json.dumps(value));sys.exit(0 if value.get('status')in('preflight_passed_no_mutations','adopt_completed','rollback_completed')else 1)
 except Exception as e:
  code=str(e);print(json.dumps({'stage':'AI40-R08','status':'precondition_failed','exception_class':type(e).__name__,'failure_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else None,'private_details_emitted':False,'no_replay':True}));sys.exit(1)
