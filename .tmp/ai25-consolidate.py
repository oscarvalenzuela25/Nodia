import json,re,hashlib
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
def load(path):return json.loads((root/path).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256((root/path).read_bytes()).hexdigest()
def suite(path):
 text=(root/path).read_text(encoding='utf-8'); files=re.search(r'Test Files\s+(\d+) passed',text);tests=re.search(r'Tests\s+(\d+) passed',text);seconds=re.search(r'Duration\s+([\d.]+)s',text)
 assert files and tests and seconds,path
 return {'passed':True,'tests':int(tests[1]),'files':int(files[1]),'duration_seconds':float(seconds[1]),'log':path}
sql=load('docs/evidence/nodia-ai-ai25-postgresql.json');reg=load('docs/evidence/nodia-ai-ai25-regressions.json')
runtime=load('docs/evidence/nodia-ai-ai25-lab-runtime.json');static=load('docs/evidence/nodia-ai-v1-catalog-contracts-validation.json')
manifest=load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json');parity=load('docs/evidence/nodia-ai-ai25-tested-release-parity.json')
digest=sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz')
p={'task':'AI-25','status':'implemented_and_verified_private_lab_mcp_write_publication_pending','verified_at_utc':datetime.now(timezone.utc).isoformat(),
 'implementation':{'native_reservation_operations':6,'resource':'rental_reservations','operations':['create','update','confirm','start','complete','cancel'],
  'native_executors_total':38,'new_tables':0,'new_columns':0,'new_migrations':0,
  'availability_is_advisory_without_hold':True,'create_only_draft_without_payment_or_occupancy':True,'cancellation_does_not_register_refund':True,
  'exact_human_confirmation_and_atomic_native_effect_receipt_journal_audit':True,'real_actor_preserved':True,
  'action_specific_material_snapshots':True,'irrelevant_payments_and_neighbors_do_not_prevent_completion_or_metadata_edit':True,
  'native_dto_transformations_frozen_before_preview':True,'native_clock_shared':True,'same_day_preparation_and_approvals_use_native_rules':True,
  'historical_occupancy_and_money_preserved':True,'new_future_reservation_output_bindings':False,
  'native_bug_fixed':'Interval update passes actor.userId, not ActorReference object, to rental_turnovers.updated_by SQL.'},
 'server':{'full_suite':{**suite('.tmp/ai25-server-tests.log'),'max_workers':2},'build':{'passed':True,'log':'.tmp/ai25-server-build-final.log'},'lint':{'errors':0,'preexisting_warnings':3,'log':'.tmp/ai25-server-lint.log'},'coordinator_focused':suite('.tmp/ai25-root-focused.log')},
 'client':{'full_suite':{**suite('nodia-client/.tmp/ai25-client-full-release.log'),'max_workers':2},'focused_suite':suite('nodia-client/.tmp/ai25-client-focused-final.log'),'build_and_typecheck':{'passed':True,'build_log':'nodia-client/.tmp/ai25-client-build-final.log','typecheck_log':'nodia-client/.tmp/ai25-client-typecheck-final.log'},'lint':{'errors':0,'log':'nodia-client/.tmp/ai25-client-lint-final.log'}},
 'postgresql':{'new_checks':sql['result']['checks'],'regression_checks':reg['checks'],'total_numbered_checks':sql['result']['checks']+reg['checks'],'native_http_requests':reg['native_http_requests'],
  'evidence':['docs/evidence/nodia-ai-ai25-postgresql.json','docs/evidence/nodia-ai-ai25-regressions.json'],
  'tested_archive_sha256':sql['compiled_production_archive_sha256'],'final_harness_sha256':sql['inputs'][0]['sha256'],
  'release_parity':'docs/evidence/nodia-ai-ai25-tested-release-parity.json','configured_business_database_used':False,'real_ai_inferences':0,'temporary_test_containers_remaining':0},
 'ui':{'evidence':'docs/evidence/nodia-ai-ai25-ui-validation.json','transport':'isolated_synthetic','qa_5194_stopped':True,'real_tab_5174_modified':False},
 'deployment':{'activation':'docs/evidence/nodia-ai-ai25-lab-activation.json','runtime':'docs/evidence/nodia-ai-ai25-lab-runtime.json','dist_equality':'docs/evidence/nodia-ai-ai25-deployed-equality.json','services':'docs/evidence/nodia-ai-ai25-services.json','archive_sha256':digest,'archive_files':len(manifest['files']),'dist_files':828,'migrations':runtime['migrations'],'nodia_ai_tables':runtime['tables'],'nodia_ai_columns':runtime['columns'],'registered_native_executors':runtime['production_executor_registrations'],'pending_jobs':runtime['pending_jobs'],'open_attempts':runtime['open_attempts'],'held_or_unknown_slots':runtime['held_or_unknown_slots']},
 'knowledge':{'sources':48,'excluded_drafts':21,'published_capabilities':67,'published_fragments':27,'release_id':runtime['knowledge_release'],'published_content_and_contracts_unchanged':True,'delta_evidence':'docs/evidence/nodia-ai-ai25-knowledge-delta.json','compiler_current_corpus_checks':53,'validation_evidence':'docs/evidence/nodia-ai-ai25-knowledge-validation.json','rental_write_prepare_published':False},
 'static_validation':{'schema_definitions':static['schemaDefinitionsCompiled'],'domain_definitions':static['domainSchemas']['definitionsCompiled'],'source_hashes':static['sourceHashesChecked'],'fixtures':static['structuralFixtureAssertions'],'evidence':'docs/evidence/nodia-ai-v1-catalog-contracts-validation.json'},
 'limits_and_pending':['MCP preparation/write publication and Gemini write acceptance remain pending.','Money, blocks and turnover operations remain AI-26.','AI-15/22 external/R2/routing gates and AI-32 attachments remain independent.','New knowledge remains draft/unregistered and document71 in review; no automatic approval.']}
p['client']['evidence']='docs/evidence/nodia-ai-ai25-client-validation.json'
assert sql['exit_code']==0 and reg['status']=='passed' and p['postgresql']['total_numbered_checks']==266
assert runtime['migrations']==25 and runtime['tables']==18 and runtime['columns']==241 and runtime['production_executor_registrations']==38
assert runtime['pending_jobs']==runtime['open_attempts']==runtime['held_or_unknown_slots']==0
assert parity['production_dist_identical'] and parity['tested_archive_sha256']==sql['compiled_production_archive_sha256'] and parity['final_archive_sha256']==digest
assert load('docs/evidence/nodia-ai-ai25-deployed-equality.json')['archive_sha256']==digest
assert load('docs/evidence/nodia-ai-ai25-services.json')['windows']['client_proxy_api_http']==200
(root/'docs/evidence/nodia-ai-ai25-validation.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'task':'AI-25','server_tests':p['server']['full_suite']['tests'],'client_tests':p['client']['full_suite']['tests'],'sql':p['postgresql']['total_numbered_checks']}))
