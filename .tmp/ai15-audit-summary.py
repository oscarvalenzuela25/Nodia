import json
p=json.load(open('/tmp/ai15-release-audit.json'))
print(json.dumps({k:{'severity':v.get('severity'),'direct':v.get('isDirect'),'range':v.get('range'),'fix_available':v.get('fixAvailable'),'advisories':[{'title':x.get('title'),'url':x.get('url'),'range':x.get('range'),'severity':x.get('severity')} for x in v.get('via',[]) if isinstance(x,dict)],'transitive_via':[x for x in v.get('via',[]) if isinstance(x,str)]} for k,v in p.get('vulnerabilities',{}).items()},indent=2))
