// Exact R06 business UI attempts: typed journal + /proc + staging, no runtime/account construction.
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {open,readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root='/opt/nodia/releases/nodia-server-ai40-r06';
const attempts=['0ac3a3a9-6287-4449-b651-df8ce45070d0', '0c84f913-181f-4bee-ba95-70f3cb3b693c'];
const sqlBinding={"run_id": "8735c02b-37ad-484d-8d97-406cabad8b06", "job_id": "d46aa7dc-d13c-41eb-81f4-0d6844993477", "sql_receipt_sha256": "ada2b2c3820915ed09e3cda70a4ccd1ae98518315d9d49eb8ea2a8d6200e6877", "sql_runtime_fences": {"0ac3a3a9-6287-4449-b651-df8ce45070d0": "15", "0c84f913-181f-4bee-ba95-70f3cb3b693c": "16"}, "ancestor_reader_sha256": "e4f6c709917bf051992f2412e942997d53e4f2f2a9c3d939496ddebc2f831989"};
const mcpPath='/var/lib/nodia/codex/1/nodia-chat-mcp';
const mcpPin='d2becf6481a6768a4f790140cfdde70ea2f5a2b468a3c2f1adbd04d60850a875';
const sha=b=>createHash('sha256').update(b).digest('hex');
const mb=await readFile(root+'/release-manifest.json');assert.equal(sha(mb),'5aa5b74dd43cfbc61615f766ba8e17dd12bb3c8bb0a695bd85fc68c6d519c2bd');
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
console.log(JSON.stringify({schema:'nodia-ai-ai40-r06-business-native-ACK-v1',status:'passed',sql_binding:sqlBinding,observed_at_VM_utc:new Date().toISOString(),manifest_sha256:sha(mb),attempts:results,MCP_proof_sha256:mcpPin,MCP_preserved_byte_exact:true,runtime_fingerprint:mcp.scope.runtimeFingerprint,provider_requests:0,provider_observations:0,configured_SQL_writes:0,native_writes:0,account_credentials_read:false,private_content_emitted:false}));
