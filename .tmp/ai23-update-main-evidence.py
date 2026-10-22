import hashlib,json,sys
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1]
archive_sha=sys.argv[1]
assert len(archive_sha)==64 and all(c in '0123456789abcdef' for c in archive_sha)
out=root/'docs/evidence/nodia-ai-ai23-postgresql.json'
prior=json.loads(out.read_text(encoding='utf-8'))
main=json.loads((root/'.tmp/ai23-integration-current.json').read_text(encoding='utf-8'))
assert main['stage']=='AI-23' and main['status']=='passed' and main['checks']==len(main['results'])==47 and main['provider_calls']==0
sha=lambda rel:hashlib.sha256((root/rel).read_bytes()).hexdigest()
pin=json.loads((root/'nodia-server/dist/nodia-ai-context/config/knowledge-pin.json').read_text(encoding='utf-8'))
for name in ['environment','stage_directory','configured_database_used','configured_provider_used','production_acceptance']:
 main[name]=prior[name]
main.update({'verified_at':datetime.now(timezone.utc).isoformat(),'stage_base_archive_sha256':archive_sha,'knowledge_release_id':pin['release_id']})
main['test_script']={'path':'nodia-server/test/nodia-ai-ai23.integration.mjs','sha256':sha('nodia-server/test/nodia-ai-ai23.integration.mjs')}
main['worker_fixture']={'path':'nodia-server/test/nodia-ai-ai23-worker.fixture.mjs','sha256':sha('nodia-server/test/nodia-ai-ai23-worker.fixture.mjs')}
main['source_fixes_verified']=prior['source_fixes_verified']+[
 'Human cancellation closes a non-resumable failed suffix while preserving already committed receipts.',
 'Material correction after a supplier change creates a newly confirmed contact-only proposal using the verified supplier ID and current domain snapshot; ordinary strict binding still rejects the stale snapshot.'
]
main['earlier_attempts']=prior['earlier_attempts']
main['previous_verifications']=prior.get('previous_verifications',[])+[{'stage_base_archive_sha256':prior['stage_base_archive_sha256'],'status':prior['status'],'checks':prior['checks'],'verified_at':prior['verified_at'],'evidence_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'scope':'Earlier successful AI23 verification before final cancellation and remaining-work correction changes.'}]
out.write_text(json.dumps(main,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'checks':main['checks'],'stage_base_archive_sha256':archive_sha,'knowledge_release_id':pin['release_id'],'regression_evidence_preserved':True}))
