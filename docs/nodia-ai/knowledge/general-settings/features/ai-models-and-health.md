---
{
  "schema_version": 1,
  "document_id": "general-settings.ai-models-and-health",
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
    "content_sha256": "942cfef6916bbdd0bcdba7616e6747b615c750f22432d5f4d0333feb5023fdd0"
  }
}
---

# Modelos, salud y eventos de IA — contexto funcional para NodiaAI

## Modos vigentes solicitados el 2026-10-27

Sólo **Agentic** (`agentic`) y **API key** (`api_key`), conforme al [plan90](../../../../mvp/90-agentic-api-only-web-retirement.md). Flags `use_agentic`/`can_use_agentic`, `use_api_key`/`can_use_api_key`; configuración por `fields.agentic` y `fields.api_key`. Los defaults/selecciones Web se desasignan y requieren elección explícita; no se convierten en otra modalidad. El historial anterior conserva su evidencia y no habilita Web.

La revisión aprobada anterior 8 se conserva byte exacta; el [informe de revisión](../../../../evidence/ai-two-modes-knowledge-review-r01.json) identifica originales y cambios. La disponibilidad de cada funcionalidad se verifica por proveedor/modo/modelo con el [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md); las pruebas históricas de Web no acreditan API ni Agentic actual.

Estado actual: esta revisión publica sólo el fragmento «Lecturas disponibles en AI-15». Las secciones de implementación/evidencia anteriores a ese fragmento conservan la trazabilidad de entregas iniciales; sus frases históricas sobre publicación pendiente no sustituyen el frontmatter actual ni habilitan escrituras.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión tiene autorización específica de publicación para las lecturas enumeradas al final; las demás operaciones conservan sus gates.

## Qué resuelve y qué significa

Descubrir modelos/opciones y observar salud por conexión/modo con procedencia; no derivar capacidades o cuotas del nombre comercial.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y aclaración esperada |
|---|---|
| «Qué modelo puedo usar» | Consultar catálogo vivo por conexión/modo, sin lista fija. |
| «Cuánta cuota queda» | Mostrar sólo lo observado; si no llega, informar desconocido. |
| «Está logueado, úsalo con MCP» | Sesión no certifica adaptador/ejecución MCP; verificar gates. |

Ejemplos ilustrativos sin resultados ni identificadores reales. Preguntar sólo obligatorios y ambigüedades; los opcionales no bloquean salvo condición del dominio.

## Operaciones y contratos

