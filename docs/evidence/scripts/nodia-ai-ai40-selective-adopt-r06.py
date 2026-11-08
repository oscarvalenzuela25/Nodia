"""Exact selective R05 -> R06 transition using immutable deployment guards.

Knowledge/configuration/publication remain byte-exact R05. Technical fingerprint
changes in exactly runtime + adapter; missing acceptance proofs are never copied.
"""
import argparse
import hashlib
import importlib.util
import json
import stat
from pathlib import Path
import re
import subprocess
import sys

R04=Path('/opt/nodia/verification/ai40-r04-operator-r01/nodia-ai-ai40-image-adopt-r04-r02.py')
R04_SHA='b2701d4d052f0e335589828153cecb21d955afd49b5da82bac4f006ddbfa72ae'
R05=Path('/opt/nodia/verification/ai40-r05-operator-r01/nodia-ai-ai40-successor-adopt-r05.py')
R05_SHA='2a0db14d093456a49a7c35a7516f754dbca3fd8ce64832b36b2034369423ea87'
OLD=Path('/opt/nodia/releases/nodia-server-ai40-r05')
NEW=Path('/opt/nodia/releases/nodia-server-ai40-r06')
OLD_SHA='07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'
NEW_SHA='5aa5b74dd43cfbc61615f766ba8e17dd12bb3c8bb0a695bd85fc68c6d519c2bd'
KNOWLEDGE='5c83848c6eb1a6ce77fa63ad9de38f4dea556f260b6a9646cfceaaf4850db994'
PLAN_SHA='5a6d2d03f565eceef5eadfb117d19b6d763fc93569227e0ff000770bd553cc75'
WORK=Path('/opt/nodia/verification/ai40-selective-adopt-r06')
EXPECTED_DELTA=[{'path': 'dist/common/ai/codex/codex-chat-runtime.js', 'old_sha256': 'fe5079d732d86389c5be8f2f561bb818eea0ef9fd484d52dbb6807cdbc2f9c70', 'sha256': 'f7267fa6c4b83dea7f0b5093c01a5d5b384503fcc0770f142262dc2704e2c41c'}, {'path': 'dist/common/ai/codex/codex-chat-runtime.js.map', 'old_sha256': 'b103285b99f53a1e7a3f6b27622b045a9a211324133d87d4e399daeae63ff76b', 'sha256': 'b2c52a87059730ad4091928685add97d4d1ff8d2e711d0924e903274923105c9'}, {'path': 'dist/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.js', 'old_sha256': 'e1bbe06a47cbf2b0228f4782f1e39dde37bf483b7a8bc27f3ad1f5ddd8fa316f', 'sha256': 'cc0cacf93e86ffb131669700334b52d684958e30a449c504c30dd4a643499c3c'}, {'path': 'dist/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.js.map', 'old_sha256': '2623d69cd4e1ee8141061b48b349e3842878e4a8a41f357241909602f5cf1e73', 'sha256': 'cdf30b8f177293290f98aaa29cfca8beba78165f724ff2f3e54fec9446d0e8c8'}, {'path': 'dist/nodia-ai-context/use-case/build-nodia-ai-compaction.use-case.d.ts', 'old_sha256': '97d7cf59db279d85420c70b3ba7addd8d5687aa2b3dbf2ca2af4ea99ca155d44', 'sha256': 'e31138f930a82eddc1a2d659e05b7c679d90a18efa80e5845355b965881d0b53'}, {'path': 'dist/nodia-ai-context/use-case/build-nodia-ai-compaction.use-case.js', 'old_sha256': '523a8e5e9f46237fffb1910eceb3dc923860cbec6f01e63106071819d23f80dd', 'sha256': '040f7c146e83e4644b38acb13ae2c4d04bff6bc6926be8593b9d005c21c16151'}, {'path': 'dist/nodia-ai-context/use-case/build-nodia-ai-compaction.use-case.js.map', 'old_sha256': '33ade4a7a9fbcb0425a028e1f7b51e87bad90b7879bed37bb0ebbb2c65336995', 'sha256': '3592f862fefb887cf842eebeb684cbed1bb9c68c8713268f80b9afc80ef6fd0e'}, {'path': 'dist/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js', 'old_sha256': '8c6e9e724163bdd809714c1e117a91527638e68b2301b5e6879e514ec59bd94d', 'sha256': '721ae31413ce47b024dfc83890a1a18e451abd4456b94df028917fb6f38f2098'}, {'path': 'dist/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js.map', 'old_sha256': '9c3c055349d54ea13feff6a3d9a4e0426ecd9590f6d6dfa9cdc231ebf34efd94', 'sha256': '5340d24477374f995ca9d42bf4d5bdbc036ee8a3544009f99cebb22115348483'}, {'path': 'src/common/ai/codex/codex-chat-runtime.ts', 'old_sha256': 'c23e319bff20a8ecbb484bd482981f6c16d71091ac7a40a62919d4b4d809591a', 'sha256': '1193e72a44efe0f03eeea9579e4e8066348047185f1556f9c45cbae43f5e187a'}, {'path': 'src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts', 'old_sha256': 'c0f302b58df2f175ffd3b6586d3657699ac1163dc0f6b8cf89d4940fae6f05ba', 'sha256': '317ad121596317159cbaa0954bdfa20eea7035e311306b8f207a78f6088edb41'}, {'path': 'src/nodia-ai-context/use-case/build-nodia-ai-compaction.use-case.ts', 'old_sha256': 'f47bbcef2dc125af780c663fe7c4c658ea8fd4a5a61ad7df6863b9c34b358273', 'sha256': 'a04a0717faae9e26d673e1c42d2c72fdc150590a0fcf4cbe87942a82a5602183'}, {'path': 'src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts', 'old_sha256': '3fc0c3ee8a5464f76f5f0088fc6220d1d56179216c9caed4763be31cf1922c19', 'sha256': '2ce8f0661c25f0b8d48e59de8e3801f6180ecf8151c0d79397c5e167ad8d2965'}]

