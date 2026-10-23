// Read-only SQL acceptance projection; never prints message bodies, tool arguments, credentials or business rows.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const require=createRequire(path.join(process.cwd(),'package.json'));
const cfg=require('dotenv').parse(fs.readFileSync(process.env.DOTENV_CONFIG_PATH));
const e={...cfg,...process.env};const {DataSource}=require('typeorm');
const db=new DataSource({type:'postgres',host:e.POSTGRES_HOST,port:Number(e.POSTGRES_PORT),database:e.POSTGRES_DB,username:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,synchronize:false,migrationsRun:false,logging:false,extra:{connectionTimeoutMillis:5000,statement_timeout:5000}});
try{
 await db.initialize();const out=await db.transaction(async m=>{
  await m.query('SET TRANSACTION READ ONLY');
  const id='ec626b72-1f32-4486-9f3a-8263cffce267';
  const chat=await m.query('SELECT id,revision,selected_connection_id,selected_mode,selected_model_id,selected_effort_id,active_job_id,next_message_seq FROM nodia_ai_conversations WHERE id=$1',[id]);
  const messages=await m.query('SELECT id,seq,role,status,sealed_at FROM nodia_ai_messages WHERE conversation_id=$1 ORDER BY seq',[id]);
  const runs=await m.query('SELECT id,state,phase,selection_snapshot,error_code,provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used,assistant_message_id,created_at,completed_at FROM nodia_ai_runs WHERE conversation_id=$1 ORDER BY created_at',[id]);
  const tools=await m.query('SELECT t.id,t.run_id,t.tool_name,t.state FROM nodia_ai_tool_calls t JOIN nodia_ai_runs r ON r.id=t.run_id WHERE r.conversation_id=$1 ORDER BY t.created_at',[id]);
  const jobs=await m.query('SELECT id,state,kind,stage_key FROM nodia_ai_jobs WHERE conversation_id=$1 ORDER BY created_at',[id]);
  const [pending]=await m.query("SELECT (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('leased','unknown')) AS unsettled_jobs,(SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') AS retained_slots");
  const outputs=await m.query("SELECT t.id,t.public_result FROM nodia_ai_tool_calls t JOIN nodia_ai_runs r ON r.id=t.run_id WHERE r.conversation_id=$1 AND t.tool_name='nodia_knowledge_index' AND t.state='completed' ORDER BY t.created_at",[id]);
  const index_projections=outputs.map(row=>({receipt_id:row.id,item_count:row.public_result.items.length,result_utf8_bytes:Buffer.byteLength(JSON.stringify(row.public_result)),result_sha256:createHash('sha256').update(JSON.stringify(row.public_result)).digest('hex'),document_domains:[...new Set(row.public_result.items.map(x=>x.id.split('.')[0]))].sort()}));
  const proposals=await m.query('SELECT p.id,p.current_revision,r.state,r.hash,r.expires_at FROM nodia_ai_proposals p JOIN nodia_ai_proposal_revisions r ON r.proposal_id=p.id AND r.revision=p.current_revision WHERE p.conversation_id=$1',[id]);
  const executions=await m.query('SELECT id,origin_proposal_id,origin_proposal_revision,proposal_hash,state,created_at,completed_at FROM nodia_ai_executions WHERE origin_conversation_id=$1',[id]);
  const steps=await m.query('SELECT s.id,s.execution_id,s.position,s.tool_name,s.state,s.error_code,s.minimal_receipt IS NOT NULL AS receipt_present FROM nodia_ai_execution_steps s JOIN nodia_ai_executions e ON e.id=s.execution_id WHERE e.origin_conversation_id=$1',[id]);
  const challenges=await m.query('SELECT count(*)::integer AS challenges,count(*) FILTER (WHERE c.consumed_at IS NOT NULL)::integer AS consumed FROM nodia_ai_confirmation_challenges c JOIN nodia_ai_proposals p ON p.id=c.proposal_id WHERE p.conversation_id=$1',[id]);
  const movements=await m.query('SELECT id,amount,type,status,user_id,category_id,is_active FROM finance_movements WHERE name=$1',['AI40-UI-CODEX-R01']);
  return {chat,messages,runs,tools,jobs,pending,index_projections,proposals,executions,steps,challenges,movements};
 });console.log(JSON.stringify({stage:'AI40',status:'sql_read_only',observed_at_VM_utc:new Date().toISOString(),...out,configured_SQL_writes:0,private_content_emitted:false}));
}finally{if(db.isInitialized)await db.destroy();}
