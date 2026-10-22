from pathlib import Path
import json,re
p=Path('/opt/nodia/verification/ai38-modalities-agentic-cohort-01/png-private-snapshot-stderr.log')
s=p.read_text(encoding='utf-8')
print(json.dumps({'bytes':len(s.encode()),'classes':sorted(set(re.findall(r'\b([A-Z][a-zA-Z]*(?:Error|Exception))\b',s))),'codes':re.findall(r"code: ['\"]([a-zA-Z0-9_:-]{1,100})['\"]",s),'modules':re.findall(r'(?:file:///|at )[^\n]*?/([^/\n]+\.(?:mjs|js))',s),'syntax_tokens':{k:k in s for k in ['SyntaxError','Unexpected token','has already been declared','ERR_MODULE_NOT_FOUND','Cannot find module','AssertionError','ETIMEDOUT']}}))