def require(value,code):
    if not value: raise ValueError(code)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path,pin,name):
    require(path.is_file() and not path.is_symlink() and sha(path)==pin,name+'_pin_mismatch')
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def proof_snapshot(allow_present, fingerprint):
    script=r'''
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [root,allow,fingerprint]=process.argv.slice(1);
const {CodexChatAcceptanceStore:Store}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-acceptance.js'));
const {CodexChatImageAcceptanceStore:Image}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-image-acceptance.js'));
const result={};let common=null;
for(const [name,mime] of [['nodia-chat-mcp',null],['nodia-chat-mcp-image-png','image/png'],['nodia-chat-mcp-image-jpeg','image/jpeg'],['nodia-chat-mcp-image-webp','image/webp']]){
 const file='/var/lib/nodia/codex/1/'+name;let info;try{info=lstatSync(file);}catch(e){if(e.code==='ENOENT'){result[name]={present:false};continue;}throw e;}
 assert.equal(allow,'true');assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.uid===10000&&(info.mode&0o777)===0o600&&info.size<=4096);
 const bytes=readFileSync(file);const value=(mime?new Image(mime):new Store()).decode(JSON.parse(bytes));
 assert.equal(value.scope.connectionId,'1');assert.equal(value.scope.runtimeFingerprint,fingerprint);
 if(common)assert.deepEqual(value.scope,common);else common=value.scope;
 result[name]={present:true,sha256:createHash('sha256').update(bytes).digest('hex'),scope:value.scope,verified_at:value.verifiedAt,terminal_proof_id:value.terminalProofId};
}
console.log(JSON.stringify(result));
'''
    r=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',script,str(OLD),'true' if allow_present else 'false',fingerprint],capture_output=True,timeout=20,check=False)
    require(r.returncode==0 and len(r.stdout)<16384,'acceptance_snapshot_not_safe');return json.loads(r.stdout)


