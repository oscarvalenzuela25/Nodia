import json,subprocess,hashlib,re
from pathlib import Path
r=Path(__file__).resolve().parents[1]
statuses=json.loads((r/'.tmp/ai29-sql-status.json').read_text(encoding='utf-8'))
assert len(statuses)==17 and all(s['exit_code']==0 for s in statuses)
assert re.search(r'Tests\s+3072 passed', (r/'.tmp/ai29-server-tests-final.log').read_text(encoding='utf-8'))
client=json.loads((r/'docs/evidence/nodia-ai-ai29-client-validation.json').read_text(encoding='utf-8'));assert client['status']=='passed' and client['full_suite']['tests']==1636
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214';base='/tmp/nodia-ai29-20261017'
for name in ['activate-lab.py','live-state.mjs','lab-db.mjs','service-state.py','dist-equality.py']:
 file=r/'.tmp'/('ai29-'+name);subprocess.run(['scp',*opts,str(file),host+':'+base+'/'+file.name],check=True)
out=subprocess.check_output(['ssh',*opts,host,'sudo -n python3 '+base+'/ai29-activate-lab.py'],text=True)
d=json.loads(out);(r/'docs/evidence/nodia-ai-ai29-lab-activation.json').write_bytes((json.dumps(d,indent=2)+'\n').encode('utf-8'));print(out)
for name,command in [('lab-runtime','sudo -n /usr/local/bin/node '+base+'/ai29-live-state.mjs'),('services','sudo -n python3 '+base+'/ai29-service-state.py'),('deployed-equality','sudo -n python3 '+base+'/ai29-dist-equality.py '+hashlib.sha256((r/'nodia-server/.tmp/ai11-ai12-release/server.tar.gz').read_bytes()).hexdigest())]:
 result=subprocess.check_output(['ssh',*opts,host,command],text=True);data=json.loads(result);(r/'docs/evidence'/('nodia-ai-ai29-'+name+'.json')).write_bytes((json.dumps(data,indent=2)+'\n').encode('utf-8'));print(json.dumps({'check':name,'data':data}))
