import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'docs/evidence'
status=json.loads((root/'.tmp/ai28-sql-status.json').read_text());assert len(status)==16 and all(v['exit_code']==0 for v in status)
remote=json.loads((root/'.tmp/ai28-sql-input-validation.json').read_text());pin='fcbb7f79c771ee1a85c02e7d80f21180441f04b85b44bcac33e838c8d22d4ee6';assert remote['knowledge_pin']==pin
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
archive=sha(root/'.tmp/ai28-sql-tested-server.tar.gz');assert archive=='bbfa8c065a77cffa1bc0f8f70d89263054cae259bb49f1419c32f465470234ea'
manifest=json.loads((root/'.tmp/ai28-sql-tested-manifest.json').read_text());packaged={v['path']:v['sha256'] for v in manifest['files']};assert remote['compiled_dist_files_verified']==851
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

def inputs(item):
 files=[item['file']];suffix=item['stage']
 worker=f'test/nodia-ai-ai{suffix if suffix!="main" else "28"}-worker.fixture.mjs'
 if worker in remote['inputs']:files.append(worker)
 if item['file'].startswith('test/nodia-ai-') and suffix!='08':files.append('test/nodia-ai.integration.fixture.mjs')
 if suffix in ['rental','modules','actions','roles']:files.append('test/fixtures/authority.integration.mjs')
 return [{'path':'nodia-server/'+f,'sha256':remote['inputs'][f]} for f in files]

def entry(item):
 value=parse(item['log']);log=root/item['log']
 result={'stage':item['stage'],'command':'node '+item['file'],'exit_code':item['exit_code'],'started_at_utc_windows_host':item['started_utc'],'duration_seconds':item['elapsed_seconds'],'inputs':inputs(item),'log_sha256':sha(log)}
 if value is None:
  result['checks']=None;result['result_text']=log.read_text(encoding='utf-8-sig').strip().splitlines()[-1]
 else:
  result['checks']=len(value['checks']) if isinstance(value['checks'],list) else value['checks'];result['result']=value
 return result
common={'generated_at_utc':datetime.now(timezone.utc).isoformat(),'stage_directory':'/opt/nodia/verification/ai28-20261017','compiled_production_archive_sha256':archive,'compiled_dist_files_verified':851,'knowledge_pin_sha256':pin,'scope':'Synthetic disposable PostgreSQL, local HTTP and compiled worker processes. No configured database reads/writes, production provider/session use, external inference or MCP write publication. Agentic CLI regression uses a loopback HTTP fixture only.','operational_services_untouched':True,'disposable_containers_removed':remote['disposable_containers_removed'],'docker_postcheck':remote['running_containers']}
main=entry(next(v for v in status if v['stage']=='main'));assert main['checks']==25 and len(main['result']['exercised_operations'])==4
extra=json.loads((root/'.tmp/ai28-sql-native-inputs.json').read_text())
overrides=[{'path':v['path'],'packaged_sha256':packaged[v['path']],'tested_sha256':v['sha256']} for v in extra if v['path'] in packaged and packaged[v['path']]!=v['sha256']]
assert len(overrides)==1 and overrides[0]['path']=='test/nodia-ai-ai28.integration.mjs'
main_report={**common,**main,'test_only_overrides_after_archive':overrides,'previous_attempts_not_acceptance':[{'archive_sha256':'b261907cb457a9a6a91e3ba214f081bbc312ae004500fd489cc06ac1a828b636','completed_checks':4,'reason':'The new test queried a nonexistent proposal_payloads table. Production proposal steps already contain the payload; corrected the fixture query and reran a fresh disposable database with the final compiled archive.','configured_data_affected':False}]}
(out/'nodia-ai-ai28-postgresql.json').write_text(json.dumps(main_report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
entries=[entry(v) for v in status if v['stage']!='main'];count=sum(v['checks'] for v in entries if v['checks'] is not None);uncounted=[v['stage'] for v in entries if v['checks'] is None];assert count==407 and uncounted==['api','agentic']
report={**common,'checks':count,'main_checks':25,'combined_checks':25+count,'additional_uncounted_passing_suites':uncounted,'native_http_requests':sum(v.get('result',{}).get('requests',0) for v in entries),'native_sources_copied_separately_from_archive':['nodia-server/'+v['path'] for v in extra if v['path'] not in packaged],'native_normative_contract':{'path':'docs/mvp/28-rental-reservations-contracts.md','sha256':remote['normative_sha256']},'regressions':entries}
(out/'nodia-ai-ai28-regressions.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'main_checks':25,'regression_checks':count,'combined_checks':25+count,'additional_uncounted_passing_suites':uncounted,'native_http_requests':report['native_http_requests'],'native_sources_separate':len(report['native_sources_copied_separately_from_archive'])}))
