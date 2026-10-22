"""Anonymous header-only nginx boundary probes: no body, token or application write."""
import hashlib
import json
import socket
import time
from datetime import datetime, timezone
from pathlib import Path

LIMIT=20*1024*1024
TARGET='/api/v1/nodia-ai/attachments/00000000-0000-4000-8000-000000000000/content'

def probe(path,size):
    with socket.create_connection(('127.0.0.1',8080),timeout=3) as connection:
        connection.settimeout(3)
        connection.sendall(('PUT '+path+' HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nContent-Length: '+str(size)+'\r\nExpect: 100-continue\r\nConnection: close\r\n\r\n').encode('ascii'))
        data=b''
        while b'\r\n' not in data:
            data+=connection.recv(1024)
            assert len(data)<=8192 and data
        return int(data.split(b'\r\n',1)[0].split(b' ')[1])

started=datetime.now(timezone.utc).isoformat()
observations=[]
deadline=time.monotonic()+20
settled=0
while time.monotonic()<deadline:
    value=probe(TARGET,LIMIT)
    observations.append(value)
    settled=settled+1 if value==100 else 0
    if settled==2:break
    time.sleep(.25)
assert settled==2,'scoped_proxy_config_not_settled'
over=probe(TARGET,LIMIT+1)
other=probe('/api/v1/nodia-ai/attachments',11*1024*1024+1)
invalid=probe('/api/v1/nodia-ai/attachments/not-a-uuid/content',11*1024*1024+1)
assert over==other==invalid==413
print(json.dumps({'stage':'AI-38-proxy-attachments','status':'passed','source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'started_at_utc':started,'finished_at_utc':datetime.now(timezone.utc).isoformat(),
 'transport':'HTTP Expect header-only; sockets closed without sending any body',
 'exact_bytes':LIMIT,'exact_status':100,'settled_exact_status_observations':observations,
 'over_bytes':LIMIT+1,'over_status':over,'other_route_over_11MiB_status':other,'invalid_UUID_route_over_11MiB_status':invalid,
 'request_body_bytes_sent':0,'authentication_used':False,'provider_requests':0,'configured_SQL_writes':0,
 'limits':['100 Continue verifies proxy header admission, not application upload or storage acceptance.','The separate real authenticated UI upload must verify the full 20 MiB body.']},indent=2))
