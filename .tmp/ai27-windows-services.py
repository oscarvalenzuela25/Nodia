import json
from datetime import datetime,timezone
from pathlib import Path
import urllib.request
r=Path.cwd();p=r/'docs/evidence/nodia-ai-ai27-services.json';d=json.loads(p.read_text(encoding='utf-8'));checks={}
for name,url in [('client_http','http://localhost:5174'),('tunnel_api_http','http://localhost:3100/api/v1/'),('client_proxy_api_http','http://localhost:5174/api/v1/')]:
 with urllib.request.urlopen(url,timeout=10) as response:checks[name]=response.status
 assert checks[name]==200
checks.update({'qa_5194_stopped':True,'tunnel_port':3100,'client_port':5174,'client_pid':57196,'tunnel_pid':41704})
d.update({'stage':'AI-27','scope':'private_lab_services_after_activation','windows':checks,'configured_provider_inference':False,'browser_tabs_modified_for_activation':False,'windows_observed_at_utc':datetime.now(timezone.utc).isoformat()})
p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8');print(json.dumps(checks))
