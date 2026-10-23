"""Read-only preflight for owner-selector deployment; no inference or service mutation."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,importlib.util,json

source=Path('/tmp/nodia-ai-ai38-journal-activate.py')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec=importlib.util.spec_from_file_location('pinned_activation',source)
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
a.RELEASE=Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
a.MANIFEST_SHA='4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
manifest=json.loads((a.RELEASE/'release-manifest.json').read_bytes())
assert a.sha(a.RELEASE/'release-manifest.json')==a.MANIFEST_SHA
for name,digest in manifest['files'].items():
    target=a.RELEASE/name
    assert target.resolve().is_relative_to(a.RELEASE) and target.is_file() and not target.is_symlink() and a.sha(target)==digest
runtime,h=a.load_helpers()
result=dict(schema='ai38-owner-final-v1',status='observed_read_only',observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),
 consumers=a.active_new_processes(),quiet=h['quiet'](),Gemini=h['native_epoch'](),SQL_schema_and_selection=h['schema_and_selection'](),
 nginx_sha256=a.sha(a.NGINX),operator_configuration=a.operator_configuration(),external_status=a.journal('status'),
 timers={name:a.state(name) for name in a.TIMERS},oneshots={name:a.state(name) for name in ('nodia-ai-backup','nodia-ai-backup-rotate')},
 server_manifest_sha256=a.MANIFEST_SHA,server_members=len(manifest['files']),dist_outputs=sum(name.startswith('dist/') for name in manifest['files']),
 knowledge_release=manifest['knowledge_release'],configured_SQL_writes=0,provider_requests=0,service_changes=0)
print(json.dumps(result))
