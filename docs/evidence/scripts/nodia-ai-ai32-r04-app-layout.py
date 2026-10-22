"""Project source tree counts without traversing runtime/private mounts."""
from pathlib import Path
import hashlib
import json
import subprocess
import time

manifest=json.loads(Path('/tmp/ai32-r04-final-source-manifest.json').read_text(encoding='utf-8'))
mounts=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .Mounts}}','nodia-gemini-microservice']))
mounted_files=[]
for mount in mounts:
    destination=Path(mount['Destination'])
    if mount.get('Type')=='bind' and Path(mount['Source']).is_file() and destination.is_relative_to('/app'):
        mounted_files.append(destination.relative_to('/app').as_posix())
code=r'''
from pathlib import Path
import json,os,re,sys
inputs=json.load(sys.stdin);manifest=inputs['manifest'];mounted=set(inputs['mounted_files'])
assert all(not Path(p).is_absolute() and '..' not in Path(p).parts for p in manifest)
root=Path('/app');seen=set();operational=archives=0
skip={'browser_profile','session_state','agentic_profile','temp_uploads','__pycache__','.venv','venv'}
for directory,dirs,files in os.walk(root,followlinks=False):
 dirs[:]=[name for name in dirs if name not in skip and not (Path(directory)/name).is_symlink()]
 for name in files:
  path=Path(directory)/name
  if path.is_symlink() or name=='.env' or name.startswith('.env.'):continue
  if name.endswith('.pyc'):continue
  relative=path.relative_to(root).as_posix();seen.add(relative)
  operational+=int(name=='quiet.mjs' or re.fullmatch(r'ai32-r[0-9]+-(?:activate[^/]*|stage[^/]*|cleanup[^/]*|final-health[^/]*)\.py',name) is not None)
  archives+=int(name=='source.tar.gz' or name.endswith(('.tar.gz','.tgz','.zip')))
print(json.dumps({'manifest_source_files':len(manifest),'nonruntime_regular_files':len(seen),
 'source_allowlist_exact':seen==set(manifest),'unexpected_regular_file_count':len(seen-set(manifest)),
 'additional_mounted_configuration_file_count':len((seen-set(manifest))&mounted),
 'source_and_configuration_mounts_exact':not (seen-set(manifest)-mounted) and not (set(manifest)-seen),
 'missing_source_file_count':len(set(manifest)-seen),'operational_script_count':operational,
 'source_archive_count':archives,'temporary_build_directory_present':(root/'.tmp').exists(),
 'runtime_mounts_traversed':False,'profile_or_credential_bytes_read':False}))
'''
result=subprocess.run(['docker','exec','-i','--user','10001:10001','nodia-gemini-microservice',
 'python','-c',code],input=json.dumps({'manifest':manifest,'mounted_files':mounted_files}).encode(),capture_output=True,check=True,timeout=20)
projection=json.loads(result.stdout)
report={'stage':'AI-32-R04','scope':'postactivation_application_source_tree_allowlist_projection',
 'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
 'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'provider_generations':0,'configured_database_modified':False,**projection}
report['status']='passed' if (projection['source_and_configuration_mounts_exact'] and
    projection['operational_script_count']==projection['source_archive_count']==0 and
    not projection['temporary_build_directory_present']) else 'unexpected_source_layout'
print(json.dumps(report,indent=2))
