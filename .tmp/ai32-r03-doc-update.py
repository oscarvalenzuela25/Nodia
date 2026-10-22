from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]

def read(relative):
    return (root / relative).read_text(encoding='utf-8')

def write(relative, text):
    (root / relative).write_text(text, encoding='utf-8', newline='\n')

heading = '## Revalidación AI-32-R03 — entidades HTML y diagnóstico por fase'
section = '''

## Revalidación AI-32-R03 — entidades HTML y diagnóstico por fase

### Defecto reproducible y corrección acotada

El SDK instalado gemini-webapi2.1.1 aplica html.unescape en el validador de Candidate. Las pruebas con su parser, Candidate y stream reales, usando HTTP sintético, demuestran que un JSON válido que contiene entidades literales como &quot; o &#10; puede convertirse en JSON inválido: introduce comillas sin escape o saltos de línea dentro del string. Este defecto es reproducible; no acredita por sí solo la causa de los fallos históricos AI-32/R01/R02, que no guardaron la huella anterior a Candidate.

NodiaAI Web solicita explícitamente preservar texto estructurado. Un scope por cliente y tarea de generación protege los ampersands antes del validador para que su única decodificación conserve exactamente el texto entregado por _parse_candidate. La comparación de tamaño/SHA256 vincula cada candidata elegida y el resultado final a su origen; read_chat recuperado pasa por la misma barrera. Identidades de candidatas sólo viven en memoria acotada y se eliminan al salir/cancelar. Una discrepancia o candidata sin origen falla cerrada. OCR no solicita este scope y conserva su semántica. No se reparan campos JSON, no se acepta una candidata anterior y no se pide otra inferencia. La limpieza ARTIFACTS_RE previa del SDK permanece: esta garantía no equivale a preservar todos los bytes originales de red.

El [control real de entidades](../evidence/nodia-ai-ai32-r03-web-text-entities.json) pasó en4,23s con nonce impredecible y comparación exacta. Hubo12 salidas de candidata, siete salidas que la decodificación anterior habría cambiado y21 ampersands protegidos acumulados. La última fuente/salida tienen97 bytes y el mismo SHA256, ambas JSON parseable. No se almacenó el texto. Esto demuestra la corrección entre parser SDK y Candidate en una inferencia real; no es una prueba de ningún formato de archivo.

### Subida, stream y JSON inválido restante

Se observa el post de subida existente del SDK mediante su API pública: estado HTTP, duración y forma mínima de la referencia como booleano/longitud, sin copiar nombres, URLs ni identificadores. El wrapper conserva respuesta, excepción y cancelación; no añade peticiones. El stream añade tiempos de primer/último chunk, intervalo máximo y EOF. Un chunk no se interpreta como frame, progreso de pensamiento ni estado de cola. Registros/eventos son acotados; datos ausentes conservan null. La instrumentación no guarda archivos, respuestas, rutas, credenciales ni contenido de chunks.

En las cinco pruebas de archivos Web R03 las subidas completaron HTTP200 en656–889ms con una referencia no vacía de la forma observada. El control de texto no hizo ninguna subida. Las seis generaciones Web terminaron entre4,23 y12,28s, con EOF; no se reprodujo timeout. Esto descarta un bloqueo de subida en estas pruebas y distingue recepción de respuesta de aceptación semántica. No demuestra que la corrección de entidades resuelva los timeouts históricos ni que una referencia de upload confirme procesamiento del archivo por el proveedor.

[WebM](../evidence/nodia-ai-ai32-r03-web-audio-webm-es.json) completó en8,77s con JSON válido, pero la respuesta no coincide con la frase española del audio. No se habilita ese MIME. [Ogg](../evidence/nodia-ai-ai32-r03-web-audio-ogg-es.json) completó upstream con EOF y18 salidas de candidata; la validación falló en12,28s, comma_delimiter en posición362. Los1666 bytes ya eran JSON inválido a la salida de _parse_candidate y permanecen idénticos después de Candidate, con el mismo SHA256 y cero salidas que html.unescape habría cambiado. La corrección de entidades no introduce ese defecto. La evidencia no distingue todavía respuesta original del proveedor de la limpieza previa del parser SDK; no se afirma una causa de red/modelo/formato que no se haya observado. Resultado desconocido conciliado y ACK, sin replay ni recuperación permisiva de JSON.

### Selección vigente y aceptación

La [salud final R03](../evidence/nodia-ai-ai32-r03-final-health.json) vincula la siguiente matriz a las selecciones exactas del proceso final; reiniciar, cambiar sesión/modelo/esfuerzo/configuración invalida las pruebas. No se cambia de proveedor, modelo o modo para superar un fallo.

| Formato original | Web | Agentic |
|---|---|---|
| PNG | Verificado,7,49s | Verificado,17,57s |
| PDF | Verificado,7,05s | Verificado,25,63s |
| WAV PCM español | Verificado,7,55s | Sin prueba R03 |
| WebM Opus español | Respuesta válida, contenido esperado no acreditado | Verificado,26,93s |
| Ogg Opus español | JSON inválido antes de Candidate; desconocido | Sin prueba R03 |

Estas pruebas privadas del adaptador usan archivos sintéticos; no equivalen al circuito completo de carga UI/R2/chat. JPEG/WebP/MP3/M4A permanecen desconocidos. La voz de las muestras es SAPI sintética instalada; no se atribuye prueba de micrófono físico. Web sigue conversacional sin MCP. La prueba [Agentic archivo+MCP](../evidence/nodia-ai-ai32-r03-current-mcp-image.json) requiere PNG leído, hook, callback sintético con nonce, respuesta exacta y ACK: no es SQL de negocio ni una escritura. Cada formato tiene una prueba propia, sin prestar evidencia WAV a WebM ni PNG a JPEG. WAV no habilita las notas WebM de MediaRecorder en Web. El traslado legacy SQL R02 conserva su cierre previo y no se repitió en este ciclo.

### Verificación y cierre operativo R03

361 pruebas Linux correctas con red deshabilitada y361 ejecutadas Windows:359 correctas y dos omisiones históricas. Son20 regresiones nuevas sobre341 R02; cubren entidades/nested, SDK real con HTTP sintético, JSON inválido, OCR sin scope, recuperación, elección final, aislamiento, upload y cancelación. Windows conserva un RuntimeWarning de AsyncMock no esperado durante la suite, sin fallos; no se oculta ni se atribuye a una incidencia real del perfil. Los arneses nuevos comprobaron11 casos nativos, cinco de texto y cinco MCP offline. Las suites Node/Client y SQL R02 son antecedentes, no ejecuciones nuevas de R03: no hubo cambios de código Node/cliente, esquema ni dependencias en este ciclo.

[Build](../evidence/nodia-ai-ai32-r03-build.json), [activación](../evidence/nodia-ai-ai32-r03-gemini-activation.json) y [manifiesto](../evidence/nodia-ai-ai32-r03-native-manifest.json): imagen c67438e96221…,88 fuentes idénticas, respaldo disponible y credenciales/mounts/red/caps/cgroups preservados. La etiqueta privada de prueba de adjuntos pasa a nodia-ai-native-attachments/3 para invalidar resultados anteriores a la semántica de texto preservado; chat/1 y contrato MCP permanecen intactos. Todos los canarios vigentes se ejecutaron después del único reinicio de este ciclo.

El [consolidado R03](../evidence/nodia-ai-ai32-r03-validation.json) fija fuentes, compilado, artefactos, scripts y logs. Cuenta10 generaciones explícitas: ocho canarios de archivos, un control de texto y uno de archivo+MCP. Ogg es el único resultado desconocido de este ciclo, conciliado y ACK; WebM es una respuesta completada sin aprobación semántica. Cero reintentos automáticos y cero efectos de negocio. API, worker, Gemini y nginx activos, HTTP200 y cero jobs/intentos/slots/resultados inciertos/pruebas nativas/temporales abiertos. Conservados970 archivos de paquete/905 dist,26 migraciones y19 tablas NodiaAI/267 columnas. Los servicios quedan encendidos.

AI-32 permanece abierto por WebM/Ogg Web sin aceptación, R2 sin configurar/sin PUT/GET/DELETE cloud real, micrófono físico y aceptación productiva. No se amplía el timeout de120s, no se transcodifica ni se inventa una transcripción. Para localizar un timeout futuro quedan métricas de upload y cadencia; su causa histórica sigue indeterminada. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos y release6c4f conservados. Fichas draft/unregistered y ADR-057 propuesto, sin aprobar ni publicar herramientas por documentarlas.

Reproducción de integridad del árbol actual: `node docs/evidence/scripts/reconcile-nodia-ai-ai32-r03-validation.cjs --check`. Los consolidadores anteriores verifican sus snapshots históricos; no se modifican para aceptar estas fuentes nuevas.
'''

