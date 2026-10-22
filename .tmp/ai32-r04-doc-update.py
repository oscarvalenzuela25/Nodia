from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]

def read(relative):
    return (root / relative).read_text(encoding='utf-8')

def write(relative, value):
    (root / relative).write_text(value, encoding='utf-8', newline='\n')

def evidence(suffix):
    return json.loads(read('docs/evidence/nodia-ai-ai32-r04-' + suffix + '.json'))

def seconds(suffix):
    report = evidence(suffix)
    assert report['status'] == 'passed'
    return ('%.2f' % report['probe']['elapsed_seconds']).replace('.', ',') + ' s'

health = evidence('final-health')
consolidated = evidence('validation')
assert health['status'] == 'passed'
assert consolidated['live']['generation_attempts'] == 12
assert all(item['native_acknowledged'] for item in consolidated['live']['attempts'])
assert evidence('current-mcp-image')['status'] == 'passed'
assert evidence('node-observation')['status'] == 'passed'
section = f'''

## Revalidación AI-32-R04 — clasificación explícita del audio Web

### Diferencial de archivos y transporte

El [análisis aislado](../evidence/nodia-ai-ai32-r04-audio-analysis.json) demuestra que las muestras históricas WebM y Ogg contienen los mismos 155 paquetes Opus, el mismo encabezado y exactamente el mismo PCM decodificado: 148.054 muestras, 48 kHz mono y 3,08445833 s. No están vacías, no hay clipping y sólo cambian contenedor y metadata. La comparación utiliza PyAV/libav del contenedor existente sin red, con raíz de sólo lectura, límites y archivos sintéticos; no reconoce voz ni habilita conversión en la ruta de ejecución. Su [script](../evidence/scripts/nodia-ai-ai32-r04-audio-analysis.py) y hashes están fijados. WAV conserva una codificación distinta; su correlación con Opus es una medición, no una exigencia de igualdad después de compresión con pérdida.

El SDK 2.1.1 ya subía el archivo con MIME en el multipart, pero enviaba a la generación el descriptor genérico `[[ref], nombre]`. El [PR179 histórico del repositorio del SDK](https://github.com/HanaokaYuzu/Gemini-API/pull/179) propone tipo de archivo y MIME explícitos; quedó cerrado sin merge y no certifica por sí solo soporte actual. Se probó únicamente esa diferencia para audio NodiaAI: `[[ref, 4, null, MIME], nombre]`. El valor4 pertenece al transporte observado, no a una capacidad inferida del modelo. Se conservan endpoint, referencia del upload, nombre privado, bytes, modelo, esfuerzo y prompt. No hay segunda subida, transcodificación, remux de entrada operativa, cambio de proveedor ni fallback.

El scope exige cliente y tarea exactos, hasta cuatro archivos y alineación de nombres/MIME/cardinalidad contra los adjuntos validados. Sólo transforma audio; OCR, texto, imágenes y PDF conservan el descriptor previo. Referencias opacas se preservan sin exigir un prefijo histórico como contrato futuro. Un shape inesperado falla antes del stream. La etiqueta privada de pruebas pasa a `nodia-ai-native-attachments/4`; selección/MIME/sesión y MCP siguen sus barreras. No hay contrato HTTP público, tablas, dependencias o configuración de modelos nuevos.

### Confirmación real y JSON de Ogg

Con la nueva imagen, las mismas muestras, modelo y configuración anteriores, [Ogg](../evidence/nodia-ai-ai32-r04-web-audio-ogg-es.json) pasó en {seconds('web-audio-ogg-es')} y [WebM](../evidence/nodia-ai-ai32-r04-web-audio-webm-es.json) en {seconds('web-audio-webm-es')}: respuesta y transcripción exactas, un upload cada una, proceso cerrado y ACK. Las tres huellas del texto elegido —campo decodificado de la respuesta antes de limpieza, salida de _parse_candidate y Candidate final— coinciden en57 bytes y JSON válido. El modelo no recibió el texto/hash esperado en el prompt. Se valida la adaptación y la aceptación de esos formatos en esta selección; el reinicio cambió la generación de sesión, por lo que esto no es un A/B aleatorio en una misma sesión ni demuestra la causa interna única de los errores remotos históricos.

El nuevo diagnóstico observa el campo elegido `primary/card/fallback` antes de _parse_candidate, con límite64 KiB, tamaño/SHA, tipo JSON y categorías sintácticas cerradas; se vincula privadamente al mismo rcid y sólo publica la candidata elegida. No retiene texto, URLs, IDs, frames ni archivos. La comparación distingue selección upstream, limpieza SDK y decodificación Candidate; desconocido o exceso de límite conserva null. No cambia la elección ni intenta una segunda decodificación o reparación del JSON.

Para reforzar la lectura semántica se generó [una frase nueva e impredecible](../evidence/nodia-ai-ai32-r04-fresh-synthetic-audio.json), sin números, con una voz SAPI española instalada, y fixtures WebM/Ogg distintos de los históricos. El [generador](../evidence/scripts/nodia-ai-ai32-r04-fresh-audio.py) usa síntesis/codificación offline; la expectativa queda en el oráculo y nunca entra al prompt del proveedor. [Ogg fresco](../evidence/nodia-ai-ai32-r04-web-audio-ogg-fresh.json) pasó en {seconds('web-audio-ogg-fresh')} y [WebM fresco](../evidence/nodia-ai-ai32-r04-web-audio-webm-fresh.json) en {seconds('web-audio-webm-fresh')}, en la misma sesión final, ambos con el hash de palabras esperado. No es una grabación de micrófono físico ni una promesa de precisión universal de ASR.

Ogg fresco incluye un objeto JSON completo de67 bytes más nueve bytes de presentación de cita nativa. Por eso su metadata de documento entero indica `json_parseable=false/extra_data` en posición67, con la misma huella antes/después del SDK. El parser estricto R01 ya admite exclusivamente esa cita canónica después de un objeto completo y validado: respuesta, schema, semántica y ACK pasaron. No es el JSON interior corrupto de R03 ni un parser nuevo permisivo. R03 permanece como fallo histórico sin atribuirle retrospectivamente una huella upstream que no se capturó. WebM fresco entrega un objeto íntegro sin ese sufijo.

### Matriz vigente y regresiones

La [salud final](../evidence/nodia-ai-ai32-r04-final-health.json) y la [observación Node compilada real](../evidence/nodia-ai-ai32-r04-node-observation.json) vinculan la disponibilidad a las selecciones y sesiones exactas, no al nombre del modelo. La observación Node es de sólo lectura, sin generaciones ni cambios SQL, y acepta los cinco MIME Web actuales. Estos son canarios privados del adaptador, independientes del circuito UI/R2/chat.

| Original | Web | Agentic |
|---|---|---|
| PNG | Verificado, {seconds('web-image')} | Verificado, {seconds('agentic-image')} |
| PDF | Verificado, {seconds('web-pdf')} | Verificado, {seconds('agentic-pdf')} |
| WAV PCM español | Verificado, {seconds('web-audio-wav-es')} | Sin prueba R04 |
| WebM Opus español | Verificado con dos frases | Verificado, {seconds('agentic-audio-webm-es')} |
| Ogg Opus español | Verificado con dos frases | Sin prueba R04 |

JPEG/WebP/MP3/M4A conservan desconocido. El [control Web de entidades](../evidence/nodia-ai-ai32-r04-web-text-entities.json) pasó en {seconds('web-text-entities')}: cuatro salidas habrían cambiado con html.unescape y la fuente/final permanecen idénticas. No hizo uploads ni adaptó metadata de audio. [Agentic archivo+MCP](../evidence/nodia-ai-ai32-r04-current-mcp-image.json) verifica PNG leído, hook, un callback sintético con nonce, respuesta exacta y ACK; no representa SQL de negocio ni una escritura. Web conserva su política conversacional sin MCP. No hubo timeouts en este ciclo, sin afirmar resuelta la causa de los históricos.

385 pruebas Linux correctas y385 ejecutadas Windows,383 correctas y dos omisiones históricas. Son24 regresiones nuevas sobre361 R03: metadata de audio por scope, petición real del SDK con HTTP sintético, multifile/alineación, cancelación, OCR intacto, selección previa al parser, alternativas/card, privacidad y límites. Los arneses pasan26 casos offline:16 nativos, cinco de texto y cinco MCP. No se reejecutaron Server/Client/SQL: su código y esquema no cambiaron; los resultados R02 siguen siendo antecedentes.

El [primer build Linux](../evidence/nodia-ai-ai32-r04-build-attempt01.json) falló en una expectativa nueva: el SDK Linux usa `audio/x-wav` en multipart y Windows `audio/wav`. Se corrigió sólo el test para admitir ambos alias existentes; el descriptor de generación exige `audio/wav` exacto según el inspector. Se preservan log/manifiesto/imagen del intento fallido, que no llegó a activarse ni a inferir. [Build final](../evidence/nodia-ai-ai32-r04-build.json) e [imagen activada](../evidence/nodia-ai-ai32-r04-gemini-activation.json) quedan ligados a las fuentes y suites finales.

### Cierre operativo y alcance

El [consolidado R04](../evidence/nodia-ai-ai32-r04-validation.json) registra12 solicitudes nativas de generación explícitas: siete canarios de archivos Web, tres Agentic, un control de texto y una prueba de archivo+MCP. Las12 terminaron y se acusaron; las inferencias internas del CLI no se cuentan como requests independientes del arnés; cero reintentos automáticos, resultados inciertos pendientes o efectos de negocio. Un único reinicio de runtime, después de las pruebas finales; los builds descartados no reiniciaron el servicio. Imagen212cffaeefdd…,92 fuentes idénticas y respaldo disponible. [Auditoría de /app](../evidence/nodia-ai-ai32-r04-app-layout.json): fuentes exactas y un archivo de configuración montado existente, sin leer sus bytes; ningún script operativo, sourcearchive ni .tmp incorporado. El build usa contexto fresco por hash, separado del archive y helpers.

API, worker, Gemini y nginx activos, HTTP200 y cero jobs/intentos/slots/marcadores inciertos/pruebas nativas/temporales abiertos. Credenciales, aislamiento y configuración conservados;970 archivos de paquete/905 dist,26 migraciones y19 tablas NodiaAI/267 columnas sin cambios. Servicios encendidos. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos y release6c4f conservados; fichas draft/unregistered y ADR-057 propuesto. No se aprueba ni publica ninguna herramienta por actualizar Markdown.

**WebM y Ogg Web cierran su aceptación técnica por formato en el laboratorio. AI-32 sigue abierto por R2 real sin configurar/sin PUT/GET/DELETE cloud, micrófono físico y aceptación productiva.** Las muestras sintéticas no cierran esos gates. Los timeouts históricos conservan causa exacta no demostrada y sus métricas permiten investigarlos si reaparecen. Integridad del árbol actual: `node docs/evidence/scripts/reconcile-nodia-ai-ai32-r04-validation.cjs --check`. Históricos AI-32/R01/R02/R03 preservados.
'''

