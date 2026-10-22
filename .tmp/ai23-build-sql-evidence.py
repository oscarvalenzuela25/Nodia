import hashlib,json
from datetime import datetime,timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
read=lambda name:json.loads((root/'.tmp'/('ai23-'+name+'.json')).read_text(encoding='utf-8'))
main=read('integration-current')
assert main['stage']=='AI-23' and main['status']=='passed' and main['checks']==len(main['results']) and main['provider_calls']==0
sha=lambda rel:hashlib.sha256((root/rel).read_bytes()).hexdigest()
metadata={
 'verified_at':datetime.now(timezone.utc).isoformat(),
 'environment':'private Linux VM, PostgreSQL 16 disposable Docker fixtures only',
 'stage_directory':'/opt/nodia/verification/ai23-20261017',
 'stage_base_archive_sha256':'231c075e89a9aec62def067f7fc4cce8a5f090b986fc306fcb9c87108bfa6886',
 'knowledge_release_id':'67df82be991496f45536f62528c283b3342975e2351124512d6f232ed442d825',
 'configured_database_used':False,
 'configured_provider_used':False,
 'production_acceptance':False,
}
main.update(metadata)
main['test_script']={'path':'nodia-server/test/nodia-ai-ai23.integration.mjs','sha256':sha('nodia-server/test/nodia-ai-ai23.integration.mjs')}
main['worker_fixture']={'path':'nodia-server/test/nodia-ai-ai23-worker.fixture.mjs','sha256':sha('nodia-server/test/nodia-ai-ai23-worker.fixture.mjs')}
main['source_fixes_verified']=[
 'Execution status accepts the blocked dependent suffix created by confirmation.',
 'First-bind UPDATE RETURNING is normalized through a SELECT CTE for TypeORM PostgreSQL.',
 'The same atomic native effect transaction unlocks the next blocked step and queues its delivery.',
]
main['earlier_attempts']=[
 {'build':'a19c7e761e89a8c90c3571b9efefa6962d44ceb1455bf182dbb71c18a77cda5b','result':'failed baseline admission: blocked suffix rejected; no final acceptance'},
 {'build':'diagnostic-only isolated stage modifications','result':'identified TypeORM UPDATE result envelope and missing next-step unlock; not acceptance evidence'},
 {'build':'231c075e89a9aec62def067f7fc4cce8a5f090b986fc306fcb9c87108bfa6886','result':'harness input corrected to native owner_id and required category key; production validation preserved'},
]
out=root/'docs/evidence'
(out/'nodia-ai-ai23-postgresql.json').write_text(json.dumps(main,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
regressions=[]
for number in [17,18,20,21,22]:
 data=read('regression-ai'+str(number))
 checks=data.get('results',data.get('passed'))
 assert data['stage']=='AI-'+str(number) and data['checks']==len(checks)
 regressions.append({'stage':data['stage'],'checks':data['checks'],'script_sha256':sha('nodia-server/test/nodia-ai-ai'+str(number)+'.integration.mjs'),'status':'passed','result':data})
evidence={'stage':'AI-23','status':'passed',**metadata,'checks':sum(item['checks'] for item in regressions),'suites':regressions}
(out/'nodia-ai-ai23-regressions.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'main_checks':main['checks'],'regression_checks':evidence['checks'],'total':main['checks']+evidence['checks']}))
