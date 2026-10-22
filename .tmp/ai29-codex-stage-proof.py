import subprocess,tarfile,time,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];target='/tmp/ai29-r01-codex-20261017'
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes'];host='operador@172.31.209.214'
archive=root/'.tmp/ai29-codex-isolated.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 for file in (root/'nodia-server/.tmp/ai29-codex-dist/common/ai/codex').glob('*.js'):tar.add(file,arcname='dist/common/ai/codex/'+file.name)
 tar.add(root/'nodia-server/test/codex-login-supervisor.integration.mjs',arcname='test/codex-login-supervisor.integration.mjs')
package=root/'.tmp/ai29-codex-package.json';package.write_text('{"type":"module"}',encoding='utf-8')
subprocess.run(['ssh',*opts,host,'mkdir -p '+target],check=True)
for file in [archive,package]:subprocess.run(['scp',*opts,str(file),host+':'+target+'/'+file.name],check=True)
command='tar -xzf '+target+'/ai29-codex-isolated.tar.gz -C '+target+' && cp '+target+'/ai29-codex-package.json '+target+'/package.json && ln -sfn /opt/nodia/nodia-server/node_modules '+target+'/node_modules && cd /opt/nodia/nodia-server && CODEX_TEST_DIST='+target+'/dist /usr/local/bin/node '+target+'/test/codex-login-supervisor.integration.mjs'
started=time.monotonic();result=subprocess.run(['ssh',*opts,host,command],text=True,capture_output=True)
(root/'.tmp/ai29-codex-linux-harness.log').write_text(result.stdout+result.stderr,encoding='utf-8')
(root/'.tmp/ai29-codex-linux-harness-meta.json').write_text(json.dumps({'exit_code':result.returncode,'duration_seconds':round(time.monotonic()-started,3)}),encoding='utf-8')
print(result.stdout);print(result.stderr);raise SystemExit(result.returncode)
