# NodiaAI — chat y compositor con selección por conversación

Fecha inicial: 2026-10-28. Revisión vigente: R08, 2026-10-29. Estado documental: en revisión. Implementación autorizada por la solicitud explícita del usuario; esta autorización no aprueba el documento ni publica conocimiento.

[Contrato de proveedores](ai-provider-feature-contract.md) · [Modos90](90-agentic-api-only-web-retirement.md) · [Verificación91](91-ai-provider-onboarding-verification.md) · [Chat API92](92-nodia-ai-api-chat-parity.md) · [Adjuntos78](78-nodia-ai-ai32-attachments-voice.md) · [Ficha candidata](../nodia-ai/knowledge/nodia-ai/features/chat-composer-selection.md).

## Revisión vigente R08: Markdown de respuestas y recarga de elegibilidad — 2026-10-29

La presentación de las respuestas del asistente incorpora Markdown mediante `react-markdown`10.1.0 y `remark-gfm`4.0.1. Es una transformación visual del texto autorizado; no modifica el mensaje persistido, el contexto enviado al modelo, los permisos, las herramientas, los snapshots ni la revisión/confirmación de efectos. El ajuste es reversible en Client y no requiere un ADR nuevo. [Evidencia R08 consolidada](../evidence/nodia-ai-chat-markdown-20261029-r01.json).

### Contrato de presentación R08

- Sólo las partes visibles `kind: text` del asistente usan Markdown; se reúnen grupos consecutivos compatibles para conservar estructuras divididas entre partes. Mensajes del usuario, texto revisado de adjuntos y contenido restringido conservan presentación literal. No se revela texto oculto ni se transforma una cita/archivo en instrucciones autorizadas.
- Párrafos, títulos, énfasis, listas, citas, código y tablas GFM conservan la jerarquía del chat. Tablas y bloques de código anchos desplazan sólo dentro de su región local, accesible por teclado y con nombre traducido. Scrollbars delgadas, pista transparente e indicadores adaptados al theme; el documento no debe adquirir scroll horizontal por el contenido Markdown.
- HTML del mensaje se presenta como texto escapado/literal, sin `rehypeRaw` ni nodos HTML ejecutables creados desde ese contenido; no se elimina el resto de la respuesta por encontrar un bloque HTML. Markdown no carga imágenes remotas: conserva el texto alternativo cuando existe. Las imágenes reales del chat siguen su componente y lectura autorizada existentes.
- Sólo enlaces absolutos `http`, `https` y `mailto` son navegables. Rutas relativas/privadas, protocolos de ejecución y URLs no válidas se presentan sin enlace. Los enlaces permitidos abren por intención del usuario con `noopener noreferrer`; no hay navegación ni descarga automática desde Markdown.
- «Volver a comprobar» pasa a IconButton de recarga de44px en el slot derecho de la alerta de cabecera, alineado arriba y con texto envolvente en móvil. Tooltip y nombre accesible reutilizan su traducción. Se conservan exactamente handler, selección, contexto, bloqueos y GET de elegibilidad: no inicia inferencia ni repite un turno y no añade altura periódica o desmonta contenido durante una consulta.

Fuentes: [ChatMessage](../../nodia-client/src/modules/nodiaAi/components/ChatMessage/ChatMessage.tsx), [MessageMarkdown](../../nodia-client/src/modules/nodiaAi/components/MessageMarkdown/MessageMarkdown.tsx), [estilos de Markdown](../../nodia-client/src/modules/nodiaAi/components/MessageMarkdown/styles.ts) y [cabecera](../../nodia-client/src/modules/nodiaAi/pages/NodiaAI/NodiaAI.tsx). Cierre R08: Client2187/264,30 regresiones Markdown/ChatMessage,59 de página, tipos/lint/build y diez pruebas offline del operador correctos. QA320/390/600/1088/1569px ES oscuro/EN claro verifica scroll local por teclado, targets44px, recarga a la derecha, contenido y DOM conservados, sin overflow horizontal, imágenes remotas, POST o captura. Client `nodia-client-chat-markdown-20261029-r01` adoptado:173archivos,169assets actuales/46previos y túnel5174 verificados; respaldo exacto Nginx y release previa conservados, Server/KB/Native sin cambios ni reinicios. Historial real autenticado comprobó título, tabla y negritas de la propuesta anterior sin enviar mensajes ni confirmar/abrir propuestas. Advertencias de desarrollo y coste de bundle se conservan en el recibo; no se presenta como optimización ni aceptación física. Esto no aprueba ni publica la [ficha candidata revisión10](../nodia-ai/knowledge/nodia-ai/features/chat-composer-selection.md).

