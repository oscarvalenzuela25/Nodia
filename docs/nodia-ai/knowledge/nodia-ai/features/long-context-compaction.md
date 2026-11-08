---
{
  "schema_version": 1,
  "document_id": "nodia-ai.long-context-compaction",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 8,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "AI-34 y correcciones previas conservan su alcance histórico. R07 adopta progreso cero-RPC de compactación en contexto con el mismo ledger monotónico y fence, y reserva verificada; la cuenta real completa un snapshot literal1..6/citas7/687B y otro turno reutiliza ID/sourcehash sin compactar otra vez:2turnos/3dispatches/3ACKs con cierre físico y fixture retirado. Historia/Redis sintéticos y Create/Admit/RunStage compilados reales; no daemon/UI operativo sobre esa historia.265 focales/tipos producción/lint pasan; tipos globales fixtures fallan202. El defecto offline no demuestra código causal del unknown histórico. C40-09 añade ahora cancelación nativa, revocación del módulo y exclusión de cinco consumidores reales en fixtures; mantiene su aceptación acotada, sin UI Stop ni contención O_EXCL directa. Sin cambios a límites, permisos, aprobación o publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/80-nodia-ai-ai34-long-context-compaction.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/build-nodia-ai-compaction.use-case.ts",
      "kind": "implementation"
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-23",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai34-unit-validation.json",
      "docs/evidence/nodia-ai-ai34-sql-validation.json",
      "docs/evidence/nodia-ai-ai34-adapter-budgets.json",
      "docs/evidence/nodia-ai-ai34-ui-validation.json",
      "docs/evidence/nodia-ai-ai34-native-role-activation.json",
      "docs/evidence/nodia-ai-ai34-live-validation.json",
      "docs/evidence/nodia-ai-ai34-validation.json",
      "docs/evidence/nodia-ai-ai34-final-health.json",
      "docs/evidence/nodia-ai-ai36-c05-high-runtime-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-r01-compiled-delta.json",
      "docs/evidence/nodia-ai-ai40-selective-fixes-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r06-selective-delivery-r01.json",
      "docs/evidence/nodia-ai-ai40-r06-native-images-r01.json",
      "docs/evidence/nodia-ai-ai40-compaction-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-compaction-progress-fix-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-selective-delivery-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-mcp-qualification-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-compaction-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-native-images-r01.json",
      "docs/evidence/nodia-ai-ai40-r07-ui-image-validation-r01.json"
    ],
    "notes": "MCP, compactación y qualifiers MIME fijan su scope/conexión/modelo/esfuerzo observados. PNG UI/R2/worker suma binding exacto/epochs/SHA/tamaño, respuesta DOM exacta, ACK nativo independiente y recarga SQL/UI iguales:26/14/16/6/1/1/0pendientes. GET SDK sin status conserva null, no200 inventado. Bootstrap0/fixtures/QA no se presentan como aceptación operacional por sí solos.265 focales y tipos producción/lint correctos; chequeo global de tipos fixtures202 errores no verde. Cierre AI-40 parcial y consumidor Ajustes/indicador no aceptado; ninguna aprobación/publicación."
  },
  "approval": null
}
---

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

## Corrección candidata AI-40: formato por adaptador

El constructor común debe solicitar el formato que entrega `reply.text` después del transporte del adaptador observado y autorizado: Codex, objeto de resumen JSON directo como texto; Gemini, envelope `kind=answer` cuyo `text` contiene ese resumen. El parser conserva el schema extractivo estricto común, citas literales, cobertura de fuentes, memoria previa, límites y trazabilidad. No acepta indistintamente dos formas ni usa un fallback ante JSON inválido. La selección se hace desde la observación tipada exacta, no por modelo ni por contenido adivinado.

