from pathlib import Path
from PIL import Image
import json,hashlib
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((root/p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
files=[]
for file in sorted((root/'docs/evidence/nodia-ai-ai26').glob('*.jpg')):
 with Image.open(file) as picture: width,height=picture.size
 files.append({'file':file.relative_to(root).as_posix(),'width':width,'height':height,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
checks=[
 'Preparation editor exposes linen null, false and true as three independent choices; selecting unavailable is preserved as false',
 'Impossible civil date2026-02-30 is rejected without closing the preparation editor or losing the draft',
 'Corrected planned date2026-11-02 and focused field survive requested390x844 viewport',
 'Saving creates revision2 with a new hash and localized toast; planned time resolves in America/Santiago while actual ready_at stays null',
 'Refund preview distinguishes actual refunded money from voiding and does not claim an external transfer',
 'English historical money receipt preserves exact bigint9007199254740996 and links to /tools/reservations',
 'Block preview exposes house timezone America/Santiago and explicit affected turnover identities',
 'Editing only block reason retains original starts_at and ends_at offsets and nullable notes',
 'Saving block correction creates revision2/hash/toast and keeps human confirmation unavailable in the isolated fixture',
]
ui={'task':'AI-26','scope':'isolated_synthetic_client_transport_no_business_database_no_provider',
 'verified_at_utc':datetime.now(timezone.utc).isoformat(),'origin':'http://127.0.0.1:5194','checks':checks,
 'requested_mobile_viewport':[390,844],'real_user_tab_5174_modified':False,'temporary_tab_closed':True,
 'viewport_override_reset':True,'qa_service_stopped':True,'screenshots':files,
 'limitations':['Synthetic transport checks interface/protocol, not SQL effects or provider inference.','HTTP errors and DST metadata rejection are covered separately by component tests; no browser failNext injected.','No real MCP write, Gemini acceptance, physical phone or virtual keyboard acceptance.']}
(root/'docs/evidence/nodia-ai-ai26-ui-validation.json').write_text(json.dumps(ui,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
before=load('.tmp/ai26-knowledge-before.json');after=load('nodia-server/dist/nodia-ai/knowledge/manifest.json')
fields=sorted(k for k in before.keys()|after.keys() if before.get(k)!=after.get(k))
assert fields==['registry_sha256','release_id'],fields
delta={'stage':'AI-26','previous_release':before['release_id'],'release':after['release_id'],
 'changed_manifest_fields':fields,'published_documents_unchanged':True,'published_fragments_unchanged':True,
 'capability_contracts_unchanged':True,'new_published_content':False,
 'reason':'Two explicitly indexed draft/unregistered money and occupancy/preparation sources change only registry digest and release identity',
 'sources':50,'excluded':23,'published_capabilities':67,'published_fragments':27}
(root/'docs/evidence/nodia-ai-ai26-knowledge-delta.json').write_text(json.dumps(delta,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'ui_checks':len(checks),'screenshots':len(files),'knowledge_delta':fields}))
