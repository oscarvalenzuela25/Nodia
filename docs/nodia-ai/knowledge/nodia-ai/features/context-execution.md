---
{
  "schema_version": 1,
  "document_id": "nodia-ai.context-execution",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 34,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI-40 completado técnicamente en la VM Linux local. R08/ClientR04, cuenta real Codex/MCP y matriz por alcance verificados. Las dos variantes finales están cerradas: categoría2 activa/elegible y factura1 de importe0 con PDF real en R2; la UI descarga1894bytes/SHA exactos. La actualización de la misma preferencia se confirma por botón humano, deja un recibo/revisión2 y pasa readback/contextos/recarga con la categoría nueva. Snapshot64mensajes/34runs/51dispatches, cero pendientes; finanzas/configuración/cuatro proofs/servicios conservados. Fixtures retenidos y marcados; respaldo cifrado previo,27 backups sin expirados y journal histórico confirmado. PDF/audio originales permanecen bloqueados para el scope observado; descarga PDF no acredita entrada al modelo. Windows/API/OpenAIWeb/producción, otras cuentas/selecciones y77 candidatos mantienen su alcance separado. AI-36/C05 y AI-38 conservan sus gates; sin aprobación documental ni publicación nuevas."
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
    },
    {
      "path": "docs/architecture/decisions/ADR-068-nodia-ai-pre-dispatch-observation-timeout.md",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai36-c05-r05-observation-timeout-source.diff",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-066-nodia-ai-mcp-manifest-depth-boundary.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-067-nodia-ai-pinned-cli-compatibility-experiment.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/85-nodia-ai-ai39-codex-runtime.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/ai-provider/use-case/codex-chat-tool-channel.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-rpc.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-runtime.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-journal.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/use-case/reconcile-codex-nodia-ai-runtime.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/86-nodia-ai-ai40-codex-acceptance.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-073-codex-mcp-acceptance-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-document-audio-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-real-unknown-reconciliation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-selective-fixes-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r06-selective-delivery-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r06-mcp-qualification-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r06-finance-read-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r06-business-read-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r06-native-images-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-compaction-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r07-selective-delivery-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r07-mcp-qualification-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r07-compaction-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r07-native-images-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-r07-ui-image-validation-r01.json",
      "kind": "evidence"
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
      "path": "docs/evidence/nodia-ai-ai40-common-tools-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-contained-buttons-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai36-c05-role-canary12-canary-report.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai36-c05-live-attempt12-native-diagnostics.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-remaining-validation-r01.json",
      "kind": "evidence"
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
      "path": "docs/architecture/decisions/ADR-077-gemini-chat-legacy-containment-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/ai-providers/gemini-chat-legacy-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-data-variants-r01.json",
      "kind": "evidence"
    }
  ],
  "verification": {
    "checked_on": "2026-10-24",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai36-c05-owned-mcp-agent-r02-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-owned-role-r02-rollback-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-node-observation-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-observation-timeout-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r02-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r03-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r04-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r05-closure-supplement.json",
      "docs/evidence/nodia-ai-ai39-native-protocol-r01.json",
      "docs/evidence/nodia-ai-ai39-experimental-protocol-r02.json",
      "docs/evidence/nodia-ai-ai39-native-initializer-r01.json",
      "docs/evidence/nodia-ai-ai39-channel-vitest-r01.json",
      "docs/evidence/nodia-ai-ai39-channel-process-r02.json",
      "docs/evidence/nodia-ai-ai39-c02-reconciliation-r01.json",
      "docs/evidence/nodia-ai-ai39-worker-runtime-r01.md",
      "docs/evidence/nodia-ai-ai39-worker-integration-r06.json",
      "docs/evidence/nodia-ai-ai39-journal-integration-r06.json",
      "docs/evidence/nodia-ai-ai39-protocol-integration-r06.json",
      "docs/evidence/nodia-ai-ai39-unit-qa-r03.json",
      "docs/evidence/nodia-ai-ai40-r06-business-read-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r06-finance-read-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-data-variants-r01.json",
      "docs/evidence/nodia-ai-ai40-compaction-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-selective-delivery-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-mcp-qualification-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-compaction-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-native-images-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-ui-image-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-common-tools-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-remaining-validation-r01.json"
    ],
    "notes": "AI-40 completado técnicamente en la VM Linux local. R08/ClientR04, cuenta real Codex/MCP y matriz por alcance verificados. Las dos variantes finales están cerradas: categoría2 activa/elegible y factura1 de importe0 con PDF real en R2; la UI descarga1894bytes/SHA exactos. La actualización de la misma preferencia se confirma por botón humano, deja un recibo/revisión2 y pasa readback/contextos/recarga con la categoría nueva. Snapshot64mensajes/34runs/51dispatches, cero pendientes; finanzas/configuración/cuatro proofs/servicios conservados. Fixtures retenidos y marcados; respaldo cifrado previo,27 backups sin expirados y journal histórico confirmado. PDF/audio originales permanecen bloqueados para el scope observado; descarga PDF no acredita entrada al modelo. Windows/API/OpenAIWeb/producción, otras cuentas/selecciones y77 candidatos mantienen su alcance separado. AI-36/C05 y AI-38 conservan sus gates; sin aprobación documental ni publicación nuevas. Verificación previa y límites históricos en86; no se declara verde el tipado global histórico de fixtures."
  },
  "approval": null
}
---

## Corte actual AI-40 — Lecturas y controles

AI-40 completado técnicamente en la VM Linux local. R08/ClientR04, cuenta real Codex/MCP y matriz por alcance verificados. Las dos variantes finales están cerradas: categoría2 activa/elegible y factura1 de importe0 con PDF real en R2; la UI descarga1894bytes/SHA exactos. La actualización de la misma preferencia se confirma por botón humano, deja un recibo/revisión2 y pasa readback/contextos/recarga con la categoría nueva. Snapshot64mensajes/34runs/51dispatches, cero pendientes; finanzas/configuración/cuatro proofs/servicios conservados. Fixtures retenidos y marcados; respaldo cifrado previo,27 backups sin expirados y journal histórico confirmado. PDF/audio originales permanecen bloqueados para el scope observado; descarga PDF no acredita entrada al modelo. Windows/API/OpenAIWeb/producción, otras cuentas/selecciones y77 candidatos mantienen su alcance separado. AI-36/C05 y AI-38 conservan sus gates; sin aprobación documental ni publicación nuevas.

[Evidencia y límites](../../../../evidence/nodia-ai-ai40-remaining-validation-r01.json).

## Corte sucesor — Helpers y preferencias aceptadas con Codex

La [aceptación real](../../../../evidence/nodia-ai-ai40-common-tools-validation-r01.json) distingue lectura, preparación y efecto humano: cuatro intenciones/ocho dispatches/18RPC, tres helpers propios y dos preparadores publicados. R01 caduca sin ejecución; R02 se confirma en la app sobre revisión/hash nuevos y crea dos preferencias propias mediante una sola ejecución/dos recibos. El conjunto tiene dos pasos independientes y bindings vacíos; los preparadores publicados no ofrecen una pareja tipada compatible para aceptar dependencia, aunque el coordinador sí la soporte. Readback y fingerprints reconstruidos de run/ambas etapas comprueban inclusión de memoria aceptada y recarga con dos tarjetas; no prueban cambio de proveedor con recuerdos no vacíos ni defaults financieros implícitos.