La corrección está en código candidato y tiene [QA focal comprobado](../../../../evidence/nodia-ai-ai40-selective-fixes-validation-r01.json):322 casos/5 archivos contando las regresiones independientes de selección, tipado y lint correctos. Estas pruebas no son aceptación operativa. R06 ya incorpora el port selectivo y tiene MCP propio, pero esta adopción y las pruebas Gemini históricas no acreditan compactación Codex real. Falta un turno normal con contexto largo, snapshot persistido/fingerprint, cierre/ACK y continuidad semántica, seguido de reutilización del snapshot sin compactar otra vez; no basta un canario que sustituya el handler de etapas. El nuevo [unknown conciliado](../../../../evidence/nodia-ai-ai40-real-unknown-reconciliation-r01.json) consumió cero compactaciones y no demuestra ni la causa de aquel fallo ni esta aceptación.

# Contexto largo y compactación

[Producto](../README.md) · [Entrega AI-34](../../../../mvp/80-nodia-ai-ai34-long-context-compaction.md).

## Continuidad

El chat conserva sus mensajes originales. Cuando el historial ocupa el presupuesto, el worker puede pedir al mismo proveedor, modo y modelo un resumen extractivo de hechos, decisiones, dudas, entidades y requisitos. Cada entrada es una cita literal vinculada a secuencias del historial; cada mensaje nuevo visible con texto debe estar representado. Esa cobertura no garantiza recordar exhaustivamente todos sus detalles. Se conserva el resumen previo validado; no se borra memoria anterior para aparentar continuidad. Cambiar conexión, modo o modelo entre turnos reutiliza el contexto canónico autorizado, sin reproducir efectos.

## Autoridad y operaciones

El resumen no concede permisos ni confirma escrituras. Propuestas y ejecuciones se recuperan mediante referencias actuales reautorizadas; el modelo debe consultar el estado real antes de afirmar resultados o proponer reanudar. Preferencias aceptadas se cargan por separado. Una revocación invalida el snapshot y reconstruye sólo historial visible.

## Límites y recuperación

Una compactación máxima por turno, compartiendo presupuesto de dispatches. Los originales permanecen consultables en Nodia, pero la selección del modelo no garantiza recordar cada detalle. Si resumen, mensaje actual, fichas, referencias y herramientas no caben, se informa un límite explícito y se pide acotar la solicitud o iniciar otro chat. No hay reintento automático, cambio silencioso de proveedor ni ventana de tokens inventada. El backend mide el prompt nativo inicial; el proveedor no informa su ventana interna de tokens.

## Conservación

Snapshots ligados al chat y eliminados con él, incluidos al expirar por 90 días desde el último mensaje del dueño. No memoria global adicional, embeddings ni sesiones opacas. Las preferencias aceptadas conservan su ciclo independiente.

## Corrección C05-R01: plazo de la compactación

La compactación debe recibir la misma fecha absoluta del primer armado durable que aplica el worker, conforme al [ADR-064 propuesto](../../../../architecture/decisions/ADR-064-nodia-ai-dispatch-deadline-boundary.md). Su preparación queda acotada antes del armado; el envío conserva como máximo120s y el tiempo restante del job/run. No construye otra ventana al llamar al adaptador, ni renueva la fecha mediante un segundo armado. Sigue consumiendo los presupuestos acumulados de la conversación y requiere cierre/ACK antes de cualquier continuación; unknown y cancelación impiden un nuevo envío.

Estado: corrección implementada y verificada por QA técnico, sin nueva aceptación real de compactación o causa demostrada de timeout upstream. Las pruebas AI-34 anteriores mantienen su alcance histórico. No se alteran conservación, formato extractivo, permisos, contratos o publicación; ficha draft/unregistered y approval null.


La [verificación técnica del compilado corregido](../../../../evidence/nodia-ai-ai36-c05-high-runtime-validation.json) registra4174 pruebas/232 archivos, tipos de producción correctos y192 errores históricos de fixtures sin nuevos errores. El [delta compilado](../../../../evidence/nodia-ai-ai36-c05-r01-compiled-delta.json) preserva971 assets salvo dos JavaScript del worker/coordinador; los74 contratos y el release publicado permanecen idénticos. Esto no acredita inferencia, latencia ni aceptación productiva.


Alcance de despliegue C05-R01: la corrección del deadline pertenece al código y compilado candidatos, probados en harness/SQL desechable. No se copiaron esos cambios a los932 outputs Node del servicio operativo. QA4174/232 y971 assets de la candidatura no significan adopción operativa o aceptación productiva.
