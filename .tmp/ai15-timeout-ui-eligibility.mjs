import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');Object.assign(process.env,require('dotenv').parse(fs.readFileSync(root+'/.env')));
const{default:baseDb}=await import(root+'/dist/config/data-source.js');const{DataSource}=require('typeorm');const db=new DataSource(baseDb.options);const{lockAuthority,currentActor}=await import(root+'/dist/authorization/authority-transaction.js');await db.initialize();
try{
 const prepared=await db.transaction(async manager=>{
  await lockAuthority(manager);
  const rows=await manager.query("SELECT DISTINCT u.id,u.name,u.email,u.image_url FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active AND ur.is_active AND r.is_active AND r.key='super_admin'");assert.equal(rows.length,1);const user=rows[0];
  const sessions=await manager.query('SELECT public_id,expires_at FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY created_at DESC,id DESC LIMIT 1',[user.id]);assert.equal(sessions.length,1);const session=sessions[0];
  assert.equal((await currentActor(manager,{userId:user.id,sessionId:session.public_id})).isSuperAdmin,true);return{user,session};
 });
 const{AuthTokenService}=await import(root+'/dist/auth/auth-token.service.js');const{readAuthConfig}=await import(root+'/dist/auth/auth.config.js');const{JwtService}=require('@nestjs/jwt');const issued=await new AuthTokenService(new JwtService(),readAuthConfig(process.env)).issue(prepared.user,prepared.session.public_id,prepared.session.expires_at);
 const snapshot=JSON.parse(fs.readFileSync('/tmp/nodia-ai-timeout-selection-full-20261016.json','utf8'));const row=snapshot.rows.find(x=>x.connection_id==='2'&&x.provider_key==='gemini');assert.ok(row&&row.is_active);
 for(const prefix of ['agentic','web']){
  assert.ok(typeof row[prefix+'_model']==='string'&&row[prefix+'_model']);const query=new URLSearchParams({mode:'token_plan_'+prefix,model_id:row[prefix+'_model']});if(row[prefix+'_effort']!==null)query.set('effort_id',row[prefix+'_effort']);
  const start=performance.now();try{
   const response=await fetch('http://127.0.0.1:3000/api/v1/nodia-ai/connections/2/eligibility?'+query,{headers:{authorization:'Bearer '+issued.response.token},signal:AbortSignal.timeout(30000)});const body=await response.json();const value=body.data??body;
   console.log(JSON.stringify({mode:'token_plan_'+prefix,selection_from_exact_snapshot:true,http_status:response.status,elapsed_ms:Math.round(performance.now()-start),available:typeof value.available==='boolean'?value.available:null,supports_mcp:typeof value.supports_mcp==='boolean'?value.supports_mcp:null,reason:typeof value.reason==='string'&&/^nodia_ai:[a-z_]{1,70}$/.test(value.reason)?value.reason:value.reason===null?null:'unknown_response',jwt_persisted_or_printed:false,generations:0}));
  }catch(error){console.log(JSON.stringify({mode:'token_plan_'+prefix,exception_type:new Set(['TimeoutError','AbortError','TypeError']).has(error.name)?error.name:'Other',elapsed_ms:Math.round(performance.now()-start),jwt_persisted_or_printed:false,generations:0}));}
 }
}finally{if(db.isInitialized)await db.destroy();}
