import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
key='C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab';known='C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts'
opts=['-i',key,'-o','UserKnownHostsFile='+known,'-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214';base='/tmp/nodia-ai29-20261017/native-regressions'
files=['test/nodia-ai-ai29.integration.mjs','test/nodia-ai-ai29-worker.fixture.mjs','test/fixtures/authority.integration.mjs','test/rental.integration.mjs','test/module-catalog.integration.mjs','test/action-catalog.integration.mjs','test/role-catalog.integration.mjs','test/nodia-ai-ai08.integration.mjs','test/ai-api.integration.mjs','test/agentic-cli.integration.mjs']
subprocess.run(['ssh',*opts,host,'mkdir -p '+base],check=True)
manifest=[]
for file in files:
 src=root/'nodia-server'/file;flat=file.replace('/','__');digest=hashlib.sha256(src.read_bytes()).hexdigest()
 subprocess.run(['scp',*opts,str(src),host+':'+base+'/'+flat],check=True)
 manifest.append({'path':file,'file':flat,'sha256':digest})
script='''import hashlib,json\nfrom pathlib import Path\nbase=Path('/tmp/nodia-ai29-20261017/native-regressions');stage=Path('/opt/nodia/verification/ai29-20261017')\nitems='''+repr(manifest)+'''\nfor item in items:\n p=base/item['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'];dest=stage/item['path'];assert dest.resolve().is_relative_to(stage);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(p.read_bytes());dest.chmod(0o640)\nprint(json.dumps(items))\n'''
helper=root/'.tmp/ai29-copy-native-remote.py';helper.write_text(script,encoding='utf-8')
subprocess.run(['scp',*opts,str(helper),host+':'+base+'/copy.py'],check=True)
output=subprocess.check_output(['ssh',*opts,host,'sudo -n python3 '+base+'/copy.py'],text=True)
(root/'.tmp/ai29-sql-native-inputs.json').write_text(output,encoding='utf-8')
print(output)