relative = 'docs/mvp/78-nodia-ai-ai32-attachments-voice.md'
text = read(relative)
assert '## Revalidación AI-32-R04' not in text
text = text.replace('revalidaciones R01/R02/R03: 2026-10-18.', 'revalidaciones R01/R02/R03/R04: 2026-10-18.', 1)
lines = text.splitlines()
lines = ['> Estado técnico: R04 activado en laboratorio; WebM/Ogg Web transcriben dos frases sintéticas con metadata explícita de audio. Web verifica texto/PNG/PDF/WAV/WebM/Ogg; Agentic PNG/PDF/WebM y archivo+MCP. R2 real, micrófono físico y aceptación productiva pendientes. R04 contiene la evidencia vigente; secciones anteriores históricas.' if line.startswith('> Estado técnico:') else line for line in lines]
write(relative, '\n'.join(lines).rstrip() + section)

summary = '**AI-32-R04: WebM y Ogg Web verificados con Gemini real.** [Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) y [evidencia R04](../evidence/nodia-ai-ai32-r04-validation.json): descriptor de audio explícito en generación, conservando archivos/nombres/subida/modelo/prompt. WebM/Ogg contienen el mismo Opus/PCM; ambos transcribieron el archivo histórico y una frase nueva cuyo texto no entró al prompt. Huellas previas al parser, posteriores y Candidate elegida ligadas, sin guardar contenido ni reparar JSON. Web verifica cinco MIME; Agentic PNG/PDF/WebM y archivo+MCP revalidados.385 Python Linux,383 Windows+2 omisiones,26 casos de arnés;12 solicitudes nativas con ACK, cero replay y efectos.92 fuentes iguales a imagen activa; Node/cliente/esquema/dependencias intactos, servicios activos y cero pendientes. **Se cierran los dos pendientes de audio Web; AI-32 sigue abierto por R2 real, micrófono físico y aceptación productiva.** Sin atribución causal única a los timeouts históricos. Corpus/publicación6c4f conservados; fichas draft/ADR propuesto. Entradas siguientes históricas.'
relative = 'docs/mvp/README.md'
text = read(relative)
assert '**AI-32-R04:' not in text
write(relative, text.replace('## Cómo continuar\n\n', '## Cómo continuar\n\n' + summary + '\n\n', 1))
relative = 'docs/mvp/00-progress.md'
text = read(relative)
assert '**AI-32-R04:' not in text
index = text.index('\n') + 1
write(relative, text[:index] + '\n- 2026-10-18: ' + summary + '\n' + text[index:])
relative = 'docs/mvp/45-nodia-ai-implementation-plan.md'
text = read(relative)
anchor = '  - [R03](../evidence/nodia-ai-ai32-r03-validation.json):'
index = text.index('\n', text.index(anchor)) + 1
addition = '  - [R04](../evidence/nodia-ai-ai32-r04-validation.json): WebM/Ogg Web transcriben correctamente dos frases con metadata explícita de audio; bytes/nombres/modelo/prompt y upload existentes preservados. PNG/PDF/WAV, texto/entidades y Agentic PNG/PDF/WebM/archivo+MCP revalidados.385 Python Linux,383 Windows+2 omisiones,26 casos de arnés;12 solicitudes nativas con ACK y sin replay/efectos.92 fuentes idénticas; sin nuevos contratos públicos, tablas, dependencias ni cambios Node/cliente. WebM/Ogg cierran su gate técnico; R2 real, micrófono físico y aceptación productiva conservan la casilla abierta. Históricos y publicación6c4f conservados.\n'
assert addition not in text
write(relative, text[:index] + addition + text[index:])

