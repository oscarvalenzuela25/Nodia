import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
def read(path): return (root/path).read_text(encoding='utf-8-sig')
def write(path, text): (root/path).write_text(text, encoding='utf-8', newline='\n')
def append(path, text):
    source = read(path)
    assert '## Revalidación AI-32-R06' not in source
    write(path, source.rstrip()+'\n\n'+text.strip()+'\n')

baseline=json.loads(read('.tmp/ai32-r06-baseline.json'))
write('docs/evidence/nodia-ai-ai32-r06-baseline.json',json.dumps(baseline,ensure_ascii=False,indent=2)+'\n')
delivery='docs/mvp/78-nodia-ai-ai32-attachments-voice.md'
text=read(delivery)
text=text.replace('revalidaciones R01/R02/R03/R04/R05:', 'revalidaciones R01/R02/R03/R04/R05/R06:')
old=next(line for line in text.splitlines() if line.startswith('> Estado técnico:'))
text=text.replace(old, '> Estado técnico: R06 verifica expiración/limpieza de adjuntos y creación, reemplazo y traslado de archivos de facturas con PostgreSQL desechable, inspector Linux y R2 reales. La copia de factura sobrevive a purgar su chat. R05 conserva la prueba de app/micrófono y R04 la matriz nativa; no hubo reinicios, cambios de aplicación o inferencias en R06. Aceptación productiva y publicación MCP siguen separadas. R06 es el estado actual; las secciones previas conservan sus snapshots históricos.')
write(delivery,text)
append(delivery, '''## Revalidación AI-32-R06 — purga y copias de factura con R2 real

[Consolidado R06](../evidence/nodia-ai-ai32-r06-validation.json). Se ejecutaron los casos de uso compilados reales en dos PostgreSQL16 desechables, cada uno con26 migraciones e identidades sintéticas. [Staging](../evidence/nodia-ai-ai32-r06-purge-stage.json):909 outputs idénticos al runtime y versiones de dependencias compatibles, incluidas Nest/TypeORM/AWS S3; testing existe sólo en el entorno de verificación. El inspector privado Linux y StorageNodiaAiAttachment/StorageService fueron reales. No se invocaron modelos ni se modificó la base operativa, configuración, esquema o código de la aplicación. La confirmación usa contratos reales con actor sintético; no se presenta como una nueva prueba del botón UI o de preparación MCP.

### Expiración, ventana de escritura y DELETE incierto

[Purga final](../evidence/nodia-ai-ai32-r06-purge-real.json):16 comprobaciones finales sobre los mismos dos PNG sintéticos ya subidos y leídos con hash exacto. La expiración eliminó chat, mensaje, partes, adjuntos e interpretaciones en SQL; dejó sólo dos jobs de limpieza desvinculados, con identidad operacional de generación y sin contenido. El janitor eliminó el primer objeto y GET devolvió404/NoSuchKey. Una ventana de escritura sintética de2s impidió borrar incluso con reintento manual antes de su vencimiento.

En el segundo objeto se inyectó localmente la pérdida del ACK después de un DELETE real exitoso. El job quedó waiting con su witness/cuota; GET404 probó que el objeto ya no existía. La recuperación manual emitió un DELETE idempotente, verificó404 y retiró el job. Otro replay no emitió DELETE. Tres DELETE para dos objetos; cero contenido/jobs al finalizar. Esto prueba la recuperación del caso inyectado, no una caída de R2 ni una espera real de90 días: sólo las fechas del sandbox se prepararon como vencidas.

Se conservan [intento previo](../evidence/nodia-ai-ai32-r06-purge-real-attempt02.json) y [recibo de fuente](../evidence/nodia-ai-ai32-r06-purge-source-receipt.json). El fixture inicial intentaba fijar write_until_at sin el processing_started_at exigido por nodia_ai_attachments_check3; SQL rechazó ese estado. La reanudación corrigió exclusivamente el fixture y usó los mismos dos objetos, sin repetir PUT. Un error anterior de lectura de stdin ocurrió antes de conectar o subir. No se atribuyen estos fallos al producto.

### Factura independiente, reemplazo y traslado legacy

[Verificación de facturas](../evidence/nodia-ai-ai32-r06-invoice-validation.json):16 comprobaciones funcionales con datos y archivos sintéticos. Prepare→Challenge→Confirm→Claim→Stage→Effect ejercita el contrato real; ninguna copia de dominio ocurre antes de confirmar. El intent invoice_uploads existe antes de PUT; factura, recibo y consumo del intent se confirman juntos. El destino tiene key propia, con bytes/SHA contrastados por GET. La reutilización del stage listo y del recibo completado no añade PUT ni factura.

La creación usa PNG29.076B y el reemplazo un PDF distinto de765B, ambos validados por el inspector real. Se mantiene el ID de factura, cambia su archivo y la recuperación nativa elimina el objeto reemplazado. El traslado legacy sin attachment_id conserva la factura, copia al negocio destino y registra tamaño/digest observados en su descriptor v2; el origen se elimina mediante recuperación nativa después del commit. Un fallo SQL inyectado al escribir el recibo revierte factura y consumo del intent pese al PUT ya completado; la compensación elimina esa copia huérfana y preserva el adjunto del chat.

Expirar los chats de origen elimina sus tres originales R2 y su contenido SQL. Las dos facturas y sus copias independientes —PDF nuevo y PNG trasladado— permanecen legibles con el hash esperado. Son tres efectos confirmados en el sandbox; cero efectos sobre datos de negocio configurados. Los contadores describen invocaciones del puerto observado, no una telemetría interna de R2.

### Recuperación del teardown y limpieza final

El [arnés ejecutado](../evidence/scripts/nodia-ai-ai32-r06-invoice-real-attempt01.mjs) completó los16 checks, pero su teardown usó uuid[] para Invoice.id, que es bigint. El [reporte fallido original](../evidence/nodia-ai-ai32-r06-invoice-real-attempt01.json) se conserva. La [limpieza separada](../evidence/nodia-ai-ai32-r06-invoice-cleanup.json) volvió a verificar los hashes de las dos copias supervivientes, eliminó sólo esas dos filas bigint y confirmó la ausencia de los ocho objetos propios; cero PUT o replay de efectos. El [arnés reutilizable corregido](../evidence/scripts/nodia-ai-ai32-r06-invoice-real.mjs) no tuvo una segunda ejecución cloud; [fuentes ejecutadas/corregidas](../evidence/nodia-ai-ai32-r06-invoice-source-receipt.json) están diferenciadas por SHA.

Cinco [guardas offline](../evidence/nodia-ai-ai32-r06-invoice-guard-offline.json) comprueban que detectar un objeto preexistente o fallar antes de PUT no autoriza borrarlo. Los ledgers privados registran sólo generaciones propias antes de intentar PUT y se sincronizan antes de la mutación externa. La conexión SQL se construye con campos explícitos y verifica database/user del sandbox. No hay listados de bucket, URLs firmadas o claves privadas en la evidencia pública.

[Teardown](../evidence/nodia-ai-ai32-r06-purge-sandbox-cleanup.json): diez objetos propios ausentes en total, dos contenedores retirados, SQL sin chats/adjuntos/jobs/intents/facturas de prueba y archivos privados temporales eliminados. El [chat R05 se conserva](../evidence/nodia-ai-ai32-r06-purge-configured-chat-preservation.json), con sus tres adjuntos, metadata y único dispatch idénticos antes/después. [Salud final](../evidence/nodia-ai-ai32-r06-purge-final-health.json): API/worker/Gemini/nginx activos, HTTP200, cero jobs/intentos/slots pendientes y paridad909 Node/92 fuentes Gemini; sin reinicios. El helper de salud reusado declara R05 y su wrapper R06 lo identifica expresamente; no representa otra inferencia.

**Se cierran los pendientes técnicos de purga y copia/traslado con R2 real en laboratorio.** No se extrapola a una retención transcurrida de90 días, SLA de producción, carreras no ejecutadas en cloud, publicación de preparadores MCP o descarga binaria nativa de factura de AI-15. Las pruebas previas de app/micrófono y modalidades mantienen sus alcances. La casilla de aceptación AI-32 sigue abierta conforme al plan; documentos/fichas/ADR no se aprueban automáticamente. Corpus55/28 y67 lecturas/27 fragmentos, release6c4f, preservados. Sin cambios de aplicación, no se repiten las suites completas históricas ni builds de aplicación como si fueran pruebas nuevas de R06.
''')

