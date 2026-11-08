---
{
  "schema_version": 1,
  "document_id": "nodia-ai.image-generation",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 4,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "API chat code and common permission/confirmation/runtime contracts implemented. Real provider/model/media qualification and VM adoption require their separate receipts; documentary approval does not certify all151 operations."
  },
  "integration_status": "verified",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/types/image-generation-command.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-attachment/use-case/store-nodia-ai-generated-image.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-runtime.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-generated-image.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/Attachments/AttachmentMessage.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/evidence/nodia-ai-agentic-image-generation-20261026-r01.json",
      "docs/evidence/nodia-ai-agentic-commercial-cancellation-retention-20261026-r01.json",
      "docs/evidence/nodia-ai-agentic-image-security-validation-20261026-r01.json",
      "docs/evidence/api-chat-knowledge-review-r01.json",
      "docs/evidence/api-chat-knowledge-review-r02.json",
      "docs/evidence/api-chat-sql-runtime-r01.json",
      "docs/evidence/api-chat-knowledge-human-approval-r01.json"
    ],
    "notes": "Approved successor/new explanatory revision;19 real isolated PostgreSQL runtime checks and local source/contract regressions verified. Full common-gateway SQL, live API/media and coordinated adoption are separate technical gates. Approved body unchanged from R02."
  },
  "approval": {
    "reference": "docs/evidence/api-chat-knowledge-human-approval-r01.json",
    "revision": 4,
    "content_sha256": "e30416fbf06f2b0af45962b5d842d6f339ef7df4717eef0c78773711eab2cdaa"
  }
}
---

# Generación de imágenes — contexto funcional para NodiaAI

## Ampliación API key — 2026-10-27

[Plan92](../../../../mvp/92-nodia-ai-api-chat-parity.md), [ADR-084](../../../../architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md) y [paridad API](api-key-chat-parity.md) definen esta ampliación. Aprobación documental, implementación, calificación técnica y adopción por entorno se acreditan por separado en sus metadatos e informes fechados. Los [originales anteriores](../../../../evidence/api-chat-knowledge-originals-catalog-r01.json) conservan sus bytes y aprobaciones históricas; no se revocan ni se sustituyen sus evidencias por un resultado inventado.

API OpenAI/Gemini reutiliza catálogo, ToolGateway, grants, permisos y confirmación comunes. Aplican [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) y [política89](../../../../mvp/89-module-access-and-user-data-scope.md): módulo NodiaAI y destinos autorizados, propietario/colaborador y bypass legítimo de super_admin sin omitir invariantes o botón humano. Las acciones históricas de roles no añaden un bloqueo contrario a89. Seleccionar capacidades o escribir «sí» no confirma una propuesta ni ejecuta efectos; revisión/hash, ejecución idempotente y recibos permanecen independientes del modo.

`supports_tools` describe soporte de solicitudes de herramientas; API usa function calling y mantiene `supports_mcp:false`. Configuración/catálogo listos no son health remoto ni éxito de inferencia. Conexión/modelo/esfuerzo son explícitos y dinámicos, sin defaults de modelo ni fallback API↔Agentic. Los tres envíos generativos actuales por run incluyen cada POST API y sus continuaciones, reservados durablemente antes de transmitir; reiniciar o reintentar no devuelve presupuesto.

El ledger HTTP y descriptor privado schema3 distinguen cierre local (`local_transport_closed`) de resultado remoto (`remote_outcome:completed|unknown`); no simulan un proceso nativo cerrado. Timeout/abort/crash no prueban cancelación remota ni coste cero. Conciliación/ACK exigen identidad y cierre local demostrados, sin autoretry de inferencia incierta. Las pruebas y publicación se cierran por separado con [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md), sin aceptar todas las operaciones por un success acotado.

API incorpora un carril explícito de prompt `/imagen DESCRIPCIÓN`, independiente del function calling y de la visión de entrada. Se exige la conexión/modelo/esfuerzo elegidos y capacidad de generación realmente calificada para esa configuración; no se inventa un modelo de imagen ni se cambia automáticamente al fallar. OpenAI Images y Gemini con salida inline tienen transportes propios; no se descarga una URL arbitraria del proveedor.

La calificación interna enlaza proveedor/conexión/generaciones/modelo/esfuerzo/versión, terminal HTTP completado durable, hashes de solicitud/respuesta/payload y bytes de la imagen validada. Un true enviado por Client, visión o respuesta de texto no califican generación. `supports_image_generation:false` modifica la ayuda del compositor e informa capacidad no verificada, conservando texto sin seleccionar un default. Si falta el campo se conserva el comportamiento Agentic anterior, sin aprobar capacidades nuevas.

