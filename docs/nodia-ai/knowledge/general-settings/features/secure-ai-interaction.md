---
{
  "schema_version": 1,
  "document_id": "general-settings.secure-ai-interaction",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-29 y R01 cerrados técnicamente en laboratorio privado Linux: ocho preparadores internos, canal humano, pausa, identidad durable y recuperación sin replay. Web/Agentic verificaron login y descubrimiento; MCP Agentic y routing Web→Agentic→Web reales completados. Publicación MCP de escrituras, Windows durable y cuenta/inferencia Codex reales conservan gates independientes. AI36-C02 añade cuatro contratos/adaptadores MCP candidatos para alta/actualización de clave, login de conexión y logout Nodia propio. MCP prepara la propuesta pública; confirmación, secreto e interacción siguen en el canal humano. Sin publicación, cambio nativo o inferencia nueva. SQL aislado:31 comprobaciones C02 y22 de regresión C01 sobre el mismo compilado; no equivale a disponibilidad con cuenta real."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales y NodiaAI conforme AGENTS",
  "sources": [
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-18",
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
      "docs/evidence/nodia-ai-ai36-c02-validation.json"
    ],
    "notes": "Server3113/198,20 suites/502 checks SQL-HTTP+13 Codex. Diagnóstico ampliado:291/291 Linux,289+2 omitidas Windows,17 focales,7 fixtures y19 checks del lector histórico. Login Web/Agentic recuperado y descubrimiento reales; Agentic MCP pasó10checks/cinco familias SQL sintéticas. Routing Web real pasó10checks/tres turnos/cuatro generaciones con lectura de productos y retorno a Web;cleanup completo/sin replay. Salud VM posterior:servicios activos,HTTP200,cero pendientes,873 dist iguales. Fallo119018ms conservado sin causa acreditada; sólo observabilidad ampliada,sin cambio semántico del SDK. Client conserva evidencia histórica. Cierre técnico no aprueba documentos ni publica preparadores. AI36-C02 añade cuatro contratos/adaptadores MCP candidatos para alta/actualización de clave, login de conexión y logout Nodia propio. MCP prepara la propuesta pública; confirmación, secreto e interacción siguen en el canal humano. Sin publicación, cambio nativo o inferencia nueva. SQL aislado:31 comprobaciones C02 y22 de regresión C01 sobre el mismo compilado; no equivale a disponibilidad con cuenta real."
  },
  "approval": null
}
---

# Interacción segura IA — contexto funcional para NodiaAI

## Qué resuelve

Gestionar credenciales/login y acciones externas de proveedores sin solicitar secretos por el chat. [Entrega75](../../../../mvp/75-nodia-ai-ai29-secure-human-flows.md) define el canal humano separado, ocho preparadores internos y pausa de ejecución. Markdown no concede autoridad ni publica herramientas.

## Solicitudes y aclaraciones

| Solicitud ilustrativa | Resolución |
|---|---|
| «Agrega una clave a esta conexión» | Resolver conexión y etiqueta; preparar metadatos, confirmar y abrir el formulario seguro. Nunca pedir la clave en el chat. |
| «Reemplaza la clave» | Aclarar conexión/ID exacto de credencial; conservar selección/actividad según la propuesta. |
| «Conecta Gemini» | Distinguir instancia y Web/Agentic; sus sesiones son independientes. |
| «Cierra sesión» | Aclarar sesión Nodia propia frente al proveedor o sesión Web compartida. |
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
