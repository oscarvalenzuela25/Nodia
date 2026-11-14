---
{
  "schema_version": 1,
  "document_id": "nodia-ai",
  "product_id": "nodia-ai",
  "kind": "product",
  "revision": 75,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Índice enlaza la ampliación API chat candidata y sus seis revisiones draft; código implementado, ensayos SQL/API/VM pendientes. Sin aprobación o publicación del producto o fichas por actualizar el índice. R08 enlaza presentación Markdown y recarga visual candidatas: implementación/QA y adopción estática R08 verificadas según recibo; no amplía capacidades ni cambia el dictado. Client R38 adoptado: presentación compacta de propuestas, comparación por contenedor, detalles exactos plegables y etiquetas históricas de ventas de sólo lectura. Conserva borrador/guards de fetch e incertidumbre, confirmación exacta y autoridad; confirmed no acredita efecto aplicado. No cambia otras tarjetas de resultados, registro, capacidades o publicación. Ajustes locales: acciones contained, contexto del actor e identidad NodiaAI exacta, variantes Gemini con IDs reales/OCR independiente y API OpenAI xhigh/max sin Ultra. Backend verificado por alcance; build/lint Client, ProviderDetail38/helper5 y QA visual correctos; suite global Client consolidada: 2812 casos/349 archivos, dos fixtures de Home corregidos y revalidados; ProviderDetail38 separado; sin despliegue, inferencia o publicación de este lote."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme a AGENTS",
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
      "path": "docs/mvp/38-nodia-ai-research-and-v1-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/46-nodia-ai-ai01-contract-baseline.md",
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
      "path": "docs/mvp/53-nodia-ai-ai07-module-authorization.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/56-nodia-ai-ai10-admission-retention.md",
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
      "path": "docs/mvp/59-nodia-ai-ai13-chat-page.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/60-nodia-ai-ai14-capability-registry.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/61-nodia-ai-ai15-product-reads.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/63-nodia-ai-ai17-drafts-revisions.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/64-nodia-ai-ai18-human-confirmation.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/65-nodia-ai-ai19-financial-effect.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/66-nodia-ai-ai20-execution-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/67-nodia-ai-ai21-financial-operations.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/69-nodia-ai-ai23-dependent-workflows.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/76-nodia-ai-ai30-restricted-reports.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/78-nodia-ai-ai32-attachments-voice.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/79-nodia-ai-ai33-accepted-preferences.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/80-nodia-ai-ai34-long-context-compaction.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/81-nodia-ai-ai35-conversation-organization.md",
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
      "path": "docs/architecture/decisions/ADR-063-nodia-ai-bounded-staged-discovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-recovery-acceptance-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-recovery-harness-validation-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-post-recovery-images-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-core-reservations-validation-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-reservations-install-validation-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-compiled-client-nginx-validation-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-client-roundtrip-validation-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-published-family-coverage-r01.json",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-076-durable-human-run-cancellation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-observation/use-case/observe-nodia-ai-run.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/ArtifactObservation/ArtifactObservation.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/components/RunCancellation/RunCancellation.tsx",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-080-conversational-invoice-ocr-product-comparison.md",
      "kind": "specification"
    },
    {
      "path": "docs/nodia-ai/knowledge/nodia-ai/features/invoice-ocr-product-comparison.md",
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
      "path": "docs/features/nodia-ai/proposal-review-presentation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/modules/nodiaAi/infrastructure/historicalProposalPresentation.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-12",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai13-browser-qa.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai17-validation.json",
      "docs/evidence/nodia-ai-ai18-validation.json",
      "docs/evidence/nodia-ai-ai19-validation.json",
      "docs/evidence/nodia-ai-ai20-validation.json",
      "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "docs/evidence/nodia-ai-ai32-r04-validation.json",
      "docs/evidence/nodia-ai-ai32-r04-final-health.json",
      "docs/evidence/nodia-ai-ai32-r05-validation.json",
      "docs/evidence/nodia-ai-ai32-r06-validation.json",
      "docs/evidence/nodia-ai-ai32-r07-validation.json",
      "docs/evidence/nodia-ai-ai33-validation.json",
      "docs/evidence/nodia-ai-ai35-validation.json",
      "docs/evidence/nodia-ai-ai36-requirements-matrix.json",
      "docs/evidence/nodia-ai-ai40-r06-business-read-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r06-finance-read-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-data-variants-r01.json",
      "docs/evidence/nodia-ai-ai40-compaction-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json",
      "docs/evidence/nodia-ai-invoice-ocr-known-rejection-server-adoption-20261026-r01.json",
      "docs/evidence/nodia-ai-antigravity-option-identity-native-adoption-20261026-r02.json",
      "docs/evidence/nodia-ai-ai40-r07-compaction-validation-r01.json",
      "docs/evidence/nodia-ai-antigravity-invoice-ocr-natural-acceptance-20261026-r01.json",
      "docs/evidence/nodia-ai-c05-core-mcp-isolated-acceptance-20261026-r08.json",
      "docs/evidence/nodia-ai-ai40-common-tools-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-remaining-validation-r01.json",
      "docs/evidence/nodia-ai-proposal-ui-20261107-r01.json"
    ],
    "notes": "Revisión de código/contratos candidatos API y preparación documental con originales byte exactos archivados. Código implementado; ensayo SQL, success API chat real, modalidades, imágenes, VM y publicación de esta revisión pendientes. Las evidencias de etapas anteriores conservan su alcance y no califican el modo API nuevo. Aprobación humana pendiente. Plan93 R08 y ficha chat-composer-selection10 registran Client2187/264, QA320–1569px y entrega estática173archivos verificados en evidencia propia; reset del permiso no aplicado. Este índice no aprueba ni publica esa revisión. R38: 218 regresiones/4 archivos (9 helper incluidos); últimos ajustes sólo visuales revisados, tipos/lint finales correctos y build aislado 1401/185. QA sintética y autenticada de propuesta expirada a 320 px, sin overflow, mensajes IA, confirmaciones o mutaciones comerciales; 185 outputs/20 versiones históricas y miss404 verificados. No acredita teléfono físico, efecto comercial ni inferencia. Corte local2026-11-12: backend build/autorización60/HTTP74/API249, build/lint Client, ProviderDetail38/helper5 y QA visual correctos; suite global Client consolidada: 2812 casos/349 archivos, dos fixtures de Home corregidos y revalidados; ProviderDetail38 separado; ver candidata/evidencia, sin despliegue/inferencia de este lote."
  },
  "approval": null
}
---

## Referencias locales de recuperación — 2026-11-10

Las rutas de `ops/lab/artifacts/` citadas debajo identifican originales locales ignorados por Git; no se distribuyen con un checkout ni con el paquete productivo. Se conservan sus nombres, hechos y fuentes portables ya enlazadas, sin copiar originales, alterar evidencias o ampliar aprobación/publicación. Esta revisión sólo corrige su presentación documental y sigue draft/unregistered, con approval:null.

## Ampliación candidata: chat API key — 2026-10-27

[Paridad API key](features/api-key-chat-parity.md), [coordinación revisión18](features/conversation-coordination.md), [OCR/comparación revisión2](features/invoice-ocr-product-comparison.md), [imágenes revisión4](features/image-generation.md) y [adjuntos revisión11](features/attachments-and-voice.md) son borradores para revisión humana conforme [plan92](../../../mvp/92-nodia-ai-api-chat-parity.md). El [gateway común draft](features/capability-registry-gateway.md) permite API sin afirmar MCP; comparte grants, permisos41/89 y confirmación, ledger/proof HTTP3 y presupuesto por POST. Código implementado con ensayos SQL/API/VM aún pendientes. Los originales aprobados se conservan en el catálogo privado local `ops/lab/artifacts/api-chat-parity-r01/catalog.json` (ignorado por Git); no se hereda su aceptación de Agentic a API ni se declaran 151 operaciones reales verificadas. Este índice permanece draft/unregistered/approval:null. Los cortes inferiores conservan sus fechas y alcances anteriores.

[Informe de revisión API](../../../evidence/api-chat-knowledge-review-r01.json). El índice conserva sus 32 referencias de evidencia histórica en metadata; este informe nuevo queda enlazado sin borrar las anteriores.

## Corte vigente: OCR natural Agentic aceptado por alcance; R05 y P1 adoptados — 2026-10-26

## Cambio solicitado el 2026-10-27: Agentic y API key

La petición actual retira Web y su delegación a Agentic; se mantienen sólo `agentic` y `api_key`. [Modos IA Agentic y API key](../general-settings/features/agentic-api-modes.md), [implementación90](../../../mvp/90-agentic-api-only-web-retirement.md) y [aceptación de proveedores91](../../../mvp/91-ai-provider-onboarding-verification.md). Implementación en curso y aceptación VM/API por comprobar. La existencia de un modo no habilita todas las capacidades; historial/snapshots y evidencias anteriores se preservan con sus límites. Los apartados inferiores son cortes previos, no habilitan ejecución Web.

[Server R05](../../../evidence/nodia-ai-invoice-ocr-known-rejection-server-adoption-20261026-r01.json), manifiesto `01af…`/knowledge `b90…`, conserva Client4157/nginx9f94 y [política89](../../../mvp/89-module-access-and-user-data-scope.md). Cierra de forma tipada sólo rechazos conocidos anteriores a NativeStart; la incertidumbre conserva su tratamiento estricto. El [P1 nativo adoptado](../../../evidence/nodia-ai-antigravity-option-identity-native-adoption-20261026-r02.json), imagen `4695…` e inicio20:16UTC, exige evidencia positiva vigente para validar modelo/esfuerzo y conserva el core OCR común, sus vínculos de cuenta y lector propio. Las adopciones conservaron las 61 proyecciones SQL/esquema, configuración, 152 capacidades/304 esquemas, 43 fragmentos/41 contenidos aprobados, backups frescos/siete días y timers; sin generación ni efecto comercial durante esas operaciones. La ficha aprobada y su hash permanecen intactos.

