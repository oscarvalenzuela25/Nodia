/** VM-only disposable DB provisioning. Never loads operational PostgreSQL configuration. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
const runtime='/opt/nodia/verification/ai32-r06-compiled';
const runtimeSource='/opt/nodia/releases/nodia-server-ai15-20261016';
const purpose=process.argv[2];
assert.ok(['purge','invoice'].includes(purpose));
assert.equal(process.platform,'linux');
process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';
const require=createRequire(runtime+'/package.json');require('reflect-metadata');
const {DataSource}=require('typeorm');
const nonce=randomBytes(8).toString('hex');
const name=`nodia_ai32_r06_${purpose}_${nonce}`;
const database=`ai32_r06_${purpose}`,password=randomBytes(24).toString('hex');
const privateRoot=`/opt/nodia/verification-backups/ai32-r06-${purpose}-${nonce}`;
const descriptorPath=privateRoot+'/sandbox.json';
const report={stage:'AI-32-R06',scope:'disposable_sandbox_setup',purpose,status:'running',
 observed_at_utc:new Date().toISOString(),configured_database_used:false,
 provider_generations:0,production_services_restarted:false,credential_values_exported:false};
let started=false,db,phase='preflight';
const docker=(args,env={})=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],
 env:{PATH:process.env.PATH,LANG:'C.UTF-8',...env}}).trim();
try{
 const manifestBytes=await fs.readFile('/tmp/nodia-ai32-r05-storage-candidate/dist-manifest.json');
 assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),'0293d34fe9d320be6b9f696ebdc094e839d5cf5919f25091aa480ee262dfc3b5');
 const manifest=JSON.parse(manifestBytes);assert.equal(Object.keys(manifest).length,909);
 for(const [relative,hash]of Object.entries(manifest)){
  assert.ok(relative.startsWith('dist/')&&!relative.includes('..'));
  assert.equal(createHash('sha256').update(await fs.readFile(runtime+'/'+relative)).digest('hex'),hash);
 }
 docker(['image','inspect','postgres:16-alpine','--format','{{.Id}}']);
 await fs.mkdir(privateRoot,{mode:0o700});
 phase='docker_create';
 docker(['run','-d','--rm','--name',name,'--label','nodia.validation=ai32-r06',
  '--label',`nodia.validation.owner=${nonce}`,'--memory','384m','--cpus','1','--pids-limit','128',
  '--security-opt','no-new-privileges','--tmpfs','/var/lib/postgresql/data:rw,size=128m',
  '-p','127.0.0.1::5432','-e',`POSTGRES_USER=${database}`,'-e',`POSTGRES_DB=${database}`,
  '-e','POSTGRES_PASSWORD','postgres:16-alpine'],{POSTGRES_PASSWORD:password});
 started=true;
 phase='postgres_ready';
 for(let attempt=0;attempt<80;attempt++){
  try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U',database]);break;}
  catch{if(attempt===79)throw Error('postgres_not_ready');await delay(250);}
 }
 const port=Number(docker(['port',name,'5432/tcp']).split(':').at(-1));assert.ok(port>1024&&port<=65535);
 const sandbox={host:'127.0.0.1',port,username:database,password,database};
 const options={type:'postgres',...sandbox,synchronize:false,migrationsRun:false,logging:false,
  entities:[runtime+'/dist/**/*.entity.js'],migrations:[runtime+'/dist/migrations/*.js'],
  extra:{max:3,statement_timeout:15000,connectionTimeoutMillis:5000}};
 phase='migrations';db=await new DataSource(options).initialize();
 const consoleLog=console.log;console.log=()=>{};
 try{await db.runMigrations();}finally{console.log=consoleLog;}
 const [identity]=await db.query('SELECT current_database() AS database,current_user AS username,inet_server_port() AS container_port');
 assert.equal(identity.database,database);assert.equal(identity.username,database);assert.equal(identity.container_port,5432);
 const migrations=(await db.query('SELECT count(*)::int AS n FROM migrations'))[0].n;assert.equal(migrations,26);
 phase='synthetic_seed';const identities={};
 for(const id of ['1','2','3']){
  identities[id]={userId:id,sessionId:randomUUID()};
  await db.query('INSERT INTO users(id,email,name) VALUES($1,$2,$3)',[id,`r06-${purpose}-${id}@example.invalid`,'Synthetic R06']);
  await db.query("INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'synthetic-r06',clock_timestamp()+interval '1 hour')",[identities[id].sessionId,id]);
 }
 await db.query("INSERT INTO user_roles(user_id,role_id) SELECT 3,id FROM roles WHERE key='super_admin'");
 await db.query("INSERT INTO user_modules(user_id,module_id) SELECT u.id,m.id FROM users u CROSS JOIN modules m WHERE m.key='nodia_ai'");
 const descriptor={stage:'AI-32-R06',purpose,server_root:runtime,runtime_source_root:runtimeSource,
  dependency_root:'/opt/nodia/verification/ai32-r02-20261018',migrations_applied:migrations,
  sandbox,identities,ledger_path:privateRoot+'/owned-r2.json',container:name,owner_nonce:nonce};
 await fs.writeFile(descriptorPath,JSON.stringify(descriptor),{mode:0o600,flag:'wx'});
 await fs.writeFile(descriptor.ledger_path,JSON.stringify({stage:'AI-32-R06',purpose,objects:[]}),{mode:0o600,flag:'wx'});
 report.status='passed';report.descriptor_private_path=descriptorPath;report.private_descriptor_mode='0600';
 report.loopback_binding_only=true;report.migrations_applied=migrations;report.synthetic_identities=3;
 report.compiled_files_verified=909;report.test_dependency_available=Boolean(createRequire(descriptor.dependency_root+'/package.json').resolve('@nestjs/testing'));
 report.owned_container_name=name;report.descriptor_contains_no_operational_database_credentials=true;
}catch{
 report.status='failed';report.safe_failure_phase=phase;
 if(started){try{docker(['rm','-f',name]);report.owned_container_removed_after_failure=true;}catch{report.owned_container_removed_after_failure=false;}}
}finally{if(db?.isInitialized)await db.destroy();}
report.completed_at_utc=new Date().toISOString();console.log(JSON.stringify(report,null,2));
if(report.status!=='passed')process.exitCode=1;
