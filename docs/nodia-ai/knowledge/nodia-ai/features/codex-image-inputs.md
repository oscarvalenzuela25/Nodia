---
{
  "schema_version": 1,
  "document_id": "nodia-ai.codex-image-inputs",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 6,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "R07 activo: tras cancelación/revocación que invalidaron el scope, MCP nuevo y PNG/JPEG/WebP recalificados con generaciones propias, semántica exacta, ACK/cierre y staging vacío. Los fixtures sintéticos R07 se reutilizan, sin reenviar intentos consumidos ni restaurar proofs. Es calificación nativa por MIME, no nueva UI/R2: el PNG UI→R2→worker→recarga previo conserva su alcance histórico. SQL26/14/16/6 y único efecto operativo intactos, cero pendientes. Dos fallos JPEG previos al intent fueron no generativos y su causa concreta no está demostrada; sucesor sólo reintenta journal status, no inferencias. PDF original/audio no se habilitan por analogía. Draft/unregistered, sin aprobación/publicación."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/86-nodia-ai-ai40-codex-acceptance.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-images.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-image-acceptance.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-runtime/types/nodia-ai-failure-diagnostic.ts",
      "kind": "implementation"
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
    }
  ],
  "verification": {
    "checked_on": "2026-10-23",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai40-implementation-r03.json",
      "docs/evidence/nodia-ai-ai40-draft-browser-r01.json",
      "docs/evidence/nodia-ai-ai40-native-images-r01.json",
      "docs/evidence/nodia-ai-ai40-r05-predispatch-delivery-r01.json",
      "docs/evidence/nodia-ai-ai40-ui-image-flow-r01.json",
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

# Imágenes del chat Codex por formato verificado

[Producto](../README.md) · [Contexto y ejecución](context-execution.md) · [AI-40](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md).

## Qué resuelve y solicitudes

Preparar el transporte de una imagen aportada al chat, por ejemplo «lee el código de esta imagen», conservando la selección exacta OpenAI/Agentic y los permisos comunes de NodiaAI. PNG, JPEG y WebP son candidatos independientes. La existencia del transporte, el login o el catálogo no implica que una cuenta/modelo haya completado ese formato. Esta ficha no agrega herramientas MCP, permisos o endpoints públicos.

## Datos y límites

Sólo el worker obtiene de almacenamiento el archivo autorizado. Antes del envío se verifican SHA256, base64 canónico, firma/MIME, dimensiones y límites de Nodia:20MiB por archivo,40MiB por mensaje, cuatro archivos y12MP por imagen. Los paths se generan por Server dentro de un perfil privado y se ligan al intento; nunca se aceptan paths, URLs o storage keys del modelo como entrada nativa.

El contexto mide una cota de referencias localImage sin insertar binarios en el prompt ni aumentar sus techos. Los tokens de visión siguen desconocidos. Shell, herramientas nativas y red no se habilitan. El MIME efectivo se revalida al leer el archivo y antes del dispatch; la medición previa no autoriza un formato.

## Autoridad, confirmación y recuperación

Tener permiso para ver el archivo y el módulo sigue siendo necesario. Los bytes se consideran datos no confiables; no autorizan cambios. Toda escritura de negocio conserva vista previa/revisión/hash y botón humano.

Staging privado por intento, con ownership y permisos del proceso. Retirar sus archivos requiere probar el cierre del grupo nativo correspondiente; un resultado incierto se concilia con la identidad persistida, sin replay o borrado por antigüedad. La recuperación deriva la ruta del intento y no elimina archivos de otros intentos.

## Aceptación e integración

Un diagnóstico privado del operador debe comprobar un nonce semántico contenido sólo en la imagen, respuesta exacta, terminal completado y ACK propio. Su prueba se liga al MIME, conexión, sesión/configuración, modelo/esfuerzo y fingerprint ejecutados. Acreditar PNG no habilita JPEG/WebP; salud y MCP no sustituyen esta prueba. Cambiar la frontera invalida una aceptación anterior.

Sin prueba vigente, el original queda bloqueado. PDF y audio continúan bloqueados para Codex; no se sustituyen por OCR, texto inventado ni otra modalidad/proveedor. Puede utilizarse el flujo común de texto revisado cuando corresponda, sin presentarlo como lectura nativa del archivo.

La [ficha aprobada de adjuntos](attachments-and-voice.md) conserva su contenido/fragmento publicado. Esta extensión permanece draft/unregistered y no cambia dicha aprobación. [ADR-075](../../../../architecture/decisions/ADR-075-codex-private-image-inputs.md) registra alternativas y ownership. La aceptación real del proveedor, el navegador y la adopción del paquete continúan independientes de sus pruebas aisladas.


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
