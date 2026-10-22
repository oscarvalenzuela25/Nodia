import subprocess,json,re
r=subprocess.run(['journalctl','-u','nodia-api','-u','nodia-ai-worker','-n','120','--output','cat','--no-pager'],capture_output=True,timeout=15)
lines=r.stdout.decode(errors='replace').splitlines()
print(json.dumps({'returncode':r.returncode,'line_count':len(lines),'stderr_bytes':len(r.stderr),'sanitized_tail':[re.sub(r'\x1b\[[0-9;]*m','',line)[:250] for line in lines[-20:]]}))
