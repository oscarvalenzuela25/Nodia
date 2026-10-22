import fs from 'node:fs';
import { createRequire } from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016',require=createRequire(runtime+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(runtime+'/.env')));
require('reflect-metadata');
const {NodiaAiConfirmationModule}=await import(runtime+'/dist/nodia-ai-confirmation/nodia-ai-confirmation.module.js');
const {NODIA_AI_EXECUTION_ADMISSION}=await import(runtime+'/dist/nodia-ai-confirmation/types/execution-admission.types.js');
const admission=Reflect.getMetadata('providers',NodiaAiConfirmationModule).find(provider=>provider.provide===NODIA_AI_EXECUTION_ADMISSION);
if(!Array.isArray(admission?.useValue))throw Error('Missing actual admission registry');
const {Client}=require('pg'),db=new Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
await db.connect();
try {
 const [row]=(await db.query(`SELECT (SELECT count(*)::int FROM migrations) AS migrations,
 (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS tables,
 (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS columns,
 (SELECT count(*)::int FROM nodia_ai_confirmation_challenges) AS challenges,
 (SELECT count(*)::int FROM nodia_ai_executions) AS executions,
 (SELECT count(*)::int FROM nodia_ai_execution_steps) AS execution_steps,
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','waiting','leased','unknown')) AS pending_jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) AS open_attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) AS held_or_unknown_slots`)).rows;
 if(row.migrations!==23||row.tables!==18||row.columns!==239||row.challenges||row.executions||row.execution_steps||row.pending_jobs||row.open_attempts||row.held_or_unknown_slots)throw Error('Unexpected lab state');
 const pin=JSON.parse(fs.readFileSync(runtime+'/dist/nodia-ai-context/config/knowledge-pin.json','utf8'));
 const knowledge=JSON.parse(fs.readFileSync(runtime+'/dist/nodia-ai/knowledge/manifest.json','utf8'));
 console.log(JSON.stringify({stage:'AI-18',scope:'read_only_configured_private_lab',observed_at_utc:new Date().toISOString(),...row,knowledge_release:pin.release_id,published_capabilities:knowledge.capability_contracts.length,published_fragments:knowledge.fragments.length,production_executor_registrations:admission.useValue.length,native_business_execution_enabled:admission.useValue.length>0}));
} finally {await db.end();}