def completed_initial_rollback(operator_sha):
    work=Path('/opt/nodia/verification/ai40-selective-adopt-r06')
    require(not (work/'rollback-failure.json').exists(),'prior_rollback_failed')
    values=[]
    for name in ('adopt-after.json','rollback-after.json'):
        path=work/name;info=path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600,'prior_cycle_receipt_identity_changed')
        v=json.loads(path.read_bytes())
        phase='adopt' if name.startswith('adopt') else 'rollback'
        require(v.get('operator_wrapper_sha256')==operator_sha and v.get('plan_sha256')==PLAN_SHA and v.get('phase')==phase and v.get('status')==phase+'_completed','prior_cycle_receipt_invalid')
        require(v.get('source')==str(OLD if phase=='adopt' else NEW) and v.get('target')==str(NEW if phase=='adopt' else OLD) and v.get('old_manifest_sha256')==OLD_SHA and v.get('new_manifest_sha256')==NEW_SHA,'prior_cycle_direction_changed')
        require(v.get('timers_restored') is True and v.get('journal_era_preserved') is True and v.get('journal_bootstrap_or_close') is False and v.get('knowledge_release')==KNOWLEDGE,'prior_cycle_invariant_changed')
        require(all(type(v.get(k)) is int and v[k]==0 for k in ('migrations','SQL_restores','configured_SQL_writes','provider_requests','business_effects')) and v.get('new_publication') is False,'prior_cycle_side_effect_changed')
        require(all(p=={'present':False} for p in v.get('acceptance_proofs',{}).values()) and len(v.get('acceptance_proofs',{}))==4,'prior_cycle_acceptance_not_empty')
        values.append({'path':str(path),'sha256':sha(path),'phase':phase,'status':v['status']})
    return {'work':str(work),'completed_initial_cycle':values,'successor_final_cycle_not_replayed':True}

def delta_guard():
    old,new=(json.loads((p/'release-manifest.json').read_bytes()) for p in (OLD,NEW))
    require(set(old['files'])==set(new['files']),'successor_inventory_changed')
    actual=[{'path':n,'old_sha256':old['files'][n],'sha256':new['files'][n]} for n in old['files'] if old['files'][n]!=new['files'][n]]
    require(actual==EXPECTED_DELTA,'selective_delta_changed')
    require(old['knowledge_release']==new['knowledge_release']==KNOWLEDGE,'knowledge_release_changed')
    return {'files':len(old['files']),'changed_files':len(actual),'delta':actual,'knowledge_assets_preserved_exactly':True,'unaccepted_audio_not_ported':True}

