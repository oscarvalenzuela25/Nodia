---
{
  "schema_version": 1,
  "document_id": "nodia-ai.context-execution",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 17,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "AI-40 incorpora Codex en el drawer, modelos/esfuerzos descubiertos y una aceptación MCP privada ligada a sesión/configuración/runtime exactos. API y Web OpenAI no se habilitan. La aceptación requiere gateway real, nonce, terminal y ACK; login y catálogo no la sustituyen. QA de código y build comprobada; la aceptación Linux operativa se registra por gate en documento86, sin extender formatos ni publicar capacidades nuevas."
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-22",
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
      "docs/evidence/nodia-ai-ai40-validation-r02.json"
    ],
    "notes": "AI-40: cuenta real y MCP Linux aceptados para la selección exacta; R03 adoptada, canario R06 con gateway/nonce/terminal/ACK y lecturas desde UI/worker normal. Confirmación humana de revisión exacta produce una ejecución/recibo/movimiento2 de importe1; relecturas y recarga no duplican efectos. Historial y selección conservados; compositor recupera automáticamente tras ACK con GET acotados. Server4651/252; Client1823/229 del candidato previo, delta final126 focales/build y UI comprobados por separado. Originales, familias restantes, recuperación real ampliada y entrega compilada permanecen pendientes. Draft/unregistered, approval null, sin nueva publicación; relojes host/VM desalineados y evidencia fechada por origen."
  },
  "approval": null
}
---

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
