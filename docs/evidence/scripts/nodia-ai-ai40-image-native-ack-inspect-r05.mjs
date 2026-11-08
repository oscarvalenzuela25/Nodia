// Strict read-only journal/proc/staging inspection. No runtime/account/SDK construction.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open,readFile,lstat,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [attempt,run,session,bindingSha]=process.argv.slice(2);
assert.match(attempt,/^[a-f0-9-]{36}$/u);assert.match(run,/^[a-f0-9-]{36}$/u);assert.match(session,/^[a-f0-9]{32}$/u);assert.match(bindingSha,/^[a-f0-9]{64}$/u);
const root='/opt/nodia/releases/nodia-server-ai40-r05';
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=await readFile(root+'/release-manifest.json');assert.equal(sha(manifestBytes),'07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd');
const manifest=JSON.parse(manifestBytes);for(const file of ['dist/common/ai/codex/codex-chat-journal.js','dist/common/ai/codex/codex-login-journal.js','dist/common/ai/codex/codex-process-ownership.js'])assert.equal(sha(await readFile(root+'/'+file)),manifest.files[file]);
let record,recordSha;
const file='/var/lib/nodia/codex/chat-jobs/'+attempt+'.json';
const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
try{const info=await handle.stat();assert.ok(info.isFile()&&info.uid===10000&&info.nlink===1&&(info.mode&0o777)===0o600&&info.size<=4096);const bytes=await handle.readFile();record=JSON.parse(bytes);recordSha=sha(bytes);}finally{await handle.close();}
const {CodexChatJournal}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-journal.js').href);
const decoder=new CodexChatJournal();record=decoder.decode(record);const proof=decoder.proof(record);
assert.equal(record.identity.attemptId,attempt);assert.equal(record.identity.operationRef,attempt);assert.equal(record.identity.adapterIdentity.connectionId,'1');assert.equal(record.identity.adapterIdentity.providerKey,'openai');assert.equal(record.identity.sessionGeneration,session);
assert.equal(record.state,'completed');assert.equal(record.acknowledged,true);assert.equal(record.unforwardedRequests,0);assert.equal(proof.processClosed,true);assert.equal(proof.outcome,'completed');assert.ok(record.native);
const {assertCodexGroupEmpty,sameCodexProcess}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-process-ownership.js').href);
assert.equal(await sameCodexProcess(record.native),false);await assertCodexGroupEmpty(record.native.group);
const staging='/var/lib/nodia/codex/1/nodia-chat-images';let attemptAbsent=false;try{await lstat(staging+'/'+attempt);}catch(error){if(error.code==='ENOENT')attemptAbsent=true;else throw error;}assert.equal(attemptAbsent,true);
const entries=await readdir(staging);assert.equal(entries.length,0);
console.log(JSON.stringify({schema:'nodia-ai-ai40-ui-image-native-ack-v1',status:'passed',observed_at_VM_utc:new Date().toISOString(),run_id:run,attempt_id:attempt,sql_binding_receipt_sha256:bindingSha,connection_id:'1',session_generation:session,journal_record_sha256:recordSha,terminal_proof_id:proof.terminalProofId,terminal_observed_at:proof.observedAt.toISOString(),state:record.state,acknowledged:record.acknowledged,unforwarded_requests:record.unforwardedRequests,process_closed:proof.processClosed,exact_native_process_absent:true,owned_native_process_group_empty:true,attempt_staging_directory_absent:attemptAbsent,staging_root_entries:entries.length,rpc_count:record.rpcCount,source_sha256:sha(await readFile(process.argv[1])),typed_decoder_manifest_sha256:sha(manifestBytes),provider_observations:0,provider_generations:0,configured_SQL_writes:0,services_changed:false,credential_files_read:false,private_content_emitted:false}));
