import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes'];host='operador@172.31.209.214'
statuses=json.loads((root/'.tmp/ai29-sql-status.json').read_text());assert len(statuses)==17 and all(v['exit_code']==0 for v in statuses)
files={v['file'] for v in statuses}|{'test/nodia-ai.integration.fixture.mjs','test/fixtures/authority.integration.mjs'}
for suffix in ['29','28','27','26','25','24','23','22','20']:
 files.add(f'test/nodia-ai-ai{suffix}-worker.fixture.mjs')
manifest=json.loads((root/'.tmp/ai29-sql-tested-manifest.json').read_text());dist={v['path']:v['sha256'] for v in manifest['files'] if v['path'].startswith('dist/')}
expected={f:hashlib.sha256((root/'nodia-server'/f).read_bytes()).hexdigest() for f in sorted(files)}
normative=hashlib.sha256((root/'docs/mvp/28-rental-reservations-contracts.md').read_bytes()).hexdigest()
script="""import hashlib,json,subprocess
from pathlib import Path
stage=Path('/opt/nodia/verification/ai29-20261017')
expected="""+repr(expected)+"\ndist="+repr(dist)+"\nnormative="+repr(normative)+"""
for file,digest in {**expected,**dist}.items():assert hashlib.sha256((stage/file).read_bytes()).hexdigest()==digest,file
assert hashlib.sha256((stage.parent/'docs/mvp/28-rental-reservations-contracts.md').read_bytes()).hexdigest()==normative
containers=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
assert sorted(containers)==sorted(['nodia-gemini-microservice','nodia-lab-postgres-1','nodia-lab-redis-1'])
print(json.dumps({'inputs':expected,'compiled_dist_files_verified':len(dist),'knowledge_pin':json.loads((stage/'dist/nodia-ai-context/config/knowledge-pin.json').read_text())['release_id'],'normative_sha256':normative,'running_containers':containers,'disposable_containers_removed':True},indent=2))
"""
p=root/'.tmp/ai29-capture-sql-remote.py';p.write_text(script,encoding='utf-8')
remote='/tmp/nodia-ai29-20261017/native-regressions/capture.py'
subprocess.run(['scp',*opts,str(p),host+':'+remote],check=True)
data=subprocess.check_output(['ssh',*opts,host,'sudo -n python3 '+remote],text=True)
(root/'.tmp/ai29-sql-input-validation.json').write_text(data,encoding='utf-8');value=json.loads(data)
print(json.dumps({'inputs':len(value['inputs']),'dist':value['compiled_dist_files_verified'],'pin':value['knowledge_pin'],'containers':value['running_containers']}))