def scope_guard():
    script=r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const roots=process.argv.slice(1);createRequire(roots[0]+'/package.json')('reflect-metadata');
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const executable='/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex';
assert.equal(sha(readFileSync(executable)),'9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c');assert.equal(process.version,'v24.20.0');
const boundaries=['common/ai/codex/codex-chat-runtime','common/ai/codex/codex-chat-images','common/ai/codex/codex-chat-image-acceptance','common/ai/codex/codex-chat-acceptance','common/ai/codex/codex-chat-journal','common/ai/codex/codex-contract','common/ai/codex/codex-rpc','common/ai/codex/codex-runtime.service','common/ai/codex/codex-process-ownership','ai-provider/use-case/codex-chat-tool-channel.use-case','nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case'];
const values=[];for(const root of roots){
 const raw=readFileSync(root+'/dist/nodia-ai-runtime/config/runtime-policy.json');
 const {ValidateNodiaAiRuntimePolicyUseCase:Validate}=await import(pathToFileURL(root+'/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js'));
 const policy=new Validate().execute(JSON.parse(raw));
 const {codexChatRuntimeFingerprint:fingerprint}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-acceptance.js'));
 values.push({root,boundaries:Object.fromEntries(boundaries.map(p=>[p,sha(readFileSync(root+'/dist/'+p+'.js'))])),policy_asset_sha256:sha(raw),validated_policy_sha256:sha(JSON.stringify(canonical(policy))),runtime_fingerprint:sha(await fingerprint(executable)+JSON.stringify(canonical(policy)))});
}
assert.equal(values[0].runtime_fingerprint,'51a284da7f892943e9101d08af7513f405b81034c7b85f7c05517d0daab82543');assert.notEqual(values[0].runtime_fingerprint,values[1].runtime_fingerprint);
assert.deepEqual(boundaries.filter(p=>values[0].boundaries[p]!==values[1].boundaries[p]),['common/ai/codex/codex-chat-runtime','nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case']);
assert.equal(values[0].policy_asset_sha256,values[1].policy_asset_sha256);assert.equal(values[0].validated_policy_sha256,values[1].validated_policy_sha256);
console.log(JSON.stringify({source:values[0],target:values[1],node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,native_binary_sha256:sha(readFileSync(executable)),provider_observations:0,provider_generations:0}));
'''
    r=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',script,str(OLD),str(NEW)],capture_output=True,timeout=30,check=False)
    require(r.returncode==0 and len(r.stdout)<16384,'account_free_scope_check_failed');return json.loads(r.stdout)

def run(args):
    require(sha(Path(__file__).resolve())==args.operator_sha256 and args.plan_sha256==PLAN_SHA,'operator_or_plan_pin_mismatch')
    guard=load(R04,R04_SHA,'immutable_r04_guards');load(R05,R05_SHA,'immutable_r05_provenance')
    guard.OLD,guard.NEW=OLD,NEW;guard.OLD_MANIFEST,guard.NEW_MANIFEST=OLD_SHA,NEW_SHA;guard.OLD_KNOWLEDGE=guard.NEW_KNOWLEDGE=KNOWLEDGE
    knowledge={**guard.semantic_knowledge_guard(),'technical_release_changed':False};delta=delta_guard();proofs=None
    previous=load(guard.PRIOR,guard.PRIOR_SHA,'immutable_availability_guards')
    previous.OLD,previous.OLD_SHA,previous.OLD_KNOWLEDGE=OLD,OLD_SHA,KNOWLEDGE
    work=WORK if args.cycle=='initial' else Path('/opt/nodia/verification/ai40-selective-final-adopt-r06')
    previous.TARGET,previous.TARGET_SHA,previous.WORK,previous.PLAN_SHA=NEW,NEW_SHA,work,PLAN_SHA
    previous.PRIOR_WORK=Path('/opt/nodia/verification/ai40-predispatch-adopt-r05')
    previous.PRIOR_WRAPPER_SHA=R05_SHA;previous.PRIOR_PLAN_SHA='9277a411699b2870577b3863a71e24ee0ec1d3fab21b589a088b4aaf00688cfc'
    previous.PRIOR_SOURCE=Path('/opt/nodia/releases/nodia-server-ai40-r04');previous.PRIOR_SOURCE_SHA='188d4ca7d251d986862bc8c7edf5f267bc6746f3f2b38a0164fce1c085ae3ef0'
    if args.cycle=='final':
        previous.completed_prior_attempt=lambda:completed_initial_rollback(args.operator_sha256)
    previous.__file__=str(Path(__file__).resolve());inherited=previous.configure;scope=None
    def configure(base,phase):
        nonlocal scope,proofs
        base.manifest(OLD,OLD_SHA,KNOWLEDGE);base.manifest(NEW,NEW_SHA,KNOWLEDGE)
        scope=scope_guard();proofs=proof_snapshot(phase=='rollback',scope['target']['runtime_fingerprint']);configured=inherited(base,phase);original_load=configured.load_helper
        def load_helper():
            operator,helpers=original_load();original_freeze=operator.freeze
            def freeze(name,value):
                if name in ('adopt-after.json','rollback-after.json'):
                    require(scope_guard()==scope and proof_snapshot(phase=='rollback',scope['target']['runtime_fingerprint'])==proofs,'scope_or_acceptance_changed_during_transition')
                original_freeze(name,{**guard.effective_result(value),'technical_scope_transition':scope,'selective_delta':delta,'acceptance_proofs':proofs})
            operator.freeze=freeze;return operator,helpers
        configured.load_helper=load_helper;return configured
    previous.configure=configure
    result=previous.run(args)
    return {**guard.effective_result(result),'knowledge_semantics':knowledge,'selective_delta':delta,'technical_scope_transition':scope,'acceptance_proofs':proofs,'fresh_MCP_and_images_required':True}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=['preflight','adopt','rollback']);p.add_argument('--cycle',choices=['initial','final'],default='initial');p.add_argument('--base-driver',required=True);p.add_argument('--plan',required=True);p.add_argument('--plan-sha256',required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--execute',action='store_true')
    try:
        result=run(p.parse_args());print(json.dumps(result));sys.exit(0 if result.get('status') in ('preflight_passed_no_mutations','adopt_completed','rollback_completed') else 1)
    except Exception as error:
        text=str(error);print(json.dumps({'stage':'AI40-R06','status':'precondition_failed','error_class':type(error).__name__,'failure_code':text if re.fullmatch('[a-z][a-z0-9_]{1,95}',text) else None,'private_details_emitted':False,'generation_not_replayed':True}));sys.exit(1)
