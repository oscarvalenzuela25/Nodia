// Offline consolidation. Never opens a database, object store or provider.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
const output='docs/evidence/nodia-ai-ai32-r06-invoice-validation.json';
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const receipt=file=>({path:file,sha256:hash(file)});
const prefix='docs/evidence/nodia-ai-ai32-r06-invoice-';
const attemptPath=prefix+'attempt01.json',cleanupPath=prefix+'cleanup.json',guardPath=prefix+'guard-offline.json';
const historical='docs/evidence/scripts/nodia-ai-ai32-r06-invoice-real-attempt01.mjs';
const corrected='docs/evidence/scripts/nodia-ai-ai32-r06-invoice-real.mjs';
const cleanupScript='docs/evidence/scripts/nodia-ai-ai32-r06-invoice-cleanup.mjs';
const guardScript='docs/evidence/scripts/test-nodia-ai-ai32-r06-invoice-guards.mjs';
const attempt=read(attemptPath),cleanup=read(cleanupPath),guard=read(guardPath);
assert.equal(hash(historical),'255cff530b8916b98726a791fee05195a7362b63c83b452e45ad76fda0d87982');
assert.equal(attempt.coordinator.harness_sha256,hash(historical));
assert.equal(cleanup.coordinator.harness_sha256,hash(cleanupScript));
assert.equal(guard.executed_test.sha256,hash(guardScript));assert.equal(guard.guarded_harness.sha256,hash(corrected));
for(const report of [attempt,cleanup]){
  assert.equal(report.stage,'AI-32-R06');assert.equal(report.configured_database_used,false);
  assert.equal(report.configured_business_records_modified,0);assert.equal(report.provider_generations,0);
  assert.equal(report.coordinator.descriptor_stdin,true);assert.equal(report.coordinator.private_stdout_stderr_mode,'0600');assert.equal(report.coordinator.operational_postgres_env_passed,false);
}
assert.equal(attempt.status,'failed');assert.equal(attempt.checks,16);assert.equal(attempt.check_names.length,16);
assert.deepEqual(attempt.error,{phase:'owned_fixture_teardown',category:'owned_cleanup_unconfirmed'});
assert.equal(attempt.coordinator.exit_code,1);assert.equal(attempt.preexisting_collision_objects_preserved,0);
assert.equal(attempt.inspector,'real_private_linux_http');assert.equal(attempt.inspector_calls,3);
assert.equal(attempt.counters.puts,8);assert.equal(attempt.counters.original_puts,3);assert.equal(attempt.counters.domain_puts,4);assert.equal(attempt.counters.seed_puts,1);
assert.equal(attempt.owned_objects,8);assert.equal(attempt.cleanup_complete,false);assert.equal(attempt.counters.deletes,6);
assert.equal(cleanup.status,'passed');assert.equal(cleanup.coordinator.exit_code,0);assert.equal(cleanup.put_calls,0);
assert.equal(cleanup.sandbox_rows_removed,2);assert.equal(cleanup.live_invoice_copies_reverified_before_teardown,true);
assert.equal(cleanup.owned_cloud_delete_calls,2);assert.equal(cleanup.verified_get_404,10);assert.equal(cleanup.ledger_objects,8);assert.equal(cleanup.cleanup_complete,true);
assert.equal(cleanup.original_harness_teardown_issue,'invoice_bigint_id_cast_as_uuid_array');
assert.equal(guard.status,'passed');assert.equal(guard.checks,5);
for(const key of ['real_storage_calls','database_calls','provider_calls','preexisting_collision_delete_calls'])assert.equal(guard[key],0);
assert(attempt.fixtures.length===2&&attempt.fixtures[0].media_type==='image/png'&&attempt.fixtures[1].media_type==='application/pdf');
assert.notEqual(attempt.fixtures[0].sha256,attempt.fixtures[1].sha256);
assert.equal(cleanup.runtime_storage_sha256,hash('nodia-server/dist/common/storage/storage.service.js'));
for(const item of attempt.source_receipts){assert(/^dist\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.js$/.test(item.path));assert(!item.path.split('/').includes('..'));assert.equal(hash('nodia-server/'+item.path),item.sha256);}
const artifacts=[attemptPath,cleanupPath,guardPath,historical,corrected,cleanupScript,guardScript,'docs/evidence/scripts/reconcile-nodia-ai-ai32-r06-invoice.cjs'].map(receipt);
const result={stage:'AI-32-R06',scope:'invoice_copy_and_compensation_private_lab_real_r2_disposable_sql',status:'passed_with_separate_fixture_cleanup',
  documentary_approval:false,configured_database_used:false,configured_business_records_modified:0,provider_generations:0,
  functional_checks:16,offline_guard_checks:5,compiled_runtime_sources_matched:attempt.source_receipts.length,
  executed_harness_status:'functional_checks_completed_fixture_teardown_failed',executed_harness:receipt(historical),
  reusable_corrected_harness:receipt(corrected),corrected_harness_cloud_reexecuted:false,
  fixture_cleanup:{script:receipt(cleanupScript),issue:'invoice_bigint_id_cast_as_uuid_array',rows_removed:2,additional_puts:0,cloud_delete_calls:2,all_eight_ledger_objects_get_404:true,complete:true},
  verified:['PNG_create_copy_and_atomic_receipt','distinct_PDF_replacement_same_invoice','legacy_transfer_without_new_attachment',
    'ready_stage_and_completed_receipt_reuse_without_PUT','receipt_SQL_failure_rollback_and_native_orphan_compensation',
    'origin_expiry_and_generation_janitor_preserve_independent_invoice_copies'],
  storage:{counters_scope:'guarded_port_invocations_not_raw_http',puts:8,original_uploads:3,domain_copies_including_rollback:4,legacy_fixture_seed:1,
    total_owned_delete_calls:8,physical_own_objects_remaining:0,real_inspector_calls:3,private_ledger_before_PUT_fsync:true},
  limitations:['Synthetic actor invokes real confirmation contracts; no UI button or Gemini tool call in this cycle.',
    'Expiry uses only sandbox chats backdated to due; not a 90-day wait or production retention SLA.',
    'No configured business database, user documents, bucket listing, model settings or application code changed.'],
  fixtures:attempt.fixtures,source_receipts:attempt.source_receipts,artifacts};
if(process.argv.includes('--check'))assert.deepEqual(read(output),result,'R06 invoice evidence changed');
else fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage:result.stage,status:'passed',functional_checks:16,offline_guard_checks:5,compiled_runtime_sources:attempt.source_receipts.length,
  owned_objects_remaining:0,configured_business_records_modified:0,provider_generations:0,documentary_approval:false}));
