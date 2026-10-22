import fs from 'node:fs';import {createRequire} from 'node:module';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(root+'/.env')));
const {Client}=require('pg');const db=new Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});await db.connect();
try{
 const chat='d4f0be72-b593-4dc2-80f5-bc5e1dc5db63';
 const run=(await db.query(`SELECT id,state,phase,error_code,revision,actor_id,created_at,completed_at,assistant_message_id,tool_calls_used,mcp_rpc_messages_used,provider_dispatches_used FROM nodia_ai_runs WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1`,[chat])).rows[0];
 const calls=(await db.query('SELECT id,tool_name,contract_hash,state,completed_at,arguments,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 ORDER BY created_at',[run.id])).rows;
 const events=(await db.query('SELECT id,seq::text,public_payload FROM nodia_ai_events WHERE run_id=$1 ORDER BY seq',[run.id])).rows;
 const receipt=calls.find(call=>call.tool_name==='nodia_businesses_list');
 let comparison=null;
 if(receipt&&receipt.arguments.activity==='inactive'&&!receipt.arguments.all_businesses&&(!receipt.arguments.q||Object.keys(receipt.arguments.q).length===0)){
  const count=(await db.query(`SELECT count(*)::text total FROM businesses b WHERE b.is_active=false AND (b.owner_id=$1 OR EXISTS(SELECT 1 FROM business_collaborators bc WHERE bc.business_id=b.id AND bc.user_id=$1 AND bc.is_active=true))`,[run.actor_id])).rows[0].total;
  comparison={filters:{activity:'inactive',all_businesses:receipt.arguments.all_businesses??false,page:receipt.arguments.page??1,limit:receipt.arguments.limit??25,additional_filter_keys:[]},receipt_total:String(receipt.public_result?.meta?.total_items),returned:Array.isArray(receipt.public_result?.data)?receipt.public_result.data.length:null,current_sql_total:count,matches:String(receipt.public_result?.meta?.total_items)===count};
 }
 const report={stage:'AI-16',scope:'configured_local_lab_real_ui_agentic_mcp_read_only',checked_at:new Date().toISOString(),conversation_id:chat,run:{id:run.id,state:run.state,phase:run.phase,error_code:run.error_code,revision:run.revision,created_at:run.created_at,completed_at:run.completed_at,assistant_sealed:!!run.assistant_message_id,tool_calls:run.tool_calls_used,rpc_messages:run.mcp_rpc_messages_used,provider_dispatches:run.provider_dispatches_used},events:events.map(event=>({id:event.id,seq:event.seq,kind:event.public_payload.kind})),tool_receipts:calls.map(call=>({id:call.id,name:call.tool_name,state:call.state,contract_hash:call.contract_hash,completed_at:call.completed_at})),comparison,event_refs_match_receipts:events.filter(event=>event.public_payload.kind==='tool_completed').every(event=>calls.some(call=>call.id===event.public_payload.payload.result_ref.tool_call_id&&call.tool_name===event.public_payload.payload.result_ref.tool_name&&call.contract_hash===event.public_payload.payload.result_ref.contract_hash)),pending_jobs:(await db.query("SELECT count(*)::int total FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')")).rows[0].total,generations_by_auditor:0,handlers_executed_by_auditor:0,business_writes:0};
 console.log(JSON.stringify(report));
}finally{await db.end();}
