"""Read-only C05 live-category evidence, bound to the actual R09 continuation.

No inference, confirmation, native ACK, domain write or service operation.
The native phase observes existing acknowledged records with the unchanged
reader, adapting only its release coordinates after verifying runtime parity.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess
import sys

ROOT = Path('/opt/nodia/verification/ai36-c05-crud-ui-inspect-r01')
CONTINUE = Path('/opt/nodia/verification/ai36-c05-publication-continue-r09-r02/nodia-ai-ai36-c05-publication-continue-r09-r02.py')
CONTINUE_SHA = 'b1881202ce745d3bf2fc45bd736ef9a4fe6f3af782de90172a2348719c65a3e5'
READY_SHA = '2aead759366bfc4522e5b76db6484adbe541eb6214caca49fe8228daacebeef8'
SCHEMA_SHA = 'c8c2a35b5b1287c32f12ceb92322af0f084df801a6fc0916527fe048aad3f897'
CHAT = 'c17fc842-1148-4bc5-b752-288cec2d35ff'
MARKER = 'AI36-C05-CRUD-UI-R01'
NATIVE = Path('/opt/nodia/verification/ai40-r08-completed-native-ack-r01/nodia-ai-ai40-r08-completed-native-ack-r01.mjs')
NATIVE_SHA = '08f8c2d725d6e39d806dee2f03521e46cf38912bd7452752c4fa46ef2c275988'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pinned(path, pin, mode=0o600):
    info = path.lstat()
    assert path.resolve() == path and stat.S_ISREG(info.st_mode)
    assert info.st_uid == 0 and info.st_nlink == 1
    assert stat.S_IMODE(info.st_mode) == mode
    raw = path.read_bytes()
    assert sha(raw) == pin
    return raw


def load(path, pin, name):
    raw = pinned(path, pin)
    spec = importlib.util.spec_from_loader(name, loader=None)
    module = importlib.util.module_from_spec(spec)
    module.__file__ = str(path)
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


QUERY = r"""
const {createHash:c05Hash}=await import('node:crypto');
const {isDeepStrictEqual:c05Equal}=await import('node:util');
const {readFile:c05Read}=await import('node:fs/promises');
const {createRequire:c05Require}=await import('node:module');
const c05Root='/opt/nodia/releases/nodia-server-ai36-c05-r09';
const c05Sha=x=>c05Hash('sha256').update(x).digest('hex');
const c05Assert=(x,code)=>{if(!x)throw Error(code);};
const {NodiaAiAuthorizationService}=await import(c05Root+'/dist/nodia-ai/nodia-ai-authorization.service.js');
const {AuthorizeNodiaAiUseCase}=await import(c05Root+'/dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js');
try {
 await db.initialize();
 const out=await db.transaction('REPEATABLE READ',async m=>{
  await m.query('SET TRANSACTION READ ONLY');
  const chat='c17fc842-1148-4bc5-b752-288cec2d35ff',owner='1',marker='AI36-C05-CRUD-UI-R01';
  const [own]=await m.query('SELECT owner_id::text,lifecycle,expires_at>clock_timestamp() unexpired,active_job_id FROM nodia_ai_conversations WHERE id=$1',[chat]);
  c05Assert(own?.owner_id===owner&&own.lifecycle==='active'&&own.unexpired,'own_chat_invalid');
  const grants=await m.query('SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2',['8e4c0db1-6b07-4524-a1cf-f33d09210766','ec626b72-1f32-4486-9f3a-8263cffce267',owner]);
  c05Assert(grants.length===1,'exact_authority_missing');
  const actor=await new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db)).execute({userId:owner,sessionId:grants[0].session_public_id},{moduleRoutes:['/tools/nodia-ai','/tools/finances-personal']},m);
  c05Assert(actor.actorId===owner,'authority_invalid');
  const runs=await m.query("SELECT r.id,r.state,r.selection_snapshot,r.assistant_message_id,r.provider_dispatches_used,r.tool_calls_used,r.mcp_rpc_messages_used,r.error_code,u.seq::text user_seq FROM nodia_ai_runs r JOIN nodia_ai_messages u ON u.id=r.user_message_id WHERE r.conversation_id=$1 AND r.actor_id=$2 AND u.author_id=$2 AND u.role='user' AND EXISTS(SELECT 1 FROM nodia_ai_message_parts p WHERE p.message_id=u.id AND p.kind='text' AND p.part_index=0 AND left(p.text,length($3))=$3 AND substring(p.text,length($3)+1,1) IN (E'\\n','.',' ')) LIMIT 2",[chat,owner,marker]);
  c05Assert(runs.length===1,'exact_run_not_unique');const run=runs[0];
  c05Assert(run.state==='completed'&&run.assistant_message_id!==null,'run_not_completed');
  const manifest=JSON.parse(await c05Read(c05Root+'/dist/nodia-ai/knowledge/manifest.json'));
  c05Assert(manifest.release_id==='6763cef6423d2cc511844351a384358e0e5141e4f597d19a291a5cf1feeb3c73'&&manifest.capability_contracts.length===150,'publication_invalid');
  const req=c05Require(c05Root+'/package.json'),{Ajv2020}=req('ajv/dist/2020.js'),ajv=new Ajv2020({strict:true});req('ajv-formats')(ajv);
  const generated=await c05Read('/opt/nodia/verification/ai36-c05-crud-ui-inspect-r01/public-finance-write.schema.json');
  c05Assert(c05Sha(generated)==='c8c2a35b5b1287c32f12ceb92322af0f084df801a6fc0916527fe048aad3f897','published_schema_changed');
  const schemas=new Map();const receiptChecks=[];
  const calls=await m.query('SELECT id,tool_name,state,arguments,public_result,contract_hash,arguments_hash FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 17',[run.id,chat]);
  c05Assert(calls.length>0&&calls.length<=16,'tool_count_invalid');
  for(const call of calls){
   c05Assert(call.state==='completed','tool_not_completed');
   if(call.tool_name==='nodia_capabilities_select'){receiptChecks.push({id:call.id,tool_name:call.tool_name,contract_hash:call.contract_hash,arguments_hash:call.arguments_hash,result_json_sha256:c05Sha(JSON.stringify(call.public_result)),schema_validation:'technical_selection_observed_separately'});continue;}
   const caps=manifest.capability_contracts.filter(c=>c.capability_id===call.tool_name);c05Assert(caps.length===1,'tool_not_published');const cap=caps[0];
   const flags=[];
   for(const direction of ['input','output']){
    const ref=cap[direction+'_schema'];let schema=schemas.get(ref.sha256);
    if(!schema){const raw=ref.path==='docs/evidence/nodia-ai-ai36-c05-publication-write-finance-business.schema.json'?generated:await c05Read(c05Root+'/'+ref.path.replace(/^nodia-server\//u,''));c05Assert(c05Sha(raw)===ref.sha256,'schema_pin_invalid');schema=JSON.parse(raw);ajv.addSchema(schema);schemas.set(ref.sha256,schema);}
    const validate=ajv.compile({$ref:schema.$id+'#/$defs/'+ref.definition});c05Assert(validate(direction==='input'?call.arguments:call.public_result),'receipt_schema_invalid');flags.push(true);
   }
   receiptChecks.push({id:call.id,tool_name:call.tool_name,contract_hash:call.contract_hash,arguments_hash:call.arguments_hash,arguments_json_sha256:c05Sha(JSON.stringify(call.arguments)),result_json_sha256:c05Sha(JSON.stringify(call.public_result)),input_schema_valid:flags[0],output_schema_valid:flags[1]});
  }
  const preps=calls.filter(c=>c.tool_name==='nodia_finance_categories_prepare_create');c05Assert(preps.length===1,'one_prepare_required');const prep=preps[0];
  c05Assert(c05Equal(prep.arguments,{partial:{...(Object.hasOwn(prep.arguments.partial,'owner_id')?{owner_id:owner}:{}),name:'AI36 C05 validación CRUD',key:'ai36_c05_crud_validacion_r01',is_active:true}}),'prepare_arguments_changed');
  const publicProposal=prep.public_result.proposal;c05Assert(prep.public_result.status==='ready'&&publicProposal?.state==='ready','proposal_not_ready');
  const gets=calls.filter(c=>c.tool_name==='nodia_proposals_get');c05Assert(gets.length>=1&&gets.every(c=>c05Equal(c.arguments,{proposal_id:publicProposal.proposal_id})&&c05Equal(c.public_result,publicProposal)),'proposal_get_mismatch');
  const [proposal]=await m.query('SELECT p.actor_id::text,p.conversation_id,p.current_revision,r.hash,r.state,r.expires_at,r.expires_at>clock_timestamp() unexpired FROM nodia_ai_proposals p JOIN nodia_ai_proposal_revisions r ON r.proposal_id=p.id AND r.revision=$2 WHERE p.id=$1',[publicProposal.proposal_id,publicProposal.revision]);
  c05Assert(proposal?.actor_id===owner&&proposal.conversation_id===chat&&proposal.hash===publicProposal.hash&&['ready','confirmed'].includes(proposal.state),'current_proposal_invalid');
  const steps=await m.query('SELECT id,tool_name,scope,command_template,preconditions,public_step FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=$2 ORDER BY position',[publicProposal.proposal_id,publicProposal.revision]);
  c05Assert(steps.length===1,'one_step_required');const step=steps[0];
  c05Assert(step.tool_name===prep.tool_name&&step.scope.subject_user_id===owner&&step.command_template.owner_id===owner&&c05Equal(step.command_template.command,prep.arguments.partial)&&step.preconditions.target===null,'step_scope_or_command_invalid');
  const [guard]=await m.query("SELECT (SELECT count(*)::int FROM finance_categories WHERE user_id=$1 AND key=$2) marker_categories,(SELECT count(*)::int FROM nodia_ai_executions WHERE proposal_id=$3) proposal_executions,(SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$4) original_messages,(SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$4) original_runs,(SELECT coalesce(sum(provider_dispatches_used),0)::int FROM nodia_ai_runs WHERE conversation_id=$4) original_dispatches,(SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance_sha256,(SELECT encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') FROM nodia_ai_preferences p WHERE id='04f8a72d-2fab-4c48-b7e1-e15e95d70bec' AND owner_id=$1) preference_sha256",[owner,'ai36_c05_crud_validacion_r01',publicProposal.proposal_id,'ec626b72-1f32-4486-9f3a-8263cffce267']);
  c05Assert(guard.original_messages===64&&guard.original_runs===34&&guard.original_dispatches===51&&guard.finance_sha256==='5335e312c7b542552f924cf266fc007ff1a3691e522e6c682bb20e374b5b7871'&&guard.preference_sha256==='711cd7844676b8ae7e427c8af60a8f846b3050a8ca7847c1b62ae20ee390d98b','protected_state_changed');
  const attempts=await m.query('SELECT a.id attempt_id,a.job_id,a.fence::text job_fence,a.runtime_fence::text,a.stage_key,a.stage_seq,a.phase,a.ended_at IS NOT NULL ended,a.external_operation_ref FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND j.conversation_id=$2 AND a.runtime_fence IS NOT NULL ORDER BY a.started_at,a.id LIMIT 5',[run.id,chat]);
  c05Assert(attempts.length>0&&attempts.length<=4&&attempts.every(a=>a.phase==='completed'&&a.ended&&a.external_operation_ref===a.attempt_id),'native_SQL_not_terminal');
  const effects=await m.query('SELECT e.id,e.state,e.revision,e.proposal_id,e.origin_proposal_revision,e.proposal_hash,e.actor_id::text,e.chat_owner_id::text,e.conversation_id,e.origin_conversation_id,s.source_step_id,s.state step_state,s.tool_name,s.minimal_receipt FROM nodia_ai_executions e JOIN nodia_ai_execution_steps s ON s.execution_id=e.id WHERE e.proposal_id=$1 AND e.proposal_hash=$2 ORDER BY e.created_at,s.position LIMIT 3',[publicProposal.proposal_id,publicProposal.hash]);
  const categories=await m.query('SELECT id::text,user_id::text,key,name,is_active FROM finance_categories WHERE user_id=$1 AND id=$2 LIMIT 2',[owner,effects[0]?.minimal_receipt?.resource_id??'0']);
  const [challenge]=await m.query('SELECT count(*)::int total,count(*) FILTER(WHERE consumed_at IS NOT NULL)::int consumed FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1 AND proposal_revision=$2',[publicProposal.proposal_id,publicProposal.revision]);
  if(proposal.state==='confirmed'){
   c05Assert(effects.length===1&&effects[0].state==='completed'&&effects[0].step_state==='completed'&&effects[0].source_step_id===step.id&&effects[0].actor_id===owner&&effects[0].chat_owner_id===owner&&effects[0].conversation_id===chat&&effects[0].origin_conversation_id===chat&&guard.proposal_executions===1&&challenge.total===1&&challenge.consumed===1,'confirmed_effect_invalid');
   const receipt=effects[0].minimal_receipt;const validateReceipt=ajv.compile({$ref:JSON.parse(generated).$id+'#/$defs/FinancialEffectReceipt'});c05Assert(validateReceipt(receipt)&&/^[1-9][0-9]*$/u.test(receipt.resource_id)&&c05Equal(receipt,{schema_version:1,resource_key:'finance_categories',operation:'create',resource_id:receipt.resource_id,subject_user_id:owner}),'effect_receipt_invalid');
  }else c05Assert(effects.length===0&&guard.proposal_executions===0&&guard.marker_categories===0,'unexpected_preconfirmation_effect');
  const [pending]=await m.query("SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE run_id=$1 AND state IN ('queued','leased','waiting')) jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 AND a.ended_at IS NULL) attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE job_id IN(SELECT id FROM nodia_ai_jobs WHERE run_id=$1)) slots",[run.id]);
  c05Assert(pending.jobs===0&&pending.attempts===0&&pending.slots===0,'active_work_remaining');
  return {checks:{current_authority:true,actual_publication_150:true,exact_marker_completed_run:true,all_receipt_schemas_valid:true,exact_prepare_arguments:true,public_get_matches_preparation:true,one_ready_scoped_step:true,current_proposal_state_observed:true,original_AI40_unchanged:true,native_SQL_terminal:true,pending_zero:true},conversation_id:chat,run,proposal:{id:publicProposal.proposal_id,revision:publicProposal.revision,hash:publicProposal.hash,expires_at:proposal.expires_at},draft_id:prep.public_result.draft_id,receipts:receiptChecks,step:{id:step.id,tool_name:step.tool_name,scope:step.scope,command_sha256:c05Sha(JSON.stringify(step.command_template)),review_sha256:c05Sha(JSON.stringify(step.public_step))},protected:guard,pending,conversation_active_job_present:own.active_job_id!==null,current_effect:{executions:effects,current_resource:{observed_present:categories.length===1,rows:categories},challenge},current_proposal_state:proposal.state,pre_human_evidence:{immutable_preparation_was_ready:publicProposal.state==='ready',immutable_target_absent:step.preconditions.target===null,contemporaneous_zero_effect_SQL_captured:false},native_attempts:attempts};
 });
 console.log(JSON.stringify({schema:'nodia-ai-ai36-c05-crud-ui-inspection-v1',status:'proposal_receipts_verified_read_only',...out,SQL_writes:0,SDK_requests:0,confirmation_requests:0,raw_messages_emitted:false}));
} finally {if(db.isInitialized)await db.destroy();}
"""


def main(args):
    assert sys.platform == 'linux' and os.getuid() == 0
    sys.dont_write_bytecode = True
    pinned(Path(__file__).resolve(), args.operator_sha256)
    c = load(CONTINUE, CONTINUE_SHA, 'actual_r09_continuation')
    p = c.parent_module()
    base = p.load(p.UTILITY, p.UTILITY_SHA, 'immutable_inventory')
    p.publication_guard(base)
    a = p.load(p.ACTIVATION, p.ACTIVATION_SHA, 'actual_consumers')
    a.RELEASE = p.NEW
    ready = json.loads(pinned(CONTINUE.parent / 'continue-after.json', READY_SHA))
    assert ready['status'] == 'continuation_completed'
    before = a.active_new_processes()
    assert before == ready['post_consumers']
    h = p.load(Path('/opt/nodia/verification/ai40-image-operator-r01/nodia-ai-ai40-image-operator-r03.py'),
               '1996130038b546458ddd7f608ea23d690cc094ef8c7b5009c98d711356cfe957',
               'pinned_readonly_private_transport', mode=0o644)
    h.ACTIVE = p.NEW
    h.validate_candidate('df107764de9b1b53830263ac380d0e56ce9e38ef09cea5042f82a3be00f4bb2b')
    if args.phase == 'prepared':
        pinned(ROOT / 'public-finance-write.schema.json', SCHEMA_SHA)
        selected = h.selected_environment(before['nodia-api']['pid'], {'DOTENV_CONFIG_PATH', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_SSL'})
        prefix = (h.CANDIDATE.parent / 'public-canary-input.mjs').read_text().split('try {', 1)[0]
        child = h.command(['/usr/local/bin/node', '--input-type=module', '-e', prefix + QUERY], cwd=p.NEW,
                          env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', **selected}, timeout=30)
    else:
        descriptor = json.loads(sys.stdin.buffer.read(8193))
        assert descriptor['conversation_id'] == CHAT
        raw = pinned(NATIVE, NATIVE_SHA).decode()
        old = "const ROOT='/opt/nodia/releases/nodia-server-ai40-r08',PROFILE='/var/lib/nodia/codex';"
        old_manifest = "const MANIFEST='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc';"
        assert raw.count(old) == raw.count(old_manifest) == 1
        raw = raw.replace(old, "const ROOT='" + str(p.NEW) + "',PROFILE='/var/lib/nodia/codex';")
        raw = raw.replace(old_manifest, "const MANIFEST='" + p.NEW_SHA + "';")
        user = pwd.getpwnam('nodia')
        assert user.pw_uid == 10000
        child = subprocess.run(['/usr/sbin/runuser', '--preserve-environment', '-u', 'nodia', '--', '/usr/local/bin/node', '--input-type=module', '-e', raw],
                               cwd=p.NEW, input=json.dumps(descriptor).encode(), capture_output=True, timeout=30, check=False,
                               env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': user.pw_dir, 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'})
    assert len(child.stdout) <= 65536
    result = json.loads(child.stdout) if child.stdout else None
    assert a.active_new_processes() == before
    report = {'schema': 'nodia-ai-ai36-c05-crud-ui-operator-v1', 'phase': args.phase,
              'status': result.get('status') if result else 'read_only_child_failed',
              'inspection': result, 'child_exit_code': child.returncode,
              'private_stderr_bytes': len(child.stderr), 'private_stderr_emitted': False,
              'operator_sha256': args.operator_sha256, 'ready_file_sha256': READY_SHA,
              'release_manifest_sha256': p.NEW_SHA, 'consumers': before,
              'SQL_writes': 0, 'SDK_requests': 0, 'native_ACK_requests': 0}
    print(json.dumps(report))
    return child.returncode


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--phase', choices=('prepared', 'native'), required=True)
    try:
        sys.exit(main(parser.parse_args()))
    except Exception as error:
        print(json.dumps({'schema': 'nodia-ai-ai36-c05-crud-ui-operator-v1', 'status': 'inspection_failed',
                          'error_class': type(error).__name__, 'SQL_writes': 0, 'SDK_requests': 0,
                          'native_ACK_requests': 0, 'private_details_emitted': False}))
        sys.exit(1)
