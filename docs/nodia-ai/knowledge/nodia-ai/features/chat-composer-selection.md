---
{
  "schema_version": 1,
  "document_id": "nodia-ai.chat-composer-selection",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 10,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "R02 desplegado en VM por solicitud explícita: compositor y selección entre mensajes, miniaturas/papelera y subida serial sin replay. Client/API/worker Linux verificados, datos y sesiones conservados; sin inferencia ni calificación nueva de modelos. R03: avatar común, actividad temporal, cabecera estable y teclado/menú del compositor implementados y adoptados sólo en Client, con Server y KB preservados. R04 incorpora renombrado inline en cabecera mediante el PATCH existente, revisión fijada y borrador recuperable. R07: dictado explícito del navegador a texto editable, posible servicio remoto aceptado, onda desde Web Audio y reproducción local de audio manual/histórico implementados localmente. El micrófono principal no crea adjuntos ni autoenvía; Client estático R07 adoptado y verificado por HTTP, con API/worker/KB/Native preservados; transcripción real no validada. R08: presentación Markdown limitada al texto visible del asistente y recarga de elegibilidad por IconButton44px implementadas, con QA integrada/visual y adopción estática R08 verificadas. No cambia el motor de dictado ni aplica un restablecimiento de permiso."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/93-nodia-ai-chat-composer-redesign.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/78-nodia-ai-ai32-attachments-voice.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/nodia-ai-configured-selection.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/update-nodia-ai-conversation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/pages/NodiaAI/NodiaAI.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ChatComposer/ChatComposer.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ComposerSelection/ComposerSelection.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ChatMessage/ChatMessage.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/Attachments/AttachmentDraftPreview.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/Attachments/hooks/useAttachmentDrafts.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ConversationHistory/ConversationHistory.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ConversationTitle/ConversationTitle.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/Preferences/Preferences.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-086-browser-dictation-and-authorized-audio-preview.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ChatComposer/hooks/useVoiceDictation.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/VoiceActivity/VoiceActivity.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/AudioPreview/AudioPreview.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/Attachments/AttachmentMessage.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/MessageMarkdown/MessageMarkdown.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/MessageMarkdown/styles.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-29",
    "evidence_paths": [
      "docs/evidence/nodia-ai-chat-redesign-verification-20261028-r01.json",
      "docs/evidence/nodia-ai-chat-refinement-verification-20261028-r02.json",
      "docs/evidence/nodia-ai-local-backend-startup-20261028-r01.json",
      "docs/evidence/nodia-ai-chat-vm-adoption-20261028-r01.json",
      "docs/evidence/nodia-ai-chat-feedback-20261029-r01.json",
      "docs/evidence/nodia-ai-chat-title-20261029-r01.json",
      "docs/evidence/nodia-ai-preferences-close-20261029-r01.json",
      "docs/evidence/nodia-ai-preferences-copy-20261029-r01.json",
      "docs/evidence/nodia-ai-voice-dictation-20261029-r01.json",
      "docs/evidence/nodia-ai-voice-dictation-live-20261029-r02.json",
      "docs/evidence/nodia-ai-chat-markdown-20261029-r01.json"
    ],
    "notes": "R02: suite Client2067/251 antes del plegado final;132 checks afectados finales, build/tipado/lint y Chromium320–1569px correctos. Upload/recuperación sintéticos; no SQL/storage/inferencia real o teléfono físico. Arranque local posterior de API/worker/DB/cache/Native verificado sin inferencia; login/UI real con proveedor pendientes. Codex Agentic no soportado en Windows; selección del modo retirado queda null. Adopción posterior VM: Server desde baseline real Codex Model Catalog, Linux tsc/63 casos/6 DI, Client compilado y25 assets servidos exactos. SQL65/32 y knowledge/época Native preservados, respaldos cifrados antes/después, API/PG/Redis/Native saludables y túnel5174. No se hicieron logins/inferencias ni se publicaron borradores; la prueba humana con proveedor sigue separada. R03: Client2118/259, tipos/lint/build y diez casos offline correctos; Edge sintético320–1569px, gap8px y header97px estable.172archivos entregados/168assets actuales y46históricos comprobados. Sin inferencias, auth o SQL durante esta adopción; proveedores y teléfono físico conservan límites. R04: Client2126/260, ocho regresiones atómicas, tipos/lint/build y Edge sintético320/390/600/1088/1569px correctos; Client estático adoptado sin reiniciar Server/Native ni nuevas inferencias. R05: cierre visual de Preferencias por X verificado en cuatro perfiles de navegador sintético,2126/260 y delivery estático; sin cambiar memoria/consentimiento. R06: explicación de Preferencias ES/EN con ejemplo y pasos de cambio/borrado,2126/260 y lectura responsive comprobada; únicamente copy, sin cambio funcional. R07: 22 regresiones del hook pasan con APIs simuladas. ASR real aislado Windows con start() exacto y WAV/dispositivo sintéticos: Edge156.0.4314.50 network y Chrome156.0.8078.48 no-speech; text:null ambos, terminal/end y cleanup observados, sin replay ni fallback. No micrófono físico ni transcripción real aceptada. Client2166/263, tipos/lint/build correctos; diez perfiles de geometría/idioma/tema y dictado simulado con señal Web Audio real conservan texto/stop/sin autoenvío. VM R07 adoptada:172archivos/168assets actuales/46previos y túnel5174 verificados, respaldo/fallback conservados y Server/KB/Native sin cambios. HTTP/fixtures no acreditan ASR real ni UI autenticada de usuario. R08: Client2187/264,30 regresiones Markdown/ChatMessage,59 de página, tipos/lint/build y10offline correctos. Diez perfiles320–1569px ESoscuro/ENclaro y scroll local por teclado verificados;173archivos/169assets actuales/46previos y túnel5174 adoptados con respaldo/fallback. Historial real autenticado con título/tabla/negritas sin mensajes ni confirmaciones; Server/KB/Native preservados. Limitaciones de consola, bundle y dispositivo físico en el recibo. Permiso nativo de localhost5174 observado granted; reset autorizado rechazado como tool_method_not_supported, no aplicado ni confirmado, sin otros cambios de permisos ni reconocimiento/captura nuevos en esta revisión. R02 real autenticado anterior terminó en network sin transcripción; sólo edición manual posterior comprobada."
  },
  "approval": null
}
---

