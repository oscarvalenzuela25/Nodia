// Read-only SQL acceptance projection; never prints message bodies, tool arguments, credentials or business rows.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(path.join(process.cwd(),'package.json'));
const cfg=require('dotenv').parse(fs.readFileSync(process.env.DOTENV_CONFIG_PATH));
const e={...cfg,...process.env};const {DataSource}=require('typeorm');
const db=new DataSource({type:'postgres',host:e.POSTGRES_HOST,port:Number(e.POSTGRES_PORT),database:e.POSTGRES_DB,username:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,synchronize:false,migrationsRun:false,logging:false,extra:{connectionTimeoutMillis:5000,statement_timeout:5000}});
try{await db.initialize();const rows=await db.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');return m.query("SELECT id::text,updated_at,fields->'token_plan_agentic'->'available_models' AS models FROM ai_providers WHERE id=1");});console.log(JSON.stringify({stage:'AI40',status:'public_catalog_read_only',rows,configured_SQL_writes:0}));}finally{if(db.isInitialized)await db.destroy();}
