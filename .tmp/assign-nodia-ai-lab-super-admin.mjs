// One-module installation step; never rewrites existing module associations or roles.
import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';
const root='/opt/nodia/releases/nodia-server-ai15-20261016';const require=createRequire(root+'/package.json');
Object.assign(process.env,require('dotenv').parse(fs.readFileSync(root+'/.env')));
const {default:db}=await import(root+'/dist/config/data-source.js');
const {lockAuthority,currentActor}=await import(root+'/dist/authorization/authority-transaction.js');
const Redis=require('ioredis').default;const apply=process.argv.includes('--apply');let targetEmail;let changed=0;
await db.initialize();try{
 await db.transaction(async manager=>{
  await lockAuthority(manager,true);
  const admins=await manager.query("SELECT DISTINCT u.id,u.email FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active AND ur.is_active AND r.is_active AND r.key='super_admin'");
  assert.equal(admins.length,1,'Only the unique active super_admin is eligible');const user=admins[0];
  const sessions=await manager.query('SELECT public_id FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() ORDER BY created_at DESC,id DESC LIMIT 1',[user.id]);
  assert.equal(sessions.length,1,'An existing real active administrator session is required');
  assert.equal((await currentActor(manager,{userId:user.id,sessionId:sessions[0].public_id})).isSuperAdmin,true);
  const modules=await manager.query("SELECT m.id FROM modules m JOIN module_groups g ON g.id=m.module_group_id WHERE m.key='nodia_ai' AND m.link='/tools/nodia-ai' AND m.is_active AND g.is_active");
  assert.equal(modules.length,1);const module=modules[0];
  const beforeModules=await manager.query('SELECT * FROM user_modules WHERE user_id=$1 AND module_id<>$2 ORDER BY id',[user.id,module.id]);
  const beforeRoles=await manager.query('SELECT * FROM user_roles WHERE user_id=$1 ORDER BY id',[user.id]);
  if(apply){
   const result=await manager.query('INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true) ON CONFLICT(user_id,module_id) DO UPDATE SET is_active=true,updated_at=now() WHERE user_modules.is_active=false RETURNING id',[user.id,module.id]);
   changed=result.length;
   assert.deepEqual(await manager.query('SELECT * FROM user_modules WHERE user_id=$1 AND module_id<>$2 ORDER BY id',[user.id,module.id]),beforeModules);
   assert.deepEqual(await manager.query('SELECT * FROM user_roles WHERE user_id=$1 ORDER BY id',[user.id]),beforeRoles);
   assert.equal((await manager.query('SELECT count(*)::int AS n FROM user_modules WHERE user_id=$1 AND module_id=$2 AND is_active',[user.id,module.id]))[0].n,1);
   targetEmail=user.email.trim().toLowerCase();
  }
 });
}finally{await db.destroy();}
let invalidated=false;
if(apply){
 const redis=new Redis({host:process.env.REDIS_HOST,port:Number(process.env.REDIS_PORT||6379),password:process.env.REDIS_PASSWORD||undefined,maxRetriesPerRequest:1,lazyConnect:true,retryStrategy:()=>null});
 redis.on('error',()=>{});
 try{await redis.connect();const key='auth:context:'+targetEmail;await redis.del(key);assert.equal(await redis.exists(key),0);invalidated=true;}
 finally{redis.disconnect();}
}
console.log(JSON.stringify({applied:apply,only_unique_active_super_admin:true,module_key:'nodia_ai',changed_associations:changed,other_assignments_and_roles_preserved:true,context_cache_invalidated:invalidated}));