progress='docs/mvp/00-progress.md'
text=read(progress)
entry='- 2026-10-18: **AI-32-R06: purga y copias de facturas con R2 real verificadas.** [Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) y [consolidado](../evidence/nodia-ai-ai32-r06-validation.json): dos PostgreSQL desechables, compilado909 idéntico, inspector Linux y R2 reales.16 checks finales de purga y16 funcionales de copia: cascada, ventana de escritura, ACK perdido local/DELETE idempotente, creación PNG, reemplazo PDF distinto, traslado legacy, recibo atómico/rollback y conservación de factura al purgar origen. Cinco guardas offline. Fallos de fixture preservados; teardown de factura corregido con limpieza separada bigint, sin repetir PUT. Diez objetos y ambos sandboxes retirados; chat R05 intacto, servicios activos y cero pendientes. Cero inferencias/cambios de aplicación o BD operativa. Se cierran estos dos gates técnicos de laboratorio; aceptación productiva/publicación MCP/descarga nativa AI-15 no se extrapolan. Corpus y aprobaciones documentales conservados.\n\n'
write(progress,text.replace('# Progreso del MVP — Nodia\n\n','# Progreso del MVP — Nodia\n\n'+entry,1))

index='docs/mvp/README.md'
text=read(index)
start=text.index('Estado actual NodiaAI,2026-10-18:')
end=text.index('\n',start)
summary='Estado actual NodiaAI,2026-10-18: [AI-32-R06](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) verifica purga, recuperación y copias/traslado de facturas con R2 real y SQL desechable. R05 conserva app/micrófono. Los pendientes técnicos de esos flujos cierran en laboratorio; aceptación productiva y publicación MCP siguen separadas.'
text=text[:start]+summary+text[end:]
head='## Cómo continuar\n\n'
start=text.index(head)+len(head)
end=text.index('\n\n',start)
text=text[:start]+summary+text[end:]
write(index,text)

