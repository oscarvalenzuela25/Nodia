import json,re
from pathlib import Path
r=Path.cwd();p=r/'docs/mvp/73-nodia-ai-ai27-core-administration.md';s=p.read_text(encoding='utf-8');s=re.sub(r'\n\n\n- \[Client verificado\].*?(?=\nSiguiente desarrollo del plan:)', '\n\nRegresiones Client verifican que un403 de negocio NI-13 conserve el borrador, mientras un403 de autoridad revoca la observación. También comprueban comparación semántica de traducciones, IDs exactos, datos remotos inválidos y confirmación delete sin campos editables. [Logs y hashes Client](../evidence/nodia-ai-ai27-client-validation.json).\n',s,flags=re.S);p.write_text(s,encoding='utf-8')
p=r/'docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md';raw=p.read_text(encoding='utf-8');parts=raw.split('---',2);front=json.loads(parts[1]);evidence='docs/evidence/nodia-ai-ai27-validation.json'
if evidence not in front['verification']['evidence_paths']:front['verification']['evidence_paths'].insert(0,evidence)
front['verification']['notes']='Laboratorio privado: 2760 pruebas Server,1571 Client,407 comprobaciones SQL/HTTP/procesos y11 QA sintéticas;65 ejecutores y esquema18 tablas/241 columnas conservado. Puertos internos; no publica MCP ni acredita aceptación Gemini.'
p.write_text('---\n'+json.dumps(front,ensure_ascii=False,indent=2)+'\n---'+parts[2],encoding='utf-8')
raw=(r/'.tmp/ai27-knowledge-validation.log').read_text(encoding='utf-8');(r/'docs/evidence/nodia-ai-ai27-knowledge-validation.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),indent=2)+'\n',encoding='utf-8')
