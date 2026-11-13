---
{
  "schema_version": 1,
  "document_id": "general-settings",
  "product_id": "general-settings",
  "kind": "product",
  "revision": 23,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Índice enlaza la ampliación API chat candidata y sus seis revisiones draft; código implementado, ensayos SQL/API/VM pendientes. Sin aprobación o publicación del producto o fichas por actualizar el índice. Cabecera: ClientR32 expone actualización manual de la consulta de salud existente, con17 regresiones y QA autenticada/escritorio/móvil acotada; sin ampliar capacidades o aceptación del resto del producto. ClientR33 retira únicamente el padding inferior del header compartido; evaluación visual sin cambio de conceptos, operaciones o interpretación del contexto. UI de conexiones: controles Gemini sólo con modelos, reconsulta Codex compacta y lecturas ligadas a sesión; ver candidata específica, sin nuevas herramientas o publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/90-agentic-api-only-web-retirement.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-081-module-access-and-business-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/02-prd-v1.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/19-prelaunch-review.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/61-nodia-ai-ai15-product-reads.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/73-nodia-ai-ai27-core-administration.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/74-nodia-ai-ai28-provider-configuration.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/75-nodia-ai-ai29-secure-human-flows.md",
      "kind": "specification"
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
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/ai-providers/topbar-mode-health.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/layouts/components/Topbar/components/AiProviderIndicators/AiProviderIndicators.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/layouts/components/Topbar/styles.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-06",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai27-client-validation.json",
      "docs/evidence/nodia-ai-ai27-ui-validation.json",
      "docs/evidence/nodia-ai-ai28-client-validation.json",
      "docs/evidence/nodia-ai-ai36-c02-validation.json",
      "docs/evidence/core-fx04-live-delivery-r01.json",
      "docs/evidence/core-module-drag-delivery-r01.json",
      "docs/evidence/core-fx04-live-acceptance-r02.json",
      "docs/evidence/module-access-and-user-data-deployment-r01.json",
      "docs/evidence/api-chat-knowledge-review-r01.json",
      "docs/evidence/ai-topbar-manual-refresh-20261106-r01.json",
      "docs/evidence/topbar-bottom-padding-20261106-r01.json"
    ],
    "notes": "Revisión de código/contratos candidatos API y preparación documental con originales byte exactos archivados. Código implementado; ensayo SQL, success API chat real, modalidades, imágenes, VM y publicación de esta revisión pendientes. Las evidencias de etapas anteriores conservan su alcance y no califican el modo API nuevo. Aprobación humana pendiente. Actualización manual del topbar verificada por separado en ClientR32; no transfiere aceptación a otras funciones/proveedores ni a inferencia. Padding inferior0 y geometría comparada320/600/1088px comprobados por separado en R33; sin nueva publicación."
  },
  "approval": null
}
---

## Ampliación candidata: API key en NodiaAI — 2026-10-27

La [paridad API del chat](../nodia-ai/features/api-key-chat-parity.md), [plan92](../../../mvp/92-nodia-ai-api-chat-parity.md) y [flujo seguro revisión5](features/secure-ai-interaction.md) están en revisión. Código implementado para la misma autoridad/gateway, propuesta y confirmación humanas; API no simula MCP ni éxito por tener clave/catálogo. SQL, proveedor real, modalidades y VM se verifican por separado. Esta revisión del índice es draft/unregistered/approval:null y no aprueba ni publica las fichas. Los apartados inferiores son cortes anteriores con su propia evidencia.

# Ajustes Generales — contexto de producto para NodiaAI

## Cambio solicitado el 2026-10-27: Agentic y API key

La petición actual retira Web y su delegación a Agentic; se mantienen sólo `agentic` y `api_key`. [Modos IA Agentic y API key](features/agentic-api-modes.md), [implementación90](../../../mvp/90-agentic-api-only-web-retirement.md) y [aceptación de proveedores91](../../../mvp/91-ai-provider-onboarding-verification.md). Implementación en curso y aceptación VM/API por comprobar. La existencia de un modo no habilita todas las capacidades; historial/snapshots y evidencias anteriores se preservan con sus límites. Los apartados inferiores son cortes previos, no habilitan ejecución Web.

## Regla vigente de módulos y privacidad — 2026-10-25

