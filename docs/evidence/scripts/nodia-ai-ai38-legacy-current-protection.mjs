// Read-only observation of registered replacement backups. No upload, CAS or DELETE.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root='/opt/nodia/releases/nodia-server-ai38-journal-r02';
const require=createRequire(root+'/package.json');require('reflect-metadata');
const {readFile}=await import('node:fs/promises');
const {loadNodiaAiBackupConfiguration,createNodiaAiBackupPorts}=await import(root+'/scripts/nodia-ai-backups.mjs');
const {loadNodiaAiExternalRecoveryConfig,createNodiaAiExternalRecovery}=await import(root+'/dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js');
const {EncryptNodiaAiBackupUseCase}=await import(root+'/dist/nodia-ai-recovery/use-case/encrypt-nodia-ai-backup.use-case.js');
const config=await loadNodiaAiBackupConfiguration('/etc/nodia-ai-recovery/backup.json');
const recovery=loadNodiaAiExternalRecoveryConfig(config.recovery_config);
const external=createNodiaAiExternalRecovery(recovery);
try {
 const {state}=await external.store.snapshot();
 const now=Date.now(),key=await readFile(config.public_key_file,'utf8');
 const keyId=new EncryptNodiaAiBackupUseCase().keyId(key);
 assert.equal(state.closed_at,null);assert.ok(state.backups.length>=3);
 assert.equal(state.entries.filter(e=>e.confirmed_at===null).length,0);
 const signal=AbortSignal.timeout(20000);
 const ports=createNodiaAiBackupPorts(config,external,recovery.bucket,key,signal);
 const verified=[];
 for (const entry of state.backups) {
   assert.equal(entry.status,'ready');assert.ok(Date.parse(entry.expires_at)>now);
   assert.equal(entry.encryption_key_id,keyId);
   const observed=await ports.inspect(entry,signal);
   assert.equal(observed.cipher_bytes,entry.cipher_bytes);assert.equal(observed.cipher_sha256,entry.cipher_sha256);
   verified.push({backup_id:entry.backup_id,captured_at:entry.captured_at,expires_at:entry.expires_at,cipher_bytes:entry.cipher_bytes,cipher_sha256:entry.cipher_sha256});
 }
 console.log(JSON.stringify({status:'registered_replacement_backups_verified_read_only',observed_at_VM_utc:new Date().toISOString(),coverage_from:state.coverage_from,verified_count:verified.length,verified,encryption_key_id:keyId,private_RSA_key_read:false,SQL_queries:0,provider_requests:0,uploads:0,deletes:0,CAS_mutations:0,full_SQL_restore_repeated:false,prior_real_restore_evidence:'nodia-ai-ai38-backup-restore-r01.json'}));
}finally{external.client.destroy();}
