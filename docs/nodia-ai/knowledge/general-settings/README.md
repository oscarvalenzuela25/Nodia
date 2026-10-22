---
{
  "schema_version": 1,
  "document_id": "general-settings",
  "product_id": "general-settings",
  "kind": "product",
  "revision": 9,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "19 lecturas publicadas y17 escritores Core internos implementados en AI-27. El resumen y la nueva ficha permanecen excluidos; las escrituras MCP y la aceptación Gemini siguen pendientes. AI-28 incorpora cuatro preparadores internos y revisión Client de configuración IA no secreta; alcance de laboratorio en74. AI-29 incorpora un canal humano seguro; verificación final pendiente en75. AI36-C02 añade cuatro contratos/adaptadores MCP candidatos para alta/actualización de clave, login de conexión y logout Nodia propio. MCP prepara la propuesta pública; confirmación, secreto e interacción siguen en el canal humano. Sin publicación, cambio nativo o inferencia nueva. SQL aislado:31 comprobaciones C02 y22 de regresión C01 sobre el mismo compilado; no equivale a disponibilidad con cuenta real."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-18",
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
      "docs/evidence/nodia-ai-ai36-c02-validation.json"
    ],
    "notes": "Índice actualizado según el registro de 67 capacidades y 27 bindings funcionales. Esta ficha de producto conserva document_status:draft, integration_status:unregistered y approval:null; su actualización no aprueba el resumen ni lo publica. La evidencia real separa SQL/CSV positivos, factura R2 no configurado y resultados externos/Web parciales con unknown sin replay. No se certifica cada llamada del modelo ni despliegue productivo completo. AI-27: Client1571/205, focal280/7, tipado/lint/build correctos y11 QA sintéticas/6 capturas. Corpus51/24 con67 capacidades/27 fragmentos conservados. AI-28: Client1589/205 y focal241/3, tipado/lint/build correctos; configuración distinta de disponibilidad, modelos por modo y errores recuperables con feedback ES/EN. SQL/laboratorio según74, sin publicación MCP ni aceptación Gemini de escrituras. AI36-C02 añade cuatro contratos/adaptadores MCP candidatos para alta/actualización de clave, login de conexión y logout Nodia propio. MCP prepara la propuesta pública; confirmación, secreto e interacción siguen en el canal humano. Sin publicación, cambio nativo o inferencia nueva. SQL aislado:31 comprobaciones C02 y22 de regresión C01 sobre el mismo compilado; no equivale a disponibilidad con cuenta real."
  },
  "approval": null
}
---

# Ajustes Generales — contexto de producto para NodiaAI

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


## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.