def metadata(relative, update):
    text = read(relative)
    assert text.startswith('---\n')
    raw, body = text[4:].split('\n---\n', 1)
    value = json.loads(raw)
    assert value['document_status'] == 'draft' and value['approval'] is None
    assert value['integration_status'] == 'unregistered'
    value['revision'] += 1
    update(value)
    write(relative, '---\n' + json.dumps(value, ensure_ascii=False, indent=2) + '\n---\n' + body)

paths = ['docs/evidence/nodia-ai-ai32-r04-validation.json', 'docs/evidence/nodia-ai-ai32-r04-final-health.json', 'docs/evidence/nodia-ai-ai32-r04-audio-analysis.json', 'docs/evidence/nodia-ai-ai32-r04-fresh-synthetic-audio.json', 'docs/evidence/nodia-ai-ai32-r04-web-audio-ogg-fresh.json', 'docs/evidence/nodia-ai-ai32-r04-web-audio-webm-fresh.json']
def feature(value):
    value['implementation']['notes'] += ' R04 incorpora clasificación/MIME explícitos sólo para audio Web, sin cambiar archivos, uploads ni modelos; WebM/Ogg verificados con dos frases. Huellas previas/posteriores al parser observan selección exacta sin contenido; no reparan JSON. R2 real/micrófono físico pendientes.'
    value['verification']['evidence_paths'].extend(paths)
    value['verification']['notes'] = 'R04:385 Python Linux correctas,383 Windows+2 omisiones,26 casos de arnés.12 solicitudes nativas con ACK y sin replay/efectos. Web PNG/PDF/WAV/WebM/Ogg, dos frases para formatos Opus; Agentic PNG/PDF/WebM/archivo+MCP. Node compilado acepta cinco MIME Web. Sin micrófono físico/R2 real ni publicación nueva. Timeouts históricos sin atribución causal única; resultados R02 SQL/Server/Client son antecedentes.'