# Chat, compositor y selección por conversación — contexto funcional para NodiaAI

## Qué resuelve y qué significa

La UI presenta mensajes propios a la derecha y respuestas de Nodia AI a la izquierda, con archivos/pegado y, desde R07, dictado del navegador a texto editable. R08 añade Markdown sólo al texto autorizado del asistente y una recarga de elegibilidad compacta, sin alterar contenido persistido o enviado. Contexto y Configuración, previstos en la solicitud inicial del 2026-10-28, se retiraron en R02; la selección se mantiene junto al compositor. La conexión representa una instancia configurada; el catálogo del proveedor no sustituye esa identidad. Los únicos modos de ejecución de NodiaAI son Agentic y API key; el dictado es entrada de texto y no otro modo.

La selección del chat puede cambiar entre mensajes; cada run admitido conserva su selección exacta anterior. Server resuelve ahora la nueva conversación desde el predeterminado configurado, sin heredar cambios temporales de otra conversación ni fabricar modelos. Una repetición idempotente recupera la misma conversación aunque después cambie el predeterminado. La revisión inicial y el cambio local están documentados en [plan93](../../../../mvp/93-nodia-ai-chat-composer-redesign.md).

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Usa otra conexión para el siguiente mensaje» | Cambiar selección del chat | Instancia, modo y modelo válidos | Elegirlos en los controles autenticados; el texto solo no confirma el cambio. |
| «Crea otro chat con mi configuración habitual» | Nueva conversación | Predeterminado ausente o incompleto | Mostrar configuración sin asignar y permitir completarla; no escoger otra conexión silenciosamente. |
| «Adjunto esta factura» | Añadir archivo al envío | Tipo, estado y modalidad elegible | Reutilizar upload/revisión/OCR vigentes según la selección exacta. |
| «Guarda mi API key aquí» | Credencial sensible | No procede recibirla en chat | Remitir a Ajustes IA y su flujo seguro; no registrar la clave como mensaje o contexto. |