plan='docs/mvp/45-nodia-ai-implementation-plan.md'
text=read(plan)
marker='- [ ] **AI-33 —'
bullet='  - [R06](../evidence/nodia-ai-ai32-r06-validation.json): purga y copia/traslado de factura comprobados con SQL desechable, inspector y R2 reales;16 checks finales de purga y16 funcionales de facturas, cinco guardas offline. PNG→PDF distinto, intent/recibo atómicos, rollback, reuso sin PUT extra y copias que sobreviven al chat. Fallos de fixture y limpieza separada conservados, sin replay; diez objetos y ambos contenedores retirados. Cero cambios de aplicación/BD operativa/inferencias, servicios activos y chat R05 intacto. Estos dos gates técnicos cierran; aceptación productiva y publicación/lecturas nativas mantienen sus etapas propias, sin aprobar documentos.\n'
assert marker in text
write(plan,text.replace(marker,bullet+marker,1))

append('docs/mvp/68-nodia-ai-ai22-business-operations.md', '''## Revalidación AI-32-R06

[Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) y [facturas R06](../evidence/nodia-ai-ai32-r06-invoice-validation.json) verifican creación con PNG, reemplazo con PDF distinto, traslado legacy sin adjunto nuevo, recibo/intento atómicos, rollback y conservación de la copia de factura al purgar el chat. Compilado real, SQL desechable e inspector/R2 reales;16 checks funcionales y limpieza separada sin replay. Se cierra el gate de copia/traslado R2 de estos puertos internos. No se publican preparadores MCP ni se acredita por esta prueba la descarga binaria nativa/HTTP de AI-15; las referencias a R2 pendiente en los snapshots anteriores conservan su carácter histórico. Sin cambios en código, contratos, permisos o aprobación documental.
''')
append('docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md', '''## Revalidación AI-32-R06

La [evidencia R06](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) contrasta en SQL desechable y R2 real la separación entre objeto del chat y copia de factura, intents previos al PUT, recibos/consumo atómicos, compensación y purga por generación. La pérdida de ACK de DELETE se inyecta localmente después del efecto real; el witness permanece hasta conciliación y luego desaparece. Son verificaciones de la decisión existente, sin nueva arquitectura o aprobación. Estado propuesto conservado.
''')
append('docs/mvp/vps-local-vm-lab.md', '''## Revalidación AI-32-R06

[Purga/copia R2](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) verificadas en dos PostgreSQL desechables con26 migraciones cada uno y compilado909 idéntico. Los diez objetos propios y ambos contenedores se retiraron tras GET404; descriptores/ledgers privados borrados. La base operativa y el chat R05 quedaron intactos. API/worker/Gemini/nginx activos, sin reinicios ni inferencias. El cierre de estos gates de laboratorio no acredita aceptación productiva o una espera real de90 días. Los reportes sanitizados distinguen fallos de fixture, recuperación sin replay y fuentes ejecutadas/corregidas.
''')
append('docs/nodia-ai/knowledge/README.md', '''## Revalidación AI-32-R06

[Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) verifica purga y copia/traslado de facturas con R2 real, SQL desechable e inspector real. Se actualizan sólo borradores NodiaAI de producto/adjuntos y efectos confirmados de Negocios, manteniendo approval null y unregistered. No cambian contratos, permisos o bindings:55 fuentes/28 excluidas y67 lecturas/27 fragmentos conservados. Aceptación productiva, preparación MCP y descarga nativa de factura se distinguen de esta prueba.
''')

