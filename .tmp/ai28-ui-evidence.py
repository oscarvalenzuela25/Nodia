from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
import json,hashlib
r=Path.cwd();checks=[
'Preview identifies the exact target label and bigint ID and separates unknown availability from configuration and changes_chat_configuration false.',
'Editor exposes only registered non-secret scalar and enum fields; no credential or arbitrary JSON input.',
'Default mode can be selected as Web then cleared explicitly back to null.',
'Clearing the Web selected model keeps the Agentic selected model unassigned and does not copy models across channels.',
'Unsaved name, cleared model and focused name field survive requested390x844 viewport and return to desktop.',
'Saving creates revision2, a new content hash and localized success toast; synthetic confirmation remains disabled.',
'After the saved null model edit, the fixture-derived reasoning preferences also show model_id null and preserve false historical boolean.',
'English historical receipt retains exact bigint9007199254740996, historic warning and real /settings/ai-providers?provider=9007199254740996 navigation target.',
'Unknown availability, null assignments and false booleans remain distinct in the readonly preview.'
];shots=[]
for p in sorted((r/'docs/evidence/nodia-ai-ai28').glob('*.jpg')):
 with Image.open(p) as im:w,h=im.size
 shots.append({'file':p.relative_to(r).as_posix(),'width':w,'height':h,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(shots)==3
out={'task':'AI-28','scope':'isolated_synthetic_client_transport_no_business_database_no_provider','verified_at_utc':datetime.now(timezone.utc).isoformat(),'origin':'http://127.0.0.1:5194','checks':checks,'requested_mobile_viewport':[390,844],'real_user_tab_5174_modified':False,'temporary_tab_closed':True,'viewport_override_reset':True,'qa_service_stopped':True,'screenshots':shots,'limitations':['Synthetic transport verifies interface/protocol, not SQL effects or provider inference.','Business error, UTF8 bounds and translation-removal rejection are covered by component tests; no browser failNext injected.','No real MCP write, Gemini write acceptance, physical phone or virtual keyboard acceptance.']}
(r/'docs/evidence/nodia-ai-ai28-ui-validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'ui_checks':len(checks),'screenshots':len(shots)}))
