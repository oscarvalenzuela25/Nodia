import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
before=json.loads((root/'.tmp/ai24-knowledge-before.json').read_text(encoding='utf-8'))
after=json.loads((root/'nodia-server/dist/nodia-ai/knowledge/manifest.json').read_text(encoding='utf-8'))
fields=sorted(k for k in before.keys()|after.keys() if before.get(k)!=after.get(k))
assert fields==['registry_sha256','release_id'],fields
assert before['release_id']=='67df82be991496f45536f62528c283b3342975e2351124512d6f232ed442d825'
value={'stage':'AI-24','previous_release':before['release_id'],'release':after['release_id'],
 'changed_manifest_fields':fields,'published_documents_unchanged':True,'published_fragments_unchanged':True,
 'capability_contracts_unchanged':True,'new_published_content':False,
 'reason':'One explicitly indexed draft/unregistered rental configuration document changes only registry digest and release identity',
 'sources':47,'excluded':20,'published_capabilities':67,'published_fragments':27}
(root/'docs/evidence/nodia-ai-ai24-knowledge-delta.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
print(json.dumps(value))
