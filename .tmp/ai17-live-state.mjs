import fs from 'node:fs';
import {createRequire} from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(runtime+'/package.json');
const env=require('dotenv').parse(fs.readFileSync(runtime+'/.env'));
const {Client}=require('pg');
const db=new Client({host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD});
await db.connect();
try {
 const row=(await db.query(`SELECT
 (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'nodia_ai_%') AS nodia_ai_tables,
 (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('nodia_ai_drafts','nodia_ai_proposals','nodia_ai_proposal_revisions','nodia_ai_proposal_steps')) AS m2_columns,
 (SELECT count(*)::int FROM migrations) AS migrations,
 (SELECT count(*)::int FROM nodia_ai_drafts) AS drafts,
 (SELECT count(*)::int FROM nodia_ai_proposals) AS proposals,
 (SELECT count(*)::int FROM nodia_ai_proposal_revisions) AS proposal_revisions,
 (SELECT count(*)::int FROM nodia_ai_proposal_steps) AS proposal_steps,
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) AS pending_jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) AS open_attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) AS held_or_unknown_slots`)).rows[0];
 if(row.nodia_ai_tables!==15||row.m2_columns!==40||row.migrations!==22||Object.entries(row).some(([key,value])=>!['nodia_ai_tables','m2_columns','migrations'].includes(key)&&value!==0))throw Error('Unexpected live lab state');
 console.log(JSON.stringify({stage:'AI-17',scope:'configured_private_lab_readonly_metadata_and_counts',checked_at_utc:new Date().toISOString(),...row}));
}finally {await db.end();}
