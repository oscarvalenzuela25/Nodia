---
{
  "schema_version": 1,
  "document_id": "nodia-ai.context-execution",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 12,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-12: loader autorizado, historia canónica, MCP técnico bounded y delegación opt-in Web→Agentic implementados y verificados con Gemini real en VM. UI AI-13, herramientas de negocio AI-14, API y modalidades posteriores pendientes. Ampliación solicitada el 2026-10-18: AI-39/40 planifican Codex Agentic para chat/MCP. La implementación y las pruebas Gemini existentes no prueban disponibilidad conversacional Codex. C05-R01: deadline compartido corregido y comprobado en build/SQL candidatos, sin despliegue Node operativo. Rol propio r01 falló en canario12/unknown_tool; r02inheritMcp cuenta con QAWindows445(443+2históricas)/Linux430aplicables, sin canario por preflight indisponible. Ambas imágenes se retiraron; baseline restablecido,3/7 capacidades acumuladas verificadas por entornos y High/MCP actualmente indisponibles en metadata. No aprobación ni adopción del rol nuevo."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/58-nodia-ai-ai12-context-execution.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/build-nodia-ai-context.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/ai-providers/openai-codex-agentic.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-065-nodia-ai-owned-mcp-execution-role.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-19",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai11-ai12-final-regression.json",
      "docs/evidence/nodia-ai-ai12-routing-postgres-integration.json",
      "docs/evidence/nodia-ai-ai12-postgres-integration.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-validation.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-routing.json",
      "docs/evidence/nodia-ai-ai36-c05-high-runtime-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r01-compiled-delta.json",
      "docs/evidence/nodia-ai-ai36-c05-owned-mcp-agent-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-role-candidate-qa03.json",
      "docs/evidence/nodia-ai-ai36-c05-role-canary12-canary-report.json",
      "docs/evidence/nodia-ai-ai36-c05-live-attempt12-native-diagnostics.json",
      "docs/evidence/nodia-ai-ai36-c05-owned-mcp-agent-r02-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-owned-role-r02-rollback-validation.json"
    ],
    "notes": "PostgreSQL33checks de routing/presupuesto y20 del pipeline; Gemini real comprueba delegación consentida en el mismo run y siguiente turno Web. Corpus vacío real; publicación y lectura de detalles con contenido permanecen verificadas con fixtures sintéticos."
  },
  "approval": null
}
---

# Contexto autorizado y ejecución conversacional

[Producto](../README.md). [Entrega58](../../../../mvp/58-nodia-ai-ai12-context-execution.md).

## Qué resuelve

Enviar al modelo historia canónica y explicaciones de productos publicadas y autorizadas, sin copiar la BD o explorar el repositorio por turno. Ejemplo: «qué datos necesita una reserva» sólo puede respaldarse con una ficha publicada; su existencia como borrador no habilita conocimiento operativo.

## Operaciones y datos mínimos

La admisión fija selección, configuración/sesión observadas, release, módulos y presupuesto. El builder utiliza historia hasta la secuencia admitida, excluye fuentes revocadas y registra referencias/hash/tamaño. Sólo lee resúmenes e índice permitidos de un bundle validado con pin de despliegue; los detalles se solicitan por IDs exactos mediante las lecturas técnicas `nodia_knowledge_index` y `nodia_knowledge_get`. No explora docs en runtime. Exceso de contexto falla explícitamente; compactación y adjuntos quedan para sus etapas.

## Reglas y autoridad

Conservar la intersección del grant original con permisos actuales: un módulo recién asignado puede entrar en un turno nuevo, nunca ampliar el anterior. Markdown no registra herramientas ni concede permisos. Corpus actual draft/unregistered y manifiesto vacío; el prompt informa esta ausencia y no inventa productos, cifras o capacidades.

## Modos y recuperación

Web sólo conversa. Agentic usa únicamente las dos lecturas técnicas registradas; conserva herramientas de negocio cerradas hasta AI-14 y las familias correspondientes. El consentimiento revisionado del backend permite una delegación Web→Agentic al destino exacto verificado de la misma conexión, con su propio modelo/esfuerzo. La solicitud tipada de Web se revalida antes del dispatch; su perfil debe cerrar y liberarse antes de adquirir Agentic. El siguiente turno conserva Web como selección base. El switch visual pertenece a AI-13; API queda para después. No hay fallback por error ni confirmación de escrituras implícita.