relative = 'docs/mvp/78-nodia-ai-ai32-attachments-voice.md'
text = read(relative)
assert heading not in text
text = text.replace('revalidaciones R01/R02: 2026-10-18.', 'revalidaciones R01/R02/R03: 2026-10-18.', 1)
old = '> Estado técnico: R02 activado en laboratorio privado, traslado legacy implementado y evidencia por MIME exacto. Sesión final: Web texto/WAV; Agentic PNG/PDF/WebM y archivo+MCP. Otros formatos Web, R2 real y micrófono físico pendientes. La sección R02 contiene la evidencia vigente; R01 e inicial conservan su alcance histórico.'
new = '> Estado técnico: R03 activado en laboratorio privado, preservación de entidades HTML verificada con Gemini real y métricas de upload/stream. Web texto/PNG/PDF/WAV y Agentic PNG/PDF/WebM/archivo+MCP verificados. WebM/Ogg Web, R2 real y micrófono físico pendientes. La sección R03 contiene la evidencia vigente; las anteriores conservan su alcance histórico.'
assert old in text
write(relative, text.replace(old, new, 1).rstrip() + section)

summary = '**AI-32-R03: preservación de JSON Web verificada y diagnóstico por fase.** [Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase) y [evidencia R03](../evidence/nodia-ai-ai32-r03-validation.json): defecto reproducible en html.unescape del SDK corregido sólo para NodiaAI; control real conserva entidades y hashes exactos, OCR intacto. Seis turnos Web sin timeout, subidas HTTP200 menores a0,9s: PNG/PDF/WAV y texto verificados; WebM responde sin acreditar transcripción y Ogg ya entrega JSON inválido antes de Candidate, conciliado sin replay. La causa de los timeouts históricos y del texto Ogg previo a limpieza SDK sigue sin determinar. Agentic PNG/PDF/WebM y archivo+MCP sintético revalidados. Linux361 correctas, Windows359+2 omisiones;88 fuentes idénticas y cuatro servicios activos/cero pendientes. Sin cambios Node/cliente/esquema/dependencias ni publicación nueva. **AI-32 continúa abierto por WebM/Ogg Web, R2 real y micrófono físico.** Fichas draft/ADR propuesto; entradas anteriores históricas.'
relative = 'docs/mvp/README.md'
text = read(relative)
assert '**AI-32-R03:' not in text
write(relative, text.replace('## Cómo continuar\n\n', '## Cómo continuar\n\n' + summary + '\n\n', 1))
relative = 'docs/mvp/00-progress.md'
text = read(relative)
assert '**AI-32-R03:' not in text
index = text.index('\n') + 1
write(relative, text[:index] + '\n- 2026-10-18: ' + summary + '\n' + text[index:])
relative = 'docs/mvp/45-nodia-ai-implementation-plan.md'
text = read(relative)
anchor = '  - [R02](../evidence/nodia-ai-ai32-r02-validation.json):'
index = text.index('\n', text.index(anchor)) + 1
addition = '  - [R03](../evidence/nodia-ai-ai32-r03-validation.json): preservación acotada de entidades HTML antes de Candidate y comparación exacta pre/post, con control Gemini real. Web PNG/PDF/WAV y texto actuales verificados; seis generaciones sin timeout no acreditan causa de los históricos. WebM responde JSON válido sin transcripción correcta; Ogg llega inválido a Candidate y conserva rechazo/conciliación. Agentic PNG/PDF/WebM/archivo+MCP revalidados.361 Python Linux,359+2 omitidas Windows,88 fuentes iguales a imagen activa; Node/cliente/SQL R02 no se reejecutaron. R2 real/micrófono físico y formatos Web pendientes mantienen casilla abierta; sin nueva publicación.\n'
assert addition not in text
write(relative, text[:index] + addition + text[index:])

