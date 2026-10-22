from pathlib import Path
import json,re,hashlib,datetime
root=Path(__file__).resolve().parents[1]
def read(path): return (root/path).read_text(encoding='utf-8-sig')
def hashed(path): return {'path':path,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()}
def suite(path):
 text=read(path)
 assert not re.search(r'Test Files\s+\d+ failed',text),path
 files=int(re.search(r'Test Files\s+(\d+) passed',text).group(1));tests=int(re.search(r'Tests\s+(\d+) passed',text).group(1));seconds=float(re.search(r'Duration\s+([\d.]+)s',text).group(1))
 return {'tests':tests,'files':files,'workers':2,'duration_seconds':seconds,'exit_code':0}
full=suite('nodia-client/.tmp/ai29-client-full-final.log');full['workers']=4;focused=suite('nodia-client/.tmp/ai29-secure-focused-final.log')
assert full['tests']>=1589 and full['files']>=205
assert focused['tests']==195 and focused['files']==5
for name in ['typecheck','lint']:
 text=read(f'nodia-client/.tmp/ai29-client-{name}-final.log');assert not re.search(r'error TS|\d+ problems? \(|error  ',text),name
build=read('nodia-client/.tmp/ai29-client-build-final.log');seconds=float(re.search(r'built in ([\d.]+)s',build).group(1))
frozen=json.loads(read('.tmp/ai29-client-source-hashes.json'))
for path,sha in frozen.items():assert hashed(path)['sha256']==sha,path
markdown=['docs/mvp/75-nodia-ai-ai29-secure-human-flows.md','docs/nodia-ai/knowledge/general-settings/features/secure-ai-interaction.md','docs/nodia-ai/knowledge/general-settings/README.md']
broken=[];links=0
for name in markdown:
 for target in re.findall(r'\]\(([^)]+)\)',read(name)):
  if target.startswith(('http:','https:','#')):continue
  target=target.split('#')[0];links+=1
  if target and not (root/name).parent.joinpath(target).exists():broken.append({'source':name,'target':target})
assert not broken,broken
locales={}
for lang in ['es','en']:
 d=json.loads(read(f'nodia-client/src/translate/{lang}/nodiaAi.json'))['secure'];assert len(d['kinds'])==8 and len(d['status'])==8;locales[lang]={'operation_labels':len(d['kinds']),'flow_statuses':len(d['status'])}
value={'stage':'AI-29','scope':'client_unit_and_synthetic_human_transport_no_database_or_provider','status':'passed','verified_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'full_suite':full,'focused':focused,'typecheck':{'command':'npm run typecheck','exit_code':0},'lint':{'command':'npm run lint','exit_code':0},'build':{'command':'npm run build','vite_seconds':seconds,'exit_code':0,'historical_large_chunk_warning':True},'checks':[
'Eight closed secure intents localized in ES/EN; preview distinguishes confirmation from the separate human action',
'Human descriptor loaded only by explicit intent; secrets, OAuth codes, device codes and frames excluded from QueryCache, MutationCache and chat messages',
'API create requires a key; update allows empty input to preserve the key and sends an empty payload for confirmed metadata only',
'Failed save preserves password, modal and retry input; current authority failure blocks actions until a fresh authorized read',
'In-flight guard blocks double dispatch; uncertain response blocks retransmission and keeps observation available',
'Native Gemini Agentic authorization and Codex device schemas are bound to the frozen provider and mode; terminal state clears human-only interaction data',
'Reopening a pending login offers observation and withholds a second start',
'Only successful own-Nodia logout clears Nodia auth; provider logout preserves the app session',
'Generic execution resume/cancel withheld during secure waiting; secure cancel owns native reconciliation',
'Another owner cannot open secure channel from read-only execution observation',
'UUID secure receipts pass the bigint-or-UUID boundary without a BigInt conversion exception; synthetic key completion keeps execution/detail schemas valid',
'Historical opaque secure receipt refreshes masked provider/key metadata without declaring inference availability'],
'document_validation':{'status':'passed','markdown_files':len(markdown),'local_links':links,'broken_links':broken,'approval':'unchanged_null','new_tools_published':0,'locales':locales},'ui_evidence':'docs/evidence/nodia-ai-ai29-ui-validation.json','sources':[hashed(f'nodia-client/.tmp/{name}') for name in ['ai29-secure-focused-final.log','ai29-client-full-final.log','ai29-client-typecheck-final.log','ai29-client-lint-final.log','ai29-client-build-final.log']],'client_source_hashes':[{'path':path,'sha256':sha} for path,sha in frozen.items()],'limitations':['Synthetic transport/jsdom do not certify backend authority, SQL atomicity, native runtime exclusion, login or inference with a real provider','No account, credential, VM configuration or configured business record was changed by Client tests','JavaScript does not guarantee physical erasure of transient strings or browser/provider memory; transport cleanup prevents accidental application cache retention','Browser evidence is separate; no physical-device or production performance acceptance claimed']}
p=root/'docs/evidence/nodia-ai-ai29-client-validation.json';p.write_bytes((json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode('utf-8'));print(json.dumps({'status':value['status'],'full':full,'focused':focused,'sources':len(frozen),'links':links}))