## Operaciones y contratos

| Operación semántica | Clase/efecto | Herramienta y estado real | Endpoint/DTO/caso de uso | Resultado público |
|---|---|---|---|---|
| Crear conversación | Persistencia del chat, sin inferencia | Coordinación autenticada; no herramienta nueva del modelo | `CreateNodiaAiConversationDto` / `CreateNodiaAiConversationUseCase` | Conversación y selección nullable. |
| Elegir conexión/modo/modelo/esfuerzo | Configuración del chat | Coordinación autenticada; no cambia predeterminado global | `PATCH /nodia-ai/conversations/:id/selection`, `UpdateNodiaAiSelectionDto` / `UpdateNodiaAiConversationUseCase.selection` | Revisión actualizada y selección exacta. |
| Enviar mensaje | Admisión y posterior inferencia con presupuesto/coste existentes | Runtime común92, ToolGateway y confirmación humana conservados | `AdmitNodiaAiMessageUseCase` | Mensaje/run con snapshots e identidad idempotente. |
| Elegir/pegar archivo, incluido audio manual | Borrador y upload por la política existente | Flujo78; no concede lectura nativa por sí mismo | `useAttachmentDrafts`; contratos de adjuntos78 | Archivo validado, revisión o capacidad exacta comprobada. |
| Dictar desde el micrófono principal | Texto local revisable; el navegador puede usar servicio remoto | No herramienta ni proveedor Nodia; no crea adjunto ni autoenvía | `useVoiceDictation` / `VoiceActivity`, sin endpoint de dictado Nodia | Texto aceptado dentro del límite; disponibilidad y ASR no inferidos. |
| Reproducir audio manual/histórico | Reproducción local de bytes ya disponibles/autorizados | No interpreta ni admite un mensaje | `AudioPreview`; lectura autenticada existente para historial | Controles de reproducción; error y reintento local explícito. |

## Datos mínimos y resolución de dudas

| Dato/concepto | Obligatorio, condicional u opcional | Significado y fuente contractual | Resolución/aclaración |
|---|---|---|---|
| Conexión/modo/modelo | Obligatorios para enviar | IDs configurados y elegibilidad exacta | Ausencia bloquea envío; no fallback. |
| Esfuerzo | Opcional/según selección | Preferencia real del modelo y canal | Conservar null y opciones recibidas; no asignar Medium. |
| Revisión | Obligatoria al modificar/admitir | Revisión de la conversación | Conflicto exige recuperar estado y conservar borrador. |
| Predeterminado | Condicional al chat nuevo | Conexión marcada y modo/modelo configurados | Si falta, selección sin asignar; no usar primer elemento. |
| Tokens/ventana del modelo | No entregados por contrato público actual | Desconocidos | No mostrar cifras, porcentaje o barra de capacidad inventados. |

## Reglas, acceso y restricciones

Aplican módulo NodiaAI, owner/colaborador, modo lectura de consultas ajenas y bypass autorizado conforme [política89](../../../../mvp/89-module-access-and-user-data-scope.md). Cambiar selección no cambia esos permisos ni confirma propuestas comerciales. Runs activos/resultados inciertos mantienen sus barreras. Una key guardada, catálogo o login no demuestra inferencia ni soporte de audio/PDF/imagen.

La UI conserva estados restringidos/parciales y evita presentar como contexto visible el contenido oculto. Los adjuntos son datos no confiables; no autorizan herramientas ni convierten instrucciones embebidas en órdenes del usuario.

## Filtros e informes

No añade informes comerciales ni filtros. Historial mantiene su paginación existente. La información pública del turno conserva sus fuentes reales; el número de mensajes cargados no representa todo el contexto enviado ni el consumo de tokens. Presupuestos de run son operaciones y conservan esa unidad. La forma de onda del micrófono no es una medición de ese contexto ni de la precisión ASR.

