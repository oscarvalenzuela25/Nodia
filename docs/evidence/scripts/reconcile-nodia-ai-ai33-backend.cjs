// Offline source/log reconciliation. This does not rerun tests or contact services.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');process.chdir(root);
const receipt=file=>{const bytes=fs.readFileSync(file);return {path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};};
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(directory+'/'+entry.name):[directory+'/'+entry.name]);}
const sources=[
  ...walk('nodia-server/src/nodia-ai-preference').filter(file=>file.endsWith('.ts')&&!file.endsWith('.spec.ts')&&!file.endsWith('.fixture.ts')),
  'nodia-server/src/migrations/1792900000000-CreateNodiaAiPreferences.ts',
  'nodia-server/src/app.module.ts',
  'nodia-server/src/nodia-ai-proposal/nodia-ai-proposal.module.ts',
  'nodia-server/src/nodia-ai-proposal/types/local-operation.types.ts',
  'nodia-server/src/nodia-ai-proposal/types/proposal-preparer.types.ts',
  'nodia-server/src/nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.ts',
  'nodia-server/src/nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.ts',
  'nodia-server/src/nodia-ai-confirmation/nodia-ai-confirmation.module.ts',
  'nodia-server/src/nodia-ai-confirmation/use-case/validate-nodia-ai-confirmation.use-case.ts',
  'nodia-server/src/nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case.ts',
  'docs/mvp/nodia-ai-v1-common-contracts.schema.json',
  'nodia-server/src/nodia-ai-tools/config/common-schema.json',
].sort();
const sourceReceipts=sources.map(receipt),compiledReceipts=sources.filter(file=>file.startsWith('nodia-server/src/')&&file.endsWith('.ts')).map(file=>receipt(file.replace('/src/','/dist/').replace(/\.ts$/,'.js')));
assert.equal(new Set(sources).size,sources.length);
const build='nodia-server/.tmp/ai33-build-post-receipt.log',execution='nodia-server/.tmp/ai33-execution-post-receipt.log';
assert.match(fs.readFileSync(build,'utf8'),/"task":"AI-12","release":"3cf24cc2de2f22d66ca3b26763e83993f4458f5cc4729d43bbbb68900fad5f0b"/);
assert.match(fs.readFileSync(execution,'utf8'),/Tests\s+60 passed \(60\)/);
const schemas=JSON.parse(fs.readFileSync('docs/mvp/nodia-ai-v1-common-contracts.schema.json','utf8'));
assert.equal(Object.keys(schemas.$defs).length,148);
assert.equal(fs.readFileSync('docs/mvp/nodia-ai-v1-common-contracts.schema.json','utf8'),fs.readFileSync('nodia-server/src/nodia-ai-tools/config/common-schema.json','utf8'));
for(const file of ['nodia-server/src/nodia-ai-confirmation/use-case/validate-nodia-ai-confirmation.use-case.ts','nodia-server/src/nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.ts'])assert.match(fs.readFileSync(file,'utf8'),/'PreferenceEffectReceipt'/);
const result={stage:'AI-33',scope:'backend_explicit_preferences_and_existing_human_confirmation',status:'passed',
  model_inferences:0,production_database_mutations_from_this_review:0,production_services_restarted_from_this_review:0,
  implementation:{new_tables:1,new_columns:12,migration:'CreateNodiaAiPreferences1792900000000',origin_partial_indexes:2,owner_limit:50,registered_memory_keys:5,internal_preparers:3,new_mcp_tools_published:0,snapshot_ai34_implemented:false},
  tests:{new_preferences:{files:5,passed:58,provenance:'observed_Vitest_tool_output',command:'npx vitest run src/nodia-ai-preference'},
    earlier_integration_regressions:{files:3,passed:109,provenance:'observed_Vitest_tool_output',scope:'native effect, proposal validation, confirmation availability'},
    after_receipt_correction:{files:4,passed:290,new_receipt_projection_cases:3,
      groups:[{files:3,passed:230,provenance:'observed_Vitest_tool_output',scope:'confirmation validation, execution status projection, native effects'},
        {files:1,passed:60,provenance:'captured_Vitest_stdout_log',log:execution,scope:'local SQL execution'}]},
    whole_server_after_correction_rerun:false,
    note:'58,109 and230 summaries were observed directly in tool results; no raw stdout log was persisted for those runs. Counts are recorded observations, not a fabricated rerun log.'},
  receipt_correction:{cause:'PreferenceEffectReceipt was registered in proposal validation but missing from human execution status validation',
    fixed:'shared confirmation validator now compiles the closed receipt; projection tests exercise create/update/delete and reject owner/revision/content corruption',
    initial_sql_failure_preserved_by_coordinator:true},
  quality:{build:{exit_code:0,log:receipt(build)},typecheck:{exit_code:0,command:'npx tsc --noEmit -p tsconfig.build.json',log:receipt('nodia-server/.tmp/ai33-backend-typecheck.log')},
    scoped_lint:{exit_code:0,log:receipt('nodia-server/.tmp/ai33-backend-lint.log')},common_schema_definitions:148},
  source_receipts:sourceReceipts,compiled_receipts:compiledReceipts,
  verification:{command:'node docs/evidence/scripts/reconcile-nodia-ai-ai33-backend.cjs --check',source:receipt('docs/evidence/scripts/reconcile-nodia-ai-ai33-backend.cjs')},
  limits:['Disposable SQL/HTTP acceptance is recorded separately by the integration coordinator','This report does not demonstrate real provider inference, deployment or production acceptance','Accepted memories contextualize suggestions; existing domain commands are not silently autofilled','MCP publication remains a separate gate']};
const target='docs/evidence/nodia-ai-ai33-backend-validation.json',serialized=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),serialized,'backend evidence drift');else fs.writeFileSync(target,serialized);
console.log(JSON.stringify({stage:'AI-33',status:'passed',source_receipts:sourceReceipts.length,compiled_receipts:compiledReceipts.length,new_tests:58,postfix_tests:290,live_calls:0}));