### Permiso del micrófono observado y restablecimiento no aplicado

Para `http://localhost:5174`, una lectura nativa de `navigator.permissions.query` mediante `Runtime.evaluate` observó `granted`. El usuario autorizó restablecer ese permiso; el intento de `Browser.setPermission` limitado a micrófono/origen fue rechazado por la herramienta con `tool_method_not_supported`. La lectura nativa posterior siguió devolviendo `granted`: no se aplicó ni confirmó un reset y no se modificaron otros permisos. No se inició reconocimiento ni captura en esta revisión R08.

Un permiso concedido, constructor presente o stream disponible no demuestra servicio ASR operativo; el error de conexión anterior mantiene causa no determinada y transcripción positiva pendiente. El usuario aclaró la operación del permiso: no eligió un motor backend ni autorizó un cambio automático del dictado del navegador. Se conserva la elección R07 y no se ejecuta otro reconocimiento, replay o fallback para validar este cambio visual. Los intentos reales anteriores conservan sus propios recibos y límites.

## Revisión anterior R07: dictado del navegador a texto editable — 2026-10-29

El usuario elige explícitamente el reconocimiento de voz del navegador y acepta que pueda utilizar un servicio remoto de ese navegador. El micrófono principal del compositor pasa a **dictar texto editable**; sustituye el flujo de grabación a archivo descrito en R02/R03 para ese control. No crea un adjunto, no inicia upload, no utiliza claves o proveedores de Nodia y no envía el mensaje automáticamente. Los modos de ejecución de NodiaAI siguen siendo Agentic y API key; el dictado es entrada de texto previa a la admisión. [ADR086 propuesto](../architecture/decisions/ADR-086-browser-dictation-and-authorized-audio-preview.md) registra la elección técnica sin atribuirle aprobación documental.

### Contrato implementado localmente

- Intención explícita para `SpeechRecognition` o su alias `webkitSpeechRecognition`, según las APIs realmente presentes. Se llama `start()` sin argumento de track, con el idioma actual de la interfaz, resultados continuos e interinos. La ausencia de API o permiso se informa; no se elige otro motor, servicio o modelo automáticamente.
- Se captura el texto existente al iniciar y se reconstruye la transcripción desde la lista completa de resultados finales/interinos de la sesión. Revisar una hipótesis o recibir el mismo resultado no duplica palabras ni el borrador inicial. Se conserva el espaciado existente y sólo se agrega una separación necesaria entre palabras.
- El presupuesto de texto es el límite contractual de 32768 bytes UTF-8, descontando la revisión textual de adjuntos que formaría parte del mensaje. Un resultado que excede el presupuesto se rechaza completo, conserva el último texto aceptado y detiene el dictado con feedback; no se trunca ni divide un carácter para simular éxito.
- `getUserMedia({audio:true})` aporta un stream de micrófono para la actividad visual. `VoiceActivity` dibuja muestras reales del `AnalyserNode` de Web Audio; no es una animación aleatoria, medidor de precisión ni avance de transcripción. No conecta el micrófono a los altavoces. Sin analizador/señal comprobable muestra estado desconocido/no disponible, sin fabricar actividad.
- Estados `idle`, `requesting`, `listening` y `stopping`. Cancelar una solicitud pendiente, cambiar de conversación, deshabilitar el contexto o desmontar aborta el reconocimiento local, libera los tracks propios y descarta callbacks/permisos tardíos por generación/ámbito. Se bloquean inicios dobles. Esto no acredita cancelación ni borrado en un servicio remoto del navegador.
- Detener libera inmediatamente los tracks propios y solicita `stop()`; acepta un último resultado de la misma sesión hasta `onend`. Una ventana local de 5 segundos cierra una espera sin fin, conserva el texto y comunica el timeout. No reinicia el dictado ni repite la solicitud. El textarea vuelve a ser editable al cerrar esa sesión; después el usuario revisa, modifica y decide si envía.
- Denegación, red, servicio, ausencia de voz, idioma no admitido, fallo de captura y error desconocido conservan el texto obtenido y requieren una nueva intención explícita para otro intento. No se transmite una credencial del catálogo Nodia a este flujo ni se promete operación offline, disponibilidad o exactitud de ASR.

