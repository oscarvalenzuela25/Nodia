import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');Object.assign(process.env,require('dotenv').parse(fs.readFileSync(root+'/.env')));
const{default:baseDb}=await import(root+'/dist/config/data-source.js');const{DataSource}=require('typeorm');const db=new DataSource(baseDb.options);const{lockAuthority,currentActor}=await import(root+'/dist/authorization/authority-transaction.js');
const chat='4e5848a7-36ae-4ccc-82bb-99a38761963a';await db.initialize();
try{
 const prepared=await db.transaction(async manager=>{
  await lockAuthority(manager);
  const rows=await manager.query("SELECT DISTINCT u.id,u.name,u.email,u.image_url FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active AND ur.is_active AND r.is_active AND r.key='super_admin'");assert.equal(rows.length,1);const user=rows[0];
  const sessions=await manager.query('SELECT public_id,expires_at FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY created_at DESC,id DESC LIMIT 1',[user.id]);assert.equal(sessions.length,1);const session=sessions[0];
  assert.equal((await currentActor(manager,{userId:user.id,sessionId:session.public_id})).isSuperAdmin,true);
  const conversations=await manager.query('SELECT owner_id FROM nodia_ai_conversations WHERE id=$1',[chat]);assert.equal(conversations.length,1);assert.equal(conversations[0].owner_id,user.id);
  const runs=await manager.query('SELECT provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used FROM nodia_ai_runs WHERE conversation_id=$1',[chat]);assert.equal(runs.length,1);assert.equal(runs[0].provider_dispatches_used,1);assert.equal(runs[0].tool_calls_used,0);
  return{user,session,counters:runs[0]};
 });
 const{AuthTokenService}=await import(root+'/dist/auth/auth-token.service.js');const{readAuthConfig}=await import(root+'/dist/auth/auth.config.js');const{JwtService}=require('@nestjs/jwt');
 const issued=await new AuthTokenService(new JwtService(),readAuthConfig(process.env)).issue(prepared.user,prepared.session.public_id,prepared.session.expires_at);
 let operations=0;
 for(let pass=0;pass<3;pass++){
  const jobs=await db.query("SELECT id,kind,state,stage_key FROM nodia_ai_jobs WHERE conversation_id=$1 AND ((kind='turn' AND state='unknown') OR (kind='reconcile' AND stage_key='reconcile_ack')) ORDER BY created_at",[chat]);
  if(!jobs.length)break;
  assert.equal(jobs.length,1,'Reconcile only one known owned conversation job at a time');
  process.env.NODIA_AI_OPERATOR_ACCESS_TOKEN=issued.response.token;
  process.argv=[process.execPath,root+'/scripts/reconcile-nodia-ai-runtime.mjs',jobs[0].id];
  await import(pathToFileURL(root+'/scripts/reconcile-nodia-ai-runtime.mjs').href+'?operatorStep='+pass);
  delete process.env.NODIA_AI_OPERATOR_ACCESS_TOKEN;operations++;
  if(process.exitCode && process.exitCode!==2)throw Error('reconciliation_cli_failed');
  if(process.exitCode===2)await new Promise(resolve=>setTimeout(resolve,500));
 }
 const pending=(await db.query("SELECT count(*)::int AS n FROM nodia_ai_jobs WHERE conversation_id=$1 AND (state NOT IN ('done','failed','cancelled') OR (kind='reconcile' AND stage_key='reconcile_ack'))",[chat]))[0].n;
 const runs=await db.query('SELECT state,error_code,provider_dispatches_used,tool_calls_used,mcp_rpc_messages_used FROM nodia_ai_runs WHERE conversation_id=$1',[chat]);
 assert.deepEqual({provider_dispatches_used:runs[0].provider_dispatches_used,tool_calls_used:runs[0].tool_calls_used,mcp_rpc_messages_used:runs[0].mcp_rpc_messages_used},prepared.counters);
 assert.equal(pending,0);process.exitCode=0;
 console.log(JSON.stringify({operator_reconciliation:true,existing_cli:true,existing_real_admin_session_verified:true,jwt_persisted_or_printed:false,roles_or_sessions_created:false,reconciliation_or_ack_operations:operations,generation_replayed:false,pending_jobs:pending,runs},null,2));
}finally{delete process.env.NODIA_AI_OPERATOR_ACCESS_TOKEN;if(db.isInitialized)await db.destroy();}

