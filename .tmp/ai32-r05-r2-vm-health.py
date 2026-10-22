"""Minimal read-only VM health: no model discovery, generation or R2 request."""
import json
import subprocess
import time
import urllib.request

units={}
for unit in ['nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx']:
    result=subprocess.run(['systemctl','is-active',unit],capture_output=True,text=True,timeout=10)
    units[unit]='active' if result.returncode==0 and result.stdout.strip()=='active' else 'not_active'
http={}
for name,url in [('api','http://127.0.0.1:3000/api/v1/'),('gemini','http://127.0.0.1:8000/health')]:
    try:
        with urllib.request.urlopen(url,timeout=10) as response:http[name]=response.status
    except Exception:http[name]=None
image=subprocess.check_output(['docker','inspect','--format','{{.Image}}','nodia-gemini-microservice'],text=True,timeout=10).strip()
print(json.dumps({'stage':'AI-32-R05','scope':'r2_preparation_vm_read_only_health',
    'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'units':units,'http':http,
    'gemini_image':image,'provider_generations':0,'provider_metadata_requests':0,
    'configuration_modified':False,'services_restarted':False},indent=2))