paths=[
 ('docs/nodia-ai/knowledge/nodia-ai/README.md','../../../mvp/'),
 ('docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md','../../../../mvp/'),
 ('docs/nodia-ai/knowledge/businesses/features/confirmed-business-effects.md','../../../../mvp/'),
]
for path,relative in paths:
    source=read(path)
    front,body=source[4:].split('\n---\n',1)
    meta=json.loads(front)
    assert meta['approval'] is None and meta['document_status']=='draft' and meta['integration_status']=='unregistered'
    meta['revision']+=1
    meta['implementation']['notes']+=' R06 verifica purga y copias/traslado de facturas con R2 e inspector reales y SQL desechable, incluido reemplazo PNG por PDF y conservación de factura al expirar el chat. Los gates técnicos de esos flujos cierran en laboratorio; publicación MCP/descarga nativa y aceptación productiva siguen separados.'
    meta['verification']['evidence_paths'].append('docs/evidence/nodia-ai-ai32-r06-validation.json')
    meta['verification']['notes']+=' R06:16 comprobaciones finales de purga,16 funcionales de facturas y cinco guardas offline. Fallos de fixture/teardown resueltos sin replay; diez objetos eliminados, cero cambios en BD operativa o aplicación e inferencias. Sin aprobación/publicación nueva.'
    body+='\n\n## Revalidación AI-32-R06\n\nPurga por generación y copias de factura verificadas con R2 real, casos de uso compilados y SQL desechable; la copia de factura sobrevive a la expiración del chat. Reemplazo con contenido distinto, traslado legacy, rollback y recuperación conservan sus contratos. No se equipara esta prueba con publicación MCP o aceptación productiva. [Entrega R06]('+relative+'78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) mantiene evidencia y límites. Ficha draft/unregistered y approval null conservados.\n'
    write(path,'---\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n---\n'+body)
print(json.dumps({'stage':'AI-32-R06','documents_updated':11,'approval_changed':False,'production_code_changed':False}))
