---
{
  "schema_version": 1,
  "document_id": "general-settings.secure-ai-interaction",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 5,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "API chat code and common permission/confirmation/runtime contracts implemented. Real provider/model/media qualification and VM adoption require their separate receipts; documentary approval does not certify all151 operations."
  },
  "integration_status": "verified",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/90-agentic-api-only-web-retirement.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/75-nodia-ai-ai29-secure-human-flows.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-proposal/types/secure-operation.types.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-secure-flow/use-case/manage-nodia-ai-secure-flow.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/SecureInteraction/SecureInteraction.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/use-case/manage-ai-provider-secure-session.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/ai-provider/use-case/save-ai-api-key.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/auth/use-case/revoke-own-auth-session.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/82-nodia-ai-ai36-integral-coverage.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
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
      "docs/evidence/nodia-ai-ai29-validation.json",
      "docs/evidence/nodia-ai-ai29-postgresql.json",
      "docs/evidence/nodia-ai-ai29-client-validation.json",
      "docs/evidence/nodia-ai-ai29-ui-validation.json",
      "docs/evidence/nodia-ai-ai29-r01-validation.json",
      "docs/evidence/nodia-ai-ai29-r01-postgresql.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-native.json",
      "docs/evidence/nodia-ai-ai29-r01-codex-native.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-agentic-login.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-web-reconciliation.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-agentic-mcp.json",
      "docs/evidence/nodia-ai-ai29-r01-final-health.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-web-login.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-web-routing-failed-01.json",
      "docs/evidence/nodia-ai-ai29-r01-web-diagnostics-offline-validation.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-web-diagnostics-activation.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-web-routing.json",
      "docs/evidence/nodia-ai-ai29-r01-web-generation-diagnostics.json",
      "docs/evidence/nodia-ai-ai29-r01-gemini-bootstrap-after-diagnostics.json",
      "docs/evidence/nodia-ai-ai36-c02-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-secure-publication-r03-validation.json",
      "docs/evidence/ai-two-modes-knowledge-review-r01.json",
      "docs/evidence/api-chat-knowledge-review-r01.json",
      "docs/evidence/api-chat-knowledge-review-r02.json",
      "docs/evidence/api-chat-sql-runtime-r01.json",
      "docs/evidence/api-chat-knowledge-human-approval-r01.json"
    ],
    "notes": "Approved successor/new explanatory revision;19 real isolated PostgreSQL runtime checks and local source/contract regressions verified. Full common-gateway SQL, live API/media and coordinated adoption are separate technical gates. Approved body unchanged from R02."
  },
  "approval": {
    "reference": "docs/evidence/api-chat-knowledge-human-approval-r01.json",
    "revision": 5,
    "content_sha256": "e9aee09d17b54cd09cb249e1560402253819b156a176bebbece1d5ab767254f4"
  }
}
---

# Interacción segura IA — contexto funcional para NodiaAI

## Ampliación API key — 2026-10-27

[Plan92](../../../../mvp/92-nodia-ai-api-chat-parity.md), [ADR-084](../../../../architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md) y [paridad API](../../nodia-ai/features/api-key-chat-parity.md) definen esta ampliación. Aprobación documental, implementación, calificación técnica y adopción por entorno se acreditan por separado en sus metadatos e informes fechados. Los [originales anteriores](../../../../evidence/api-chat-knowledge-originals-catalog-r01.json) conservan sus bytes y aprobaciones históricas; no se revocan ni se sustituyen sus evidencias por un resultado inventado.

API OpenAI/Gemini reutiliza catálogo, ToolGateway, grants, permisos y confirmación comunes. Aplican [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) y [política89](../../../../mvp/89-module-access-and-user-data-scope.md): módulo NodiaAI y destinos autorizados, propietario/colaborador y bypass legítimo de super_admin sin omitir invariantes o botón humano. Las acciones históricas de roles no añaden un bloqueo contrario a89. Seleccionar capacidades o escribir «sí» no confirma una propuesta ni ejecuta efectos; revisión/hash, ejecución idempotente y recibos permanecen independientes del modo.

`supports_tools` describe soporte de solicitudes de herramientas; API usa function calling y mantiene `supports_mcp:false`. Configuración/catálogo listos no son health remoto ni éxito de inferencia. Conexión/modelo/esfuerzo son explícitos y dinámicos, sin defaults de modelo ni fallback API↔Agentic. Los tres envíos generativos actuales por run incluyen cada POST API y sus continuaciones, reservados durablemente antes de transmitir; reiniciar o reintentar no devuelve presupuesto.

El ledger HTTP y descriptor privado schema3 distinguen cierre local (`local_transport_closed`) de resultado remoto (`remote_outcome:completed|unknown`); no simulan un proceso nativo cerrado. Timeout/abort/crash no prueban cancelación remota ni coste cero. Conciliación/ACK exigen identidad y cierre local demostrados, sin autoretry de inferencia incierta. Las pruebas y publicación se cierran por separado con [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md), sin aceptar todas las operaciones por un success acotado.