[Política89](../../../mvp/89-module-access-and-user-data-scope.md) y [ADR081](../../../architecture/decisions/ADR-081-module-access-and-business-data-scope.md). El módulo habilita funcionalidades y no datos ajenos. Usuarios ordinarios necesitan el módulo y la propiedad o colaboración explícita; super_admin tiene bypass de permisos y acceso global. Las acciones de roles no bloquean. El guard vuelve a Inicio sin módulo. Se conservan sesión, recursos existentes, confirmaciones humanas y atribución del actor; ver un chat ajeno no permite confirmar como su autor. Esta revisión candidata sustituye las referencias históricas a ai:manage y al acceso global entre negocios; no publica conocimiento ni altera aprobaciones anteriores.


Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

## Propósito y alcance

Administrar usuarios, roles, catálogos de acciones, módulos/grupos y conexiones de IA. Identidades, permisos de navegación, configuración y disponibilidad real son conceptos distintos.

El alcance confirmado comprende consultas y CRUD individual donde exista endpoint, con aclaraciones/vista previa y confirmación. Las fichas describen el backend actual y señalan ampliaciones pendientes; ninguna crea herramientas o permisos.

## Conceptos y relaciones

| Concepto | Significado y relación |
|---|---|
| Usuario / sesión | Registro permitido preexistente y login Google; la cuenta Google no concede módulos por sí sola. |
| Rol / acción | Catálogos y asociaciones; el backend actual no aplica RBAC granular universal por acción. |
| Módulo / grupo | Módulo tiene ruta y asignaciones; grupo organiza navegación, no concede permisos por sí mismo. |
| Proveedor IA / conexión / modelo | Catálogo define modos configurables; instancia guarda configuración por modo y claves cifradas separadas. |

## Módulos y autoridad

Cinco destinos distintos: /settings/users, /settings/roles, /settings/actions, /settings/modules y /settings/ai-providers. No habilitar todos por asignar uno. Administración global autenticada intencional en19, sin inventar permisos por acción; IA conserva su requisito real ai:manage o super_admin. NodiaAI aplica su módulo más cada destino (AI-07) y salvaguardas NI-13/AI-08.

