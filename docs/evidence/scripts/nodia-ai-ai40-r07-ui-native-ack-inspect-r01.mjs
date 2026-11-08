// Exact R07 UI attempts: typed journal + /proc + staging, no runtime/account construction.
// Run/attempt linkage comes from the separately pinned SQL receipt; the native journal has no run ID.
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {open,readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root='/opt/nodia/releases/nodia-server-ai40-r07';
const chunks=[];let inputBytes=0;
for await(const chunk of process.stdin){inputBytes+=chunk.length;assert.ok(inputBytes<=4096);chunks.push(chunk);}
const binding=JSON.parse(Buffer.concat(chunks).toString('utf8'));
assert.ok(binding&&typeof binding==='object'&&!Array.isArray(binding));
assert.deepEqual(Object.keys(binding).sort(),['attempt_ids','run_id','sql_receipt_sha256']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
assert.ok(typeof binding.run_id==='string'&&uuid.test(binding.run_id));
assert.ok(typeof binding.sql_receipt_sha256==='string'&&/^[a-f0-9]{64}$/u.test(binding.sql_receipt_sha256));
const attempts=binding.attempt_ids;
assert.ok(Array.isArray(attempts)&&attempts.length>=1&&attempts.length<=3&&new Set(attempts).size===attempts.length);
assert.ok(attempts.every(attempt=>typeof attempt==='string'&&uuid.test(attempt)));
const mcpPath='/var/lib/nodia/codex/1/nodia-chat-mcp';
const mcpPin='b6350cbf7e22eadca280a521c8479e0a6827b2ab8b4e38826de386091d17e60d';
const sha=b=>createHash('sha256').update(b).digest('hex');
const mb=await readFile(root+'/release-manifest.json');assert.equal(sha(mb),'1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476');
const manifest=JSON.parse(mb);for(const n of ['codex-chat-journal','codex-login-journal','codex-process-ownership','codex-chat-acceptance'])assert.equal(sha(await readFile(root+'/dist/common/ai/codex/'+n+'.js')),manifest.files['dist/common/ai/codex/'+n+'.js']);
const {CodexChatJournal:Journal}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-journal.js'));
const {CodexChatAcceptanceStore:Store}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-acceptance.js'));
const {sameCodexProcess,assertCodexGroupEmpty}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-process-ownership.js'));
async function privateRead(path){const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await h.stat();assert.ok(s.isFile()&&s.uid===10000&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size<=4096);return await h.readFile();}finally{await h.close();}}
const mcBytes=await privateRead(mcpPath);assert.equal(sha(mcBytes),mcpPin);const mcp=new Store().decode(JSON.parse(mcBytes));assert.equal(mcp.scope.connectionId,'1');assert.equal(mcp.scope.runtimeFingerprint,'1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a');
const results=[];
for(const attempt of attempts){
 const b=await privateRead('/var/lib/nodia/codex/chat-jobs/'+attempt+'.json');const journal=new Journal();const r=journal.decode(JSON.parse(b));
 assert.equal(r.identity.attemptId,attempt);assert.equal(r.identity.operationRef,attempt);assert.equal(r.identity.engine,'agentic');assert.deepEqual(r.identity.adapterIdentity,{providerKey:'openai',contractVersion:'nodia-ai-codex-chat/1',connectionId:'1'});assert.equal(r.identity.sessionGeneration,mcp.scope.sessionGeneration);assert.equal(r.identity.resourceKey,mcp.scope.resourceKey);
 assert.equal(r.state,'completed');assert.equal(r.acknowledged,true);assert.equal(r.unforwardedRequests,0);assert.ok(r.native);assert.equal(await sameCodexProcess(r.native),false);await assertCodexGroupEmpty(r.native.group);
 const proof=journal.proof(r);assert.equal(proof.outcome,'completed');assert.equal(proof.processClosed,true);
 const staging={};for(const name of ['nodia-chat-images','nodia-chat-audio']){let count=0,absent=false;try{count=(await readdir('/var/lib/nodia/codex/1/'+name)).length;}catch(e){if(e.code!=='ENOENT')throw e;}try{await lstat('/var/lib/nodia/codex/1/'+name+'/'+attempt);}catch(e){if(e.code==='ENOENT')absent=true;else throw e;}assert.equal(count,0);assert.equal(absent,true);staging[name]={entries:count,exact_attempt_directory_absent:absent};}
 results.push({attempt_id:attempt,journal_sha256:sha(b),state:r.state,acknowledged:r.acknowledged,terminal_proof_id:proof.terminalProofId,outcome:proof.outcome,process_closed:proof.processClosed,terminal_observed_at:proof.observedAt.toISOString(),rpc_count:r.rpcCount,unforwarded_requests:r.unforwardedRequests,exact_native_process_absent:true,owned_native_group_empty:true,staging});
}
assert.equal(sha(await privateRead(mcpPath)),mcpPin);
console.log(JSON.stringify({schema:'nodia-ai-ai40-r07-ui-native-ACK-v1',run_id:binding.run_id,sql_binding_receipt_sha256:binding.sql_receipt_sha256,ancestor_reader_sha256:'e4f6c709917bf051992f2412e942997d53e4f2f2a9c3d939496ddebc2f831989',status:'passed',observed_at_VM_utc:new Date().toISOString(),manifest_sha256:sha(mb),attempts:results,MCP_proof_sha256:mcpPin,MCP_preserved_byte_exact:true,runtime_fingerprint:mcp.scope.runtimeFingerprint,provider_requests:0,provider_observations:0,configured_SQL_writes:0,native_writes:0,account_credentials_read:false,private_content_emitted:false}));
