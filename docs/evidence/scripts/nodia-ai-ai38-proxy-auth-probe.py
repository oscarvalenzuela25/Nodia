"""No-credential API probes; no data body larger than two bytes."""
import hashlib
import json
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
root='http://127.0.0.1:8080/api/v1/nodia-ai/attachments'
identity='6a140189-de1f-4fb4-946a-9995a4448d86'
values=[]
for method,url,data in [('POST',root,b'{}'),('PUT',root+'/'+identity+'/content',b'x'),('GET',root+'/'+identity+'/content',None)]:
    request=Request(url,data=data,method=method,headers={'Content-Type':'application/json' if method=='POST' else 'application/octet-stream'})
    try:
        with urlopen(request,timeout=5) as response:status=response.status
    except HTTPError as error:status=error.code;error.close()
    values.append({'method':method,'status':status})
assert all(x['status']==401 for x in values)
print(json.dumps({'stage':'AI-38-proxy-attachments','status':'passed','source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'observed_at_utc':datetime.now(timezone.utc).isoformat(),'requests':values,'credentials_or_tokens_used':False,
 'provider_generations':0,'configured_SQL_writes':0,
 'limits':['The test attachment had already been discarded. This proves these unauthenticated requests are rejected, not a new authenticated application download.']},indent=2))
