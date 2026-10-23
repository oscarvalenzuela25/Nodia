// Read-only SQL acceptance projection; never prints message bodies, tool arguments, credentials or business rows.
import { createRequire } from 'node:module';
import fs from 'node:fs';
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
  return {chat,messages,runs,tools,jobs,pending};
 });console.log(JSON.stringify({stage:'AI40',status:'sql_read_only',observed_at_VM_utc:new Date().toISOString(),...out,configured_SQL_writes:0,private_content_emitted:false}));
}finally{if(db.isInitialized)await db.destroy();}
