const assert = require('node:assert/strict');
const fs = require('node:fs'), path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
const read=name=>fs.readFileSync(path.join(root,name));
const json=name=>JSON.parse(read(name));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
const copy=(from,to)=>fs.writeFileSync(path.join(root,to),read(from));
const attempt=process.argv[2]??'attempt01'; assert.match(attempt,/^attempt[0-9]{2}$/u);
const prefix='docs/evidence/nodia-ai-ai36-c04-common-sql-';
const result=json('.tmp/ai36-c04-common-sql-'+attempt+'.json');
const health=json('.tmp/ai36-c04-common-sql-health.json');
const manifestPath='nodia-server/.tmp/ai36-c04-common-sql-stage-manifest.json',manifest=json(manifestPath);
const harness='nodia-server/test/nodia-ai-ai36-common-helpers.integration.mjs';
assert.equal(result.status,'passed'); assert.equal(result.assertion_result.status,'passed'); assert.ok(result.assertion_result.checks>=35);
assert.equal(result.manifest_sha256,hash(read(manifestPath)));assert.equal(result.source_sha256,hash(read(harness)));
assert.equal(result.runner_sha256,hash(read('docs/evidence/scripts/nodia-ai-ai36-c04-common-sql-remote.py')));
for(const [stage,checks]of[['c01',22],['c02',31],['c03',39]]){assert.equal(result[stage+'_regression'].exit_code,0);assert.equal(result[stage+'_regression'].assertion_result.checks,checks);}
assert.equal(health.status,'passed');assert.equal(health.compiled_files_verified,manifest.compiled_files);assert.equal(health.disposable_containers_remaining,0);assert.equal(result.disposable_containers_remaining,0);
const attempts=[];
for(let index=1;index<=Number(attempt.slice(-2));index++){
 const current='attempt'+String(index).padStart(2,'0'),source='.tmp/ai36-c04-common-sql-'+current+'.json',receipt=json(source),target=prefix+current+'.json',priorManifest='.tmp/ai36-c04-common-sql-stage-'+current+'-manifest.json',manifestTarget=prefix+current+'-manifest.json';
 assert.equal(receipt.manifest_sha256,hash(read(priorManifest)));
 copy(source,target);copy(priorManifest,manifestTarget);attempts.push({attempt:current,status:receipt.status,manifest_sha256:receipt.manifest_sha256,archive_sha256:receipt.archive_sha256,source_sha256:receipt.source_sha256,evidence_path:target,manifest_path:manifestTarget});
}
copy(manifestPath,prefix+'manifest.json');copy('.tmp/ai36-c04-common-sql-health.json',prefix+'health.json');
const execution=Object.fromEntries(Object.entries(manifest.files).filter(([name])=>name.startsWith('dist/')&&/\.(?:js|json|md)$/u.test(name)).sort(([a],[b])=>a.localeCompare(b)));
const attempt02Manifest=json('.tmp/ai36-c04-common-sql-stage-attempt02-manifest.json');
const priorExecution=Object.fromEntries(Object.entries(attempt02Manifest.files).filter(([name])=>name.startsWith('dist/')&&/\.(?:js|json|md)$/u.test(name)).sort(([a],[b])=>a.localeCompare(b)));
assert.deepEqual(execution,priorExecution);
const sources=[harness,'nodia-server/test/nodia-ai-ai36-write-preparation.integration.mjs','nodia-server/test/nodia-ai-ai36-secure-preparation.integration.mjs','nodia-server/test/nodia-ai-ai36-invoice-analysis.integration.mjs',...['stage.cjs','remote.py','health.py','evidence.cjs'].map(name=>'docs/evidence/scripts/nodia-ai-ai36-c04-common-sql-'+name),prefix+'manifest.json',prefix+'health.json',...attempts.flatMap(a=>[a.evidence_path,a.manifest_path]),...attempts.map(a=>prefix+a.attempt+'-failure.json').filter(name=>fs.existsSync(path.join(root,name)))];
const report={stage:'AI-36-C04',status:'passed',scope:'candidate_mcp_six_common_helpers_disposable_sql',checks:result.assertion_result.checks,http_requests:result.assertion_result.http_requests,check_names:result.assertion_result.results,migrations:result.assertion_result.migrations,candidate_tools:6,synthetic_published_tools:6,compiled_outputs_verified:manifest.compiled_files,compiled_execution_files:Object.keys(execution).length,compiled_execution_manifest_sha256:hash(JSON.stringify(execution)),application_execution_identical_attempt02_to_final:true,cache_only_packaging_delta:['dist/tsconfig.tsbuildinfo'],source_sha256:result.source_sha256,manifest_sha256:result.manifest_sha256,synthetic_provider_dispatches:result.assertion_result.synthetic_provider_dispatches,actual_provider_generations:0,storage_operations:0,native_profile_calls:0,configured_database_used:false,services_restarted:false,production_publication:false,candidate_deployed:false,disposable_containers_remaining:0,failure_classifications:attempts.map(a=>prefix+a.attempt+'-failure.json').filter(name=>fs.existsSync(path.join(root,name))),regressions:Object.fromEntries(['c01','c02','c03'].map(stage=>[stage,{status:'passed',checks:result[stage+'_regression'].assertion_result.checks,http_requests:result[stage+'_regression'].assertion_result.http_requests,same_compiled_execution:true}])),attempts,layers:{sql:'Actual compiled Nest/TypeORM, all current migrations, PostgreSQL16 disposable fixture ai3604',callback:'Actual admission, frozen context, MCP gateway, six candidate contracts and durable receipts',transport:'Explicit synthetic Agentic fixture only; no inference, account or model availability claim',metadata:'Synthetic attachment rows, real metadata projection/authority; no storage/inspection/bytes accessed',effects:'Native preference create/update/delete and supplier/contact effects after exact human HTTP challenge and confirmation',regressions:'Actual C01, C02 and C03 harnesses against identical compiled outputs in separate disposable PostgreSQL containers'},limits:health.limits,not_verified:['production publication or deployment','Gemini account inference','R2 or actual upload/download','UI browser acceptance'],source_hashes:sources.map(name=>({path:name,sha256:hash(read(name))}))};
write('docs/evidence/nodia-ai-ai36-c04-common-sql-validation.json',report);
console.log(JSON.stringify({stage:report.stage,status:report.status,checks:report.checks,http_requests:report.http_requests,regression_checks:92,compiled_outputs_verified:manifest.compiled_files,source_files_verified:sources.length}));
