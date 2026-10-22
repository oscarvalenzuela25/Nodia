from pathlib import Path
import json,hashlib
r=Path.cwd();load=lambda p:json.loads((r/p).read_text(encoding='utf-8'));sha=lambda p:hashlib.sha256((r/p).read_bytes()).hexdigest()
a={x['path']:x['sha256'] for x in load('.tmp/ai29-sql-tested-manifest.json')['files']};b={x['path']:x['sha256'] for x in load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json')['files']};ad={p:h for p,h in a.items() if p.startswith('dist/')};bd={p:h for p,h in b.items() if p.startswith('dist/')};assert ad==bd and len(bd)==868
changes=sorted(p for p in a.keys()|b.keys() if a.get(p)!=b.get(p));assert changes==[],changes
sql=load('docs/evidence/nodia-ai-ai29-postgresql.json');h=b['test/nodia-ai-ai29.integration.mjs'];assert sql['inputs'][0]['sha256']==h
report={'stage':'AI-29','tested_archive_sha256':sha('.tmp/ai29-sql-tested-server.tar.gz'),'final_archive_sha256':sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz'),'production_dist_identical':True,'dist_files_checked':len(bd),'changed_package_files':changes,'reason':'The final archive, human-flow harness and production dist are exactly the ones accepted by all AI-29 and regression SQL suites.','final_harness_sha256':h}
assert report['tested_archive_sha256']==sql['compiled_production_archive_sha256'];(r/'docs/evidence/nodia-ai-ai29-tested-release-parity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
