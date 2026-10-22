import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def file_receipt(relative):
 path=root/relative
 return {'path':relative,'sha256':digest(path)}
status=json.loads((root/'.tmp/ai31-sql-run-status.json').read_text())
assert len(status['results'])==4 and all(row['exit_code']==0 for row in status['results'])
suites=[]
for record in status['results']:
 proof=json.loads((root/record['log']).read_text())
 assert proof['checks']==len(proof['passed'])
 suites.append({**record,'log_sha256':digest(root/record['log']),'result':proof})
manifest=json.loads((root/'.tmp/ai31-sql-tested-manifest.json').read_text())
files={entry['path']:entry['sha256'] for entry in manifest['files']}
for suite in suites:
 if suite['file'] in files: assert suite['source_sha256']==files[suite['file']]
source_paths=[]
for directory in ['nodia-ai-reports','nodia-ai-context','nodia-ai-tools','nodia-ai-observation']:
 for path in sorted((root/'nodia-server/src'/directory).rglob('*')):
  if path.is_file() and (path.suffix in {'.ts','.json'}) and not path.name.endswith('.spec.ts'):
   source_paths.append(path.relative_to(root).as_posix())
compiled_paths=[entry for entry in manifest['files'] if entry['path'].startswith('dist/')]
for entry in compiled_paths:
 assert digest(root/'nodia-server'/entry['path'])==entry['sha256']
tree=[{'path':path.relative_to(root/'nodia-server/dist').as_posix(),'sha256':digest(path)} for path in sorted((root/'nodia-server/dist').rglob('*')) if path.is_file() and 'dist/'+path.relative_to(root/'nodia-server/dist').as_posix() in files]
compiled_hash=hashlib.sha256(json.dumps(tree,sort_keys=True,separators=(',',':')).encode()).hexdigest()
cleanup=json.loads((root/'.tmp/ai31-sql-cleanup.json').read_text())
assert cleanup['remaining_test_containers']==[]
failures=[
 {'attempt':1,'log':'.tmp/ai31-sql-31-attempt01.log','completed_checks':0,'category':'fixture_error','reason':'The synthetic fixture attempted a zero recorded rental expense, while the native constraint requires amount > 0. Replaced with a positive voided fact whose registered aggregate contribution is zero; no constraint or production code changed.','archive_sha256':'60b750b2b899d659f43e2ba9ed63b62a7bf69f3094c13d99ca06b132218bf05a'},
 {'attempt':2,'log':'.tmp/ai31-sql-31-attempt02.log','completed_checks':45,'category':'fixture_assertion_error','reason':'The SQL leakage regex matched the substring relation inside the safe correlation_id key. Restricted the forbidden-word matcher to word boundaries; no production code changed.','archive_sha256':'783029f26669198ed25dd5b4aec8c74da0e9b6179ee414c780dac6f8663b280d'},
]
for row in failures: row['log_sha256']=digest(root/row['log'])
result={'stage':'AI-31','status':'passed_disposable_postgresql','desktop_observed_at_utc':datetime.now(timezone.utc).isoformat(),
 'clock_note':'Desktop and VM timestamps are retained in their own clock domains. The VM was approximately six minutes ahead; do not derive durations across clocks.',
 'scope':'Compiled actual report engine, technical tools, durable worker callback, receipt/replay and chat observation with disposable PostgreSQL and synthetic records/adapter.',
 'configured_database_used':False,'provider_inference':False,'native_mcp_account_used':False,'configured_services_mutated':False,
 'package':{'archive_sha256':status['archive_sha256'],'manifest':file_receipt('.tmp/ai31-sql-tested-manifest.json'),'files':len(files),'compiled_dist_files':len(compiled_paths),'compiled_dist_sha256':compiled_hash,'knowledge_release':json.loads((root/'nodia-server/dist/nodia-ai-context/config/knowledge-pin.json').read_text())['release_id']},
 'checks':sum(suite['result']['checks'] for suite in suites),'report_sql_queries':sum(suite['result'].get('report_sql_queries',0) for suite in suites),
 'suites':suites,'extra_assets':status['extra_assets'],'source_files':[file_receipt(path) for path in source_paths],
 'compiled_files':compiled_paths,'fixture_failures':failures,
 'superseded_success':{'log':'.tmp/ai31-sql-31-attempt03.log','sha256':digest(root/'.tmp/ai31-sql-31-attempt03.log'),'checks':48,'reason':'Expanded afterwards to exercise the actual durable report callback and chat result observation. These checks are not added again to the final total.'},
 'cleanup':cleanup,
 'limitations':['Synthetic adapter replaces provider inference only; authorization, SQL, worker, receipt persistence, replay and observation execute compiled application code.','No real Gemini inference or remote MCP transport was invoked.','This receipt certifies the identified staged artifact, not a later rebuild or activation.','Each source is observed independently, with no shared cross-source snapshot or implicit grand total.']}
(root/'docs/evidence/nodia-ai-ai31-sql-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'checks':result['checks'],'report_sql_queries':result['report_sql_queries'],'package':result['package'],'source_files':len(source_paths),'output':'docs/evidence/nodia-ai-ai31-sql-validation.json'}))
