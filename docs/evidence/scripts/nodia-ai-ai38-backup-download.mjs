// Outputs ciphertext only; caller captures into an operator-private file.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {once} from 'node:events';
const root='/opt/nodia/releases/nodia-server-ai38-journal-r01';
const require=createRequire(root+'/package.json');require('reflect-metadata');
const {GetObjectCommand}=require('@aws-sdk/client-s3');
const {loadNodiaAiExternalRecoveryConfig,createNodiaAiExternalRecovery}=await import(root+'/dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js');
const config=loadNodiaAiExternalRecoveryConfig('/etc/nodia-ai-recovery/recovery.json');
const external=createNodiaAiExternalRecovery(config);
try{
 const {state}=await external.store.snapshot();
 const entry=state.backups.find(e=>e.backup_id==='ecc22075-821d-404f-ab33-9a6b3137eefa');
 assert.equal(entry?.status,'ready');
 const object=await external.client.send(new GetObjectCommand({Bucket:config.bucket,Key:entry.object_key}),{abortSignal:AbortSignal.timeout(15000)});
 assert.equal(object.ContentLength,entry.cipher_bytes);assert.equal(object.VersionId??null,null);
 const hash=createHash('sha256');let bytes=0;
 for await (const chunk of object.Body){bytes+=chunk.length;assert.ok(bytes<=entry.cipher_bytes);hash.update(chunk);if(!process.stdout.write(chunk)) await once(process.stdout,'drain');}
 assert.equal(bytes,entry.cipher_bytes);assert.equal(hash.digest('hex'),entry.cipher_sha256);
}finally{external.client.destroy();}
