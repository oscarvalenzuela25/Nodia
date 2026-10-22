import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'docs/evidence'
statuses=json.loads((root/'.tmp/ai29-sql-status.json').read_text());assert len(statuses)==17 and all(v['exit_code']==0 for v in statuses)
remote=json.loads((root/'.tmp/ai29-sql-input-validation.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
archive=sha(root/'.tmp/ai29-sql-tested-server.tar.gz');manifest=json.loads((root/'.tmp/ai29-sql-tested-manifest.json').read_text());packaged={v['path']:v['sha256'] for v in manifest['files']}
for name,digest in remote['inputs'].items():assert sha(root/'nodia-server'/name)==digest,name

def parse(log):
 text=(root/log).read_text(encoding='utf-8-sig');candidates=[];decoder=json.JSONDecoder()
 for n,c in enumerate(text):
  if c!='{':continue
  try:
   value,_=decoder.raw_decode(text[n:])
   if isinstance(value,dict) and isinstance(value.get('checks'),(int,list)):candidates.append(value)
  except json.JSONDecodeError:pass
 return candidates[-1] if candidates else None

def entry(item):
 value=parse(item['log']);files=[item['file']];suffix=item['stage'];worker=f'test/nodia-ai-ai{suffix if suffix!="main" else "29"}-worker.fixture.mjs'
 if worker in remote['inputs']:files.append(worker)
 if item['file'].startswith('test/nodia-ai-') and suffix!='08':files.append('test/nodia-ai.integration.fixture.mjs')
 if suffix in ['rental','modules','actions','roles']:files.append('test/fixtures/authority.integration.mjs')
 result={**item,'command':'node '+item['file'],'inputs':[{'path':'nodia-server/'+f,'sha256':remote['inputs'][f]} for f in files],'log_sha256':sha(root/item['log'])}
 if value is None:result['checks']=None;result['result_text']=(root/item['log']).read_text(encoding='utf-8-sig').strip().splitlines()[-1]
 else:result['checks']=len(value['checks']) if isinstance(value['checks'],list) else value['checks'];result['result']=value
 return result
common={'generated_at_utc':datetime.now(timezone.utc).isoformat(),'stage_directory':'/opt/nodia/verification/ai29-20261017','compiled_production_archive_sha256':archive,'compiled_dist_files_verified':remote['compiled_dist_files_verified'],'knowledge_pin_sha256':remote['knowledge_pin'],'scope':'Synthetic disposable PostgreSQL, authenticated loopback HTTP and compiled worker processes. Native job responses are simulated. Actual GeminiService private Web HTTP status/cancel transport is exercised from a separate Node process against an authenticated loopback fixture only; real bridge authorization/native key encryption/domain persistence/receipts are exercised. No configured database reads/writes, real provider sessions/credentials, external inference or MCP write publication.','operational_services_untouched':True,'disposable_containers_removed':remote['disposable_containers_removed'],'docker_postcheck':remote['running_containers']}
main=entry(next(v for v in statuses if v['stage']=='main'));assert len(main['result']['exercised_operations'])==8
extra=json.loads((root/'.tmp/ai29-sql-native-inputs.json').read_text());overrides=[{'path':v['path'],'packaged_sha256':packaged[v['path']],'tested_sha256':v['sha256']} for v in extra if v['path'] in packaged and packaged[v['path']]!=v['sha256']]
assert all(v['path'] in ['test/nodia-ai-ai29.integration.mjs','test/nodia-ai-ai29-worker.fixture.mjs'] for v in overrides)
main_report={**common,**main,'test_only_overrides_after_archive':overrides,'previous_attempts_not_acceptance':[{'archive_sha256':'385027d12f462b331752880828338d0fb47814388d23204e5922f355acb49ba7','completed_checks':0,'reason':'Execution-only composition imported all AuthModule JWT/Google dependencies. Replaced with a shared focused AuthSessionRevocationModule; no real secrets added.'},{'archive_sha256':'5d63dca0706467d468663eee72b8b0d080ace4c7e6093467d1aabd51fc5dc888','completed_checks':18,'reason':'Harness kept stale/revoked/expired human flows pending and reached configured queue capacity. Added explicit cancellation and actual expiry sweep; did not increase admission limits.'},{'archive_sha256':'b6af74e8e16c22eed71d19b06ed1c3b58ba4ad20dfe49eefcaaa19e51b830720','completed_checks':34,'reason':'Pre-pause crash had no generic resume path. Added recovery only with proven local rollback and no secure human descriptor; never replay native IO. Diagnostic compilation contained test fixture type errors and is not final build evidence.'}]}
main_report['previous_attempts_not_acceptance'].extend([
 {'archive_sha256':'04dd0b7bd586f11a1bb64f38cb59c63b3e8fbbe62daa436054921f59871a55bc','completed_checks':39,'reason':'Harness scheduled another owner job after an unresolved native result had correctly quarantined that owner. Moved unresolved scenarios last; admission limits unchanged. A later diagnostic run passed49 checks but predated the Web transport restart fix.'},
 {'archive_sha256':'2c3e2140698a62db6f8563dca1acc91c81805e590ec6fa2a6faf5c42b5e261ee','completed_checks':53,'reason':'Main passed53. AI28 regression fault injection found duplicate execution-store providers, so its simulated lost COMMIT targeted another instance. Replaced with a shared singleton store module; also froze preparation from one coherent key-pool snapshot.'}
])
(out/'nodia-ai-ai29-postgresql.json').write_text(json.dumps(main_report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
main_report['known_limitations']=['AI29-R01: Codex login jobs are process-local; loss or restart remains unknown without replay or fabricated cancellation. A missing native Web/Agentic job likewise is not proof of closure.']
(out/'nodia-ai-ai29-postgresql.json').write_text(json.dumps(main_report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
entries=[entry(v) for v in statuses if v['stage']!='main'];count=sum(v['checks'] for v in entries if v['checks'] is not None);uncounted=[v['stage'] for v in entries if v['checks'] is None];assert count==432 and uncounted==['api','agentic']
report={**common,'checks':count,'main_checks':main['checks'],'combined_checks':main['checks']+count,'additional_uncounted_passing_suites':uncounted,'native_http_requests':sum(v.get('result',{}).get('requests',0) for v in entries),'native_sources_copied_separately_from_archive':['nodia-server/'+v['path'] for v in extra if v['path'] not in packaged],'native_normative_contract':{'path':'docs/mvp/28-rental-reservations-contracts.md','sha256':remote['normative_sha256']},'regressions':entries}
(out/'nodia-ai-ai29-regressions.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'main_checks':main['checks'],'regression_checks':count,'combined_checks':main['checks']+count,'additional_uncounted_passing_suites':uncounted,'native_http_requests':report['native_http_requests']}))