Fuentes: [compositor](../../nodia-client/src/modules/nodiaAi/components/ChatComposer/ChatComposer.tsx), [hook](../../nodia-client/src/modules/nodiaAi/components/ChatComposer/hooks/useVoiceDictation.ts), [actividad de voz](../../nodia-client/src/modules/nodiaAi/components/VoiceActivity/VoiceActivity.tsx) y sus pruebas atómicas. La selección de proveedor/mode/modelo del chat y la confirmación de efectos comerciales conservan sus contratos.

### Archivos de audio e historial

«Adjuntar archivo» y el historial siguen admitiendo audio por sus contratos existentes de upload, autorización, modalidad y revisión. [AudioPreview](../../nodia-client/src/modules/nodiaAi/components/AudioPreview/AudioPreview.tsx) permite reproducir un `Blob` ya disponible/autorizado: no hace fetch, upload ni interpretación. En historial, [AttachmentMessage](../../nodia-client/src/modules/nodiaAi/components/Attachments/AttachmentMessage.tsx) obtiene los bytes mediante la lectura autenticada existente. Cambiar de archivo o desmontar pausa el elemento, retira su fuente y revoca la blob URL; un fallo ofrece un reintento local explícito. No se convierten mensajes históricos ni audios manuales en dictado automático y no se amplía la calificación de audio de un proveedor.

### Evidencia y pendientes R07

[Recibo de dictado](../evidence/nodia-ai-voice-dictation-20261029-r01.json): código local implementado y 22 pruebas del hook correctas con APIs simuladas. Cubren interinos/finales, base/espaciado, bytes multibyte, permisos, errores, doble inicio, resultado final tras detener, timeout, navegación y liberación. La suite Client completa pasa con 2166 pruebas/263 archivos; tipos, lint y build correctos. QA con reconocimiento simulado y Web Audio real verifica 320/390/600/1088/1569px en ES/EN y oscuro/claro, sin overflow horizontal, controles44px/gap8px, texto conservado, cierre y ausencia de adjunto/autoenvío. Son comprobaciones de esta revisión, sin acreditar ASR real.

La comprobación ASR real se cerró sin transcripción: Edge156.0.4314.50 devolvió `network` y Chrome156.0.8078.48 `no-speech`, con `start()` exacto, idioma `es-CL`, un inicio por navegador y `text:null` en ambos. La página era aislada, con WAV español sintético y flags de dispositivo/permisos falsos; no era el chat Nodia ni micrófono físico. Se observaron final/end, liberación de tracks y cierre de sesiones; no hubo replay ni fallback. La entrada interna efectiva del reconocedor y la causa de `no-speech` no quedaron demostradas. El detalle temporal original está en `.tmp/browser-dictation-default-start-real.json`; el recibo durable conserva el alcance útil.

**Transcripción real no validada.** Quedan pendientes el habla/micrófono reales del usuario, compatibilidad y permisos por navegador/dispositivo y la UI autenticada en el entorno de uso. La adopción estática R07 en VM se verificó por separado: `nodia-client-voice-dictation-20261029-r01`, 172 archivos, 168 assets actuales/46 anteriores, SPA/API/CORS y túnel5174 correctos. Se respaldó la configuración exacta de Nginx y conservó la release previa; API/worker/knowledge/Native permanecen idénticos, sin inferencia, SQL, login ni reinicios del operador. La entrega HTTP no acredita reconocimiento de voz. La [ficha candidata revisión9](../nodia-ai/knowledge/nodia-ai/features/chat-composer-selection.md) sigue draft/unregistered y `approval:null`; no se publica conocimiento ni se aprueba ADR086 al implementar o probar este flujo.

### Intento real autenticado R02 — 2026-10-29

[Recibo real](../evidence/nodia-ai-voice-dictation-live-20261029-r02.json): se pulsó una vez «Dictar mensaje» en el chat real de localhost5174, interfaz ES y reconocimiento del navegador sin reemplazar. El navegador integrado devolvió «El servicio de dictado del navegador no pudo conectarse» antes de obtener palabras. No se confirmó captura física ni se instrumentó directamente el idioma interno del reconocedor; la causa del error de conexión sigue sin determinar. No hay transcripción positiva ni validación de Stop manual con texto reconocido por este intento.

