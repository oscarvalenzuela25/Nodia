from pathlib import Path
import json,hashlib
r=Path.cwd();load=lambda p:json.loads((r/p).read_text(encoding='utf-8'));sha=lambda p:hashlib.sha256((r/p).read_bytes()).hexdigest()
a={x['path']:x['sha256'] for x in load('.tmp/ai28-sql-tested-manifest.json')['files']};b={x['path']:x['sha256'] for x in load('nodia-server/.tmp/ai11-ai12-release/server-manifest.json')['files']};ad={p:h for p,h in a.items() if p.startswith('dist/')};bd={p:h for p,h in b.items() if p.startswith('dist/')};assert ad==bd and len(bd)==851
changes=sorted(p for p in a.keys()|b.keys() if a.get(p)!=b.get(p));assert changes in ([],['test/nodia-ai-ai28.integration.mjs']),changes
sql=load('docs/evidence/nodia-ai-ai28-postgresql.json');h=b['test/nodia-ai-ai28.integration.mjs'];assert sql['inputs'][0]['sha256']==h
report={'stage':'AI-28','tested_archive_sha256':sha('.tmp/ai28-sql-tested-server.tar.gz'),'final_archive_sha256':sha('nodia-server/.tmp/ai11-ai12-release/server.tar.gz'),'production_dist_identical':True,'dist_files_checked':len(bd),'changed_package_files':changes,'reason':'Disposable SQL harness gained explicit catalog-reassignment assertion and correct AI28 provenance; production dist is identical to all accepted SQL regressions.','final_harness_sha256':h}
assert report['tested_archive_sha256']==sql['compiled_production_archive_sha256'];(r/'docs/evidence/nodia-ai-ai28-tested-release-parity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
