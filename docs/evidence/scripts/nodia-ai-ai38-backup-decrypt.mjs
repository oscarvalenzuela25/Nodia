// Operator Windows only; RSA private key stays on this host. No plaintext stdout.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {createReadStream,createWriteStream} from 'node:fs';
import {readFile,unlink} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const base='C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-ai-backup-20261020-r01';
const output=base+'-quarantine.dump';
const {DecryptNodiaAiBackupUseCase}=await import(pathToFileURL('C:/Users/Oscar/Desktop/Nodia/nodia-server/dist/nodia-ai-recovery/use-case/encrypt-nodia-ai-backup.use-case.js'));
assert.equal(process.platform,'win32');
try {
 const receipt=await new DecryptNodiaAiBackupUseCase().execute({source:createReadStream(base+'-verification.enc'),destination:createWriteStream(output,{flags:'r+'}),private_key_pem:await readFile(base+'-private.pem','utf8'),backup_id:'ecc22075-821d-404f-ab33-9a6b3137eefa',max_cipher_bytes:384388,signal:AbortSignal.timeout(15000)});
 console.log(JSON.stringify({status:'authenticated_AES_256_GCM_decryption_passed',...receipt,private_key_sent_to_VM:false,plaintext_in_workspace:false}));
}catch{await unlink(output);throw Error('operator_decryption_failed_quarantine_removed');}
