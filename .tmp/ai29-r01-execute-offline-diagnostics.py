import base64,subprocess,sys
from pathlib import Path
root=Path.cwd();code=(root/'.tmp/ai29-r01-run-offline-diagnostics-remote.py').read_bytes();encoded=base64.b64encode(code).decode('ascii')
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
command="sudo -n python3 -c 'import base64,sys;exec(base64.b64decode(sys.argv[1]))' "+encoded
with (root/'.tmp/ai29-r01-web-diagnostics-linux-tests.log').open('wb') as log:
 result=subprocess.run(['ssh',*opts,'operador@172.31.209.214',command],stdout=log,stderr=subprocess.STDOUT,check=False)
print((root/'.tmp/ai29-r01-web-diagnostics-linux-tests.log').read_text(errors='replace')[-2300:]);sys.exit(result.returncode)
