/** One real compiled StorageService smoke test; no listing or bearer URLs. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';

if(!process.argv.includes('--live'))throw new Error('explicit_live_flag_required');
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(path.join(runtime,'package.json'));
const values=require('dotenv').parse(fs.readFileSync(path.join(runtime,'.env')));
for(const key of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_ENDPOINT'])process.env[key]=values[key]??'';
process.env.AWS_MAX_ATTEMPTS='1';process.env.AWS_EC2_METADATA_DISABLED='true';
const hash=(data)=>createHash('sha256').update(data).digest('hex');
const compiled=path.join(runtime,'dist/common/storage/storage.service.js');
const {StorageService}=await import(pathToFileURL(compiled).href);
const storage=new StorageService(), client=storage.s3Client;
const id=randomUUID(), key='nodia-ai/verification/ai32-r05-'+id+'.txt';
const content=Buffer.from('NODIA_R2_SYNTHETIC_CANARY\n'+id+'\n','utf8');
const statePath='/opt/nodia/verification/ai32-r05-r2-state-'+id+'.json';
const report={stage:'AI-32-R05',scope:'real_compiled_storage_synthetic_object_smoke_before_single_attempt_code_change',
 status:'running',observed_at_utc:new Date().toISOString(),compiled_storage_sha256:hash(fs.readFileSync(compiled)),
 object_identity_digest_sha256:hash(key),synthetic_payload_bytes:content.length,synthetic_payload_sha256:hash(content),
 operations:[],provider_generations:0,configured_database_modified:false,object_listing_requested:false,
 signed_urls_generated:false,endpoint_bucket_or_credentials_exported:false,automatic_put_replays:0};
let phase='configuration',putAttempted=false;
const saveState=()=>{
 const fd=fs.openSync(statePath,fs.existsSync(statePath)?'w':'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify({stage:'AI-32-R05',id,key,phase}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
};
try{
 if(!client||await client.config.maxAttempts()!==1)throw new Error('single_attempt_required');
 report.test_process_sdk_max_attempts=1;
 client.middlewareStack.addRelativeTo((next,context)=>async(args)=>{
  const name=context.commandName;
  if(!['PutObjectCommand','GetObjectCommand','DeleteObjectCommand'].includes(name))throw new Error('unexpected_command');
  const item={command:name,phase,http_status:null};report.operations.push(item);
  if(report.operations.length>4)throw new Error('command_budget');
  try{const result=await next(args);const status=result.output?.$metadata?.httpStatusCode;
   if(Number.isInteger(status)&&status>=100&&status<=599)item.http_status=status;return result;
  }catch(error){const status=error?.$metadata?.httpStatusCode;
   if(Number.isInteger(status)&&status>=100&&status<=599)item.http_status=status;
   item.safe_error_category=['NoSuchKey','NotFound','AccessDenied','AbortError','TimeoutError'].includes(error?.name)?error.name:'storage_error';throw error;}
 },{relation:'after',toMiddleware:'retryMiddleware',name:'nodiaR05CanaryBudget'});
 phase='put';saveState();putAttempted=true;
 const returned=await storage.uploadFile(key,content,'text/plain',AbortSignal.timeout(15000));
 report.put_returned_exact_identity=returned===key;
 phase='get';saveState();
 const result=await storage.downloadFile(key,4096,AbortSignal.timeout(15000));
 report.download_bytes=result.length;report.download_sha256=hash(result);report.download_matches=result.equals(content);
 if(!report.download_matches)throw new Error('content_mismatch');
}catch{report.safe_failure_phase=phase;}
finally{
 if(putAttempted){
  try{phase='delete';saveState();await storage.deleteFile(key);report.delete_completed=true;
   phase='verify_absent';saveState();
   try{await storage.downloadFile(key,4096,AbortSignal.timeout(10000));report.object_absence_verified=false;}
   catch(error){report.object_absence_verified=error?.$metadata?.httpStatusCode===404 && ['NoSuchKey','NotFound'].includes(error?.name);}
  }catch{report.cleanup_safe_failure_phase=phase;}
 }
 if(report.object_absence_verified){fs.unlinkSync(statePath);report.cleanup_identity_record_removed=true;}
 else report.cleanup_identity_record_retained=putAttempted;
 client?.destroy();
}
report.status=report.put_returned_exact_identity&&report.download_matches&&report.delete_completed&&report.object_absence_verified?'passed':'gates_open';
report.completed_at_utc=new Date().toISOString();console.log(JSON.stringify(report,null,2));
if(report.status!=='passed')process.exitCode=1;
