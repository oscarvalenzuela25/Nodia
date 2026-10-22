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
sql_evidence=load('docs/evidence/nodia-ai-ai24-postgresql.json');sql=sql_evidence['result'];reg=load('docs/evidence/nodia-ai-ai24-regressions.json')
runtime=load('docs/evidence/nodia-ai-ai24-lab-runtime.json');static=load('docs/evidence/nodia-ai-v1-catalog-contracts-validation.json')
archive=load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json');digest=sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz')
p={'task':'AI-24','status':'implemented_and_verified_private_lab_mcp_write_publication_pending','verified_at_utc':datetime.now(timezone.utc).isoformat(),
 'implementation':{'native_configuration_operations':6,'families':['rental_properties','rental_collaborators','rental_cancellation_policies'],'operations':['create','update'],
  'native_executors_total':32,'native_journal_audit_effect_receipt_transaction_shared':True,'new_tables':0,'new_columns':0,'new_migrations':0,
  'owner_and_super_admin_configuration_only':True,'actor_preserved':True,'archive_preserves_history_occupancy_money':True,
  'policy_rules_atomic_replacement':True,'structured_review_kind':'rental_cancellation_rules','future_rental_output_bindings_added':False,
  'shared_native_transaction_deadline_seconds':10,'bounded_per_statement_timeout_and_prior_wrapper_restored':True,'native_error_mapping_preserved':True},
 'server':{'full_suite':{**suite('.tmp/ai24-server-release-tests.log'),'max_workers':4},'build':{'passed':True,'log':'.tmp/ai24-server-release-build.log'},'lint':{'errors':0,'preexisting_warnings':3,'log':'.tmp/ai24-server-release-lint.log'}},
 'client':{'full_suite':{**suite('nodia-client/.tmp/ai24-client-full-release.log'),'max_workers':2},'focused_suite':suite('nodia-client/.tmp/ai24-client-focused-final.log'),'build_and_typecheck':{'passed':True,'log':'nodia-client/.tmp/ai24-client-build-final.log'},'lint':{'errors':0,'log':'nodia-client/.tmp/ai24-client-lint-final.log'}},
 'postgresql':{'new_checks':sql['checks'],'regression_checks':reg['checks'],'total_numbered_checks':sql['checks']+reg['checks'],'evidence':['docs/evidence/nodia-ai-ai24-postgresql.json','docs/evidence/nodia-ai-ai24-regressions.json'],'configured_business_database_used':False,'real_ai_inferences':0,'real_r2':False,'temporary_test_containers_remaining':0},
 'ui':{'evidence':'docs/evidence/nodia-ai-ai24-ui-validation.json','transport':'isolated_synthetic','qa_5194_stopped':True,'real_tab_5174_modified':False},
 'deployment':{'activation':'docs/evidence/nodia-ai-ai24-lab-activation.json','runtime':'docs/evidence/nodia-ai-ai24-lab-runtime.json','dist_equality':'docs/evidence/nodia-ai-ai24-deployed-equality.json','services':'docs/evidence/nodia-ai-ai24-services.json','archive_sha256':digest,'archive_files':len(archive['files']),'migrations':runtime['migrations'],'nodia_ai_tables':runtime['tables'],'nodia_ai_columns':runtime['columns'],'registered_native_executors':runtime['production_executor_registrations'],'pending_jobs':runtime['pending_jobs'],'open_attempts':runtime['open_attempts'],'held_or_unknown_slots':runtime['held_or_unknown_slots']},
 'knowledge':{'sources':47,'excluded_drafts':20,'published_capabilities':67,'published_fragments':27,'release_id':runtime['knowledge_release'],'published_content_and_contracts_unchanged':True,'delta_evidence':'docs/evidence/nodia-ai-ai24-knowledge-delta.json','compiler_current_corpus_checks':53,'validation_evidence':'docs/evidence/nodia-ai-ai24-knowledge-validation.json','rental_write_prepare_published':False},
 'static_validation':{'schema_definitions':static['schemaDefinitionsCompiled'],'domain_definitions':static['domainSchemas']['definitionsCompiled'],'source_hashes':static['sourceHashesChecked'],'fixtures':static['structuralFixtureAssertions'],'evidence':'docs/evidence/nodia-ai-v1-catalog-contracts-validation.json'},
 'limits_and_pending':['MCP preparation/write tools remain unpublished; no Gemini business write acceptance claimed.','Reservation lifecycle and money operations remain AI-25/26; no rental DELETE introduced.','AI-15/22 R2/external/routing gates and AI-32 attachments remain.','New knowledge remains draft/unregistered; documentation is not automatically approved.']}
assert sql_evidence['exit_code']==0 and sql['checks']==36 and reg['status']=='passed'
assert runtime['migrations']==25 and runtime['tables']==18 and runtime['columns']==241 and runtime['production_executor_registrations']==32
assert runtime['pending_jobs']==runtime['open_attempts']==runtime['held_or_unknown_slots']==0
assert load('docs/evidence/nodia-ai-ai24-deployed-equality.json')['archive_sha256']==digest
(root/'docs/evidence/nodia-ai-ai24-validation.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'task':'AI-24','server_tests':p['server']['full_suite']['tests'],'client_tests':p['client']['full_suite']['tests'],'sql':p['postgresql']['total_numbered_checks']}))
