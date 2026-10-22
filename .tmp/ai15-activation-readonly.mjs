import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');const env=require('dotenv').parse(fs.readFileSync(root+'/.env'));
const{Client}=require('pg');const db=new Client({host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB});await db.connect();try{
 await db.query('BEGIN READ ONLY');
 const migrated=(await db.query('SELECT count(*)::int AS n FROM migrations')).rows[0].n;
 const m1=(await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'nodia_ai_%'")).rows[0].n;
 const module=(await db.query("SELECT count(*)::int AS n FROM modules m JOIN module_groups g ON g.id=m.module_group_id WHERE m.key='nodia_ai' AND m.link='/tools/nodia-ai' AND m.is_active AND g.is_active")).rows[0].n;
 const assigned=(await db.query("SELECT count(DISTINCT um.user_id)::int AS n FROM user_modules um JOIN modules m ON m.id=um.module_id JOIN users u ON u.id=um.user_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE m.key='nodia_ai' AND um.is_active AND u.is_active AND ur.is_active AND r.is_active AND r.key='super_admin'")).rows[0].n;
 const counts={};for(const table of ['nodia_ai_conversations','nodia_ai_jobs','nodia_ai_runs','nodia_ai_tool_calls'])counts[table]=(await db.query('SELECT count(*)::int AS n FROM '+table)).rows[0].n;
 const pending=(await db.query("SELECT count(*)::int AS n FROM nodia_ai_jobs WHERE state NOT IN ('done','failed','cancelled')")).rows[0].n;
 await db.query('ROLLBACK');assert.equal(migrated,20);assert.equal(m1,11);assert.equal(module,1);assert.equal(assigned,1);
 console.log(JSON.stringify({checked_at:new Date().toISOString(),read_only:true,migration_rows:migrated,nodia_ai_tables:m1,active_nodia_ai_module_count:module,active_super_admin_assigned_count:assigned,counts,pending_jobs:pending,configured_database_read_only_for_this_check:true},null,2));
}finally{await db.end();}
