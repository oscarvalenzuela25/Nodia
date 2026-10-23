"""Verify exact frozen static outputs through loopback nginx; no authenticated requests."""
from pathlib import Path,PurePosixPath
from datetime import datetime,timezone
import hashlib,json,urllib.request,urllib.parse

root=Path('/opt/nodia/releases/nodia-client-ai38-owner-r01')
raw=(root/'manifest.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93'
manifest=json.loads(raw)
files={name[5:]:digest for name,digest in manifest['files'].items() if name.startswith('dist/')}
assert len(files)==171 and 'index.html' in files
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
checks=[]
for name,digest in sorted(files.items()):
    assert not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
    expected=(root/'dist'/name).read_bytes()
    assert hashlib.sha256(expected).hexdigest()==digest
    request=urllib.request.Request('http://127.0.0.1:8080/'+urllib.parse.quote(name,safe='/.-_'),headers={'Cache-Control':'no-cache'})
    with opener.open(request,timeout=5) as response:
        data=response.read(len(expected)+1)
        assert response.status==200 and hashlib.sha256(data).hexdigest()==digest
        checks.append(dict(path=name,status=response.status,bytes=len(data),sha256=digest))
with opener.open('http://127.0.0.1:8080/tools/nodia-ai',timeout=5) as response:
    deep=response.read(100000)
    assert response.status==200 and hashlib.sha256(deep).hexdigest()==files['index.html']
print(json.dumps(dict(schema='ai38-ownerclient-static-verify-v1',status='passed',observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),
 manifest_sha256=hashlib.sha256(raw).hexdigest(),static_outputs=checks,deep_route_matches_index=True,HTTP_requests=len(checks)+1,
 authenticated_requests=0,configured_SQL_writes=0,provider_requests=0,service_changes=0)))