metadata('docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', feature)
relative = 'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md'
write(relative, read(relative).rstrip() + '\n\nR04 verifica WebM y Ogg originales en Web con dos frases sintéticas distintas, mediante tipo de audio/MIME explícitos en generación y sin convertir archivos o cambiar modelo. La evidencia sigue ligada al formato/selección/sesión; cinco MIME Web actuales, no soporte universal por categoría. R03/R02 conservan sus fallos históricos. Las notas WebM de MediaRecorder ya tienen evidencia nativa Web de formato; grabar con micrófono físico y el circuito R2/UI siguen pendientes. Un objeto completo con cita nativa canónica conserva la normalización R01, sin reparación de JSON. [Evidencia vigente R04](../../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web). No hay nuevas herramientas ni aprobación automática.\n')
def product(value):
    value['implementation']['notes'] += ' R04 cierra aceptación técnica WebM/Ogg Web con dos frases y metadata explícita de audio; conserva PNG/PDF/WAV y Agentic/MCP. Sin conversión de originales, nuevos contratos/tablas o publicación. R2 real/micrófono físico y aceptación productiva siguen abiertos.'
    value['verification']['evidence_paths'].extend(paths[:2])
metadata('docs/nodia-ai/knowledge/nodia-ai/README.md', product)

relative = 'docs/nodia-ai/knowledge/README.md'
write(relative, read(relative).rstrip() + '\n\nAI-32-R04 verifica WebM/Ogg Web con dos frases, metadata explícita de audio y originales intactos; conserva PNG/PDF/WAV, Agentic PNG/PDF/WebM y archivo+MCP. [Entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) cierra esos gates de formato, con R2 real/micrófono físico/aceptación productiva pendientes.55 fichas/28 excluidas y67 lecturas/27 fragmentos publicados conservados; cambios sólo en borradores propios, sin aprobación ni publicación de herramientas.\n')
relative = 'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md'
write(relative, read(relative).rstrip() + '\n\n## Precisión de audio Web R04 — 2026-10-18\n\nEl descriptor de generación identifica explícitamente audio y MIME, a partir del adjunto validado, sin cambiar bytes, nombre, referencia o upload del SDK. Scope por cliente/tarea, cardinalidad y alineación exactas; OCR/imagen/PDF/texto conservan ruta. La metadata nace de un protocolo propuesto en el PR179 histórico, cerrado sin merge; la aceptación depende de canarios actuales, no de esa propuesta. Versión privada de prueba /4, sin contrato público o tabla nueva. Diagnóstico previo al parser ligado a candidata elegida distingue fuente/limpieza/Candidate sin texto ni reparación. [R04 de entrega78](../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) registra dos frases WebM/Ogg correctas, límites, regresiones y pendientes. El ADR continúa propuesto.\n')
relative = 'nodia-gemini-microservice/README.md'
write(relative, read(relative).rstrip() + '\n\nAI-32-R04: NodiaAI añade tipo de audio/MIME explícitos al descriptor de generación de los archivos ya subidos, sin repetir upload ni cambiar bytes/nombres/modelo. Scope por cliente/tarea, cardinalidad/alineación exactas y fallo cerrado ante shape inesperado; OCR/imagen/PDF/texto conservados. Prueba privada /4 obliga revalidar por MIME/selección/sesión. Captura previa al parser sólo de huellas/sintaxis acotadas por candidata elegida, sin contenido. WebM/Ogg pasaron dos frases con Gemini real; WAV/PNG/PDF y Agentic/MCP conservados. [R04 de entrega78](../docs/mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r04--clasificación-explícita-del-audio-web) distingue estos canarios de R2/micrófono físico y aceptación productiva aún pendientes.\n')
print('R04 documentation updated; documentary approvals preserved.')
