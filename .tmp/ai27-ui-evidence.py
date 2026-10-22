import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
from PIL import Image
root=Path.cwd()
checks=[
'User preview identifies the exact target label and bigint ID and shows resolved role/module associations and access loss as read-only data.',
'Invalid association ID 1e3 remains in the editor and cannot be added.',
'Valid bigint ID 9007199254740996 is added as an exact string while the existing association remains.',
'Unsaved name, associations and field focus survive the requested390x844 viewport.',
'Saving the user correction yields revision2, a new hash and a localized toast; synthetic fixture keeps confirmation disabled.',
'Translations use structured ES/EN fields; empty required ES blocks save and retains the English value and editor.',
'Correcting ES to Rol revisado de QA yields revision2/new hash/toast while English Synthetic role remains unchanged.',
'Deletion preview identifies the module label/ID, affected users and removed module, and explicitly distinguishes physical deletion.',
'A deletion with no editable fields still exposes an enabled Confirm revision1 button.',
'Clicking confirm uses only the synthetic challenge/confirmation transport and yields queued with a pending toast, without claiming a completed effect.',
'English historical receipt retains exact bigint9007199254740996, historical warning and the real /settings/users navigation target.'
]
shots=[]
for p in sorted((root/'docs/evidence/nodia-ai-ai27').glob('*.jpg')):
 with Image.open(p) as im:w,h=im.size
 shots.append({'file':p.relative_to(root).as_posix(),'width':w,'height':h,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(checks)==11 and len(shots)==6
report={'task':'AI-27','scope':'isolated_synthetic_client_transport_no_business_database_no_provider','verified_at_utc':datetime.now(timezone.utc).isoformat(),'origin':'http://127.0.0.1:5194','checks':checks,'requested_mobile_viewport':[390,844],'real_user_tab_5174_modified':False,'temporary_tab_closed':True,'viewport_override_reset':True,'qa_service_stopped':True,'screenshots':shots,'limitations':['Synthetic transport verifies interface/protocol, not SQL effects, permissions or provider inference.','HTTP403 and business validation errors are covered separately by component tests; no browser failNext injected.','No real MCP write, Gemini write acceptance, physical phone or virtual keyboard acceptance.']}
(root/'docs/evidence/nodia-ai-ai27-ui-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'checks':len(checks),'screenshots':len(shots)}))
