import json,subprocess
from pathlib import Path
root=Path.cwd();statuses=json.loads((root/'.tmp/ai29-r01-sql-status.json').read_text())
expected={'r01','main','28','27','26','25','24','23','22','20','18','08','rental','modules','actions','roles','api','agentic','codexNative','codexHttp'}
assert {row['stage'] for row in statuses}==expected and all(row['exit_code']==0 for row in statuses)
assert '3113 passed' in (root/'.tmp/ai29-r01-server-tests-final.log').read_text(encoding='utf-8')
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214';base='/tmp/nodia-ai29-r01-20261017'
for name in ['ai29-r01-activate-lab.py','ai29-lab-db.mjs']:
 subprocess.run(['scp',*opts,str(root/'.tmp'/name),host+':'+base+'/'+name],check=True)
result=subprocess.check_output(['ssh',*opts,host,'sudo -n python3 '+base+'/ai29-r01-activate-lab.py'],text=True)
data=json.loads(result);manifest=json.loads((root/'.tmp/ai29-r01-sql-tested-manifest.json').read_text())
data['compiled_dist_files_verified']=sum(1 for entry in manifest['files'] if entry['path'].startswith('dist/'))
data['archive_sha256']=json.loads((root/'.tmp/ai29-r01-sql-stage.json').read_text())['archive_sha256']
(root/'docs/evidence/nodia-ai-ai29-r01-lab-activation.json').write_bytes((json.dumps(data,indent=2)+'\n').encode('utf-8'));print(json.dumps(data))
