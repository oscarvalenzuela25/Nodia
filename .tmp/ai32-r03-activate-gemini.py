import hashlib,json,subprocess,time,urllib.request
from pathlib import Path
base=Path('/tmp/nodia-ai32-r03-native-candidate')
target=Path('/opt/nodia/nodia-gemini-microservice')
def run(args,**kw):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kw)
def inspect():return json.loads(run(['docker','inspect','nodia-gemini-microservice']).stdout)[0]
def signature(d):
    return {'user':d['Config']['User'],'mounts':sorted((m['Type'],m.get('Source',''),m['Destination'],m.get('RW')) for m in d['Mounts']), 'isolation':{k:d['HostConfig'].get(k) for k in ['Memory','MemorySwap','NanoCpus','PidsLimit','ShmSize','SecurityOpt','CapAdd','CapDrop','NetworkMode','CgroupnsMode','Privileged','PortBindings']}}
def envmeta():
    p=target/'.env';s=p.stat();return(hashlib.sha256(p.read_bytes()).hexdigest(),s.st_uid,s.st_gid,s.st_mode)
def quiet():return json.loads(run(['/usr/local/bin/node',str(base/'quiet.mjs')]).stdout)
def nativequiet():
    result=json.loads(run(['python3','/tmp/ai32-r03-cleanup.py']).stdout)
    keys=['unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories']
    assert all(result[key]==0 for key in keys),{key:result[key] for key in keys}
    return {key:result[key] for key in keys}
before=inspect();baseline=quiet();assert all(baseline[k]==0 for k in ['pending_jobs','open_attempts','held_or_unknown_slots']),baseline
native_before=nativequiet()
oldsignature=signature(before);oldenv=envmeta();oldimage=before['Image']
assert before['State']['Running']
candidate=run(['docker','image','inspect','nodia-gemini-ai32-r03-candidate:20261018','--format','{{.Id}}']).stdout.decode().strip()
backup=Path('/opt/nodia/verification-backups')/('ai32-r03-before-gemini-'+str(int(time.time())));backup.mkdir(mode=0o700)
run(['docker','tag',oldimage,'nodia-ai32-r03-gemini-before:'+backup.name.rsplit('-',1)[1]])
(backup/'baseline.json').write_text(json.dumps({'old_image':oldimage,'signature':oldsignature,'quiet':baseline},indent=2));(backup/'baseline.json').chmod(0o600)
try:
    run(['docker','tag',candidate,'nodia-gemini-lab-nodia-gemini-microservice'])
    run(['systemctl','restart','nodia-gemini-lab'],timeout=150)
    after=inspect()
    assert after['Image']==candidate and after['State']['Running'] and signature(after)==oldsignature and envmeta()==oldenv
    verify='from login_cgroups import LoginCgroups; print("verified" if LoginCgroups().attestation()["version"] == 1 else "invalid")'
    assert run(['docker','exec','--user','10001:10001','nodia-gemini-microservice','python','-c',verify]).stdout.strip()==b'verified'
    with urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=10) as r:assert r.status==200
except BaseException:
    run(['docker','tag',oldimage,'nodia-gemini-lab-nodia-gemini-microservice'])
    run(['systemctl','restart','nodia-gemini-lab'],timeout=150)
    raise
end=quiet();assert all(end[k]==0 for k in ['pending_jobs','open_attempts','held_or_unknown_slots']),end
native_after=nativequiet()
report={'stage':'AI-32-R03','scope':'private_gemini_lab_activation','observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'old_image':oldimage,'new_image':candidate,'backup':str(backup),'container_restarted':True,'credential_bytes_owner_mode_preserved':True,'docker_limits_mounts_network_capabilities_namespace_preserved':True,'host_proof_verified_as_service_uid':True,'health_http':200,'provider_login_logout_or_inference_requested_by_activation':False,'profile_files_copied_or_hashed':False,'database_modified':False,'quiet_before':{k:baseline[k] for k in ['pending_jobs','open_attempts','held_or_unknown_slots','migrations']},'quiet_after':{k:end[k] for k in ['pending_jobs','open_attempts','held_or_unknown_slots','migrations']}}
report.update(native_quiet_before=native_before,native_quiet_after=native_after)
(base/'activation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