La UI autenticada conservó sus dos mensajes originales. Se comprobó edición manual del textarea tras el error y se restauró el borrador vacío; eso no se presenta como texto dictado. Observación CDP sin truncado: sólo GET de health, cero peticiones para crear adjuntos o enviar mensajes y ningún clic en Enviar. No apareció tarjeta de adjunto. Sin navegación/reload, cambio de proveedor/ajustes, mocks o retries. El único navegador general conectado era el integrado. La disponibilidad de un servicio de reconocimiento operativo y la prueba positiva de habla/Stop siguen pendientes; los controles sintéticos y los otros intentos negativos conservan sus alcances anteriores.

## Revisión anterior R06: explicación de Preferencias — 2026-10-29

Texto ES/EN simplificado con un ejemplo de categoría habitual de gastos. Nombra los controles «Proponer cambio» y «Proponer borrado» y explica la revisión/confirmación necesaria. Cambio exclusivo de copy, sin ampliar memoria, permisos o herramientas. [Evidencia R06](../evidence/nodia-ai-preferences-copy-20261029-r01.json): Client2126/260, tipos/lint/build y lectura en Edge sintético320/390/600/1569px correctos.172archivos adoptados,168assets nuevos/46históricos verificados, respaldo y fallback conservados; Server/KB/Native sin cambios ni inferencia/SQL del operador.

## Revisión anterior R05: cierre de Preferencias — 2026-10-29

El botón textual Cerrar del panel se sustituye por IconButton X, con label traducido, target44px y el mismo bloqueo/handler. No cambia la memoria aceptada ni su flujo de propuesta/confirmación. Evaluación de impacto: presentación exclusiva sin nuevos contratos, herramientas o interpretación de resultados. [Evidencia R05](../evidence/nodia-ai-preferences-close-20261029-r01.json): Client2126/260, tipos/lint/build y Edge sintético320/390/600/1569px; cierre y borrador conservados. Client172archivos adoptado con respaldo y fallback,168assets actuales y32históricos comprobados; Server/KB/Native intactos y sin SQL/inferencias. La ficha candidata permanece sin aprobación/publicación.

## Revisión anterior R04: título editable en cabecera — 2026-10-29

El título de la conversación incorpora un lápiz. Al editar se sustituye por un campo con IconButtons de aceptar y cancelar, con targets44px, nombre accesible y foco de retorno. Enter guarda y Escape cancela; composición IME, repetición y peticiones pendientes no generan envíos adicionales. No se guarda por blur. El título largo se trunca en vista normal sin expulsar el lápiz; el borrador se conserva al redimensionar.

Se reutiliza el `PATCH` autenticado existente y su revisión esperada, límites/permisos y feedback Sileo. El valor se recorta, admite hasta256bytes UTF-8 y vacío significa `null`. Un fallo conserva el editor y su texto. La revisión queda fijada al abrir; ante cambios concurrentes se exige revisar explícitamente el estado actual, conservando el borrador y sin reintento automático. Los controles permanecen bloqueados cuando el chat está activo, es ajeno/sólo lectura o la autoridad no está vigente. No cambia la semántica de renombrado ni se añade una herramienta IA.

[Evidencia R04](../evidence/nodia-ai-chat-title-20261029-r01.json) conserva verificación y entrega. La ficha candidata no hereda aprobación por este ajuste.

## Revisión anterior R03 por comentarios de navegador — 2026-10-29

La solicitud de ocho ajustes conserva la selección y los contratos existentes. El avatar de los mensajes propios usa la misma imagen y fallback de inicial de Topbar. La cabecera mantiene su geometría al revalidar: la barra de actualización se superpone al borde y, durante un turno activo, el estado se presenta en el globo de NodiaAI.

La actividad pública del turno aparece temporalmente como pasos dentro de ese globo, con el control de detener. Los pasos proceden exclusivamente de los eventos autorizados del servidor y del estado real del run; no representan razonamiento interno ni porcentajes. No existe evento de inicio de herramienta: una consulta sólo se anuncia completada cuando llega `tool_completed`. Al terminar se retiran esos mensajes intermedios y el aviso redundante «Turno completado». La respuesta, resultados guardados, propuestas y sus gates de revisión/confirmación permanecen disponibles; fallos, cancelación e incertidumbre conservan avisos y recuperación.

