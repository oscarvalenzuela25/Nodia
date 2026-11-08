---
{
  "schema_version": 1,
  "document_id": "general-settings.ai-credentials-and-sessions",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 9,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "Agentic and API key only. Existing publication fragments retained; implementation verification and live operational acceptance are separate. Human documentary approval recorded 2026-10-27."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/90-agentic-api-only-web-retirement.md",
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
      "path": "nodia-server/src/ai-provider/entities/ai-api-key.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/57-nodia-ai-ai11-durable-worker.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/58-nodia-ai-ai12-context-execution.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/evidence/nodia-ai-ai11-ai12-gemini-adapter-validation.json",
      "kind": "evidence"
    },
    {
      "path": "docs/mvp/61-nodia-ai-ai15-product-reads.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/external/external-read.family.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/external/use-case/read-external.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-products/contracts/external.schema.json",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/mvp/51-nodia-ai-ai05-product-knowledge.md",
      "docs/evidence/nodia-ai-ai05-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai11-ai12-gemini-adapter-validation.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-external-validation.json",
      "docs/evidence/nodia-ai-ai15-artifacts-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai15-live-quota-gateway-final.json",
      "docs/evidence/nodia-ai-ai15-live-codex-root-postfix.json",
      "docs/evidence/ai-two-modes-knowledge-review-r01.json"
    ],
    "notes": "Gemini Agentic real completó un turno de cinco familias SQL (10 comprobaciones) y otro de tres referencias (12): dos CSV autenticados correctos; factura devuelve 503 por R2 sin configurar. La emisión de referencia no certifica bytes disponibles. Routing real completó Web conversacional y delegación opt-in SQL; el siguiente turno Web quedó unknown/502 y se concilió sin replay. El ensayo externo final completó recibos health/engines y luego quedó unknown; no se registra como aceptación generativa completa. La regresión Gateway de las cinco salidas usa observaciones sintéticas y cero inferencias. Los fallos permanecen en sus informes, sin atribuirlos a causa no observada. Las demás lecturas conservan su evidencia aislada SQL/HTTP; publicar no garantiza que el modelo siempre construya llamadas válidas. Pulido documental: evidencia aislada anterior etiquetada como histórica y referencia Codex alineada con su publicación real. Sin nuevas observaciones, herramientas, contratos ni cambios de fragmentos publicados. Two-mode source review on 2026-10-27; new runtime/VM/API acceptance is separate and pending."
  },
  "approval": {
    "reference": "docs/evidence/ai-two-modes-knowledge-human-approval-r01.json",
    "revision": 9,
    "content_sha256": "7da7f1b4aba33b5eaa4d9a2c33d3ea086eb5416ed2aff296d925992cf589c001"
  }
}
---

# Credenciales y sesiones de IA — contexto funcional para NodiaAI

## Modos vigentes solicitados el 2026-10-27

Sólo **Agentic** (`agentic`) y **API key** (`api_key`), conforme al [plan90](../../../../mvp/90-agentic-api-only-web-retirement.md). Flags `use_agentic`/`can_use_agentic`, `use_api_key`/`can_use_api_key`; configuración por `fields.agentic` y `fields.api_key`. Los defaults/selecciones Web se desasignan y requieren elección explícita; no se convierten en otra modalidad. El historial anterior conserva su evidencia y no habilita Web.

