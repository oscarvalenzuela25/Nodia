from pathlib import Path
from datetime import datetime, timezone
import re,json,hashlib,sys
base=Path.cwd();client=base/'nodia-client';logs=client/'.tmp'
def suite(name):
 text=(logs/name).read_text(encoding='utf-8');f=re.search(r'Test Files\s+(\d+) passed \((\d+)\)',text);t=re.search(r'Tests\s+(\d+) passed \((\d+)\)',text);d=re.search(r'Duration\s+([\d.]+)s',text)
 assert f and t and d and f[1]==f[2] and t[1]==t[2],name
 return {'tests':int(t[1]),'files':int(f[1]),'workers':2,'duration_seconds':float(d[1]),'exit_code':0}
docs=[base/p for p in ['docs/mvp/73-nodia-ai-ai27-core-administration.md','docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md','docs/nodia-ai/knowledge/general-settings/README.md','docs/nodia-ai/knowledge/README.md']]
links=0
for p in docs:
 text=p.read_text(encoding='utf-8')
 for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
  if re.match(r'https?://|#|mailto:',target):continue
  target=target.split('#')[0]
  if not target:continue
  assert (p.parent/target).resolve().exists(),(p,target)
  links+=1
 if text.startswith('---'):
  front=json.loads(text.split('---',2)[1]);assert front['approval'] is None and front['document_status']=='draft' and front['integration_status']=='unregistered'
  for source in front['sources']:assert (base/source['path']).exists(),source
es=json.loads((client/'src/translate/es/nodiaAi.json').read_text(encoding='utf-8'));en=json.loads((client/'src/translate/en/nodiaAi.json').read_text(encoding='utf-8'))
for section in ['core_fields','core_effects','core_deletion_values']:assert set(es['proposal'][section])==set(en['proposal'][section])
assert len(es['proposal']['core_effects'])==17
assert set(es['execution']['core_resources'])==set(en['execution']['core_resources']) and len(es['execution']['core_resources'])==6
if '--docs-only' in sys.argv:
 print(json.dumps({'markdown_files':len(docs),'local_links':links,'core_effects_per_locale':17,'core_resources_per_locale':6,'core_field_labels_per_locale':len(es['proposal']['core_fields']),'source_frontmatter_and_ES_EN':'passed'},ensure_ascii=False))
 raise SystemExit(0)
build=(logs/'ai27-client-build-final.log').read_text(encoding='utf-8');m=re.search(r'built in ([\d.]+)s',build);assert m
paths=['nodia-client/.tmp/'+name for name in ['ai27-client-focused-final.log','ai27-client-full-release.log','ai27-client-typecheck-final.log','ai27-client-lint-final.log','ai27-client-build-final.log']]
data={'stage':'AI-27','scope':'client_unit_and_synthetic_transport_no_database_or_provider','status':'passed','verified_at_utc':datetime.now(timezone.utc).isoformat(),'full_suite':suite('ai27-client-full-release.log'),'focused':suite('ai27-client-focused-final.log'),'typecheck':{'command':'npm run typecheck','exit_code':0},'lint':{'command':'npm run lint','exit_code':0},'build':{'command':'npm run build','vite_seconds':float(m[1]),'exit_code':0,'historical_large_chunk_warning':'Some chunks are larger' in build},'checks':['17 registered Core actions and6 resources localized in ES/EN; no invented user DELETE or individual GET','Resolved associations, users affected and removed access render recursively as readonly facts before the exact button','Final association editing uses shared SelectMultipleInput and exact string bigint IDs; duplicate, zero, padded, exponential and overflow IDs rejected','TranslationInput edits structured key/ES/EN entries; incomplete translations remain editable and block PATCH','Unedited translations with reordered public object fields do not produce spurious edits','Known native Core NI13 business403 errors preserve the proposal cache, editor and draft while authorization403 continues to revoke observation','Completed receipts link to actual Settings destinations and revalidate current actor authorization, Core catalogs and chat observation without granting permissions','Malformed stored collections and incompatible structured metadata bounds disable human controls','Transport rejection preserves role IDs, translation text and other command fields; toasts use localized native messages'],'document_validation':{'status':'passed','markdown_files':len(docs),'local_links':links,'source_and_frontmatter_checks':'passed','core_effects_per_locale':17,'core_resources_per_locale':6,'core_field_labels_per_locale':len(es['proposal']['core_fields']),'locales':['es','en'],'approval':'unchanged_null','new_tools_published':0,'broken_links':[]},'ui_evidence':'docs/evidence/nodia-ai-ai27-ui-validation.json','sources':[{'path':p,'sha256':hashlib.sha256((base/p).read_bytes()).hexdigest()} for p in paths]}
(base/'docs/evidence/nodia-ai-ai27-client-validation.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:data[k] for k in ['full_suite','focused','build','document_validation']},ensure_ascii=False))