El compositor reduce el padding interno izquierdo duplicado, mantiene acciones de44px con8px entre micrófono y envío y usa `SendRounded`. Enter envía con las guardas actuales; Shift+Enter agrega una línea. Composición IME, repetición, grabación, bloqueo y recuperación incierta no admiten envíos implícitos. `+` abre un menú accesible cuya primera opción es «Adjuntar archivo»; selección, pegado, grabación y carga mantienen sus políticas vigentes. Escape devuelve el foco al botón.

Verificación y adopción R03 se consolidan en [la evidencia de esta entrega](../evidence/nodia-ai-chat-feedback-20261029-r01.json). La ficha candidata sigue draft/unregistered; no habilita herramientas ni sustituye aceptación de proveedor o teléfono físico.

## Revisión anterior R02 por comentarios de navegador — 2026-10-28

Esta solicitud posterior sustituye la presencia de Contexto y Configuración en la UI descrita abajo: se retiran ambos accesos y se conservan los selectores inline. Preferencias tiene función real (valores aceptados reutilizables sin conceder permisos); se retira de cabecera y pasa como «Preferencias guardadas» al menú de la conversación. No se borran preferencias ni sus APIs/reglas de confirmación. El menú queda dentro de una tarjeta a todo el ancho, arriba a la derecha, con controles hermanos sin botones anidados y foco conservado.

Elegir/pegar archivos o terminar una grabación autoriza ahora la subida automática del original: sólo un archivo local nunca intentado por vez, bajo las condiciones de escritura/autoridad/elegibilidad del chat y la política real de límites. El hook conserva uso manual para otros consumidores; el compositor opta explícitamente al flujo automático. No es una inferencia ni acepta interpretación, OCR o efectos de negocio. Fallos e incertidumbre detienen ese archivo y requieren recuperación explícita con su identidad original; no hay retries automáticos de POST/PUT inciertos. Una revocación pausa los siguientes archivos; no se afirma cancelar remotamente bytes ya enviados.

Adjuntos compactos con miniatura local de imágenes y papelera roja a la derecha (44px). Las blob URLs se liberan al cambiar/quitar el archivo o fallar su vista previa. El editor de contenido se abre con «Revisar contenido»; ediciones sucias/errores se conservan abiertas, sin habilitar envío por sólo subir. La altura del compositor/revisión se contiene con scroll local también al expandir, dejando mensaje/micrófono/envío/selectores alcanzables en móvil. El micrófono añade fondo/borde, hover perceptible/cursor y foco visible.

[Evidencia R02](../evidence/nodia-ai-chat-refinement-verification-20261028-r02.json), [móvil](../evidence/nodia-ai-chat-refinement-mobile-20261028-r02.png) y [escritorio](../evidence/nodia-ai-chat-refinement-desktop-20261028-r02.png). Chromium320–1569px/ES–EN/claro–oscuro sin overflow horizontal; carga/miniatura/borrador, eliminación, menú, preferencias y contención vertical con revisión abierta/cerrada comprobados mediante transporte sintético. Suite completa2067/251 anterior al último plegado y132 regresiones afectadas verificadas tras ese ajuste; tipado/lint/build correctos. La ficha sigue draft y no se despliega ni se acredita almacenamiento/proveedor/teléfono físico.

## Solicitud y presentación

Las dos imágenes aportadas son referencias visuales. No incorporan instrucciones de ejecución ni capacidades nuevas. El chat conserva el theme, tipografía, permisos y componentes del proyecto.

- Mensajes propios alineados a la derecha y respuestas de Nodia AI a la izquierda, con identidad, lectura cómoda y separación clara. Los adjuntos, respuestas parciales, contenido restringido, observaciones y propuestas conservan sus contratos.
- Compositor de texto con acción `+` para elegir archivos y recepción de archivos pegados en el área de escritura. Micrófono a la derecha del texto y envío a su derecha. No incorporar modo Plan.
- Debajo del texto: acceso a Contexto y selección de conexión/proveedor, modo, modelo e intensidad. Mostrar los pasos dependientes al contar con su selección anterior; los valores provienen del catálogo/configuración real.
- Responsive con un solo borrador/árbol de controles; accesibilidad por teclado, nombres accesibles, feedback ES/EN, scroll local y recuperación ante error.

## Selección y predeterminados