La revisión aprobada anterior 8 se conserva byte exacta; el [informe de revisión](../../../../evidence/ai-two-modes-knowledge-review-r01.json) identifica originales y cambios. La disponibilidad de cada funcionalidad se verifica por proveedor/modo/modelo con el [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md); las pruebas históricas de Web no acreditan API ni Agentic actual.

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Gestionar metadata de claves y iniciar/desconectar sesiones por un canal humano seguro, manteniendo las credenciales fuera de modelo, fichas y logs.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Agrega una API key» | Preparar apertura del formulario seguro para esa conexión; jamás solicitar el secret por chat. |
| «Autentica Gemini Agentic» | Abrir flujo seguro Agentic de la instancia exacta y comprobar estado real. |
| «Pega aquí cookies/código de login» | Rechazar ingreso por conversación y remitir al visor seguro. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [AiApiKeyController.findAll](../../../../../nodia-server/src/ai-provider/ai-api-key.controller.ts)<br>`GET /api/v1/ai-api-key` | `nodia_api_keys_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiApiKeyController.create](../../../../../nodia-server/src/ai-provider/ai-api-key.controller.ts)<br>`POST /api/v1/ai-api-key` | `nodia_secure_flows_prepare_api_key_create` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiApiKeyController.update](../../../../../nodia-server/src/ai-provider/ai-api-key.controller.ts)<br>`PUT /api/v1/ai-api-key/:id` | `nodia_secure_flows_prepare_api_key_update` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiApiKeyController.remove](../../../../../nodia-server/src/ai-provider/ai-api-key.controller.ts)<br>`DELETE /api/v1/ai-api-key/:id` | `nodia_api_keys_prepare_delete` (prepare_change, candidato40) | Candidato; sin publicar |
| [AiProviderController.startCodexLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/:id/session/login` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.currentCodexLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/:id/session/login/current` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.codexLoginStatus](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/:id/session/login/:jobId` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.cancelCodexLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/:id/session/login/:jobId/cancel` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.logoutCodex](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/:id/session/logout` | `nodia_ai_providers_prepare_codex_logout` (prepare_change, candidato40) | Candidato; sin publicar |
| [AiProviderController.startGeminiLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/gemini-login/start` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.startGeminiAgenticLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/gemini-agentic-login/start` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.currentGeminiAgenticLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/gemini-agentic-login/current` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.getGeminiAgenticLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/gemini-agentic-login/:jobId` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.submitGeminiAgenticCode](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/gemini-agentic-login/:jobId/code` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.cancelGeminiAgenticLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/gemini-agentic-login/:jobId/cancel` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.getGeminiLoginStatus](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/gemini-login/:jobId` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.cancelGeminiLogin](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/gemini-login/:jobId/cancel` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.getGeminiLoginFrame](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/gemini-login/:jobId/frame` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |
| [AiProviderController.sendGeminiLoginInput](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/gemini-login/:jobId/input` | `nodia_secure_flows_prepare_connection_login` (prepare_secure_flow, candidato40) | Canal humano seguro |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-ai-api-keys.dto.ts](../../../../../nodia-server/src/ai-provider/dto/get-ai-api-keys.dto.ts), [create-ai-api-key.dto.ts](../../../../../nodia-server/src/ai-provider/dto/create-ai-api-key.dto.ts), [update-ai-api-key.dto.ts](../../../../../nodia-server/src/ai-provider/dto/update-ai-api-key.dto.ts), [codex-session.dto.ts](../../../../../nodia-server/src/ai-provider/dto/codex-session.dto.ts), [submit-gemini-agentic-code.dto.ts](../../../../../nodia-server/src/ai-provider/dto/submit-gemini-agentic-code.dto.ts), [gemini-login-input.dto.ts](../../../../../nodia-server/src/ai-provider/dto/gemini-login-input.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-all-ai-api-keys.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-all-ai-api-keys.use-case.ts), [create-ai-api-key.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/create-ai-api-key.use-case.ts), [update-ai-api-key.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/update-ai-api-key.use-case.ts), [delete-ai-api-key.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/delete-ai-api-key.use-case.ts), [manage-codex-session.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts), [manage-gemini-login.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts), [manage-gemini-agentic-login.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/manage-gemini-agentic-login.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Key | Conexión, etiqueta y secret requeridos en formulario seguro; el modelo sólo prepara intención/metadata permitida. Orden/selección/actividad opcionales. |
| Sesión | Proveedor/conexión/motor exactos y actor actual; login/código/contraseña se completan en visor o flujo oficial, nunca en conversación. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

Keys cifradas en ai_api_keys por instancia; devolver sólo máscara/etiqueta. Una clave seleccionada activa bajo protocolo nativo; no mezclar selección de cuentas. Gemini Web y Agentic sesiones independientes; Codex pertenece a OpenAI Agentic; OpenAI Web deshabilitado. No inferir cuotas/ejecución por key guardada/login ni mostrar código del visor al modelo. Delete key/logouts son efectos, no lecturas.

Cinco destinos distintos: /settings/users, /settings/roles, /settings/actions, /settings/modules y /settings/ai-providers. No habilitar todos por asignar uno. Administración global autenticada intencional en19, sin inventar permisos por acción; IA conserva su requisito real ai:manage o super_admin. NodiaAI aplica su módulo más cada destino (AI-07) y salvaguardas NI-13/AI-08.

## Filtros e informes

Listar metadata de keys con filtros públicos; salud detallada proviene de fuente operacional, no editable por petición del modelo aunque DTO legacy admita campos técnicos. Login/status/cancel/frame/input son flujo seguro correlacionado, no herramientas directas del LLM.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Preview metadata, impacto de borrar/seleccionar/desconectar e identidad; credenciales sólo UI→API segura tras consentimiento específico. No reintentar generación desconocida ni cambiar conexión por fallo. La puerta compartida OCR/login/chat/discovery/refresh/logout está implementada en AI-11/12: login retiene reserva hasta cerrar su tarea y un perfil incierto permanece en cuarentena también tras reinicio. Esta ficha no habilita herramientas de credenciales ni el desbloqueo automático.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; elegir Agentic o API key no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-28/29/20/37: aceptación de cuenta del nuevo runtime, proyecciones/flujos seguros de herramientas y conciliación operativa del perfil; API como destino de delegación NodiaAI queda para después.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Contexto y propuestas |
|---|---|---|
| 1 | AI-05: explicación inicial a partir de contratos/código enlazados | Sin cambio de backend ni publicación. Al cambiar reglas/DTOs, actualizar ficha/schema/registro, invalidar propuestas incompatibles y mantener recuperación original |
| 3 | AI-11/12: perfil compartido, cuarentena persistente y adaptador conversacional cerrado | No publica herramientas ni acredita cuenta; AI-14/20/28/29/37 conservan sus gates |
| 4 | Loop MCP técnico acotado, certificación exacta y prueba terminal/acuse | Sin herramientas de negocio ni aprobación/publicación; crash sin proof y legacy requieren intervención |


## Contexto actualizado AI-11/AI-12

[Worker57](../../../../mvp/57-nodia-ai-ai11-durable-worker.md) y
[ejecución58](../../../../mvp/58-nodia-ai-ai12-context-execution.md) incorporan el
puerto privado de conversación y la admisión común por perfil físico. Dos
conexiones no multiplican la capacidad de una misma sesión. Chat, OCR, login,
descubrimiento, refresh y logout se excluyen cuando usan ese perfil; el login
libera al finalizar realmente y el resultado generativo incierto queda en
cuarentena sin reenvío. El marcador técnico mínimo no contiene mensajes o datos
de negocio y no se elimina por vencer un chat.

Agentic se elige directamente; Web no es una opción ejecutable. Agentic sin herramientas usa MCP
vacío y hook sólo `finish`. El loop técnico registrado por Server admite un catálogo
cerrado, callbacks con autorización/fence vigente y presupuestos de RPC/llamadas;
no admite URLs de retorno ni herramientas shell/archivos/HTTP. El gateway de
negocio sigue AI-14. `supports_mcp` exige prueba explícita completa con CLI y hook
reales, ligada a perfil/sesión/modelo/esfuerzo/configuración/protocolo. Auth o health
no generan esa prueba; la caché desaparece al reiniciar o cambiar identidad.

La prueba terminal viaja como metadato privado fuera del texto del modelo y sólo
se produce después del cierre real. Conciliar exige identidad exacta; el acuse
posterior al commit SQL elimina el recibo y estado efímero. No desbloquear un
marcador armado tras crash sin prueba ni un marcador histórico sin identidad.
Modelos/esfuerzos se mantienen exactos; configuración, sesión, elegibilidad e
inferencia siguen siendo observaciones distintas.

La [evidencia aislada](../../../../evidence/nodia-ai-ai11-ai12-gemini-adapter-validation.json)
comprueba contratos con fixtures y no acredita la cuenta ni el loop real actual.
Las pruebas reales se registran separadamente y nunca se deducen de una sesión
válida. En aquella entrega la ficha seguía draft/unregistered, sin herramientas de Ajustes publicadas; el estado actual está en el frontmatter y en la sección AI-15 final.



## Historial AI-15 — implementación previa a publicación

[Entrega y gates](../../../../mvp/61-nodia-ai-ai15-product-reads.md). `nodia_api_keys_list` proyecta únicamente identidad, etiqueta, máscara y metadatos permitidos. Excluye ciphertext, fingerprint, mensajes de errores y relaciones arbitrarias. Cero y false se conservan; ausencia de fechas queda null. No autentica, selecciona, rota o desconecta claves/sesiones. `nodia_ai_providers_codex_session` dispone de puerto externo candidato fuera del checkpoint SQL, con revalidación de configuración y autoridad antes del resultado.


## AI-15 — observación externa acotada

Las cinco lecturas de [entrega61](../../../../mvp/61-nodia-ai-ai15-product-reads.md) reutilizan reglas de proveedor: `nodia_ai_providers_health`, `nodia_ai_providers_gemini_engines`, `nodia_ai_providers_models`, `nodia_ai_providers_codex_session` y `nodia_invoices_eligible_invoice_connections`. Las cuatro administrativas requieren el módulo IA y `ai:manage`; elegibilidad de factura conserva su permiso nativo de Negocios. Todas pasan además por la autorización NodiaAI vigente.

El backend captura proveedores, catálogo y claves mediante consultas por conjuntos acotadas por la política. La observación de red/perfil se realiza después del commit; el resultado sólo se entrega tras releer autoridad y contrastar el hash privado de configuración. Recuperar una llamada completa compara ese snapshot sin repetir la observación; una llamada inconclusa no se reenvía automáticamente. `models` y `codex_session` exigen una conexión exacta, sin selección implícita de otra instancia.

Las proyecciones excluyen JSON arbitrario, secretos, ciphertext, fingerprint, mensajes privados y relaciones no declaradas. Cero, false y null permanecen distintos; modelos salen de descubrimiento dinámico, sin nombres estáticos. Las consultas no generan una inferencia para comprobar salud. Codex no interrumpe un perfil ocupado por otra operación; una cancelación detiene únicamente el perfil admitido por esa observación. La petición remota consume tiempo/recursos y puede fallar; no habilita ni cambia el modo del chat.

Estado histórico de la verificación aislada anterior a la publicación AI-15; el estado vigente y sus límites se registran en el frontmatter y en «Lecturas disponibles en AI-15».

[Evidencia aislada](../../../../evidence/nodia-ai-ai15-external-validation.json): cinco resultados de UCs nativos con SQL real, sin SQL durante la observación, rechazo por cambios de configuración o revocación y descarte tras cancelación. Adaptadores externos sintéticos; cuenta real, publicación y despliegue permanecen pendientes.


## Lecturas disponibles en AI-15

Observar la sesión Codex mediante el adaptador nativo, sin exponer códigos de autenticación ni tokens. Una sesión conectada no certifica inferencia.

Consultar sólo etiquetas y metadatos permitidos de claves. Nunca solicitar ni mostrar ciphertext, fingerprint interno, secreto, cookies o tokens.

Herramientas de esta sección: `nodia_ai_providers_codex_session`, `nodia_api_keys_list`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web se retira conforme al plan90; MCP requiere Agentic verificado elegido directamente, sin delegación ni fallback de modo.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.


En la admisión cancelable Codex, sólo codex_runtime_unavailable y codex_profile_busy conocidos producen available:false con autenticación y fecha desconocidas. No significan sesión cerrada ni inferencia Codex fallida. Los abortos y errores inesperados de adquisición se propagan; nunca detener un perfil ocupado por otro dueño. No atribuir a esta publicación aceptación generativa Codex.
