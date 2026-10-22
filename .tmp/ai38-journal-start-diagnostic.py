import subprocess,json,re
r=subprocess.run(['journalctl','-u','nodia-api','-u','nodia-ai-worker','-n','140','--output','cat','--no-pager'],capture_output=True,timeout=15)
lines=r.stdout.decode(errors='replace').splitlines()
patterns=[r'nodia_ai:[a-z0-9_]+',r'(?:UnknownDependenciesException|ReferenceError|TypeError|Error):[^\n]{0,250}',r'argument[^\n]{0,250}',r'index \[[0-9]+\]']
found=[]
for line in lines:
 line=re.sub(r'\x1b\[[0-9;]*m','',line)
 for pattern in patterns:
  for value in re.findall(pattern,line):
   if value not in found:found.append(value)
print(json.dumps({'diagnostic_categories':found[-16:],'raw_logs_emitted':False}))
