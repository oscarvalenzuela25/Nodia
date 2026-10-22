import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
test='nodia-server/test/nodia-ai-ai29-gemini-real.integration.mjs'
testhash=hashlib.sha256((root/test).read_bytes()).hexdigest()
for suffix,filename,auth in [('agentic','gemini-agentic-login',True),('web-reconciliation','gemini-web-reconciliation',False)]:
 path=root/f'.tmp/ai29-r01-gemini-real-{suffix}.log'
 result=json.loads(path.read_text(encoding='utf-8-sig'))
 assert len(result['passed'])==result['checks'] and result['provider_transport_mocked'] is False
 assert result['reports'][0]['authentication_observed'] is auth
 result['process_exit_code']=0
 result['cleanup_completed_without_reported_failure']=True
 result['source_hashes']=[{'path':test,'sha256':testhash}]
 (root/f'docs/evidence/nodia-ai-ai29-r01-{filename}.json').write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
