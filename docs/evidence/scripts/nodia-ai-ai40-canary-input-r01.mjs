// Operator-only. Read public connection configuration in a read-only SQL transaction.
// Output is private stdin for the isolated real canary, never a public evidence file.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const cfg = require('dotenv').parse(fs.readFileSync(process.env.DOTENV_CONFIG_PATH));
const env = { ...cfg, ...process.env };
const { DataSource } = require('typeorm');
const db = new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),
 database:env.POSTGRES_DB,username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,
 ssl:env.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
 synchronize:false,migrationsRun:false,logging:false,extra:{connectionTimeoutMillis:5000,statement_timeout:5000}});
try {
 await db.initialize();
 const rows = await db.transaction(async m => {
  await m.query('SET TRANSACTION READ ONLY');
  return m.query(`SELECT p.id::text,p.is_active,p.use_token_plan_agentic,p.updated_at,
   p.fields->'token_plan_agentic' AS agentic_fields,c.is_active AS catalog_active,c.can_use_token_plan_agentic
   FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
   WHERE p.id=$1 AND c.key='openai'`,[process.env.AI40_CONNECTION_ID]);
 });
 assert.equal(rows.length,1); const r=rows[0]; const f=r.agentic_fields;
 for(const k of ['is_active','catalog_active','use_token_plan_agentic','can_use_token_plan_agentic']) assert.equal(r[k],true);
 assert.ok(f && typeof f==='object' && typeof f.selected_model==='string' && f.selected_model.trim());
 assert.ok(Array.isArray(f.available_models) && f.available_models.some(m=>m.id===f.selected_model));
 const levels=f.thinking_levels && typeof f.thinking_levels==='object' && !Array.isArray(f.thinking_levels) ? f.thinking_levels : {};
 const effort=Object.hasOwn(levels,f.selected_model)?levels[f.selected_model]:(f.thinking_level??null);
 assert.ok(effort===null || typeof effort==='string' && /^[a-z][a-z0-9_-]{0,31}$/.test(effort));
 const native=path.join(path.dirname(require.resolve('@openai/codex-linux-x64/package.json')),'vendor/x86_64-unknown-linux-musl/bin/codex');
 const binarySha=createHash('sha256').update(fs.readFileSync(native)).digest('hex');
 assert.equal(binarySha,'9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c');
 process.stdout.write(JSON.stringify({schema_version:1,authorize_one_real_generation:true,
 selection:{connection_id:r.id,mode:'token_plan_agentic',model_id:f.selected_model,effort_id:effort},
 provider:{is_active:r.is_active,catalog_active:r.catalog_active,use_token_plan_agentic:r.use_token_plan_agentic,
 can_use_token_plan_agentic:r.can_use_token_plan_agentic,updated_at:r.updated_at.toISOString(),agentic_fields:f},expected_binary_sha256:binarySha}));
} finally { if(db.isInitialized) await db.destroy(); }
