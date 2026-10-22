import fs from 'node:fs';
import {createRequire} from 'node:module';
const base='/home/operador/nodia-ai-verification/server';const require=createRequire(base+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync('/opt/nodia/nodia-server/.env')));
const {default:db}=await import(base+'/dist/config/data-source.js');const{MigrationExecutor}=require('typeorm');
await db.initialize();try{console.log(JSON.stringify({pending:(await new MigrationExecutor(db).getPendingMigrations()).map(m=>m.name),executed_count:(await db.query('SELECT count(*)::int AS n FROM migrations'))[0].n,nodia_ai_tables:(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%' ORDER BY table_name")).map(x=>x.table_name)},null,2));}finally{await db.destroy();}
