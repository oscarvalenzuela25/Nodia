# NodiaAI AI-32 — adjuntos y notas de voz

> Estado documental: en revisión; sin aprobación automática.
> Fecha inicial: 2026-10-17; revalidaciones R01/R02/R03/R04/R05/R06/R07: 2026-10-18.
> Estado técnico: R07 cierra AI-32 en laboratorio tras completar lifecycle del inspector y PUT posterior a expiración con limpieza en otro proceso. R04/R05/R06 conservan formatos, app/micrófono y purga/copias R2. Sin cambios de aplicación ni inferencias en R07; aceptación productiva/publicación mantienen sus etapas propias. La revisión documental no se aprueba automáticamente.

[Plan45](45-nodia-ai-implementation-plan.md) · [Contratos41](41-nodia-ai-v1-contracts.md) · [Política50](50-nodia-ai-ai04-runtime-policy.md) · [ADR-057](../architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md) · [Ficha](../nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md).

## Contrato y persistencia

POST /nodia-ai/attachments crea intención JSON cerrada antes de PUT /:id/content application/octet-stream. Campos: conversation_id, client_request_id(UUID), kind(image/pdf/audio), byte_count y file_name. Devuelve metadata y método/path/plazo de carga, nunca key o URL R2. La identidad repetida recupera el resultado; cambiar su solicitud produce conflicto.

GET /capabilities?conversation_id observa modalidades comprobadas para la selección actual: true o null(desconocido), junto con límites propios de Nodia. GET /:id metadata; GET /:id/content descarga autenticada por intención; PATCH /:id/interpretation exige text y expected_revision; DELETE /:id descarta sólo si no se vinculó a un mensaje. La interpretación vinculada queda inmutable. Las partes de historial tienen kind/attachment_id/text(string|null), sin binarios incrustados.

M3 añade nodia_ai_attachments, attachment_id en message_parts y permite text null para lectura nativa sin transcripción inventada. FK compuesta garantiza mismo chat y cascada transaccional. La tabla guarda identidad/idempotencia/generación, reserva, metadata real, interpretación/revisión y ventanas del upload. Jobs existentes retienen sólo identidad mínima de limpieza tras purgar chat; no hay tablas por formato, transcripción o cache de disponibilidad.

## Admisión y ejecución

Los mensajes referencian IDs privados del mismo chat, máximo cuatro/40 MiB. Se comprueban autoridad e interpretación antes y después de observar al proveedor. Texto revisado entra como datos; un original sin revisar exige evidencia de modalidad y selección exactas. El worker vuelve a observar antes de cargarlo. Storage I/O permanece fuera de SQL, antes de armar inferencia y seguido de checkpoint de autoridad/configuración.

El transporte privado verifica SHA/tipo/base64 canónico y usa archivos temporales generados. Los originales sólo se envían en el turno donde se adjuntan; el historial conserva referencias y respuestas. Si se necesita releerlos, pedir adjuntarlos en el nuevo turno. Una delegación exige soporte Agentic de los archivos; no se omiten silenciosamente ni se convierten sin aviso. API conserva su etapa posterior.

## Límites y conservación

Política50:20 MiB por archivo, cuatro/40 MiB por mensaje,300 segundos de audio realmente decodificado,100 páginas PDF y12 millones de píxeles. No son cuotas del proveedor. El inspector privado usa proceso Linux aislado sin red/exec,15 segundos/256 MiB, y devuelve metadata comprobada. PDF puede entregar extracción real pendiente de revisión; vacío o más de32 KiB deja null, sin truncar silenciosamente. No se promete OCR/ASR no comprobado.

Las cuotas cubren originales, reservas, derivados, texto persistido y limpiezas huérfanas sin ACK. Cada run activo reserva además el máximo de32 KiB para su respuesta; el guard de persistencia sustituye esa reserva por bytes reales bajo el mismo lock de reservas, evitando que una subida simultánea consuma su espacio. El janitor cerca estado antes de DELETE, respeta la ventana del PUT, reintenta DELETE idempotente con límite y conserva la identidad incierta. Chat, adjuntos e interpretaciones expiran juntos a90 días del último mensaje del dueño; preferencias y registros de negocio son independientes.24 horas es objetivo de limpieza física, no garantía de R2 ni archivo adicional.

## Interfaz

Carga por intención y grabación local con permiso explícito. Tracks cerrados al detener/revocar/desmontar; tamaño/duración acotados, borrador por chat y consulta de identidad antes de repetir subidas inciertas. Revisión conservada ante errores, sileo ES/EN y descarga privada sin N+1. Modalidad desconocida ofrece texto revisado, sin inventar transcripción. QA sintético y micrófono real se distinguen.

## Facturas

La preparación interna admite attachment_id de imagen/PDF del mismo chat y conserva el límite nativo de10 MiB de facturas. Congela nombre, tipo, bytes y digest en la propuesta exacta; sólo el botón humano permite iniciar la copia. El worker crea intención invoice_uploads y key de dominio por paso/fence antes de PUT, copia fuera de SQL y revalida autoridad/lease/cancelación/precondiciones. La asociación a factura, consumo de intención y recibo se confirman en la misma transacción. Resultado incierto no repite PUT: la recuperación demuestra ausencia/presencia de recibo y un resume humano utiliza otra generación. El plazo externo se acota al paso y lease restantes; no mantiene una transacción abierta durante la copia. Archivo sustituido usa recuperación nativa independiente.

Crear/editar con adjunto nuevo y purga posterior del chat se verifican con SQL real y almacenamiento sintético. Trasladar un archivo legacy sin escoger nuevo adjunto sigue pendiente; esta entrega no lo presenta como paridad completa de archivos. Preparadores de escritura MCP y aceptación R2 conservan gates independientes de AI-22.

## Proveedor y límites operativos — snapshot AI-32 original

El parser comparte dos slots de20 MiB; materialización nativa reserva globalmente40 MiB antes de decodificar, incluso entre Web y Agentic, y libera ante error/cancelación. Así las entradas previstas caben en el tmpfs de96 MiB sin sumar dos turnos completos por perfil. No se deduce soporte del nombre del modelo. El catálogo MCP pasa de72 a74 descriptores por los dos helpers de informes AI-31; pruebas de transporte mantienen todos y rechazan75 sin truncar.

[Pruebas nativas finales](../evidence/nodia-ai-ai32-native-validation.json), [históricas del ciclo previo](../evidence/nodia-ai-ai32-native-intermediate-02.json), [MCP real](../evidence/nodia-ai-ai32-mcp-validation.json) y [limpieza](../evidence/nodia-ai-ai32-native-cleanup.json): Web leyó PNG y PDF semánticamente antes de reiniciar. Después del último reinicio, una nueva imagen recibió HTTP200 upstream/EOF, pero el objeto de respuesta de51 bytes no era JSON válido; terminó desconocido, conciliado y ACK, sin replay. No se pudo atribuir una causa a formato/SDK sin conservar contenido. Esos éxitos anteriores no habilitan la sesión actual. Audio completó con hash de contenido distinto; lectura de archivos Agentic quedó desconocida. No hay evidencia vigente para ningún original ni file+MCP. No se inventa transcripción.