La [prueba natural actual con Antigravity Agentic Low](../../../evidence/nodia-ai-antigravity-invoice-ocr-natural-acceptance-20261026-r01.json) pasó en4695/sesión87e con cualificación MCP propia: primero lista/elección explícita del proveedor, después una sola etapa OCR del PDF estándar, cuatro ceros tipados y cuatro campos null. M3 leyó/comparó el mismo resultado sin otro OCR, con observación fresca `20:37:22.367Z` frente a M2 `20:29:13.826Z`; el readback tras reload es byteidéntico, las 40 tablas de dominio/esquema se conservan y quiet es cero. Products vacío produce una partida sin coincidencia y comparación desconocida; no acredita subidas/bajadas reales ni guardado comercial. El PNG positivo anterior pertenece a706 y conserva cuatro null, sin los cuatro ceros de esta fixture PDF. No se generaliza a High, otros modelos/cuentas, MIME o entornos; Web/API conservan su implementación y quedan fuera de esta aceptación.

El PDF adversarial NR26 del chat anterior quedó negativo en planificación, sin OCR: CLI ERROR/exit1 tras 73.741s, no un timeout de119s; causa interna desconocida, conciliación/ACK exactos y sin replay. El control independiente del mismo componente PDF pasó, pero no convierte aquel recorrido natural en aceptado. Ambos alcances y los límites de ACK históricos constan en la evidencia anterior; no se infieren ACKtrue desde campos null. Codex conserva su [aceptación OCR/PDF acotada](../../../evidence/nodia-ai-invoice-ocr-chat-acceptance-20261026-r01.json) y [NR26 adversarial propio](../../../evidence/nodia-ai-nr26-products-ocr-codex-acceptance-20261026-r02.json), sin equivalencia automática entre proveedores.

[Core R08](../../../evidence/nodia-ai-c05-core-mcp-isolated-acceptance-20261026-r08.json) verifica 11 checks en PostgreSQL desechable: un efecto efímero, una ejecución/recibo, replays inertes y CleanupUC con ACK fixture. No es MCP/proveedor/UI real ni escritura en la BD de uso. [C05](../../../evidence/nodia-ai-c05-provider-update-preview-20261026-r01.json) y [C02](../../../evidence/nodia-ai-c02-agentic-secure-previews-20261026-r03.json) conservan sus vistas previas sin confirmación/ejecución. C03, AI-36/C05 y AI-38 siguen abiertos globalmente; AI-40 mantiene su cierre técnico Linux.

Pendientes priorizados por dependencia:

- **Técnicos autónomos:** matrices Agentic restantes y NR26 natural pendiente; [NR32](../../../evidence/nodia-ai-nr32-incompatible-isolated-validation-20261026-r01.json) valida el mecanismo en PG aislado, pero faltan dos despliegues incompatibles/UI. El desfase de tiempos de admisión20s/observe30s (archivo local ignorado por Git `ops/lab/artifacts/nodia-ai-admission-timeout-contract-audit-r01/README.md`) es un finding de fuentes; falta correlación HTTP/commit para atribuir causa, sin cambio de timeout ni replay automático.
- **Humanos:** confirmación exacta para guardar cambios comerciales y completar canales seguros; las vistas previas y pruebas aisladas no la sustituyen. Variaciones reales requieren productos coincidentes y datos autorizados, sin defaults.
- **Temporales/externos:** [AI38](../../../evidence/nodia-ai-ai38-current-retention-observation-20261026-r02.json) conserva una observación puntual de46backups ready y primera expiración `2026-10-27T23:58:20.785Z`; no es inventario vivo. Faltan siete días continuos, limpieza física dentro de24h, todos los destinos/versiones y eliminación remota comprobable según proveedor.

**Corte anterior R04/6401:** la [pista de descubrimiento](../../../evidence/nodia-ai-invoice-ocr-discovery-hint-server-adoption-20261026-r01.json) conservaba el índice autorizado completo, sin conceder herramientas, y el [core común](../../../evidence/nodia-ai-invoice-ocr-native-core-adoption-20261026-r03.json) ya estaba adoptado. La [cualificación Low anterior](../../../evidence/nodia-ai-antigravity-low-mcp-qualification-20261026-r01.json), su [OCR parcial fallido y conciliado](../../../evidence/nodia-ai-antigravity-low-ocr-chat-partial-acceptance-20261026-r01.json) y los [fallos High históricos](../../../evidence/nodia-ai-antigravity-ocr-chat-partial-acceptance-20261026-r01.json) mantienen sus epochs y límites; no se atribuye una causa interna no retenida ni se heredan sus proofs al P1. Los apartados siguientes describen cortes históricos.

## Corte histórico AI-40 — Lecturas y controles

AI-40 completado técnicamente en la VM Linux local. R08/ClientR04, cuenta real Codex/MCP y matriz por alcance verificados. Las dos variantes finales están cerradas: categoría2 activa/elegible y factura1 de importe0 con PDF real en R2; la UI descarga1894bytes/SHA exactos. La actualización de la misma preferencia se confirma por botón humano, deja un recibo/revisión2 y pasa readback/contextos/recarga con la categoría nueva. Snapshot64mensajes/34runs/51dispatches, cero pendientes; finanzas/configuración/cuatro proofs/servicios conservados. Fixtures retenidos y marcados; respaldo cifrado previo,27 backups sin expirados y journal histórico confirmado. PDF/audio originales permanecen bloqueados para el scope observado; descarga PDF no acredita entrada al modelo. Windows/API/OpenAIWeb/producción, otras cuentas/selecciones y77 candidatos mantienen su alcance separado. AI-36/C05 y AI-38 conservan sus gates; sin aprobación documental ni publicación nuevas.

[Evidencia y límites](../../../evidence/nodia-ai-ai40-remaining-validation-r01.json).

## Corte sucesor — Helpers y preferencias aceptadas con Codex

La [aceptación real](../../../evidence/nodia-ai-ai40-common-tools-validation-r01.json) distingue lectura, preparación y efecto humano: cuatro intenciones/ocho dispatches/18RPC, tres helpers propios y dos preparadores publicados. R01 caduca sin ejecución; R02 se confirma en la app sobre revisión/hash nuevos y crea dos preferencias propias mediante una sola ejecución/dos recibos. El conjunto tiene dos pasos independientes y bindings vacíos; los preparadores publicados no ofrecen una pareja tipada compatible para aceptar dependencia, aunque el coordinador sí la soporte. Readback y fingerprints reconstruidos de run/ambas etapas comprueban inclusión de memoria aceptada y recarga con dos tarjetas; no prueban cambio de proveedor con recuerdos no vacíos ni defaults financieros implícitos.

Final38mensajes/20runs/28dispatches/seis adjuntos/dos ejecuciones/tres recibos, dos recuerdos y cero pendientes. Finanzas, R07/config/proofs conservados. 116unidades existentes,17checks de recibos y11readback separados; schema publicado compuesto distinto del template. Reloj/refresh son observaciones sin causalidad exclusiva ni fix. AI-40 sigue parcial por agregados/relaciones, archivos, observaciones externas y variantes explícitas. Client5e30 fue la superficie; cambios visuales contained pertenecen a un sucesor aún por verificar. Sin aprobación/publicación ni cambio de45/registry; los cortes inferiores conservan sus hechos históricos.


Verificación sucesora: [recuperación real](../../../evidence/nodia-ai-ai40-recovery-acceptance-r01.json) y [fallos del harness conciliados](../../../evidence/nodia-ai-ai40-recovery-harness-validation-r01.json), con límites y recalificación actual separados.


## Corte sucesor R07: compactación y PNG actuales

La [entrega R07](../../../evidence/nodia-ai-ai40-r07-selective-delivery-r01.json) adopta dos fuentes de producción y seis outputs: progreso cero-RPC de compactación en contexto con el mismo ledger monotónico y fence, reserva verificada antes/después y rechazo de cualquier uso de herramientas. No amplía el gateway ordinario ni sus permisos. Los [265 casos focales y tipado de producción/lint](../../../evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json) pasan; el chequeo global de tipos de fixtures falla con202 errores y no se presenta como verde. El defecto offline es reproducible, pero no demuestra el código causal no conservado en el [unknown real R06](../../../evidence/nodia-ai-ai40-compaction-validation-r01.json).

El [MCP propio R07](../../../evidence/nodia-ai-ai40-r07-mcp-qualification-r01.json) completa una generación/un callback y ACK exacto, con proof nuevo b6350cbf…7e60d para el scope observado. La [compactación real posterior](../../../evidence/nodia-ai-ai40-r07-compaction-validation-r01.json) completa dos intenciones y tres dispatches(2+1): un snapshot con siete citas literales cubre secuencias1..6; el segundo turno reutiliza su ID/sourcehash sin otra compactación. Ambos resultados semánticos son exactos y los tres terminales completed tienen ACK, procesos ausentes, grupos cerrados y staging vacío antes de retirar el fixture. Son seis fuentes sintéticas y Redis sintético en PostgreSQL aislado, con Create/Admit/RunStage compilados reales y cuenta real; no el daemon/UI operativo ejecutando ese historial. C40-09 acepta sólo este subconjunto, no toda recuperación/autoridad.

Los [tres calificadores MIME nuevos](../../../evidence/nodia-ai-ai40-r07-native-images-r01.json) verifican PNG/JPEG/WebP por separado con semántica, ACK y cleanup propios. El [PNG nuevo desde UI](../../../evidence/nodia-ai-ai40-r07-ui-image-validation-r01.json) recorre Vite autenticado→R2→admisión/contexto→worker operativo R07: un upload/un envío/un dispatch y cero herramientas/RPC. Original de11233bytes con SHA exacto y sin interpretación textual; respuesta visual exacta, terminal/ACK, staging vacío y recarga preservada. HEAD confirma200 y GET real completa con SHA/tamaño; el status HTTP de GET no entregado por el SDK permanece null. No es una nueva prueba UI JPEG/WebP ni imagen+MCP en un turno R07.