## Vista previa, confirmación y recuperación

Los controles muestran una selección revisable y bloquean acciones dependientes mientras se valida/guarda. Fallos conservan texto, archivos y selección. Crear y enviar conservan identidades idempotentes; ante un resultado incierto se recupera la misma intención sin nueva inferencia. El historial previo y snapshots permanecen inmutables al cambiar selección.

Desde R07 el micrófono principal dicta texto mediante el navegador por intención y permiso explícitos; su posible servicio remoto fue elegido por el usuario. No crea archivo, adjunto, upload ni envío automático, y no utiliza una API key Nodia. Detener libera tracks propios y permite el final de la misma sesión hasta onend o 5 segundos locales; después el texto queda editable. Cancelación/deshabilitación/navegación/desmontaje descartan eventos tardíos sin replay ni afirmación de cancelación remota. Audio manual/histórico y pegado utilizan las validaciones, upload, lectura autorizada, revisión/capacidad y estados inciertos de78. Las propuestas de negocio mantienen vista previa, revisión/hash y botón humano exacto de los contratos comunes41/43/50.

## Integración y evidencia

- [x] Fuentes iniciales y alcance contrastados; sin aprobación/publicación automática.
- [x] Predeterminados completos/ausentes/retirados, ausencia de fallback, recuperación idempotente y catálogo verificados con unidades sintéticas backend.
- [x] Selección entre turnos y conservación de borradores verificadas por los alcances UI/fixtures R02..R06 enlazados.
- [x] Ciclo local R07 de dictado, errores, interinos/finales, bytes y permisos tardíos cubierto por 22 pruebas con APIs simuladas.
- [x] Path explícito presente en source_paths; sin binding ni capacidades publicados para esta ficha candidata.
- [x] Suite integrada/QA visual R07 en ES/EN y tamaños afectados cerrada por el recibo de esa revisión; reconocimiento simulado y señal Web Audio no acreditan ASR real.
- [ ] Transcripción ASR real con habla/micrófono del usuario, sin sustituir los negativos Edge/Chrome por éxito simulado.
- [x] Adopción estática/smoke HTTP de R07 en VM comprobados con runtime protegido conservado; compatibilidad ASR por navegador/dispositivo sigue pendiente.
- [ ] Cierre R08 de Markdown, suite integrada, QA visual/teclado y adopción/smoke de la nueva presentación en VM.

No incorpora una herramienta nueva. La ficha es candidata y debe seguir excluida del contexto publicado hasta aprobación y verificación correspondientes. No acredita proveedor real, micrófono físico, R2 o despliegue por existir la nueva presentación.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Solicitud del compositor y chat registrada en plan93; fuentes existentes contrastadas | Coordinación UI y selección del chat; sin herramienta nueva | Snapshots e historial conservados; aprobaciones comerciales independientes. Verificación final y publicación pendientes. |
| 9 | Plan93 R07: dictado navegador con posible servicio remoto aceptado y reproducción de audio autorizado | Entrada de texto y presentación de audio; sin herramienta/endpoint/proveedor Nodia nuevos | Sustituye micrófono→archivo de cortes previos; no reinterpreta audio histórico ni altera confirmación. ASR positivo pendiente; adopción estática VM R07 comprobada, sin inferir disponibilidad ASR; draft/unregistered, approval:null. |
| 10 | Plan93 R08: Markdown del asistente y recarga de cabecera por icono; permiso observado sin reset aplicado | Presentación UI y comprobación existente; sin nueva herramienta, inferencia o motor | Contenido literal de usuario/adjuntos/restringido, datos persistidos y confirmación intactos. QA y VM R08 pendientes; draft/unregistered, approval:null. |


## Ajustes de UI R02

