from pathlib import Path
import json,re,hashlib,datetime,shutil
root=Path.cwd()
def log(name):
 p=root/'.tmp'/name
 return re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',p.read_text(encoding='utf-8-sig'))
def suite(name):
 s=log(name)
 tests=re.search(r'Tests\s+(\d+) passed \((\d+)\)',s);files=re.search(r'Test Files\s+(\d+) passed \((\d+)\)',s);duration=re.search(r'Duration\s+([\d.]+)s',s)
 assert tests and tests[1]==tests[2] and files and files[1]==files[2] and duration,name
 assert not re.search(r'\d+ failed',s),name
 return {'tests':int(tests[1]),'files':int(files[1]),'workers':2,'duration_seconds':float(duration[1]),'exit_code':0}
full=suite('ai28-client-full-final.log');focused=suite('ai28-client-focused-final.log')
build=log('ai28-client-build-final.log');vite=re.search(r'built in ([\d.]+)s',build);assert vite
for name in ['ai28-client-typecheck-final.log','ai28-client-lint-final.log']:assert not re.search(r'error TS|\d+ errors|Error:',log(name)),name
sources=[]
for name in ['ai28-client-focused-final.log','ai28-client-full-final.log','ai28-client-typecheck-final.log','ai28-client-lint-final.log','ai28-client-build-final.log']:
 old=root/'.tmp'/name;target=root/'nodia-client/.tmp'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(old,target);sources.append({'path':target.relative_to(root).as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
r={'stage':'AI-28','scope':'client_unit_and_synthetic_transport_no_database_or_provider','status':'passed','verified_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'full_suite':full,'focused':focused,'typecheck':{'command':'npm run typecheck','exit_code':0},'lint':{'command':'npm run lint','exit_code':0},'build':{'command':'npm run build','vite_seconds':float(vite[1]),'exit_code':0,'historical_large_chunk_warning':True},'checks':['Four closed registered provider configuration operations and two receipt resources localized in ES/EN; no DELETE or credential editor','Connection labels include exact string bigint ID and link to the actual instance; catalog links to existing settings overview','Read-only catalog, defaults, affected connections and unknown availability shown without fabricated operational capability','Mode-specific persisted model paths remain isolated, with explicit null clearing; no model fallback', 'Three provider errors and Core translation removal rejection use ES/EN feedback and preserve the pending editor without announcing an effect','Nullable default mode is admitted from saved metadata; invalid enum values continue to be rejected','Provider strings respect UTF-8 byte limits, incomplete empty model values require explicit null, and rejected corrections preserve inputs and localized feedback','Completed effects invalidate administrative configuration and actor chat caches without changing persisted selection, granting authority, or fetching API keys','Queued admission does not invent a completed provider effect or available model','Reasoning preferences show selected-model override, general level and historical boolean separately; configuration is not proof of support'],'document_validation':json.loads((root/'.tmp/ai28-client-document-validation.json').read_text(encoding='utf-8')),'ui_evidence':'docs/evidence/nodia-ai-ai28-ui-validation.json','sources':sources,'limitations':['Synthetic transport and jsdom do not certify SQL atomicity, backend authorization or provider inference','No account, model selection, secret, VM configuration or production business record was changed by Client tests','Browser evidence is maintained separately; no physical-device or production performance acceptance claimed']}
(root/'docs/evidence/nodia-ai-ai28-client-validation.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'full':full,'focused':focused,'vite_seconds':float(vite[1])}))