Tras el reinicio se comprobó Agentic MCP real con nonce impredecible, un callback de lectura sintético y ACK; supports_mcp=true en selección exacta. Un primer harness falló por esperar sequence en vez de seq; recuperó y cerró el mismo intento sin reejecutarlo. La segunda prueba diagnóstica, con script corregido, pasó. Ocho solicitudes de generación en total entre ciclos, fallos y diagnósticos conservados por separado; cero efectos de negocio y cero identidades nativas/temporales pendientes. Health200 no se usa como prueba de inferencia.

## Verificación y pendientes — snapshot AI-32 original

Implementación y SQL de adjuntos/promoción comprobados; paquete final activado con respaldo y M3 aplicada. AI-32 conserva abierta la aceptación nativa de archivos y R2 real. Datos sintéticos no prueban inferencia ni almacenamiento cloud; la grabación real del micrófono no se efectuó.

El schema concreto de coordinación es[attachment-contract.schema.json](../../nodia-server/src/nodia-ai-attachment/config/attachment-contract.schema.json). Materializa la intención JSON+PUT que sustituye el multipart propuesto originalmente en el inventario; los contratos conceptuales comunes de AI-01 no habilitan rutas. [API de coordinación](nodia-ai-v1-coordination-api.json), DTOs y validadores de cliente siguen la forma concreta de AI-32, sin modificar hashes de los67 contratos de lectura publicados.


[SQL final](../evidence/nodia-ai-ai32-sql-validation.json):285 comprobaciones en seis suites sobre PostgreSQL desechable, incluyendo58 de adjuntos/admisión y44 de copias a factura, además de regresiones AI-14/16/22/31. Almacenamiento/inspector/proveedor son puertos sintéticos en estas suites. Se conserva un fallo inicial del wrapper de evidencia: --input-type=module se heredó en fork y se corrigió sólo el runner, sin alterar producción ni ocultar el intento. Todos los contenedores propios fueron retirados.

Suites finales: Server3.314/210 archivos y Client1.687/217, sin fallos. La revisión independiente detectó y corrigió propagación de AbortSignal a la descarga privada;36 casos focales comprueban abort antes/durante/después y ausencia de inferencia. Tipado, lint y builds correctos; lint Server conserva tres advertencias históricas. Python Linux313 correctos y Windows313 ejecutados(311 correctos, dos skips históricos). El [inspector de la imagen final](../evidence/nodia-ai-ai32-parser-validation.json) pasó11 comprobaciones reales con red deshabilitada, límites y seccomp, sin inferencia.

[Activación](../evidence/nodia-ai-ai32-lab-activation.json) y[salud final](../evidence/nodia-ai-ai32-final-health.json): respaldo284.692 bytes y migración1792800000000, una tabla/25 columnas más referencia de mensaje;26 migraciones,19 tablas NodiaAI/267 columnas.970 archivos de paquete/905 dist iguales al artefacto de seis suites. API/worker/Gemini/nginx activos, API/Gemini/Client5174/túnel3100 HTTP200 y cero trabajos/intentos/slots pendientes. La activación de Server conservó imagen/sesiones Gemini y configuración; Gemini se actualizó antes para el inspector y transporte, con[su evidencia independiente](../evidence/nodia-ai-ai32-gemini-activation.json). Temporales Node usan PrivateTmp verificado de las unidades API/worker; el inspector usa tmpfs. La configuración R2 está ausente: no se acredita upload/download/delete cloud real y no se agregaron credenciales.

[QA de interfaz](../evidence/nodia-ai-ai32-ui-validation.json): origen aislado con datos sintéticos, ES oscuro/EN claro, seis anchos, fallos/reintento y borrador conservado, aceptación e historial por intención. No hubo permiso de micrófono real ni operación de dominio desde esa UI. Panel y schema se cargan por intención(8,45/2,01kB raw en el build final); sin comparación de performance. Servidor QA5196 y pestaña temporal cerrados; servicios de la app permanecen encendidos.

[Delta de conocimiento](../evidence/nodia-ai-ai32-knowledge-delta.json):55 fuentes/28 excluidas,27 fragmentos y67 lecturas publicadas conservados. Se añade un borrador y se actualiza únicamente la procedencia del adaptador en dos fichas aprobadas; el contenido aprobado y contratos de lectura permanecen intactos. La verificación deshace estos cambios y reproduce el release9e57 anterior. No se aprueban fichas/ADR por implementar. Las escrituras MCP conservan su gate de publicación.

AI-32 permanece abierto por R2 real y modalidades nativas vigentes, además de grabación física/aceptación productiva. No atribuir el fallo actual a timeout: el[diagnóstico seguro](../evidence/nodia-ai-ai32-native-diagnostics.json) acredita EOF/HTTP200 y JSONDecodeError, sin conservar contenido. La causa exacta de esa respuesta inválida no se determinó. La revalidación posterior deberá ser explícita y nunca reenviar un intento incierto.

Evidencia original: [consolidado AI-32](../evidence/nodia-ai-ai32-validation.json), con hashes de fuentes, logs, compilado y pruebas separados. Su validador corresponde a las fuentes de ese snapshot; no se reescribe para aceptar cambios posteriores. Para el árbol actual y las sesiones R01 se usa el consolidador R01 indicado al final.


## Revalidación AI-32-R01 — 2026-10-18

La evidencia original de AI-32 permanece como snapshot histórico. La [revalidación R01](../evidence/nodia-ai-ai32-r01-validation.json) distingue cada intento, selección, imagen y sesión; los reinicios invalidan las pruebas en memoria. Ninguna inferencia incierta se reenvía. Cada canario nuevo es una prueba explícita con su propio intento, conciliación y ACK; usa archivos sintéticos y no escribe registros de negocio.

### Causa reproducida de JSON y adaptación Web

Los dos primeros canarios de diagnóstico devolvieron JSON válido. Más adelante, [un WAV](../evidence/nodia-ai-ai32-r01-web-audio-wav-before-citation.json) reprodujo JSONDecodeError Extra data: HTTP200/EOF, objeto válido de 57 caracteres y el sufijo nativo de nueve caracteres `[cite: 1]`. La reconstrucción desde el texto sintético conocido coincide exactamente con el SHA256 del documento rechazado. No se recuperó ni almacenó la respuesta cruda. Esto demuestra la causa de esta reproducción; el fallo original de51 bytes conserva causa exacta indeterminada.