Cada conversación puede cambiar su selección entre mensajes. El cambio afecta al siguiente envío y no reescribe el proveedor, modo, modelo o esfuerzo de runs anteriores. Durante un turno, ejecución activa o resultado incierto que conserva ownership no se permite cambiar la selección para eludir recuperación o repetir la solicitud.

Un chat nuevo toma la conexión marcada explícitamente como predeterminada y su modo/modelo/esfuerzo configurados. No utiliza la selección temporal del chat anterior, la primera conexión de una página, el primer modelo descubierto ni un nombre de modelo fijo. Sin predeterminado completo y operativo no se inventa selección; la UI permite completar/corregir la configuración. Tener una configuración no demuestra inferencia disponible.

Elegir otra conexión o modo puede proponer su selección configurada, aislada por instancia y canal. Un esfuerzo ausente sigue ausente; no asignar Medium ni heredar el esfuerzo de otro modelo. Cambios del chat no modifican el predeterminado global de Ajustes IA. Un borrador de selección sin aplicar nunca debe enviarse bajo la selección anterior inadvertidamente; fallos conservan texto, archivos y selección revisable.

## Contratos comprobados antes del cambio

La revisión de fuentes identificó estas garantías y la brecha que debe resolver la implementación:

| Área | Fuente | Hecho comprobado |
|---|---|---|
| Creación | `nodia-server/src/nodia-ai-conversation/dto/create-nodia-ai-conversation.dto.ts` y `use-case/create-nodia-ai-conversation.use-case.ts` | DTO acepta selección opcional; el corte inicial sólo guarda la recibida y deja null si se omite. No resuelve predeterminado automáticamente. |
| Catálogo | `nodia-server/src/nodia-ai-conversation/nodia-ai-connections.service.ts` y `use-case/list-nodia-ai-connections.use-case.ts` | Proyecta selección configurada por modo y modelos/opciones reales; el corte inicial no publica `is_default` ni `default_mode`. No inferirlos por orden. |
| Cambio de selección | `nodia-server/src/nodia-ai-conversation/use-case/update-nodia-ai-conversation.use-case.ts` | Valida revisión, rechaza `active_job_id`, guarda IDs exactos y retira routing histórico. |
| Admisión | `nodia-server/src/nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case.ts` | Revalida revisión/autoridad y congela `selection_snapshot`, contexto, routing y presupuesto en el run admitido. |
| Historial de ejecución | `nodia-server/src/nodia-ai-conversation/use-case/project-nodia-ai-run.use-case.ts` | Proyecta la selección congelada y presupuestos reales. Los contadores son operaciones, no tokens. |
| Adjuntos y voz | `useAttachmentDrafts`, `ChatComposer/hooks/useVoiceDictation.ts`, `VoiceActivity` y `AudioPreview` | R07: micrófono principal a texto editable por navegador, sin adjunto/autoenvío; audio manual/histórico conserva upload/revisión/lectura autorizada. La grabación a archivo de R02/R03 queda como corte anterior para el micrófono principal. |

La resolución inicial del predeterminado debe implementarse de forma explícita en Server o mediante un contrato público que proporcione sus datos reales. No requiere modificar permisos, ejecución de herramientas, transporte de inferencia ni credenciales.

Implementación local posterior a esa revisión: Server resuelve ahora el predeterminado dentro de la creación autenticada, después de recuperar una solicitud ya existente y sin consultar inferencia. La consulta acotada de predeterminado exige una única conexión marcada y usa el mismo manager; una ambigüedad histórica deja selección null. La identidad idempotente conserva la solicitud original, por lo que cambiar el predeterminado después no cambia una conversación ya creada. El catálogo publica `is_default` y `default_mode` (`agentic`/`api_key`/null), sin rehabilitar modos retirados.

El helper común `nodia-ai-configured-selection.ts` conserva selección explícita, preferencia por modelo y null, y no hereda campos raíz históricos. API key vuelve a exponer Bajo/Medio/Alto como preferencias configurables también para OpenAI, conforme al contrato de proveedores; esas opciones no se presentan como soporte de inferencia observado. Codex Agentic conserva exclusivamente sus esfuerzos descubiertos por modelo.

## Contexto y veracidad

Contexto permite consultar información disponible del chat y explicar qué utiliza el turno: historial autorizado según las políticas existentes, texto del mensaje y archivos válidos del envío. Las fuentes no prometen enviar el historial completo ni releer originales de mensajes anteriores automáticamente. Las notas de revisión de un archivo son datos; el contenido adjunto no concede herramientas, permisos ni confirmación.

