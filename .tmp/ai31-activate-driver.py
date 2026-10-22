import json,subprocess,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214'; target='/tmp/nodia-ai31-20261017'
for name in ['ai31-lab-db.mjs','ai31-activate-lab.py','ai31-final-health.py']:
 subprocess.run(['scp',*opts,str(root/'.tmp'/name),host+':'+target+'/'+name],check=True)
for name,destination in [('ai31-activate-lab.py','nodia-ai-ai31-lab-activation.json'),('ai31-final-health.py','nodia-ai-ai31-final-health.json')]:
 out=subprocess.check_output(['ssh',*opts,host,'sudo -n python3 '+target+'/'+name],text=True)
 value=json.loads(out);(root/'docs/evidence'/destination).write_text(json.dumps(value,indent=2)+'\n')
 print(json.dumps({'file':destination,'status':value.get('status','activated')}))
