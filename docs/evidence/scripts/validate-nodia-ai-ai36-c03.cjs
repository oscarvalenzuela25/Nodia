/* Offline consolidation. No database, network, provider, deployment or service restart. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
process.chdir(path.resolve(__dirname, '../../..'));
const mode = process.argv[2] ?? '--check';
assert(['--write', '--check'].includes(mode));
const output = 'docs/evidence/nodia-ai-ai36-c03-validation.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({path:file, sha256:sha(file)});
const files = {
 unit:'.tmp/ai36-c03-server-final.json',
 gateway:'.tmp/ai36-c03-gateway-final.json',
 adapter:'.tmp/ai36-c03-adapter-tests.json',
 productionTypes:'.tmp/ai36-c03-server-production-types.log',
 fixtureTypes:'.tmp/ai36-c03-server-fixture-types-final.log',
 lint:'.tmp/ai36-c03-server-lint-final.log',
 build:'.tmp/ai36-c03-server-build.log',
 contracts:'docs/evidence/nodia-ai-ai36-c03-invoice-contracts.json',
 sql:'docs/evidence/nodia-ai-ai36-c03-invoice-sql-validation.json',
 sqlManifest:'docs/evidence/nodia-ai-ai36-c03-invoice-sql-manifest.json',
 pythonLinux:'docs/evidence/nodia-ai-ai36-c03-python-linux-validation.json',
 pythonManifest:'docs/evidence/nodia-ai-ai36-c03-python-source-manifest.json',
 pythonWindows:'.tmp/ai36-c03-python-all.log',
 delta:'docs/evidence/nodia-ai-ai36-c03-catalog-delta.json',
};
function testResult(file) {
 const data=read(file);
 assert.equal(data.numFailedTests,0); assert.equal(data.numPendingTests,0);
 assert.equal(data.numPassedTests,data.numTotalTests);
 assert(data.testResults.every(result=>result.status==='passed'));
 return {tests:data.numPassedTests,files:data.testResults.length,failed:0,omitted:0};
}
const unit=testResult(files.unit), gateway=testResult(files.gateway), adapter=testResult(files.adapter);
assert.equal(adapter.tests,44);
const fixtureBaseline='c5c7c21e659651d0d72bd544cb4adc6ddd4b8bf16e22738a16dbd91356126dc9';
assert.equal(sha(files.fixtureTypes),fixtureBaseline);
assert.equal((fs.readFileSync(files.fixtureTypes,'utf8').match(/error TS\d+:/g)??[]).length,192);
assert.equal(fs.readFileSync(files.productionTypes,'utf8').trim(),'');
assert(!/error TS\d+:/.test(fs.readFileSync(files.build,'utf8')));
const lint=fs.readFileSync(files.lint,'utf8');
assert.equal((lint.match(/: warning /g)??[]).length,3); assert(!/: error /.test(lint));
const contracts=read(files.contracts);
assert.equal(contracts.counts.candidate_invoice_analysis,1);
assert.equal(contracts.counts.native_preparers,77);
assert.equal(contracts.counts.published_invoice_analysis,0);
assert(contracts.verification.preparer_77_hashes_native_hashes_schema_refs_and_bytes_unchanged);
for(const source of contracts.sources) assert.equal(sha(source.path),source.sha256,source.path);
const sql=read(files.sql); assert.equal(sql.status,'passed'); assert(sql.checks>=25);
assert.equal(sql.c01_regression.checks,22); assert.equal(sql.c01_regression.status,'passed');
assert.equal(sql.c02_regression.checks,31); assert.equal(sql.c02_regression.status,'passed');
assert.equal(sql.actual_provider_generations,0); assert.equal(sql.native_profile_calls,0);
assert.equal(sql.candidate_deployed,false); assert.equal(sql.production_publication,false);
assert.equal(sql.disposable_containers_remaining,0);
for(const source of sql.source_hashes) assert.equal(sha(source.path),source.sha256,source.path);
const snapshot=read(files.sqlManifest); let compiledCount=0;
for(const [file,digest] of Object.entries(snapshot.files)) {
 if(!file.startsWith('dist/'))continue;
 assert.equal(sha('nodia-server/'+file),digest,file); compiledCount++;
}
assert.equal(compiledCount,sql.compiled_outputs_verified);
const python=read(files.pythonLinux); assert.equal(python.successful,true);
assert.equal(python.tests_run,435); assert.equal(python.skipped,0); assert.equal(python.provider_generations,0);
assert.equal(python.active_container_restarted,false); assert.deepEqual(python.live_service_before,python.live_service_after);
assert.equal(python.source_manifest_sha256,sha(files.pythonManifest));
const pythonManifest=read(files.pythonManifest);
assert.equal(Object.keys(pythonManifest.files).length,101);
for(const [file,digest] of Object.entries(pythonManifest.files)) assert.equal(sha('nodia-gemini-microservice/'+file),digest,file);
assert.equal(sha(files.pythonWindows),'0c94481f19c88587ed65c6c9dddac7e89fb422d777af6c6bab94f58c8284b119');
const delta=read(files.delta); assert.equal(delta.after_source_count,860);
assert.equal(delta.after_counts.localModules,87);assert.equal(delta.after_counts.handlerOperations,217);
assert.equal(delta.after_counts.httpMethodPathPairs,336);
const pin=read('nodia-server/dist/nodia-ai/knowledge/manifest.json');
assert.equal(pin.release_id,contracts.publication.compiled_release_id);
assert.equal(pin.release_id,'41bf6ff92268d406776fd29f07f74871ae966740f14ec45accbfcffd9969a127');
assert.equal(pin.capability_contracts.length,67); assert.equal(pin.fragments.length,27); assert.equal(pin.documents.length,27);
const registry=read('nodia-server/config/nodia-ai-knowledge.registry.json');assert.equal(registry.source_paths.length,59);
assert(!pin.capability_contracts.some(item=>item.capability_id==='nodia_invoices_analyze'));
const report={
 stage:'AI-36-C03',status:'invoice_analysis_candidate_contract_adapter_verified_publication_pending',
 server_unit:{...unit,max_workers:2},focused_gateway:gateway,focused_invoice_adapter:adapter,
 quality:{build:'passed',production_types:'passed',lint_errors:0,existing_lint_warnings:3,
 global_fixture_types:{existing_errors:192,existing_files:48,added_errors:0,unchanged_baseline_sha256:fixtureBaseline}},
 contracts:{invoice_analysis_candidates:1,actions:['prepare','complete'],kind:'analyze_attachment',
 preserved_preparation_candidates:77,closed_schema_pairs:1,extraction_source:'active_agentic_generation',
 review_required:true,extra_provider_dispatches:0,business_writes:0,native_parser_rules_reused:true},
 sql:{C03_checks:sql.checks,C03_human_http_requests:sql.http_requests,C01_regression:sql.c01_regression,
 C02_regression:sql.c02_regression,migrations:sql.migrations,compiled_outputs_verified:compiledCount,
 actual_worker_admission_gateway_receipts_and_human_HTTP:true,extraction:'synthetic_current_generation',
 normalizer:sql.parser,storage:sql.storage,actual_provider_generations:0,native_profile_calls:0},
 native_python:{linux:{tests:435,passed:435,skipped:0},windows:{tests:435,passed:433,historical_skips:2},
 source_files_verified:101,private_pure_endpoint:'/nodia-ai/invoice-analysis/contract',
 profile_calls:0,provider_generations:0,live_container_unchanged:true,activated:false},
 publication:{release_id:pin.release_id,previous_release_id:'b4a790219b41687d2bc4ac7ad70f436d5b9a3aa83cbdfc812533a06f8027dc23',
 source_paths:59,excluded:32,domain_reads:67,fragments:27,added_capabilities:0,
 registry_provenance_changed:true,readiness:false,selection_deployment_and_provider_acceptance_pending:true},
 scope:{new_tables:0,new_migrations:0,new_Node_HTTP_routes:0,new_private_pure_Python_routes:1,
 UI_changed:false,candidate_deployed:false,production_services_restarted:false,R2_operations:0},
 source_inventory:{modules:87,controllers:46,handlers:217,aliases:336,source_hashes:860},
 evidence:Object.fromEntries(Object.entries(files).map(([name,file])=>[name,ref(file)])),
 historical_C01:ref('docs/evidence/nodia-ai-ai36-c01-validation.json'),
 historical_C02:ref('docs/evidence/nodia-ai-ai36-c02-validation.json'),
 limitations:[
 'SQL uses real compiled application/worker and PostgreSQL with explicitly synthetic provider, storage and pure normalization ports; Python native parser/HTTP guards are tested independently.',
 'No real Gemini inference or invoice understanding, R2 access, configured-domain write, new tool publication, service restart or candidate deployment.',
 'The active Agentic generation extracts the already submitted original file; no nested legacy OCR or independent visual verification is claimed.',
 'Result remains reviewable; later commercial creation uses a distinct exact proposal and human button.',
 'Pure normalization may repeat under a new callback after uncertain acknowledgement; one completion is durably committed, without another inference or domain effect.',
 'Client and V8 were not rerun. Prior results retain their historical scope.',
 'Existing limits of74 tools/131072 catalog bytes, JSON128 cardinality and262144 context bytes remain unchanged.',
 'AI-36 remains open for six common helpers C04 and separate selective publication/provider-acceptance gates; AI-37..40 remain sequenced.'
 ]
};
const serialized=JSON.stringify(report,null,2)+'\n';
if(mode==='--write')fs.writeFileSync(output,serialized);
else assert.equal(fs.readFileSync(output,'utf8'),serialized,'AI36-C03 consolidation drift');
console.log(JSON.stringify({stage:report.stage,mode,status:report.status,tests:unit.tests,files:unit.files,
 sql_checks:sql.checks+53,compiled_outputs:compiledCount,publication_added:0}));
