// Private VM operation, preflight by default. --apply must be dispatched after staging acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(root+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(root+'/.env')));
const {default:db}=await import(root+'/dist/config/data-source.js');
const {MigrationExecutor}=require('typeorm');
const allow=['RegisterNodiaAiNavigation1792100000000','CreateNodiaAiConversationPersistence1792200000000'];
const apply=process.argv.includes('--apply');
await db.initialize();
try {
 const run=db.createQueryRunner();await run.connect();
 try {
  if(apply){
   for(const unit of ['nodia-api','nodia-ai-worker']){
    const state=spawnSync('systemctl',['is-active',unit],{encoding:'utf8'}).stdout.trim();
    assert.ok(!['active','activating','deactivating','reloading'].includes(state),unit+' must be stopped before migration');
   }
   const manifest=JSON.parse(fs.readFileSync(root+'/dist/nodia-ai/knowledge/manifest.json'));
   assert.equal(manifest.capability_contracts.length,67,'Final publication must include the exact 67 read contracts');
  }
  await run.startTransaction();
  await run.query("SET LOCAL lock_timeout='2s'");
  await run.query("SET LOCAL statement_timeout='30s'");
  await run.query("SELECT pg_advisory_xact_lock(hashtext('nodia-ai-ai15-m1-install'))");
  const executor=new MigrationExecutor(db,run);executor.transaction='all';
  const pending=(await executor.getPendingMigrations()).map(m=>m.name);
  assert.deepEqual(pending,allow,'Unexpected migration baseline, refusing operation');
  const executed=(await run.query('SELECT count(*)::int AS n FROM migrations'))[0].n;
  assert.equal(executed,18);
  const tables=await run.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%'");
  assert.equal(tables.length,0,'NodiaAI tables must be absent on this pre-installation baseline');
  if(apply){
   const applied=await executor.executePendingMigrations();assert.deepEqual(applied.map(m=>m.name),allow);
   assert.equal((await run.query('SELECT count(*)::int AS n FROM migrations'))[0].n,20);
   assert.equal((await run.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%'"))[0].n,11);
   await run.commitTransaction();
   console.log(JSON.stringify({applied:true,migrations:allow,transaction:'all',executed_count:20,nodia_ai_tables:11}));
  }else{
   await run.rollbackTransaction();console.log(JSON.stringify({applied:false,pending,executed_count:executed,nodia_ai_tables:0}));
  }
 }catch(error){if(run.isTransactionActive)await run.rollbackTransaction();throw error;}
 finally{await run.release();}
}finally{await db.destroy();}