El contrato público actual no entrega tokens consumidos, ventana máxima del modelo, porcentaje de llenado ni un contador exacto del prompt. No mostrar un anillo de consumo, `0/10k` o una estimación disfrazada de medición. Los campos de presupuesto de run, si se presentan, deben conservar su unidad real. Tampoco mostrar razonamiento interno o duración/número de pasos inventados por imitar las imágenes.

En R07 el micrófono principal produce texto revisable mediante el reconocimiento del navegador, con la posibilidad remota aceptada expresamente; no produce un archivo ni una inferencia del proveedor Nodia. Los archivos de audio elegidos manualmente conservan las comprobaciones de tamaño, duración, modalidad y revisión de adjuntos. Pegar archivos no evita upload, autorización, calificación del formato o gates de revisión. Texto pegado sin archivos conserva el comportamiento normal del input.

## Verificación y límites

- [x] Solicitud registrada y contratos iniciales contrastados sin inferencias ni efectos comerciales.
- [x] Predeterminado completo/incompleto/ausente, modo retirado/inactivo, ausencia de fallback y recuperación idempotente de creación comprobados en unidades sintéticas.
- [x] Cambio de conexión/modo/modelo/esfuerzo conserva selección explícita, borrador e historial; rechazo activo/conflicto no pierde datos.
- [x] Elegibilidad de selección exacta, histórico/valores ausentes, catálogo inválido, caída y reintento comprobados.
- [x] Elegir/pegar archivos y grabar/detener pasan por las guardas actuales; doble envío y resultado incierto conservan identidad.
- [x] UI verificada en móvil/escritorio, claro/oscuro, ES/EN y teclado, con evidencia de la implementación local.
- [x] Tipado, lint, pruebas y build de los proyectos afectados completados; build de conocimiento sin publicación de borradores.

Las pruebas de frontend con fixtures no acreditan inferencia, micrófono físico, almacenamiento cloud, despliegue ni aceptación productiva. La selección entre mensajes no solicita nuevas inferencias de proveedor durante este rediseño y no reabre el carril de generación de imágenes API aplazado en plan92. La verificación final debe registrar sus resultados y pendientes concretos aquí o en evidencia durable enlazada, sin modificar recibos históricos.

Verificación backend local: 77 pruebas focales correctas en cuatro archivos (configuración/defaults, creación, catálogo y elegibilidad); `tsc --project tsconfig.build.json --noEmit --incremental false` correcto; lint correcto con el aviso previo `no-unsafe-finally` de `test/nodia-ai-live-unknown.fixture.mjs`. El `tsc --noEmit` genérico incluye suites históricas con errores de tipos ajenos a este cambio y no pasó; no se usa como evidencia de un tipado global aprobado. Las unidades no demuestran locks SQL ni arranque completo; el cierre local añade seis comprobaciones de DI con código compilado y persistencia sintética, sin DB ni red.


## Cierre de implementación local — 2026-10-28

[Evidencia consolidada](../evidence/nodia-ai-chat-redesign-verification-20261028-r01.json), [móvil 390px](../evidence/nodia-ai-chat-redesign-390-dark-es-20261028.png) y [escritorio 1440px](../evidence/nodia-ai-chat-redesign-1440-light-en-20261028.png).

Client: 2055 pruebas/250 archivos correctos, typecheck, lint y build correctos. Incluye unidades de mensajes/compositor/selectores y las regresiones existentes de recuperación, ownership, revisiones, voz y adjuntos. Nuevas pruebas de transporte comprueban el predeterminado recibido al crear sin abrir modal y un cambio de proveedor entre dos mensajes conservando la selección histórica. Server: 77 pruebas focales/4 archivos y seis comprobaciones de DI compilada sintética; tipado del target de build, lint y build correctos. El aviso previo de lint indicado arriba y el aviso de bundle Vite mayor a500kB no se presentan como fallos corregidos.

Chromium con fixtures aisladas: 320/360/390/430/599/600/768/899/900/1440px, alternando ES/EN y claro/oscuro; sin overflow horizontal, áreas de acción de44px, micrófono antes del envío, usuario a la derecha/asistente a la izquierda y borrador conservado al redimensionar. Interacciones separadas comprueban Contexto/Escape, cambio de modo aplicado y PDF pegado visible sin perder texto, con una sola mutación de selección sintética y cero POST de inferencia o uploads remotos.

