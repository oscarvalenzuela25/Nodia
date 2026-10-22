import json,hashlib,re
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
checks=[]
def check(name,condition):assert condition,name;checks.append(name)
client=load('docs/evidence/nodia-ai-ai26-client-validation.json')
for source in client['sources']+client['logs']:check('client source/log checksum '+source['path'],sha(source['path'])==source['sha256'])
for key in ['postgresql','ai25-regression','ai24-regression','ai23-regression','ai22-regression','ai20-regression','ai18-regression','rental-regression']:
 report=load('docs/evidence/nodia-ai-ai26-'+key+'.json')
 check('SQL subprocess successful '+key,report['exit_code']==0)
 for source in report['inputs']:check('SQL source checksum '+source['path'],sha(source['path'])==source['sha256'])
local_links=0
for file in ['docs/mvp/72-nodia-ai-ai26-rental-money-occupancy-preparation.md','docs/nodia-ai/knowledge/reservations/features/confirmed-money.md','docs/nodia-ai/knowledge/reservations/features/confirmed-occupancy-preparation.md','docs/nodia-ai/knowledge/reservations/README.md','docs/nodia-ai/knowledge/README.md']:
 text=(root/file).read_text(encoding='utf-8')
 for match in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)',text):
  target=match[1].strip('<>').split('#')[0]
  if not target or re.match(r'^[a-z]+://',target,re.I):continue
  check('local Markdown target '+file+' '+target,(root/file).parent.joinpath(target).exists());local_links+=1
 if text.startswith('---'):
  data=json.loads(text.split('---',2)[1]);check('draft and unregistered '+file,data['document_status']=='draft' and data['integration_status']=='unregistered' and data['approval'] is None)
  for evidence in data['verification']['evidence_paths']:check('knowledge evidence exists '+evidence,(root/evidence).is_file())
client['document_validation']['local_links']=local_links
(root/'docs/evidence/nodia-ai-ai26-client-validation.json').write_text(json.dumps(client,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result={'stage':'AI-26','verified_at_utc':datetime.now(timezone.utc).isoformat(),'clock_source':'windows_host','checks':len(checks),'local_markdown_links':local_links,'all_passed':True,'approval_changed':False,'new_tools_published':0}
(root/'docs/evidence/nodia-ai-ai26-final-integrity.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
