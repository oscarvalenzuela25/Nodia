// Reconcile current AI-32 evidence; never relabel failed live probes or historical stages.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const text=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\x1b\[[0-9;]*m/g,'');
const receipt=file=>({path:file,sha256:hash(file)});
const results=(file,expectedTests,expectedFiles)=>{
 const value=text(file),tests=/Tests\s+(\d+) passed \((\d+)\)/.exec(value),files=/Test Files\s+(\d+) passed \((\d+)\)/.exec(value);
 assert(tests&&files);assert.equal(Number(tests[1]),expectedTests);assert.equal(tests[1],tests[2]);assert.equal(Number(files[1]),expectedFiles);assert.equal(files[1],files[2]);
 return{tests:expectedTests,files:expectedFiles,all_passed:true,log:receipt(file)};
};
const server=results('nodia-server/.tmp/ai32-server-full-tests.log',3314,210);
const client=results('nodia-client/.tmp/ai32-client-full-tests.log',1687,217);
const sql=read('docs/evidence/nodia-ai-ai32-sql-validation.json'),health=read('docs/evidence/nodia-ai-ai32-final-health.json'),activation=read('docs/evidence/nodia-ai-ai32-lab-activation.json');
assert.equal(sql.status,'passed_disposable_postgresql');assert.equal(sql.checks,285);assert.equal(sql.suites.length,6);
assert.equal(sql.package.archive_sha256,health.final_package_archive_sha256);assert.equal(sql.package.compiled_dist_sha256,health.dist_tree_sha256);assert.equal(sql.package.files,970);assert.equal(sql.package.compiled_dist_files,905);
for(const source of sql.source_files)assert.equal(hash(source.path),source.sha256);
assert.equal(health.passed,true);assert.equal(health.compiled_stage_and_runtime_equal,true);assert.equal(health.quiet.migrations,26);assert.equal(health.quiet.nodia_ai_tables,19);assert.equal(health.quiet.nodia_ai_columns,267);
assert.equal(health.quiet.pending_jobs+health.quiet.open_attempts+health.quiet.held_or_unknown_slots,0);
assert(Object.values(health.units).every(value=>value==='active'));assert(Object.values(health.http).every(value=>value===200));
assert.deepEqual(activation.migration.applied,['CreateNodiaAiAttachments1792800000000']);assert.equal(activation.gemini_container_restarted,false);
assert.equal(health.r2_configuration_present,false);assert.equal(health.r2_data_path_verified,false);
const native=read('docs/evidence/nodia-ai-ai32-native-validation.json'),mcp=read('docs/evidence/nodia-ai-ai32-mcp-validation.json'),cleanup=read('docs/evidence/nodia-ai-ai32-native-cleanup.json'),parser=read('docs/evidence/nodia-ai-ai32-parser-validation.json');
assert.equal(native.status,'gates_open');assert(native.probes.every(probe=>probe.verified===false&&probe.native_acknowledged));
assert.equal(mcp.status,'passed');assert.equal(mcp.callbacks,1);assert.equal(mcp.supports_mcp_after,true);assert.equal(mcp.native_acknowledged,true);
for(const key of ['unknown_markers','armed_native_proofs','terminal_native_proofs','temporary_attachment_directories','temporary_cli_directories'])assert.equal(cleanup[key],0);
assert.deepEqual(cleanup.source_drift_files,[]);assert.equal(parser.status,'passed');assert.equal(parser.checks,11);
const linux=text('nodia-server/.tmp/ai32-native-linux-tests.log'),windows=text('nodia-gemini-microservice/.tmp-ai32-python.log');
assert(/Ran 313 tests/.test(linux)&&/\nOK\s*$/.test(linux));assert(/Ran 313 tests/.test(windows)&&/OK \(skipped=2\)/.test(windows));
const nativeManifest=read('nodia-server/.tmp/ai32-native-manifest.json');assert.equal(Object.keys(nativeManifest).length,84);
for(const [file,digest]of Object.entries(nativeManifest))assert.equal(hash('nodia-gemini-microservice/'+file),digest);
const knowledge=read('.tmp/ai32-knowledge.log'),delta=read('docs/evidence/nodia-ai-ai32-knowledge-delta.json'),inventory=read('docs/mvp/nodia-ai-current-endpoints.json'),qa=read('docs/evidence/nodia-ai-ai32-ui-validation.json');
assert.equal(knowledge.unavailable,0);assert.equal(knowledge.releaseId,health.knowledge_release);assert.equal(delta.release,health.knowledge_release);assert.equal(delta.previous_release,'9e57cbe2a469543df6f2d9db5a400e549268fb68012c59c34878ab2b996e2cfd');
assert.equal(knowledge.sourceDocuments,55);assert.equal(knowledge.excludedDocuments,28);assert.equal(knowledge.publishedCapabilities,67);assert.equal(knowledge.publishedFragments,27);
for(const source of inventory.sourceChecksums)assert.equal(hash(source.file),source.sha256);
assert.equal(inventory.counts.handlerOperations,213);assert.equal(inventory.sourceChecksums.length,825);
assert.equal(qa.status,'passed_synthetic_browser_qa');assert.deepEqual(qa.widths,[320,390,599,600,900,1440]);for(const shot of qa.screenshots)assert.equal(hash(shot.file),shot.sha256);
const artifacts=[
 'docs/evidence/nodia-ai-ai32-sql-validation.json','docs/evidence/nodia-ai-ai32-lab-activation.json','docs/evidence/nodia-ai-ai32-final-health.json',
 'docs/evidence/nodia-ai-ai32-native-validation.json','docs/evidence/nodia-ai-ai32-native-failed-01.json','docs/evidence/nodia-ai-ai32-native-intermediate-02.json','docs/evidence/nodia-ai-ai32-native-diagnostics.json',
 'docs/evidence/nodia-ai-ai32-mcp-validation.json','docs/evidence/nodia-ai-ai32-mcp-failed-harness.json','docs/evidence/nodia-ai-ai32-mcp-reconciliation.json','docs/evidence/nodia-ai-ai32-native-cleanup.json','docs/evidence/nodia-ai-ai32-parser-validation.json',
 'docs/evidence/nodia-ai-ai32-gemini-activation.json','docs/evidence/nodia-ai-ai32-knowledge-delta.json','docs/evidence/nodia-ai-ai32-ui-validation.json',
 'nodia-server/.tmp/ai32-server-full-tests.log','nodia-server/.tmp/ai32-server-typecheck.log','nodia-server/.tmp/ai32-server-lint.log','nodia-server/.tmp/ai32-server-review-focal.log',
 'nodia-client/.tmp/ai32-client-full-tests.log','nodia-client/.tmp/ai32-client-focal-tests.log','nodia-client/.tmp/ai32-client-typecheck.log','nodia-client/.tmp/ai32-client-lint.log','nodia-client/.tmp/ai32-client-build.log',
 'nodia-gemini-microservice/.tmp-ai32-python.log','nodia-server/.tmp/ai32-native-linux-tests.log','nodia-server/.tmp/ai32-native-manifest.json','.tmp/ai32-contracts.log','.tmp/ai32-knowledge.log',
];
const clientSources=fs.readdirSync(path.join(root,'nodia-client/src/modules/nodiaAi'),{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()&&/\.(ts|tsx)$/.test(entry.name)).map(entry=>path.relative(root,path.join(entry.parentPath,entry.name)).replaceAll('\\','/')).sort().map(receipt);
const result={stage:'AI-32',date:'2026-10-17',status:'implemented_and_activated_private_lab_acceptance_gates_open',documentary_approval:false,
 server:{...server,typecheck:'passed',build:'passed_and_compiled_package_verified',lint:{errors:0,historical_warnings:3}},client:{...client,typecheck:'passed',build:'passed',lint:{errors:0},source_files:clientSources},
 python:{linux:{executed:313,passed:313,skipped:0},windows:{executed:313,passed:311,skipped:2},isolated_parser_checks:11},
 sql:{checks:285,suites:6,new_attachment_checks:58,new_invoice_attachment_checks:44,configured_database_used:false,storage_parser_adapter:'synthetic'},
 schema:{added_tables:1,attachment_columns:25,added_existing_columns:1,applied_migrations:1,installed_migrations:26,installed_nodia_ai_tables:19,installed_nodia_ai_columns:267},
 activation:{package_sha256:health.final_package_archive_sha256,compiled_dist_sha256:health.dist_tree_sha256,files:970,compiled_dist_files:905,backup:activation.backup,units:health.units,http:health.http,quiet:health.quiet,gemini_not_restarted_by_server_activation:true},
 publication:{sources:55,excluded_drafts:28,approved_product_reads:67,approved_fragments:27,release:health.knowledge_release,mcp_descriptor_ceiling:74,new_published_business_tools:0,draft_approval:false},
 live:{generation_requests_across_all_preserved_cycles:8,actual_agentic_mcp_readonly_callback_verified:true,current_native_modalities:{web:{image:null,pdf:null,audio:null},agentic:{image:null,pdf:null,audio:null}},automatic_inference_retries:0,business_writes:0,unresolved_attempts:0},
 pending:['R2 configuration absent; real object upload/read/delete and cloud race acceptance remain open.','Current native attachment modalities lack successful evidence after final adapter restart: Web returned invalid JSON; audio and Agentic file reading remain unverified.','No real microphone permission/capture was requested; browser capture lifecycle tests are synthetic.','Legacy invoice file move without a newly selected attachment, MCP write-tool publication and productive acceptance retain independent gates.'],
 artifacts:artifacts.map(receipt),ui:{status:qa.status,widths:qa.widths,synthetic:true,qa_server_stopped:true},
};
const destination=path.join(root,'docs/evidence/nodia-ai-ai32-validation.json');
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(fs.readFileSync(destination,'utf8')),result);else fs.writeFileSync(destination,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage:result.stage,status:result.status,server_tests:server.tests,client_tests:client.tests,sql_checks:285,artifacts:artifacts.length}));
