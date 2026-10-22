import json,re,subprocess
result=subprocess.run(['journalctl','-u','nodia-ai-worker','--since','2026-10-16 19:59:00 UTC','-n','200','--no-pager','-o','json'],check=True,stdout=subprocess.PIPE)
counts={'error':0,'warning':0,'fatal':0,'other':0}
if len(result.stdout)>262144:raise SystemExit('bounded_journal_exceeded')
for line in result.stdout.splitlines():
 item=json.loads(line);raw=item.get('MESSAGE','')
 if isinstance(raw,list) and all(type(x) is int and 0<=x<=255 for x in raw):raw=bytes(raw).decode('utf-8',errors='replace')
 if not isinstance(raw,str):counts['other']+=1;continue
 message=re.sub(r'\x1b\[[0-9;]*m','',raw)
 category='fatal' if re.search(r'\bFATAL\b',message) else 'error' if re.search(r'\b(ERROR|Error)\b',message) or int(item.get('PRIORITY',6))<=3 else 'warning' if re.search(r'\b(WARN|WARNING)\b',message) else 'other'
 counts[category]+=1
print(json.dumps({'service':'nodia-ai-worker','raw_messages_emitted':False,'categories':counts,'maximum_entries':200}))