El run comparte presupuesto entre etapas. Solicitudes de herramienta repetidas o rechazadas consumen presupuesto; la idempotencia evita repetir el efecto. El supervisor también comunica los rechazos/replays MCP que no llegan al callback Server y sus deltas se reservan en PostgreSQL. Hooks nativos denegados no conceden herramientas ni permisos. Respuesta tipada válida se sella con prueba de cierre y acuse independiente; respuesta incierta queda bloqueada sin replay.

## Estado de integración

Draft/unregistered. Pipeline comprobado con PostgreSQL desechable y Gemini real en VM: worker Agentic/MCP técnico, delegación consentida de dos dispatches en un run y siguiente turno Web. Cancelación real y conciliación SQL no reenvían la generación. La evidencia corresponde a la selección y cuenta probadas; no acredita otros modelos o proveedores.

El corpus conserva43 borradores excluidos y cero documentos/fragmentos publicados; la consulta real del índice devuelve esa ausencia. No hay informes de negocio disponibles por esta ficha. Publicar un producto requiere aprobación, binding/contrato y registro ejecutable compatible de AI-14; cambiar el release implica nuevo build/despliegue y compatibilidad de turnos vigentes. Interfaz, API, adjuntos/voz, compactación y aceptación productiva conservan sus etapas.


## Extensión planificada Codex: AI-39/40

Solicitud del usuario del 2026-10-18, incorporada al [plan](../../../../mvp/45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai). Las secciones de integración anteriores describen la entrega histórica AI-12; no acreditan el estado actual de todos los productos o de otros proveedores.

Codex será el modo Agéntico de una conexión OpenAI ya existente, utilizando la misma conversación canónica de NodiaAI. Ejemplos de intención: «continúa este chat con Codex», «consulta los productos de este proveedor» o «prepara un gasto». Exigen respectivamente una conexión/modelo válidos seleccionados entre turnos, acceso al módulo de destino y los mínimos del contrato nativo. Las peticiones de datos/efectos sólo podrán usar herramientas publicadas y autorizadas; la ficha no las habilita.

AI-39 implementará selección de adaptador, ejecución supervisada, presupuesto de contexto/herramientas y conciliación por runtime. AI-40 incorporará selección/modelo/intensidad en el drawer y comprobará la cuenta real, MCP, continuidad entre proveedores, confirmación exacta y recuperación. Las lecturas y preparadores conservan los contratos comunes; filtros e informes no reciben capacidades nuevas por cambiar proveedor. Login y credenciales continúan en el canal seguro de la app, fuera del modelo.

El cambio Gemini↔Codex será explícito y entre turnos; conserva mensajes, decisiones, preferencias y recibos, sin trasladar cookies o estado privado del proveedor. Un cambio de agente no vuelve a ejecutar efectos ni concede permisos. Las escrituras exigen preview y botón sobre la propuesta exacta. Resultados inciertos requieren conciliación propia; nunca replay por timeout ni fallback de proveedor.

Estado: **planificado, draft/unregistered**. La sesión/OCR Codex histórica se documenta en [su funcionalidad](../../../../features/ai-providers/openai-codex-agentic.md); chat, MCP y modalidades en NodiaAI siguen pendientes de implementación y verificación. Texto será el flujo inicial de aceptación; imágenes/PDF/voz se habilitarán sólo al comprobar formato, modelo y conexión. API key, OpenAI Web y soporte nativo Windows mantienen sus decisiones previas; no se asume compatibilidad de Gemini. No hay migración de tablas de conversación exigida por esta especificación ni nueva publicación.

## Corrección C05-R01: fecha de envío compartida

El [ADR-064 propuesto](../../../../architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md) corrige la diferencia entre el temporizador exterior del worker y el deadline construido para el adaptador. El coordinador debe utilizar la fecha absoluta devuelta por el primer armado durable exitoso, sin reconstruir120s desde otro instante. Preparación acotada y envío comparten el límite global del job/run; las observaciones previas al armado no consumen la ventana propia del proveedor. Segundo armado, compactación o delegación no reinician contadores ni permiten continuar tras cancelación, pérdida de autoridad o incertidumbre.

