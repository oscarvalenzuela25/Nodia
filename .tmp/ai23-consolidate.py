import hashlib,json,re
from pathlib import Path
from datetime import datetime,timezone

root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
def suite(path):
 text=(root/path).read_text(encoding='utf-8')
 files=re.search(r'Test Files\s+(\d+) passed',text)
 tests=re.search(r'Tests\s+(\d+) passed',text)
 seconds=re.search(r'Duration\s+([\d.]+)s',text)
 assert files and tests and seconds,path
 return {'passed':True,'tests':int(tests[1]),'files':int(files[1]),'duration_seconds':float(seconds[1]),'log':path}

sql=load('docs/evidence/nodia-ai-ai23-postgresql.json')
reg=load('docs/evidence/nodia-ai-ai23-regressions.json')
runtime=load('docs/evidence/nodia-ai-ai23-lab-runtime.json')
archive=load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json')
static=load('docs/evidence/nodia-ai-v1-catalog-contracts-validation.json')
state={
 'task':'AI-23','status':'implemented_and_verified_private_lab_mcp_write_publication_pending',
 'verified_at_utc':datetime.now(timezone.utc).isoformat(),
 'implementation':{
  'max_steps':8,'order':'stable_input_order_sequential_stop_on_failure',
  'native_ports':26,'financial_ports':12,'business_ports':14,
  'typed_dependency':'nodia_providers_prepare_create.id -> nodia_provider_contacts_prepare_create.provider_id',
  'atomic_draft_claim_and_individual_supersession':True,
  'confirmation':'exact_revision_hash_human_button_for_whole_set',
  'commit_boundary':'one_native_effect_receipt_outbox_and_next_step_unlock',
  'first_binding':'immutable_command_scope_preconditions_envelope_and_hash_before_effect',
  'partial_failure':'preserve_committed_prefix_stop_remaining',
  'resume':'explicit_human_same_identity_and_binding_current_authority',
  'material_correction':'new_remaining_suffix_proposal_hash_confirmation_prior_execution_id',
  'retention':'payload_purged_with_source_business_records_preserved_no_archive',
  'new_tables':0,'existing_columns_added':2,'new_migrations':1,
 },
 'server':{'full_suite':{**suite('.tmp/ai23-server-release-tests.log'),'max_workers':4},
  'build':{'passed':True,'log':'.tmp/ai23-server-release-build.log'},
  'lint':{'errors':0,'preexisting_warnings':3,'log':'.tmp/ai23-server-release-lint.log'}},
 'client':{'full_suite_before_final_cancel_fix':{**suite('.tmp/ai23-client-full.log'),'max_workers':2},
  'final_cancel_fix_focused_suite':suite('.tmp/ai23-client-cancel-final.log'),
  'note':'Full suite and final focused verification are separate runs; counts are not added together.',
  'build_and_typecheck':{'passed':True,'log':'.tmp/ai23-client-cancel-build.log'},
  'lint':{'errors':0,'log':'.tmp/ai23-client-cancel-lint.log'}},
 'postgresql':{'new_checks':sql['checks'],'regression_checks':reg['checks'],
  'total_numbered_checks':sql['checks']+reg['checks'],
  'main_evidence':'docs/evidence/nodia-ai-ai23-postgresql.json',
  'regression_evidence':'docs/evidence/nodia-ai-ai23-regressions.json',
  'main_archive_sha256':sql['stage_base_archive_sha256'],
  'regression_archive_sha256':reg['stage_base_archive_sha256'],
  'note':'The earlier full regression archive and final AI-23 archive are identified separately; final changes also have focused and full unit coverage.',
  'data':'synthetic_disposable_postgresql_16','configured_business_database_used':False,
  'real_ai_inferences':0,'real_r2':False,'temporary_test_containers_remaining':0,
  'remaining_containers_observed':['nodia-gemini-microservice','nodia-lab-postgres-1','nodia-lab-redis-1']},
 'ui':{'evidence':'docs/evidence/nodia-ai-ai23-ui-validation.json',
  'transport':'isolated_synthetic','real_tab_5174_preserved':True,'qa_5194_stopped':True},
 'deployment':{'activation':'docs/evidence/nodia-ai-ai23-lab-activation.json',
  'runtime':'docs/evidence/nodia-ai-ai23-lab-runtime.json',
  'services':'docs/evidence/nodia-ai-ai23-services.json',
  'dist_equality':'docs/evidence/nodia-ai-ai23-deployed-equality.json',
  'archive_sha256':sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz'),
  'archive_files':len(archive['files']),'migrations':runtime['migrations'],
  'nodia_ai_tables':runtime['tables'],'nodia_ai_columns':runtime['columns'],
  'registered_native_executors':runtime['production_executor_registrations'],
  'pending_jobs':runtime['pending_jobs'],'open_attempts':runtime['open_attempts'],
  'held_or_unknown_slots':runtime['held_or_unknown_slots']},
 'knowledge':{'published_read_capabilities':67,'published_fragments':27,
  'release_id':runtime['knowledge_release'],'new_draft_product_revision':23,
  'new_draft_coordination_revision':13,'approved_source_bodies_changed':False,
  'compiler_and_current_corpus_checks':53,'sources':46,'excluded_sources':19,
  'validation_evidence':'docs/evidence/nodia-ai-ai23-knowledge-validation.json',
  'validator_maintenance':'Current-mode historical AI-19 registry expectations reconciled with the AI-22 release and both excluded drafts; historical mode and negative fixtures preserved.'},
 'static_validation':{'evidence':'docs/evidence/nodia-ai-v1-catalog-contracts-validation.json',
  'schema_definitions':static['schemaDefinitionsCompiled'],'source_hashes':static['sourceHashesChecked'],'new_http_handlers':0},
 'limits_and_pending':['MCP preparation/write tools remain unpublished; no Gemini business write acceptance claimed.',
  'Only provider creation to contact creation has a registered dependent output binding; other sequences use known independent inputs.',
  'AI-15/22 real R2 and external/routing acceptance gates remain; new attachments and moving invoices with files need AI-32.',
  'Draft knowledge, ADR-050 and the full proposed ERD are not automatically approved.'],
}
assert sql['status']==reg['status']=='passed'
assert sql['stage_base_archive_sha256']==state['deployment']['archive_sha256']
assert load('docs/evidence/nodia-ai-ai23-deployed-equality.json')['archive_sha256']==state['deployment']['archive_sha256']
assert runtime['migrations']==25 and runtime['tables']==18 and runtime['columns']==241
assert state['deployment']['pending_jobs']==state['deployment']['open_attempts']==state['deployment']['held_or_unknown_slots']==0
(root/'docs/evidence/nodia-ai-ai23-validation.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'task':'AI-23','server_tests':state['server']['full_suite']['tests'],'client_full':state['client']['full_suite_before_final_cancel_fix']['tests'],'sql':state['postgresql']['total_numbered_checks']}))
