from pathlib import Path

current=('Estado actual NodiaAI AI-38, 2026-10-20: [ensayo de adopción y reversión](../evidence/nodia-ai-ai38-adoption-r01.md) A→B→A verificado en la VM Linux local: Server/Client completos congelados, procesos efectivos,174 checks HTTP y171 outputs servidos exactos; reversión byte a byte a Node932. Backup AES256/MDC y restore aislado de62 tablas/29 migraciones verificados; copia, clave y unidades temporales retiradas. Cuatro servicios originales activos, misma época Gemini y cero pendientes; sin migraciones, restore original, replay o efectos comerciales. La UI real llegó al login sin fixtures, pero no completó el intercambio Google: autenticación, drawer e historial entre versiones siguen pendientes; cero generaciones nuevas. Túnel/pestaña propios cerrados. AI-38 parcial por esa aceptación y gates externos; proxy11MiB aún no acepta el límite20MiB. AI-36 mantiene77 candidatas sin publicar; ficha9 draft y contexto c703 intacto. [Validación](../evidence/nodia-ai-ai38-adoption-validation.json).')
for name in ('README.md','00-progress.md'):
    p=Path('docs/mvp')/name
    content=p.read_text(encoding='utf-8')
    marker='Estado actual NodiaAI AI-38, 2026-10-20: [verificaciones posteriores a MCP High]'
    assert content.count(marker)==1
    content=content.replace(marker,'Corte histórico NodiaAI AI-38, 2026-10-20: [verificaciones posteriores a MCP High]',1)
    heading,rest=content.split('\n\n',1)
    p.write_text(heading+'\n\n'+current+'\n\n'+rest,encoding='utf-8')
print('README and progress updated; previous cut retained as historical')
