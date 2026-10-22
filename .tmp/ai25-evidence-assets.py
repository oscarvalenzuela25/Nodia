from pathlib import Path
from PIL import Image
import json,hashlib
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
files=[]
for file in sorted((root/'docs/evidence/nodia-ai-ai25').glob('*.jpg')):
 with Image.open(file) as picture: width,height=picture.size
 files.append({'file':file.relative_to(root).as_posix(),'width':width,'height':height,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
ui={'task':'AI-25','scope':'isolated_synthetic_client_transport_no_business_database_no_provider',
 'verified_at_utc':datetime.now(timezone.utc).isoformat(),'origin':'http://127.0.0.1:5194',
 'checks':['Create preview preserves exact CLP bigint strings, channel, draft state and house timezone',
 'Invalid civil date2026-02-30 is rejected and retained in the open editor',
 'Corrected civil date2026-11-02 and focused input survive requested390x844 responsive viewport',
 'Saving corrected civil date creates revision2 with new hash and localized success toast',
 'Cancellation preview separates confirmed received, retained, expected refund and zero post-cancellation balance in CLP',
 'Changing only resolution saves revision2, preserves exact cancellation instant2026-10-17T12:30:00.000Z and accepts refund0',
 'English historical reservation receipt preserves bigint9007199254740994 and links to actual /tools/reservations route'],
 'requested_mobile_viewport':[390,844],'real_user_tab_5174_modified':False,'temporary_tab_closed':True,
 'viewport_override_reset':True,'qa_service_stopped':True,'screenshots':files,
 'limitations':['Synthetic adapter checks rendering and revision protocol, not recalculation of reservation prices or domain effects.','No real provider, MCP write, configured database, physical phone or virtual keyboard acceptance.']}
(root/'docs/evidence/nodia-ai-ai25-ui-validation.json').write_text(json.dumps(ui,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
before=load('.tmp/ai25-knowledge-before.json');after=load('nodia-server/dist/nodia-ai/knowledge/manifest.json')
fields=sorted(k for k in before.keys()|after.keys() if before.get(k)!=after.get(k))
assert fields==['registry_sha256','release_id'],fields
delta={'stage':'AI-25','previous_release':before['release_id'],'release':after['release_id'],
 'changed_manifest_fields':fields,'published_documents_unchanged':True,'published_fragments_unchanged':True,
 'capability_contracts_unchanged':True,'new_published_content':False,
 'reason':'One explicitly indexed draft/unregistered reservation lifecycle source changes only registry digest and release identity',
 'sources':48,'excluded':21,'published_capabilities':67,'published_fragments':27}
(root/'docs/evidence/nodia-ai-ai25-knowledge-delta.json').write_text(json.dumps(delta,indent=2)+'\n',encoding='utf-8')
old={f['path']:f['sha256'] for f in load('.tmp/ai25-sql-tested-manifest.json')['files']}
new={f['path']:f['sha256'] for f in load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json')['files']}
old_dist={p:h for p,h in old.items() if p.startswith('dist/')};new_dist={p:h for p,h in new.items() if p.startswith('dist/')}
assert old_dist==new_dist
changed=sorted(p for p in old.keys()|new.keys() if old.get(p)!=new.get(p))
assert changed==['test/nodia-ai-ai25.integration.mjs'],changed
parity={'stage':'AI-25','tested_archive_sha256':sha('.tmp/ai25-sql-tested-server.tar.gz'),
 'final_archive_sha256':sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz'),
 'production_dist_identical':True,'dist_files_checked':len(new_dist),'changed_package_files':changed,
 'reason':'Only test helper changed to generate a unique synthetic external_reference per Airbnb reservation; final harness is the exact tested version.',
 'final_harness_sha256':new[changed[0]]}
assert parity['tested_archive_sha256']=='d36ac0b2a9aeb99d93027cf25c1895db2745fbc7d371c5024e8896559e6d720e'
assert parity['final_harness_sha256']=='042b52eae21634a8aaeecb4d148bf5ce2f122421d928d59bbd235020a3889e29'
(root/'docs/evidence/nodia-ai-ai25-tested-release-parity.json').write_text(json.dumps(parity,indent=2)+'\n',encoding='utf-8')
log=(root/'.tmp/ai25-knowledge-validation.log').read_text(encoding='utf-8');evidence=json.loads(log[log.index('{'):])
assert evidence['checks']==53 and evidence['sourceDocuments']==48 and evidence['releaseId']==after['release_id']
(root/'docs/evidence/nodia-ai-ai25-knowledge-validation.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'screenshots':len(files),'ui_checks':len(ui['checks']),'dist':len(new_dist),'final_archive':parity['final_archive_sha256']}))