Contexto y Configuración se retiran por la solicitud posterior del usuario. Las preferencias aceptadas conservan su función y se abren desde el menú de la conversación. Miniaturas locales, papelera y subida automática sustituyen los botones iniciales; los archivos siguen pasando por límites/autoridad, revisión/native/OCR y recuperación explícita si su resultado es incierto. Subir no equivale a interpretar ni confirma efectos. El editor se abre bajo intención y conserva las correcciones; el compositor queda contenido en móvil. Ver [plan93](../../../../mvp/93-nodia-ai-chat-composer-redesign.md) y evidencia R02.

## Ajustes de interacción R03 — 2026-10-29

El avatar propio comparte imagen e inicial de Topbar. Los eventos públicos se presentan como pasos en un globo temporal de NodiaAI y desaparecen al terminar; la respuesta final, resultados, propuestas, errores y recuperación mantienen sus contratos. No se muestra razonamiento privado ni se inventa el inicio de una herramienta. La cabecera conserva su altura durante refetch.

Enter envía y Shift+Enter añade una línea; IME, repetición y estados bloqueados no disparan admisión. La recuperación incierta exige su acción explícita. `+` abre el menú «Añadir al mensaje» con «Adjuntar archivo», sin cambiar selección/pegado/voz ni los gates de los adjuntos. Se reduce padding y se separan micrófono/envío8px. Evaluación de impacto: cambia presentación e interacción del chat; no modifica herramientas, permisos, interpretación de resultados, contexto enviado ni confirmación humana. [Evidencia R03](../../../../evidence/nodia-ai-chat-feedback-20261029-r01.json). La revisión5 permanece candidata sin aprobación/publicación.

## Título inline R04 — 2026-10-29

El lápiz de cabecera abre un campo y botones aceptar/cancelar; Enter guarda, Escape cancela. Un error conserva el texto y una revisión concurrente exige lectura explícita sin perderlo. Usa el renombrado existente, sin ampliar herramientas/permisos ni cambiar datos comerciales. [Plan93 R04](../../../../mvp/93-nodia-ai-chat-composer-redesign.md) y [evidencia](../../../../evidence/nodia-ai-chat-title-20261029-r01.json). Evaluación de impacto: sólo acceso/presentación del renombrado y controles de edición, con contrato e interpretación iguales. Ficha revisión6 draft/unregistered, approval:null.

## Evaluación visual R05 — 2026-10-29

Cerrar pasa a IconButton X en Preferencias. Se conservan nombre accesible, bloqueo y handler. No afecta conceptos, operaciones, contexto enviado ni interpretación de resultados; no requiere herramienta nueva. [Evidencia](../../../../evidence/nodia-ai-preferences-close-20261029-r01.json). La ficha aprobada de preferencias permanece intacta; esta candidata revisión7 sigue draft/unregistered y approval:null.

## Evaluación de copy R06 — 2026-10-29

La explicación de Preferencias añade un ejemplo de categoría de gastos y los pasos de proponer cambio/borrado y confirmar. Sólo explica el contrato vigente; no cambia contexto, capacidades, consentimiento ni interpretación de resultados. [Evidencia](../../../../evidence/nodia-ai-preferences-copy-20261029-r01.json). La ficha aprobada de preferencias3 conserva su hash; candidata8 draft/unregistered, approval:null.


## Dictado a texto y audio autorizado R07 — 2026-10-29

El usuario eligió explícitamente el dictado del navegador aceptando un posible servicio remoto. SpeechRecognition o su alias disponible usa el idioma real de la UI y resultados continuos/interinos. Reconstruir el texto desde la base capturada y el snapshot completo de resultados evita duplicar hipótesis/finales. El límite de 32768 bytes UTF-8 descuenta el texto revisado de adjuntos del mensaje; se rechaza completo el resultado excedido y se conserva el último aceptado. El usuario revisa/edita tras cerrar el dictado y elige Enviar; el micrófono no hace esa admisión.

La onda de VoiceActivity procede de muestras de Web Audio del stream explícito de micrófono, sin salida a altavoces. No representa progreso ni precisión ASR; falta de señal/analizador se comunica sin animación inventada. Se libera el stream propio al detener/cancelar, invalidar ámbito o desmontar. Detener acepta un final del mismo capture hasta onend o 5 segundos; errores/timeouts no reinician reconocimiento ni seleccionan otro proveedor.