Rutas de destino trazadas al inventario/catálogo: `/settings/users`, `/settings/roles`, `/settings/actions`, `/settings/modules`, `/settings/ai-providers`. Resolver sus IDs reales desde Server; la inspección no consulta asignaciones de la BD del usuario. Credenciales/cookies no se incorporan al contexto. Web sólo conversa y Agentic usa MCP conforme [política48](../../../mvp/48-nodia-ai-mode-routing-policy.md); disponibilidad exige evidencia del adaptador exacto.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración NodiaAI | Destino |
|---|---|---|---|---|
| Usuarios, acceso y sesión propia | [users](features/users.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/users` |
| Roles y asociaciones de acciones | [roles](features/roles.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/roles` |
| Acciones y acciones de negocio | [actions-and-business-actions](features/actions-and-business-actions.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/actions` |
| Módulos y grupos de navegación | [modules-and-groups](features/modules-and-groups.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/modules` |
| Catálogo y conexiones de IA | [ai-connections](features/ai-connections.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/ai-providers` |
| Modelos, salud y eventos de IA | [ai-models-and-health](features/ai-models-and-health.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/ai-providers` |
| Credenciales y sesiones de IA | [ai-credentials-and-sessions](features/ai-credentials-and-sessions.md) | Backend existente/parcial; gates en ficha | Sólo lecturas AI-15 publicadas; resto pendiente | `/settings/ai-providers` |

## Interpretación de solicitudes que combinan funciones

«Da acceso a Finanzas» modifica asignaciones de módulo del usuario, no inventa un rol de acceso. Mostrar la colección final para no retirar módulos ajenos. «Configura Gemini» requiere distinguir catálogo, conexión y modo; contraseña, key y códigos sólo se ingresan en canal seguro.

Informes cruzados requieren medidas compatibles y procedencia separada según41; no deducir relaciones sólo porque dos productos usan la palabra gasto/proveedor. Pasos dependientes conservan resultados y se recuperan sin duplicarlos; el modelo no confirma ni ejecuta SQL libre.

## Restricciones y pendientes

No DELETE/GET individual de usuarios en API; no CRUD de sesiones Google por el modelo. Último super_admin activo, key de módulo y asociaciones atómicas protegidos en AI-08; puertos internos AI-27, con gates MCP/Gemini pendientes. Configurar un proveedor/modelo o autenticar sesión no prueba inferencia/MCP. API para NodiaAI se integra más adelante; otras APIs existentes conservan contrato.

Publicación de conocimiento, proyecciones y autoridad depende de AI-06/07/08/12 y de la familia de herramientas. Markdown explica, no habilita. No se cargan estos borradores automáticamente al proveedor. Política50 elimina contenido del chat y registros técnicos resueltos sin borrar dominio/preferencias aceptadas.

## Evolución y trazabilidad

| Revisión | Cambio funcional y fuentes | Impacto |
|---|---|---|
| 1 | AI-05: 7 fichas funcionales desde especificaciones/backend e inventario39 | [Cobertura/diferencias/gates](../../../mvp/51-nodia-ai-ai05-product-knowledge.md); sin migraciones/runtime/publicación ni aprobación automática |


Actualización AI-08: [autoridad compartida](../../../mvp/54-nodia-ai-ai08-transversal-authority.md). Destinatarios, actor real y reglas nativas se validan en transacción. En Ajustes Generales se protegen último super_admin, rol reservado, key de módulos y asociaciones atómicas; esto no incorpora herramientas MCP administrativas.


## Actualización AI-15 — lecturas candidatas

[Entrega y gates](../../../mvp/61-nodia-ai-ai15-product-reads.md). AI-15 incorpora diez lectores Core y cinco de administración IA. Sus puertos reutilizan reglas/casos de uso y manager vigente; las tablas de esta ficha conservan la paridad nativa y los límites de proyección se explican en sus fichas. Las cuatro observaciones externas IA separan snapshot SQL, I/O acotado y comprobación de autoridad/configuración antes de completar el recibo. Ninguna está publicada por añadir código.


Ampliación AI-15: [contrato de ejecución y archivos](../../../mvp/61-nodia-ai-ai15-product-reads.md). Cinco consultas externas usan prepare/execute/verify con deadline, señal y fingerprint; un replay no repite red y un recibo interrumpido no se redispara. Tres referencias de artefacto permiten descargas humanas reautorizadas con datos actuales, sin URL firmada ni archivo persistente adicional. Sin cambios visuales en esta entrega.


## Publicación de lecturas AI-15 — estado actual

19 lecturas publicadas desde siete fichas funcionales: diez Core, cinco metadatos IA y cuatro observaciones externas IA. Estado técnico, autenticación e inferencia siguen separados; runtime_busy no demuestra desconexión. El resumen de producto continúa excluido; escrituras pendientes.

El corpus completo verificado en AI-27 tiene51 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y24 fichas draft/unregistered excluidas. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.


## AI-27 — administración Core confirmada

La [ficha de administración confirmada](features/confirmed-administration.md) y [entrega73](../../../mvp/73-nodia-ai-ai27-core-administration.md) implementan17 preparadores internos: usuarios create/update y roles, acciones, acciones de negocio, módulos/grupos create/update/delete. Las siete fichas aprobadas publicadas no cambian; la nueva permanece draft/unregistered, approval null. Se conservan los19 lectores de Ajustes y67 capacidades/27 fragmentos globales. Build verificado51 documentos/24 excluidos;67 capacidades/27 fragmentos intactos.

Colecciones finales y pérdida de acceso se muestran antes del botón exacto; NI-13 y autoridad nativa se revalidan en frontera administrativa exclusiva. No DELETE de usuarios, SQL libre, lotes, credenciales ni ampliación de permisos. Upsert y delete/deactivate deben quedar explícitos en preview. Receipts históricos enlazan al destino Settings; revalidar Client no concede acceso. Implementación, publicación MCP, inferencia y aprobación documental son estados separados.


Client1571/205, focal280/7, tipado/lint/build correctos y11 QA sintéticas/6 capturas. Las [pruebas Client](../../../evidence/nodia-ai-ai27-client-validation.json) y [QA](../../../evidence/nodia-ai-ai27-ui-validation.json) son sintéticas; los efectos SQL/worker y el laboratorio se documentan por separado en73.


## Ampliación AI-28 — configuración IA no secreta

[Entrega74](../../../mvp/74-nodia-ai-ai28-provider-configuration.md) y [ficha de configuración confirmada](features/confirmed-ai-configuration.md): cuatro puertos internos de conexiones y catálogo, modelos dinámicos por modo, vista previa y confirmación exacta. Configurar no autentica ni comprueba disponibilidad; secretos y login siguen en AI-29. Nueva ficha draft/unregistered, sin aprobación ni publicación MCP automática. Client1589/205 y241 focales/3, tipado/lint/build correctos; la evidencia sintética no certifica SQL o proveedor real. El resto de comprobaciones se desglosa en74.


## Ampliación AI-29 — canal humano seguro

[Entrega75](../../../mvp/75-nodia-ai-ai29-secure-human-flows.md) y [ficha de interacción segura](features/secure-ai-interaction.md): ocho preparadores internos de claves, login, logout y sincronización, sin secretos en chat/modelo. La ejecución espera una acción humana liberando worker; ownership/TTL y autoridad se revalidan. Canal local verificado: Server 3072/197, Client 1636/208 y487 comprobaciones SQL/HTTP/procesos; AI-29 sigue abierto por R01 (prueba durable nativa/aceptación real). Sin crecimiento de esquema; ficha draft/unregistered, sin aprobación ni publicación MCP automática.


## Plan Core87 — presentación y orden de módulos

Adopción de arrastre, 2026-10-25: [Server DnD R03/Client DnD R02 entregados](../../../mvp/87-core-feedback-module-order-plan.md#adopción-de-la-ampliación-de-arrastre--2026-10-25), [ficha revisión6](features/module-presentation-and-order.md), índice16 draft/partial/unregistered y approval null. Asa antes de ID, Pointer/teclado y PATCH before/after atómico conservando ámbito/rangos/huecos; Copiar ID retirado y URL conservada. Sin migración adicional sobre historia30.171 assets HTTP/SHA/MIME,60 tablas/orden/configuración/época Gemini preservados, journal abierto sin no-confirmados/expirados. UI autenticada acredita dos drops unchanged; positivos de orden/sidenav pertenecen a SQL aislada/fixture sintética. [Recibo](../../../evidence/core-module-drag-delivery-r01.json). Rollback mismo esquema30 preparado, no ejecutado; FX-04 sigue parcial por efectos positivos autenticados, concurrencia y sesión, sin dispositivo físico, inferencias o ampliación MCP.

FX-04, 2026-10-25: [adopción operativa parcial](../../../mvp/87-core-feedback-module-order-plan.md#adopción-operativa-parcial-de-fx-04--2026-10-25) y [ficha revisión5](features/module-presentation-and-order.md), draft/partial/unregistered. Server R02/Client R01 y migración única1793200000000 adoptados en VM Linux local, con backup cifrado y contexto Redis limpiado; datos ajenos al orden y autoridad conservados. R02 alinea dos metadatos src con dist sin otra migración;150 contratos/41fragmentos R09 exactos. UI autenticada de módulos/Ordenar leída con metadata y extremos coherentes; no movimientos ni CRUD reales. [Evidencia y pendientes](../../../evidence/core-fx04-live-delivery-r01.json): altas/movimientos, sidenav, concurrencia y sesión conservan el gate abierto. Sin nueva publicación MCP; rollback R01 preparado sólo para el corte histórico, no aplicable a R02 sin plan revisado.

FX-03, 2026-10-25: [tabla agrupada y controles implementados](../../../mvp/87-core-feedback-module-order-plan.md#implementación-local-y-qa-sintética-de-fx-03--2026-10-25), [contrato](../../../../nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md) y [ficha revisión4](features/module-presentation-and-order.md), draft/partial/unregistered. Modo Ordenar con Subir/Bajar en tabla/tarjetas, filtros/paginado restaurados y acciones sticky desde sm. Ambos movimientos esperan invalidar módulos, grupos y authorizationKeys.all; el sidenav refleja la relectura sin toast genérico de permisos. Locator snapshot de sólo lectura conserva el ancla; conflictos y resultados inciertos no repiten PATCH y bloquean movimientos hasta recuperar. [Evidencia por capas](../../../evidence/core-fx03-order-validation-r01.json), incluido navegador sintético390/1280. Sin ampliar MCP, desplegar o migrar BD de uso; aceptación autenticada FX-04 pendiente.

FX-02, 2026-10-25: [contrato implementado](../../../../nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md), [ficha revisión3](features/module-presentation-and-order.md) partial/unregistered y [verificación aislada](../../../evidence/core-fx02-order-validation-r01.json). Altas al final, movimientos atómicos, vecinos paginados y contexto/Sidenav ordenados en fuentes; seeds y migración ensayados en PostgreSQL desechable. Sin migrar BD de uso ni publicar campos/herramientas MCP. Controles de tabla FX-03 y aceptación FX-04 pendientes.

Refinamiento de planificación, 2026-10-25: [FX-02/03](../../../mvp/87-core-feedback-module-order-plan.md#contrato-propuesto-de-orden--fx-02) y [ADR-078 propuesto](../../../architecture/decisions/ADR-078-module-order-and-atomic-moves.md). Nuevos registros al final de su ámbito; controles Subir/Bajar en filas y cabeceras guardan movimientos atómicos. Sustituye números manuales/empates del plan inicial; [ficha revisión2](features/module-presentation-and-order.md) planned/unregistered. Sólo documentación por petición del usuario; no implementar todavía. FX-01 conserva su alcance local previo y no se modifica.

[Investigación y plan87](../../../mvp/87-core-feedback-module-order-plan.md), solicitud del 2026-10-25. La [ficha de módulos agrupados y orden](features/module-presentation-and-order.md) permanece draft/planned/unregistered: propone orden persistido de grupos y módulos para administración/navegación, sin herramienta MCP nueva. El ajuste de avisos automáticos sólo cambia feedback, no permisos ni capacidades del modelo. Esta revisión del índice conserva las fichas aprobadas y no acredita implementación o despliegue.

Actualización FX-01, 2026-10-25: [implementación local y pruebas](../../../evidence/core-fx01-notification-validation-r01.json) de feedback de acceso. Se silencian éxitos de lecturas/renovaciones automáticas y se deduplica el error de contexto; éxitos de acciones explícitas y errores conservados. Evaluación de impacto: sólo notificaciones, sin nuevas operaciones ni cambios de autoridad/contexto funcional; no requiere herramienta o publicación. FX-02/03 y su ficha de orden permanecen planificados; no hay despliegue ni aceptación operativa nueva por esta revisión11.

## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.

## Actualización manual de salud en la cabecera — 2026-11-06

La cabecera autenticada expone «Actualizar estado de IA» junto a los modos del predeterminado. Conserva acceso por módulo canónico y bypass existente, sin mostrar el grupo a visitantes. Reutiliza GET de salud/caché/polling120s; no añade una operación de proveedor o herramienta NodiaAI. Un clic no cambia modelos, modos o conexiones ni inicia login/inferencia. Durante reconsulta mantiene los indicadores, bloquea acciones y muestra carga en el icono; éxito sólo indica observación actualizada, error mantiene datos y un único aviso con reintento manual.

Evaluación de contexto: mejora el acceso visual a la consulta ya existente, sin cambiar conceptos, datos, interpretación de resultados ni autoridad. La [ficha de modelos y salud aprobada](features/ai-models-and-health.md) conserva sus bytes/revisión9; esta evaluación queda en el producto draft/partial/unregistered, sin publicación o aprobación nuevas. No se propone otra herramienta por añadir el botón. [Especificación](../../../features/ai-providers/topbar-mode-health.md#actualización-manual-desde-la-cabecera--2026-11-06) y [evidencia](../../../evidence/ai-topbar-manual-refresh-20261106-r01.json).

ClientR32 activo:17 regresiones/2 archivos, tipos/lint y build aislado;185 archivos actuales y14 versiones históricas verificados, una activación/recarga. QA real ES/oscuro confirmó un GET200 por clic, toast, tooltip, retorno de foco y targets44px dentro de320/599/600/1088px. El bitmap móvil inicial no sincronizado al redimensionar se conserva como intento; la captura320r02 se hizo desde una pestaña ya creada a ese ancho y se inspeccionó aparte. Sin cambios de sesión, inferencias o mutaciones comerciales. Carga/error/rápidos y etiquetas EN se acreditan por unidad, no por un fallo provocado en VM; no acredita teléfono físico.

## Evaluación visual: padding inferior de cabecera — 2026-11-06

Topbar compartido retira su padding inferior en todos los tamaños. No altera conceptos, operaciones, datos o interpretación de salud: controles, consultas, autenticación y permisos siguen su contrato. Por ello no requiere una ficha o herramienta nueva; la ficha aprobada de modelos/salud conserva su revisión/hash. Producto revisión22 sigue draft/partial/unregistered, approval:null.

ClientR33 adoptado con un archivo de estilos,17 regresiones existentes/tipos/lint/build y QA comparada320/600/1088px: padding0, reducción exacta de la altura, sin overflow y controles dentro del ancho. Viewport restaurado y pestaña original intacta; sin inferencias ni mutaciones comerciales. [Detalle](../../../features/ai-providers/topbar-mode-health.md#padding-inferior-de-la-cabecera--2026-11-06) y [evidencia](../../../evidence/topbar-bottom-padding-20261106-r01.json).

## Ajustes de conexiones: ausencia de modelos y reconsulta — 2026-11-12

La [candidata UI](features/ai-connection-settings-ui.md) documenta la nueva
presentación Gemini y recuperación Codex/autenticación. Evaluación: el icono
es visual, sin nueva operación; ocultar controles sin modelos y acotar consultas
es comportamiento local, sin modificar modelos guardados, disponibilidad o
autoridad. Fichas publicadas conservadas; candidata draft/partial/unregistered,
approval:null. [Contrato](../../../mvp/ai-provider-feature-contract.md) y
[evidencia](../../../evidence/ai-provider-ui-state-20261112-r01.json).
