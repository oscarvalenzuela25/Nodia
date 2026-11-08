// Exact native ACK inspection after a separately pinned product SQL receipt; no SDK or SQL.
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {open,readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const ROOT='/opt/nodia/releases/nodia-server-ai40-r07',PROFILE='/var/lib/nodia/codex';
const MANIFEST='1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const PROOFS={mcp:'970510a8b38137e3168c74c8322bd33b90994659523977d492339cba6501cf0a',
 'mcp-image-png':'6f72f27340f46a397954b6a6e2b024fd117a617cfbe7cddd64ab429c6f030cc7',
 'mcp-image-jpeg':'7f196301cd8cc616f090d478622e59f4a0eb60d86b5400f2bb1e4e4decaefff5',
 'mcp-image-webp':'b33981d06c07e487c841a088c938446fb8920b00a646509e401fbe8beb08a35c'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v);
const positive=v=>typeof v==='string'&&/^[1-9][0-9]{0,18}$/u.test(v)&&BigInt(v)<=9223372036854775807n;
export function validateProductAckInput(v){
 assert.ok(exact(v,['schema_version','conversation_id','expected_owner_id','run_id','job_id','sql_receipt_sha256','attempts']));
 assert.equal(v.schema_version,1);for(const k of['conversation_id','run_id','job_id'])assert.ok(uuid(v[k]));
 assert.ok(positive(v.expected_owner_id)&&typeof v.sql_receipt_sha256==='string'&&/^[a-f0-9]{64}$/u.test(v.sql_receipt_sha256));
 assert.ok(Array.isArray(v.attempts)&&v.attempts.length>0&&v.attempts.length<=4);const ids=new Set();
 for(const a of v.attempts){assert.ok(exact(a,['attempt_id','job_fence','runtime_fence','stage_key','stage_seq']));
  assert.ok(uuid(a.attempt_id)&&!ids.has(a.attempt_id));ids.add(a.attempt_id);
  assert.ok(positive(a.job_fence)&&positive(a.runtime_fence));assert.ok(['inference','delegated_inference'].includes(a.stage_key));
  assert.ok(Number.isSafeInteger(a.stage_seq)&&a.stage_seq>0&&a.stage_seq<=64);}
 return v;
}
async function privateBytes(path,max=4096){const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await f.stat();assert.ok(s.isFile()&&s.uid===10000&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size<=max);
  const b=await f.readFile();assert.equal(b.length,s.size);return b;}finally{await f.close();}}
