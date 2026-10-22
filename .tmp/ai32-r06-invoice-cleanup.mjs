// Cleanup only for the frozen R06 invoice attempt. Never repeats a PUT/effect.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, open, readFile, rename, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';process.env.RATE_LIMIT_STORAGE='memory';
let input='';for await(const chunk of process.stdin){input+=chunk;assert(Buffer.byteLength(input)<=32768);}
let descriptor;try{descriptor=JSON.parse(input);}catch{throw new Error('Invalid private cleanup descriptor');}input='';
assert.equal(descriptor.stage,'AI-32-R06');assert.equal(descriptor.purpose,'invoice');
assert.equal(descriptor.sandbox.host,'127.0.0.1');assert.equal(descriptor.sandbox.username,'ai32_r06_invoice');assert.equal(descriptor.sandbox.database,'ai32_r06_invoice');
assert(Number.isInteger(descriptor.sandbox.port)&&descriptor.sandbox.port>1024&&descriptor.sandbox.port<=65535);
assert(typeof descriptor.sandbox.password==='string'&&descriptor.sandbox.password.length>=20);
for(const field of ['server_root','runtime_source_root','ledger_path'])assert(isAbsolute(descriptor[field]));
assert(/^ai32-r06-invoice[^/]*\.json$/.test(descriptor.ledger_path.split('/').at(-1)));
assert.equal((await stat(descriptor.ledger_path)).mode&0o777,0o600);
const ledger=JSON.parse(await readFile(descriptor.ledger_path,'utf8'));
assert.equal(ledger.stage,'AI-32-R06');assert.equal(ledger.purpose,'invoice');assert.match(ledger.run_id,/^[0-9a-f-]{36}$/);
assert(Array.isArray(ledger.records)&&ledger.records.length===8);
assert.equal(new Set(ledger.records.map(entry=>entry.key)).size,8);
for(const entry of ledger.records){
  assert(['put_acknowledged','deleted_and_get_404'].includes(entry.state));
  assert(['original','domain','seed'].includes(entry.kind));assert.match(entry.sha256,/^[0-9a-f]{64}$/);assert(Number.isSafeInteger(entry.bytes)&&entry.bytes>0&&entry.bytes<=10485760);
  assert(typeof entry.key==='string'&&/^(?:invoices\/[0-9a-f-]{36}\/[^/]{1,180}|nodia-ai\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36})$/.test(entry.key));
}
const persist=async()=>{
  const temporary=descriptor.ledger_path+'.cleanup-pending',file=await open(temporary,'wx',0o600);
  try{await file.chmod(0o600);await file.writeFile(JSON.stringify(ledger,null,2)+'\n');await file.sync();}finally{await file.close();}
  await rename(temporary,descriptor.ledger_path);await chmod(descriptor.ledger_path,0o600);
  const directory=await open(dirname(descriptor.ledger_path),'r');try{await directory.sync();}finally{await directory.close();}
};
const root=resolve(descriptor.server_root),requireRuntime=createRequire(resolve(root,'package.json'));requireRuntime('reflect-metadata');
const {DataSource}=requireRuntime('typeorm');
const hash=value=>createHash('sha256').update(value).digest('hex');
const modulePath='dist/common/storage/storage.service.js';
const sourceHash=hash(await readFile(resolve(root,modulePath)));assert.equal(sourceHash,hash(await readFile(resolve(descriptor.runtime_source_root,modulePath))));
const {StorageService}=await import(pathToFileURL(resolve(root,modulePath)).href);
let db,cloud,failure=null,deletes=0,verified404=0,rowsRemoved=0,survivalReverified=false;
const signal=()=>AbortSignal.timeout(15000);
const absent=async entry=>{
  try{await cloud.downloadFile(entry.key,entry.bytes,signal());return false;}
  catch(error){if(error?.$metadata?.httpStatusCode===404&&['NoSuchKey','NotFound'].includes(error.name)){verified404++;return true;}throw error;}
};
try{
  db=await new DataSource({type:'postgres',host:descriptor.sandbox.host,port:descriptor.sandbox.port,username:descriptor.sandbox.username,password:descriptor.sandbox.password,database:descriptor.sandbox.database,
    synchronize:false,logging:false,extra:{max:2,statement_timeout:10000,connectionTimeoutMillis:10000}}).initialize();
  const[proof]=await db.query('SELECT current_database() database,current_user username');assert.deepEqual(proof,{database:'ai32_r06_invoice',username:'ai32_r06_invoice'});
  assert.equal((await db.query('SELECT count(*)::int n FROM migrations'))[0].n,26);
  cloud=new StorageService();cloud.uploadFile=cloud.uploadFileOnce=()=>{throw new Error('Cleanup forbids PUT');};
  const rows=await db.query('SELECT id::text,business_id::text,code,path_storage FROM invoices ORDER BY id');
  if(!ledger.cleanup_receipt){
    assert.equal(rows.length,2);
    assert.deepEqual(rows.map(row=>row.code).sort(),['SYN-R06-LEGACY','SYN-R06-UPDATE']);
    for(const row of rows){
      assert.match(row.id,/^[1-9][0-9]{0,18}$/);assert(BigInt(row.id)<=9223372036854775807n);assert.match(row.business_id,/^[0-9a-f-]{36}$/);
      const entry=ledger.records.find(record=>record.key===row.path_storage);assert(entry&&entry.kind==='domain'&&entry.state==='put_acknowledged');
      assert(row.path_storage.startsWith(`invoices/${row.business_id}/`));
      const bytes=await cloud.downloadFile(entry.key,entry.bytes,signal());assert.equal(bytes.length,entry.bytes);assert.equal(hash(bytes),entry.sha256);
    }
    survivalReverified=true;
    ledger.cleanup_receipt={schema_version:1,invoices:rows,rows_deleted_confirmed:false,survival_reverified_before_fixture_teardown:true};await persist();
  }
  const receipt=ledger.cleanup_receipt;assert.equal(receipt.schema_version,1);assert.equal(receipt.survival_reverified_before_fixture_teardown,true);assert.equal(receipt.invoices.length,2);
  for(const row of receipt.invoices){assert.match(row.id,/^[1-9][0-9]{0,18}$/);assert(ledger.records.some(entry=>entry.key===row.path_storage&&entry.kind==='domain'));}
  assert(rows.every(row=>receipt.invoices.some(saved=>saved.id===row.id&&saved.path_storage===row.path_storage&&saved.business_id===row.business_id&&saved.code===row.code)));
  await db.query('DELETE FROM invoices WHERE id=ANY($1::bigint[]) AND path_storage=ANY($2::varchar[])',[receipt.invoices.map(row=>row.id),receipt.invoices.map(row=>row.path_storage)]);
  assert.equal((await db.query('SELECT count(*)::int n FROM invoices'))[0].n,0);rowsRemoved=rows.length;
  receipt.rows_deleted_confirmed=true;await persist();
  for(const entry of ledger.records)if(entry.state==='put_acknowledged'){
    assert.equal(entry.kind,'domain');assert(receipt.invoices.some(row=>row.path_storage===entry.key));
    deletes++;await cloud.deleteFile(entry.key);assert.equal(await absent(entry),true);
    entry.state='deleted_and_get_404';await persist();
  }
  for(const entry of ledger.records)assert.equal(await absent(entry),true);
  ledger.cleanup_complete=ledger.records.every(entry=>entry.state==='deleted_and_get_404');assert.equal(ledger.cleanup_complete,true);await persist();
}catch(error){failure={phase:'cleanup_only',category:error?.name==='AssertionError'?'assertion_failed':'cleanup_unconfirmed'};}
finally{cloud?.onModuleDestroy();if(db?.isInitialized)await db.destroy();}
console.log(JSON.stringify({stage:'AI-32-R06',scope:'invoice_owned_fixture_cleanup_only_no_PUT_or_effect_replay',status:failure?'failed':'passed',
  configured_database_used:false,configured_business_records_modified:0,provider_generations:0,put_calls:0,
  sandbox_rows_removed:rowsRemoved,live_invoice_copies_reverified_before_teardown:survivalReverified||ledger.cleanup_receipt?.survival_reverified_before_fixture_teardown===true,
  owned_cloud_delete_calls:deletes,verified_get_404:verified404,ledger_objects:ledger.records.length,cleanup_complete:ledger.cleanup_complete===true,
  runtime_storage_sha256:sourceHash,original_harness_teardown_issue:'invoice_bigint_id_cast_as_uuid_array',...failure?{error:failure}:{}}));
if(failure)process.exitCode=1;