def metadata(relative, update):
    text = read(relative)
    assert text.startswith('---\n')
    raw, body = text[4:].split('\n---\n', 1)
    value = json.loads(raw)
    assert value['document_status'] == 'draft' and value['approval'] is None
    value['revision'] += 1
    update(value)
    write(relative, '---\n' + json.dumps(value, ensure_ascii=False, indent=2) + '\n---\n' + body)

paths = ['docs/evidence/nodia-ai-ai32-r03-validation.json', 'docs/evidence/nodia-ai-ai32-r03-final-health.json', 'docs/evidence/nodia-ai-ai32-r03-web-text-entities.json', 'docs/evidence/nodia-ai-ai32-r03-web-audio-ogg-es.json']
def feature(value):
    value['implementation']['notes'] += ' R03 preserva entidades HTML entre parser SDK y Candidate sólo en NodiaAI Web y observa upload/cadencia sin contenido; JSON ya inválido a la salida del parser sigue rechazado.'
    value['verification']['evidence_paths'].extend(paths)
    value['verification']['notes'] = 'R03:361 Python Linux correctas,359+2 omisiones Windows. Control real de entidades verifica bytes/SHA; Web PNG/PDF/WAV y Agentic PNG/PDF/WebM/archivo+MCP comprobados en selección/sesión exactas. Seis Web sin timeout; WebM semántica no acreditada y Ogg inválido antes de Candidate. Timeouts históricos no atribuidos al fix. Node/Client/SQL R02 son antecedentes; R2 real y micrófono físico pendientes.'
