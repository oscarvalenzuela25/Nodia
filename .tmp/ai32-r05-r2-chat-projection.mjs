/** Read-only metadata and optional bounded private GETs for the one R05 chat. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const conversation='33d6c32d-19a3-4533-8077-3ca7299d30cb';
const require=createRequire(path.join(runtime,'package.json'));
const values=require('dotenv').parse(fs.readFileSync(path.join(runtime,'.env')));
const {Client}=require('pg');
const db=new Client({host:values.POSTGRES_HOST,port:Number(values.POSTGRES_PORT),user:values.POSTGRES_USER,
 password:values.POSTGRES_PASSWORD,database:values.POSTGRES_DB,options:'-c default_transaction_read_only=on'});
const report={stage:'AI-32-R05',scope:'single_chat_read_only_metadata_and_private_cloud_digest',
 observed_at_utc:new Date().toISOString(),conversation_id:conversation,status:'running',
 provider_generations:0,database_modified:false,storage_mutations:0,signed_urls_generated:false,
 message_text_or_interpretations_exported:false,storage_keys_or_credentials_exported:false};
let phase='database_connect',storage;
const hash=(content)=>createHash('sha256').update(content).digest('hex');
try{
 await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");
 report.default_transaction_read_only=(await db.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only;
 report.transaction_read_only=(await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only;
 phase='metadata_snapshot';
 const attachments=(await db.query(`SELECT a.id,a.kind,a.state,a.byte_count::text,a.media_type,a.content_hash,a.page_count,a.duration_seconds,
  a.interpretation_revision,a.interpretation_reviewed,a.interpretation_origin,(a.interpretation_text IS NOT NULL) AS has_interpretation,
  (SELECT count(*)::int FROM nodia_ai_message_parts p WHERE p.conversation_id=a.conversation_id AND p.attachment_id=a.id) AS linked_message_parts,
  a.storage_key FROM nodia_ai_attachments a WHERE a.conversation_id=$1 ORDER BY a.created_at,a.id LIMIT 8`,[conversation])).rows;
 report.total_attachment_rows=(await db.query('SELECT count(*)::int AS count FROM nodia_ai_attachments WHERE conversation_id=$1',[conversation])).rows[0].count;
 report.messages=(await db.query('SELECT role,status,count(*)::int AS count,count(sealed_at)::int AS sealed_count FROM nodia_ai_messages WHERE conversation_id=$1 GROUP BY role,status ORDER BY role,status',[conversation])).rows;
 report.message_parts=(await db.query('SELECT kind,count(*)::int AS count,count(attachment_id)::int AS attachment_reference_count FROM nodia_ai_message_parts WHERE conversation_id=$1 GROUP BY kind ORDER BY kind',[conversation])).rows;
 report.runs=(await db.query(`SELECT id,state,phase,error_code,provider_dispatches_used,tool_calls_used,delegations_used FROM nodia_ai_runs WHERE conversation_id=$1 ORDER BY created_at LIMIT 10`,[conversation])).rows;
 report.jobs=(await db.query('SELECT kind,state,count(*)::int AS count,sum(attempt_count)::int AS attempt_count FROM nodia_ai_jobs WHERE conversation_id=$1 GROUP BY kind,state ORDER BY kind,state',[conversation])).rows;
 report.attempts=(await db.query(`SELECT a.phase,count(*)::int AS count,count(*) FILTER(WHERE a.ended_at IS NULL)::int AS open_count FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.conversation_id=$1 GROUP BY a.phase ORDER BY a.phase`,[conversation])).rows;
 await db.query('ROLLBACK');
 report.attachments=attachments.map(({storage_key,...safe})=>safe);
 const expected=[{kind:'image',media_type:'image/png',bytes:29076,sha256:'e66411ae91976c0626a45a1b5e151cb49e76b0b60aac135a59395bccf20d78d7'},
  {kind:'pdf',media_type:'application/pdf',bytes:765,sha256:'3597b3465cad3b2770a88929eb5b39366aa0b324c7283de84ebc56501157485d'}];
 report.expected_synthetic_fixture_matches=expected.map(item=>({kind:item.kind,sha256:item.sha256,byte_count:item.bytes,
  matching_attachment_count:attachments.filter(row=>row.kind===item.kind&&row.media_type===item.media_type&&row.byte_count===String(item.bytes)&&row.content_hash===item.sha256).length}));
 if(process.argv.includes('--verify-cloud')){
  phase='private_cloud_get';
  for(const key of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_ENDPOINT'])process.env[key]=values[key]??'';
  const {StorageService}=await import(pathToFileURL(path.join(runtime,'dist/common/storage/storage.service.js')).href);
  storage=new StorageService();report.cloud_reads=[];
  const ready=attachments.filter(row=>row.state==='ready');
  if(ready.length>4||ready.reduce((total,row)=>total+Number(row.byte_count),0)>2*1024*1024)throw new Error('verification_budget');
  for(const row of ready){
   const bytes=Number(row.byte_count);if(!Number.isSafeInteger(bytes)||bytes<1||bytes>2*1024*1024)throw new Error('invalid_metadata');
   const data=await storage.downloadFile(row.storage_key,bytes,AbortSignal.timeout(15000));
   report.cloud_reads.push({attachment_id:row.id,bytes:data.length,sha256:hash(data),
    matches_persisted_metadata:data.length===bytes&&hash(data)===row.content_hash});
  }
 }
 report.status='passed';
}catch{report.status='failed';report.safe_failure_phase=phase;process.exitCode=1;}
finally{storage?.onModuleDestroy();try{await db.end();}catch{}}
report.completed_at_utc=new Date().toISOString();console.log(JSON.stringify(report,null,2));
