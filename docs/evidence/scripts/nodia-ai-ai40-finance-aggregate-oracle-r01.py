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
const {createHash}=await import('node:crypto'),{readFileSync}=await import('node:fs'),{createRequire}=await import('node:module');
const require=createRequire('/opt/nodia/releases/nodia-server-ai40-r07/package.json');
const ROOT='/opt/nodia/releases/nodia-server-ai40-r07',CHAT='ec626b72-1f32-4486-9f3a-8263cffce267',OWNER='1',GRANT='8e4c0db1-6b07-4524-a1cf-f33d09210766',MARKER='AI40-UI-CODEX-R01';
const sha=b=>createHash('sha256').update(b).digest('hex');
const {AuthorizeNodiaAiUseCase}=await import(ROOT+'/dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js');
const {NodiaAiAuthorizationService}=await import(ROOT+'/dist/nodia-ai/nodia-ai-authorization.service.js');
const {FinanceOverviewService}=await import(ROOT+'/dist/finance-overview/finance-overview.service.js');
const {FinanceCategoryService}=await import(ROOT+'/dist/finance-category/finance-category.service.js');
const {GetFinanceOverviewUseCase}=await import(ROOT+'/dist/finance-overview/use-case/get-finance-overview.use-case.js');
const {GetFinanceCategorySummaryUseCase}=await import(ROOT+'/dist/finance-overview/use-case/get-finance-category-summary.use-case.js');
const {createNodiaAiFinanceReadFamily}=await import(ROOT+'/dist/nodia-ai-products/finance/finance-read.family.js');
try{await db.initialize();const result=await db.transaction('REPEATABLE READ',async manager=>{
 await manager.query('SET TRANSACTION READ ONLY');
 const grants=await manager.query(`SELECT g.session_public_id::text FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.id=$1 AND r.conversation_id=$2 AND r.actor_id=$3 AND g.actor_id=$3 LIMIT 2`,[GRANT,CHAT,OWNER]);if(grants.length!==1)throw Error('owned_grant_missing');
 const actor=await new AuthorizeNodiaAiUseCase(new NodiaAiAuthorizationService(db)).execute({userId:OWNER,sessionId:grants[0].session_public_id},{moduleRoutes:['/tools/nodia-ai','/tools/finances-personal']},manager);if(!actor.isSuperAdmin||actor.actorId!==OWNER)throw Error('owned_authority_denied');
 const fixtures=await manager.query(`SELECT m.id::text,m.category_id::text,m.created_at,m.amount::text,m.status,m.type,m.is_active,c.name category_name,c.is_active category_active FROM finance_movements m JOIN finance_categories c ON c.id=m.category_id AND c.user_id=m.user_id WHERE m.user_id=$1 AND m.name=$2 ORDER BY m.id LIMIT 2`,[OWNER,MARKER]);if(fixtures.length!==1)throw Error('fixture_not_unique');const f=fixtures[0];
 if(f.id!=='2'||f.category_id!=='1'||f.amount!=='1'||f.status!=='pending'||f.type!=='expense'||!f.is_active||!f.category_active||f.category_name!=='AI38 aceptaci\u00f3n')throw Error('fixture_changed');
 const day=f.created_at.toISOString().slice(0,10)+'T00:00:00.000Z',next=new Date(Date.parse(day)+86400000).toISOString();
 const overviewArgs={active:'active',category_ids:['1'],q:{name_cont:MARKER,type_eq:'expense',status_eq:'pending'}};
 const categoryArgs={page:1,limit:1,active:'active',category_ids:['1'],q:{name_cont:'AI38 aceptaci\u00f3n',type_eq:'expense',status_eq:'pending',created_at_gteq:day,created_at_lt:next,s:'id asc'}};
 const [sqlOracle]=await manager.query(`SELECT COUNT(*)::int movement_count,COUNT(*) FILTER(WHERE status='pending')::int pending_count,COUNT(*) FILTER(WHERE status='cancelled')::int cancelled_count,COALESCE(SUM(amount) FILTER(WHERE type='income' AND status='received'),0)::text income_amount,COALESCE(SUM(amount) FILTER(WHERE type='expense' AND status='paid'),0)::text expense_amount,COALESCE(SUM(amount),0)::text nominal_pending_amount FROM finance_movements WHERE user_id=$1 AND is_active=true AND category_id=1 AND type='expense' AND status='pending' AND name ILIKE $2`,[OWNER,'%'+MARKER+'%']);
 const [categoryOracle]=await manager.query(`SELECT COUNT(*)::int movement_count,COALESCE(SUM(amount) FILTER(WHERE type='income' AND status='received'),0)::text income_amount,COALESCE(SUM(amount) FILTER(WHERE type='expense' AND status='paid'),0)::text expense_amount FROM finance_movements WHERE user_id=$1 AND is_active=true AND category_id=1 AND type='expense' AND status='pending' AND created_at>=$2 AND created_at<$3`,[OWNER,day,next]);
 const [privacy]=await manager.query(`SELECT (SELECT COUNT(*)::int FROM finance_categories WHERE user_id=$1 AND is_active=true) categories,(SELECT COUNT(*)::int FROM finance_categories WHERE user_id=$1 AND is_active=true AND id=1 AND name=$2) fixture_categories,(SELECT COUNT(*)::int FROM finance_category_groups WHERE user_id=$1 AND is_active=true) category_groups,(SELECT COUNT(*)::int FROM finance_obligations WHERE user_id=$1 AND is_active=true) obligations`,[OWNER,'AI38 aceptaci\u00f3n']);
 const onlyFixtureSupplementary=privacy.categories===privacy.fixture_categories&&privacy.category_groups===0&&privacy.obligations===0;
 const service=new FinanceOverviewService(db),family=createNodiaAiFinanceReadFamily({scope:new FinanceCategoryService(db),overview:new GetFinanceOverviewUseCase(service),byCategory:new GetFinanceCategorySummaryUseCase(service)});
 const manifest=JSON.parse(readFileSync(ROOT+'/dist/nodia-ai/knowledge/manifest.json','utf8'));
 const schemaBytes=readFileSync(ROOT+'/dist/nodia-ai-products/contracts/finance.schema.json'),schema=JSON.parse(schemaBytes),schemaSHA=sha(schemaBytes);
 const {Ajv2020}=require('ajv/dist/2020.js'),addFormats=require('ajv-formats'),ajv=new Ajv2020({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
 const results=[];
 for(const [name,args]of [['nodia_finance_summaries_overview',overviewArgs],['nodia_finance_summaries_by_category',categoryArgs]]){
  const cap=family.capabilities.find(c=>c.toolName===name),published=manifest.capability_contracts.filter(c=>c.capability_id===name&&c.publication==='published');if(!cap||published.length!==1||published[0].input_schema.sha256!==schemaSHA||published[0].output_schema.sha256!==schemaSHA)throw Error('published_contract_changed');
  const i=ajv.compile({$ref:schema.$id+'#/$defs/'+cap.inputSchema.definition}),o=ajv.compile({$ref:schema.$id+'#/$defs/'+cap.outputSchema.definition});if(!i(args))throw Error('invalid_oracle_input');
  const context={actor,manager,statementTimeoutMs:5000};await cap.verifyAuthority(args,context);const output=await cap.handler(args,context);await cap.verifyResultAuthority(args,output,context);if(!o(output))throw Error('invalid_native_result');
  results.push({tool_name:name,arguments:args,input_schema_valid:true,output_schema_valid:true,public_contract_sha256:schemaSHA,native_output:output});
 }
 const overview=results[0].native_output,category=results[1].native_output;
 const checks={SQL_marker_unique_one_pending:sqlOracle.movement_count===1&&sqlOracle.pending_count===1&&sqlOracle.nominal_pending_amount==='1',overview_matches_independent_SQL:Object.entries(sqlOracle).filter(([k])=>k!=='nominal_pending_amount').every(([k,v])=>overview.totals[k]===v)&&overview.totals.net_amount==='0',category_matches_independent_SQL:category.data.length===1&&category.data[0].id==='1'&&category.data[0].name==='AI38 aceptaci\u00f3n'&&Object.entries(categoryOracle).every(([k,v])=>category.data[0][k]===v)&&category.data[0].net_amount==='0',overview_supplementary_sections_contain_only_fixture_data:onlyFixtureSupplementary};
 return {schema:'nodia-ai-ai40-finance-aggregate-oracle-v1',status:Object.values(checks).every(Boolean)?'validated_read_only':'oracle_not_ready',checks,current_owner_and_exact_grant_reauthorized:true,fixture_id:'2',fixture_created_at:f.created_at,UTC_fixture_day_window:{from:day,to_exclusive:next},independent_SQL:{overview:sqlOracle,by_category:categoryOracle},queries:results,report_tools_not_in_published_product_manifest:manifest.capability_contracts.filter(c=>['nodia_reports_run','nodia_reports_describe'].includes(c.capability_id)),semantics:{overview_name_filter_targets:'movements',by_category_name_filter_targets:'category_catalogue',cash_totals_include_only:'expense_paid/income_received',pending_nominal_amount_is_not_cash_expense:true,overview_supplementary_counts_and_obligations_ignore_movement_filters:true},SQL_writes:0,SDK_observations:0,provider_requests:0,session_or_private_config_emitted:false};
});console.log(JSON.stringify(result));}finally{if(db.isInitialized)await db.destroy();}

}
'''

r=h.command(['/usr/local/bin/node','--input-type=module','-e',prefix+query],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root',**env},timeout=40)
if r.returncode!=0:
 t=r.stderr.decode('utf8','replace');print(json.dumps({'status':'oracle_failed','SQL_writes':0,'SDK_observations':0,'child_exit':r.returncode,'stderr_bytes':len(r.stderr),'error_category':next((v for v in ['owned_grant_missing','owned_authority_denied','fixture_not_unique','fixture_changed','published_contract_changed','invalid_oracle_input','invalid_native_result','cannot execute LOCK TABLE in a read-only transaction']if v in t),'private_dependency_or_protocol_failure'),'private_stderr_emitted':False}));sys.exit(1)
assert 0<len(r.stdout)<65536
print(r.stdout.decode(),end='')