Knowledge check/build correctos:68fuentes,25excluidas,43documentos/45fragmentos y release8c41c654…; la nueva ficha draft queda excluida de publicación. No se altera la aprobación documental por completar el código. No se desplegó, no hubo inferencia/SQL/cloud real ni pruebas de micrófono, teclado virtual o Safari en teléfono físico; esos alcances permanecen pendientes y no bloquean este cierre local. Se observó un warning de desarrollo React en el camino de coordinación previo; no se atribuye una causa nueva sin evidencia.


## Arranque local para prueba humana — 2026-10-28

[Recibo de arranque](../evidence/nodia-ai-local-backend-startup-20261028-r01.json): se abrió la aplicación real en localhost5174 y se iniciaron API/worker/DB/cache/Native desde la configuración local existente. La base necesitaba las migraciones del chat; se respaldó, contrastó su historial legado y actualizó preservando claves y dominio. HTTP y sesión nativa observados no equivalen a un envío real o aceptación del rediseño con proveedores. El operador no inició login/inferencia. No se desplegó la UI/Server en VM; Codex Agentic conserva su rechazo Windows y no se eligió sustituto.

## Adopción posterior en VM solicitada — 2026-10-28

[Recibo VM](../evidence/nodia-ai-chat-vm-adoption-20261028-r01.json). Client y Server del rediseño están adoptados en Linux; el navegador accede por `localhost:5174`→SSH→Nginx8080 y API relativa `/api/v1`. Se detuvo únicamente el Vite Windows que ocupaba5174 al conectar el túnel. La VM conserva sus proveedores, claves, modelos y sesiones, sin importar configuración local ni elegir sustitutos.

La inspección identificó el runtime vigente `nodia-server-codex-model-catalog-r01`, posterior al corte OCR R02: se preservó, incluido su arreglo procfs ESRCH/ENOENT. El candidato nuevo cambia cuatro fuentes de producción del chat, una fixture sintética y sus emitidos/declaración transitiva: 4124 archivos idénticos, 16 modificados, cuatro nuevos y cero retirados. Compilación Linux, 63 casos focales en cuatro archivos y seis checks de DI compilada correctos. El build Client actual y sus 25 assets iniciales servidos coinciden por SHA256. Nginx conserva la cadena de assets históricos y el origen autorizado5174.

Antes de abrir el runtime se verificó quiet SQL/nativo y el respaldo cifrado fresco; después se comprobaron estabilidad API/worker30s, 65 fingerprints/32 migraciones intactos, knowledge `ad41d3…` (43 documentos/45 fragmentos/151 capacidades), época Native sin reinicio, backup writer/timers y respaldo posterior cifrado. No se ejecutaron migraciones, logins o inferencias del operador; HTTP200, catálogo y sesión no acreditan disponibilidad de cada modelo, herramienta o MIME. Las pruebas humanas del chat real y el teléfono físico conservan ese límite. La ficha candidata continúa draft, sin aprobación/publicación implícitas.

## Cierre R03 — 2026-10-29

Client2118/259, tipado/lint/build y10casos offline correctos. Edge/Chromium con transporte sintético verifica320/390/599/600/900/1569px, temas/idiomas alternados, teclado, foco, borrador y geometría estable. [Recibo R03](../evidence/nodia-ai-chat-feedback-20261029-r01.json) distingue fixtures de operación real. Client `nodia-client-chat-feedback-20261029-r01` adoptado:172archivos,168assets actuales y46históricos comprobados, HTML/API/CORS correctos y respaldo exacto Nginx/release previa íntegra. API/worker/KB/Native conservados; ninguna inferencia, sesión o SQL del operador. UI autenticada, dispositivo/teclado virtual físico y aceptación global mantienen sus límites. Ficha candidata revisión5 sin aprobación/publicación.


Observación responsive R07: con320px y un borrador de225caracteres, durante la escucha los selectores deshabilitados pueden extenderse61px fuera del formulario/52px fuera de la tarjeta. Micrófono/Stop, texto y envío permanecen visibles; al terminar recuperan su disposición, con0px de recorte medido en idle/afterStop. Este detalle visual sigue pendiente de refinamiento; no se presenta la QA como aceptación de todo dispositivo.
