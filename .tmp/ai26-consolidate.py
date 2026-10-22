import json,re,hashlib
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
def load(p):return json.loads((root/p).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256((root/p).read_bytes()).hexdigest()
def suite(p):
 text=(root/p).read_text(encoding='utf-8');files=re.search(r'Test Files\s+(\d+) passed \((\d+)\)',text);tests=re.search(r'Tests\s+(\d+) passed \((\d+)\)',text);seconds=re.search(r'Duration\s+([\d.]+)s',text)
 assert files and tests and seconds and files[1]==files[2] and tests[1]==tests[2],p
 return {'passed':True,'tests':int(tests[1]),'files':int(files[1]),'duration_seconds':float(seconds[1]),'log':p,'max_workers':2}
sql=load('docs/evidence/nodia-ai-ai26-postgresql.json');reg=load('docs/evidence/nodia-ai-ai26-regressions.json')
runtime=load('docs/evidence/nodia-ai-ai26-lab-runtime.json');static=load('docs/evidence/nodia-ai-v1-catalog-contracts-validation.json')
manifest=load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json')
old={f['path']:f['sha256'] for f in load('.tmp/ai26-sql-tested-manifest.json')['files']};new={f['path']:f['sha256'] for f in manifest['files']}
old_dist={p:h for p,h in old.items() if p.startswith('dist/')};new_dist={p:h for p,h in new.items() if p.startswith('dist/')}
assert old_dist==new_dist
changed=sorted(p for p in old.keys()|new.keys() if old.get(p)!=new.get(p))
assert all(p.startswith('test/nodia-ai-ai26') for p in changed),changed
digest=sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz')
parity={'stage':'AI-26','tested_archive_sha256':sha('.tmp/ai26-sql-tested-server.tar.gz'),'final_archive_sha256':digest,
 'production_dist_identical':True,'dist_files_checked':len(new_dist),'changed_package_files':changed,
 'reason':'Only the disposable SQL harness changed to drain a queued concurrent execution before asserting final states; production dist is identical.',
 'final_harness_sha256':new['test/nodia-ai-ai26.integration.mjs']}
assert sql['inputs'][0]['sha256']==parity['final_harness_sha256']
(root/'docs/evidence/nodia-ai-ai26-tested-release-parity.json').write_text(json.dumps(parity,indent=2)+'\n',encoding='utf-8')
p={'task':'AI-26','status':'implemented_and_verified_private_lab_mcp_write_publication_pending','verified_at_utc':datetime.now(timezone.utc).isoformat(),
 'clock_source':'windows_host','remote_runtime_and_deployment_clocks':'vm_host_not_normalized_against_windows',
 'implementation':{'new_native_operations':10,'money_operations':6,'calendar_preparation_operations':4,'native_executors_total':48,
 'native_rental_endpoint_coverage':{'total':44,'published_reads':21,'internal_writes':22,'native_recovery_coordinator':1},
 'new_tables':0,'new_columns':0,'new_migrations':0,'physical_delete':False,'new_future_output_bindings':False,
 'exact_human_confirmation_and_atomic_effect_receipt_journal_audit':True,'shared_native_turnover_rules':True,
 'money_capture_is_recording_not_external_transfer':True,'void_is_not_refund':True,'pay_updates_existing_expense':True,
 'null_false_true_linen_are_distinct':True,'planned_or_same_day_approved_does_not_mean_actual_preparation':True,
 'material_snapshots_ignore_unrelated_notes_linen_and_neighbor_status':True,
 'super_admin_observation_keeps_original_actor_journal_and_owner_only_mutations':True},
 'server':{'full_suite':suite('.tmp/ai26-server-tests-final.log'),'build':{'passed':True,'log':'.tmp/ai26-server-build-final.log'},
 'lint':{'errors':0,'preexisting_warnings':3,'log':'.tmp/ai26-server-lint.log'},'coordinator_focused':{'passed':True,'tests':134,'files':2,'duration_seconds':29.96}},
 'client':{'full_suite':suite('nodia-client/.tmp/ai26-client-full-release.log'),'focused_suite':suite('nodia-client/.tmp/ai26-client-focused-final.log'),
 'build_and_typecheck':{'passed':True,'build_log':'nodia-client/.tmp/ai26-client-build-final.log','typecheck_log':'nodia-client/.tmp/ai26-client-typecheck-final.log'},
 'lint':{'errors':0,'log':'nodia-client/.tmp/ai26-client-lint-final.log'},'evidence':'docs/evidence/nodia-ai-ai26-client-validation.json'},
 'postgresql':{'new_checks':sql['result']['checks'],'regression_checks':reg['checks'],'total_numbered_checks':sql['result']['checks']+reg['checks'],
 'native_http_requests':reg['native_http_requests'],'evidence':['docs/evidence/nodia-ai-ai26-postgresql.json','docs/evidence/nodia-ai-ai26-regressions.json'],
 'tested_archive_sha256':sql['compiled_production_archive_sha256'],'final_harness_sha256':parity['final_harness_sha256'],
 'release_parity':'docs/evidence/nodia-ai-ai26-tested-release-parity.json','configured_business_database_used':False,'real_ai_inferences':0,'temporary_test_containers_remaining':0},
 'ui':{'evidence':'docs/evidence/nodia-ai-ai26-ui-validation.json','transport':'isolated_synthetic','checks':9,'screenshots':4,'qa_5194_stopped':True,'real_tab_5174_modified':False},
 'deployment':{'activation':'docs/evidence/nodia-ai-ai26-lab-activation.json','runtime':'docs/evidence/nodia-ai-ai26-lab-runtime.json',
 'dist_equality':'docs/evidence/nodia-ai-ai26-deployed-equality.json','services':'docs/evidence/nodia-ai-ai26-services.json','archive_sha256':digest,
 'archive_files':len(manifest['files']),'dist_files':len(new_dist),'migrations':runtime['migrations'],'nodia_ai_tables':runtime['tables'],'nodia_ai_columns':runtime['columns'],
 'registered_native_executors':runtime['production_executor_registrations'],'pending_jobs':runtime['pending_jobs'],'open_attempts':runtime['open_attempts'],'held_or_unknown_slots':runtime['held_or_unknown_slots']},
 'knowledge':{'sources':50,'excluded_drafts':23,'published_capabilities':67,'published_fragments':27,'release_id':runtime['knowledge_release'],
 'published_content_and_contracts_unchanged':True,'delta_evidence':'docs/evidence/nodia-ai-ai26-knowledge-delta.json','compiler_current_corpus_checks':53,
 'validation_evidence':'docs/evidence/nodia-ai-ai26-knowledge-validation.json','rental_write_prepare_published':False},
 'static_validation':{'schema_definitions':static['schemaDefinitionsCompiled'],'domain_definitions':static['domainSchemas']['definitionsCompiled'],
 'source_hashes':static['sourceHashesChecked'],'fixtures':static['structuralFixtureAssertions'],'evidence':'docs/evidence/nodia-ai-v1-catalog-contracts-validation.json'},
 'limits_and_pending':['MCP preparation/write publication and Gemini write acceptance remain pending.','AI-15/22 external/R2/routing gates and AI-32 attachments remain independent.','Knowledge remains draft/unregistered and document72 in review; no automatic approval.','AI-27 is the next implementation step for administration Core.']}
assert sql['exit_code']==0 and reg['status']=='passed' and p['postgresql']['total_numbered_checks']==310
assert runtime['migrations']==25 and runtime['tables']==18 and runtime['columns']==241 and runtime['production_executor_registrations']==48
assert runtime['pending_jobs']==runtime['open_attempts']==runtime['held_or_unknown_slots']==0
assert parity['tested_archive_sha256']==sql['compiled_production_archive_sha256']
assert load('docs/evidence/nodia-ai-ai26-deployed-equality.json')['archive_sha256']==digest
assert load('docs/evidence/nodia-ai-ai26-services.json')['windows']['client_proxy_api_http']==200
(root/'docs/evidence/nodia-ai-ai26-validation.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'task':'AI-26','server_tests':p['server']['full_suite']['tests'],'client_tests':p['client']['full_suite']['tests'],'sql':p['postgresql']['total_numbered_checks']}))
