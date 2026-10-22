import fs from 'node:fs';import {createRequire} from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016',require=createRequire(runtime+'/package.json'),values=require('dotenv').parse(fs.readFileSync(runtime+'/.env'));
const {Client}=require('pg'),db=new Client({host:values.POSTGRES_HOST,port:Number(values.POSTGRES_PORT),user:values.POSTGRES_USER,password:values.POSTGRES_PASSWORD,database:values.POSTGRES_DB,options:'-c default_transaction_read_only=on'});
try{await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");
const owner=(await db.query('SELECT owner_id::text FROM nodia_ai_conversations WHERE id=$1',['33d6c32d-19a3-4533-8077-3ca7299d30cb'])).rows[0]?.owner_id;
const roles=(await db.query('SELECT r.id::text,r.key,r.is_active FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1 ORDER BY r.id',[owner])).rows;
const modules=(await db.query('SELECT m.id::text,m.key,m.link AS route,m.is_active,g.is_active AS group_active,EXISTS(SELECT 1 FROM user_modules um WHERE um.user_id=$1 AND um.module_id=m.id) AS assigned FROM modules m JOIN module_groups g ON g.id=m.module_group_id ORDER BY m.id',[owner])).rows;
await db.query('ROLLBACK');console.log(JSON.stringify({stage:'AI-33',scope:'R05_owner_current_module_and_role_metadata_only',status:'passed',observed_at_utc:new Date().toISOString(),actor_id:owner,roles,modules,configuration_modified:false,provider_generations:0,storage_operations:0},null,2));}finally{await db.end();}
