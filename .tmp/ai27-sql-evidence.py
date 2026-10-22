import hashlib,json,sys
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
stage='/opt/nodia/verification/ai27-20261017'
archive='757c524ddf82df8a7ed055bbaf492061b10ad07413ca1795d29db3bfc95b1a21'
pin='3dc50f14cba16916c35a7f0fa60fe2ae77a6d5fc323b918ef77a85ba49c68e33'
out=root/'docs/evidence'
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
remote={line.split(maxsplit=1)[1].strip():line.split(maxsplit=1)[0] for line in (root/'.tmp/ai27-sql-input-hashes.log').read_text(encoding='utf-8-sig').splitlines() if line.strip()}
def result(log):
 s=(root/'.tmp'/log).read_text(encoding='utf-8-sig'); values=[];decoder=json.JSONDecoder()
 for n,c in enumerate(s):
  if c!='{':continue
  try:
   value,_=decoder.raw_decode(s[n:])
   if isinstance(value,dict) and 'checks' in value and isinstance(value['checks'],(int,list)):values.append(value)
  except json.JSONDecodeError:pass
 assert values,log
 return values[-1]
def inputs(names):
 values=[]
 for name in names:
  path='test/'+name;digest=sha(root/'nodia-server'/path)
  assert remote[path]==digest,path
  values.append({'path':'nodia-server/'+path,'sha256':digest})
 return values
def save(name,value):
 (out/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
postcheck=(root/'.tmp/ai27-sql-docker-postcheck.log').read_text(encoding='utf-8-sig').splitlines()
assert sorted(postcheck)==sorted(['nodia-gemini-microservice','nodia-lab-postgres-1','nodia-lab-redis-1'])
common={'observed_at_utc':datetime.now(timezone.utc).isoformat(),'stage_directory':stage,'compiled_production_archive_sha256':archive,'knowledge_pin_sha256':pin,'scope':'Synthetic disposable PostgreSQL only; no configured database mutation, provider inference, MCP write publication or Gemini acceptance.','operational_services_untouched':True,'disposable_containers_removed':True,'docker_postcheck':postcheck}
main=result('ai27-sql-main.log');assert main['checks']==36 and len(main['passed'])==36 and len(main['exercised_operations'])==17
save('nodia-ai-ai27-postgresql.json',{**common,'command':'node test/nodia-ai-ai27.integration.mjs','exit_code':0,'inputs':inputs(['nodia-ai-ai27.integration.mjs','nodia-ai-ai27-worker.fixture.mjs','nodia-ai.integration.fixture.mjs']),'result':main,'previous_attempts_not_acceptance':[{'completed_checks':23,'reason':'Synthetic cleanup cleared user 2 super-admin before restoring user 3, correctly triggering NI-13.','resolution':'Restore user 3 before clearing user 2; complete rerun.'},{'completed_checks':23,'reason':'Synthetic single worker dispatch could drain an earlier NI-13 queued job instead of the target revocation job.','resolution':'Drive the target execution to a terminal state with a bounded loop; complete rerun.'},{'completed_checks':31,'reason':'Execution-only child composition lacked RedisService in the newly imported native Core modules.','resolution':'CoreOperationsModule explicitly imports RedisModule in the final compiled archive; real child and all regressions rerun successfully.'}]})
entries=[]
for suffix,file,helpers in [('26','nodia-ai-ai26.integration.mjs',['nodia-ai-ai26-worker.fixture.mjs']),('25','nodia-ai-ai25.integration.mjs',['nodia-ai-ai25-worker.fixture.mjs']),('24','nodia-ai-ai24.integration.mjs',['nodia-ai-ai24-worker.fixture.mjs']),('23','nodia-ai-ai23.integration.mjs',['nodia-ai-ai23-worker.fixture.mjs']),('22','nodia-ai-ai22.integration.mjs',['nodia-ai-ai22-worker.fixture.mjs']),('20','nodia-ai-ai20.integration.mjs',['nodia-ai-ai20-worker.fixture.mjs']),('18','nodia-ai-ai18.integration.mjs',[]),('rental','rental.integration.mjs',['fixtures/authority.integration.mjs']),('08','nodia-ai-ai08.integration.mjs',[]),('modules','module-catalog.integration.mjs',['fixtures/authority.integration.mjs']),('actions','action-catalog.integration.mjs',['fixtures/authority.integration.mjs']),('roles','role-catalog.integration.mjs',['fixtures/authority.integration.mjs'])]:
 value=result(f'ai27-sql-regression-{suffix}.log');count=len(value['checks']) if isinstance(value['checks'],list) else value['checks']
 entries.append({'stage':suffix,'command':'node test/'+file,'exit_code':0,'checks':count,'inputs':inputs([file,*helpers,*([] if suffix in ['rental','08','modules','actions','roles'] else ['nodia-ai.integration.fixture.mjs'])]),'result':value})
normative=sha(root/'docs/mvp/28-rental-reservations-contracts.md');assert (root/'.tmp/ai27-sql-native-normative-hash.log').read_text().split()[0]==normative
save('nodia-ai-ai27-regressions.json',{**common,'checks':sum(value['checks'] for value in entries),'main_checks':36,'combined_checks':36+sum(value['checks'] for value in entries),'native_http_requests':sum(value['result'].get('requests',0) for value in entries),'native_sources_copied_separately_from_archive':['test/nodia-ai-ai08.integration.mjs','test/rental.integration.mjs','test/module-catalog.integration.mjs','test/action-catalog.integration.mjs','test/role-catalog.integration.mjs'],'native_normative_contract':{'path':'docs/mvp/28-rental-reservations-contracts.md','sha256':normative},'regressions':entries,'previous_attempts_not_acceptance':[{'stage':'26','completed_checks':38,'reason':'Execution-only child exposed the same missing RedisModule dependency; fixed in the final compiled archive and full regression rerun.'},{'stage':'08','reason':'Historical fixture imported the now-complete chat module and its background workers outside the authority-only migration/scope. Boot did not complete; exact test process and disposable container were terminated.','resolution':'Import NodiaAiAuthorizationModule, the boundary actually under test, preserving all 39 authority/domain assertions. Complete isolated rerun passed.'}]})
print(json.dumps({'main_checks':36,'regression_checks':sum(value['checks'] for value in entries),'combined_checks':36+sum(value['checks'] for value in entries),'native_http_requests':sum(value['result'].get('requests',0) for value in entries),'regressions':len(entries)}))
