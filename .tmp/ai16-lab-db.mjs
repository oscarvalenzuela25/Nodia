import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(runtime+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(runtime+'/.env')));
const {Client}=require('pg');
const db=new Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
await db.connect();
try {
 if(process.argv[2]==='migrate') {
  const {DataSource}=require('typeorm');
  const {IndexNodiaAiRunEvents1792300000000: Migration}=await import(pathToFileURL(process.argv[3]+'/dist/migrations/1792300000000-IndexNodiaAiRunEvents.js'));
  const names=(await db.query('SELECT name FROM migrations ORDER BY timestamp')).rows.map(row=>row.name);
  if(names.includes(new Migration().name))throw Error('Migration unexpectedly already applied');
  const source=new DataSource({type:'postgres',host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),database:process.env.POSTGRES_DB,username:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,entities:[],migrations:[Migration],synchronize:false});
  await source.initialize();
  try {const applied=await source.runMigrations({transaction:'all'});if(applied.length!==1||applied[0].name!==new Migration().name)throw Error('Unexpected migration');console.log(JSON.stringify({migration:applied[0].name,applied:1}));}finally{await source.destroy();}
 } else {
  const row=(await db.query(`SELECT
   (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) AS pending_jobs,
   (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) AS open_attempts,
   (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) AS held_or_unknown_slots,
   (SELECT count(*)::int FROM migrations) AS migrations,
   current_database() AS database,current_user AS username`)).rows[0];
  console.log(JSON.stringify(row));
 }
} finally {await db.end();}
