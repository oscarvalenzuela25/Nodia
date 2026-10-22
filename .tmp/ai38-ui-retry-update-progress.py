from pathlib import Path
current=('Estado actual NodiaAI AI-38, 2026-10-20: [UI autenticada y continuidad tras revertir](../evidence/nodia-ai-ai38-ui-retry-r01.md) verificadas con ingreso humano Google, restauración de sesión, historial propio y drawer Web/Agentic en escritorio y móvil. La segunda ventana A→B→A conserva los paquetes congelados: GET nuevos al servidor original, hashes DOM y snapshot SQL proyectado del chat iguales, sin nuevos mensajes, generaciones o efectos comerciales. Backup fresco cifrado y restore aislado verificados; copia/clave/unidades/túnel/pestaña propios retirados. Cuatro servicios originales activos, Node932 intacto, misma época Gemini y cero pendientes. Lectura desde SPA retenida; el shell original conserva raíz404. AI-38 sigue parcial por proxy de 11 MiB frente a archivos de 20 MiB e infraestructura externa, HTTPS y publicación restante AI-36. Ficha 10 draft, 31 fichas aprobadas y contexto c703 intactos. [Validación complementaria](../evidence/nodia-ai-ai38-ui-retry-validation.json).')
for filename in ('README.md','00-progress.md'):
    p=Path('docs/mvp')/filename
    text=p.read_text(encoding='utf-8')
    marker='Estado actual NodiaAI AI-38, 2026-10-20: [ensayo de adopción y reversión]'
    assert text.count(marker)==1
    text=text.replace(marker,'Corte histórico NodiaAI AI-38, 2026-10-20: [ensayo de adopción y reversión]',1)
    head,rest=text.split('\n\n',1)
    p.write_text(head+'\n\n'+current+'\n\n'+rest,encoding='utf-8')
p=Path('docs/mvp/84-nodia-ai-ai38-environment-acceptance.md')
text=p.read_text(encoding='utf-8'); anchor='## Continuación: UI autenticada y continuidad tras la reversión'
before,added=text.split(anchor,1)
replacements={'login`200':'login` 200','me`200':'me` 200','Escritorio1440':'Escritorio 1440','viewport390':'viewport 390','ancho390':'ancho 390',
 'GET200':'GET 200','después:2':'después: 2','mensajes,5':'mensajes, 5','partes,1':'partes, 1','turno,1':'turno, 1','trabajo y2':'trabajo y 2',
 'registra499':'registra 499','otro200':'otro 200','superan21':'superan 21','de62':'de 62','sigue404':'sigue 404','proxy11MiB':'proxy de 11 MiB',
 'archivos20MiB':'archivos de 20 MiB','revisión10':'revisión 10','las31':'las 31'}
for old,new in replacements.items(): added=added.replace(old,new)
p.write_text(before+anchor+added,encoding='utf-8')
print('Product documentation updated, prior evidence retained')
