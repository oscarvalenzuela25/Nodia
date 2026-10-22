import hashlib,json,subprocess,time,urllib.request
from pathlib import Path

base=Path('/tmp/nodia-ai32-r02-20261018')
runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
stage=Path('/opt/nodia/verification/ai32-r02-20261018')
def run(args):
 return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30).stdout
manifest=json.loads((base/'server-manifest.json').read_text())
for entry in manifest['files']:
 assert hashlib.sha256((stage/entry['path']).read_bytes()).hexdigest()==entry['sha256'],entry['path']
dist=[entry for entry in manifest['files'] if entry['path'].startswith('dist/')]
assert len(dist)>886
for entry in dist:
 for root in [runtime,stage]:
  assert hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()==entry['sha256'],entry['path']
tree=[{'path':p.relative_to(stage).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((stage/'dist').rglob('*')) if p.is_file()]
assert {entry['path'] for entry in dist}=={entry['path'] for entry in tree}
tree_hash=hashlib.sha256(json.dumps(tree,sort_keys=True,separators=(',',':')).encode()).hexdigest()
quiet=json.loads(run(['/usr/local/bin/node',str(base/'ai32-lab-db.mjs')]))
assert quiet['pending_jobs']==quiet['open_attempts']==quiet['held_or_unknown_slots']==0
assert quiet['migrations']==26 and quiet['nodia_ai_tables']==19 and quiet['nodia_ai_columns']==267
units={name:run(['systemctl','is-active',name]).decode().strip() for name in ['nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx']}
assert all(value=='active' for value in units.values())
health={}
for name,url in [('api','http://127.0.0.1:3000/api/v1/'),('gemini','http://127.0.0.1:8000/health')]:
 with urllib.request.urlopen(url,timeout=10) as response:health[name]=response.status
assert set(health.values())=={200}
# Root API and supervisor readiness do not attest a provider generation or an R2 object operation.

containment=json.loads(run(['docker','exec','--user','10001:10001','nodia-gemini-microservice','python','-c',
 'import json; from login_cgroups import LoginCgroups; p=LoginCgroups().attestation(); print(json.dumps({"version":p["version"],"previous_roots":len(p["closed_roots"])}))']))
assert containment['version']==1
report={'stage':'AI-32-R02','status':'passed','passed':True,'scope':'final_private_vm_read_only_health_and_compiled_parity',
 'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'units':units,'http':health,
 'dist_tree_sha256':tree_hash,
 'dist_tree_hash_algorithm':"sha256 of compact sorted-key JSON path/sha256 array from Python sorted(Path.rglob('*'))",
 'compiled_dist_files_verified':len(dist),'compiled_stage_and_runtime_equal':True,
 'final_package_files_verified':len(manifest['files']),
 'final_package_archive_sha256':hashlib.sha256((base/'server.tar.gz').read_bytes()).hexdigest(),
 'final_package_manifest_sha256':hashlib.sha256((base/'server-manifest.json').read_bytes()).hexdigest(),
 'knowledge_release':json.loads((runtime/'dist/nodia-ai-context/config/knowledge-pin.json').read_text())['release_id'],
 'quiet':{key:quiet[key] for key in ['pending_jobs','open_attempts','held_or_unknown_slots','migrations','nodia_ai_tables','nodia_ai_columns']},
 'r2_configuration_present':quiet['r2_configured'],'r2_data_path_verified':False,
 'host_containment_proof_as_service_uid':containment,'provider_authentication_or_inference_verified_by_health':False,
 'configured_database_written':False,'provider_request_started':False,'profile_files_copied_or_hashed':False}
print(json.dumps(report,indent=2))