El parser Web ahora delimita el JSON con JSONDecoder, conserva el rechazo de claves duplicadas, constantes no finitas, schema incorrecto, varios objetos y basura, y permite únicamente un sufijo canónico de citas `[cite: N]`: hasta 32 marcadores/512 bytes e IDs ASCII de 1 a 10 dígitos. Es normalización local de presentación del proveedor, como el fence completo ya admitido; no modifica campos, no reconstruye JSON truncado y no solicita otra inferencia. Citas dentro de text conservan su contenido. Agentic conserva parsing JSON estricto sin esta excepción. El diagnóstico registra categoría/posición/hash/tipos léxicos, nunca contenido, rutas o secretos. El [SDK instalado](https://github.com/HanaokaYuzu/Gemini-API/blob/master/src/gemini_webapi/types/citation.py) documenta estos marcadores como presentación de citas; no se interpretan como herramientas ni se siguen sus enlaces.

### Lector Agentic y audio WebM

La primera lectura Agentic del ciclo falló por intentar una herramienta fuera del contrato; quedó desconocida, conciliada y ACK. Se limita el lector temporal a view_file/finish mediante un agente propio de la ejecución, conservando modelo/esfuerzo exactos, hook independiente, grants por ruta y denegación de otras operaciones. Cada archivo exige un evento view_file DONE sin error; un permiso previo no acredita una lectura y errores vacíos o malformados también se rechazan. La selección de este agente y los eventos observados no se confunden con una atestación de un campo init que el CLI no entregue. La [documentación de custom agents](https://www.antigravity.google/blog/introducing-custom-agents) fundamenta la selección del conjunto de herramientas. El loop MCP existente mantiene su catálogo y política; su combinación con archivo se comprueba por lectura terminada, callback sintético, nonce exacto, hook y ACK.

El SDK Web 2.1.1 deduce MIME del nombre temporal. [Linux confirmó](../evidence/nodia-ai-ai32-r01-webm-mime-diagnostic.json) que .webm se interpretaba como video/webm y .weba no tenía registro. Para audio/webm realmente decodificado, sólo la preparación Web usa .weba y registra su MIME estándar mediante la API pública de mimetypes cuando falta; un registro contradictorio se rechaza antes de inferir. No se transcodifica ni cambia el hash/contenido, y el nombre temporal Agentic permanece .webm. Las pruebas invocan el upload_file real del SDK con HTTP sintético y comprueban el multipart. [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types) distingue esas extensiones; el MIME correcto por sí solo no demuestra transcripción satisfactoria.

El canario numérico inglés descubrió otro falso negativo del oráculo: la respuesta normalizada coincidía exactamente con «11», mientras se esperaba «eleven». Se conserva ese resultado sin habilitar capacidades por reinterpretarlo. Las nuevas muestras fijan de antemano frases sin números, usan voces SAPI instaladas seleccionadas explícitamente y generan WAV/WebM Opus con decodificación íntegra. La interpretación del archivo se compara fuera del prompt. El arnés separa caché de modalidad y éxito semántico de este canario: un WAV aprobado no convierte un WebM fallido en una prueba positiva.


### Matriz vigente y alcance comprobado

La [salud final R01](../evidence/nodia-ai-ai32-r01-final-health.json) observa la imagen `8acc39436c66…` a 2026-10-18T03:53:30Z (reloj de la VM). Estas pruebas pertenecen a sus sesiones y selecciones exactas; un reinicio o cambio las invalida.

| Modo | Imagen | PDF | Audio WebM Opus | Archivo y MCP |
|---|---|---|---|---|
| Web | Verificado | Verificado | Desconocido; canario no superado | No habilitado por política |
| Agentic | Verificado | Verificado | Verificado en español | Imagen verificada con callback sintético de lectura |

El audio español usa una voz SAPI instalada, frase fijada antes de inferir y archivo Opus de 3,0845 segundos. Comprueba lectura semántica con Gemini real; no es una grabación de micrófono físico. Web respondió y cerró con ACK, pero no devolvió el contenido esperado: no se habilita audio ni se promete ASR por haber corregido el MIME. Un WAV correcto de un proceso anterior no acredita WebM actual; no se ejecutó otro WAV en el proceso final para evitar atribuir evidencia de un formato a otro bajo la caché actual por modalidad. Si se amplía soporte por formato, su admisión deberá tener granularidad MIME comprobada.

La [prueba vigente archivo+MCP](../evidence/nodia-ai-ai32-r01-current-mcp-image.json) exige lectura terminada del archivo, un único callback de lectura con nonce impredecible, contenido esperado, hook y ACK. Se usa Gemini/CLI/gateway real con una respuesta sintética; no prueba una consulta SQL de negocio ni una escritura. La publicación de preparadores de escritura conserva su gate independiente.

Una observación Agentic agotó el plazo agregado de 12 segundos de catálogo/usage (12.025ms) antes de generar; se conserva separada con cero generaciones. Una nueva observación pasó en 6.114ms sin cambiar autenticación/configuración y la prueba posterior de audio pasó. Los [diagnósticos](../evidence/nodia-ai-ai32-r01-agentic-observation-diagnostics.json) no atribuyen una subllamada o causa interna que no se observó.

### Verificación, operación y pendientes R01

337/337 pruebas Python Linux correctas en la imagen final; Windows 337 ejecutadas,335 correctas y dos omisiones históricas. Incluyen parsing estricto, lectura terminada, errores vacíos, cancelación, MIME y multipart real del SDK con HTTP sintético. Los tests Server 3.314/210, Client 1.687/217 y 285 comprobaciones SQL de la entrega inicial son antecedentes, no ejecuciones nuevas de R01: no hubo cambios Node/cliente/esquema en esta revalidación.

El consolidado cuenta 25 intentos distintos de generación R01 (23 nativos y dos MCP), incluyendo diagnósticos y ciclos anteriores; los ocho intentos históricos de AI-32 se conservan aparte. Cero reintentos automáticos de inferencia y cero efectos de negocio. Una observación sin generación no se cuenta como inferencia. La evidencia distingue éxito de cada canario de una modalidad ya presente en caché.

La [activación final](../evidence/nodia-ai-ai32-r01-gemini-activation.json) preservó perfiles independientes, entorno, límites y credenciales; 85 fuentes coinciden con la imagen desplegada, sin drift. API, worker, Gemini y nginx están activos, HTTP200 y cero jobs, intentos, slots, resultados inciertos, pruebas nativas o temporales abiertos. Se conservan 970 archivos de paquete/905 dist, 26 migraciones y 19 tablas NodiaAI/267 columnas. No se requiere ni se realiza otro reinicio para cerrar la documentación; servicios quedan encendidos.

AI-32 permanece abierto por audio Web sin evidencia satisfactoria, R2 sin configurar y sin PUT/GET/DELETE cloud real, micrófono físico sin probar, traslado legacy sin adjunto nuevo y aceptación productiva. No hay fallback de modo/modelo, transcripción inventada ni aprobación documental automática. El usuario puede aportar texto revisado o elegir explícitamente Agentic cuando corresponda; corregir transporte no implica soporte universal del proveedor.

Reproducción local de integridad: `node docs/evidence/scripts/reconcile-nodia-ai-ai32-r01-validation.cjs --check`. Verifica 85 fuentes y 44 artefactos fijados por hash, sesiones/selecciones, pruebas, conteo de intentos y gates. Las fichas propias siguen draft/unregistered: 55 fuentes/28 excluidas y 67 lecturas/27 fragmentos publicados conservados. La investigación no publica capacidades mediante Markdown.

Las validaciones finales del catálogo, compilador de conocimiento, delta AI-32 e integridad R01 pasaron después de actualizar las fichas. Se verificaron 825 hashes de contratos y se conservó el release `a26257366f459d3baa059280b1a4105cb35615dc929de59624ce8fc986f27a99`; sin publicar borradores ni ampliar permisos.


## Revalidación AI-32-R02 — formatos de audio y traslado legacy

### Evidencia de formato exacto

La investigación mostró una brecha de admisión: la caché por categoría podía usar una prueba WAV para admitir WebM, o PNG para admitir JPEG. R02 liga cada prueba al MIME realmente decodificado, además de motor, recurso físico, sesión, modelo, esfuerzo, configuración y versión existentes. No incorpora tablas de disponibilidad ni deriva capacidades del catálogo.

El observe privado añade `verified_attachment_media_types`; `verified_modalities` queda como resumen informativo. La respuesta humana de capacidades añade `native_media_types`. La ausencia histórica de esas listas conserva desconocido y no autoriza originales. La admisión congela el MIME verificado a partir de metadata persistida; el worker vuelve a comprobarlo con el contenido autorizado antes de armar la inferencia y el microservicio lo exige antes de decodificar/ejecutar. La interfaz sólo ofrece el original de ese formato, manteniendo texto revisado y borrador ante desconocido, revalidación o error. No se convierten grabaciones ni se cambia de modelo/modo automáticamente.

Una grabación sintética española conocida se compara en WAV PCM y WebM/Ogg Opus, con el mismo modelo/esfuerzo/configuración. La primera prueba WAV pasó; la WebM agotó 120 segundos, HTTP200 upstream pero sin EOF ni candidatos. Se concilió el cierre desconocido con ACK y no se reenvió ese intento. Esto no reproduce JSON inválido ni demuestra que el formato sea universalmente incompatible: su causa interna upstream sigue sin observarse. El cierre/invalidez de sesión obliga a volver a probar los formatos que deban quedar habilitados; no se trasladan éxitos entre generaciones.

### Traslado de factura conservando su archivo

La entrada pública de `nodia_invoices_prepare_update` admite `destination_business_id`, mapeado al comando nativo de destino; el negocio de origen y la factura permanecen identificados por su ámbito original. Se validan permisos y referencias de ambos negocios. El alias no se admite en create. El hash de contrato update cambia, invalidando propuestas antiguas incompatibles; el de create se conserva y no se publica un preparador MCP adicional.

Si no se escoge un adjunto nuevo, la vista previa indica `file_preserved` y el cambio de negocio. Congela identidad de factura, timestamp y key privada de origen, sin inventar nombre, MIME observado, tamaño o digest que legacy no persiste. La key no se muestra ni se acepta como parámetro del modelo. El namespace del negocio origen y la extensión nativa permitida se validan antes del I/O.

Tras el botón humano, el worker usa el intent durable `invoice_uploads`, descarga con límite nativo de10 MiB y plazo de lease/paso, valida firma/MIME y copia fuera de SQL a una key independiente por destino/paso/fence. El descriptor legacy v2 conserva key de origen y agrega SHA256/tamaño reales únicamente después de leer; el descriptor v1 de nuevos adjuntos sigue admitido. Revalida autoridad, precondiciones, lease y cancelación antes de consumir el staging. Asociación, recibo y consumo del intent se confirman en la misma transacción; el archivo anterior sólo se libera mediante la recuperación nativa tras commit y se conserva si otra factura aún lo usa. Editar dentro del mismo negocio conserva la key sin copia.

PUT incierto no se repite automáticamente. Recuperación concilia el efecto SQL; resume humano crea otra generación de staging con su compensación independiente. No hay nuevas tablas, columnas, migraciones ni dependencias. La inmutabilidad de la key legacy es operacional: los escritores funcionales generan keys nuevas, pero no hay un versionId/ETag histórico con el que detectar una sobrescritura externa directa de R2 bajo esa misma key antes de leerla.

### Verificación independiente R02

[SQL focal](../evidence/nodia-ai-ai32-r02-legacy-sql-attempt01.json):33 comprobaciones nuevas con PostgreSQL16 desechable, clases compiladas reales y almacenamiento sintético. Cubren entrada pública, preview sin secretos, copia y recibo atómicos, concurrencia, revocación antes/después de I/O, precondición material con timestamp idéntico, rollback, respuesta de COMMIT perdida, PUT incierto/resume, cancelación, lease, purga del chat y key antigua compartida. Las [regresiones](../evidence/nodia-ai-ai32-r02-sql-regression.json) suman58 de adjuntos y44 de promoción:135 correctas en total, mismo paquete probado, primer intento y contenedores propios retirados. No prueban R2 real ni efectos de negocio de Gemini.

Backend3.336 pruebas/211 archivos y Client1.690/217 correctos. Python Linux341/341; Windows339 correctas y dos omisiones históricas. Los tests nuevos comprueban WAV→WebM y PNG→JPEG dentro de la misma categoría, listas ausentes/malformadas, revalidación de sesión y ausencia de dispatch cuando falta evidencia exacta. La UI retira la disponibilidad positiva durante refetch/error aunque React Query conserve datos, sin borrar archivo/texto. La primera suite Client detectó un fixture que sólo ofrecía resumen por categoría; se actualizó al contrato MIME y la suite completa posterior pasó. No se eliminaron assertions de negocio.

El [delta de catálogo](../evidence/nodia-ai-ai32-r02-catalog-delta.json) actualiza únicamente11 hashes de producción revisados, conserva825 fuentes y las rutas/coberturas existentes. El [delta de conocimiento](../evidence/nodia-ai-ai32-r02-knowledge-delta.json) cambia sólo la procedencia técnica de dos documentos, sin alterar su contenido aprobado, registry,67 lecturas o27 fragmentos. Las fichas de efectos y adjuntos siguen draft/unregistered; la publicación y aceptación de escrituras MCP conservan su gate independiente.

Las pruebas R02 posteriores de PNG y PDF Web también agotaron120 segundos sin EOF ni candidatos, mientras Agentic completó imagen/PDF/WebM y archivo+MCP. Por ello, la evidencia no permite atribuir los timeouts exclusivamente al contenedor o codec de audio. Los dos éxitos WAV observados hasta ese punto tardaron30,47 y73,12 segundos; cada fallo posterior invalidó la evidencia de esa generación. Los hashes y ACK de los intentos se conservan separados y la disponibilidad final debe consultarse en la matriz vigente. Ogg completó upstream pero falló JSON en el carácter371 de1675; se rechaza sin reconstruir contenido ni habilitar audio por una respuesta malformada.

El [control Web de texto sin archivos](../evidence/nodia-ai-ai32-r02-web-text-control.json) pasó en5,57 segundos con nonce impredecible, JSON válido, recibo completed y ACK en la misma sesión. Este control verifica conversación Web; no acredita MIME, transcripción ni ausencia de futuros fallos. Junto con las pruebas anteriores, acota los fallos observados al procesamiento de esos turnos con archivos, sin demostrar la causa interna del proveedor ni atribuirlos a credenciales/codec por suposición. No se amplía el límite de inferencia de120 segundos para ocultarlos.


### Matriz final R02 y cierre operativo

La [salud final](../evidence/nodia-ai-ai32-r02-final-health.json) a2026-10-18T04:32:19Z (reloj VM) y la [observación real del adaptador Node](../evidence/nodia-ai-ai32-r02-node-observation.json) confirman estas listas exactas en las selecciones y sesiones finales:

| Formato original | Web | Agentic |
|---|---|---|
| PNG | Desconocido; timeout en R02 | Verificado |
| PDF | Desconocido; timeout en R02 | Verificado |
| WAV PCM | Verificado en español | Sin prueba de formato en R02 |
| WebM Opus | Desconocido; timeout en R02 | Verificado en español |
| Ogg Opus | Desconocido; JSON malformado en R02 | Sin prueba de formato en R02 |

JPEG/WebP/MP3/M4A permanecen desconocidos en ambos modos hasta un canario específico. Los originales fallidos quedan bloqueados; el inspector y el texto revisado siguen disponibles según sus contratos. El resumen audio=true de Web sólo significa que existe un MIME probado: audio/wav. No convierte WebM/Ogg de MediaRecorder en notas de voz nativas aceptadas por Web.

El [WAV final](../evidence/nodia-ai-ai32-r02-web-audio-wav-es-current-02.json) pasó en12,86 segundos después del control de texto y de los fallos de otros formatos, en la misma sesión que conserva la salud final. Los WAV anteriores pasaron en sus propias sesiones y se mantienen históricos. No se hizo otra inferencia Web después de este último control. La observación Node usó el adaptador/transporte compilados reales y PostgreSQL con default_transaction_read_only=on/transaction_read_only=on; aceptó las listas exactas, sin ejecutar generaciones ni escrituras. No es una prueba de permisos HTTP del usuario ni de carga R2.

La [imagen con MCP](../evidence/nodia-ai-ai32-r02-current-mcp-image.json) verifica lectura nativa Agentic terminada, hook, un callback sintético con nonce, respuesta exacta y ACK; no usa SQL de negocio ni publica escrituras. El consolidado registra12 generaciones explícitas R02:10 canarios nativos, un control de texto y uno MCP; cuatro resultados desconocidos cerrados, sin reintento automático. Revalidar WAV después de cambiar la sesión es otro canario explícito con identidad propia; no reejecuta ningún resultado incierto anterior.

El [sidecar del arnés](../evidence/nodia-ai-ai32-r02-harness-provenance.json) preserva la primera versión de proyección usada por dos intentos. La versión final exige además una lista MIME válida/única, mismo recurso y sesión tras la prueba, y registra su SHA256. No modifica resultados históricos ni presta evidencia de otro formato/sesión. Seis escenarios offline de identidad/formato y cuatro de control de texto verificaron esos límites sin red real.

[Activación Node](../evidence/nodia-ai-ai32-r02-node-activation.json) y [Gemini](../evidence/nodia-ai-ai32-r02-gemini-activation.json): respaldo y rollback disponibles, imagen3a39d7717caf…,970 archivos de paquete/905 dist y85 fuentes Python idénticos a sus artefactos probados, sin drift. El [primer intento Node](../evidence/nodia-ai-ai32-r02-node-activation-attempt01.json) agotó la ventana de arranque de10 segundos y restauró el código previo; se ajustó sólo la espera de readiness del despliegue a45 segundos. No se amplió el límite de inferencia ni se alteraron credenciales. La activación posterior pasó.26 migraciones/19 tablas NodiaAI/267 columnas conservadas; ninguna migración nueva. API/worker/Gemini/nginx activos, HTTP200 y cero trabajos, intentos, slots, marcadores inciertos, pruebas nativas o temporales abiertos. Cliente local actualizado y build validado; no se afirma despliegue productivo general del frontend.

El traslado legacy queda cerrado en implementación e integración SQL con storage sintético. R2 está sin configurar y sus PUT/GET/DELETE reales no se verificaron; el micrófono físico tampoco. La aceptación de originales WebM/Ogg y nueva evidencia de PNG/PDF Web siguen pendientes. El control de texto correcto y los fallos con archivos no acreditan una causa upstream exacta. No hay reparación de JSON corrupto, transcodificación, cambio de modelo/proveedor ni fallback de modo implícitos.

[Consolidado R02](../evidence/nodia-ai-ai32-r02-validation.json), reproducible con `node docs/evidence/scripts/reconcile-nodia-ai-ai32-r02-validation.cjs --check`. Catálogo y compilador mantienen55 fuentes/28 excluidas,67 lecturas/27 fragmentos publicados; release6c4f sólo actualiza procedencia técnica y conserva el contenido aprobado. Los históricos AI-32/R01 y sus hashes permanecen intactos. AI-32 continúa abierto; aprobación documental y aceptación productiva no se infieren de estas pruebas.

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

## Revalidación AI-32-R04 — clasificación explícita del audio Web

### Diferencial de archivos y transporte

El [análisis aislado](../evidence/nodia-ai-ai32-r04-audio-analysis.json) demuestra que las muestras históricas WebM y Ogg contienen los mismos 155 paquetes Opus, el mismo encabezado y exactamente el mismo PCM decodificado: 148.054 muestras, 48 kHz mono y 3,08445833 s. No están vacías, no hay clipping y sólo cambian contenedor y metadata. La comparación utiliza PyAV/libav del contenedor existente sin red, con raíz de sólo lectura, límites y archivos sintéticos; no reconoce voz ni habilita conversión en la ruta de ejecución. Su [script](../evidence/scripts/nodia-ai-ai32-r04-audio-analysis.py) y hashes están fijados. WAV conserva una codificación distinta; su correlación con Opus es una medición, no una exigencia de igualdad después de compresión con pérdida.

El SDK 2.1.1 ya subía el archivo con MIME en el multipart, pero enviaba a la generación el descriptor genérico `[[ref], nombre]`. El [PR179 histórico del repositorio del SDK](https://github.com/HanaokaYuzu/Gemini-API/pull/179) propone tipo de archivo y MIME explícitos; quedó cerrado sin merge y no certifica por sí solo soporte actual. Se probó únicamente esa diferencia para audio NodiaAI: `[[ref, 4, null, MIME], nombre]`. El valor4 pertenece al transporte observado, no a una capacidad inferida del modelo. Se conservan endpoint, referencia del upload, nombre privado, bytes, modelo, esfuerzo y prompt. No hay segunda subida, transcodificación, remux de entrada operativa, cambio de proveedor ni fallback.

El scope exige cliente y tarea exactos, hasta cuatro archivos y alineación de nombres/MIME/cardinalidad contra los adjuntos validados. Sólo transforma audio; OCR, texto, imágenes y PDF conservan el descriptor previo. Referencias opacas se preservan sin exigir un prefijo histórico como contrato futuro. Un shape inesperado falla antes del stream. La etiqueta privada de pruebas pasa a `nodia-ai-native-attachments/4`; selección/MIME/sesión y MCP siguen sus barreras. No hay contrato HTTP público, tablas, dependencias o configuración de modelos nuevos.

### Confirmación real y JSON de Ogg

Con la nueva imagen, las mismas muestras, modelo y configuración anteriores, [Ogg](../evidence/nodia-ai-ai32-r04-web-audio-ogg-es.json) pasó en 11,58 s y [WebM](../evidence/nodia-ai-ai32-r04-web-audio-webm-es.json) en 8,72 s: respuesta y transcripción exactas, un upload cada una, proceso cerrado y ACK. Las tres huellas del texto elegido —campo decodificado de la respuesta antes de limpieza, salida de _parse_candidate y Candidate final— coinciden en57 bytes y JSON válido. El modelo no recibió el texto/hash esperado en el prompt. Se valida la adaptación y la aceptación de esos formatos en esta selección; el reinicio cambió la generación de sesión, por lo que esto no es un A/B aleatorio en una misma sesión ni demuestra la causa interna única de los errores remotos históricos.

El nuevo diagnóstico observa el campo elegido `primary/card/fallback` antes de _parse_candidate, con límite64 KiB, tamaño/SHA, tipo JSON y categorías sintácticas cerradas; se vincula privadamente al mismo rcid y sólo publica la candidata elegida. No retiene texto, URLs, IDs, frames ni archivos. La comparación distingue selección upstream, limpieza SDK y decodificación Candidate; desconocido o exceso de límite conserva null. No cambia la elección ni intenta una segunda decodificación o reparación del JSON.

Para reforzar la lectura semántica se generó [una frase nueva e impredecible](../evidence/nodia-ai-ai32-r04-fresh-synthetic-audio.json), sin números, con una voz SAPI española instalada, y fixtures WebM/Ogg distintos de los históricos. El [generador](../evidence/scripts/nodia-ai-ai32-r04-fresh-audio.py) usa síntesis/codificación offline; la expectativa queda en el oráculo y nunca entra al prompt del proveedor. [Ogg fresco](../evidence/nodia-ai-ai32-r04-web-audio-ogg-fresh.json) pasó en 9,79 s y [WebM fresco](../evidence/nodia-ai-ai32-r04-web-audio-webm-fresh.json) en 20,97 s, en la misma sesión final, ambos con el hash de palabras esperado. No es una grabación de micrófono físico ni una promesa de precisión universal de ASR.

Ogg fresco incluye un objeto JSON completo de67 bytes más nueve bytes de presentación de cita nativa. Por eso su metadata de documento entero indica `json_parseable=false/extra_data` en posición67, con la misma huella antes/después del SDK. El parser estricto R01 ya admite exclusivamente esa cita canónica después de un objeto completo y validado: respuesta, schema, semántica y ACK pasaron. No es el JSON interior corrupto de R03 ni un parser nuevo permisivo. R03 permanece como fallo histórico sin atribuirle retrospectivamente una huella upstream que no se capturó. WebM fresco entrega un objeto íntegro sin ese sufijo.

### Matriz vigente y regresiones

La [salud final](../evidence/nodia-ai-ai32-r04-final-health.json) y la [observación Node compilada real](../evidence/nodia-ai-ai32-r04-node-observation.json) vinculan la disponibilidad a las selecciones y sesiones exactas, no al nombre del modelo. La observación Node es de sólo lectura, sin generaciones ni cambios SQL, y acepta los cinco MIME Web actuales. Estos son canarios privados del adaptador, independientes del circuito UI/R2/chat.

| Original | Web | Agentic |
|---|---|---|
| PNG | Verificado, 9,90 s | Verificado, 21,54 s |
| PDF | Verificado, 10,33 s | Verificado, 25,63 s |
| WAV PCM español | Verificado, 17,14 s | Sin prueba R04 |
| WebM Opus español | Verificado con dos frases | Verificado, 19,63 s |
| Ogg Opus español | Verificado con dos frases | Sin prueba R04 |

JPEG/WebP/MP3/M4A conservan desconocido. El [control Web de entidades](../evidence/nodia-ai-ai32-r04-web-text-entities.json) pasó en 18,75 s: cuatro salidas habrían cambiado con html.unescape y la fuente/final permanecen idénticas. No hizo uploads ni adaptó metadata de audio. [Agentic archivo+MCP](../evidence/nodia-ai-ai32-r04-current-mcp-image.json) verifica PNG leído, hook, un callback sintético con nonce, respuesta exacta y ACK; no representa SQL de negocio ni una escritura. Web conserva su política conversacional sin MCP. No hubo timeouts en este ciclo, sin afirmar resuelta la causa de los históricos.

385 pruebas Linux correctas y385 ejecutadas Windows,383 correctas y dos omisiones históricas. Son24 regresiones nuevas sobre361 R03: metadata de audio por scope, petición real del SDK con HTTP sintético, multifile/alineación, cancelación, OCR intacto, selección previa al parser, alternativas/card, privacidad y límites. Los arneses pasan26 casos offline:16 nativos, cinco de texto y cinco MCP. No se reejecutaron Server/Client/SQL: su código y esquema no cambiaron; los resultados R02 siguen siendo antecedentes.

El [primer build Linux](../evidence/nodia-ai-ai32-r04-build-attempt01.json) falló en una expectativa nueva: el SDK Linux usa `audio/x-wav` en multipart y Windows `audio/wav`. Se corrigió sólo el test para admitir ambos alias existentes; el descriptor de generación exige `audio/wav` exacto según el inspector. Se preservan log/manifiesto/imagen del intento fallido, que no llegó a activarse ni a inferir. [Build final](../evidence/nodia-ai-ai32-r04-build.json) e [imagen activada](../evidence/nodia-ai-ai32-r04-gemini-activation.json) quedan ligados a las fuentes y suites finales.

### Cierre operativo y alcance

El [consolidado R04](../evidence/nodia-ai-ai32-r04-validation.json) registra12 solicitudes nativas de generación explícitas: siete canarios de archivos Web, tres Agentic, un control de texto y una prueba de archivo+MCP. Las12 terminaron y se acusaron; las inferencias internas del CLI no se cuentan como requests independientes del arnés; cero reintentos automáticos, resultados inciertos pendientes o efectos de negocio. Un único reinicio de runtime, después de las pruebas finales; los builds descartados no reiniciaron el servicio. Imagen212cffaeefdd…,92 fuentes idénticas y respaldo disponible. [Auditoría de /app](../evidence/nodia-ai-ai32-r04-app-layout.json): fuentes exactas y un archivo de configuración montado existente, sin leer sus bytes; ningún script operativo, sourcearchive ni .tmp incorporado. El build usa contexto fresco por hash, separado del archive y helpers.

API, worker, Gemini y nginx activos, HTTP200 y cero jobs/intentos/slots/marcadores inciertos/pruebas nativas/temporales abiertos. Credenciales, aislamiento y configuración conservados;970 archivos de paquete/905 dist,26 migraciones y19 tablas NodiaAI/267 columnas sin cambios. Servicios encendidos. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos y release6c4f conservados; fichas draft/unregistered y ADR-057 propuesto. No se aprueba ni publica ninguna herramienta por actualizar Markdown.

**WebM y Ogg Web cierran su aceptación técnica por formato en el laboratorio. AI-32 sigue abierto por R2 real sin configurar/sin PUT/GET/DELETE cloud, micrófono físico y aceptación productiva.** Las muestras sintéticas no cierran esos gates. Los timeouts históricos conservan causa exacta no demostrada y sus métricas permiten investigarlos si reaparecen. Integridad del árbol actual: `node docs/evidence/scripts/reconcile-nodia-ai-ai32-r04-validation.cjs --check`. Históricos AI-32/R01/R02/R03 preservados.

## Revalidación AI-32-R05 — R2, micrófono y contención del compositor

[Consolidado R05](../evidence/nodia-ai-ai32-r05-validation.json) y [flujo de la app](../evidence/nodia-ai-ai32-r05-ui-flow.json). Se reutilizaron exclusivamente las cuatro variables R2 existentes en el entorno local ignorado, transferidas por stdin SSH al entorno privado de la VM. Respaldo privado, reemplazo atómico y conservación del resto de la configuración; reinicios sólo de API/worker, sin reiniciar Gemini ni nginx. No se publican valores, huellas de credenciales, bucket o URLs. [Activación de configuración](../evidence/nodia-ai-ai32-r05-r2-configuration.json).

El [canario final](../evidence/nodia-ai-ai32-r05-r2-canary-final.json) usa el adaptador compilado real: PUT200, GET200 con bytes/SHA exactos, DELETE204 y GET404/NoSuchKey del mismo objeto sintético. Sin listados ni enlaces firmados. Se conservan por separado el canario previo y el preflight fallido del despliegue, ocurrido antes de detener servicios. La [activación final](../evidence/nodia-ai-ai32-r05-r2-storage-activation.json) instala dos JS y cuatro mapas/declaraciones; 909 outputs verificados, los otros903 previos idénticos, sin migraciones o dependencias nuevas. Cloudflare documenta el [acceso S3](https://developers.cloudflare.com/r2/get-started/s3/) y [región auto](https://developers.cloudflare.com/r2/api/s3/api/); la app sigue pasando por la API autenticada, sin introducir acceso público o CORS directo.

### PUT sin repetición implícita

La revisión reprodujo que el SDK podía emitir tres PUT aun cuando la primera petición ya había persistido el objeto antes de responder503. StorageService conserva su cliente normal para facturas nativas, GET y DELETE; añade un cliente reutilizable con maxAttempts1 exclusivamente para uploadFileOnce, utilizado por el adaptador NodiaAI en subidas/promociones. Ambos clientes se cierran al destruir el módulo. No se muta configuración compartida por petición. [Doce comprobaciones](../evidence/nodia-ai-ai32-r05-storage-code-validation.json) con SDK real y HTTP sintético acreditan un único PUT NodiaAI ante resultado incierto/aborto y preservan los reintentos de los consumidores anteriores. El canario cloud observa la configuración; no dispone de un contador de peticiones recibidas por R2.

### App, voz física y persistencia

El usuario inició y detuvo la grabación desde el botón real de NodiaAI. voice.webm mide99.755 bytes, MIME decodificado audio/webm y6,18s. No se usó un micrófono virtual ni una voz sintetizada. La transcripción quedó vacía y no se aceptó ninguna interpretación antes de enviar; la extracción automática del PDF tampoco se aceptó. La frase que finalmente grabó fue distinta de la sugerida inicialmente; la respuesta de Gemini fue contrastada después con el usuario, que confirmó su coincidencia. No se introdujo el contenido esperado en el mensaje al proveedor.

La [proyección previa](../evidence/nodia-ai-ai32-r05-r2-app-uploads.json) confirma tres adjuntos ready y tres GET R2 con tamaños/hashes exactos. Una única pulsación de Enviar procesó PNG, PDF y el audio originales en un turno Web: texto de ambos documentos correcto y transcripción confirmada. [SQL posterior](../evidence/nodia-ai-ai32-r05-r2-app-after-run.json) muestra un mensaje del dueño, uno del asistente, tres referencias enlazadas una vez y provider_dispatches_used1. Las dos etapas internas completadas son contexto e inferencia; no representan dos inferencias. Cero herramientas, delegaciones o efectos de negocio.

Los [tres archivos descargados desde la UI](../evidence/nodia-ai-ai32-r05-private-download-hashes.json) coinciden con SQL y R2; recargar conserva respuesta y referencias. Tras la recarga se observó disponibilidad falsa sin causa exacta capturada. Una consulta compilada de la selección exacta mostró disponibilidad real y el botón existente Volver a comprobar la restauró en UI; no se aplicó configuración ni se generó otro turno. El resultado transitorio no se presenta como una sesión cerrada ni como un nuevo fallo de inferencia.

### Corrección visual y captura estable

El usuario detectó el compositor fuera de la tarjeta. La [medición anterior](../evidence/nodia-ai-ai32-r05-ui-before.json) muestra398px de desbordamiento con tres borradores. El Workspace limitado coexistía con un formulario que no podía contraerse. El compositor ahora comparte el scroll transparente de la página, puede reducir su altura y contiene todas sus acciones; Adjuntos elimina su scroll anidado. Chat admite minHeight0, la cabecera no se comprime y xs permite crecimiento natural sin maxHeight heredado. No se oculta el defecto con overflowhidden. [Geometría real](../evidence/nodia-ai-ai32-r05-ui-layout.json):320/599/600/900/1440px, sin desbordamiento horizontal, tres borradores conservados y formulario contenido; Enviar alcanzable por teclado. [Captura corregida](../evidence/nodia-ai-ai32-r05-ui-fixed.jpg) y [resultado](../evidence/nodia-ai-ai32-r05-ui-response.jpg). Navegador redimensionado, sin atribuir teclado virtual o teléfono físico.

Además, Cargar mensajes anteriores se bloquea durante la grabación: antes podía lanzar un refetch y descartar silenciosamente la nota. La regresión comprueba que no consulta/interrumpe la captura y que el borrador permanece al detenerla. No cambia la política de revocación ni el hook.

### Calidad, operación y límites

56 pruebas focales Client,50 casos de uso Server y12 comprobaciones SDK/HTTP correctos; tipado, lint afectado y builds correctos. Los fallos iniciales de prueba/CSSObject y del preflight permanecen registrados. No se reejecutaron las suites completas históricas ni Python: sus385 pruebas Linux/383 Windows+2 omisiones y la matriz nativa corresponden a R04, sin cambios Python en R05. La [salud final](../evidence/nodia-ai-ai32-r05-r2-final-health.json) verifica909 outputs Node/92 fuentes Gemini, API/worker/Gemini/nginx activos, HTTP200 y cero jobs/intentos/slots/resultados inciertos/pruebas nativas/temporales pendientes. No existe contador ACK observado: queda null, con cero pruebas terminales restantes.

R2 y micrófono físico cierran sus gates del flujo de chat en laboratorio. Esto no verifica por sí solo el janitor al expirar un chat, promoción/traslado legacy con R2 ni aceptación productiva; las pruebas SQL anteriores y los gates de AI-15/22 se conservan separados. AI-32 mantiene su casilla de aceptación abierta, sin aprobar documentos, ADR o fichas. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos sin publicación nueva. Servicios encendidos y chat de prueba conservado con su retención normal.

## Revalidación AI-32-R06 — purga y copias de factura con R2 real

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

## Revalidación AI-32-R07 — aceptación técnica y recuperación tras PUT tardío

[Consolidado R07](../evidence/nodia-ai-ai32-r07-validation.json). La revisión final separó los criterios de AI-32 de publicación/operación/aceptación por entorno previstas en AI-36..38. Los pendientes históricos de R2, micrófono y formatos ya estaban cubiertos por R04/R05/R06; restaban dos combinaciones de fallo de [política50](50-nodia-ai-ai04-runtime-policy.md): ciclo del proceso inspector y expiración durante PUT con recuperación tras reiniciar el proceso de mantenimiento. No se añaden funcionalidades ni se cambian contratos de aplicación.

| Criterio de AI-32 | Evidencia y resultado |
|---|---|
| M3, intención antes de PUT, identidad, ownership, cuotas y revisión inmutable | [SQL original](../evidence/nodia-ai-ai32-sql-validation.json) y casos de uso; resultados históricos, no reejecutados en R07 |
| Firma, bytes, duración/páginas/píxeles y aislamiento del decoder | [Inspector original](../evidence/nodia-ai-ai32-parser-validation.json); el nuevo test de lifecycle no sustituye esa prueba de contenido/aislamiento |
| Modalidades por selección exacta y archivo+MCP Agentic | [R04](../evidence/nodia-ai-ai32-r04-validation.json), más [app Web R05](../evidence/nodia-ai-ai32-r05-validation.json); sólo formatos acreditados, sin extender PNG a JPEG ni WAV a otros audio |
| Micrófono físico, descarga privada, recarga y compositor | R05; transcripción confirmada por el usuario, sin exigir otra grabación |
| Purga, DELETE incierto, copias independientes, reemplazo y traslado legacy | [R06](../evidence/nodia-ai-ai32-r06-validation.json); copias de factura sobreviven al chat |
| Hijo inspector fallido, timeout y cancelación | [R07 inspector](../evidence/nodia-ai-ai32-r07-inspector-validation.json): cuatro pruebas nuevas correctas en Windows y Linux |
| PUT posterior a purga y recuperación en otro proceso | [R07 upload](../evidence/nodia-ai-ai32-r07-late-put-upload.json) y [cleanup](../evidence/nodia-ai-ai32-r07-late-put-cleanup.json): diez comprobaciones SQL/R2 correctas |
| Instrucciones recuperadas no conceden autoridad | Extracción sin revisión rechazada en SQL y barreras de confirmación/ejecución del gateway; no se publica un escritor por interpretar un archivo |

### Inspector y subida tardía

Las pruebas nuevas ejecutan receive/decode con procesos Python hijos reales y programas sintéticos controlados. Comprueban exit no exitoso, timeout, cancelación durante communicate y durante spawn: el hijo termina/se espera, el temporal queda vacío y ambos cupos vuelven a estar disponibles. El timeout de15s se comprime a0,05s sólo en el fixture, y el guard de plataforma se adapta sólo dentro del test Windows; no se atribuye seccomp o decodificación real al hijo sintético. Cuatro casos correctos en cada plataforma; suite completa Windows389 ejecutadas,387 correctas y dos omisiones históricas. Linux ejecutó los cuatro nuevos en un contenedor temporal de la imagen vigente con red deshabilitada; sus385 pruebas completas previas son evidencia R04, no una suite completa nueva. Producción Python permanece intacta.

El arnés de almacenamiento utiliza los casos de uso compilados vigentes, inspector HTTP privado y R2 reales, sobre PostgreSQL desechable con26 migraciones. Suspende la llamada antes del SDK PUT, expira el único chat sintético mediante el caso de uso real y comprueba el commit de purga antes de liberar un único PUT. R2 devuelve el contenido exacto, pero el upload no puede republicar ready porque el chat/adjunto ya no existen. Sólo sobrevive el job mínimo por generación. El primer proceso cierra sus recursos; otro PID reconstruye el janitor y recupera exclusivamente esa identidad durable, sin subir nuevamente.

No se alteran los deadlines de upload/job: se respeta la ventana real de70s del contrato, incluso para limpieza manual. Un DELETE y GET404/NoSuchKey cierran el objeto; otro intento ya asentado no repite DELETE. La cota superior monotónica medida desde antes de invocar la purga hasta GET404 fue **70.01s**; la evidencia conserva también la cota inferior desde el ACK de purga. Es tiempo realmente transcurrido en el mismo boot, no la edad preparada del fixture. Cumple el objetivo24h para este caso puntual; no acredita SLA, frecuencia del scheduler,90 días transcurridos ni tolerancia a todos los fallos remotos.

El [intento inicial](../evidence/nodia-ai-ai32-r07-late-put-upload-attempt01.json) falló al componer proveedores del arnés: el módulo padre no podía inyectar la política importada por AttachmentModule. Se preservan fuente y reporte; cero inspector/PUT/DELETE. La [verificación posterior](../evidence/nodia-ai-ai32-r07-di-failure-state.json) confirmó SQL vacío y ledger ausente. La corrección instancia los casos de mantenimiento como en R06, sin cambiar exports/DI de la aplicación. El segundo intento sí ejecutó ambas fases. Nueve [guardas offline](../evidence/nodia-ai-ai32-r07-late-put-guards.json) cubren namespace, colisiones, fallo de lectura/gate, PUT incierto sin replay y rechazo de un ledger ya existente; la revisión corrigió las salidas del arnés antes de la prueba cloud.

### Aplicabilidad del almacenamiento y cierre

El adaptador vigente usa una key inmutable por generación y un PutObject único; no inicia multipart. La [compatibilidad S3 oficial de R2](https://developers.cloudflare.com/r2/api/s3/api/) consultada el2026-10-18 marca GetBucketVersioning/PutBucketVersioning como no implementadas. No se consultó ni cambió configuración de buckets, ni se listaron objetos/versiones. La generación propia de Nodia no se presenta como un VersionId S3. El criterio de versiones/multipart de política50 conserva aplicación condicional: cambiar de backend o incorporar esos protocolos exige verificar su limpieza antes de habilitarlos; este cierre no certifica almacenamiento versionado ni copias internas del proveedor.

[Teardown](../evidence/nodia-ai-ai32-r07-sandbox-cleanup.json) y [preservación del chat R05](../evidence/nodia-ai-ai32-r07-configured-chat-preservation.json): objeto propio ausente, base/contenedor/descriptor/ledger de prueba retirados; los tres adjuntos, revisión/epoch y único dispatch anteriores permanecen idénticos. [Salud final R07](../evidence/nodia-ai-ai32-r07-final-health.json): servicios activos, HTTP200, paridad909 Node/92 fuentes Gemini y cero pendientes, sin reinicios. Health/paridad no equivalen a nueva autenticación ni inferencia; los canarios de modelos conservan las selecciones y fechas R04/R05. Cero inferencias y cambios de datos operativos en R07.

**AI-32 queda cerrado técnicamente para el alcance implementado en laboratorio**, y el plan marca esa casilla. Las aprobaciones documentales permanecen sin cambios: entrega en revisión, fichas draft/unregistered y ADR-057 propuesto. Corpus55 fuentes/28 excluidas,67 lecturas/27 fragmentos y release6c4f conservados, sin publicación MCP. Siguiente desarrollo AI-33, preferencias aceptadas.

Siguen en sus etapas: descarga binaria nativa de factura AI-15, publicación/aceptación integral de dominios AI-36, carga/drain/observabilidad AI-37, backups/restore y retención remota AI-36/38, aceptación productiva por entorno AI-38. No se exige completar esas etapas futuras para volver a demostrar los adjuntos de AI-32, ni se declaran ya completadas.

Integridad reproducible del cierre actual: `node docs/evidence/scripts/reconcile-nodia-ai-ai32-r07-validation.cjs --check`. Los consolidadores R04/R05/R06 conservan sus snapshots históricos; no se reescriben al actualizar documentación posterior.

Calidad documental R07: check/build de conocimiento y enlaces correctos, sin alterar el release publicado. El primer check detectó un resumen de implementación de la ficha de producto mayor al máximo4096 caracteres; se resumió el estado vigente manteniendo el detalle histórico en su cuerpo, sin ampliar el schema. [Incidencia documental](../evidence/nodia-ai-ai32-r07-document-validation-attempt01.json) y [verificación final](../evidence/nodia-ai-ai32-r07-quality.json).
