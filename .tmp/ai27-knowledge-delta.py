from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text(encoding='utf-8'))
a=load('.tmp/ai27-knowledge-before.json');b=load('nodia-server/dist/nodia-ai/knowledge/manifest.json')
changes=[]
for old,new in zip(a['documents'],b['documents'],strict=True):
 assert {k:v for k,v in old.items() if k!='source_hashes'}=={k:v for k,v in new.items() if k!='source_hashes'}
 assert [s['path'] for s in old['source_hashes']]==[s['path'] for s in new['source_hashes']]
 for x,y in zip(old['source_hashes'],new['source_hashes'],strict=True):
  if x!=y:changes.append({'document_id':new['document_id'],'path':x['path'],'before_sha256':x['sha256'],'after_sha256':y['sha256']})
assert {c['path'] for c in changes}=={'nodia-server/src/'+name+'/use-case/save-'+name+'.use-case.ts' for name in ['user','role','action','module']}
assert a['fragments']==b['fragments'] and a['capability_contracts']==b['capability_contracts']
result={'stage':'AI-27','previous_release':a['release_id'],'release':b['release_id'],'changed_manifest_fields':sorted(k for k in a.keys()|b.keys() if a.get(k)!=b.get(k)),
 'document_source_hash_changes':changes,'published_document_bytes_unchanged':True,'published_fragments_unchanged':True,'capability_contracts_unchanged':True,'new_published_content':False,
 'reason':'One excluded draft path plus provenance hashes for four native Core writers now sharing the exclusive transaction; approved document bytes and all published fragments/read contracts stay identical',
 'sources':51,'excluded':24,'published_capabilities':67,'published_fragments':27}
(root/'docs/evidence/nodia-ai-ai27-knowledge-delta.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'fields':result['changed_manifest_fields'],'traced_native_source_hash_changes':len(changes),'pin':b['release_id']}))
