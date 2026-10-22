import hashlib,json,subprocess
from pathlib import Path
root=Path('/opt/nodia/nodia-gemini-microservice');name='nodia-gemini-microservice';expected='sha256:e1fcee82dd54afbb0d386e406169f85613085a5b1cdb8a3148962409a0b4a695'
def inspect():return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def secret_shape():
 p=root/'.env';s=p.stat();return hashlib.sha256(p.read_bytes()).digest(),s.st_uid,s.st_gid,s.st_mode
old=inspect();secret=secret_shape();env=old['Config']['Env'];mounts=old['Mounts']
assert not any(p.is_file() for p in (root/'session_state/runtime_admission').rglob('*'))
top=subprocess.check_output(['docker','top',name,'-eo','pid,ppid,comm'],text=True)
assert not any(x.split()[-1] in {'agy','chrome','chromium','chromium-browse'} for x in top.splitlines()[1:])
status=json.loads(subprocess.check_output(['node','/tmp/ai15-activation-readonly.mjs']))
assert status['pending_jobs']==0 and status['counts']['nodia_ai_jobs']==0
cmd=['docker','compose','-p','nodia-gemini-lab','-f','docker-compose.yml','-f','docker-compose.agentic.yml','-f','docker-compose.lab.yml','-f','docker-compose.web-reasoning.yml','up','-d','--no-deps','--wait','--wait-timeout','90',name]
with Path('/tmp/ai15-timeout-deploy/activate.log').open('wb') as log:
 subprocess.run(cmd,cwd=root,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=105)
new=inspect();assert new['Image']==expected and new['Config']['Env']==env and new['Mounts']==mounts
assert secret_shape()==secret and new['State']['Health']['Status']=='healthy'
print(json.dumps({'image':new['Image'],'old_image':old['Image'],'started_at':new['State']['StartedAt'],'host_init_pid':new['State']['Pid'],'health':new['State']['Health']['Status'],'credential_bytes_owner_mode_preserved':True,'container_env_unchanged':True,'mounts_unchanged':True,'profile_files_written_by_deployer':0,'generations':0,'restart_count':new['RestartCount']}))

