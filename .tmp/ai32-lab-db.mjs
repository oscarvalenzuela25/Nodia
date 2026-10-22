import fs from 'node:fs';
import { createRequire } from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(runtime+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(runtime+'/.env')));
const {Client}=require('pg');
const db=new Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
await db.connect();
try {
  const row=(await db.query(`SELECT
   (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) AS pending_jobs,
   (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) AS open_attempts,
   (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) AS held_or_unknown_slots,
   (SELECT count(*)::int FROM migrations) AS migrations,
   (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS nodia_ai_tables,
   (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%') AS nodia_ai_columns,
   (SELECT count(*)::int FROM nodia_ai_proposals) AS proposals,(SELECT count(*)::int FROM nodia_ai_drafts) AS drafts,current_database() AS database,current_user AS username`)).rows[0];
  row.r2_configured=Boolean(process.env.R2_ACCOUNT_ID&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&process.env.R2_BUCKET_NAME);
  console.log(JSON.stringify(row));
} finally {await db.end();}
