// Ciphertext only. Fresh public receipt on stdin; no private config output.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
const root='/opt/nodia/releases/nodia-server-ai40-r07';
const pin='1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const digest=x=>createHash('sha256').update(x).digest('hex');
assert.equal(digest(await readFile(root+'/release-manifest.json')),pin);
const manifest=JSON.parse(await readFile(root+'/release-manifest.json','utf8'));
const factory='dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js';
assert.equal(digest(await readFile(root+'/'+factory)),manifest.files[factory]);
const chunks=[];let size=0;for await(const c of process.stdin){size+=c.length;assert.ok(size<=32768);chunks.push(c);}
const input=JSON.parse(Buffer.concat(chunks).toString());const receipt=input.backup;
assert.equal(input.status,'ready');assert.equal(receipt.schema_version,1);assert.equal(receipt.operation,'backup');assert.equal(receipt.status,'ready');
assert.match(receipt.backup_id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
assert.match(receipt.cipher_sha256,/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(receipt.cipher_bytes)&&receipt.cipher_bytes>0&&receipt.cipher_bytes<1024**3+8221);
const require=createRequire(root+'/package.json');require('reflect-metadata');const {GetObjectCommand}=require('@aws-sdk/client-s3');
const {loadNodiaAiExternalRecoveryConfig,createNodiaAiExternalRecovery}=await import(root+'/'+factory);
const config=loadNodiaAiExternalRecoveryConfig('/etc/nodia-ai-recovery/recovery.json');const external=createNodiaAiExternalRecovery(config);
try{
 const {state}=await external.store.snapshot();const entry=state.backups.find(e=>e.backup_id===receipt.backup_id);
 assert.equal(entry?.status,'ready');assert.equal(entry.cipher_bytes,receipt.cipher_bytes);assert.equal(entry.cipher_sha256,receipt.cipher_sha256);assert.equal(entry.encryption_key_id,receipt.encryption_key_id);
 const object=await external.client.send(new GetObjectCommand({Bucket:config.bucket,Key:entry.object_key}),{abortSignal:AbortSignal.timeout(30000)});
 assert.equal(object.ContentLength,entry.cipher_bytes);assert.equal(object.VersionId??null,null);
 const hash=createHash('sha256');let bytes=0;
 for await(const chunk of object.Body){bytes+=chunk.length;assert.ok(bytes<=entry.cipher_bytes);hash.update(chunk);if(!process.stdout.write(chunk))await once(process.stdout,'drain');}
 assert.equal(bytes,entry.cipher_bytes);assert.equal(hash.digest('hex'),entry.cipher_sha256);
}finally{external.client.destroy();}
