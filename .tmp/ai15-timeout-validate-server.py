import hashlib,json,subprocess,time,urllib.request,tarfile
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016');base=Path('/tmp/ai15-timeout-deploy');m=json.loads((base/'server-manifest.json').read_text())
assert all(hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in m['files'] if f['path'].startswith('dist/'))
with tarfile.open(base/'server.tar.gz') as archive:
 assert (root/'package-lock.json').read_bytes()==archive.extractfile('package-lock.json').read()
 assert (root/'package.json').read_bytes()==archive.extractfile('package.json').read()
a=root/'.env';b=Path('/opt/nodia/nodia-server/.env');assert a.read_bytes()==b.read_bytes();s=a.stat();assert (s.st_uid,s.st_gid,s.st_mode&0o777)==(10000,987,0o600)
units={};pids={}
for unit,runtime in [('nodia-api','nodia-runtime'),('nodia-ai-worker','nodia-ai-worker')]:
 p=subprocess.check_output(['systemctl','show',unit,'-p','User','-p','Group','-p','WorkingDirectory','-p','RuntimeDirectory','-p','MainPID','-p','ActiveState','-p','NRestarts'],text=True);d=dict(x.split('=',1) for x in p.splitlines());assert d['User']=='nodia' and d['WorkingDirectory']==str(root) and d['RuntimeDirectory']==runtime and d['ActiveState']=='active' and d['NRestarts']=='0';pid=int(d['MainPID']);pids[unit]=pid
 env={x.split(b'=',1)[0]:x.split(b'=',1)[1] for x in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0') if b'=' in x};assert env.get(b'HOME')==b'/var/lib/nodia';assert env.get(b'DBUS_SESSION_BUS_ADDRESS')==('unix:path=/run/'+runtime+'/bus').encode();bus=Path(f'/proc/{pid}/root/run/{runtime}/bus').stat();host_bus=Path('/run/user/10000/bus').stat();assert (bus.st_dev,bus.st_ino)==(host_bus.st_dev,host_bus.st_ino)
 units[unit]={'identity':d['User'],'group':d['Group'],'runtime_directory':runtime,'home_and_bus_match':True}
quiet=json.loads(subprocess.check_output(['node',str(base/'quiet.mjs')]));assert quiet=={'pending_jobs':0,'open_attempts':0,'held_or_unknown_slots':0,'migrations':20}
bridge=json.loads(subprocess.check_output(['docker','inspect','nodia-gemini-microservice']))[0];assert bridge['Image']=='sha256:e1fcee82dd54afbb0d386e406169f85613085a5b1cdb8a3148962409a0b4a695' and bridge['State']['StartedAt']=='2026-10-16T20:30:54.516799401Z'
with urllib.request.urlopen('http://127.0.0.1:3000/api/v1/',timeout=3) as response:assert response.status==200
saved=list(Path('/opt/nodia/verification-backups').glob('ai15-server-timeout-diagnostic-*/dist-before'));assert len(saved)==1
report={'ready_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'server_archive_sha256':'dc867fc4434a6f8ef91d776ab3237e3527ca36eb5621eb5e95243b21b45ae537','server_files':746,'backup':str(saved[0]),'api_health_http':200,'api_health_path':'/api/v1/','active_pids':pids,'service_identities':units,'release_dist_matches_manifest':True,'environment_bytes_match_preserved_legacy_env':True,'environment_owner_mode_preserved':True,'dependencies_unchanged':True,'bridge_container_image_start_unchanged':True,'bridge_restarted':False,'knowledge_pin':'5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96','capabilities':67,'fragments':27,'quiet_before_after':quiet,'migrations_executed':False,'generations':0,'restarts_per_server_unit':1,'operational_note':'Initial post-start health guard requested unprefixed /, which correctly returned404. Correct /api/v1/ returned200; no further restart or swap was performed.'}
(base/'server-activation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))