La conversación API puede preparar los mismos flujos seguros publicados y autorizados, sin recibir claves, cookies o códigos. La persona revisa objetivo/impacto no secretos, confirma la propuesta exacta y completa el formulario/login humano separado. Las máscaras no son secretos utilizables por el modelo. La clave API cifrada se usa privadamente en Server, nunca en Python, contexto, logs o mensajes.

Completar un flujo seguro revalida actor/sesión, recurso y autorización actual; elegir API o configurar una clave no confirma otros cambios ni acredita inferencia. Cancelación y recuperación conservan identidad, recibo y estado incierto sin abrir otro login/POST implícito. Los errores mantienen formulario y borrador. El recorrido real de chat API con preparación, botón humano y resultado seguro requiere evidencia propia por selección y entorno; una aceptación previa de Agentic no la sustituye.

## Cortes anteriores conservados

> Las secciones inferiores conservan decisiones, pruebas y estados del corte anterior a esta ampliación API. Sus expresiones «actual», API posterior, permisos por acciones o publicación se leen en su fecha histórica, no como prohibición o aceptación del contrato nuevo. La regla vigente de esta revisión es el bloque API superior; las evidencias originales no se reescriben.

## Modos vigentes solicitados el 2026-10-27

Sólo **Agentic** (`agentic`) y **API key** (`api_key`), conforme al [plan90](../../../../mvp/90-agentic-api-only-web-retirement.md). Flags `use_agentic`/`can_use_agentic`, `use_api_key`/`can_use_api_key`; configuración por `fields.agentic` y `fields.api_key`. Los defaults/selecciones Web se desasignan y requieren elección explícita; no se convierten en otra modalidad. El historial anterior conserva su evidencia y no habilita Web.

La revisión aprobada anterior 3 se conserva byte exacta; el [informe de revisión](../../../../evidence/ai-two-modes-knowledge-review-r01.json) identifica originales y cambios. La disponibilidad de cada funcionalidad se verifica por proveedor/modo/modelo con el [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md); las pruebas históricas de Web no acreditan API ni Agentic actual.

## Qué resuelve

Gestionar credenciales/login y acciones externas de proveedores sin solicitar secretos por el chat. [Entrega75](../../../../mvp/75-nodia-ai-ai29-secure-human-flows.md) define el canal humano separado, ocho preparadores internos y pausa de ejecución. Markdown no concede autoridad ni publica herramientas.

## Solicitudes y aclaraciones

| Solicitud ilustrativa | Resolución |
|---|---|
| «Agrega una clave a esta conexión» | Resolver conexión y etiqueta; preparar metadatos, confirmar y abrir el formulario seguro. Nunca pedir la clave en el chat. |
| «Reemplaza la clave» | Aclarar conexión/ID exacto de credencial; conservar selección/actividad según la propuesta. |
| «Conecta Gemini» | Identificar la instancia y abrir su login Agentic; API key usa su propio flujo seguro. |
| «Cierra sesión» | Aclarar sesión Nodia propia frente a la sesión Agentic del proveedor. |
| «Actualiza modelos» | Aclarar conexión y modo; descubrimiento no asigna un modelo ni comprueba inferencia. |
| «Usa esta cookie/código del chat» | Remitir al flujo seguro; no incorporar secretos al contexto ni intentar confirmar como el usuario. |

## Contratos y acceso

Ocho identidades internas cerradas en secure-operation.types.ts; AI-29 no las publica en MCP. API key admite metadatos label/sort_order/is_selected/is_active; secret viaja sólo por acción humana posterior al botón exacto. Crear exige un secreto; actualizar permite omitirlo para conservar la clave y aplicar únicamente los metadatos confirmados. Una actualización sin metadatos ni secreto se rechaza. No se envía secret vacío. Los otros flujos usan sus mínimos nativos. NodiaAI y módulo de destino más ai:manage se revalidan; logout Nodia afecta sólo la sesión actual, sin aceptar un destinatario arbitrario.

El endpoint humano recibe una referencia opaca vinculada a ejecución, actor, sesión, revisión y plazo. La respuesta de login/visor pertenece exclusivamente a la UI humana. No enviar claves, cookies, códigos, URLs OAuth, capturas ni referencias nativas al modelo o al historial.

## Vista previa y recuperación

Preview muestra objetivo e impacto no secreto, incluyendo selección de claves y alcance compartido cuando corresponde. Confirmar admite la ejecución; waiting_for_user libera worker y conexión SQL. La v1 admite un paso seguro independiente; no lo mezcla con conjuntos dependientes ni infiere un resultado futuro antes de completarlo. Completar la acción segura vuelve a comprobar autoridad. Los errores conservan formulario y entradas; unknown exige observación/conciliación y no redispatch. Cancelar un login pendiente verifica su cancelación real antes de liberar el flujo. Un recibo histórico no demuestra que la sesión o el catálogo sigan disponibles.

## Informes y límites

No hay medidas financieras ni agregación en esta función. Credenciales/códigos no son campos consultables ni agrupables. Configuración, autenticación e inferencia se verifican por separado. API para chat mantiene su etapa posterior; habilitar metadata/API key no acredita soporte de herramientas.

## Integración y evidencia

