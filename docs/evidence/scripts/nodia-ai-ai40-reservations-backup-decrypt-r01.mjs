// Windows custodian only. Never emits key/dump bytes; failed GCM removes quarantine.
import assert from 'node:assert/strict';
import {createReadStream,createWriteStream}from'node:fs';
import {readFile,unlink,stat}from'node:fs/promises';
import {createHash}from'node:crypto';
import {createRequire}from'node:module';
import {pathToFileURL}from'node:url';
const root='C:/Users/Oscar/Desktop/Nodia/.tmp/ai40-r07-selective-r01/server';
const quarantine='C:/Users/Oscar/Documents/NodiaVMs/ai40-reservations-install-r01';
const ciphertext=quarantine+'/backup.enc',output=quarantine+'/authenticated.dump';
const privateKey='C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-ai-backup-20261020-r01-private.pem';
const [receiptPath,...extra]=process.argv.slice(2);assert.equal(process.platform,'win32');assert.equal(extra.length,0);assert.ok(receiptPath);
const source='dist/nodia-ai-recovery/use-case/encrypt-nodia-ai-backup.use-case.js';
const digest=x=>createHash('sha256').update(x).digest('hex');
assert.equal(digest(await readFile(root+'/release-manifest.json')),'1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476');
assert.equal(digest(await readFile(root+'/'+source)),'f2b7c9318d2c9e1cccb73e6b597078f1b25a32aa180fcc742d48f9fa8add06b8');
const data=JSON.parse(await readFile(receiptPath,'utf8'));const receipt=data.backup;
assert.equal(data.status,'ready');assert.equal(receipt.status,'ready');assert.equal(receipt.operation,'backup');assert.equal((await stat(ciphertext)).size,receipt.cipher_bytes);
const hash=createHash('sha256');for await(const chunk of createReadStream(ciphertext))hash.update(chunk);assert.equal(hash.digest('hex'),receipt.cipher_sha256);
const require=createRequire(root+'/package.json');require('reflect-metadata');const {DecryptNodiaAiBackupUseCase}=await import(pathToFileURL(root+'/'+source));
let created=false;
try{
 const destination=createWriteStream(output,{flags:'wx',mode:0o600});await new Promise((ok,bad)=>{destination.once('open',()=>{created=true;ok();});destination.once('error',bad);});
 const result=await new DecryptNodiaAiBackupUseCase().execute({source:createReadStream(ciphertext),destination,private_key_pem:await readFile(privateKey,'utf8'),backup_id:receipt.backup_id,max_cipher_bytes:receipt.cipher_bytes,signal:AbortSignal.timeout(30000)});
 const plainHash=createHash('sha256');for await(const chunk of createReadStream(output))plainHash.update(chunk);
 console.log(JSON.stringify({schema:'nodia-ai-ai40-private-backup-decryption-v1',status:'authenticated',backup_id:receipt.backup_id,cipher_sha256:receipt.cipher_sha256,plain_bytes:result.plain_bytes,plain_sha256:plainHash.digest('hex'),private_key_sent_to_VM:false,plaintext_in_workspace:false,release_manifest_sha256:'1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'}));
}catch{if(created)await unlink(output);throw Error('private_decryption_failed_owned_quarantine_removed');}