AudioPreview reproduce sólo un Blob local ya disponible/autorizado. Audio manual e histórico conserva el flujo de adjuntos78 y las capacidades exactas de su selección; reproducir no interpreta, no vuelve a subir ni hereda una calificación de audio del dictado. Cambio/desmontaje pausa el reproductor y revoca su URL; el retry explícito es sólo de reproducción local.

Código local implementado y 22 regresiones sintéticas del hook correctas. En ASR real aislado, Edge156 devolvió network y Chrome156 no-speech usando start() exacto, es-CL y WAV/dispositivo falsos; text:null y terminal/end en ambos, sin micrófono físico, retry ni fallback. No se demostró la ruta interna del WAV ni una causa del no-speech. **No hay transcripción real validada.** La adopción estática de R07 en VM está comprobada por su recibo, sin acreditar el servicio ASR. [Evidencia por alcance](../../../../evidence/nodia-ai-voice-dictation-20261029-r01.json), [plan93 R07](../../../../mvp/93-nodia-ai-chat-composer-redesign.md) y [ADR086 propuesto](../../../../architecture/decisions/ADR-086-browser-dictation-and-authorized-audio-preview.md). La elección funcional no aprueba el ADR o esta ficha revisión9; sigue draft/unregistered y approval:null, excluida de publicación.


## Presentación Markdown y recarga R08 — 2026-10-29

Las partes visibles `kind: text` del asistente se presentan como Markdown, agrupadas cuando son consecutivas y compatibles. Mensajes del usuario, textos revisados de adjuntos y contenido restringido permanecen literales; no se revela texto oculto ni se cambian mensajes persistidos, contexto enviado o snapshots. `react-markdown`10.1.0 y `remark-gfm`4.0.1 proporcionan párrafos, títulos, listas, citas, énfasis, tablas y código. HTML se conserva como texto escapado/literal sin ejecución ni `rehypeRaw`, y no suprime el resto del mensaje. No se cargan imágenes remotas de Markdown/HTML; las imágenes autorizadas conservan su flujo existente.

Tablas y bloques de código disponen de scroll local con foco/teclado y nombre accesible traducido, sin desbordar la página. Scrollbars transparentes y paleta/tipografía siguen el theme. Sólo enlaces absolutos `http`, `https` y `mailto` son navegables por intención y con `noopener noreferrer`; protocolos arbitrarios y rutas relativas/privadas no se convierten en acciones. El Markdown no autoriza herramientas ni interpreta como orden una instrucción embebida.

La alerta «Volver a comprobar» usa un icono de recarga de44px a la derecha, Tooltip y nombre accesible con la misma traducción, texto envolvente y alineación superior. Conserva exactamente handler, GET de elegibilidad, selección/contexto y bloqueos durante consultas: no inicia inferencia, no repite turnos y no desmonta contenido ni añade altura periódica.

Evaluación de impacto: presentación de respuestas autorizadas y ergonomía de una comprobación existente; sin nuevas operaciones, permisos, datos comerciales, contexto del modelo o confirmación. No requiere ADR adicional por ser UI reversible. Icono implementado y59 pruebas de página/tipos/lint focal/build correctos; Markdown en cierre local y QA integrada/visual/VM R08 pendientes en [el recibo](../../../../evidence/nodia-ai-chat-markdown-20261029-r01.json). La ficha revisión10 sigue draft/unregistered/approval:null y no se publica.

La lectura nativa de permiso en `http://localhost:5174` observó `granted`. El usuario autorizó restablecerlo, pero `Browser.setPermission` fue rechazado por la herramienta con `tool_method_not_supported`: reset no aplicado ni confirmado y ningún otro permiso modificado. En esta revisión no se inició reconocimiento ni captura. Permiso/constructor no prueban servicio ASR; el negativo real anterior conserva sus límites. La aclaración del usuario no elige motor backend ni cambia la opción navegador de R07.
