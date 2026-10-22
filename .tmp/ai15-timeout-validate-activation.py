import json,subprocess,hashlib,os
from pathlib import Path
root=Path('/opt/nodia/nodia-gemini-microservice');name='nodia-gemini-microservice'
compose=['docker','compose','-p','nodia-gemini-lab','-f','docker-compose.yml','-f','docker-compose.agentic.yml','-f','docker-compose.lab.yml','-f','docker-compose.web-reasoning.yml']
c=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
i=json.loads(subprocess.check_output(['docker','image','inspect',c['Image']]))[0]
config=json.loads(subprocess.check_output(compose+['config','--format','json'],cwd=root))['services'][name]
def envmap(seq):
 result=dict(x.split('=',1) for x in seq)
 assert len(result)==len(seq), 'Duplicate environment key'
 return result
expected_env=envmap(i['Config']['Env']);expected_env.update({k:str(v) for k,v in config['environment'].items()})
actual_env=envmap(c['Config']['Env'])
expected_mounts=sorted((v['source'],v['target'],not v.get('read_only',False)) for v in config['volumes'])
actual_mounts=sorted((v['Source'],v['Destination'],v['RW']) for v in c['Mounts'])
assert len({v['Destination'] for v in c['Mounts']})==len(c['Mounts'])
bind_modes={}
for bind in c['HostConfig'].get('Binds') or []:
 parts=bind.rsplit(':',2);assert len(parts)==3;bind_modes[parts[1]]=parts[2]
for mount in c['Mounts']:
 assert set(mount)=={'Type','Source','Destination','Mode','RW','Propagation'}
 assert mount['Type']=='bind' and mount['Propagation']=='rprivate'
 assert mount['Mode']==bind_modes.get(mount['Destination'],'')
 assert mount['Mode'] in {'','ro','rw'}
manifest=json.loads(Path('/tmp/ai15-timeout-deploy/microservice-manifest.json').read_text())
source_match=all(hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256'] for f in manifest['files'])
stat=(root/'.env').stat()
r={'image':c['Image'],'health':c['State']['Health']['Status'],'started_at':c['State']['StartedAt'],'host_init_pid':c['State']['Pid'],'runtime_env_matches_unchanged_compose_and_image':actual_env==expected_env,'runtime_mounts_match_unchanged_compose':actual_mounts==expected_mounts,'credential_uid':stat.st_uid,'credential_gid':stat.st_gid,'credential_mode':oct(stat.st_mode&0o777),'credential_mtime_before_deployment':stat.st_mtime<1792182574,'source_matches_46_file_manifest':source_match,'duplicate_environment_keys':False,'mounts_full_fields_validated':True,'additional_or_duplicate_mounts':False,'generations':0,'recreates':1,'postguard_limitation':'Original order-sensitive Env/Mounts comparison failed. Old arrays not persisted; semantic current runtime was independently validated against unchanged compose source and image.'}
assert r['runtime_env_matches_unchanged_compose_and_image'] and r['runtime_mounts_match_unchanged_compose'] and source_match
assert stat.st_uid==10001 and stat.st_gid==10001 and stat.st_mode&0o777==0o600
Path('/tmp/ai15-timeout-deploy/activation-report.json').write_text(json.dumps(r,indent=2));os.chmod('/tmp/ai15-timeout-deploy/activation-report.json',0o600)
print(json.dumps(r))