async function proofSnapshot(){const result={};let scope;
 for(const [kind,pin]of Object.entries(PROOFS)){const b=await privateBytes(PROFILE+'/1/nodia-chat-'+kind);assert.equal(sha(b),pin);const p=JSON.parse(b);
  const keys=['version','scope','verifiedAt','terminalProofId','nonceSha256',...(kind==='mcp'?[]:['mediaType'])];
  assert.ok(exact(p,keys));assert.equal(p.version,1);assert.ok(uuid(p.terminalProofId)&&/^[a-f0-9]{64}$/u.test(p.nonceSha256));
  assert.ok(exact(p.scope,['connectionId','resourceKey','sessionGeneration','configurationGeneration','modelId','effortId','runtimeFingerprint']));
  assert.equal(p.scope.connectionId,'1');assert.match(p.scope.resourceKey,/^codex-profile:[a-f0-9]{64}$/u);
  assert.match(p.scope.sessionGeneration,/^[a-f0-9]{32}$/u);assert.match(p.scope.configurationGeneration,/^[a-f0-9]{64}$/u);
  assert.equal(p.scope.runtimeFingerprint,'1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a');
  assert.ok(typeof p.scope.modelId==='string'&&p.scope.modelId.trim()&&(p.scope.effortId===null||typeof p.scope.effortId==='string'));
  if(scope)assert.deepEqual(p.scope,scope);else scope=p.scope;
  if(kind!=='mcp')assert.equal(p.mediaType,{'mcp-image-png':'image/png','mcp-image-jpeg':'image/jpeg','mcp-image-webp':'image/webp'}[kind]);
  result[kind]={sha256:pin,terminal_proof_id:p.terminalProofId,scope:p.scope};}
 return result;
}
export async function inspectProductNativeAck(input){
 validateProductAckInput(input);assert.equal(process.platform,'linux');assert.equal(process.getuid(),10000);
 const bytes=await readFile(ROOT+'/release-manifest.json');assert.equal(sha(bytes),MANIFEST);const manifest=JSON.parse(bytes);
 for(const n of['codex-chat-journal','codex-process-ownership'])assert.equal(sha(await readFile(ROOT+'/dist/common/ai/codex/'+n+'.js')),manifest.files['dist/common/ai/codex/'+n+'.js']);
 const {CodexChatJournal}=await import(pathToFileURL(ROOT+'/dist/common/ai/codex/codex-chat-journal.js'));
 const {sameCodexProcess,assertCodexGroupEmpty}=await import(pathToFileURL(ROOT+'/dist/common/ai/codex/codex-process-ownership.js'));
 const before=await proofSnapshot(),scope=before.mcp.scope,session=await privateBytes(PROFILE+'/1/nodia-chat-session',32);assert.equal(session.toString(),scope.sessionGeneration);
 const records=[],journal=new CodexChatJournal();
 for(const witness of input.attempts){const raw=await privateBytes(PROFILE+'/chat-jobs/'+witness.attempt_id+'.json');const r=journal.decode(JSON.parse(raw));
  assert.deepEqual(r.identity,{engine:'agentic',attemptId:witness.attempt_id,resourceKey:scope.resourceKey,sessionGeneration:scope.sessionGeneration,
   operationRef:witness.attempt_id,adapterIdentity:{providerKey:'openai',contractVersion:'nodia-ai-codex-chat/1',connectionId:scope.connectionId}});
  assert.equal(r.state,'completed');assert.equal(r.acknowledged,true);assert.equal(r.cancelRequested,false);assert.equal(r.unforwardedRequests,0);assert.ok(r.native);
  assert.equal(await sameCodexProcess(r.native),false);await assertCodexGroupEmpty(r.native.group);const proof=journal.proof(r);
  assert.equal(proof.outcome,'completed');assert.equal(proof.processClosed,true);assert.equal(proof.terminalProofId,r.terminalProofId);
  const staging={};for(const dir of['nodia-chat-images','nodia-chat-audio']){let names=[];try{names=await readdir(PROFILE+'/1/'+dir);}catch(e){if(e.code!=='ENOENT')throw e;}
   assert.equal(names.length,0);const exists=await lstat(PROFILE+'/1/'+dir+'/'+witness.attempt_id).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});assert.equal(exists,false);staging[dir]={entries:0,attempt_directory_present:false};}
  records.push({supplied_SQL_witness:witness,record_sha256:sha(raw),identity:r.identity,state:r.state,acknowledged:r.acknowledged,
   terminal_proof_id:proof.terminalProofId,outcome:proof.outcome,process_closed:proof.processClosed,observed_at:proof.observedAt.toISOString(),
   native_process_same:false,owned_native_group_empty:true,owner_process_same:await sameCodexProcess(r.owner),rpc_count:r.rpcCount,unforwarded_requests:r.unforwardedRequests,staging});}
 const after=await proofSnapshot();assert.deepEqual(after,before);assert.deepEqual(await privateBytes(PROFILE+'/1/nodia-chat-session',32),session);
 return {schema:'nodia-ai-ai40-product-read-native-ack-v1',status:'passed',release_root:ROOT,release_manifest_sha256:MANIFEST,
  supplied_SQL_association:{conversation_id:input.conversation_id,expected_owner_id:input.expected_owner_id,run_id:input.run_id,job_id:input.job_id,receipt_sha256:input.sql_receipt_sha256},
  SQL_fences_source:'Supplied witness from the separately pinned SQL receipt; native journal does not contain run/job fences.',
  records,proofs:after,proofs_and_session_byte_exact:true,provider_requests:0,SDK_observations:0,SQL_reads:0,SQL_writes:0,
  profile_access_read_only:true,credentials_or_private_content_emitted:false};
}
async function main(){let phase='input_contract';try{let length=0;const chunks=[];for await(const b of process.stdin){length+=b.length;assert.ok(length<=8192);chunks.push(b);}
 const input=validateProductAckInput(JSON.parse(Buffer.concat(chunks)));phase='exact_native_readonly';console.log(JSON.stringify(await inspectProductNativeAck(input)));
 }catch(error){console.log(JSON.stringify({schema:'nodia-ai-ai40-product-read-native-ack-v1',status:'inspection_failed',failure_phase:phase,
  error_class:['AssertionError','Error','TypeError','SyntaxError'].includes(error.name)?error.name:'unclassified',error_code:['ENOENT','EACCES'].includes(error.code)?error.code:null,
  provider_requests:0,SDK_observations:0,SQL_reads:0,SQL_writes:0,mutations:0,private_details_emitted:false}));process.exitCode=1;}}
if(process.argv[1]===undefined)await main();
