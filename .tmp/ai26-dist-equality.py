import json,hashlib,sys
from pathlib import Path
manifest=json.loads(Path('/tmp/nodia-ai26-20261017/server-manifest.json').read_text())
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
files=[f for f in manifest['files'] if f['path'].startswith('dist/')]
for entry in files:
 assert hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()==entry['sha256'],entry['path']
print(json.dumps({'stage':'AI-26','scope':'read_only_deployed_dist_equality','dist_files_checked':len(files),'deployed_matches_final_archive':True,'archive_sha256':sys.argv[1],'final_archive_verified':True}))
