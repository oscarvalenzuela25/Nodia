import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire('/opt/nodia/nodia-server/package.json');
const {Client}=require('pg'); const {parse}=require('dotenv');
const env=parse(fs.readFileSync('/opt/nodia/nodia-server/.env'));
const db=new Client({host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB});
await db.connect();
try{
 await db.query('BEGIN READ ONLY');
 const migrationTables=await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%migration%'");
 const migrations=await db.query('SELECT name FROM migrations ORDER BY timestamp');
 const tables=await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'nodia_ai_%' OR table_name LIKE '%rental%' OR table_name LIKE '%finance%') ORDER BY table_name");
 const modules=await db.query("SELECT key,link,is_active FROM modules WHERE key ILIKE '%nodia%' OR key ILIKE '%rental%' OR key ILIKE '%finance%' ORDER BY key");
 const admins=await db.query("SELECT count(DISTINCT ur.user_id)::int AS super_admin_users FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.key='super_admin'");
 const assignment=await db.query("SELECT m.key,count(um.user_id)::int AS assigned_users,count(ur.user_id)::int AS super_admin_assignments FROM modules m LEFT JOIN user_modules um ON um.module_id=m.id LEFT JOIN user_roles ur ON ur.user_id=um.user_id AND ur.role_id IN (SELECT id FROM roles WHERE key='super_admin') WHERE m.key ILIKE '%nodia%' GROUP BY m.key ORDER BY m.key");
 console.log(JSON.stringify({migration_tables:migrationTables.rows,migrations:migrations.rows,tables:tables.rows,modules:modules.rows,admins:admins.rows,assignments:assignment.rows},null,2));
 await db.query('ROLLBACK');
}finally{await db.end();}
