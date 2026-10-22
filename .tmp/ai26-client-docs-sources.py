import json,re
from pathlib import Path
r=Path(__file__).resolve().parents[1]
for slug,module in [('confirmed-money','money'),('confirmed-occupancy-preparation','operations')]:
 p=r/f'docs/nodia-ai/knowledge/reservations/features/{slug}.md';parts=p.read_text(encoding='utf-8').split('---',2);j=json.loads(parts[1]);name=f'nodia-ai-rental-{module}'
 for path in [f'nodia-server/src/{name}/use-case/build-{name}-operations.use-case.ts' if module=='money' else f'nodia-server/src/{name}/use-case/build-{name}.use-case.ts',f'nodia-server/src/{name}/{name}.service.ts']:
  assert (r/path).exists(),path
  j['sources'].append({'path':path,'kind':'implementation'})
 parts[1]='\n'+json.dumps(j,ensure_ascii=False,indent=2)+'\n';p.write_text('---'.join(parts),encoding='utf-8')

targets=[r/'docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md',r/'docs/nodia-ai/knowledge/reservations/features/confirmed-money.md',r/'docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md',r/'docs/nodia-ai/knowledge/reservations/README.md',r/'docs/nodia-ai/knowledge/README.md']
links=0
for p in targets:
 s=p.read_text(encoding='utf-8')
 for path in re.findall(r'\]\(([^)]+)\)',s):
  path=path.split('#')[0]
  if not path or ':' in path:continue
  assert (p.parent/path).resolve().exists(),f'{p}: {path}'
  links+=1
print(json.dumps({'files':len(targets),'links':links,'status':'passed'}))
