import hashlib,json
from pathlib import Path
r=Path.cwd();load=lambda p:json.loads((r/p).read_text(encoding='utf-8'));sha=lambda p:hashlib.sha256((r/p).read_bytes()).hexdigest()
a={f['path']:f['sha256'] for f in load('.tmp/ai27-sql-tested-manifest.json')['files']};b={f['path']:f['sha256'] for f in load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json')['files']}
ad={p:h for p,h in a.items() if p.startswith('dist/')};bd={p:h for p,h in b.items() if p.startswith('dist/')};assert ad==bd and len(bd)==843
changed=sorted(p for p in a.keys()|b.keys() if a.get(p)!=b.get(p));assert changed in ([],['test/nodia-ai-ai27.integration.mjs']),changed
report={'stage':'AI-27','tested_archive_sha256':sha('.tmp/ai27-sql-tested-server.tar.gz'),'final_archive_sha256':sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz'),'production_dist_identical':True,'dist_files_checked':len(bd),'changed_package_files':changed,'reason':'Final package file hashes match the SQL-tested manifest; archive digest may change with tar metadata. Production dist and the SQL harness are identical.','final_harness_sha256':b['test/nodia-ai-ai27.integration.mjs']}
sql=load('docs/evidence/nodia-ai-ai27-postgresql.json');assert report['tested_archive_sha256']==sql['compiled_production_archive_sha256'];assert sql['inputs'][0]['sha256']==report['final_harness_sha256']
(r/'docs/evidence/nodia-ai-ai27-tested-release-parity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))

