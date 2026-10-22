import hashlib,json,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
root=Path(__file__).resolve().parents[1]
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host='operador@172.31.209.214';target='/opt/nodia/verification/ai31-20261017';temporary='/tmp/nodia-ai31-20261017'
manifest=json.loads((root/'.tmp/ai31-sql-tested-manifest.json').read_text())
manifest_files={entry['path']:entry['sha256'] for entry in manifest['files']}
archive_hash=hashlib.sha256((root/'.tmp/ai31-sql-tested-server.tar.gz').read_bytes()).hexdigest()
assets=['nodia-server/test/nodia-ai-ai14.integration.mjs','nodia-server/test/nodia-ai-ai14.fixture.mjs','docs/mvp/nodia-ai-v1-common-contracts.schema.json']
receipts=[]
for relative in assets:
 p=root/relative; digest=hashlib.sha256(p.read_bytes()).hexdigest();name=p.name
 subprocess.run(['scp',*opts,str(p),host+':'+temporary+'/'+name],check=True)
 dest=target+'/test/'+name if relative.startswith('nodia-server/test/') else '/opt/nodia/verification/docs/mvp/'+name
 program='from pathlib import Path;import hashlib;source=Path('+repr(temporary+'/'+name)+');target=Path('+repr(dest)+');assert hashlib.sha256(source.read_bytes()).hexdigest()=='+repr(digest)+';target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read_bytes());target.chmod(0o640)'
 result=subprocess.run(['ssh',*opts,host,'sudo -n python3 -c '+"'"+program.replace("'","'\"'\"'")+"'"],capture_output=True,text=True)
 if result.returncode: raise RuntimeError(result.stderr)
 receipts.append({'path':relative,'sha256':digest,'remote_path':dest})
results=[]
for stage,file in [('31','test/nodia-ai-ai31.integration.mjs'),('30','test/nodia-ai-ai30.integration.mjs'),('14','test/nodia-ai-ai14.integration.mjs'),('16-observation','test/nodia-ai-ai16-observation.integration.mjs')]:
 if file in manifest_files: assert hashlib.sha256((root/'nodia-server'/file).read_bytes()).hexdigest()==manifest_files[file],file+' changed after package'
 attempt=1
 while (root/'.tmp'/f'ai31-sql-{stage}-attempt{attempt:02}.log').exists(): attempt+=1
 log=root/'.tmp'/f'ai31-sql-{stage}-attempt{attempt:02}.log'
 started=datetime.now(timezone.utc).isoformat();clock=time.monotonic()
 result=subprocess.run(['ssh',*opts,host,'cd '+target+' && sudo -n /usr/local/bin/node '+file],capture_output=True,text=True,encoding='utf8')
 log.write_text(result.stdout+result.stderr,encoding='utf8')
 observed=subprocess.check_output(['ssh',*opts,host,'date -u +%Y-%m-%dT%H:%M:%SZ'],text=True).strip()
 row={'stage':stage,'file':file,'exit_code':result.returncode,'elapsed_seconds':round(time.monotonic()-clock,2),'desktop_started_at_utc':started,'desktop_observed_at_utc':datetime.now(timezone.utc).isoformat(),'vm_observed_at_utc':observed,'log':str(log.relative_to(root)).replace('\\','/'),'configured_database_used':False,'provider_inference':False,'source_sha256':hashlib.sha256((root/'nodia-server'/file).read_bytes()).hexdigest()}
 results.append(row)
 print(json.dumps(row),flush=True)
 if result.returncode:
  print((result.stdout+result.stderr)[-7000:],flush=True)
  break
(root/'.tmp'/'ai31-sql-run-status.json').write_text(json.dumps({'results':results,'extra_assets':receipts,'archive_sha256':archive_hash},indent=2))
raise SystemExit(0 if all(row['exit_code']==0 for row in results) and len(results)==4 else 1)
