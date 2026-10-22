/** Read-only operational schema/job projection; no domain values or provider calls. */
import fs from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016',require=createRequire(runtime+'/package.json'),values=require('dotenv').parse(fs.readFileSync(runtime+'/.env'));
const {Client}=require('pg');const db=new Client({host:values.POSTGRES_HOST,port:Number(values.POSTGRES_PORT),user:values.POSTGRES_USER,password:values.POSTGRES_PASSWORD,database:values.POSTGRES_DB,options:'-c default_transaction_read_only=on'});
try{await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");
const [shape]=(await db.query("SELECT (SELECT count(*)::int FROM migrations) AS migrations,(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'nodia_ai_%') AS tables,(SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS columns,(SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='nodia_ai_preferences') AS preference_columns,(SELECT count(*)::int FROM nodia_ai_preferences) AS preferences")).rows;
assert.equal(shape.migrations,27);assert.equal(shape.tables,20);assert.equal(shape.columns,279);assert.equal(shape.preference_columns,12);assert.equal(shape.preferences,0);
const jobs=(await db.query("SELECT kind,state,count(*)::int AS count,count(*) FILTER(WHERE available_at>clock_timestamp())::int AS future_count FROM nodia_ai_jobs WHERE state IN ('ready','waiting','leased','unknown') GROUP BY kind,state ORDER BY kind,state")).rows;
const readOnly=(await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only;await db.query('ROLLBACK');
console.log(JSON.stringify({stage:'AI-33',scope:'current_schema_and_due_vs_future_job_metadata',status:'passed',transaction_read_only:readOnly,schema:shape,nonterminal_jobs:jobs,provider_generations:0,storage_operations:0,domain_values_exported:false},null,2));
}finally{await db.end();}
