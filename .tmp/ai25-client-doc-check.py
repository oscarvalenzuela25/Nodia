from pathlib import Path
import json,re
root=Path('C:/Users/Oscar/Desktop/Nodia')
paths=['docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md','docs/nodia-ai/knowledge/reservations/features/confirmed-reservation-lifecycle.md','docs/nodia-ai/knowledge/reservations/README.md','docs/nodia-ai/knowledge/README.md']
broken=[]; links=0
for name in paths:
 p=root/name; text=p.read_text(encoding='utf-8')
 for target in re.findall(r'\]\(([^)]+)\)',text):
  if ':' in target or target.startswith('#'):continue
  links+=1
  if not (p.parent/target.split('#')[0]).exists():broken.append({'file':name,'target':target})
 if text.startswith('---\n'):
  data=json.loads(text.split('---',2)[1]); assert data['approval'] is None and data['document_status']=='draft' and data['integration_status']=='unregistered'
  for source in data['sources']: assert (root/source['path']).is_file(),source
labels={lang:json.loads((root/f'nodia-client/src/translate/{lang}/nodiaAi.json').read_text(encoding='utf-8')) for lang in ['es','en']}
presentation=(root/'nodia-client/src/modules/nodiaAi/infrastructure/rentalPresentation.ts').read_text(encoding='utf-8')
keys=re.findall(r'"([a-z_]+)"',re.search(r'const fields = \[(.*?)\] as const;',presentation).group(1))
for data in labels.values():
 for key in keys: assert key in data['proposal']['rental_fields'],key
 for op in ['create','update','confirm','start','complete','cancel']:assert 'nodia_rental_reservations_prepare_'+op in data['proposal']['rental_effects']
assert not broken,broken
print(json.dumps({'status':'passed','markdown_files':len(paths),'local_links':links,'source_and_frontmatter_checks':'passed','rental_field_labels_per_locale':len(keys),'locales':['es','en'],'approval':'unchanged_null','new_tools_published':0,'broken_links':broken},ensure_ascii=False,indent=2))