Final38mensajes/20runs/28dispatches/seis adjuntos/dos ejecuciones/tres recibos, dos recuerdos y cero pendientes. Finanzas, R07/config/proofs conservados. 116unidades existentes,17checks de recibos y11readback separados; schema publicado compuesto distinto del template. Reloj/refresh son observaciones sin causalidad exclusiva ni fix. AI-40 sigue parcial por agregados/relaciones, archivos, observaciones externas y variantes explícitas. Client5e30 fue la superficie; cambios visuales contained pertenecen a un sucesor aún por verificar. Sin aprobación/publicación ni cambio de45/registry; los cortes inferiores conservan sus hechos históricos.


## Verificación de recuperación con Codex real

La [aceptación de recuperación](../../../../evidence/nodia-ai-ai40-recovery-acceptance-r01.json) distingue cancelación, revocación y exclusión verificadas de la cancelación UI propuesta y O_EXCL directo no ensayado. El [histórico del harness](../../../../evidence/nodia-ai-ai40-recovery-harness-validation-r01.json) conserva sus fallos y conciliación sin replay. La [recalificación posterior](../../../../evidence/nodia-ai-ai40-post-recovery-images-r01.json) completa MCP y los tres MIME con generaciones nuevas y fixtures R07 reutilizados; no es otro recorrido UI/R2 ni restauración de proofs.


## Corte sucesor R07: compactación y PNG actuales

La [entrega R07](../../../../evidence/nodia-ai-ai40-r07-selective-delivery-r01.json) adopta dos fuentes de producción y seis outputs: progreso cero-RPC de compactación en contexto con el mismo ledger monotónico y fence, reserva verificada antes/después y rechazo de cualquier uso de herramientas. No amplía el gateway ordinario ni sus permisos. Los [265 casos focales y tipado de producción/lint](../../../../evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json) pasan; el chequeo global de tipos de fixtures falla con202 errores y no se presenta como verde. El defecto offline es reproducible, pero no demuestra el código causal no conservado en el [unknown real R06](../../../../evidence/nodia-ai-ai40-compaction-validation-r01.json).

El [MCP propio R07](../../../../evidence/nodia-ai-ai40-r07-mcp-qualification-r01.json) completa una generación/un callback y ACK exacto, con proof nuevo b6350cbf…7e60d para el scope observado. La [compactación real posterior](../../../../evidence/nodia-ai-ai40-r07-compaction-validation-r01.json) completa dos intenciones y tres dispatches(2+1): un snapshot con siete citas literales cubre secuencias1..6; el segundo turno reutiliza su ID/sourcehash sin otra compactación. Ambos resultados semánticos son exactos y los tres terminales completed tienen ACK, procesos ausentes, grupos cerrados y staging vacío antes de retirar el fixture. Son seis fuentes sintéticas y Redis sintético en PostgreSQL aislado, con Create/Admit/RunStage compilados reales y cuenta real; no el daemon/UI operativo ejecutando ese historial. C40-09 acepta sólo este subconjunto, no toda recuperación/autoridad.

Los [tres calificadores MIME nuevos](../../../../evidence/nodia-ai-ai40-r07-native-images-r01.json) verifican PNG/JPEG/WebP por separado con semántica, ACK y cleanup propios. El [PNG nuevo desde UI](../../../../evidence/nodia-ai-ai40-r07-ui-image-validation-r01.json) recorre Vite autenticado→R2→admisión/contexto→worker operativo R07: un upload/un envío/un dispatch y cero herramientas/RPC. Original de11233bytes con SHA exacto y sin interpretación textual; respuesta visual exacta, terminal/ACK, staging vacío y recarga preservada. HEAD confirma200 y GET real completa con SHA/tamaño; el status HTTP de GET no entregado por el SDK permanece null. No es una nueva prueba UI JPEG/WebP ni imagen+MCP en un turno R07.

El corte final conserva26 mensajes/14runs/16dispatches/seis adjuntos, una ejecución/recibo y el único movimiento2 histórico; cero pendientes y proof MCP preservado. El compositor vuelve a estar habilitado/vacío y el envío deshabilitado por texto vacío tras recarga; la ocupación transitoria desaparece automáticamente. No hay nuevo efecto de negocio, replay, login/configuración modificados, aprobación o publicación. Los positivos previos de Finanzas/Negocios y los negativos conservan sus alcances históricos.

