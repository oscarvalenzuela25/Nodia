import hashlib,json,subprocess,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214';target='/tmp/nodia-ai32-attachments-20261017'
subprocess.run(['ssh',*opts,host,'mkdir -p '+target],check=True)
archive=root/'nodia-server/.tmp/ai11-ai12-release/server.tar.gz';manifest=archive.with_name('server-manifest.json')
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
pin=json.loads((root/'nodia-server/dist/nodia-ai-context/config/knowledge-pin.json').read_text())['release_id']
for file in [archive,manifest,root/'.tmp/ai32-attachments-refresh-lab.py']:
 subprocess.run(['scp',*opts,str(file),host+':'+target+'/'+file.name],check=True)
for extra in ['nodia-ai-ai32-attachments.integration.mjs','nodia-ai-ai32-invoice-attachments.integration.mjs']:
 subprocess.run(['scp',*opts,str(root/'nodia-server/test'/extra),host+':'+target+'/'+extra],check=True)
out=subprocess.check_output(['ssh',*opts,host,f'sudo -n python3 {target}/ai32-attachments-refresh-lab.py {digest} {pin}'],text=True)
for extra in ['nodia-ai-ai32-attachments.integration.mjs','nodia-ai-ai32-invoice-attachments.integration.mjs']:
 subprocess.run(['ssh',*opts,host,'sudo -n cp '+target+'/'+extra+' /opt/nodia/verification/ai32-attachments-20261017/test/'+extra],check=True)
print(out)
shutil.copy2(archive,root/'.tmp/ai32-attachments-sql-tested-server.tar.gz');shutil.copy2(manifest,root/'.tmp/ai32-attachments-sql-tested-manifest.json')
(root/'.tmp/ai32-attachments-sql-stage.json').write_text(out)
