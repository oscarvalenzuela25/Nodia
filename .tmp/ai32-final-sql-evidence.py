import hashlib,json
from datetime import datetime,timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def receipt(relative): return {'path':relative,'sha256':digest(root/relative)}
status=json.loads((root/'.tmp/ai32-sql-run-status.json').read_text())
assert len(status['results'])==6 and all(row['exit_code']==0 for row in status['results'])
suites=[]
decoder=json.JSONDecoder()
for record in status['results']:
 text=(root/record['log']).read_text(); parsed=[]
 for index,char in enumerate(text):
  if char=='{' and (index==0 or text[index-1]=='\n'):
   try: value,end=decoder.raw_decode(text[index:])
   except json.JSONDecodeError: continue
   if isinstance(value,dict) and 'stage' in value and 'checks' in value: parsed.append(value)
 assert len(parsed)==1,(record['stage'],len(parsed))
 proof=parsed[0];assert proof['checks']==len(proof.get('passed',proof.get('check_names',[])))
 suites.append({**record,'log_sha256':digest(root/record['log']),'result':proof})

manifest=json.loads((root/'.tmp/ai32-sql-tested-manifest.json').read_text())
files={entry['path']:entry['sha256'] for entry in manifest['files']}
assert len(files)==len(manifest['files'])
for suite in suites:
 if suite['file'] in files: assert suite['source_sha256']==files[suite['file']]
compiled=[entry for entry in manifest['files'] if entry['path'].startswith('dist/')]
for entry in compiled: assert digest(root/'nodia-server'/entry['path'])==entry['sha256']
tree=sorted(compiled,key=lambda entry:Path(entry['path']).parts)
compiled_hash=hashlib.sha256(json.dumps(tree,sort_keys=True,separators=(',',':')).encode()).hexdigest()
knowledge=json.loads((root/'nodia-server/dist/nodia-ai/knowledge/manifest.json').read_text())
pin=json.loads((root/'nodia-server/dist/nodia-ai-context/config/knowledge-pin.json').read_text())
assert knowledge['release_id']==pin['release_id']
schema=suites[0]['result']['schema'];assert schema=={'migrations':26,'nodia_ai_tables':19,'attachment_columns':25}
cleanup=json.loads((root/'.tmp/ai32-sql-cleanup.json').read_text())
assert cleanup['remaining_test_containers']==[]
source_paths=[]
for directory in ['nodia-ai-attachment','nodia-ai-invoice-attachment','nodia-ai-invoice-operations','nodia-ai-execution','nodia-ai-conversation','nodia-ai-context','nodia-ai-runtime','nodia-ai-adapter']:
 for path in sorted((root/'nodia-server/src'/directory).rglob('*')):
  if path.is_file() and path.suffix in {'.ts','.json'} and not path.name.endswith(('.spec.ts','.fixture.ts')):
   source_paths.append(path.relative_to(root).as_posix())
record={
 'stage':'AI-32','status':'passed_disposable_postgresql','desktop_observed_at_utc':datetime.now(timezone.utc).isoformat(),
 'clock_note':'Desktop and VM timestamps retain their own clock domains. Elapsed durations use the desktop monotonic clock only.',
 'scope':'Compiled attachment admission, durable staging, quotas, confirmation, invoice copies, recovery, expiry and regressions against disposable PostgreSQL with synthetic adapter/storage/inspection ports.',
 'configured_database_used':False,'configured_services_mutated':False,'provider_inference':False,'native_mcp_account_used':False,'real_r2_used':False,
 'package':{'archive_sha256':status['archive_sha256'],'manifest':receipt('.tmp/ai32-sql-tested-manifest.json'),
   'files':len(files),'compiled_dist_files':len(compiled),'compiled_dist_sha256':compiled_hash,
   'compiled_dist_hash_algorithm':'SHA-256 of UTF-8 json.dumps(array,sort_keys=True,separators=(comma,colon)); array sorted by POSIX path components; each item contains the dist/-prefixed path and SHA-256 of file bytes.',
   'knowledge_release':pin['release_id'],'published_product_capabilities':len(knowledge['capability_contracts']),'published_fragments':len(knowledge['fragments'])},
 'schema':schema,'checks':sum(s['result']['checks'] for s in suites),
 'report_sql_queries':sum(s['result'].get('report_sql_queries',0) for s in suites),
 'suites':suites,'runner_failures':[{**row,'log_sha256':digest(root/row['log']),'category':'verification_wrapper_incompatibility','reason':'The evidence wrapper used --input-type=module, which fork inherited and rejected for a file entrypoint. Clearing process.execArgv before importing fixes the wrapper; no production or fixture logic changed. The unchanged package passed AI22 on retry.'} for row in status.get('runner_failures',[])],'extra_assets':status['extra_assets'],'source_files':[receipt(path) for path in source_paths],
 'compiled_files':compiled,'cleanup':cleanup,
 'limitations':[
  'These suites use actual compiled authorization, SQL transactions, admission, worker, receipt and cleanup code, with synthetic private storage and parser/provider ports.',
  'No real provider inference, R2 account operation or configured application database is covered by this evidence.',
  'The chat accepts files up to its own20 MiB policy; invoice promotion preserves its native10 MiB image/PDF limit.',
  'Moving an existing legacy invoice file to another business without selecting a new chat attachment remains outside this staged protocol.',
  'This evidence certifies the exact identified verification package; it does not attest activation or productive acceptance.'
 ]}
target=root/'docs/evidence/nodia-ai-ai32-sql-validation.json'
target.write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print(json.dumps({'output':target.relative_to(root).as_posix(),'checks':record['checks'],'package':record['package'],'schema':schema}))