metadata('docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', feature)
relative = 'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md'
write(relative, read(relative).rstrip() + '\n\nR03: el transporte Web conserva literalmente entidades HTML dentro del JSON que entrega el parser SDK; esto no repara una respuesta malformada. El control Gemini real prueba la adaptación, y PNG/PDF/WAV pasan en la sesión vigente. WebM no acredita la frase esperada; Ogg ya es JSON inválido antes de Candidate. No hubo timeout en las seis pruebas Web de este ciclo, sin determinar la causa histórica. La disponibilidad exacta y gates se consultan en [R03 de entrega78](../../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase); no se habilitan originales por modificar esta ficha.\n')
def product(value):
    value['implementation']['notes'] += ' R03 verifica preservación de entidades HTML en Web; PNG/PDF/WAV actuales comprobados, WebM/Ogg Web pendientes. Métricas de upload/stream sin contenido; sin nueva publicación.'
    value['verification']['evidence_paths'].extend(paths[:2])
metadata('docs/nodia-ai/knowledge/nodia-ai/README.md', product)

relative = 'docs/nodia-ai/knowledge/README.md'
write(relative, read(relative).rstrip() + '\n\nAI-32-R03 conserva55 fichas/28 excluidas y67 lecturas/27 fragmentos publicados. Actualiza sólo borradores propios: preservación de entidades Web y diagnóstico por fase, verificados en [entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase). Web PNG/PDF/WAV y Agentic PNG/PDF/WebM comprobados; WebM/Ogg Web, R2 real y micrófono físico pendientes. No aprueba documentos ni publica herramientas.\n')
relative = 'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md'
write(relative, read(relative).rstrip() + '\n\n## Precisión de transporte R03 — 2026-10-18\n\nSólo el turno estructurado NodiaAI Web compensa la decodificación HTML de Candidate mediante un scope por cliente/tarea y verifica huellas pre/post de la candidata elegida y resultado final. OCR conserva comportamiento previo. La garantía comienza después de _parse_candidate y su limpieza de artefactos; no repara JSON ni acredita el origen del texto ya inválido. La etiqueta privada de prueba pasa a /3; selección/MIME/sesión exactos y MCP conservan sus barreras. Upload y cadencia se observan sin contenido ni peticiones adicionales. Evidencia y gates en [R03 de entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase); estado propuesto conservado.\n')
relative = 'nodia-gemini-microservice/README.md'
write(relative, read(relative).rstrip() + '\n\nRevalidación AI-32-R03: sólo NodiaAI Web solicita preservación literal de entidades HTML antes de Candidate, con verificación de huellas por cliente/tarea y resultado final; OCR conserva la semántica del SDK. No repara JSON. Upload/cadencia se observan sin contenido, IDs ni peticiones extra. La prueba privada de adjuntos usa /3; exige revalidar MIME/selección/sesión tras reiniciar. [R03 de entrega78](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r03--entidades-html-y-diagnóstico-por-fase) conserva resultados y límites vigentes, sin atribuir los timeouts históricos a una causa no observada.\n')
print('R03 documentation updated; documentary approvals preserved.')
