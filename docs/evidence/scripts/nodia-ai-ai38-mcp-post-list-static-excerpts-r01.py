import json,subprocess
p=r'''
import hashlib,json,mmap
from pathlib import Path
p=Path('/opt/nodia/antigravity-cli/1.3.1/agy')
with p.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as b:
 out={}
 for token in ('resources/list','prompts/list','tools/list','notifications/initialized','notifications/cancelled','logging/setLevel','inputSchema'):
  q=token.encode();pos=b.find(q)
  if pos<0:out[token]=None;continue
  start=max(0,pos-100);end=min(len(b),pos+len(q)+200);raw=b[start:end]
  # Compile-time public binary only. Replace nonprintable bytes, cap one excerpt per known literal.
  out[token]={'offset':pos,'static_binary_excerpt':''.join(chr(x) if 32<=x<127 else '.' for x in raw),'excerpt_sha256':hashlib.sha256(raw).hexdigest()}
 print(json.dumps({'scope':'bounded_public_installed_binary_literals_not_runtime_or_source_attribution','static_excerpts':out,'CLI_executed':False,'profile_or_session_opened':False},indent=2))
'''
r=subprocess.run(['docker','exec','--user','10001:10001','nodia-gemini-microservice','python','-B','-c',p],capture_output=True,check=True,timeout=15)
print(r.stdout.decode())
