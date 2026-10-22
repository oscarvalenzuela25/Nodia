// Exercise the exact harness guard/teardown bodies with memory-only doubles.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./nodia-ai-ai32-r06-invoice-real.mjs',import.meta.url),'utf8');
const guards=source.slice(source.indexOf('const put = async'),source.indexOf('// Previously decoded'))
  .replace('const put = async','globalThis.put = async').replace('const storage =','globalThis.storage =');
const cleanup=source.slice(source.indexOf('    if(cloud)for(const entry of ledger.records)'),source.indexOf('    ledger.cleanup_complete='));
let checks=0;
for(const scenario of ['collision','read_failure','uncertain_put','acknowledged_put']) {
  const ledger={records:[]};let writes=0,deletes=0,reads=0;
  const recordFor=key=>{const entry=ledger.records.find(item=>item.key===key);assert(entry);return entry;};
  const context=vm.createContext({assert,ledger,ownsNamespace:key=>key.startsWith('owned/'),
    readFile:async()=>Buffer.from('synthetic'),hash:()=> 'a'.repeat(64),persistLedger:async()=>{},boundedGet:async()=>Buffer.alloc(0),
    counts:{puts:0,original_puts:0},db:null,cloud:{async deleteFile(){deletes++;}},
    realAdapter:{async put(){writes++;if(scenario==='uncertain_put')throw new Error('synthetic result uncertain');}},
    absent:async()=>{reads++;if(reads===1&&scenario==='read_failure')throw new Error('synthetic read failure');return !(reads===1&&scenario==='collision');},
    recordFor,cleanupComplete:false});
  await vm.runInContext(guards,context);
  if(scenario==='acknowledged_put')await context.put('owned/object','unused','image/png',null);
  else await assert.rejects(()=>context.put('owned/object','unused','image/png',null));
  if(scenario==='collision'){
    assert.equal(recordFor('owned/object').state,'preexisting_do_not_delete');
    await assert.rejects(()=>context.storage.delete('owned/object'));
  }
  if(scenario==='read_failure')assert.equal(recordFor('owned/object').state,'no_write_attempted');
  await vm.runInContext(`(async()=>{${cleanup}})()`,context);
  assert.equal(context.cleanupComplete,true);
  assert.equal(writes,['uncertain_put','acknowledged_put'].includes(scenario)?1:0);
  assert.equal(deletes,writes);
  checks++;
}
assert(source.includes("host:descriptor.sandbox.host,port:descriptor.sandbox.port"));
assert(!source.includes('...descriptor.sandbox'));
checks++;
console.log(JSON.stringify({stage:'AI-32-R06',scope:'invoice_harness_exact_guard_memory_only',status:'passed',checks,
  real_storage_calls:0,database_calls:0,provider_calls:0,preexisting_collision_delete_calls:0}));
