import fs from 'node:fs';import{createRequire}from'node:module';
const require=createRequire('/opt/nodia/nodia-server/package.json');const env=require('dotenv').parse(fs.readFileSync('/opt/nodia/nodia-server/.env'));
const{Client}=require('pg');const db=new Client({host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB});await db.connect();try{
 await db.query('BEGIN READ ONLY');
 const{rows}=await db.query(`SELECT p.id::text AS connection_id,p.is_active,p.use_token_plan_web,p.use_token_plan_agentic,
 c.key AS provider_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic,
 p.fields#>>'{token_plan_web,selected_model}' AS web_model,
 CASE WHEN jsonb_typeof(p.fields#>'{token_plan_web,thinking_levels}')='object' AND (p.fields#>'{token_plan_web,thinking_levels}') ? (p.fields#>>'{token_plan_web,selected_model}') THEN p.fields#>'{token_plan_web,thinking_levels}'->>(p.fields#>>'{token_plan_web,selected_model}') ELSE p.fields#>>'{token_plan_web,thinking_level}' END AS web_effort,
 p.fields#>>'{token_plan_agentic,selected_model}' AS agentic_model,
 CASE WHEN jsonb_typeof(p.fields#>'{token_plan_agentic,thinking_levels}')='object' AND (p.fields#>'{token_plan_agentic,thinking_levels}') ? (p.fields#>>'{token_plan_agentic,selected_model}') THEN p.fields#>'{token_plan_agentic,thinking_levels}'->>(p.fields#>>'{token_plan_agentic,selected_model}') ELSE p.fields#>>'{token_plan_agentic,thinking_level}' END AS agentic_effort
 FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key IN('gemini','openai') ORDER BY p.id`);
 await db.query('ROLLBACK');
 const target='/tmp/nodia-ai-live-selection-full.json';fs.writeFileSync(target,JSON.stringify({observation:'configured_selection_only',rows},null,2),{mode:0o600});const owner=fs.statSync('/home/operador');fs.chownSync(target,owner.uid,owner.gid);fs.chmodSync(target,0o600);
 console.log(JSON.stringify({private_selection_path:target,rows:rows.map(x=>({connection_id:x.connection_id,provider_key:x.provider_key,is_active:x.is_active,has_agentic_model:!!x.agentic_model,agentic_enabled:x.use_token_plan_agentic})),configured_database_modified:false}));
}finally{await db.end();}
