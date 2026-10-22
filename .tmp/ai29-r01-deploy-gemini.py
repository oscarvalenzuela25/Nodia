import subprocess,json,hashlib
from pathlib import Path
root=Path.cwd();opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214';base='/tmp/nodia-ai29-r01-20261017'
for source,name in [(root/'nodia-server/.tmp/ai11-ai12-release/microservice.tar.gz','microservice.tar.gz'),(root/'nodia-server/.tmp/ai11-ai12-release/microservice-manifest.json','microservice-manifest.json'),
 (root/'docs/evidence/scripts/deploy-nodia-ai-lab-source.py','deploy-nodia-ai-lab-source.py'),(root/'docs/evidence/scripts/attach-nodia-gemini-login-cgroup.py','attach-nodia-gemini-login-cgroup.py'),
 (root/'docs/evidence/nodia-ai-ai29-r01-cgroup-host-validation.json','host-evidence.json'),(root/'.tmp/ai29-r01-activate-gemini.py','ai29-r01-activate-gemini.py')]:
 subprocess.run(['scp',*opts,str(source),host+':'+base+'/'+name],check=True)
result=subprocess.check_output(['ssh',*opts,host,'sudo -n python3 '+base+'/ai29-r01-activate-gemini.py'],text=True)
data=json.loads(result);data['archive_sha256']=hashlib.sha256((root/'nodia-server/.tmp/ai11-ai12-release/microservice.tar.gz').read_bytes()).hexdigest()
(root/'docs/evidence/nodia-ai-ai29-r01-gemini-activation.json').write_bytes((json.dumps(data,indent=2)+'\n').encode('utf-8'));print(json.dumps(data))
