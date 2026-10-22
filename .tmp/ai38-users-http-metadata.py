import sys,json,os,re,stat,hashlib
from pathlib import Path
from datetime import datetime,timezone,timedelta
from collections import Counter
log=Path('/var/log/nginx/access.log')
fd=os.open(log,os.O_RDONLY|os.O_NOFOLLOW)
with os.fdopen(fd,'rb') as h:
 info=os.fstat(h.fileno());assert stat.S_ISREG(info.st_mode)
 start=max(0,info.st_size-4*1024*1024);h.seek(start)
 data=h.read(info.st_size-start)
 if start:data=data.split(b'\n',1)[1]
end=datetime.now(timezone.utc);begin=end-timedelta(minutes=30)
line=re.compile(rb'^\S+ \S+ \S+ \[([^\]\r\n]+)\] "((?:[^"\\\r\n]|\\.)*)" ([0-9]{3}) (?:[0-9]+|-)(?: |$)')
req=re.compile(rb'^GET ([^ ]+) HTTP/[0-9.]+$')
counts=Counter();first=None;last=None
for item in data.splitlines():
 m=line.match(item)
 r=req.fullmatch(m[2]) if m else None
 if not r:continue
 uri=r[1]
 if uri.split(b'?',1)[0] not in (b'/api/v1/users',b'/api/v1/user'):continue
 ts=datetime.strptime(m[1].decode('ascii'),'%d/%b/%Y:%H:%M:%S %z').astimezone(timezone.utc)
 if not begin<=ts<=end:continue
 is_id=b'id_eq' in uri
 counts[(int(m[3]),is_id)]+=1
 first=ts if first is None else min(first,ts);last=ts if last is None else max(last,ts)
print(json.dumps({'scope':'bounded_read_only_nginx_users_metadata_only','window_begin_utc':begin.isoformat(),'window_end_utc':end.isoformat(),'scanned_last_max_bytes':4*1024*1024,'source_log_inode':info.st_ino,'counts':[{'method':'GET','endpoint':'users','status':key[0],'id_eq_filter_present':key[1],'count':v} for key,v in sorted(counts.items())],'first_matched_utc':first.isoformat() if first else None,'last_matched_utc':last.isoformat() if last else None,'raw_log_queries_credentials_emitted':False,'network_requests':0,'services_changed':False},indent=2))