El usuario prioriza ensayos con High y la selección exacta configurada/observada. Separar modelo base y razonamiento permanece pendiente de producto; no se deduce esa relación desde IDs ni se renombra el catálogo. Estado: corrección local implementada y verificada por QA técnico; aceptación real posterior pendiente. No cambia contratos MCP, permisos, publicación o aprobación de esta ficha draft/unregistered.


La [verificación técnica del compilado corregido](../../../../evidence/nodia-ai-ai36-c05-high-runtime-validation.json) registra4174 pruebas/232 archivos, tipos de producción correctos y192 errores históricos de fixtures sin nuevos errores. El [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r01-compiled-delta.json) preserva971 assets salvo dos JavaScript del worker/coordinador; los74 contratos y el release publicado permanecen idénticos. Esto no acredita inferencia, latencia ni aceptación productiva.

## C05-R01: rol propio MCP y resultado del ensayo

El [ADR-065 propuesto](../../../../architecture/decisions/ADR-065-nodia-ai-owned-mcp-execution-role.md) define un agente MCP propio en el workspace temporal aislado. La revisión r02 hereda el dispatcher mediante inheritMcp:true y declara finish como herramienta nativa; view_file sólo se añade para adjuntos exactos autorizados. Recibe exclusivamente el servidor temporal nodia_runtime. Los hooks, el catálogo/grant de Server y los presupuestos siguen autorizando cada acción; el documento del rol aporta bytes al contexto medido. La política nueva requiere acreditación propia y no hereda pruebas de la anterior.

La [primera revisión](../../../../evidence/nodia-ai-ai36-c05-role-canary12-canary-report.json) llegó a un start nativo, pero terminó sin llamadas MCP con ERROR/unknown_tool. El [diagnóstico12](../../../../evidence/nodia-ai-ai36-c05-live-attempt12-native-diagnostics.json) acredita identidad inicial del agente; no prueba un timeout. Su prueba abandoned_unknown y ACK cierran la limpieza sin verificar el rol ni una capacidad comercial. Esa evidencia y la imagen3f004 permanecen históricas.

La [QA Windows r02](../../../../evidence/nodia-ai-ai36-c05-owned-mcp-agent-r02-validation.json) registra445 pruebas/443 correctas/dos omisiones históricas. El [build04 y QA Linux](../../../../evidence/nodia-ai-ai36-c05-role-build-attempt04.json) comprueba430 pruebas aplicables sin omisiones, nueve dependencias idénticas y tres cambios de47 fuentes Python comparadas: dos del rol y el clasificador de diagnóstico. Los15 métodos C03 de un módulo ausente en la base se excluyen explícitamente; no se presentan como comprobados en Linux. El primer build y el error de importación de la suite431 anterior se conservan por separado. El [metadato estático del CLI](../../../../evidence/nodia-ai-ai36-c05-static-mcp-agent-metadata.json) respalda el campo inheritMcp, sin demostrar su funcionamiento real.

El preflight13 de r02 no admitió inferencia: la observación High falló antes del wrapper, al igual que una segunda observación no generativa autorizada. Su compatibilidad real con MCP sigue sin comprobar; QA445 de r01/canario12 tampoco la acredita. No hay retry de una inferencia incierta, cambio de selección ni permiso adicional.

[Estado final y restauración](../../../../evidence/nodia-ai-ai36-c05-owned-role-r02-rollback-validation.json): ambas imágenes candidatas se retiraron y volvió la imagen exacta b110 original, con cuatro servicios activos y los932 outputs Node operativos intactos. Web aparece disponible en metadata; High aparece indisponible con agentic_unavailable y MCP no verificado. Esto no demuestra un problema de credenciales, cuota o proveedor, ni una inferencia Web nueva. El rol r02 se conserva como candidato local, sin adopción operativa.

La [continuación C05-R01](../../../../evidence/nodia-ai-ai36-c05-r01-acceptance.md) mantiene3/7 capacidades verificadas en sus entornos respectivos: propuesta exacta de03 y dos lecturas de08; cuatro capacidades siguen pendientes. Las respuestas de08–11 pertenecen a su compilado y política originales y no se transfieren a r02. La corrección Node del deadline sólo se verificó en el build candidato971 y SQL desechable; no se copió al runtime operativo932. Esta ficha sigue draft/unregistered y approval null; su redacción no publica herramientas o conocimientos adicionales.