El corte final conserva26 mensajes/14runs/16dispatches/seis adjuntos, una ejecución/recibo y el único movimiento2 histórico; cero pendientes y proof MCP preservado. El compositor vuelve a estar habilitado/vacío y el envío deshabilitado por texto vacío tras recarga; la ocupación transitoria desaparece automáticamente. No hay nuevo efecto de negocio, replay, login/configuración modificados, aprobación o publicación. Los positivos previos de Finanzas/Negocios y los negativos conservan sus alcances históricos.

Los [gates Linux y el límite administrativo](../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#corte-sucesor-2026-10-23--r07-compactación-real-e-imagen-desde-la-ui) permanecen explícitos; no se aceptan todas las familias, recuperación, Client compilado, Windows o producción. Esta ficha sigue draft/unregistered y no publica capacidades. Los cortes inferiores son históricos.

## Corte sucesor 2026-10-23 — Compactación R06 incierta y disponibilidad invalidada

El [ensayo real de compactación R06](../../../evidence/nodia-ai-ai40-compaction-validation-r01.json) termina en resultado incierto tras armar un único dispatch SQL. No consta una inferencia efectiva completada ni una respuesta; el transporte registra3frames/721bytes y0RPC. Su cierre físico, terminal/ACK y staging vacío se verifican sin reenviar la inferencia; el PostgreSQL desechable se retira tras la conciliación. No hay snapshot/continuidad aceptados y C40-09 permanece bloqueado. La causa está en investigación offline; no se atribuye a duración, tamaño, proveedor o a los fixes selectivos sin evidencia propia. El intento anterior R01 falló en el caller antes de despachar y se conserva por separado: cero generaciones nativas no equivalen al resultado R02.

El fallo invalida legítimamente los cuatro proofs del scope operativo: MCP/PNG/JPEG/WebP quedan actualmente sin verificar. Los [tres positivos nativos R06](../../../evidence/nodia-ai-ai40-r06-native-images-r01.json) anteriores conservan sus semánticas exactas, terminales/ACK y staging vacío; son un corte histórico, sin disponibilidad actual ni aceptación nueva de UI/R2. Lo mismo aplica al canario MCP y a las lecturas UI representativas de Finanzas y Negocios anteriores. No se restauran/copian proofs, no hay fallback y no se inicia una recalificación mientras se investiga.

API/worker siguen en R06; configuración y SQL operativo permanecen en24 mensajes/13runs/15dispatches/cinco adjuntos, una ejecución/recibo/efecto histórico y cero pendientes. El recorrido PNG nuevo desde UI sólo quedó preparado: wrapper readonly R06 pinneado y bootstrap SQL sin perfil/proveedor/R2; ningún upload, envío o generación UI. Ese bootstrap no acredita originales ni recorrido funcional.

Los gates Linux priorizados están en [86](../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#corte-sucesor-2026-10-23--compactación-r06-incierta-y-disponibilidad-invalidada). Esta ficha continúa draft/unregistered y no publica capacidades. Los cortes inferiores conservan sus alcances históricos.

## Corte sucesor: lista de Negocios y bloqueo de entorno en Reservas

La [lista de Negocios desde UI](../../../evidence/nodia-ai-ai40-r06-business-read-validation-r01.json) recorre el worker normal con selección técnica, barrera de ACK y lectura publicada: dos dispatches/callbacks y ambos terminales/ACK propios. Bajo super_admin y módulo actuales, page1/limit1/activity all/all_businesses true devuelve un total que coincide con SQL antes/después. La respuesta UI y el único byte sellado son exactos; no se exponen nombres/precios en la evidencia.24 mensajes/13runs/15dispatches/cinco adjuntos, un efecto histórico y cero pendientes; MCP conservado.

La misma evidencia verifica la ruta publicada /tools/reservations sin módulo en el entorno operativo, aunque su tabla existe. El destino no está autorizado y el oráculo de alojamientos permanece null, sin ejecutar COUNT ni crear módulos/permisos/casas. Es bloqueo de configuración del entorno; no se declara inexistente la implementación de Reservas. El positivo acepta una lista representativa de Negocios y conserva el GET financiero previo, sin aceptar todas las operaciones/familias ni la compactación real. Los cortes inferiores conservan sus alcances históricos.

## Corte sucesor: R06 y lectura financiera propia

La [entrega R06](../../../evidence/nodia-ai-ai40-r06-selective-delivery-r01.json) ensaya adopción/reversión/re-adopción sin inferencias ni efectos. Su [MCP propio](../../../evidence/nodia-ai-ai40-r06-mcp-qualification-r01.json) completa un nonce real y ACK en el nuevo fingerprint, sin restaurar pruebas históricas. La [lectura financiera UI](../../../evidence/nodia-ai-ai40-r06-finance-read-validation-r01.json) usa una intención nueva, selección técnica/barrera ACK/GET financiero, dos dispatches/dos callbacks y una respuesta final contrastada con SQL. Ambos ACK nativos, grupos cerrados y staging vacío;22 mensajes/12runs/13dispatches/cinco adjuntos y único efecto histórico conservados, cero pendientes. La recarga autenticada conserva run, counters, SHA de respuesta y fixture, con compositor habilitado y sin nuevo envío.

Es aceptación acotada de un GET financiero representativo y continuidad del marcador/gasto en Vite después de las transiciones. No acepta todo C40-06, compactación Codex, originales de imagen actuales, audio, Client compilado o Windows. Los fallos previos y sus recibos se conservan; no se atribuye causalidad retrospectiva a los fixes ni se repite el turno incierto. Los cortes inferiores son históricos.

## Corte AI-40: incertidumbre real y disponibilidad invalidada

La [conciliación real](../../../evidence/nodia-ai-ai40-real-unknown-reconciliation-r01.json) sucede a los positivos históricos de imágenes/PDF de esta ficha. El único turno financiero nuevo sólo completa selección de capacidades y termina sin respuesta; no acredita lectura de Finanzas. Una única intervención administrativa reautoriza actor/sesión, verifica cierre nativo y ACK y elimina el pendiente sin reenviar la generación. SQL/FS confirman20 mensajes/11runs/11dispatches/cinco adjuntos, único efecto histórico2 intacto y cero pendientes. El TypeError del operador ocurrió al proyectar un job que cleanup ya había eliminado; no se repitió la acción.

MCP/PNG/JPEG/WebP quedan legítimamente invalidados en el scope operativo. Los recibos anteriores siguen siendo históricos; disponibilidad actual requiere reaceptación propia y no se recupera copiando proofs. R05 continúa activo; las correcciones de compactación por transporte y terminal sin texto de selección son candidatas sin adopción/aceptación real. PDF revisado conserva su positivo como texto; audio continúa sin proof. Los [fixes selectivos](../../../evidence/nodia-ai-ai40-selective-fixes-validation-r01.json) pasan322 pruebas focales/5 archivos, tipado y lint; el candidato R06 cambia fingerprint y excluye WAV, sin aceptación operativa. La causa original de la inferencia sigue desconocida. C40-06 y las variantes restantes de C40-09/C40-11 permanecen parciales.

# NodiaAI — contexto de producto

## Selección de modelo y esfuerzo — candidato local, 2026-11-14

El compositor y la configuración del chat agrupan familias Gemini Agentic
inequívocas y el esfuerzo resuelve a un ID real del catálogo. Una observación de
otra variante no habilita Aplicar; las tuplas históricas contradictorias siguen
visibles sin reparación automática. Sincronización y Teacher conservan el mismo
criterio de identidad. [Ficha candidata](../general-settings/features/ai-provider-interface-and-module-access.md#continuación-local-selectores-agrupados--2026-11-14)
y [evidencia local](../../../evidence/model-selector-residual-audit-20261114.md).
No incorpora herramientas, inferencia o publicación; los estados de aprobación
se conservan.

Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

## Propósito y alcance

Conversar en lenguaje natural sobre los productos de Nodia, consultar información autorizada y preparar cambios revisables. Conservar historial, decisiones y efectos al cambiar conexión/modo/modelo entre turnos. El dato de negocio permanece en su módulo y se consulta mediante herramientas, sin copiar la BD en el chat.

## Conceptos y relaciones

- Conversación: contenido canónico de un dueño, organización y selección; caduca90 días desde su último mensaje nuevo.
- Turno: trabajo admitido con selección/release fijos, independiente de que la página permanezca abierta.
- Propuesta: comandos/efectos revisables, versión y hash, pendiente de botón humano; el mensaje del modelo no la confirma.
- Ejecución: conjunto confirmado y recibos por paso; conservar lo creado al fallar otro paso.
- Conocimiento funcional: fichas versionadas autorizadas, distintas del historial, memoria y datos actuales de BD.

## Módulos y autoridad

Destino `/tools/nodia-ai`, key `nodia_ai`, catálogo/migración y política compartida implementados en [AI-07/53](../../../mvp/53-nodia-ai-ai07-module-authorization.md). IDs/asignaciones se resuelven en cada BD; instalación y asignación del entorno de uso pendientes. Navegación conserva asignación para todos, backend permite bypass a super_admin activo. Ordinarios requieren NodiaAI y cada módulo de destino, además de la autoridad del recurso. super_admin tiene el alcance transversal confirmado; reglas compartidas implementadas en AI-08. Un contenido, preferencia o nombre de herramienta no concede permiso.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración |
|---|---|---|---|
| Admisión y retención del chat | [chat-admission-retention](features/chat-admission-retention.md) | API y mantenimiento M1 verificados aisladamente | Unregistered |
| Worker durable | [durable-worker](features/durable-worker.md) | AI-11 implementado: worker independiente, perfil compartido y conciliación verificados con Gemini real | Unregistered |
| Contexto y ejecución | [context-execution](features/context-execution.md) | AI-12 implementado: loader/builder, MCP técnico y delegación opt-in verificados con Gemini real | Unregistered |
| Autoridad transversal e invariantes | [shared-authority](features/shared-authority.md) | Parcial: REST/Client y barreras verificadas; puertos pendientes | Unregistered |
| Módulo y autorización compartida | [module-authorization](features/module-authorization.md) | Catálogo/ruta/política compartida AI-07; consumidores de conversación y worker integrados posteriormente | Unregistered |
| Persistencia de conversación M1 | [conversation-persistence](features/conversation-persistence.md) | Once tablas y puertos AI-09; API/worker integrados en AI-10/11 | Unregistered |
| Coordinación de conversación y cambios | [conversation-coordination](features/conversation-coordination.md) | Parcial: API durable, página/drawer y observación AI-16; propuestas/confirmación posteriores | Unregistered |
| Viabilidad Gemini Web | [gemini-web-viability](features/gemini-web-viability.md) | Spike verificado; adaptador conversacional integrado AI-12 con historia canónica comprobada | Unregistered |
| Viabilidad Gemini Agentic/MCP | [gemini-agentic-viability](features/gemini-agentic-viability.md) | Spike verificado; worker, MCP técnico y cancelación/conciliación integrados AI-11/12 | Unregistered |
| OCR de factura y comparación de Productos | [invoice-ocr-product-comparison](features/invoice-ocr-product-comparison.md) | Publicado; proveedor, un OCR PDF y comparación posterior/reload verificados con Codex en laboratorio | Función aprobada; aceptación acotada. Producto padre draft/unregistered |
| Audio original Codex por MIME | [codex-audio-inputs](features/codex-audio-inputs.md) | Candidato WAV PCM16; dos ensayos reales negativos, PDF revisado disponible como texto | Unregistered |
| Admisión, presupuestos y conservación | [runtime-policy](features/runtime-policy.md) | Configuración/validador AI-04; ocho gates productivos pendientes | Unregistered |
| Registro de capacidades y ToolGateway | [capability-registry-gateway](features/capability-registry-gateway.md) | AI-14 implementado/verificado localmente; familias reales vacías, sin lecturas de negocio publicadas | Unregistered |
| Metadatos y publicación del conocimiento | [knowledge-publication](features/knowledge-publication.md) | Compilador AI-06/loader AI-12 implementados; AI-15 publica27 fragmentos funcionales, esta ficha propia sigue excluida | Unregistered |

Resto de funciones de página/runtime/herramientas/adjuntos/informes/memoria se especifica en45 y se añadirá conforme a su implementación. Esta ficha no modifica el alcance ni marca esas funciones disponibles.

## Restricciones y evolución

[Política48](../../../mvp/48-nodia-ai-mode-routing-policy.md) establece Web conversacional y Agentic con MCP. El backend AI-12 implementa consentimiento opt-in revisionado para alternar desde Web sólo hacia Agentic verificado de la misma conexión en v1; API después. Revalida elegibilidad, modelo/esfuerzo, sesión/configuración y consentimiento antes del dispatch. El siguiente turno conserva Web como base. [AI-13](../../../mvp/59-nodia-ai-ai13-chat-page.md) incorpora el drawer/switch con catálogo autorizado y comprobación no generativa. Historial canónico compartido y confirmación humana de escrituras conservados; MCP técnico no concede operaciones de negocio.

Bulk/import, carpetas de chats y globo global quedan fuera de v1 según alcance; nunca SQL/HTTP arbitrario o secretos como herramienta. Las operaciones respetan el contrato de su módulo. Cambios incompatibles invalidan propuestas pendientes; receipts históricos no se reejecutan. Nuevos productos integran fichas, herramientas y pruebas sin tablas conversacionales nuevas.

[Política50](../../../mvp/50-nodia-ai-ai04-runtime-policy.md):5 minutos por voz/20 MiB por archivo confirmados, presupuestos propios globales por turno. Sin archivo técnico adicional al borrar el chat; resueltos se eliminan, sólo tareas mínimas de unknown/limpieza hasta cerrar. Negocio y preferencias aceptadas independientes. Backup/restore y borrado físico requieren gates reales; ficha/configuración no prueban ejecución.

| Revisión | Cambio | Fuente/evidencia | Impacto |
|---|---|---|---|
| 1 | Documentar el producto y coordinación AI-01 | Contratos y evidencia enlazados | No publicación ni runtime |
| 2 | Evaluación AI-02 de loop Web con cuenta | Evidencia y ficha de viabilidad | No herramientas productivas ni API; gate de admisión compartida pendiente |
| 3 | AI-03 Agentic/MCP con cuenta e historial en perfil nuevo | Evidencia49 y ficha Agentic | Adapter_states sin activar; no publicar runtime/herramientas/switch |
| 4 | Política AI-04, límites propios y conservación mínima | Política50/evidencia/ficha runtime-policy | Sin archivo adicional ni nuevas tablas; gates productivos pendientes |
| 5 | AI-05 fichas de productos y AI-06 frontmatter único/compilación | Contrato52 y ficha knowledge-publication |37 borradores; cero contexto/capacidades publicados, sin tablas nuevas |
| 6 | Módulo/política compartida AI-07 | Contrato53 y ficha module-authorization | Sin chat/herramientas publicados; AI-08 transversalidad/barreras implementadas; runtime pendiente |
| 10 | AI-11/12: worker independiente, contexto/MCP técnico, delegación y conciliación con Gemini real | Entregas57/58 y evidencia conjunta real | Producto parcial; corpus43 draft/unregistered, cero contenido/herramientas de negocio publicados |
| 12 | AI-14: registro, descubrimiento HTTP/MCP y ToolGateway con contratos/autoridad compartidos | [Entrega60](../../../mvp/60-nodia-ai-ai14-capability-registry.md) y [ficha](features/capability-registry-gateway.md) | Tres ayudantes técnicos; 44 borradores, cero familias reales publicadas; selección acotada del transporte pendiente AI-15/36 |


[Autoridad transversal AI-08](features/shared-authority.md): actor/destinatario, transacciones y NI-13.


[Persistencia AI-09](features/conversation-persistence.md): once tablas M1 y contratos cerrados. AI-10 añade mensajes/admisión/retención; AI-11/12 incorporan worker, contexto, routing y conciliación con aceptación Gemini real. [Evidencia conjunta](../../../evidence/nodia-ai-ai11-ai12-live-validation.json). AI-13 incorpora página y drawer, verificados por separado. El producto completo sigue parcial: registro/gateway AI-14 implementado y lecturas de negocio AI-15/familias, eventos públicos completos, API, adjuntos/voz, memoria/compactación y gates productivos conservan su trabajo independiente.


## Actualización AI-15 — lecturas publicadas

[Entrega y gates](../../../mvp/61-nodia-ai-ai15-product-reads.md). AI-15 implementa 59 lectores candidatos: Negocios 12, Finanzas 11, Reservas 21, Core 10 y administración IA 5. La composición consume sólo IDs de una publicación compilada aprobada; el release AI-15 contiene67 contratos y27 fragmentos de lectura. Las pruebas temporales sí ejecutan puertos nativos con PostgreSQL aislado. Los ocho puertos adicionales están implementados con límites propios y verificados aisladamente. La publicación de67 capacidades está materializada; Gemini real conserva evidencia positiva y resultados parciales descritos en61, sin aceptación universal de inferencias.


Ampliación AI-15: [contrato de ejecución y archivos](../../../mvp/61-nodia-ai-ai15-product-reads.md). Cinco consultas externas usan prepare/execute/verify con deadline, señal y fingerprint; un replay no repite red y un recibo interrumpido no se redispara. Tres referencias de artefacto permiten descargas humanas reautorizadas con datos actuales, sin URL firmada ni archivo persistente adicional. Sin cambios visuales en esta entrega.


## Publicación de lecturas AI-15 — estado actual

AI-15 publica 67 contratos de lectura/referencia con 27 fragmentos revisados, manteniendo otras 17 fichas excluidas. Gemini real verificó familias SQL y referencias/CSV; routing y externas conservan resultados parciales y desconocidos explícitos. Este resumen de producto y las doce fichas propias de NodiaAI mantienen aprobación pendiente y no tienen bindings.

El corpus incorpora46 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y19 fichas draft/unregistered excluidas. La nueva ficha de efectos confirmados de Negocios está excluida; no modifica los cuerpos de las siete fichas aprobadas de lectura de ese producto. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.

## Observación y navegación AI-16

[Entrega62](../../../mvp/62-nodia-ai-ai16-observation-navigation.md) integra el journal M1, cursores individuales y resultados con autoridad actual. El historial abre actividad por intención y los enlaces apuntan a rutas reales; fecha y conteos corresponden a la consulta guardada. PostgreSQL/HTTP y Gemini real se registran por separado en la evidencia; no se repiten herramientas al regresar. Sin SSE/tokens simulados ni escrituras publicadas. La [ficha de coordinación](features/conversation-coordination.md) permanece draft/unregistered:67 capacidades/27 fragmentos publicados se conservan.

[AI-17/63](../../../mvp/63-nodia-ai-ai17-drafts-revisions.md): mínimo obligatorio→aclaración→revisión congelada, con CAS y autoridad actual. La ficha sigue draft/unregistered, sin aprobación ni herramientas nuevas.

## Canal humano AI-18

[Entrega64](../../../mvp/64-nodia-ai-ai18-human-confirmation.md): una nueva edición crea revisión/hash y exige nueva revisión humana. El desafío sólo se obtiene desde el botón de la app; el modelo no lo recibe. La solicitud original se recupera con su identidad; otra solicitud sobre una propuesta ya admitida obtiene409 y recupera con GET. El estado en cola no acredita un cambio de negocio. Los campos de categoría/obligación permanecen sólo de lectura en este primer editor. Registro operativo vacío: confirmación deshabilitada hasta completar ejecutor nativo y recuperación. Ficha draft/unregistered sin aprobación/publicación adicional.

[AI-19/65](../../../mvp/65-nodia-ai-ai19-financial-effect.md) implementa un efecto financiero interno con recibo atómico, sin nueva publicación. La preparación/ejecución operativa conserva sus gates de AI-20.


[AI-20/66](../../../mvp/66-nodia-ai-ai20-execution-recovery.md) conecta el worker al movimiento confirmado, con receipt atómico, recuperación SQL sin replay y cancelación/reanudación humanas. El flujo de preparación MCP sigue pendiente de publicación; esta ficha continúa draft/unregistered.

## Ampliación AI-21 — familia financiera

[Entrega67](../../../mvp/67-nodia-ai-ai21-financial-operations.md) amplía el registro interno y worker a doce escrituras financieras individuales: CRUD de movimientos, categorías, grupos y obligaciones. Reutiliza reglas/escritores nativos, una operación por propuesta y recibo atómico con recuperación de AI-20. Crear obligación y movimiento inicial, corregir principal y retirar pertenencias son efectos compuestos del mismo caso de uso; no habilitan secuencias arbitrarias. El ID objetivo forma parte del comando congelado y el recibo de eliminación es histórico, observable sin exigir que el registro siga presente.

Las once lecturas financieras publicadas conservan sus contratos. Los nuevos preparadores MCP siguen sin publicar; 67 capacidades/27 fragmentos de lectura no se convierten en herramientas de escritura por editar documentación. La evidencia final AI-21 está pendiente de consolidación en67 y se separará de Gemini/preparación real y aceptación productiva. Este resumen y la [ficha de coordinación](features/conversation-coordination.md) siguen draft/unregistered, con approval:null y sin nuevos sources en el registro de publicación.


## Ampliación AI-22 — efectos individuales de Negocios

[Entrega68](../../../mvp/68-nodia-ai-ai22-business-operations.md) incorpora catorce puertos internos de negocios/colaboradores, productos/logs, proveedores/contactos y facturas. Mantiene confirmación humana exacta, manager/witness compartidos y recuperación sin reejecutar para observar. Sólo un paso por propuesta; secuencias dependientes esperan AI-23. La nueva ficha de Negocios permanece draft/unregistered; las siete fichas aprobadas de lectura no cambian y no se publican preparadores MCP. Nuevo upload/promoción de adjuntos y traslado de facturas con archivo esperan AI-32; lecturas privadas/CSV existentes continúan y R2 binario real conserva su gate. La evidencia final de la etapa queda pendiente de consolidar en68, separada de Gemini y aceptación productiva.

## Ampliación AI-23 — secuencias dependientes

[Entrega69](../../../mvp/69-nodia-ai-ai23-dependent-workflows.md) reúne uno a ocho borradores del mismo chat/actor en una propuesta exacta y reemplaza las propuestas individuales reclamadas. El primer enlace operativo pasa el ID de un proveedor creado a su contacto; no habilita referencias arbitrarias ni lotes. El conjunto se ejecuta paso a paso y conserva los efectos comprometidos si otro paso falla o se cancela. Reanudar continúa lo pendiente con el mismo comando; corregir exige otra propuesta/botón y enlaza la ejecución previa.

La [ficha de coordinación](features/conversation-coordination.md) detalla referencias futuras, edición por paso, first-bind durable y límites de recuperación. Son ampliaciones draft/unregistered, sin nuevas fuentes documentales, aprobación ni escrituras MCP publicadas. La evidencia SQL/worker/migración y Client se consolida en69; QA sintético no acredita Gemini. El contexto publicado conserva67 lecturas/referencias y27 fragmentos, sujeto al build/pin de release validado por Server.


AI-30 incorpora [fuentes e informes restringidos](features/restricted-reports.md), motor interno de una fuente y catálogo autorizado; combinación y presentación quedan en AI-31. Ver [entrega76](../../../mvp/76-nodia-ai-ai30-restricted-reports.md). Sin publicación MCP implícita.

AI-31 incorpora composición de fuentes, puertos técnicos de lectura y presentación del recibo con totales/procedencia separados; ver [entrega77](../../../mvp/77-nodia-ai-ai31-cross-reports.md). La ficha de informes sigue draft/unregistered; no habilita operaciones por Markdown.

AI-32: [adjuntos y notas de voz](features/attachments-and-voice.md), draft/unregistered; contratos, límites y evidencia en[78](../../../mvp/78-nodia-ai-ai32-attachments-voice.md).

AI-32-R01: [evidencia vigente](../../../evidence/nodia-ai-ai32-r01-validation.json) y [entrega78](../../../mvp/78-nodia-ai-ai32-attachments-voice.md). JSON Web con citas externas canónicas corregido; imagen/PDF comprobados en Web y Agentic, audio español y archivo+MCP sintético de lectura en Agentic.337 pruebas Python Linux; audio Web, R2 real, micrófono físico y traslado legacy mantienen aceptación pendiente. Esta ficha continúa draft/unregistered y no publica herramientas.

AI-32-R02: [entrega78](../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r02--formatos-de-audio-y-traslado-legacy), [evidencia](../../../evidence/nodia-ai-ai32-r02-validation.json). Pruebas por MIME exacto, WAV español verificado en Web, audio comprimido Web pendiente; traslado legacy implementado con135 checks SQL/regresión y storage sintético. Sin conversión automática ni nuevos preparadores MCP publicados. R2 real/micrófono físico conservan sus gates. Los párrafos R01 anteriores son históricos.


## Revalidación AI-32-R05

R2 y voz física verificadas en el flujo Web desde la app, con originales sin interpretación aceptada, respuesta, descarga privada y recarga. El formulario mantiene contenido y acciones dentro del chat; cargar historial se bloquea durante captura. Evaluación de impacto visual: no cambia contratos, herramientas, permisos o significado de los datos. [Entrega R05](../../../mvp/78-nodia-ai-ai32-attachments-voice.md) documenta los límites; esta ficha permanece draft/unregistered y sin aprobación.


## Revalidación AI-32-R06

Purga por generación y copias de factura verificadas con R2 real, casos de uso compilados y SQL desechable; la copia de factura sobrevive a la expiración del chat. Reemplazo con contenido distinto, traslado legacy, rollback y recuperación conservan sus contratos. No se equipara esta prueba con publicación MCP o aceptación productiva. [Entrega R06](../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) mantiene evidencia y límites. Ficha draft/unregistered y approval null conservados.

## Cierre técnico AI-32-R07

R07 completa lifecycle del inspector (hijo muerto/timeout/cancelación, cuatro casos Windows/Linux) y expiración durante PUT con recuperación R2 en otro proceso y ventana70s real. Cierre técnico AI-32 en laboratorio; aceptación productiva/publicación separadas, sin aprobar la ficha. [Entrega](../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r07--aceptación-técnica-y-recuperación-tras-put-tardío) y [evidencia](../../../evidence/nodia-ai-ai32-r07-validation.json). Las modalidades mantienen sus pruebas exactas R04/R05; R07 no añade inferencia ni disponibilidad.

## Preferencias aceptadas AI-33

[Ficha](features/accepted-preferences.md) y [entrega79](../../../mvp/79-nodia-ai-ai33-accepted-preferences.md): memoria explícita propia, independiente del chat, sin secretos ni permisos. Crear/editar/olvidar exige propuesta y botón exactos; contexto reautorizado, límite50 y exclusión de recuerdos no disponibles. SQL36 y UI sintética verificados; herramientas MCP de preferencias aún sin publicar.


## Contexto largo AI-34

[Ficha](features/long-context-compaction.md) y [entrega80](../../../mvp/80-nodia-ai-ai34-long-context-compaction.md): snapshots vinculados a secuencia/hash y scope, originales intactos, referencias operativas actuales y error explícito si no cabe. SQL36 y regresiones verificados; Web y Agentic compactan y responden desde memoria con cuenta real. MCP completa un callback sintético con ACK. Cierre técnico de laboratorio por capas, sin aceptación productiva ni nueva publicación MCP; formatos de adjuntos conservan su verificación independiente.

- [Organización e interacción del chat](features/conversation-organization.md): AI-35, draft/unregistered; [entrega81](../../../mvp/81-nodia-ai-ai35-conversation-organization.md).

- [Pruebas integrales y cobertura AI-36](../../../mvp/82-nodia-ai-ai36-integral-coverage.md): evidencia por capa y contratos pendientes; no nueva capacidad publicada.

- [Codex Agentic en NodiaAI](features/context-execution.md#extensión-planificada-codex-ai-3940): ampliación planificada AI-39/40; reutiliza conocimiento, autoridad y confirmación, sin nueva publicación.


## Continuación AI36-C01 — preparación MCP candidata

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c01--contratos-y-adaptadores-de-preparación-mcp), [ADR-061](../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md) y [evidencia](../../../evidence/nodia-ai-ai36-c01-validation.json). Esta continuación actualiza el estado histórico descrito arriba: existen 73 contratos cerrados y adaptadores candidatos para Finanzas, Negocios, Reservas, Core y configuración no secreta de proveedores. La documentación y el código no los publican automáticamente.

Una petición parcial puede generar preguntas sobre los campos mínimos; continuar exige borrador y revisión exactos. El backend fija actor, sesión y conversación, conserva validación nativa y contrasta el resultado completo con la propuesta persistida. Un resultado inválido revierte borrador, propuesta y recibo MCP conjuntamente. Reutilizar un call_id sólo recupera su recibo exacto con autoridad vigente. El modelo no confirma ni ejecuta: el botón humano sobre la propuesta exacta conserva su canal autenticado.

Los campos JSON flexibles nativos admitidos se representan como datos tipados cerrados; no habilitan comandos, secretos ni campos de autoridad. Los límites físicos del transporte pueden rechazar tamaños/profundidades aceptados por una API nativa. No se inventan capacidades por tener un endpoint o un nombre en el catálogo.

PostgreSQL desechable comprueba dos recorridos representativos, financieros y de proveedor, con 22 comprobaciones de preparación, confirmación, recibo, replay, revocación y rollback. No hubo inferencia Gemini, R2, despliegue ni modificación de datos operativos. Las 67 capacidades de lectura y 27 fragmentos publicados permanecen intactos; los 73 preparadores siguen sin publicar. Selección del catálogo y aceptación real son gates posteriores; los cuatro flujos seguros, analizador de factura y seis ayudantes conservan C02..C04. No hay cambios visuales, de tablas, migraciones o endpoints en C01.


## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.


## AI36-C03 — análisis de factura en generación activa

La [ficha de análisis activo](../businesses/features/active-invoice-analysis.md) detalla el candidato MCP de dos fases y sus límites. Reutiliza el parser nativo, acredita el adjunto original del turno y conserva una extracción pendiente de revisión. No inicia OCR anidado ni crea registros comerciales. [Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md) conserva la separación entre implementación, pruebas, publicación y aceptación real.


## AI36-C04 — seis ayudantes comunes candidatos

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) y [evidencia C04](../../../evidence/nodia-ai-ai36-c04-validation.json) documentan los contratos/adaptadores explícitos de propuestas, operaciones, conjuntos, adjuntos y preferencias. Las lecturas de propuestas/operaciones/adjuntos quedan ligadas al chat del contexto backend; las preferencias pertenecen al actor, incluso para super_admin. El metadato de adjunto no entrega contenido, nombre de archivo, interpretación, URL o clave de almacenamiento. Las preparaciones sólo generan borrador/propuesta: el botón y canal humanos conservan confirmación, ejecución, reanudación/cancelación y aceptación de memoria. Sin cambios visuales ni impacto de layout/responsive/bundle cliente. Esta ficha permanece draft/unregistered; su actualización no publica herramientas.

## AI36-C05 — publicación selectiva y descubrimiento por etapas

El usuario eligió «Descubrimiento automático por etapas». La [entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c05--publicación-selectiva-y-descubrimiento-por-etapas) y el [ADR-063 propuesto](../../../architecture/decisions/ADR-063-nodia-ai-bounded-staged-discovery.md) separan esa decisión de la aprobación documental y de la aceptación operativa.

La primera publicación selectiva añade crear un movimiento financiero y seis ayudantes comunes a las67lecturas existentes:74capacidades/31fragmentos,59fuentes/28excluidas;77candidatos siguen sin publicar. Se conservan los27contenidos aprobados anteriores, sus contratos y hashes MCP. El epoch opaco heredado conserva compatibilidad de recibos; el release de contenido cambia. La [autorización estrecha](../../../evidence/nodia-ai-ai36-c05-publication-authorization.md) se limita a los siete contratos y cuatro secciones necesarias; esta ficha de producto/arquitectura permanece draft/unregistered.

La generación de descubrimiento presenta ocho herramientas técnicas, incluidas búsqueda/descripción autorizadas y `nodia_capabilities_select`. La selección contiene IDs exactos contra el catálogo global publicado/autorizado y su hash congelado; el recibo no amplía el grant de la generación en vuelo. Una vez comprobados el cierre nativo, prueba terminal y ACK, la etapa local `tool_selection`, sin inferencia, reemplaza la allowlist del grant por la selección validada bajo módulos/ámbito congelados y permisos vigentes, y reanuda inferencia normal o delegada. La ejecución recibe sólo el subconjunto más siete técnicos; desaparece la herramienta de selección. No se modifica una generación en vuelo ni se trunca un catálogo para hacerlo caber.

Se mantienen74herramientas/131072bytes de catálogo y las cotas independientes JSON128, grant SQL128 y contexto262144bytes. Agentic usa dos generaciones cuando solicita/valida selección; un saludo, aclaración o informe técnico acotado puede completar en una sin seleccionar capacidades. Web→Agentic opt-in puede requerir tres, siempre en la misma conexión y sin cambiar proveedor/modo por error o repetir inferencias inciertas. Los perfiles explícitos `finance_assistance` y compatibilidad de lecturas son opciones API/backend/pruebas; no se incorpora un selector de perfiles a la UI.

La [matriz por capacidad](../../../evidence/nodia-ai-ai36-c05-publication-validation.json) distingue publicación en fuentes, selección candidata, pruebas internas por familia, evidencia externa histórica y aceptación actual pendiente. El perfil financiero de18capacidades no acredita aceptación automática. La nueva transición está en implementación/verificación; no atribuirle todavía SQL o inferencia real del candidato. Se reutilizan manifiestos, grants, recibos y etapas, sin Python, DDL o UI nuevos. Los efectos siguen necesitando la propuesta exacta y botón humano; selección automática no acepta preferencias ni confirma cambios.

## Continuación AI-40 de implementación

[Borradores de texto](features/conversation-organization.md) e [imágenes candidatas Codex](features/codex-image-inputs.md) conservan autoridad, retención y confirmación comunes. La segunda ficha es nueva y draft/unregistered; no modifica el fragmento aprobado de adjuntos ni habilita originales. El [documento86](../../../mvp/86-nodia-ai-ai40-codex-acceptance.md) distingue código, pruebas y gates reales pendientes.

Antecedentes históricos conservados fuera del índice acotado de verificación actual: [evidencia](../../../evidence/nodia-ai-ai04-runtime-policy-validation.json).


### Continuación verificada: borrador y formatos nativos

La [aceptación de navegador](../../../evidence/nodia-ai-ai40-draft-browser-r01.json) verifica recuperación exacta de texto sin enviar tras recarga/remount, cancelación del drawer y aislamiento frente a otro chat, sin enviarlo. La restauración exige un GET posterior al montaje, cambio de actor/sesión/chat o reanudación; caché o lecturas canceladas no acreditan acceso. Un fallo transitorio preserva texto ya autorizado en la misma época, bloqueando acciones; una denegación lo retira.

Los [tres probes de imágenes](../../../evidence/nodia-ai-ai40-native-images-r01.json) aceptan PNG/JPEG/WebP por semántica/terminal/ACK en un candidato aislado con la cuenta real. Esto no adopta el paquete en R03 ni acepta imagen desde UI/R2/admisión/worker o MCP combinado; PDF/audio siguen pendientes. La [entrega86](../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#aceptación-2026-10-23--borrador-en-navegador-e-imágenes-codex-reales) conserva scope y gates, sin aprobación o publicación nuevas.

### Adopción R04 y recorrido de imágenes desde la UI

La [entrega R04](../../../evidence/nodia-ai-ai40-r04-image-delivery-r01.json) adopta el transporte en la VM Linux local conservando cuenta/configuración, esquema y journal. La [verificación UI→R2→worker](../../../evidence/nodia-ai-ai40-ui-image-flow-r01.json) acredita un PNG sintético: bytes y SHA exactos, original sin interpretación textual, lectura semántica de sus píxeles, un dispatch y terminal/ACK con staging limpio. El positivo no acredita herramientas MCP en ese turno.

El JPEG queda íntegro y vinculado en R2, pero el worker termina antes del dispatch con NodiaAiAdapterError; no hay inferencia nativa ni ACK que verificar. La coincidencia temporal con una consulta de capacidades es compatible con contención del perfil, sin causalidad demostrada. Se prepara un reintento durable acotado sólo para runtime_busy/not_dispatched durante observe; jamás se reintenta una inferencia enviada o incierta. WebP desde UI, imagen+MCP, PDF/audio y los gates generales conservan sus pendientes. La ficha sigue draft/unregistered.

### Recorrido completo y sucesor R05

La [entrega R05](../../../evidence/nodia-ai-ai40-r05-predispatch-delivery-r01.json) conserva la identidad técnica del transporte:11fronteras JavaScript, binario, Node/V8 y política exactos, corroborados por la observación real posterior. Se adopta una corrección de coordinación previa al dispatch: sólo la observación con runtime_busy/not_dispatched de clase real usa el retry durable existente y acotado; ejecución, resultados inciertos, cancelación y medición mantienen sus barreras.

La [aceptación UI/R2/worker](../../../evidence/nodia-ai-ai40-ui-image-flow-r01.json) completa PNG en R04 y JPEG/WebP en R05 con códigos exclusivos de los píxeles, originales sin interpretación textual, SHA/tamaño R2 exactos y terminal/ACK/staging limpio. JPEG completa también nodia_knowledge_index con1callback/1RPC y procedencia de22items/cuatro dominios contrastada con el recibo; no acredita todas las herramientas de los productos. Los tres turnos positivos tienen un dispatch cada uno, sin retries.

Recargar conserva respuestas y17mensajes/9runs/9dispatches/4adjuntos; una ejecución/recibo y movimiento2 históricos permanecen únicos y no hay pendientes. El primer JPEG fallido sigue registrado con0dispatches: no se reetiqueta como error del proveedor ni se demuestra su causalidad. Las pruebas atómicas sí verifican la nueva clasificación del perfil ocupado. Se conservan los gates independientes de PDF/audio, otras familias, recuperación real, Client compilado/reversión y Windows; AI-40 sigue parcial.

## Continuación AI-40: PDF como texto revisado y WAV sin aceptación

La [ficha de audio Codex](features/codex-audio-inputs.md) conserva draft/unregistered. El [consolidado documental](../../../evidence/nodia-ai-ai40-document-audio-validation-r01.json) separa tres resultados: PDF raw rechazado por el decoder instalado; PDF extraído y aceptado por el dueño que completa como texto desde UI/R2/worker R05; y dos canarios WAV PCM16 distintos sin aceptación semántica ni proof de audio. No se incorpora renderizado, OCR, transcode o cambio de proveedor/modo.

El PDF revisado usa un dispatch y cero herramientas, respuesta exacta, R2/SHA y ACK propios. La recuperación de una observación runtime_busy anterior ocurre antes de despachar y no repite inferencia. SQL conserva19 mensajes/10 runs/10 dispatches/cinco adjuntos y una ejecución/recibo/efecto financiero histórico movimiento2, sin pendientes. El original PDF no forma parte del payload nativo enviado.

El candidato audio tiene352 pruebas focales y6 del wrapper observacional; ambos canarios cierran proceso/grupo, terminal y ACK con staging vacío. En el segundo, una única llamada nativa devuelve un rechazo explícito de53 bytes/ocho palabras, oráculo no coincidente y audio_probe_unverified; el diagnóstico no acredita causa ASR ni incompatibilidad global. No existe aceptación WAV y no se adopta el candidato. La [evidencia del operador](../../../evidence/nodia-ai-ai40-audio-native-probes-r01.json) conserva ambos negativos sin reescribirlos como éxitos.

R05 y sus proofs MCP/imagen previos mantienen sus bytes. Los positivos históricos de [imágenes UI](../../../evidence/nodia-ai-ai40-ui-image-flow-r01.json) conservan su alcance propio y no prestan aceptación al audio candidato. Se mantienen31 fragmentos/74 capacidades, ninguna aprobación o herramienta nueva y AI-40 parcial.

La [captura PDF revisado](../../../evidence/nodia-ai-ai40-pdf-reviewed-text-ui-r01.jpg) y la inspección final del consolidado verifican recarga autenticada: respuesta exacta persistida, compositor habilitado y borrador vacío. Se conservan19 mensajes/10 runs/10 dispatches/cinco adjuntos, el único efecto histórico y cero pendientes, sin reenviar ni confirmar nada.

Antecedentes históricos conservados fuera del índice acotado actual: [nodia-ai-v1-catalog-contracts-validation](../../../evidence/nodia-ai-v1-catalog-contracts-validation.json), [nodia-ai-ai02-gemini-web-viability](../../../evidence/nodia-ai-ai02-gemini-web-viability.json).

Antecedentes históricos conservados fuera del índice acotado actual: [nodia-ai-ai03-gemini-agentic-viability](../../../evidence/nodia-ai-ai03-gemini-agentic-viability.json), [nodia-ai-ai06-knowledge-publication-validation](../../../evidence/nodia-ai-ai06-knowledge-publication-validation.json), [nodia-ai-ai07-authorization-validation](../../../evidence/nodia-ai-ai07-authorization-validation.json), [nodia-ai-ai08-authority-validation](../../../evidence/nodia-ai-ai08-authority-validation.json), [nodia-ai-ai09-persistence-validation](../../../evidence/nodia-ai-ai09-persistence-validation.json), [nodia-ai-ai10-ai12-validation](../../../evidence/nodia-ai-ai10-ai12-validation.json).


## Continuación AI-40: Core representativo y autoridad de Reservas

La [verificación Core/Reservas](../../../evidence/nodia-ai-ai40-core-reservations-validation-r01.json) distingue una lista Core real por UI/worker y dos ACK de un diagnóstico de instalación sin inferencia de Reservas. `nodia_modules_list` devuelve un registro de página y total8, contrastado con SQL; no se acepta toda Core. La ausencia del módulo `/tools/reservations` oculta sus herramientas y devuelve403 aunque existan tablas/contratos. Total de alojamientos null/sin COUNT, sin seed ni ampliación de permisos. Super_admin omite asignación, no existencia/actividad del destino. La instalación explícita y la aceptación de Reservas son pasos separados. R07/publicación conservados; AI-40 parcial.


## Continuación AI-40: Reservas instalado y listado autorizado

La [aceptación de instalación/lectura](../../../evidence/nodia-ai-ai40-reservations-install-validation-r01.json) verifica el módulo9 activo de la VM, seed compilado real ejecutado una vez y navegación/asignaciones previas conservadas. La existencia del módulo permite que Authorize/discovery actuales presenten sus21 herramientas; no sustituye permisos por casa ni confirma operaciones. Una lista desde UI/worker Codex devuelve0 alojamientos frente a SQL, con dos dispatches/callbacks, terminales/ACK y cierre físico. No se crearon casas/reservas/pagos para obtener un positivo. Borrador e historial sobreviven al mantenimiento y la recarga. El fallo inmediato del observador START queda separado de la verificación posterior del estado real, sin repetirlo. Instalación operativa y una lectura vacía representativa: no es un cambio de contratos/herramientas/publicación ni aceptación de todas las variantes. R07/proofs vigentes conservados; AI-40 sigue parcial.


## Continuación AI-40: Client compilado y continuidad autenticada

La [aceptación nginx/UI](../../../evidence/nodia-ai-ai40-compiled-client-nginx-validation-r01.json) verifica los assets de producción y el mismo chat autenticado en origen5174 por SSH/nginx, sin depender de Vite. Historial, selección y borrador sin enviar se conservan tras cancelar el drawer, salir/volver y recargar; GET frescos y oráculo SQL idéntico respaldan la continuidad. No se envía un turno, aplica configuración o crea un efecto. Es aceptación de entrega/continuidad, no nueva inferencia o modalidad del proveedor. R07/publicación intactos; AI-40 conserva sus demás gates y la reversión nginx sólo preparada.


## Corte AI-40 — Reversión del Client y cierre delimitado

Reversión Client A→descriptor404→A verificada, un reload por fase,172 assets y API/SHA conservados. Misma pestaña autentica y restaura historial/selección/borrador tras GET fresco; ES/EN/ES y Cancelar sin Aplicar comprobados, borrador retirado sin enviar. Oráculo propio byteidéntico30/16/20/seis adjuntos/un efecto histórico, cero generaciones/confirmaciones/efectos nuevos o pendientes; R07/proofs/PIDs/época actual conservados. Matriz11gates reconciliada e inventario74 contrastado con runtime: cuatro bloques restantes por mecanismo (preferencias/workflows, agregados/filtros, archivos, observaciones IA), más móvil/continuidad de preferencias reales. AI-40 parcial; Windows/API/producción y77candidatos separados, sin aprobación/publicación/checklist nuevos.

Fuentes: [reversión y continuidad](../../../evidence/nodia-ai-ai40-client-roundtrip-validation-r01.json), [cobertura por mecanismo](../../../evidence/nodia-ai-ai40-published-family-coverage-r01.json). Son hechos de aceptación y límites documentados, no contratos ni permisos nuevos.

## Ampliación planificada — Generación de imágenes

[AI-41](../../../mvp/45-nodia-ai-implementation-plan.md#e12--generación-de-imágenes-en-nodiaai), incorporada por solicitud del usuario el 2026-10-25: investigación por canal, texto → una imagen → vista/descarga y aceptación real propia. [Ficha de generación](features/image-generation.md), draft/planned/unregistered; no habilita herramientas ni declara disponibilidad. Edición, variantes y asociación a productos quedan para una ampliación posterior. La revisión60 añade este enlace al índice; conserva los alcances de implementación y aceptación anteriores.

## Evaluación de impacto visual — Botones contained

Ajuste visual solicitado el2026-10-24: [botones contained verificados](../../../evidence/nodia-ai-ai40-contained-buttons-r01.json).84 botones text/predeterminados pasan a contained en21 TSX de NodiaAI; seis outlined e IconButton conservados.98 regresiones atómicas existentes, lint/tipos y dos builds reproducibles correctos. Client65c1… adoptado con172 archivos HTTP/SHA/MIME; recarga autenticada conserva chat, selección y dos preferencias. Preferencias/drawer/adjuntos observados en1045×892, oscuro/ES, controles44px y sin scroll horizontal del documento; no prueba móvil ni todos los estados Alert. Sólo presentación: no cambia contexto funcional, contratos, permisos, herramientas ni confirmación. Operador sin SDK/escrituras SQL; no mensajes, confirmaciones o efectos de negocio nuevos desde UI. Backend/configuración/proofs/finanzas conservados; la renovación normal de sesión no se confunde con identidad física de toda la BD. AI-40 sigue parcial.

## Recuperación de política de adjuntos — 2026-10-25

Corrección Client de una lectura existente: el panel y la admisión comparten una consulta de compatibilidad por actor/sesión/chat/revisión. Un original READY sin MIME verificado puede volver a consultar mediante una acción explícita, incluso tras HTTP200 sin formatos; durante el GET se bloquean controles/envío, sin desmontar el editor ni perder File o interpretación no aceptada. El resultado vacío o fallido no acredita disponibilidad nativa, y la comprobación no vuelve a subir archivos ni acepta texto.

La [evaluación de impacto y pruebas locales](../../../evidence/nodia-ai-attachment-policy-retry-impact-r02.json) distingue esta recuperación de un cambio sólo visual: conserva los contratos, autoridad y semántica de [adjuntos y voz](features/attachments-and-voice.md), cuya ficha aprobada permanece intacta. No añade herramientas ni capacidades, no reconstruye/publica conocimiento y mantiene fda151/42. Client1995/246 en suite aislada, tipado, lint y build posterior correctos; doce regresiones focales incluyen el cambio de revisión del mismo chat durante un GET y evitan un toast de éxito de la consulta cancelada. Despliegue, recorrido autenticado, viewport y foco físico se verifican aparte. La revisión61 conserva draft/unregistered y approval:null; no resuelve persistencia de archivos tras un remount de autenticación.

## OCR conversacional y comparación de Productos: entrega acotada

La [función](features/invoice-ocr-product-comparison.md) está aprobada y publicada en [Server R03](../../../evidence/nodia-ai-invoice-ocr-server-adoption-20261026-r03.json). La [prueba real Codex Agentic](../../../evidence/nodia-ai-invoice-ocr-chat-acceptance-20261026-r01.json) comprueba lista/elección de proveedor, una extracción del PDF original sin readjuntar, comparación posterior sin otro OCR y continuidad tras reload. Mantiene cero/desconocido, hashes y autoridad; con Productos vacíos informa falta de coincidencia y no inventa variaciones. Las 40 tablas de dominio/esquema permanecen iguales, con cero propuestas, ejecuciones o efectos comerciales nuevos y sin pendientes. La corrección del plazo de subida conserva los adjuntos listos con el chat vigente, sin extender TTL en SQL. Antigravity/Gemini no tiene aceptación equivalente; su intento incierto fue conciliado/ACK sin replay. Web/API key quedan fuera de estas pruebas, y retirar Web se plantea para después. Guardado comercial, variaciones reales, otros MIME y AI36/AI38 conservan sus gates. [ADR-080 propuesto](../../../architecture/decisions/ADR-080-conversational-invoice-ocr-product-comparison.md) y C03 revisión3 mantienen sus estados propios; esta revisión65 del producto padre sigue draft/unregistered y approval:null.


## Referencias históricas del índice

El frontmatter mantiene las fuentes y comprobaciones vigentes dentro de los límites del contrato. Se conservan aquí los cortes previos: [entrega selectiva R06](../../../evidence/nodia-ai-ai40-r06-selective-delivery-r01.json), [cualificación MCP R06](../../../evidence/nodia-ai-ai40-r06-mcp-qualification-r01.json), [impacto inicial de retry de adjuntos](../../../evidence/nodia-ai-attachment-policy-retry-impact-r01.json) y [validación inicial AI-13](../../../evidence/nodia-ai-ai13-validation.json). Sus bytes y conclusiones históricas no se modifican ni se equiparan a la implementación nueva de OCR.

## Referencias históricas consolidadas

Fuera de los metadatos acotados; se conservan los enlaces y evidencias originales. No son comprobaciones nuevas de esta revisión.

- [nodia-ai-ai40-document-audio-validation-r01.json](../../../evidence/nodia-ai-ai40-document-audio-validation-r01.json)
- [nodia-ai-ai40-real-unknown-reconciliation-r01.json](../../../evidence/nodia-ai-ai40-real-unknown-reconciliation-r01.json)
- [nodia-ai-ai40-selective-fixes-validation-r01.json](../../../evidence/nodia-ai-ai40-selective-fixes-validation-r01.json)
- [nodia-ai-ai40-r06-finance-read-validation-r01.json](../../../evidence/nodia-ai-ai40-r06-finance-read-validation-r01.json)
- [nodia-ai-ai40-r06-business-read-validation-r01.json](../../../evidence/nodia-ai-ai40-r06-business-read-validation-r01.json)
- [nodia-ai-ai40-r06-native-images-r01.json](../../../evidence/nodia-ai-ai40-r06-native-images-r01.json)
- [nodia-ai-ai40-compaction-validation-r01.json](../../../evidence/nodia-ai-ai40-compaction-validation-r01.json)
- [nodia-ai-ai40-compaction-progress-fix-validation-r01.json](../../../evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json)
- [nodia-ai-ai40-r07-selective-delivery-r01.json](../../../evidence/nodia-ai-ai40-r07-selective-delivery-r01.json)
- [nodia-ai-ai40-r07-mcp-qualification-r01.json](../../../evidence/nodia-ai-ai40-r07-mcp-qualification-r01.json)
- [nodia-ai-ai40-r07-compaction-validation-r01.json](../../../evidence/nodia-ai-ai40-r07-compaction-validation-r01.json)
- [nodia-ai-ai40-r07-native-images-r01.json](../../../evidence/nodia-ai-ai40-r07-native-images-r01.json)
- [nodia-ai-ai40-r07-ui-image-validation-r01.json](../../../evidence/nodia-ai-ai40-r07-ui-image-validation-r01.json)
- [nodia-ai-ai40-common-tools-validation-r01.json](../../../evidence/nodia-ai-ai40-common-tools-validation-r01.json)
- [nodia-ai-ai40-contained-buttons-r01.json](../../../evidence/nodia-ai-ai40-contained-buttons-r01.json)
- [nodia-ai-ai11-ai12-final-regression.json](../../../evidence/nodia-ai-ai11-ai12-final-regression.json)
- [nodia-ai-ai11-ai12-live-validation.json](../../../evidence/nodia-ai-ai11-ai12-live-validation.json)
- [nodia-ai-ai40-remaining-validation-r01.json](../../../evidence/nodia-ai-ai40-remaining-validation-r01.json)
- [nodia-ai-ai40-data-variants-r01.json](../../../evidence/nodia-ai-ai40-data-variants-r01.json)

## Referencias adicionales

Se conserva esta evidencia en el cuerpo para respetar el límite de32 referencias del frontmatter. El índice continúa en revisión.

- [module-access-and-user-data-deployment-r01.json](../../../evidence/module-access-and-user-data-deployment-r01.json)


## Compositor y selección entre mensajes — revisión R08, 2026-10-29

[Plan93 R08](../../../mvp/93-nodia-ai-chat-composer-redesign.md) y [ficha candidata revisión10](features/chat-composer-selection.md): Markdown sólo en texto visible del asistente; usuario/adjuntos revisados/restringido permanecen literales. Tablas/código con scroll local y teclado, HTML no ejecutable, sin imágenes remotas y enlaces absolutos permitidos. Recarga44px a la derecha con Tooltip conserva handler/bloqueos y no inicia inferencia. Implementación local en cierre, QA integrada/visual y VM R08 pendientes en [el recibo](../../../evidence/nodia-ai-chat-markdown-20261029-r01.json).

R07 estático sigue adoptado según [su evidencia](../../../evidence/nodia-ai-voice-dictation-20261029-r01.json), con ASR positivo pendiente y elección explícita de dictado del navegador conservada. El permiso nativo localhost5174 se observó granted; el reset autorizado fue rechazado por la herramienta y no se aplicó ni confirmó, sin otro permiso modificado ni reconocimiento/captura nuevos en R08. [ADR086](../../../architecture/decisions/ADR-086-browser-dictation-and-authorized-audio-preview.md) sigue propuesto. Producto71 y ficha10 permanecen draft/unregistered/approval:null, sin publicación ni modificación de fichas aprobadas.

## Presentación de propuestas R38 — 2026-11-07

Client R38 está adoptado en la VM: cabecera compacta de propuesta con icono, estado, revisión y fechas; control outlined de 44 px y detalles técnicos plegables con identidad/hash/catálogo exactos. Antes/Después usa dos columnas desde un contenedor de 560 px y se apila por debajo; la ausencia ocupa menos espacio sin perder el valor presente ni confundir null, cero, false, strings o IDs. Confirmar/guardar es contained y editar/cerrar outlined. Se conserva el borrador visitado al plegar y se bloquea el plegado durante fetch de propuesta/revisión o incertidumbre humana. El estado de propuesta confirmada acredita admisión, no efecto aplicado; otros resultados de herramientas/ejecuciones conservan su presentación. Las cinco preparaciones históricas de ventas sólo reciben etiquetas de lectura, sin registro, preparación o ejecución nuevos.

Pasaron 218 regresiones en 4 archivos (los 9 casos del helper están incluidos), tipos/lint globales y build aislado de 1401 entradas/185 outputs. Los últimos ajustes sólo visuales posteriores a esa corrida se revisaron sin cambio de lógica; tipos/lint finales cubren los pins finales, sin afirmar otro rerun de las 218 pruebas. QA sintética ES/EN y claro/oscuro verificó comparación, borrador, teclado y valores; QA autenticada de una propuesta expirada verificó sólo lectura, hash completo y plegado. A 320 px, documento de 310 px, región de 212 px sin desbordamiento y control de 212×44 px. La operación estática hizo una activación/recarga Nginx, verificó 185 outputs y assets de 20 versiones anteriores, miss404 y API200/401; no reinició Server/Native ni emitió SQL o solicitudes de proveedor. Las lecturas autenticadas del navegador son un alcance separado. No hubo mensajes IA, confirmaciones o mutaciones comerciales en esa QA; pestaña/borrador originales intactos. [Manual visual](../../../features/nodia-ai/proposal-review-presentation.md) y [evidencia](../../../evidence/nodia-ai-proposal-ui-20261107-r01.json). Evaluación de impacto: no cambia conceptos de autoridad, operaciones disponibles, proyección exacta ni reglas de confirmación/recuperación. La ficha sigue draft/unregistered/approval:null; no habilita ventas históricas, herramientas o publicación.

## Interfaz, variantes y acceso — candidato local, 2026-11-12

[Funcionalidad candidata](../general-settings/features/ai-provider-interface-and-module-access.md): acciones contained, variantes Gemini con IDs reales y OCR independiente, API OpenAI xhigh/max (Ultra no admitido), contexto del actor e identidad exacta `nodia_ai`/`/nodia-ai`. Super_admin conserva el bypass; la caché de navegación no concede permisos ni promete revocación visual inmediata. Backend build/autorización60/HTTP74/API249 correctos; build/lint Client, ProviderDetail38/helper5 y QA visual correctos; suite global Client consolidada: 2812 casos/349 archivos, dos fixtures de Home corregidos y revalidados; ProviderDetail38 separado en [verificación consolidada](../../../mvp/ai-provider-feature-contract.md#verificación-consolidada-de-preferencias-y-acceso--2026-11-12). Producto revisión74 y candidata siguen draft/partial/unregistered/approval:null; fichas aprobadas intactas. Sin despliegue, inferencia o causa productiva del síntoma acreditados.
