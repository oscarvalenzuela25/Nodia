import json,hashlib
from pathlib import Path
manifest=json.loads(Path('/tmp/nodia-ai20-20261017/server-manifest.json').read_text())
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
files=[f for f in manifest['files'] if f['path'].startswith('dist/')]
for entry in files:
 assert hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()==entry['sha256'],entry['path']
print(json.dumps({'stage':'AI-20','scope':'read_only_deployed_dist_equality','dist_files_checked':len(files),'deployed_matches_final_archive':True,'archive_sha256':'544f7e8f3896cb7e64bcced5dcb852a68d011832c27913eae7196cbad5ea4db1','final_fixture_only_archive_change_after_sql':'AI17/AI19 explicit empty registry and strict invalid persisted binding assertions; no runtime code difference'}))
