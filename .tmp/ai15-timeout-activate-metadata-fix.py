import hashlib,json,os,subprocess,time,urllib.request,sys,re
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016');current=root/'dist';pending=root/'.pending-dist-timeout-metadata-fix';base=Path('/tmp/ai15-timeout-deploy')
def run(args,**kw):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kw)
def bridge():
 d=json.loads(run(['docker','inspect','nodia-gemini-microservice']).stdout)[0];return(d['Id'],d['Image'],d['State']['StartedAt'])
def metadata():
 result={}
 for name in ['.env','package.json','package-lock.json']:
  p=root/name;s=p.stat();result[name]=(hashlib.sha256(p.read_bytes()).digest(),s.st_uid,s.st_gid,s.st_mode)
 return result
units=['nodia-api','nodia-ai-worker']
props=['User','Group','WorkingDirectory','EnvironmentFiles','RuntimeDirectory','RuntimeDirectoryMode','BindPaths']
expected_commands={'nodia-api':('/usr/local/bin/node','/usr/local/bin/node dist/main.js'),'nodia-ai-worker':('/usr/local/bin/node','/usr/local/bin/node dist/nodia-ai-worker.js')}
def command(unit):
 raw=run(['systemctl','show',unit,'--property=ExecStart','--value']).stdout.decode()
 match=re.search(r'path=([^;]+?)\s*;\s*argv\[\]=(.*?)\s*;\s*ignore_errors',raw)
 assert match is not None
 actual=(match[1].strip(),match[2].strip());assert actual==expected_commands[unit]
 return actual

def identities():return {unit:(run(['systemctl','show',unit,*['--property='+p for p in props]]).stdout,command(unit),hashlib.sha256(run(['systemctl','cat',unit]).stdout).digest()) for unit in units}
quiet=json.loads(run(['node',str(base/'quiet.mjs')]).stdout);assert quiet=={'pending_jobs':0,'open_attempts':0,'held_or_unknown_slots':0,'migrations':20},quiet
assert pending.is_dir() and not pending.is_symlink() and current.resolve()==current and root.resolve()==root
prior_bridge=bridge();prior_meta=metadata();prior_units=identities()
backup=Path('/opt/nodia/verification-backups')/('ai15-server-metadata-fix-'+str(int(time.time())));backup.mkdir(mode=0o700);saved=backup/'dist-before'
run(['systemctl','stop','nodia-ai-worker','nodia-api'],timeout=90)
for unit in units:assert subprocess.run(['systemctl','is-active',unit],stdout=subprocess.PIPE).stdout.strip()==b'inactive'
os.rename(current,saved)
try:os.rename(pending,current)
except BaseException:os.rename(saved,current);run(['systemctl','start',*units],timeout=90);raise
run(['systemctl','start',*units],timeout=90)
for _ in range(40):
 try:
  with urllib.request.urlopen('http://127.0.0.1:3000/api/v1/',timeout=2) as response:
   if response.status==200:break
 except OSError:time.sleep(.25)
else:raise RuntimeError('API_health_failed')
assert metadata()==prior_meta and identities()==prior_units and bridge()==prior_bridge
for unit in units:assert run(['systemctl','is-active',unit]).stdout.strip()==b'active'
post=json.loads(run(['node',str(base/'quiet.mjs')]).stdout);assert post==quiet
pids={unit:int(run(['systemctl','show',unit,'--property=MainPID','--value']).stdout) for unit in units}
report={'ready_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'server_archive_sha256':sys.argv[1],'server_files':746,'backup':str(saved),'api_health_http':200,'active_pids':pids,'service_identity_configuration_unchanged':True,'execstart_path_and_argv_before_after_verified':True,'approved_commands':expected_commands,'environment_dependencies_bytes_owner_mode_preserved':True,'bridge_container_image_start_unchanged':True,'bridge_restarted':False,'knowledge_pin':'5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96','capabilities':67,'fragments':27,'quiet_before_after':quiet,'migrations_executed':False,'generations':0,'restarts_per_server_unit':1}
(base/'server-metadata-activation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))


