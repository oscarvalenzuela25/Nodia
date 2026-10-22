import json,subprocess
attempt='3635f4bd-d74e-4836-b42b-ea93263a8fbe'
raw=subprocess.run(['docker','logs','nodia-gemini-microservice'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
results=[]
for line in (raw.stdout+'\n'+raw.stderr).splitlines():
 if 'nodia_ai_chat_failure ' not in line:continue
 try:value=json.loads(line.split('nodia_ai_chat_failure ',1)[1])
 except ValueError:continue
 if value.get('attempt_id')!=attempt:continue
 safe={k:value.get(k) for k in ['engine','attempt_id','phase','error_type','elapsed_ms','reply_format']}
 web=value.get('web_generation') or {}
 safe['generation']={k:web.get(k) for k in ['http_status','upstream_eof_seen','upstream_eof_elapsed_ms','candidate_outputs','recovery_calls','client_close_calls']}
 safe['generation']['text_outputs']=(web.get('output_shape') or {}).get('text_outputs')
 results.append(safe)
assert len(results)==1
print(json.dumps({'stage':'AI-32','scope':'redacted_shape_only_diagnostics_for_explicit_synthetic_attempt','diagnostics':results,'provider_response_text_stored':False,'credentials_stored':False,'additional_generations':0}))