Implementación y protocolo durable Linux verificados según75; Web ya verificó autenticación recuperada, recibo y descubrimiento de cuatro modelos. La nueva aceptación de conversación/routing Web completó tres turnos y cuatro generaciones: Web sin herramientas, delegación opt-in con lectura de productos y vuelta a Web; 10 checks y limpieza completa. El fallo anterior se conserva separado. Agentic real verificó login, recuperación, descubrimiento y lecturas MCP sobre SQL sintético. Esta ficha continúa draft/unregistered y approval null; no cambia las fichas de lectura aprobadas ni sus bindings. Los ocho preparadores seguros no están publicados en MCP.

## Estado verificado y límites

Canal y ocho preparadores verificados en laboratorio privado, sin nueva tabla/columna/migración. Una actualización sin secreto requiere metadatos que cambien el objetivo aprobado; una normalización sin cambio no sustituye una clave vacía. La purga elimina contenido y conserva sólo el testigo operativo hasta su conciliación y ACK después del commit. Los nuevos logins usan identidad estable y supervisor independiente; perder la respuesta inicial no crea otra solicitud. Web verificó cancelación y conciliación SQL tras un reinicio Docker real, con prueba del host; ese primer ensayo anónimo se conserva separado. Después pasó14checks de autenticación recuperada, recibo y descubrimiento de cuatro modelos con cuenta real, sin inferencia. Testigos históricos sin identidad durable y resultados sin prueba permanecen unknown, sin repetición. El primer ensayo de routing real quedóunknown a119018ms en Web inicial, con una invocación, cero herramientas/delegaciones y sin alcanzar la delegación ni la vuelta a Web. Ese ensayo fallido completó cleanup con cinco contadores en0, BD desechable retirada y sin replay. El siguiente ensayo instrumentado completó los tres turnos de routing y su cleanup; AI-29-R01 quedó cerrado técnicamente en laboratorio. Windows durable, cuenta/inferencia Codex reales y publicación MCP de escrituras mantienen gates independientes.

El diagnóstico Web ampliado observa forma de salidas, tiempos y EOF normal sin exportar contenido, prompts o pensamientos; no cambia el orden de salidas ni certifica la respuesta final. Sus pruebas offline y activación posteriores son independientes del primer timeout. El bootstrap Agentic posterior al reinicio pasó siete checks con una generación y limpieza completa; el nuevo ensayo Web instrumentado pasó10checks con tres turnos completos y cleanup sin pendientes. Los tres `web_success` registraron EOF normal sin exportar contenido. La causa del primer timeout no está acreditada; no cambió parser, timeout ni retorno del SDK, y no se devuelve un candidato parcial. La salud VM posterior confirmó cuatro servicios activos, HTTP200 y cero pendientes. El cierre técnico de R01 no implica aprobación documental, publicación de herramientas o SLA de latencia.

El siguiente bloque de desarrollo es AI-30: registro de fuentes y motor restringido de informes. Esta ficha permanece draft/unregistered y approval null; no habilita herramientas ni permisos.


## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.

## Preparación segura IA publicada en AI36-C05

- `nodia_secure_flows_prepare_api_key_create`
- `nodia_secure_flows_prepare_api_key_update`
- `nodia_secure_flows_prepare_connection_login`

Estas herramientas preparan alta o reemplazo de una clave en el formulario seguro existente, o un login de la conexión y modo explícitos. Exigen NodiaAI, el módulo Ajustes de proveedores IA y la acción ai:manage vigentes. No introduzcas en el chat claves, contraseñas, cookies, tokens, códigos OAuth, URLs de login ni payloads nativos. El contrato no admite campos de secretos, códigos ni payloads nativos; no se afirma detección de secretos pegados en campos públicos. La preparación sólo devuelve datos públicos y una propuesta; nunca autentica, cambia la clave ni acredita disponibilidad. Después de la confirmación humana exacta, la app abre el canal seguro y conserva su timeout, ownership y recuperación nativos. Una autenticación no prueba inferencia; no inventes un modelo o fallback.

El modelo puede completar mínimos públicos y continuar sólo con draft_id/revisión CAS exactos. Preparar no confirma ni ejecuta; la disponibilidad se comprueba por el consumidor real y no se deduce de publicar este fragmento.

## Preparación de logout propio publicada en AI36-C05

- `nodia_secure_flows_prepare_nodia_logout`

Esta herramienta prepara exclusivamente cerrar la sesión Nodia del actor actual. No recibe un user_id/session_id ni permite nominar otra sesión, aunque el actor sea super_admin. Exige el acceso basal NodiaAI; no requiere el módulo administrativo de proveedores ni ai:manage. La propuesta no cierra sesión. Sólo la confirmación y el canal humano nativo pueden completarlo; conserva las reglas de expiración y reautorización. No confundir este logout propio con cerrar Codex/Gemini o revocar sesiones ajenas.

El modelo puede completar mínimos públicos y continuar sólo con draft_id/revisión CAS exactos. Preparar no confirma ni ejecuta; la disponibilidad se comprueba por el consumidor real y no se deduce de publicar este fragmento.
