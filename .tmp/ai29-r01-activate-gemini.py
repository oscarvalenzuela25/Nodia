import hashlib,json,os,subprocess,time,urllib.request,shutil
from pathlib import Path
base=Path('/tmp/nodia-ai29-r01-20261017');target=Path('/opt/nodia/nodia-gemini-microservice')
def run(args,**kw):
 options={'check':True,'stdout':subprocess.PIPE,'stderr':subprocess.PIPE};options.update(kw);return subprocess.run(args,**options)
def inspect():return json.loads(run(['docker','inspect','nodia-gemini-microservice']).stdout)[0]
def signature(d):
 return {'user':d['Config']['User'],'mounts':sorted((m['Type'],m.get('Source',''),m['Destination'],m.get('RW')) for m in d['Mounts']),
  'isolation':{k:d['HostConfig'].get(k) for k in ['Memory','MemorySwap','NanoCpus','PidsLimit','ShmSize','SecurityOpt','CapAdd','CapDrop','NetworkMode','CgroupnsMode','Privileged','PortBindings']}}
def env_meta():
 p=target/'.env';s=p.stat();return(hashlib.sha256(p.read_bytes()).hexdigest(),s.st_uid,s.st_gid,s.st_mode)
before=inspect();old_signature=signature(before);old_env=env_meta()
assert before['State']['Running'] and target.resolve()==target
backup=Path('/opt/nodia/verification-backups')/('ai29-r01-before-gemini-'+str(int(time.time())))
backup.mkdir(mode=0o700)
oldimage=before['Image'];run(['docker','tag',oldimage,'nodia-ai29-r01-gemini-before:'+backup.name.rsplit('-',1)[1]])
source=json.loads(run(['python3',str(base/'deploy-nodia-ai-lab-source.py'),str(base/'microservice.tar.gz'),str(base/'microservice-manifest.json')]).stdout)
helper=Path('/usr/local/libexec/nodia/attach-gemini-login-cgroup.py');helper.parent.mkdir(parents=True,exist_ok=True)
incoming=base/'attach-nodia-gemini-login-cgroup.py';expected=json.loads((base/'host-evidence.json').read_text())['source_hashes']
expected=next(v['sha256'] for v in expected if v['path'].endswith('/attach-nodia-gemini-login-cgroup.py'))
assert hashlib.sha256(incoming.read_bytes()).hexdigest()==expected
drop=Path('/etc/systemd/system/nodia-gemini-lab.service.d/40-ai29-durable-login.conf');drop.parent.mkdir(parents=True,exist_ok=True)
oldhelper=helper.read_bytes() if helper.exists() else None;olddrop=drop.read_bytes() if drop.exists() else None
if oldhelper is not None:(backup/'host-helper-before.py').write_bytes(oldhelper)
if olddrop is not None:(backup/'dropin-before.conf').write_bytes(olddrop)
helper.write_bytes(incoming.read_bytes());os.chown(helper,0,0);helper.chmod(0o755)
drop.write_text('[Service]\nExecStartPost=/usr/bin/python3 /usr/local/libexec/nodia/attach-gemini-login-cgroup.py\n');os.chown(drop,0,0);drop.chmod(0o644)
compose=['docker','compose','-p','nodia-gemini-lab','-f','docker-compose.yml','-f','docker-compose.agentic.yml','-f','docker-compose.lab.yml','-f','docker-compose.web-reasoning.yml']
buildlog=base/'gemini-build.log'
try:
 with buildlog.open('wb') as output:run([*compose,'build','nodia-gemini-microservice'],cwd=target,stdout=output,stderr=subprocess.STDOUT,timeout=600)
 buildlog.chmod(0o600)
 run(['systemctl','daemon-reload'])
 run(['systemctl','restart','nodia-gemini-lab'],timeout=150)
 after=inspect();assert after['State']['Running'] and signature(after)==old_signature and env_meta()==old_env
 verify='from login_cgroups import LoginCgroups; c=LoginCgroups(); c.available(); print("verified")'
 # Use the public proof reader under the service UID, without reading a credential or frame.
 verify='from login_cgroups import LoginCgroups; print("verified" if LoginCgroups().attestation()["version"] == 1 else "invalid")'
 assert run(['docker','exec','--user','10001:10001','nodia-gemini-microservice','python','-c',verify]).stdout.strip()==b'verified'
 with urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=10) as response:assert response.status==200
except BaseException:
 # Exact source/image rollback; preserve all operational profiles and configuration.
 run(['docker','tag',oldimage,'nodia-gemini-lab-nodia-gemini-microservice'])
 if oldhelper is None:helper.unlink(missing_ok=True)
 else:helper.write_bytes(oldhelper)
 if olddrop is None:drop.unlink(missing_ok=True)
 else:drop.write_bytes(olddrop)
 run(['systemctl','daemon-reload']);run(['systemctl','restart','nodia-gemini-lab'],timeout=150)
 raise
report={'stage':'AI-29-R01','scope':'private_gemini_lab_activation','observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'source':source,'backup':str(backup),
 'old_image':oldimage,'new_image':after['Image'],'container_restarted':True,'host_helper_sha256':expected,'host_helper_registered_in_existing_systemd_unit':True,
 'host_proof_verified_as_service_uid':True,'credential_bytes_owner_mode_preserved':True,'docker_limits_mounts_network_capabilities_namespace_preserved':True,
 'health_http':200,'provider_login_logout_or_inference_requested_by_activation':False,'profile_files_copied_or_hashed':False,'database_modified':False}
(base/'gemini-activation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
