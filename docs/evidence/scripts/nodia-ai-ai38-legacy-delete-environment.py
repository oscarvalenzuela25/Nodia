"""Read-only before/after environment proof around the authorized exact unlink."""
from pathlib import Path
import importlib.util,hashlib,json,urllib.request

source=Path('/tmp/nodia-ai-ai38-journal-activate.py')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec=importlib.util.spec_from_file_location('activation',source);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
a.RELEASE=Path('/opt/nodia/releases/nodia-server-ai38-journal-r02')
manifest=a.RELEASE/'release-manifest.json'
assert a.sha(manifest)=='c8f49aa3adb21f63da4d75f84a811ab3b758e90ce57fe8aff2e8d2fc498256ae'
data=json.loads(manifest.read_bytes())
for name,digest in data['files'].items():
    p=a.RELEASE/name
    assert p.resolve().is_relative_to(a.RELEASE) and not p.is_symlink() and a.sha(p)==digest
assert sum(name.startswith('dist/') for name in data['files'])==2851
_,helpers=a.load_helpers()
units={u:a.state(u) for u in ('nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx','nodia-ai-backup.timer','nodia-ai-backup-rotate.timer')}
assert all(v['active']=='active' for v in units.values())
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
with opener.open('http://127.0.0.1:8080/api/v1',timeout=3) as response:
    assert response.status==200
print(json.dumps(dict(status='read_only_environment_verified',units=units,consumers=a.active_new_processes(),
       operator_config_metadata=a.operator_configuration(),Gemini=helpers['native_epoch'](),
       schema_and_selection=helpers['schema_and_selection'](),original_Node=helpers['original_files'](),
       nginx_sha256=a.sha(a.NGINX),quiet=helpers['quiet'](),runtime_manifest_sha256=a.sha(manifest),
       service_changes=0,SQL_writes=0,provider_requests=0)))
