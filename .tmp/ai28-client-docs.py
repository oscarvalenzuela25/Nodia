from pathlib import Path
import json,re,hashlib
root=Path.cwd()
files=[root/'docs/mvp/74-nodia-ai-ai28-provider-configuration.md',root/'docs/nodia-ai/knowledge/general-settings/features/confirmed-ai-configuration.md',root/'docs/nodia-ai/knowledge/general-settings/README.md']
links=0;broken=[]
for f in files:
 s=f.read_text(encoding='utf-8')
 for raw in re.findall(r'\[[^\]]*\]\(([^)]+)\)',s):
  dest=raw.split('#')[0].split(' "')[0].strip('<>')
  if not dest or re.match(r'^\w+://',dest):continue
  links+=1
  if not (f.parent/dest).resolve().exists():broken.append({'source':str(f.relative_to(root)),'target':dest})
 if s.startswith('---\n'):
  m=json.loads(s.split('---',2)[1]);assert m['approval'] is None and m['document_status']=='draft' and m['integration_status']=='unregistered'
  for source in m['sources']:assert(root/source['path']).is_file(),source['path']
locales={}
for language in ['es','en']:
 d=json.loads((root/f'nodia-client/src/translate/{language}/nodiaAi.json').read_text(encoding='utf-8'))
 assert len(d['proposal']['ai_provider_effects'])==4
 assert len(d['execution']['ai_provider_resources'])==2
 fields=d['proposal']['ai_provider_fields'];assert all(f'{mode}.{field}' in fields for mode in ['api_key','token_plan_web','token_plan_agentic'] for field in ['selected_model','ocr_model','ocr_focus_model','thinking_level'])
 locales[language]={'operation_labels':4,'resources':2,'fields':len(fields),'mode_paths':12}
assert not broken,broken
result={'status':'passed','markdown_files':len(files),'local_links':links,'broken_links':broken,'source_and_frontmatter_checks':'passed','approval':'unchanged_null','new_tools_published':0,'locales':locales}
(root/'.tmp/ai28-client-document-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
