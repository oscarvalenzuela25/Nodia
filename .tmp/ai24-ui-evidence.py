from pathlib import Path
from PIL import Image
import json,hashlib
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
files=[]
for file in sorted((root/'docs/evidence/nodia-ai-ai24').glob('*.jpg')):
 with Image.open(file) as picture: width,height=picture.size
 files.append({'file':file.relative_to(root).as_posix(),'width':width,'height':height,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
p={'task':'AI-24','scope':'isolated_synthetic_client_transport_no_business_database_no_provider',
 'verified_at_utc':datetime.now(timezone.utc).isoformat(),'origin':'http://127.0.0.1:5194',
 'checks':['Spanish policy preview shows the full nested rule thresholds and refund percentages without raw JSON',
 'Structured rule editor keeps second refund75.00 and input focus when switching to requested390x844 viewport',
 'Duplicate threshold0 is rejected with localized validation while the other draft values remain',
 'Correcting threshold to7 saves revision2 with75.00 and the unchanged policy name and zero-day rule, displaying success toast',
 'English completed policy receipt retains the bigint9007199254740993 and links to the actual /tools/reservations route'],
 'requested_mobile_viewport':[390,844],'real_user_tab_5174_modified':False,'temporary_tab_closed':True,
 'viewport_override_reset':True,'qa_service_stopped':True,'screenshots':files}
(root/'docs/evidence/nodia-ai-ai24-ui-validation.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'screenshots':len(files),'checks':len(p['checks'])}))