Los [gates Linux y el límite administrativo](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#corte-sucesor-2026-10-23--r07-compactación-real-e-imagen-desde-la-ui) permanecen explícitos; no se aceptan todas las familias, recuperación, Client compilado, Windows o producción. Esta ficha sigue draft/unregistered y no publica capacidades. Los cortes inferiores son históricos.

## Corte sucesor 2026-10-23 — Compactación R06 incierta y disponibilidad invalidada

El [ensayo real de compactación R06](../../../../evidence/nodia-ai-ai40-compaction-validation-r01.json) termina en resultado incierto tras armar un único dispatch SQL. No consta una inferencia efectiva completada ni una respuesta; el transporte registra3frames/721bytes y0RPC. Su cierre físico, terminal/ACK y staging vacío se verifican sin reenviar la inferencia; el PostgreSQL desechable se retira tras la conciliación. No hay snapshot/continuidad aceptados y C40-09 permanece bloqueado. La causa está en investigación offline; no se atribuye a duración, tamaño, proveedor o a los fixes selectivos sin evidencia propia. El intento anterior R01 falló en el caller antes de despachar y se conserva por separado: cero generaciones nativas no equivalen al resultado R02.

El fallo invalida legítimamente los cuatro proofs del scope operativo: MCP/PNG/JPEG/WebP quedan actualmente sin verificar. Los [tres positivos nativos R06](../../../../evidence/nodia-ai-ai40-r06-native-images-r01.json) anteriores conservan sus semánticas exactas, terminales/ACK y staging vacío; son un corte histórico, sin disponibilidad actual ni aceptación nueva de UI/R2. Lo mismo aplica al canario MCP y a las lecturas UI representativas de Finanzas y Negocios anteriores. No se restauran/copian proofs, no hay fallback y no se inicia una recalificación mientras se investiga.

API/worker siguen en R06; configuración y SQL operativo permanecen en24 mensajes/13runs/15dispatches/cinco adjuntos, una ejecución/recibo/efecto histórico y cero pendientes. El recorrido PNG nuevo desde UI sólo quedó preparado: wrapper readonly R06 pinneado y bootstrap SQL sin perfil/proveedor/R2; ningún upload, envío o generación UI. Ese bootstrap no acredita originales ni recorrido funcional.

Los gates Linux priorizados están en [86](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#corte-sucesor-2026-10-23--compactación-r06-incierta-y-disponibilidad-invalidada). Esta ficha continúa draft/unregistered y no publica capacidades. Los cortes inferiores conservan sus alcances históricos.

## Corte sucesor: lista de Negocios y bloqueo de entorno en Reservas

La [lista de Negocios desde UI](../../../../evidence/nodia-ai-ai40-r06-business-read-validation-r01.json) recorre el worker normal con selección técnica, barrera de ACK y lectura publicada: dos dispatches/callbacks y ambos terminales/ACK propios. Bajo super_admin y módulo actuales, page1/limit1/activity all/all_businesses true devuelve un total que coincide con SQL antes/después. La respuesta UI y el único byte sellado son exactos; no se exponen nombres/precios en la evidencia.24 mensajes/13runs/15dispatches/cinco adjuntos, un efecto histórico y cero pendientes; MCP conservado.

La misma evidencia verifica la ruta publicada /tools/reservations sin módulo en el entorno operativo, aunque su tabla existe. El destino no está autorizado y el oráculo de alojamientos permanece null, sin ejecutar COUNT ni crear módulos/permisos/casas. Es bloqueo de configuración del entorno; no se declara inexistente la implementación de Reservas. El positivo acepta una lista representativa de Negocios y conserva el GET financiero previo, sin aceptar todas las operaciones/familias ni la compactación real. Los cortes inferiores conservan sus alcances históricos.

## Corte sucesor: R06 y lectura financiera propia

La [entrega R06](../../../../evidence/nodia-ai-ai40-r06-selective-delivery-r01.json) ensaya adopción/reversión/re-adopción sin inferencias ni efectos. Su [MCP propio](../../../../evidence/nodia-ai-ai40-r06-mcp-qualification-r01.json) completa un nonce real y ACK en el nuevo fingerprint, sin restaurar pruebas históricas. La [lectura financiera UI](../../../../evidence/nodia-ai-ai40-r06-finance-read-validation-r01.json) usa una intención nueva, selección técnica/barrera ACK/GET financiero, dos dispatches/dos callbacks y una respuesta final contrastada con SQL. Ambos ACK nativos, grupos cerrados y staging vacío;22 mensajes/12runs/13dispatches/cinco adjuntos y único efecto histórico conservados, cero pendientes. La recarga autenticada conserva run, counters, SHA de respuesta y fixture, con compositor habilitado y sin nuevo envío.

Es aceptación acotada de un GET financiero representativo y continuidad del marcador/gasto en Vite después de las transiciones. No acepta todo C40-06, compactación Codex, originales de imagen actuales, audio, Client compilado o Windows. Los fallos previos y sus recibos se conservan; no se atribuye causalidad retrospectiva a los fixes ni se repite el turno incierto. Los cortes inferiores son históricos.

## Corte AI-40: incertidumbre real y disponibilidad invalidada

La [conciliación real](../../../../evidence/nodia-ai-ai40-real-unknown-reconciliation-r01.json) sucede a los positivos históricos de imágenes/PDF de esta ficha. El único turno financiero nuevo sólo completa selección de capacidades y termina sin respuesta; no acredita lectura de Finanzas. Una única intervención administrativa reautoriza actor/sesión, verifica cierre nativo y ACK y elimina el pendiente sin reenviar la generación. SQL/FS confirman20 mensajes/11runs/11dispatches/cinco adjuntos, único efecto histórico2 intacto y cero pendientes. El TypeError del operador ocurrió al proyectar un job que cleanup ya había eliminado; no se repitió la acción.

MCP/PNG/JPEG/WebP quedan legítimamente invalidados en el scope operativo. Los recibos anteriores siguen siendo históricos; disponibilidad actual requiere reaceptación propia y no se recupera copiando proofs. R05 continúa activo; las correcciones de compactación por transporte y terminal sin texto de selección son candidatas sin adopción/aceptación real. PDF revisado conserva su positivo como texto; audio continúa sin proof. Los [fixes selectivos](../../../../evidence/nodia-ai-ai40-selective-fixes-validation-r01.json) pasan322 pruebas focales/5 archivos, tipado y lint; el candidato R06 cambia fingerprint y excluye WAV, sin aceptación operativa. La causa original de la inferencia sigue desconocida. C40-06 y las variantes restantes de C40-09/C40-11 permanecen parciales.

# Contexto autorizado y ejecuciÃ³n conversacional

Las secciones AI-09/AI-12 y los ensayos R01 siguientes conservan su corte histÃ³rico. El anexo C05 al final delimita la implementaciÃ³n candidata y el estado operativo actual; no transfiere pruebas entre entornos.

[Producto](../README.md). [Entrega58](../../../../mvp/58-nodia-ai-ai12-context-execution.md).

## QuÃ© resuelve

Enviar al modelo historia canÃ³nica y explicaciones de productos publicadas y autorizadas, sin copiar la BD o explorar el repositorio por turno. Ejemplo: Â«quÃ© datos necesita una reservaÂ» sÃ³lo puede respaldarse con una ficha publicada; su existencia como borrador no habilita conocimiento operativo.

## Operaciones y datos mÃ­nimos

La admisiÃ³n fija selecciÃ³n, configuraciÃ³n/sesiÃ³n observadas, release, mÃ³dulos y presupuesto. El builder utiliza historia hasta la secuencia admitida, excluye fuentes revocadas y registra referencias/hash/tamaÃ±o. SÃ³lo lee resÃºmenes e Ã­ndice permitidos de un bundle validado con pin de despliegue; los detalles se solicitan por IDs exactos mediante las lecturas tÃ©cnicas `nodia_knowledge_index` y `nodia_knowledge_get`. No explora docs en runtime. Exceso de contexto falla explÃ­citamente; compactaciÃ³n y adjuntos quedan para sus etapas.

## Reglas y autoridad

Conservar la intersecciÃ³n del grant original con permisos actuales: un mÃ³dulo reciÃ©n asignado puede entrar en un turno nuevo, nunca ampliar el anterior. Markdown no registra herramientas ni concede permisos. Corpus actual draft/unregistered y manifiesto vacÃ­o; el prompt informa esta ausencia y no inventa productos, cifras o capacidades.

## Modos y recuperaciÃ³n

Web sÃ³lo conversa. Agentic usa Ãºnicamente las dos lecturas tÃ©cnicas registradas; conserva herramientas de negocio cerradas hasta AI-14 y las familias correspondientes. El consentimiento revisionado del backend permite una delegaciÃ³n Webâ†’Agentic al destino exacto verificado de la misma conexiÃ³n, con su propio modelo/esfuerzo. La solicitud tipada de Web se revalida antes del dispatch; su perfil debe cerrar y liberarse antes de adquirir Agentic. El siguiente turno conserva Web como selecciÃ³n base. El switch visual pertenece a AI-13; API queda para despuÃ©s. No hay fallback por error ni confirmaciÃ³n de escrituras implÃ­cita.

El run comparte presupuesto entre etapas. Solicitudes de herramienta repetidas o rechazadas consumen presupuesto; la idempotencia evita repetir el efecto. El supervisor tambiÃ©n comunica los rechazos/replays MCP que no llegan al callback Server y sus deltas se reservan en PostgreSQL. Hooks nativos denegados no conceden herramientas ni permisos. Respuesta tipada vÃ¡lida se sella con prueba de cierre y acuse independiente; respuesta incierta queda bloqueada sin replay.

## Estado de integraciÃ³n

Draft/unregistered. Pipeline comprobado con PostgreSQL desechable y Gemini real en VM: worker Agentic/MCP tÃ©cnico, delegaciÃ³n consentida de dos dispatches en un run y siguiente turno Web. CancelaciÃ³n real y conciliaciÃ³n SQL no reenvÃ­an la generaciÃ³n. La evidencia corresponde a la selecciÃ³n y cuenta probadas; no acredita otros modelos o proveedores.

El corpus conserva43 borradores excluidos y cero documentos/fragmentos publicados; la consulta real del Ã­ndice devuelve esa ausencia. No hay informes de negocio disponibles por esta ficha. Publicar un producto requiere aprobaciÃ³n, binding/contrato y registro ejecutable compatible de AI-14; cambiar el release implica nuevo build/despliegue y compatibilidad de turnos vigentes. Interfaz, API, adjuntos/voz, compactaciÃ³n y aceptaciÃ³n productiva conservan sus etapas.


## ExtensiÃ³n planificada Codex: AI-39/40

Solicitud del usuario del 2026-10-18, incorporada al [plan](../../../../mvp/45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai). Las secciones de integraciÃ³n anteriores describen la entrega histÃ³rica AI-12; no acreditan el estado actual de todos los productos o de otros proveedores.

Codex serÃ¡ el modo AgÃ©ntico de una conexiÃ³n OpenAI ya existente, utilizando la misma conversaciÃ³n canÃ³nica de NodiaAI. Ejemplos de intenciÃ³n: Â«continÃºa este chat con CodexÂ», Â«consulta los productos de este proveedorÂ» o Â«prepara un gastoÂ». Exigen respectivamente una conexiÃ³n/modelo vÃ¡lidos seleccionados entre turnos, acceso al mÃ³dulo de destino y los mÃ­nimos del contrato nativo. Las peticiones de datos/efectos sÃ³lo podrÃ¡n usar herramientas publicadas y autorizadas; la ficha no las habilita.

AI-39 implementarÃ¡ selecciÃ³n de adaptador, ejecuciÃ³n supervisada, presupuesto de contexto/herramientas y conciliaciÃ³n por runtime. AI-40 incorporarÃ¡ selecciÃ³n/modelo/intensidad en el drawer y comprobarÃ¡ la cuenta real, MCP, continuidad entre proveedores, confirmaciÃ³n exacta y recuperaciÃ³n. Las lecturas y preparadores conservan los contratos comunes; filtros e informes no reciben capacidades nuevas por cambiar proveedor. Login y credenciales continÃºan en el canal seguro de la app, fuera del modelo.

El cambio Geminiâ†”Codex serÃ¡ explÃ­cito y entre turnos; conserva mensajes, decisiones, preferencias y recibos, sin trasladar cookies o estado privado del proveedor. Un cambio de agente no vuelve a ejecutar efectos ni concede permisos. Las escrituras exigen preview y botÃ³n sobre la propuesta exacta. Resultados inciertos requieren conciliaciÃ³n propia; nunca replay por timeout ni fallback de proveedor.

Estado: **planificado, draft/unregistered**. La sesiÃ³n/OCR Codex histÃ³rica se documenta en [su funcionalidad](../../../../features/ai-providers/openai-codex-agentic.md); chat, MCP y modalidades en NodiaAI siguen pendientes de implementaciÃ³n y verificaciÃ³n. Texto serÃ¡ el flujo inicial de aceptaciÃ³n; imÃ¡genes/PDF/voz se habilitarÃ¡n sÃ³lo al comprobar formato, modelo y conexiÃ³n. API key, OpenAI Web y soporte nativo Windows mantienen sus decisiones previas; no se asume compatibilidad de Gemini. No hay migraciÃ³n de tablas de conversaciÃ³n exigida por esta especificaciÃ³n ni nueva publicaciÃ³n.

## CorrecciÃ³n C05-R01: fecha de envÃ­o compartida

El [ADR-064 propuesto](../../../../architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md) corrige la diferencia entre el temporizador exterior del worker y el deadline construido para el adaptador. El coordinador debe utilizar la fecha absoluta devuelta por el primer armado durable exitoso, sin reconstruir120s desde otro instante. PreparaciÃ³n acotada y envÃ­o comparten el lÃ­mite global del job/run; las observaciones previas al armado no consumen la ventana propia del proveedor. Segundo armado, compactaciÃ³n o delegaciÃ³n no reinician contadores ni permiten continuar tras cancelaciÃ³n, pÃ©rdida de autoridad o incertidumbre.

El usuario prioriza ensayos con High y la selecciÃ³n exacta configurada/observada. Separar modelo base y razonamiento permanece pendiente de producto; no se deduce esa relaciÃ³n desde IDs ni se renombra el catÃ¡logo. Estado: correcciÃ³n local implementada y verificada por QA tÃ©cnico; aceptaciÃ³n real posterior pendiente. No cambia contratos MCP, permisos, publicaciÃ³n o aprobaciÃ³n de esta ficha draft/unregistered.


La [verificaciÃ³n tÃ©cnica del compilado corregido](../../../../evidence/nodia-ai-ai36-c05-high-runtime-validation.json) registra4174 pruebas/232 archivos, tipos de producciÃ³n correctos y192 errores histÃ³ricos de fixtures sin nuevos errores. El [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r01-compiled-delta.json) preserva971 assets salvo dos JavaScript del worker/coordinador; los74 contratos y el release publicado permanecen idÃ©nticos. Esto no acredita inferencia, latencia ni aceptaciÃ³n productiva.

## C05-R01: rol propio MCP y resultado del ensayo

El [ADR-065 propuesto](../../../../architecture/decisions/ADR-065-nodia-ai-owned-mcp-execution-role.md) define un agente MCP propio en el workspace temporal aislado. La revisiÃ³n r02 hereda el dispatcher mediante inheritMcp:true y declara finish como herramienta nativa; view_file sÃ³lo se aÃ±ade para adjuntos exactos autorizados. Recibe exclusivamente el servidor temporal nodia_runtime. Los hooks, el catÃ¡logo/grant de Server y los presupuestos siguen autorizando cada acciÃ³n; el documento del rol aporta bytes al contexto medido. La polÃ­tica nueva requiere acreditaciÃ³n propia y no hereda pruebas de la anterior.

La [primera revisiÃ³n](../../../../evidence/nodia-ai-ai36-c05-role-canary12-canary-report.json) llegÃ³ a un start nativo, pero terminÃ³ sin llamadas MCP con ERROR/unknown_tool. El [diagnÃ³stico12](../../../../evidence/nodia-ai-ai36-c05-live-attempt12-native-diagnostics.json) acredita identidad inicial del agente; no prueba un timeout. Su prueba abandoned_unknown y ACK cierran la limpieza sin verificar el rol ni una capacidad comercial. Esa evidencia y la imagen3f004 permanecen histÃ³ricas.

La [QA Windows r02](../../../../evidence/nodia-ai-ai36-c05-owned-mcp-agent-r02-validation.json) registra445 pruebas/443 correctas/dos omisiones histÃ³ricas. El [build04 y QA Linux](../../../../evidence/nodia-ai-ai36-c05-role-build-attempt04.json) comprueba430 pruebas aplicables sin omisiones, nueve dependencias idÃ©nticas y tres cambios de47 fuentes Python comparadas: dos del rol y el clasificador de diagnÃ³stico. Los15 mÃ©todos C03 de un mÃ³dulo ausente en la base se excluyen explÃ­citamente; no se presentan como comprobados en Linux. El primer build y el error de importaciÃ³n de la suite431 anterior se conservan por separado. El [metadato estÃ¡tico del CLI](../../../../evidence/nodia-ai-ai36-c05-static-mcp-agent-metadata.json) respalda el campo inheritMcp, sin demostrar su funcionamiento real.

El preflight13 de r02 no admitiÃ³ inferencia: la observaciÃ³n High fallÃ³ antes del wrapper, al igual que una segunda observaciÃ³n no generativa autorizada. Su compatibilidad real con MCP sigue sin comprobar; QA445 de r01/canario12 tampoco la acredita. No hay retry de una inferencia incierta, cambio de selecciÃ³n ni permiso adicional.

[Estado final y restauraciÃ³n](../../../../evidence/nodia-ai-ai36-c05-owned-role-r02-rollback-validation.json): ambas imÃ¡genes candidatas se retiraron y volviÃ³ la imagen exacta b110 original, con cuatro servicios activos y los932 outputs Node operativos intactos. Web aparece disponible en metadata; High aparece indisponible con agentic_unavailable y MCP no verificado. Esto no demuestra un problema de credenciales, cuota o proveedor, ni una inferencia Web nueva. El rol r02 se conserva como candidato local, sin adopciÃ³n operativa.

La [continuaciÃ³n C05-R01](../../../../evidence/nodia-ai-ai36-c05-r01-acceptance.md) mantiene3/7 capacidades verificadas en sus entornos respectivos: propuesta exacta de03 y dos lecturas de08; cuatro capacidades siguen pendientes. Las respuestas de08â€“11 pertenecen a su compilado y polÃ­tica originales y no se transfieren a r02. La correcciÃ³n Node del deadline sÃ³lo se verificÃ³ en el build candidato971 y SQL desechable; no se copiÃ³ al runtime operativo932. Esta ficha sigue draft/unregistered y approval null; su redacciÃ³n no publica herramientas o conocimientos adicionales.

## Anexo C05-R02â€“R05: compatibilidad y estado final observado

[R02](../../../../evidence/nodia-ai-ai36-c05-r02-validation.json) verificÃ³ `inheritMcp:true` mediante un canario nuevo con nonce/callback, terminal completado/cerrado y ACK exacto en su propia imagen y polÃ­tica. `nodia_workflows_prepare` completÃ³ ademÃ¡s el turno, la propuesta ordenada de dos pasos y cuatro aserciones semÃ¡nticas: sin efectos antes de confirmar; tras el HTTP explÃ­cito del operador de prueba, una preferencia y un gasto de1234 con dos recibos nativos e idempotencia. No acredita los preparadores usados previamente como fixtures nativos ni interacciÃ³n fÃ­sica de la UI.

| Corte | Starts MCP aceptados nuevos | Total acumulado | Capacidades representativas acumuladas |
|---|---:|---:|---:|
| R01 |16|16|3/7|
| R02 |6|22|4/7|
| R03 |4|26|4/7|
| R04 |2|28|4/7|
| R05 |1|29|4/7|

Estos starts son solicitudes nativas MCP aceptadas observadas; no miden tokens, facturaciÃ³n o peticiones/retries internos del CLI. Los originales permanecen inmutables y la [consolidaciÃ³n R05](../../../../evidence/nodia-ai-ai36-c05-r05-validation.json) aclara los campos de presupuesto heredados de R03/R04. Un resultado incierto conciliado y su ACK de limpieza no equivalen a un turno completado.

R03 corrigiÃ³ la envoltura cerrada del manifiesto a profundidad17, revalidando el catÃ¡logo desde su raÃ­z con16, sin ampliar profundidad de argumentos/RPC ni los demÃ¡s lÃ­mites. Los callbacks de preferencias completaron, pero faltÃ³ el terminal; no adquirieron aceptaciÃ³n. Ver [ADR-066 propuesto](../../../../architecture/decisions/ADR-066-nodia-ai-mcp-manifest-depth-boundary.md).

[R04](../../../../evidence/nodia-ai-ai36-c05-r04-validation.json) verificÃ³ el loop MCP de un binario1.4.2 exactamente identificado con su propio canario. El bridge normaliza objetos y JSON strings: el encoding original no se retuvo y permanece desconocido. La versiÃ³n no acredita adjuntos/OCR ni prueba la causa de timeouts previos. DespuÃ©s volviÃ³1.3.1; [ADR-067](../../../../architecture/decisions/ADR-067-nodia-ai-pinned-cli-compatibility-experiment.md) conserva estado propuesto.

R05 implementa como candidato la preservaciÃ³n de `agentic_timeout` y el retry durable selectivo previo al envÃ­o descrito en [polÃ­tica interna](runtime-policy.md). QA Node4208/4208, Python467/465+dos omisiones histÃ³ricas y452 pruebas Linux aplicables no sustituyen aceptaciÃ³n del proveedor;15 mÃ©todos C03 quedaron excluidos por mÃ³dulo ausente. Su canario real terminÃ³ `abandoned_unknown`, cerrado y con ACK exacto; Finanzas no se ejecutÃ³. El WARN anterior no se retuvo antes de restaurar el contenedor: fase, RPC, callbacks y causa siguen desconocidos, segÃºn el [suplemento de cierre](../../../../evidence/nodia-ai-ai36-c05-r05-closure-supplement.json).

Al cierre volviÃ³ la imagen exacta061/CLI1.3.1 con cuatro servicios activos, cero pendientes y chat R05 preservado. Node operativo conserva932 outputs; el compilado candidato2803/971 y sus74 capacidades no se desplegaron. La versiÃ³n/digest final describen la configuraciÃ³n de esa imagen baseline anclada histÃ³ricamente, sin mediciÃ³n fresca en el Ãºltimo snapshot. Web y Agentic High aparecen disponibles en metadata, con MCPfalse y modalidades vacÃ­as; no se transfieren proofs de contenedores anteriores. Tampoco se adoptaron los cambios candidatos de Python/Node del retry R05.

Las cuatro capacidades acumuladas corresponden a propuesta exacta de03, operaciones/adjuntos de08 y workflow de R02, cada una en su entorno. Siguen pendientes `nodia_finance_movements_prepare_create`, `nodia_preferences_prepare` y `nodia_preferences_list`. C05/AI-36 permanecen abiertos con77 candidatos sin publicar. Esta revisiÃ³n13 conserva draft/unregistered/approvalnull; la [evaluaciÃ³n de impacto](../../../../evidence/nodia-ai-ai36-c05-r05-knowledge-impact.json) verifica la preservaciÃ³n del bundle publicado.

Fuente Python del candidato: [agentic_service.py](../../../../../nodia-gemini-microservice/agentic_service.py); su diff/hash y QA se referencian desde docs para respetar el contrato cerrado de metadatos.

## Inicio AI-39: contrato por proveedor y recuperaciÃ³n propia

El usuario autoriza iniciar AI-39 despuÃ©s del diagnÃ³stico de AI-38. La [entrega85](../../../../mvp/85-nodia-ai-ai39-codex-runtime.md) identifica el alcance y sus gates; el [ADR-072 propuesto](../../../../architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md) separa los adaptadores Gemini y Codex conservando gateway, autoridad, propuestas, botÃ³n humano y recibos comunes. Es diseÃ±o propuesto, sin implementaciÃ³n de chat Codex acreditada en este corte.

Codex reutilizarÃ¡ la conexiÃ³n OpenAI y su modo `token_plan_agentic`, perfil privado/keyring y exclusiÃ³n con login, OCR y catÃ¡logo. La recuperaciÃ³n se dirige por la identidad del runtime persistida del intento; `agentic` por sÃ­ solo no distingue proveedores. Los descriptores Gemini histÃ³ricos siguen legibles; el contrato nuevo debe discriminar proveedor/recurso sin relajar los validadores previos. Un timeout conserva incertidumbre y no permite reenviar una generaciÃ³n.

El historial, conocimiento compilado, preferencias y compactaciÃ³n permanecen en Nodia. Un thread nativo es contexto de ejecuciÃ³n privado; no sustituye el chat ni justifica una tabla nueva sin necesidad comprobada. La ruta de herramientas del chat se habilita sÃ³lo tras verificar el protocolo del binario instalado; OCR conserva herramientas deshabilitadas y no recibe el handler del chat.

Ejemplo ilustrativo: una consulta de gastos en Codex debe usar la misma capacidad publicada y autoridad que Gemini; no obtiene acceso directo a SQL o archivos. Si el modelo, la sesiÃ³n o el soporte de herramientas no estÃ¡n comprobados, la app lo informa y conserva la selecciÃ³n sin cambiar de proveedor. Cambiar explÃ­citamente Geminiâ†”Codex desde el drawer, cuenta real, efectos visibles y formatos de imagen/PDF/voz corresponden a AI-40; no se acreditan por las pruebas Gemini de AI-38.

RevisiÃ³n14: impacto funcional identificado; no cambia fichas publicadas, schemas de dominio, permisos, catÃ¡logo ni configuraciÃ³n operativa. Se mantienen draft/unregistered y approval null. Las cifras/pruebas C05 de las secciones anteriores son histÃ³ricas; este inicio no las amplÃ­a ni cierra AI-36/38.

RevisiÃ³n15: [C01 nativo](../../../../evidence/nodia-ai-ai39-experimental-protocol-r02.json) comprueba schemas experimentales y admisiÃ³n de herramientas dinÃ¡micas en thread efÃ­mero con red/HOME aislados y cero inferencia. El [canal C03](../../../../mvp/85-nodia-ai-ai39-codex-runtime.md#primitiva-c03--canal-privado-de-herramientas-sin-integraciÃ³n-operativa) es opt-in exclusivo de un thread/turn y conserva OCR bloqueado;93pruebas locales y14checks Linux de JSONL/proceso con peer/gateway sintÃ©ticos verifican lÃ­mites, replay, lease y cancelaciÃ³n. El caller todavÃ­a debe conectar lease/fence/presupuesto/gateway durables, observar todos los frames y acreditar cierre/ACK/recuperaciÃ³n. No habilita herramientas nativas reales, UI ni modalidades Codex; implementation partial, draft/unregistered y approval null.

El [inicializador de producciÃ³n contra el binario aislado](../../../../evidence/nodia-ai-ai39-native-initializer-r01.json) comprueba ademÃ¡s cinco controles de initialize experimental, configuraciÃ³n efectiva, thread efÃ­mero y cierre, sin inferencia ni callback de herramienta. Es evidencia nativa de admisiÃ³n/polÃ­tica, separada del peer sintÃ©tico y de una cuenta operativa.

El [corte C02](../../../../evidence/nodia-ai-ai39-c02-reconciliation-r01.json) declara identidad Codex schema2 con proveedor/contrato/conexiÃ³n y conserva Gemini schema1. La prueba terminal compara identidad completa y el transporte Gemini rechaza Codex antes de consultar/ACK;179pruebas focales,4475globales y build final correctos. No se acredita integraciÃ³n SQL del descriptor, router ni generaciÃ³n Codex. `armDispatch`, journal/lease/fence y observaciÃ³n de todos los RPC, ejecuciÃ³n/cancelaciÃ³n/prueba terminal/ACK propios continÃºan pendientes; ningÃºn modo Codex se activa o despliega en este corte.


## ContinuaciÃ³n AI-39: adaptador y ejecuciÃ³n durable

RevisiÃ³n16: el [adaptador, worker y journal](../../../../evidence/nodia-ai-ai39-worker-runtime-r01.md) estÃ¡n integrados en el cÃ³digo backend. El envÃ­o guarda identidad Codex exacta antes de comenzar; las herramientas atraviesan el gateway existente, con permisos y confirmaciÃ³n humana independientes del agente. CancelaciÃ³n y recuperaciÃ³n utilizan la prueba del proceso propio y no repiten una generaciÃ³n incierta. El perfil se comparte con login/OCR y se cede al acabar las observaciones pÃºblicas.

La purga sÃ³lo retira terminales con ACK despuÃ©s de su deadline original; desconocidos y no acusados se conservan. Si falta el journal, no se supone que el proceso cerrÃ³. La retenciÃ³n del chat y la auditorÃ­a de negocio siguen sus contratos comunes. Las pruebas nuevas usan un peer sintÃ©tico: producciÃ³n conserva MCP sin acreditar y formatos vacÃ­os hasta AI-40. La [validaciÃ³n sucesora](../../../../evidence/nodia-ai-ai39-worker-validation-r01.json) separa evidencia actual e histÃ³rica.

Impacto: se renuevan cuatro hashes de implementaciÃ³n del supervisor dentro de capacidades ya publicadas, sin alterar scopes, schemas o permisos. Esto cambia el bundle local de conocimiento; no amplÃ­a sus 74 capacidades ni despliega el nuevo release. Esta ficha continÃºa excluida del bundle, draft/unregistered y approval null.


## AI-40: selección Codex y aceptación por ejecución

La [matriz86](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md) separa implementación y pruebas de código de la cuenta, MCP y UI reales. El drawer permite elegir explícitamente una conexión OpenAI/Agentic y conserva el chat al cambiar entre proveedores. Modelos e intensidades proceden del catálogo descubierto; un valor histórico incompatible se presenta para su corrección, sin fallback. La gestión de cuenta abre el canal seguro existente sólo con permiso y no entrega credenciales al modelo. La delegación automática Web→Agentic permanece dentro de Gemini.

El [ADR-073 propuesto](../../../../architecture/decisions/ADR-073-codex-mcp-acceptance-scope.md) describe el recibo técnico privado acotado, sin otra tabla: una llamada autorizada por el gateway, nonce, terminal propio y ACK deben acreditarse antes de declarar MCP disponible para esa selección exacta. Se invalida frente a cambios de sesión/configuración/binario o incertidumbre; no concede permisos ni confirma escrituras. No contiene mensajes, argumentos, resultados o credenciales. Adjuntos originales conservan su bloqueo por formato hasta aceptación propia.

Impacto de contexto: explica la selección y sus límites, sin nuevas operaciones o contratos de negocio. La ficha continúa draft/unregistered; el catálogo y las 77 candidatas conservan su estado. Los controles, adopciones y límites reales se mantienen en86 y sus evidencias, sin trasladar positivos históricos a otra ejecución.


## Aceptación acotada AI-40 en Linux

La [entrega86](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md) y la [validación final](../../../../evidence/nodia-ai-ai40-validation-r02.json) distinguen la implementación de sus pruebas reales. Codex se selecciona explícitamente en el drawer, utilizando la cuenta y catálogo de su conexión. El índice y las lecturas de dominio siguen filtrados por autoridad y publicación vigentes; un índice técnico positivo no acredita todas las familias.

Un gasto pendiente propio de prueba pasó por preparación MCP, revisión/hash y botón humano hasta un solo movimiento visible en Finanzas. Sus recibos se conservaron al reconsultar, volver y recargar. La disponibilidad posterior al turno conserva el orden SQL→ACK y sólo reconsulta GET mientras el motivo exacto sea ocupado, con tres esperas propias de UI (1,5,15 segundos); no reinicia inferencias ni efectos. La suma de21 segundos no es una garantía de duración ni una capacidad del proveedor.

Modelos e intensidades se resuelven desde configuración/descubrimiento. Login y credenciales permanecen fuera del modelo; un snapshot vencido se muestra sin verificar. OpenAI Web/API, formatos nativos sin prueba propia y delegación entre proveedores no se habilitan. El borrador se conserva entre selecciones; su persistencia tras recarga/remount no está aceptada. Tampoco se extrapolan cancelación, revocación, compactación, Windows o producción. El contexto aprobado y las74 capacidades/31fragmentos conservan su registro.

## Continuación de implementación C40-08/C40-10

La continuidad del texto sin enviar se documenta en [organización](conversation-organization.md). El adaptador Codex incorpora [imágenes candidatas por MIME](codex-image-inputs.md), staging privado por intento y acreditación técnica exacta posterior a terminal/ACK. La admisión y el pipeline conservan las barreras comunes; medir referencias no concede autorización sobre el archivo. PDF/audio permanecen bloqueados en este adaptador. El runtime de la VM R03 y su aceptación histórica no se sustituyen por estos cambios de fuentes; la nueva frontera requiere su propia aceptación antes de habilitar originales.

Antecedentes históricos conservados fuera del índice acotado de verificación actual: [evidencia](../../../../evidence/nodia-ai-ai11-ai12-final-regression.json).


### Continuación verificada: borrador y formatos nativos

La [aceptación de navegador](../../../../evidence/nodia-ai-ai40-draft-browser-r01.json) verifica recuperación exacta de texto sin enviar tras recarga/remount, cancelación del drawer y aislamiento frente a otro chat, sin enviarlo. La restauración exige un GET posterior al montaje, cambio de actor/sesión/chat o reanudación; caché o lecturas canceladas no acreditan acceso. Un fallo transitorio preserva texto ya autorizado en la misma época, bloqueando acciones; una denegación lo retira.

Los [tres probes de imágenes](../../../../evidence/nodia-ai-ai40-native-images-r01.json) aceptan PNG/JPEG/WebP por semántica/terminal/ACK en un candidato aislado con la cuenta real. Esto no adopta el paquete en R03 ni acepta imagen desde UI/R2/admisión/worker o MCP combinado; PDF/audio siguen pendientes. La [entrega86](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md#aceptación-2026-10-23--borrador-en-navegador-e-imágenes-codex-reales) conserva scope y gates, sin aprobación o publicación nuevas.

### Adopción R04 y recorrido de imágenes desde la UI

La [entrega R04](../../../../evidence/nodia-ai-ai40-r04-image-delivery-r01.json) adopta el transporte en la VM Linux local conservando cuenta/configuración, esquema y journal. La [verificación UI→R2→worker](../../../../evidence/nodia-ai-ai40-ui-image-flow-r01.json) acredita un PNG sintético: bytes y SHA exactos, original sin interpretación textual, lectura semántica de sus píxeles, un dispatch y terminal/ACK con staging limpio. El positivo no acredita herramientas MCP en ese turno.

El JPEG queda íntegro y vinculado en R2, pero el worker termina antes del dispatch con NodiaAiAdapterError; no hay inferencia nativa ni ACK que verificar. La coincidencia temporal con una consulta de capacidades es compatible con contención del perfil, sin causalidad demostrada. Se prepara un reintento durable acotado sólo para runtime_busy/not_dispatched durante observe; jamás se reintenta una inferencia enviada o incierta. WebP desde UI, imagen+MCP, PDF/audio y los gates generales conservan sus pendientes. La ficha sigue draft/unregistered.

### Recorrido completo y sucesor R05

La [entrega R05](../../../../evidence/nodia-ai-ai40-r05-predispatch-delivery-r01.json) conserva la identidad técnica del transporte:11fronteras JavaScript, binario, Node/V8 y política exactos, corroborados por la observación real posterior. Se adopta una corrección de coordinación previa al dispatch: sólo la observación con runtime_busy/not_dispatched de clase real usa el retry durable existente y acotado; ejecución, resultados inciertos, cancelación y medición mantienen sus barreras.

La [aceptación UI/R2/worker](../../../../evidence/nodia-ai-ai40-ui-image-flow-r01.json) completa PNG en R04 y JPEG/WebP en R05 con códigos exclusivos de los píxeles, originales sin interpretación textual, SHA/tamaño R2 exactos y terminal/ACK/staging limpio. JPEG completa también nodia_knowledge_index con1callback/1RPC y procedencia de22items/cuatro dominios contrastada con el recibo; no acredita todas las herramientas de los productos. Los tres turnos positivos tienen un dispatch cada uno, sin retries.

Recargar conserva respuestas y17mensajes/9runs/9dispatches/4adjuntos; una ejecución/recibo y movimiento2 históricos permanecen únicos y no hay pendientes. El primer JPEG fallido sigue registrado con0dispatches: no se reetiqueta como error del proveedor ni se demuestra su causalidad. Las pruebas atómicas sí verifican la nueva clasificación del perfil ocupado. Se conservan los gates independientes de PDF/audio, otras familias, recuperación real, Client compilado/reversión y Windows; AI-40 sigue parcial.

## Continuación AI-40: PDF como texto revisado y WAV sin aceptación

La [ficha de audio Codex](codex-audio-inputs.md) conserva draft/unregistered. El [consolidado documental](../../../../evidence/nodia-ai-ai40-document-audio-validation-r01.json) separa tres resultados: PDF raw rechazado por el decoder instalado; PDF extraído y aceptado por el dueño que completa como texto desde UI/R2/worker R05; y dos canarios WAV PCM16 distintos sin aceptación semántica ni proof de audio. No se incorpora renderizado, OCR, transcode o cambio de proveedor/modo.

El PDF revisado usa un dispatch y cero herramientas, respuesta exacta, R2/SHA y ACK propios. La recuperación de una observación runtime_busy anterior ocurre antes de despachar y no repite inferencia. SQL conserva19 mensajes/10 runs/10 dispatches/cinco adjuntos y una ejecución/recibo/efecto financiero histórico movimiento2, sin pendientes. El original PDF no forma parte del payload nativo enviado.

El candidato audio tiene352 pruebas focales y6 del wrapper observacional; ambos canarios cierran proceso/grupo, terminal y ACK con staging vacío. En el segundo, una única llamada nativa devuelve un rechazo explícito de53 bytes/ocho palabras, oráculo no coincidente y audio_probe_unverified; el diagnóstico no acredita causa ASR ni incompatibilidad global. No existe aceptación WAV y no se adopta el candidato. La [evidencia del operador](../../../../evidence/nodia-ai-ai40-audio-native-probes-r01.json) conserva ambos negativos sin reescribirlos como éxitos.

R05 y sus proofs MCP/imagen previos mantienen sus bytes. Los positivos históricos de [imágenes UI](../../../../evidence/nodia-ai-ai40-ui-image-flow-r01.json) conservan su alcance propio y no prestan aceptación al audio candidato. Se mantienen31 fragmentos/74 capacidades, ninguna aprobación o herramienta nueva y AI-40 parcial.

La [captura PDF revisado](../../../../evidence/nodia-ai-ai40-pdf-reviewed-text-ui-r01.jpg) y la inspección final del consolidado verifican recarga autenticada: respuesta exacta persistida, compositor habilitado y borrador vacío. Se conservan19 mensajes/10 runs/10 dispatches/cinco adjuntos, el único efecto histórico y cero pendientes, sin reenviar ni confirmar nada.

Antecedentes históricos conservados fuera del índice acotado actual: [nodia-ai-ai12-routing-postgres-integration](../../../../evidence/nodia-ai-ai12-routing-postgres-integration.json), [nodia-ai-ai12-postgres-integration](../../../../evidence/nodia-ai-ai12-postgres-integration.json).

Antecedentes históricos conservados fuera del índice acotado actual: [nodia-ai-ai11-ai12-live-validation](../../../../evidence/nodia-ai-ai11-ai12-live-validation.json), [nodia-ai-ai11-ai12-live-routing](../../../../evidence/nodia-ai-ai11-ai12-live-routing.json), [nodia-ai-ai36-c05-high-runtime-validation](../../../../evidence/nodia-ai-ai36-c05-high-runtime-validation.json), [nodia-ai-ai36-c05-r01-compiled-delta](../../../../evidence/nodia-ai-ai36-c05-r01-compiled-delta.json), [nodia-ai-ai36-c05-owned-mcp-agent-validation](../../../../evidence/nodia-ai-ai36-c05-owned-mcp-agent-validation.json), [nodia-ai-ai36-c05-role-candidate-qa03](../../../../evidence/nodia-ai-ai36-c05-role-candidate-qa03.json).


## Continuación AI-40: Core representativo y autoridad de Reservas

La [verificación Core/Reservas](../../../../evidence/nodia-ai-ai40-core-reservations-validation-r01.json) distingue una lista Core real por UI/worker y dos ACK de un diagnóstico de instalación sin inferencia de Reservas. `nodia_modules_list` devuelve un registro de página y total8, contrastado con SQL; no se acepta toda Core. La ausencia del módulo `/tools/reservations` oculta sus herramientas y devuelve403 aunque existan tablas/contratos. Total de alojamientos null/sin COUNT, sin seed ni ampliación de permisos. Super_admin omite asignación, no existencia/actividad del destino. La instalación explícita y la aceptación de Reservas son pasos separados. R07/publicación conservados; AI-40 parcial.


## Continuación AI-40: Reservas instalado y listado autorizado

La [aceptación de instalación/lectura](../../../../evidence/nodia-ai-ai40-reservations-install-validation-r01.json) verifica el módulo9 activo de la VM, seed compilado real ejecutado una vez y navegación/asignaciones previas conservadas. La existencia del módulo permite que Authorize/discovery actuales presenten sus21 herramientas; no sustituye permisos por casa ni confirma operaciones. Una lista desde UI/worker Codex devuelve0 alojamientos frente a SQL, con dos dispatches/callbacks, terminales/ACK y cierre físico. No se crearon casas/reservas/pagos para obtener un positivo. Borrador e historial sobreviven al mantenimiento y la recarga. El fallo inmediato del observador START queda separado de la verificación posterior del estado real, sin repetirlo. Instalación operativa y una lectura vacía representativa: no es un cambio de contratos/herramientas/publicación ni aceptación de todas las variantes. R07/proofs vigentes conservados; AI-40 sigue parcial.


## Continuación AI-40: Client compilado y continuidad autenticada

La [aceptación nginx/UI](../../../../evidence/nodia-ai-ai40-compiled-client-nginx-validation-r01.json) verifica los assets de producción y el mismo chat autenticado en origen5174 por SSH/nginx, sin depender de Vite. Historial, selección y borrador sin enviar se conservan tras cancelar el drawer, salir/volver y recargar; GET frescos y oráculo SQL idéntico respaldan la continuidad. No se envía un turno, aplica configuración o crea un efecto. Es aceptación de entrega/continuidad, no nueva inferencia o modalidad del proveedor. R07/publicación intactos; AI-40 conserva sus demás gates y la reversión nginx sólo preparada.


## Corte AI-40 — Reversión del Client y cierre delimitado

Reversión Client A→descriptor404→A verificada, un reload por fase,172 assets y API/SHA conservados. Misma pestaña autentica y restaura historial/selección/borrador tras GET fresco; ES/EN/ES y Cancelar sin Aplicar comprobados, borrador retirado sin enviar. Oráculo propio byteidéntico30/16/20/seis adjuntos/un efecto histórico, cero generaciones/confirmaciones/efectos nuevos o pendientes; R07/proofs/PIDs/época actual conservados. Matriz11gates reconciliada e inventario74 contrastado con runtime: cuatro bloques restantes por mecanismo (preferencias/workflows, agregados/filtros, archivos, observaciones IA), más móvil/continuidad de preferencias reales. AI-40 parcial; Windows/API/producción y77candidatos separados, sin aprobación/publicación/checklist nuevos.

Fuentes: [reversión y continuidad](../../../../evidence/nodia-ai-ai40-client-roundtrip-validation-r01.json), [cobertura por mecanismo](../../../../evidence/nodia-ai-ai40-published-family-coverage-r01.json). Son hechos de aceptación y límites documentados, no contratos ni permisos nuevos.

## Evaluación de impacto visual — Botones contained

Ajuste visual solicitado el2026-10-24: [botones contained verificados](../../../../evidence/nodia-ai-ai40-contained-buttons-r01.json).84 botones text/predeterminados pasan a contained en21 TSX de NodiaAI; seis outlined e IconButton conservados.98 regresiones atómicas existentes, lint/tipos y dos builds reproducibles correctos. Client65c1… adoptado con172 archivos HTTP/SHA/MIME; recarga autenticada conserva chat, selección y dos preferencias. Preferencias/drawer/adjuntos observados en1045×892, oscuro/ES, controles44px y sin scroll horizontal del documento; no prueba móvil ni todos los estados Alert. Sólo presentación: no cambia contexto funcional, contratos, permisos, herramientas ni confirmación. Operador sin SDK/escrituras SQL; no mensajes, confirmaciones o efectos de negocio nuevos desde UI. Backend/configuración/proofs/finanzas conservados; la renovación normal de sesión no se confunde con identidad física de toda la BD. AI-40 sigue parcial.
