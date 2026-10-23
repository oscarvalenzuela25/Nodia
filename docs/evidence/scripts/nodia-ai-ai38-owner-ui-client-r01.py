"""UI-only window on frozen Client, preserving journaled Server R02 and proxy20m."""
from pathlib import Path
import argparse,ast,hashlib,json,os
from datetime import datetime,timezone
WORK=Path('/opt/nodia/verification/ai38-owner-ui-client-r01')
NGINX=Path('/etc/nginx/sites-available/nodia-lab')
BASE_SHA='2f96d9f04d2bc2eba6e1d8bc126ec7d4a5c5b5202bfa3238d87d23e94c52a857'
OPEN_SHA='1d99de64ddae335f224347e5351bce244f1843e61ab3eaa451f22ce689a995b0'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument('phase',choices=['open','close']);args=p.parse_args()
assert os.geteuid()==0
source=Path('/tmp/nodia-ai-ai38-adoption-r03.py');raw=source.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee'
tree=ast.parse(raw);nodes=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.Assign,ast.FunctionDef,ast.Expr)) and not(isinstance(n,ast.FunctionDef) and n.name=='main')]
assert len(nodes)==len(tree.body)-2
h={'__file__':str(source),'__name__':'pinned_ui_window'};exec(compile(ast.Module(body=nodes,type_ignores=[]),'pinned_ui_helpers','exec'),h)
import importlib.util
source=Path('/tmp/nodia-ai-ai38-journal-activate.py');assert sha(source)=='56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec=importlib.util.spec_from_file_location('activation',source);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
a.RELEASE=Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
processes=a.active_new_processes();epoch=h['native_epoch']();states=h['states']()
assert all(v=='active' for v in states.values())
h['CLIENT']=Path('/opt/nodia/releases/nodia-client-ai38-owner-r01')
h['CLIENT_MANIFEST_SHA']='cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93'
client=h['validate_manifest'](h['CLIENT'],h['CLIENT_MANIFEST_SHA'])
assert len([name for name in client['files'] if name.startswith('dist/')])==171
os.umask(0o077)
if args.phase=='open':
    assert sha(NGINX)==BASE_SHA;WORK.mkdir(mode=0o700);(WORK/'private').mkdir(mode=0o700)
    (WORK/'private/descriptor-3').write_bytes(NGINX.read_bytes())
    desired=h['nginx_bytes'](WORK/'private',False)
    assert hashlib.sha256(desired).hexdigest()==OPEN_SHA
else:
    assert sha(NGINX)==OPEN_SHA
    desired=(WORK/'private/descriptor-3').read_bytes();assert hashlib.sha256(desired).hexdigest()==BASE_SHA
assert not (WORK/(args.phase+'.json')).exists()
h['write_nginx'](desired)
assert a.active_new_processes()==processes and h['native_epoch']()==epoch and h['states']()==states
result=dict(status='passed',phase=args.phase,observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),
 site_sha256=sha(NGINX),server_consumers=processes,client_manifest_sha256=h['CLIENT_MANIFEST_SHA'],client_outputs=171,
 scoped20m_preserved=NGINX.read_bytes().count(b'client_max_body_size 20m;')==1,
 Gemini=epoch,API_worker_Gemini_restarted=False,nginx_reloaded=True,SQL_writes=0,provider_requests=0)
(WORK/(args.phase+'.json')).write_text(json.dumps(result));print(json.dumps(result))
