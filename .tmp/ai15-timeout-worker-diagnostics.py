import collections,json,re,subprocess
allowed={'nodia_ai_claim_unavailable','nodia_ai_maintenance_unavailable','nodia_ai_stage_checkpoint_unavailable','nodia_ai:outcome_unknown','nodia_ai:mcp_result_unknown','nodia_ai:invalid_tool_output','nodia_ai:deadline_exceeded','nodia_ai:stage_failed','nodia_ai:adapter_transport_unavailable','nodia_ai:runtime_busy'}
reports=[]
for unit in ['nodia-ai-worker','nodia-api']:
 p=subprocess.run(['sudo','journalctl','-u',unit,'--since','2026-10-16 20:40:00 UTC','-n','200','--no-pager','-o','json'],capture_output=True,timeout=5,check=True)
 if len(p.stdout)>1048576:raise RuntimeError('journal_bound_exceeded')
 codes=collections.Counter();frames=collections.Counter();levels=collections.Counter()
 for line in p.stdout.splitlines():
  row=json.loads(line);raw=row.get('MESSAGE','')
  if isinstance(raw,list):raw=bytes(raw).decode('utf8',errors='replace')
  if not isinstance(raw,str):continue
  msg=re.sub(r'\x1b\[[0-9;]*m','',raw)
  if re.search(r'\b(ERROR|WARN|WARNING|Error)\b',msg):
   levels['error_or_warning_lines']+=1
   for code in allowed:
    if code in msg:codes[code]+=1
  for frame in re.findall(r'dist/nodia-ai-(?:runtime|tool|adapter)[A-Za-z0-9_./-]*\.js:\d+:\d+',msg):frames[frame]+=1
 reports.append({'unit':unit,'classified_codes':dict(codes),'source_frames':dict(frames),'levels':dict(levels),'raw_messages_exported':False})
print(json.dumps(reports))
