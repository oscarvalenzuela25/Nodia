// Typed, read-only R06 journal/process/staging observation; never a runtime/account call.
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {readFile,open,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const ROOT='/opt/nodia/releases/nodia-server-ai40-r06';
const sha=b=>createHash('sha256').update(b).digest('hex');
const chunks=[];let size=0;for await(const b of process.stdin){size+=b.length;assert.ok(size<=1048576);chunks.push(b);}
const input=JSON.parse(Buffer.concat(chunks));
assert.deepEqual(Object.keys(input).sort(),['before_entries','scope','success','terminal_proof_id']);
assert.ok(Array.isArray(input.before_entries)&&input.before_entries.length<=10000);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
for(const n of input.before_entries)assert.ok(typeof n==='string'&&uuid.test(n.slice(0,-5))&&n.endsWith('.json'));
assert.ok(typeof input.success==='boolean');if(input.success)assert.ok(uuid.test(input.terminal_proof_id));
const mb=await readFile(ROOT+'/release-manifest.json');assert.equal(sha(mb),'5aa5b74dd43cfbc61615f766ba8e17dd12bb3c8bb0a695bd85fc68c6d519c2bd');
const manifest=JSON.parse(mb);for(const n of ['codex-chat-journal','codex-login-journal','codex-process-ownership'])assert.equal(sha(await readFile(ROOT+'/dist/common/ai/codex/'+n+'.js')),manifest.files['dist/common/ai/codex/'+n+'.js']);
const {CodexChatJournal:Journal}=await import(pathToFileURL(ROOT+'/dist/common/ai/codex/codex-chat-journal.js'));
const {sameCodexProcess,assertCodexGroupEmpty}=await import(pathToFileURL(ROOT+'/dist/common/ai/codex/codex-process-ownership.js'));
const entries=(await readdir('/var/lib/nodia/codex/chat-jobs')).filter(n=>n.endsWith('.json')&&uuid.test(n.slice(0,-5)));
const added=entries.filter(n=>!input.before_entries.includes(n));assert.ok(added.length<=1);
const records=[];
for(const name of added){
 const h=await open('/var/lib/nodia/codex/chat-jobs/'+name,constants.O_RDONLY|constants.O_NOFOLLOW);let b;
 try{const s=await h.stat();assert.ok(s.isFile()&&s.uid===10000&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size<=4096);b=await h.readFile();}finally{await h.close();}
 const journal=new Journal();const r=journal.decode(JSON.parse(b));assert.equal(name,r.identity.attemptId+'.json');assert.equal(r.identity.adapterIdentity.connectionId,'1');assert.equal(r.identity.resourceKey,input.scope.resourceKey);assert.equal(r.identity.sessionGeneration,input.scope.sessionGeneration);
 const same=r.native?await sameCodexProcess(r.native):null;let groupEmpty=null;if(r.native){try{await assertCodexGroupEmpty(r.native.group);groupEmpty=true;}catch{groupEmpty=false;}}
 const proof=['completed','abandoned_unknown'].includes(r.state)?journal.proof(r):null;
 const staging={};for(const dir of ['nodia-chat-images','nodia-chat-audio']){let count=0,attemptPresent=true;try{count=(await readdir('/var/lib/nodia/codex/1/'+dir)).length;}catch(e){if(e.code!=='ENOENT')throw e;}try{await lstat('/var/lib/nodia/codex/1/'+dir+'/'+r.identity.attemptId);}catch(e){if(e.code==='ENOENT')attemptPresent=false;else throw e;}staging[dir]={entries:count,attempt_directory_present:attemptPresent};}
 if(input.success){assert.equal(r.state,'completed');assert.equal(r.acknowledged,true);assert.equal(r.terminalProofId,input.terminal_proof_id);assert.equal(same,false);assert.equal(groupEmpty,true);assert.equal(r.unforwardedRequests,0);for(const s of Object.values(staging)){assert.equal(s.entries,0);assert.equal(s.attempt_directory_present,false);}}
 records.push({attempt_id:r.identity.attemptId,record_sha256:sha(b),state:r.state,acknowledged:r.acknowledged,cancel_requested:r.cancelRequested,rpc_count:r.rpcCount,unforwarded_requests:r.unforwardedRequests,native_process_same:same,owned_native_group_empty:groupEmpty,terminal_proof_id:proof?.terminalProofId??null,outcome:proof?.outcome??null,process_closed:proof?.processClosed??null,observed_at:proof?.observedAt.toISOString()??null,staging});
}
if(input.success)assert.equal(records.length,1);
console.log(JSON.stringify({schema:'nodia-ai-ai40-r06-image-native-inspection-v1',status:input.success?'passed':'observed_failed_attempt_read_only',records,provider_requests:0,configured_SQL_writes:0,profile_credentials_read:false,private_content_emitted:false}));
