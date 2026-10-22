from pathlib import Path
import json
r=Path.cwd();load=lambda p:json.loads((r/p).read_text(encoding='utf-8'))
a=load('.tmp/ai28-knowledge-before.json');b=load('nodia-server/dist/nodia-ai/knowledge/manifest.json');changes=[]
for old,new in zip(a['documents'],b['documents'],strict=True):
 assert {k:v for k,v in old.items() if k!='source_hashes'}=={k:v for k,v in new.items() if k!='source_hashes'}
 assert [s['path'] for s in old['source_hashes']]==[s['path'] for s in new['source_hashes']]
 for x,y in zip(old['source_hashes'],new['source_hashes'],strict=True):
  if x!=y:changes.append({'document_id':new['document_id'],'path':x['path'],'before_sha256':x['sha256'],'after_sha256':y['sha256']})
assert len(changes)==1 and changes[0]['path']=='nodia-server/src/ai-provider/ai-provider.service.ts'
assert a['fragments']==b['fragments'] and a['capability_contracts']==b['capability_contracts']
d={'stage':'AI-28','previous_release':a['release_id'],'release':b['release_id'],'changed_manifest_fields':sorted(k for k in a.keys()|b.keys() if a.get(k)!=b.get(k)),'document_source_hash_changes':changes,'published_document_bytes_unchanged':True,'published_fragments_unchanged':True,'capability_contracts_unchanged':True,'new_published_content':False,'reason':'One excluded draft path and provenance of native AI-provider service now sharing local writers and merging model observations; no published content or tools added.','sources':52,'excluded':25,'published_capabilities':67,'published_fragments':27}
(r/'docs/evidence/nodia-ai-ai28-knowledge-delta.json').write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8');print(json.dumps({'changed_manifest_fields':d['changed_manifest_fields'],'native_source_hash_changes':len(changes),'release':d['release']}))
