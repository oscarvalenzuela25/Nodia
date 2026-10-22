import json,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
stage='/opt/nodia/verification/ai28-20261017'
ssh=['ssh','-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes','operador@172.31.209.214']
entries=[('main','nodia-ai-ai28.integration.mjs'),('27','nodia-ai-ai27.integration.mjs'),('26','nodia-ai-ai26.integration.mjs'),('25','nodia-ai-ai25.integration.mjs'),('24','nodia-ai-ai24.integration.mjs'),('23','nodia-ai-ai23.integration.mjs'),('22','nodia-ai-ai22.integration.mjs'),('20','nodia-ai-ai20.integration.mjs'),('18','nodia-ai-ai18.integration.mjs'),('08','nodia-ai-ai08.integration.mjs'),('rental','rental.integration.mjs'),('modules','module-catalog.integration.mjs'),('actions','action-catalog.integration.mjs'),('roles','role-catalog.integration.mjs'),('api','ai-api.integration.mjs'),('agentic','agentic-cli.integration.mjs')]
if len(sys.argv)>1:
 wanted=set(sys.argv[1:]);entries=[v for v in entries if v[0] in wanted]
statuspath=root/'.tmp/ai28-sql-status.json'
statuses=json.loads(statuspath.read_text()) if statuspath.exists() else []
for suffix,file in entries:
 name='ai28-sql-main.log' if suffix=='main' else f'ai28-sql-regression-{suffix}.log'
 out=root/'.tmp'/name
 if out.exists():out.rename(out.with_name(out.stem+'-attempt-'+str(int(time.time()))+'.log'))
 started=datetime.now(timezone.utc).isoformat();timer=time.monotonic()
 print(json.dumps({'running':suffix,'file':file,'started_utc':started}),flush=True)
 with out.open('w',encoding='utf-8') as handle:
  code=subprocess.run(ssh+[f'cd {stage} && sudo -n node test/{file}'],stdout=handle,stderr=subprocess.STDOUT).returncode
 result={'stage':suffix,'file':'test/'+file,'exit_code':code,'started_utc':started,'elapsed_seconds':round(time.monotonic()-timer,2),'log':'.tmp/'+name}
 statuses=[v for v in statuses if v['stage']!=suffix]+[result]
 statuspath.write_text(json.dumps(statuses,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'finished':suffix,**result}),flush=True)
 if code:
  print(out.read_text(encoding='utf-8')[-11000:],flush=True)
  sys.exit(code)
