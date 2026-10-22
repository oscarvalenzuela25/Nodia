"""Temporarily serve the frozen Client; preserve the durable scoped proxy fix."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime,timezone

PIN='703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee'
WORK=Path('/opt/nodia/verification/ai38-proxy-ui-r01')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument('phase',choices=('open','close'));p.add_argument('--expected-site-sha256',required=True);a=p.parse_args()
assert os.geteuid()==0
payload=Path('/tmp/nodia-ai-ai38-adoption-r03.py').read_bytes();assert hashlib.sha256(payload).hexdigest()==PIN
tree=ast.parse(payload)
nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.Assign,ast.FunctionDef,ast.Expr)) and not(isinstance(n,ast.FunctionDef) and n.name=='main')]
assert len(nodes)==len(tree.body)-2
h={'__file__':__file__,'__name__':'pinned_proxy_ui_helpers'}
exec(compile(ast.Module(body=nodes,type_ignores=[]),'pinned_proxy_ui_helpers','exec'),h)
os.umask(0o077)
assert sha(h['NGINX'])==a.expected_site_sha256
h['require_processes'](False)
epoch=h['native_epoch']();states=h['states']();assert all(x=='active' for x in states.values())
h['validate_manifest'](h['CLIENT'],h['CLIENT_MANIFEST_SHA'])
if a.phase=='open':
    WORK.mkdir(mode=0o700)
    (WORK/'private').mkdir(mode=0o700)
    original=h['NGINX'].read_bytes()
    assert original.count(b'client_max_body_size 20m;')==1 and original.count(b'location / { return 404; }')==1
    (WORK/'private'/'descriptor-3').write_bytes(original)
    desired=h['nginx_bytes'](WORK/'private',False)
else:
    opened=json.loads((WORK/'open.json').read_text())
    assert opened['status']=='passed' and opened['site_after_sha256']==a.expected_site_sha256 and opened['Gemini']==epoch
    desired=(WORK/'private'/'descriptor-3').read_bytes()
    assert sha(WORK/'private'/'descriptor-3')==opened['site_before_sha256']
report={'stage':'AI-38-proxy-attachments','phase':a.phase,'status':'running','started_at_utc':datetime.now(timezone.utc).isoformat(),'source_sha256':sha(Path(__file__)),'pinned_helpers_sha256':PIN,'site_before_sha256':a.expected_site_sha256,'Gemini':epoch,'provider_generations':0,'configured_SQL_writes':0,'service_restarts':0}
assert not (WORK/(a.phase+'.json')).exists()
try:
    h['write_nginx'](desired)
    assert h['states']()==states and h['native_epoch']()==epoch
    h['require_processes'](False)
    report.update(status='passed',site_after_sha256=sha(h['NGINX']),services=states,scoped_20MiB_preserved=h['NGINX'].read_bytes().count(b'client_max_body_size 20m;')==1)
except Exception as error:
    report.update(status='failed_requires_review',failure_class=type(error).__name__)
    raise
finally:
    report['finished_at_utc']=datetime.now(timezone.utc).isoformat()
    h['freeze'](WORK/(a.phase+'.json'),report)
    print(json.dumps(report,indent=2))