Persistencia, propiedad del chat, inspección, una salida privada, Ver/Descargar/reload, cuota y retención usan el ciclo existente. Generar no asocia una portada ni modifica Productos/Reservas: esa escritura requiere su contrato, preview y confirmación humana. No hay autoregeneración de unknown ni garantía de cancelación remota/retención física sin evidencia. Los éxitos Codex y Antigravity inferiores son anteriores y acotados. Los recorridos API requieren evidencia propia por selección, modalidad y entorno; los éxitos Agentic previos no la sustituyen.

## Cortes anteriores conservados

> Las secciones inferiores conservan decisiones, pruebas y estados del corte anterior a esta ampliación API. Sus expresiones «actual», API posterior, permisos por acciones o publicación se leen en su fecha histórica, no como prohibición o aceptación del contrato nuevo. La regla vigente de esta revisión es el bloque API superior; las evidencias originales no se reescriben.

## Qué resuelve y qué significa

Primera implementación acotada de [AI-41](../../../../mvp/45-nodia-ai-implementation-plan.md#e12--generación-de-imágenes-en-nodiaai): solicitar una imagen con `/imagen DESCRIPCIÓN` en el chat existente, recuperarla como adjunto privado y usar Ver/Descargar. La petición del2026-10-26 autoriza implementación y ejecuciones de prueba Agentic; no aprueba otras fichas ni elimina los gates de permisos, disponibilidad o publicación. La revisión3 tiene aprobación contextual explícita registrada, implementación partial e integración verified; la publicación/adopción del fragmento se verifica por separado. Visión de entrada y MCP no prueban generación.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y tratamiento actual |
|---|---|
| «/imagen Una ilustración de una cabaña junto a un lago» | Generar una imagen con la selección actual del chat, si el adaptador está disponible. |
| «Genera una ilustración» sin `/imagen` | Mensaje ordinario: la primera entrega no habilita generación implícita ni una herramienta nueva al modelo normal. |
| «/imagen» sin descripción, descripción mayor a8000bytes UTF-8 o con adjuntos | Rechazar la solicitud; pedir una descripción válida sin adjuntos. |
| «/imagen Un banner para mi alojamiento y ponlo como portada» | Esta ruta sólo genera el archivo del chat; no consulta ni modifica un alojamiento o producto. La asociación es un alcance posterior con contrato y confirmación propios. |
| «Modifica esta imagen adjunta» | Fuera del primer recorrido; no hay edición o variantes con referencias. |
| «Usa otra cuenta o una API si falla» | Sin fallback automático; selección explícita y capacidad verificada antes de una ejecución nueva. |

## Operaciones y contratos

| Operación | Estado y resultado |
|---|---|
| Generación desde texto | Implementada sólo para el comando explícito del mensaje actual del usuario. [Parser](../../../../../nodia-server/src/nodia-ai-context/types/image-generation-command.ts) y [stage](../../../../../nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts); una salida, sin MCP ni efectos comerciales. |
| Codex Agentic | Ruta de imagen con builtin `imageGeneration` en el [runtime integrado](../../../../../nodia-server/src/common/ai/codex/codex-chat-runtime.ts); otros builtins no se conceden al chat ordinario por esta función. Generación, persistencia y UI reales positivas en el recorrido documentado. |
| Antigravity Agentic | [Rol propio](../../../../../nodia-gemini-microservice/native_image_generation.py) limitado a `generate_image` y `finish`, con archivo propio e inspección. R09 completó una generación JPEG con persistencia y UI verificadas, fuente9f8bb62 y33 pruebas Linux. Cualificación MCP propia separada; ocho intenciones anteriores conciliadas/ACK sin replay. No hubo fallback automático ni aceptación global por esta prueba. |
| Persistencia | [StoreNodiaAiGeneratedImage](../../../../../nodia-server/src/nodia-ai-attachment/use-case/store-nodia-ai-generated-image.use-case.ts) reutiliza Create/Upload/Manage Attachment y R2 privado, vinculados al propietario y conversación. MIME, bytes, SHA e inspector reales; sin URL arbitraria. |
| Presentación y descarga | Client R03 desplegado: [AttachmentMessage](../../../../../nodia-client/src/modules/nodiaAi/components/Attachments/AttachmentMessage.tsx) abre la imagen tras Ver y descarga por el transporte privado actual. Root comprobó vista, descarga y recarga de ambos archivos, con hashes exactos y capturas durables. |
| Edición, variantes y asociación a negocio | Posteriores al primer recorrido; no disponibles por esta ficha. |

La generación consume un servicio externo y puede consumir cuota o dinero. Se usa el modelo/esfuerzo y conexión actuales resueltos dinámicamente; no se inventa un modelo de imagen ni se deduce su disponibilidad por el nombre del razonador. El proveedor puede gestionar su generador internamente; datos no entregados de coste, modelo efectivo, cuotas o resolución quedan desconocidos/null, sin promesa de precio o gratuidad. Web/API no se ejecutan ni se usan como fallback en esta entrega.

## Datos mínimos y resolución de dudas

Descripción no vacía de hasta8000bytes UTF-8, sin adjuntos y con prefijo `/imagen` en el mensaje actual del usuario. Se mantiene la selección configurada del chat; si falta o no está disponible, no se sustituye automáticamente por otra. El límite de salida es propio de Nodia: una imagen de hasta16MiB y12millones de píxeles, formatos actualmente validados PNG/JPEG/WebP e inspección completa antes de guardar. No es una resolución garantizada o cuota del proveedor.

El mensaje assistant puede contener sólo una parte `kind:image`, `attachment_id` y `text:null`; el texto narrativo es opcional. El scope de esa salida usa `module_routes:[]`: no concede acceso comercial y conserva la autorización del chat/adjunto. No se añade un endpoint público de generación: se reutilizan admisión de mensajes y acceso privado a adjuntos; el adaptador interno mantiene su contrato Server-only.

## Reglas, acceso y restricciones

Aplicar [política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md), autorización NodiaAI y propiedad del chat. El prefijo no autoriza SQL, shell, MCP, cambios de registros ni asociación de imágenes a negocio. Credenciales sólo por canales seguros; no exponer URLs privadas, claves R2 o secretos al modelo. Cambiar cuenta, sesión, configuración o epoch conserva sus verificaciones propias; la prueba Codex no acepta Antigravity, Web/API u otras selecciones. La autorización inicial de implementar/probar no aprobaba otros documentos. La petición posterior explícita de terminar el punto6 autoriza la aprobación/publicación acotada registrada para esta revisión; no aprueba otros documentos, ADR u operaciones comerciales.

## Filtros e informes

No aplica: este recorrido no consulta catálogos ni añade informes. Usar datos comerciales como referencia requerirá herramientas autorizadas y contratos separados; la ruta actual recibe sólo la descripción del usuario.

## Vista previa, confirmación y recuperación

La imagen del chat no se asocia automáticamente a ningún producto/alojamiento ni crea propuesta o escritura comercial. Asociar o reemplazar archivos conservará revisión/hash, permisos y confirmación humana del coordinador, bajo contrato posterior. `/imagen` es la intención explícita de generación del primer recorrido; no autoriza otros efectos.

Se reutilizan jobs, journal y exclusión física. Un resultado incierto se concilia por su identidad exacta; el terminal se reconoce/ACK cuando corresponda, sin regenerar automáticamente ni falsificar ACK de una ejecución no iniciada. La persistencia usa la intención del run y bytes validados. Store solicita descarte mediante Manage si falla upload/readback/hash. Si el sellado SQL falla después de guardar, el adjunto ready sigue contabilizado en cuota y bajo retención/purga del chat; no se afirma que conserve un upload intent ni una limpieza independiente de ese ciclo. La matriz posterior comprueba permisos/fallos y aislamiento por sus capas; Stop real conserva incertidumbre y se concilia/ACK sin replay. La retención física global y el calendario no se deducen de esos ensayos. Las imágenes del chat siguen su ciclo de purga; futuras copias comerciales tendrán ciclo independiente.

## Integración y evidencia

- [x] Dos recorridos reales acotados: generación/persistencia/UI Codex y Antigravity R09 documentadas, sin equivalencia global entre cuentas o entornos.
- [x] Contrato y adaptadores del recorrido explícito implementados y contrastados; disponibilidad exige la selección actual y coste no entregado permanece desconocido.
- [x] Vista, descarga y recarga de los dos archivos comprobadas por Root, hashes exactos y capturas durables.
- [x] Permisos, almacenamiento/decodificación y cancelación/conciliación comprobados con límites de capa; sin prometer aborto remoto o limpieza inmediata.
- [ ] Calendario global7d/24h, todas las copias/versiones y eliminación remota completa.
- [x] Aprobación contextual de la ficha registrada con revisión/hash exactos.
- [ ] Adopción operativa del nuevo fragmento explicativo verificada; no crea una herramienta de generación.

La [evidencia consolidada](../../../../evidence/nodia-ai-agentic-image-generation-20261026-r01.json) verifica Codex PNG1244479bytes/1374×1145/SHA7d2eeec y Antigravity R09 JPEG239004bytes/1024×1024/SHA06b262e, cada uno en un run completado con una dispatch y salida assistant de imagen sin texto obligatorio. Root comprobó Ver, descarga y recarga de ambos archivos. R09 tiene cualificación MCP nonce/ACK propia y observación posterior available/supports_mcp true; son proofs separados de generación. El estado final conserva fuente exacta, proceso nativo cerrado y quiet/markers cero. Los ocho intentos Antigravity anteriores y el primero Codex quedaron conciliados/ACK sin replay; sus fallos y diagnósticos se preservan en el mismo JSON. Coste/cuotas siguen desconocidos; estas dimensiones son observaciones de dos salidas y no promesas. Client R03 mantiene admisión45s, observe Server30s y Axios global20s, sin atribuir al desfase anterior una causa no demostrada. Ese resultado constituye evidencia de la aprobación contextual posterior de revisión3; no cierra retención ni NodiaAI global y no acredita una publicación/adopción aún no ejecutada.

Referencias de proveedor: [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), [Antigravity headless](https://www.antigravity.google/docs/cli/headless/) y [hooks/herramientas](https://www.antigravity.google/docs/hooks?tab=cli). El builtin concreto procede del SDK integrado y su fuente local; los documentos generales de OpenAI no se citan como prueba de una cuenta. Google documenta `generate_image` y sus argumentos, pero el rol limitado a `generate_image`/`finish` es política Nodia. Su [ejemplo SDK oficial](https://raw.githubusercontent.com/google-antigravity/antigravity-sdk-python/main/examples/deep_dives/multimodal_pipeline.py) ilustra recuperación de archivos y no demuestra el comportamiento de la CLI instalada.

## Verificación posterior de integración y límites

La [entrega posterior](../../../../evidence/nodia-ai-agentic-commercial-cancellation-retention-20261026-r01.json) verifica Source R03/Native R10: Stop UI en Codex y Antigravity conserva incertidumbre y requiere conciliación administrativa UC exacta/ACK manual; ambos procesos quedaron cerrados sin assistant ni adjuntos. No se presenta como autocierre inmediato o aborto remoto garantizado. La prueba comercial separada confirmó cuatro actualizaciones sintéticas y su idempotencia desde una tabla manual; no asoció imágenes ni repitió OCR. Fixture R2 real y51ready/HEAD no acreditan siete días continuos,24h físicas o todas las copias/versiones; esos gates siguen pendientes. Las pruebas de imagen positivas conservan sus epochs y no cierran AI41/NodiaAI global.

## Uso de /imagen en el chat

Para solicitar una imagen, el usuario escribe `/imagen DESCRIPCIÓN` en el mensaje actual: descripción no vacía de hasta8000bytes UTF-8 y sin adjuntos. El chat usa la conexión, modo Agentic, modelo y esfuerzo configurados/disponibles actualmente; si falta evidencia válida, no cambia automáticamente de selección ni usa Web/API.

La ruta admite una sola salida PNG/JPEG/WebP inspeccionada, hasta16MiB y12millones de píxeles como límites de Nodia. Son límites, no resoluciones o cuotas prometidas. Modelo efectivo de imagen, coste o consumo no expuestos por el proveedor permanecen desconocidos; no se deducen del nombre del razonador.

La salida se guarda como adjunto privado del mismo dueño/chat. Puede mostrarse un mensaje assistant sólo con imagen, sin texto narrativo, con Ver/Descargar sujetos a autorización actual. La generación no usa MCP ni añade una herramienta al modelo conversacional: Codex limita su ruta al builtin integrado de imagen y Antigravity al rol propio generate_image/finish.

No se crea ni asocia ningún producto, alojamiento u otro registro comercial. Edición, variantes y referencias de entrada quedan fuera de esta entrega. La cancelación conserva su estado honesto; si hay incertidumbre, no se regenera automáticamente y el operador concilia la identidad exacta antes de reconocer el terminal.

Si guardar o validar falla se solicita descarte mediante el flujo existente. Un archivo ready cuyo selladoSQL posterior falla o cuyo descarte está denegado sigue vinculado al chat, bajo cuota y retención/purga propias; no se promete eliminación inmediata ni un archivo anónimo fuera de esa política. Las comprobaciones reales7d/24h/todas las copias siguen siendo gates separados.

## Evolución y compatibilidad

| Revisión | Cambio | Impacto |
|---|---|---|
| 1 | Plan AI-41, solicitud del 2026-10-25 | Sin cambios de runtime, permisos, propuestas o capacidades publicadas; permanece planned/unregistered. |
| 2 | Petición explícita del2026-10-26 y recorrido `/imagen` Agentic | Implementación partial, integración unregistered y approval:null. Codex y Antigravity R09 positivos por alcance, con imagen privada y UI comprobada; garantías restantes pendientes. Edición/asociación/Web/API fuera, sin cambio de aprobaciones OCR o cierre global. |
| 3 | Aprobación contextual explícita del punto6 y matriz de seguridad consolidada | Contexto explicativo acotado con152capacidades preservadas; integración verified e implementación partial. Sin nuevo toolMCP, aprobación OCR/ADR, asociación comercial o promesa calendar. |