| Handler y ruta de referencia | Candidato del catálogo40 | Tratamiento vigente |
|---|---|---|
| [AiProviderEventController.findAll](../../../../../nodia-server/src/ai-provider/ai-provider-event.controller.ts)<br>`GET /api/v1/ai-provider-event` | `nodia_ai_events_list` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.getCodexSession](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/:id/session` | `nodia_ai_providers_codex_session` (read, candidato40) | Publicado AI-15; contexto de credenciales/sesiones |
| [AiProviderController.getGeminiEngines](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/gemini-engines` | `nodia_ai_providers_gemini_engines` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.getHealth](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/health` | `nodia_ai_providers_health` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.getSelectableModels](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`GET /api/v1/ai-provider/models` | `nodia_ai_providers_models` (read, candidato40) | Publicado en el release AI-15 de lecturas; disponibilidad observada por separado |
| [AiProviderController.syncModels](../../../../../nodia-server/src/ai-provider/ai-provider.controller.ts)<br>`POST /api/v1/ai-provider/:id/sync-models` | `nodia_ai_providers_prepare_sync_models` (prepare_change, candidato40) | Candidato; sin publicar |

Los aliases de [inventario39](../../../../mvp/nodia-ai-current-endpoints.json) no crean capacidades distintas. Los nombres de operaciones proceden del catálogo documentado en [catálogo40](../../../../mvp/40-nodia-ai-tool-catalog-v1.md): sólo las lecturas enumeradas en esta revisión tienen binding explícito de publicación; las escrituras continúan candidatas.

DTOs de entrada/filtros: [get-ai-provider-events.dto.ts](../../../../../nodia-server/src/ai-provider/dto/get-ai-provider-events.dto.ts), [codex-session.dto.ts](../../../../../nodia-server/src/ai-provider/dto/codex-session.dto.ts), [get-selectable-models.dto.ts](../../../../../nodia-server/src/ai-provider/dto/get-selectable-models.dto.ts)

Delegación actual (casos de uso/servicios según controlador): [get-all-ai-provider-events.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-all-ai-provider-events.use-case.ts), [manage-codex-session.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts), [get-gemini-engines.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-gemini-engines.use-case.ts), [get-ai-providers-health.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-ai-providers-health.use-case.ts), [get-selectable-models.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/get-selectable-models.use-case.ts), [sync-ai-provider-models.use-case.ts](../../../../../nodia-server/src/ai-provider/use-case/sync-ai-provider-models.use-case.ts)

## Datos mínimos y resolución de dudas

| Dato/operación | Obligatorio, condicional u opcional; resolución |
|---|---|
| Modelo | Conexión, modo y modelo exacto descubierto/configurado, esfuerzo sólo si se entrega su soporte. Ausente: Sin modelo asignado y ejecución que lo necesita bloqueada. |
| Observación | Fuente/fecha reales cuando entregadas; cero es dato, null/unknown es desconocido. No inventar latencia o cuota. |

Actor, permisos efectivos, claves de intención, versiones de concurrencia y referencias internas los controla Server; no los inventa ni decide el modelo. DTOs enlazados son fuente de campos, no un JSON Schema estricto de herramienta ya publicado.

## Reglas, acceso y restricciones

getHealth unifica estado/engines observados; getGeminiEngines es ruta de compatibilidad, no segunda consulta paralela obligatoria. Configurar/sincronizar catálogo no prueba inferencia. Topbar API verde significa key configurada según contrato, no salud del motor. Agentic y API key tienen pruebas/disponibilidad distintas por proveedor; Web retirado. AI-03 sólo verifica spike exacto en VM, no runtime MCP productivo ni todos los modelos.

Cinco destinos distintos: /settings/users, /settings/roles, /settings/actions, /settings/modules y /settings/ai-providers. No habilitar todos por asignar uno. Administración global autenticada intencional en19, sin inventar permisos por acción; IA conserva su requisito real ai:manage o super_admin. NodiaAI aplica su módulo más cada destino (AI-07) y salvaguardas NI-13/AI-08.

## Filtros e informes

Eventos técnicos permitidos por provider/event_type/reason; sanitizar mensajes y no exponer errores SDK, secretos o transcripción. Estado histórico no es observación nueva. Sin informes inventados de costo/tokens cuando proveedor no los entrega.

El nuevo registro combinable de [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) sigue pendiente AI-30/31; filtros REST existentes no autorizan joins, campos o SQL libres. [Política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md) acota trabajo del chat y no reemplaza silenciosamente límites del módulo.

## Vista previa, confirmación y recuperación

Lectura de health/modelos no confirma negocio; syncModels es mutación/coste de integración y debe tener preview/identidad adecuada en chat. Fallo conserva configuración, marca observación inválida/desconocida y nunca hace fallback ni inferencia artificial de salud.

Desde NodiaAI, preparar es distinto de ejecutar: cambios requieren vista previa exacta y botón humano de41; elegir Agentic o API key no confirma. Conservar efectos completados si falla un paso dependiente y no reenviar un resultado desconocido. Payload del chat caduca según50 sin borrar registros de dominio ni sus journals nativos.

## Integración y evidencia

- [x] Fuentes de producto/backend, diferencias y mínimos revisados estáticamente en AI-05.
- [x] Correspondencia de handlers/candidatos y enlaces comprobada offline; no prueba de autorización/efectos.
- [ ] Schema de herramienta/proyección, autoridad y contexto registrados con AI-06/07 y familia pertinente.
- [ ] Casos de uso reales de acceso/ambigüedad, confirmación, concurrencia y recuperación verificados para NodiaAI.
- [ ] Adaptador/modalidades, publicación y aceptación operativa comprobados.

Pendientes con efecto sobre disponibilidad: AI-28/29/14: registro de capacidades por evidencia; modo/modelo exactos y proyecciones seguras; destino /settings/ai-providers.

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

[Entrega y gates](../../../../mvp/61-nodia-ai-ai15-product-reads.md). `nodia_ai_events_list` consulta identidad, tipo, razón y fecha del evento con filtros permitidos y actividad/paginado acotados. El mensaje y JSON metadata internos quedan fuera del contexto. Health, motores, sesión Codex y modelos consultan red/perfiles en sus UCs nativos: no se ejecutan dentro del checkpoint ni se presentan como disponibles a partir de flags guardados.


## AI-15 — observación externa acotada

Las cinco lecturas de [entrega61](../../../../mvp/61-nodia-ai-ai15-product-reads.md) reutilizan reglas de proveedor: `nodia_ai_providers_health`, `nodia_ai_providers_gemini_engines`, `nodia_ai_providers_models`, `nodia_ai_providers_codex_session` y `nodia_invoices_eligible_invoice_connections`. Las cuatro administrativas requieren el módulo IA y `ai:manage`; elegibilidad de factura conserva su permiso nativo de Negocios. Todas pasan además por la autorización NodiaAI vigente.

El backend captura proveedores, catálogo y claves mediante consultas por conjuntos acotadas por la política. La observación de red/perfil se realiza después del commit; el resultado sólo se entrega tras releer autoridad y contrastar el hash privado de configuración. Recuperar una llamada completa compara ese snapshot sin repetir la observación; una llamada inconclusa no se reenvía automáticamente. `models` y `codex_session` exigen una conexión exacta, sin selección implícita de otra instancia.

Las proyecciones excluyen JSON arbitrario, secretos, ciphertext, fingerprint, mensajes privados y relaciones no declaradas. Cero, false y null permanecen distintos; modelos salen de descubrimiento dinámico, sin nombres estáticos. Las consultas no generan una inferencia para comprobar salud. Codex no interrumpe un perfil ocupado por otra operación; una cancelación detiene únicamente el perfil admitido por esa observación. La petición remota consume tiempo/recursos y puede fallar; no habilita ni cambia el modo del chat.

Estado histórico de la verificación aislada anterior a la publicación AI-15; el estado vigente y sus límites se registran en el frontmatter y en «Lecturas disponibles en AI-15».

[Evidencia aislada](../../../../evidence/nodia-ai-ai15-external-validation.json): cinco resultados de UCs nativos con SQL real, sin SQL durante la observación, rechazo por cambios de configuración o revocación y descarte tras cancelación. Adaptadores externos sintéticos; cuenta real, publicación y despliegue permanecen pendientes.


## Lecturas disponibles en AI-15

Consultar eventos de IA con proyección pública, sin JSON interno, credenciales ni mensajes de error brutos.

Observar motores Gemini desde el adaptador nativo. Distinguir autenticación, catálogo, configuración y ejecución; no suponer capacidad por el nombre.

Observar salud real del servicio con deadline y cancelación. Un proceso vivo o sesión autenticada no demuestra inferencia; conservar unknown/null cuando el servicio no informa.

Descubrir modelos por conexión y modo explícitos. No usar nombres estáticos ni cambiar silenciosamente proveedor, sesión, modo o modelo.

Herramientas de esta sección: `nodia_ai_events_list`, `nodia_ai_providers_gemini_engines`, `nodia_ai_providers_health`, `nodia_ai_providers_models`.

Resolver entidades, destinatario, intervalo y filtros ambiguos antes de llamar. Usar sólo los campos del schema de la herramienta. Conservar IDs y dinero exactos, cero y falso; ausencia o unknown no equivalen a cero. La paginación y los límites de resultados deben comunicarse y una página no representa el universo completo. En recursos con actividad, iniciar Activo y usar Inactivo/Todos sólo cuando se soliciten; Todos omite el filtro.

Server valida sesión, módulo NodiaAI y todos los módulos destino actuales para usuarios ordinarios; super_admin conserva transversalidad y las reglas de dominio. Datos privados y autoridad se revalidan al devolver o recuperar resultados. Finanzas permite owner_id ajeno sólo a super_admin; Reservas conserva autoridad actual del alojamiento; administración IA conserva ai:manage. No construir SQL libre ni pedir tokens, cookies o secretos.

Esta publicación incluye lecturas y referencias privadas, no preparaciones ni ejecución de escrituras. Cualquier creación, edición, eliminación o confirmación conserva sus herramientas y etapas posteriores. No anunciar informes cruzados, un total por proveedor u otros filtros/agrupaciones si el schema o caso de uso no los soporta. Web se retira conforme al plan90; MCP requiere Agentic verificado elegido directamente, sin delegación ni fallback de modo.

Las observaciones externas se ejecutan fuera de SQL, con deadline/cancelación y verificación posterior de autoridad y configuración. La recuperación de una llamada completada no repite red; una llamada interrumpida no se reintenta ciegamente. Los artefactos son referencias privadas current_on_download: la descarga humana reautoriza chat/recurso, rechaza exceso sin truncar y no conserva el archivo al expirar el chat; el original de factura pertenece al negocio.


La proyección MCP convierte quota_observed_at nativo de segundos Unix a ISO o null, preservando epoch cero y rechazando números inválidos. Si Agentic informa reason runtime_busy, la cuenta no se consultó: authenticated es null y available conserva el estado técnico observado. Salud trata ese caso como desconocido y no como sesión vencida ni necesidad de autenticar. El DTO Web histórico puede perder el motivo al fallar la observación; mientras no lo conserve, no deducir autenticación ni cuotas por ausencia de otros campos. Publicar estas herramientas no significa que todas las observaciones o inferencias terminen correctamente.
