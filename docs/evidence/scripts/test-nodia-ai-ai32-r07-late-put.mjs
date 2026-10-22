// Exact exported harness guards; memory-only and no main() invocation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,writeFile,unlink,rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertFreshLedger,assertOwnedKey,cleanupMayDelete,guardedLatePut } from './nodia-ai-ai32-r07-late-put.mjs';
const make=()=>{const ledger={chat_id:randomUUID(),attachment_id:randomUUID(),generation:randomUUID(),object:{state:'no_write_attempted'}};ledger.object.key=`nodia-ai/${ledger.chat_id}/${ledger.attachment_id}/${ledger.generation}`;return ledger;};
let checks=0;
for(const scenario of ['collision','read_failure','cancelled_gate','uncertain_put','acknowledged_put']){
  const ledger=make(),events=[];
  const action=()=>guardedLatePut({ledger,key:ledger.object.key,persist:async()=>{events.push(ledger.object.state);},
    absent:async()=>{if(scenario==='read_failure')throw new Error('synthetic read failed');return scenario!=='collision';},
    waitForPurge:async()=>{events.push('purge_committed');if(scenario==='cancelled_gate')throw new Error('synthetic gate cancelled');},
    put:async()=>{events.push('real_put');assert.equal(ledger.object.state,'put_attempted');assert(events.indexOf('purge_committed')<events.indexOf('real_put'));if(scenario==='uncertain_put')throw new Error('synthetic ACK uncertain');}});
  if(scenario==='acknowledged_put')await action();else await assert.rejects(action);
  const attempted=['uncertain_put','acknowledged_put'].includes(scenario);
  assert.equal(events.filter(event=>event==='real_put').length,attempted?1:0);
  assert.equal(cleanupMayDelete(ledger,ledger.object.key),attempted);
  if(scenario==='collision')assert.equal(ledger.object.state,'preexisting_do_not_delete');
  if(['read_failure','cancelled_gate'].includes(scenario))assert.equal(ledger.object.state,'no_write_attempted');
  if(scenario==='uncertain_put')assert.equal(ledger.object.state,'put_attempted');
  if(scenario==='acknowledged_put'){
    assert.equal(ledger.object.state,'put_acknowledged');const count=events.length;await assert.rejects(action);assert.equal(events.length,count);
  }
  checks++;
}
{
  const ledger=make();assert.throws(()=>assertOwnedKey(ledger,ledger.object.key+'/another'));
  assert.throws(()=>cleanupMayDelete(ledger,`nodia-ai/${randomUUID()}/${ledger.attachment_id}/${ledger.generation}`));checks++;
}
{
  const ledger=make();ledger.object.state='deleted_and_get_404';assert.equal(cleanupMayDelete(ledger,ledger.object.key),true);checks++;
}
{
  const ledger=make();let release,atGate,puts=0;
  const entered=new Promise(done=>{atGate=done;}),gate=new Promise(done=>{release=done;});
  const work=guardedLatePut({ledger,key:ledger.object.key,persist:async()=>{},absent:async()=>true,waitForPurge:async()=>{atGate();await gate;},put:async()=>{puts++;}});
  await entered;assert.equal(puts,0);assert.equal(cleanupMayDelete(ledger,ledger.object.key),false);release();await work;assert.equal(puts,1);checks++;
}
{
  const directory=await mkdtemp(join(tmpdir(),'nodia-r07-guard-')),file=join(directory,'ledger.json');
  try{await assertFreshLedger(file);await writeFile(file,'{}',{flag:'wx'});await assert.rejects(()=>assertFreshLedger(file));checks++;}
  finally{await unlink(file).catch(cause=>{if(cause.code!=='ENOENT')throw cause;});await rmdir(directory);}
}
console.log(JSON.stringify({stage:'AI-32-R07',scope:'late_put_exact_guard_memory_only',status:'passed',checks,real_storage_calls:0,database_calls:0,provider_calls:0,
  preexisting_collision_delete_calls:0,suspended_put_before_purge_calls:0,uncertain_put_not_replayed:true}));
