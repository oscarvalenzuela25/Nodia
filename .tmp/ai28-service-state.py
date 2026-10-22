import json,subprocess
from datetime import datetime,timezone
run=lambda args:subprocess.run(args,check=True,stdout=subprocess.PIPE,text=True).stdout.strip()
units={name:run(['systemctl','is-active',unit]) for name,unit in [('nginx','nginx'),('worker','nodia-ai-worker'),('api','nodia-api')]}
containers=sorted(run(['docker','ps','--format','{{.Names}}']).splitlines())
assert containers==sorted(['nodia-gemini-microservice','nodia-lab-postgres-1','nodia-lab-redis-1']),containers
print(json.dumps({'observed_at_utc':datetime.now(timezone.utc).isoformat(),'clock_source':'vm_host','server_units':units,'containers':containers,'temporary_test_containers_remaining':0}))
