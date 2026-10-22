from pathlib import Path

current=('Estado actual NodiaAI AI-38, 2026-10-20: [proxy y adjuntos de 20 MiB](../evidence/nodia-ai-ai38-proxy-attachments-r01.md) verificados en la VM Linux local. Límite20m exclusivo del PUT binario de adjuntos, otras rutas11MiB; aplicación/reversión/reaplicación con nginx-t y sin reiniciar API/worker/Gemini. UI autenticada sube PDF20MiB exactos y el inspector valida; HEAD/GET privados R2 coinciden en tamaño/SHA. Archivo+1B rechazado sin reserva, borrador conservado; proxy413. Quitar produce R2 HEAD/GET404 y cero limpieza pendiente; ledger/túnel/pestaña retirados, chat vacío archivado. Cuatro servicios originales/Node932 y época Gemini intactos, cero pendientes; ajuste proxy durable, raíz404. Sin inferencia, descargaAPI20MiB o efecto comercial. AI-38 parcial por HTTPS/infraestructura externa/publicación restante; ficha11 draft, 31 aprobadas y contexto c703 intactos. [Validación](../evidence/nodia-ai-ai38-proxy-attachments-validation.json).')
for filename in ('README.md','00-progress.md'):
    p=Path('docs/mvp')/filename;text=p.read_text(encoding='utf-8')
    marker='Estado actual NodiaAI AI-38, 2026-10-20: [UI autenticada y continuidad tras revertir]'
    assert text.count(marker)==1
    text=text.replace(marker,'Corte histórico NodiaAI AI-38, 2026-10-20: [UI autenticada y continuidad tras revertir]',1)
    head,rest=text.split('\n\n',1);p.write_text(head+'\n\n'+current+'\n\n'+rest,encoding='utf-8')
# Keep historical text immutable; normalize numeric spacing only in this cut.
files=[('docs/mvp/84-nodia-ai-ai38-environment-acceptance.md','## Continuación: proxy de20MiB'),
 ('docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md','## Anexo AI-38: frontera de adjuntos')]
replacements={'de20MiB':'de 20 MiB','de11MiB':'de 11 MiB','permite20MiB':'permite 20 MiB','conserva11MiB':'conserva 11 MiB',
 'de40MiB':'de 40 MiB','observan100':'observan 100','para20.':'para 20.','y413':'y 413','para20MiB':'para 20 MiB','reciben401':'reciben 401',
 'reservaPOST201':'reserva POST 201','unPUT200':'un PUT 200','corroboran20.':'corroboran 20.','registraDELETE200':'registra DELETE 200',
 'HEAD/GET404':'HEAD/GET 404','original20MiB':'original de 20 MiB','vuelve404':'vuelve 404','scoped20m':'scoped de 20m',
 'revisión11':'revisión 11','las31':'las 31','los40MiB':'los 40 MiB','sólo a la ruta binaria':'sólo a la ruta binaria',
 'recibe413':'recibe 413','con413':'con 413','con20MiB':'con 20 MiB','agregado40MiB':'agregado de 40 MiB','ajuste20m':'ajuste de 20m'}
for filename,anchor in files:
    p=Path(filename);text=p.read_text(encoding='utf-8');before,added=text.split(anchor,1)
    for old,new in replacements.items():added=added.replace(old,new)
    p.write_text(before+anchor.replace('de20MiB','de 20 MiB')+added,encoding='utf-8')
print('Current progress and new documentation cut updated')
