import hashlib,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
def load(path,pin,name):
 p=Path(path);assert not p.is_symlink()and hashlib.sha256(p.read_bytes()).hexdigest()==pin
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
g=load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','continuity_guard');g.validate_release()
h=load(g.HELPER,g.HELPER_SHA,'continuity_transport');h.ACTIVE=g.RELEASE;h.validate_candidate(g.LEGACY_MANIFEST_SHA)
api=h.service('nodia-api');assert api['pid']==3630848 and api['working_directory']==str(g.RELEASE)
env=h.selected_environment(api['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
prefix=(h.CANDIDATE.parent/'public-canary-input.mjs').read_text().split('try {',1)[0]
query=r'''
{
const ROOT='/opt/nodia/releases/nodia-server-ai40-r07',CHAT='ec626b72-1f32-4486-9f3a-8263cffce267',OWNER='1',AUTHORITY='8e4c0db1-6b07-4524-a1cf-f33d09210766';
const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto');const sha=b=>createHash('sha256').update(b).digest('hex');
const {AuthorizeNodiaAiUseCase}=await import(ROOT+'/dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js');
const {NodiaAiAuthorizationService}=await import(ROOT+'/dist/nodia-ai/nodia-ai-authorization.service.js');
const {ValidateNodiaAiRuntimePolicyUseCase}=await import(ROOT+'/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js');
const {NodiaAiReportRegistryUseCase}=await import(ROOT+'/dist/nodia-ai-reports/use-case/nodia-ai-report-registry.use-case.js');
const {DescribeNodiaAiReportsUseCase}=await import(ROOT+'/dist/nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case.js');
const {CompileNodiaAiReportUseCase}=await import(ROOT+'/dist/nodia-ai-reports/use-case/compile-nodia-ai-report.use-case.js');
const {RunNodiaAiReportUseCase}=await import(ROOT+'/dist/nodia-ai-reports/use-case/run-nodia-ai-report.use-case.js');
const {ComposeNodiaAiReportUseCase}=await import(ROOT+'/dist/nodia-ai-reports/use-case/compose-nodia-ai-report.use-case.js');
const {NodiaAiReportToolsUseCase}=await import(ROOT+'/dist/nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js');
const policy=new ValidateNodiaAiRuntimePolicyUseCase().execute(JSON.parse(readFileSync(ROOT+'/dist/nodia-ai-runtime/config/runtime-policy.json','utf8')));
const registry=new NodiaAiReportRegistryUseCase(policy),authorize=new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db));
const describe=new DescribeNodiaAiReportsUseCase(db,registry,authorize),compiler=new CompileNodiaAiReportUseCase();
const run=new RunNodiaAiReportUseCase(db,registry,compiler,authorize,undefined,policy),compose=new ComposeNodiaAiReportUseCase(db,registry,compiler,run,authorize,policy),tools=new NodiaAiReportToolsUseCase(registry,describe,compose);
const sqlObservation={query_runner_statements:0,data_source_entry_checks:0,commands:{},for_share_reads:0,rejected:0};
const readFunctions=new Set(['count','sum','coalesce','jsonb_agg','to_jsonb','jsonb_build_object','jsonb_build_array','jsonb_array_length','jsonb_typeof','encode','sha256','convert_to','clock_timestamp','current_schema','current_database','version','exists','select','lower','upper','substring','octet_length','row_number','bool_or','now','as','over','filter','where','in','and','or','not','from','join','on','materialized','totals','filtered','grouped','page']);
function checkSql(sql){
 if(typeof sql!=='string'||sql.length>131072)throw Error('data_read_SQL_rejected');
 const clean=sql.replace(/'(?:''|[^'])*'/g,"''").replace(/"(?:""|[^"])*"/g,'""').trim().replace(/;$/,'');
 const verb=/^[A-Za-z]+/.exec(clean)?.[0].toUpperCase();
 const fail=(category='statement',token=null)=>{sqlObservation.last_rejection={category,token};sqlObservation.rejected++;throw Error('data_read_SQL_rejected');};
 if(!verb||/[;]|--|\/\*/.test(clean)||/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|COPY|CALL|DO|GRANT|REVOKE|VACUUM|ANALYZE|REFRESH)\b/i.test(clean))fail();
 if(!['SELECT','WITH','SHOW','SET','LOCK','START','COMMIT','ROLLBACK','SAVEPOINT','RELEASE'].includes(verb))fail();
 if(verb==='SET'&&!/^SET (?:LOCAL (?:lock_timeout|statement_timeout)\s*=\s*''|TRANSACTION (?:ISOLATION LEVEL (?:READ COMMITTED|REPEATABLE READ)|READ ONLY))$/i.test(clean))fail();
 if(verb==='LOCK'&&!/^LOCK TABLE [a-z_,\s]+ IN SHARE MODE$/i.test(clean))fail();
 for(const match of clean.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))if(!readFunctions.has(match[1].toLowerCase()))fail('function',match[1].toLowerCase());
 return {verb,forShare:/\bFOR SHARE\b/i.test(clean)};
}
const originalCreateQueryRunner=db.createQueryRunner,originalDataSourceQuery=db.query;
db.createQueryRunner=function(...args){
 const runner=Reflect.apply(originalCreateQueryRunner,this,args),original=runner.query;
 runner.query=function(...queryArgs){const info=checkSql(queryArgs[0]);sqlObservation.query_runner_statements++;if(sqlObservation.query_runner_statements>512)throw Error('data_read_SQL_limit');sqlObservation.commands[info.verb]=(sqlObservation.commands[info.verb]??0)+1;if(info.forShare)sqlObservation.for_share_reads++;return Reflect.apply(original,this,queryArgs);};
 return runner;
};
db.query=function(...args){checkSql(args[0]);sqlObservation.data_source_entry_checks++;return Reflect.apply(originalDataSourceQuery,this,args);};

let phase='initialize';
try{await db.initialize();const seed=await db.transaction('READ COMMITTED',async manager=>{

 const grants=await manager.query(`SELECT g.session_public_id::text,g.allowed_operations ? 'nodia_reports_run' report_run_in_original_grant,g.allowed_operations ? 'nodia_reports_describe' report_describe_in_original_grant FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`,[AUTHORITY,CHAT,OWNER]);if(grants.length!==1)throw Error('exact_grant_missing');
 const identity={userId:OWNER,sessionId:grants[0].session_public_id};await authorize.execute(identity,{moduleRoutes:['/tools/nodia-ai','/tools/business','/tools/finances-personal']},manager);
 const businesses=await manager.query(`SELECT b.id,b.owner_id::text,b.is_active,(SELECT COUNT(*)::int FROM products p WHERE p.business_id=b.id) products,(SELECT COUNT(*)::int FROM providers p WHERE p.business_id=b.id) providers,(SELECT COUNT(*)::int FROM invoices i WHERE i.business_id=b.id) invoices FROM businesses b WHERE owner_id=$1 ORDER BY b.id LIMIT 8`,[OWNER]);
 if(businesses.length!==1)throw Error('owned_business_not_unique');const business=businesses[0];
 const invoices=await manager.query(`SELECT id::text,is_active,CASE WHEN path_storage ~ '^invoices/[a-f0-9-]{36}/[^/]+[.](pdf|png|jpg|jpeg|webp)$' THEN true ELSE false END compatible_path,substring(lower(path_storage) from '[.]([a-z0-9]+)$') extension,encode(sha256(convert_to(path_storage,'UTF8')),'hex') path_sha256,octet_length(path_storage) path_bytes FROM invoices WHERE business_id=$1 ORDER BY id LIMIT 8`,[business.id]);
 const description=await describe.execute(identity,{module_keys:['personal_finance','businesses']},manager);
 const [expected]=await manager.query(`SELECT (SELECT COUNT(*)::text FROM finance_movements WHERE user_id=$1 AND id=2 AND name='AI40-UI-CODEX-R01' AND type='expense' AND status='pending' AND is_active=true) finance_records,(SELECT COALESCE(SUM(CASE WHEN type='expense' AND status='paid' THEN amount ELSE 0 END),0)::text FROM finance_movements WHERE user_id=$1 AND id=2 AND name='AI40-UI-CODEX-R01' AND type='expense' AND status='pending' AND is_active=true) finance_paid_amount,(SELECT COUNT(*)::text FROM invoices WHERE business_id=$2 AND is_active=true) invoice_records`,[OWNER,business.id]);
const invariants=await manager.query(`SELECT (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_preferences p WHERE owner_id=$1) prefs,(SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance`,[OWNER]);
 return {invariants,identity,business,invoices,description,expected,grant_exposure:{run:grants[0].report_run_in_original_grant,describe:grants[0].report_describe_in_original_grant}};
});
const request={catalog_version:seed.description.catalog_version,combine:'separate',page_limit:2,sources:[{source_key:'finance_movements',alias:'own_pending_fixture',scope:{subject_user_id:OWNER},filters:{all:[{field_key:'id',operator:'eq',value:'2'},{field_key:'name',operator:'eq',value:'AI40-UI-CODEX-R01'},{field_key:'type',operator:'eq',value:'expense'},{field_key:'status',operator:'eq',value:'pending'},{field_key:'is_active',operator:'eq',value:true}]},measures:[{measure_key:'records',aggregation:'count',output_key:'records'},{measure_key:'confirmed_expense_amount',aggregation:'sum',output_key:'paid_amount'}],group_by:[{dimension_key:'status',output_key:'status'}]},{source_key:'business_invoices',alias:'own_business_invoices',scope:{business_id:seed.business.id},filters:{all:[{field_key:'is_active',operator:'eq',value:true}]},measures:[{measure_key:'records',aggregation:'count',output_key:'records'}],group_by:[{dimension_key:'is_active',output_key:'active'}]}]};
phase='compiled_report';tools.validateInput('nodia_reports_run',request);tools.assertGranted(request,['/tools/nodia-ai','/tools/finances-personal','/tools/business']);
const output=await tools.execute(seed.identity,'nodia_reports_run',request,{allowedModuleRoutes:['/tools/nodia-ai','/tools/finances-personal','/tools/business']});
const finalInvariants=await db.query(`SELECT (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM nodia_ai_preferences p WHERE owner_id=$1) prefs,(SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(f) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM finance_movements f) finance`,[OWNER]);if(JSON.stringify(finalInvariants)!==JSON.stringify(seed.invariants)||seed.invariants[0].prefs!=='b3cffd91df324d06e640ff3c9e169db2d2fb5a24692ff11dbbc2cc7297443237'||seed.invariants[0].finance!=='5335e312c7b542552f924cf266fc007ff1a3691e522e6c682bb20e374b5b7871')throw Error('domain_invariants_changed');
const publicSourceMetadata=seed.description.sources.filter(s=>['finance_movements','business_invoices'].includes(s.source_key));
console.log(JSON.stringify({schema:'nodia-ai-ai40-cross-report-oracle-v1',status:output.source_errors.length===0?'observed_read_only':'report_source_failed',technical_descriptors:tools.descriptors().map(t=>({name:t.name,contract_hash:tools.contractHash(t.name)})),original_own_grant_exposure:seed.grant_exposure,catalog_version:seed.description.catalog_version,authorized_source_metadata:publicSourceMetadata,request,independent_SQL:seed.expected,native_report:output,business_inventory:{...seed.business,invoice_file_metadata:seed.invoices},PG_read_only_transaction:false,data_read_guard:sqlObservation,native_rowlocks_permitted:true,finance_and_preferences_before_after_unchanged:true,compiled_describe_registry_compiler_run_compose_used:true,selected_personal_and_business_paths_do_not_call_rental_port:true,SQL_writes:0,SDK_observations:0,provider_requests:0,report_id_is_ephemeral_not_a_persisted_business_record:true,session_private_config_and_storage_paths_emitted:false}));
}catch(error){console.log(JSON.stringify({schema:'nodia-ai-ai40-cross-report-oracle-v1',status:'oracle_failed',phase,data_read_guard:sqlObservation,code:typeof error.code==='string'&&/^[a-z_]{1,64}$/.test(error.code)?error.code:null,field:typeof error.field==='string'&&/^[a-z_.]{1,100}$/.test(error.field)?error.field:null,error_class:['Error','NodiaAiReportQueryError','ForbiddenException','ServiceUnavailableException'].includes(error.name)?error.name:'private_dependency_failure',SQL_writes:0,SDK_observations:0,provider_requests:0,private_details_emitted:false}));process.exitCode=1;}finally{if(db.isInitialized)await db.destroy();}
}

'''

r=h.command(['/usr/local/bin/node','--input-type=module','-e',prefix+query],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root',**env},timeout=40)
if r.returncode!=0 and not (r.stdout.startswith(b'{') and len(r.stdout)<65536):
 t=r.stderr.decode('utf8','replace');print(json.dumps({'status':'oracle_failed','SQL_writes':0,'SDK_observations':0,'child_exit':r.returncode,'stderr_bytes':len(r.stderr),'error_category':next((v for v in ['owned_grant_missing','owned_authority_denied','fixture_not_unique','fixture_changed','published_contract_changed','invalid_oracle_input','invalid_native_result','cannot execute LOCK TABLE in a read-only transaction']if v in t),'private_dependency_or_protocol_failure'),'private_stderr_emitted':False}));sys.exit(1)
assert 0<len(r.stdout)<65536
print(r.stdout.decode(),end='')
