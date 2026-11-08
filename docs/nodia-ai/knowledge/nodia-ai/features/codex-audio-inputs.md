---
{
  "schema_version": 1,
  "document_id": "nodia-ai.codex-audio-inputs",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Imágenes PNG/JPEG/WebP R04/R05 conservan su aceptación acotada. PDF extraído y revisado completa UI/R2/worker en R05 como texto, sin original PDF; PDF raw rechazado por el decoder del CLI instalado. Candidato WAV PCM16 implementado y compilado,352 pruebas focales y6 atómicas del observador; dos grabaciones reales distintas terminan nativamente con ACK/cierre/limpieza, sin aceptación semántica ni proof WAV. R02 observa rechazo explícito, sin atribuir causa ASR o incompatibilidad global. No se adopta el candidato; R05 y sus proofs previos conservados. AI-40 parcial."
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
      "path": "docs/mvp/78-nodia-ai-ai32-attachments-voice.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-audio.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-audio-acceptance.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-media-storage.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-chat-runtime.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/prepare-nodia-ai-admission.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-document-audio-protocol-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-wav-admission-qa-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-document-audio-validation-r01.json",
      "kind": "evidence"
    },
    {
      "path": "docs/evidence/nodia-ai-ai40-audio-native-probes-r01.json",
      "kind": "evidence"
    }
  ],
  "verification": {
    "checked_on": "2026-10-23",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai40-document-audio-protocol-r01.json",
      "docs/evidence/nodia-ai-ai40-wav-admission-qa-r01.json",
      "docs/evidence/nodia-ai-ai40-document-audio-validation-r01.json",
      "docs/evidence/nodia-ai-ai40-audio-native-probes-r01.json"
    ],
    "notes": "Consolidado documental separa protocolo offline, PDF texto revisado positivo y dos canarios WAV negativos. PDF: un dispatch, cero herramientas, código exacto, R2/SHA y ACK,19 mensajes/10 runs/10 dispatches/5 adjuntos y único movimiento2 histórico; un intento previo runtime_busy sin dispatch se recupera sin replay. WAV: dos generaciones nuevas, una por grabación, cero herramientas, terminal/ACK y staging limpio, ningún proof de audio.352 pruebas focales y6 del observador no equivalen a aceptación real. Candidato sin adopción; R05/configuración/cuenta/proofs preservados. Sin nueva aprobación/publicación."
  },
  "approval": null
}
---

# Audio original del chat Codex por formato verificado

[Producto](../README.md) · [Adjuntos y voz](attachments-and-voice.md) · [Imágenes Codex](codex-image-inputs.md) · [AI-40](../../../../mvp/86-nodia-ai-ai40-codex-acceptance.md).

## Qué resuelve y qué significa

Preparar el envío de un WAV original autorizado al chat Codex sin inventar su transcripción ni abrir herramientas nativas, shell, red o archivos arbitrarios al modelo. El candidato usa una referencia interna `localAudio` a bytes materializados por Server. El protocolo instalado admite esa variante, pero no garantiza un MIME, duración, calidad de transcripción o disponibilidad de la cuenta.

Sólo es candidato `audio/wav` RIFF PCM16 mono o estéreo con estructura validada. No se transforma el audio ni se prueba soporte por extensión, categoría, nombre del modelo, OCR, MCP o una modalidad aceptada por Gemini. La disponibilidad permanece bloqueada hasta contar con una aceptación propia del formato en el scope exacto y una observación vigente.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes o ambigüedad | Aclaración esperada |
|---|---|---|---|
| «Transcribe este WAV» | Leer el audio original del turno | Formato o selección sin aceptar | Ofrecer texto revisado o informar la modalidad pendiente; no generar una transcripción supuesta |
| «Registra el gasto que menciono» | Interpretar datos y preparar un cambio | Importe, moneda, categoría o estado ambiguos | Preguntar lo obligatorio; una grabación no confirma una escritura |
| «Usa esta nota grabada en el navegador» | Aportar contexto de voz | El navegador entrega WebM/Ogg | No heredar la aceptación WAV ni convertirlo en silencio; usar el flujo admitido para esa selección |
| «Lee este PDF» | Aportar contexto documental | PDF raw sin contrato nativo del CLI | Mantener el original bloqueado; el texto extraído y aceptado por el usuario conserva su vía existente |

## Operaciones y contratos

| Operación semántica | Clase y efecto | Herramienta y estado real | Contrato o caso de uso | Resultado público |
|---|---|---|---|---|
| Aportar un WAV original | Lectura con coste del proveedor desconocido; candidata | Transporte del chat, sin nueva herramienta MCP | [Decodificador](../../../../../nodia-server/src/common/ai/codex/codex-chat-audio.ts), [adaptador](../../../../../nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts) y [worker](../../../../../nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts) | Respuesta persistida sólo tras completar el flujo; no equivale a una transcripción aceptada por el dueño |
| Acreditar el formato | Prueba privada explícita del operador; dos ensayos reales sin aceptación semántica | No hay endpoint público generativo de salud | `probeAudio` y `acceptAudioProbe`, [almacén por MIME](../../../../../nodia-server/src/common/ai/codex/codex-chat-audio-acceptance.ts) | Evidencia técnica mínima sin grabación, transcripción o credenciales en claro |
| Aportar interpretación revisada | Texto como datos, existente | Flujo común de adjuntos; no activa audio/PDF nativo | [Revisión del adjunto](../../../../../nodia-server/src/nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.ts) | Texto confirmado por su dueño para ese adjunto |

El audio puede originar una consulta o la preparación autorizada de una propuesta. Las herramientas de negocio mantienen sus contratos y permisos independientes; esta ficha no publica operaciones nuevas.

## Datos mínimos y resolución de dudas

| Dato | Obligatorio o condicional | Fuente | Resolución |
|---|---|---|---|
| Archivo, firma, MIME y SHA256 | Obligatorios para el original | Upload privado y verificación de bytes en el adaptador | Rechazar estructura o contenido incompatible; no aceptar paths o URLs del usuario/modelo |
| Selección, sesión y configuración | Obligatorias | Observación real y snapshot de admisión | Exigir coincidencia de conexión, modelo, esfuerzo y recurso; no sustituir proveedor o modo |
| Duración y formato PCM16 | Obligatorios para WAV candidato | Muestras, canales, alineación y byte rate decodificados | Aplicar ambos límites de bytes y duración; no confiar en metadata enviada por el cliente |
| Texto interpretado | Condicional, si se escoge la vía revisada | Revisión humana revisionada | No convertir una respuesta del modelo en consentimiento ni marcarla revisada automáticamente |

## Reglas, acceso y restricciones

Se requieren NodiaAI y los módulos de destino aplicables. El actor conserva su autoridad sobre chat y archivo; super_admin mantiene la transversalidad definida por los contratos compartidos. Los originales sólo se envían en el turno donde se adjuntan. La historia conserva referencias y respuestas, sin releer grabaciones anteriores automáticamente.

Aplicar [política50](../../../../mvp/50-nodia-ai-ai04-runtime-policy.md): hasta20 MiB por archivo, cuatro adjuntos y40 MiB acumulados por mensaje, y300 segundos de audio realmente decodificado. Son límites propios de Nodia, no cuotas o capacidades del proveedor. Originales, reservas y derivados cuentan; el contexto y los frames conservan sus techos existentes. El coste interno y los tokens del audio permanecen desconocidos si el proveedor no los entrega.

El candidato exige RIFF/WAVE canónico, un `fmt` PCM16 y un `data` válidos, canales mono/estéreo y duración dentro de política. Metadatos LIST INFO/JUNK admitidos no autorizan codecs comprimidos, chunks arbitrarios, conversión o normalización del archivo. WebM, Ogg, MP3 y M4A permanecen fuera de este candidato aunque el navegador, inspector u otro adaptador los reconozca.

PDF raw permanece bloqueado: el [ensayo offline](../../../../evidence/nodia-ai-ai40-document-audio-protocol-r01.json) rechaza `input_file` en el decoder real del CLI instalado, con control positivo de texto. La extracción real de un PDF puede revisarse y aceptarse como texto por el flujo existente. Esto no es PDF nativo; no se incorpora renderizado, OCR o fallback automático.

## Filtros e informes

No aplica una nueva medida o filtro de informes: el WAV aporta contexto del usuario. Los informes y operaciones solicitados a partir de ese contenido conservan campos, relaciones, unidades, monedas y procedencia de sus productos. Una ambigüedad de la grabación requiere aclaración, sin completar cifras o fechas por suposición.

## Vista previa, confirmación y recuperación

La grabación no autoriza cambios. Toda escritura preparada exige la vista previa exacta y el botón de confirmación humano del flujo común. Interpretar una nota o acreditar un formato tampoco consume ese consentimiento.

El staging privado queda derivado de perfil e identidad del intento, con ownership, permisos y bytes comprobados. El cierre probado del proceso/grupo nativo precede a limpiar archivos y acreditar el terminal. Una cancelación, caída o resultado incierto conserva identidad para conciliación y no reenvía la generación; el ACK debe corresponder al terminal exacto. R2 y la retención de adjuntos permanecen en su ciclo independiente, junto con el chat.

La aceptación candidata utiliza un oráculo de palabras españolas conocido fuera del prompt y presente sólo en el audio. La comparación normaliza Unicode NFKC, mayúsculas, espacios y la puntuación definida en el helper; no hace equivalencia aproximada, traducción, reconstrucción o completado de palabras. Respuesta normalizada exacta, terminal completado, cierre y ACK propios deben coincidir antes de persistir una aceptación de MIME ligada a conexión, recurso, sesión/configuración, modelo/esfuerzo y fingerprint del runtime/política. Se revalida el scope al guardar. Catálogo, login, metadata y tests sintéticos no crean esa aceptación.

## Integración y evidencia

- [x] Contratos y fuentes contrastados; estado draft y aprobación null explícitos.
- [x] Admisión conserva sólo MIME exactos de imágenes o WAV observados; no deduce permisos de categorías.
- [x] Regresiones atómicas verifican contexto, medición exacta, pérdida de proof, revocación tras lectura y ausencia de dispatch; PDF revisado pasa como texto y PDF sin revisar queda bloqueado.
- [x] Dos canarios WAV con cuenta real, grabaciones distintas y terminal/ACK propios, conciliados sin replay; semántica no aceptada.
- [ ] Aceptación semántica WAV en el scope exacto; no existe proof de audio.
- [ ] Adopción del candidato y recorrido desde UI/R2/admisión/worker, con limpieza nativa y retención comprobadas.
- [ ] WAV combinado con MCP autorizado; recuperación y cancelación reales aplicables.
- [ ] Aprobación documental y publicación; no se heredan del código o una cuenta autenticada.

[QA de admisión](../../../../evidence/nodia-ai-ai40-wav-admission-qa-r01.json):150 pruebas focales en dos archivos, tipado de producción y lint correctos. Usa puertos de adaptador/almacenamiento sintéticos y no acredita decodificador PCM, transporte CLI, R2 o cuenta real. El [reporte de protocolo](../../../../evidence/nodia-ai-ai40-document-audio-protocol-r01.json) separa esquema, admisión offline y disponibilidad semántica pendiente. El [operador de cuenta real](../../../../evidence/nodia-ai-ai40-audio-native-probes-r01.json) y el [consolidado documental](../../../../evidence/nodia-ai-ai40-document-audio-validation-r01.json) registran separadamente352 pruebas focales,6 atómicas del observador y los resultados negativos de dos grabaciones; no constituyen aceptación WAV ni adopción del candidato.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas o contexto afectados | Compatibilidad |
|---|---|---|---|
| 1 | Candidato WAV PCM16 por localAudio, prueba privada por scope y gate exacto; PDF raw rechazado por CLI y texto PDF revisado conservado | Nueva ficha draft/unregistered; sin bindings o capacidades nuevas | Cambiar fronteras de transporte, decoder o política invalida proofs según fingerprint; WebM/Ogg/PDF no heredan aceptación |

## Ensayos reales acotados y vía PDF revisada

Dos canarios sobre grabaciones españolas distintas realizan una generación y cero herramientas cada uno. Ambos quedan conciliados con terminal nativo completed, ACK propio, proceso/grupo cerrado y staging retirado, pero no se escribe aceptación WAV. El primer intento pierde el diagnóstico exacto del rechazo semántico; no se reconstruye su causa retrospectivamente.

El segundo utiliza un wrapper estrictamente observacional que conserva argumentos, receptor y la Promise original: una sola ejecución nativa devuelve53 bytes y ocho palabras normalizadas. La comparación exacta falla; el adaptador informa `audio_probe_unverified` y outcome unknown. La categoría cerrada observada es rechazo explícito del audio. La conciliación comprueba el completed y ACK nativos; esto no convierte el texto en una transcripción aceptada. No demuestra una causa ASR, incompatibilidad universal del modelo/CLI ni soporte de otro formato. No se amplían plazos, permisos o criterio semántico y no se continúa generando para buscar un positivo.

La [vía PDF revisada desde UI](../../../../evidence/nodia-ai-ai40-document-audio-validation-r01.json) sí completa sobre R05: extracción real visible, revisión humana, respuesta exacta y terminal/ACK con un dispatch y cero herramientas. El original permanece íntegro en R2 y no se envía como PDF al proveedor. Un intento anterior encuentra runtime_busy antes de despachar; la recuperación durable siguiente completa sin repetir inferencia. Eso acredita contexto textual revisado, no PDF nativo.

El candidato WAV no se adopta. La configuración, sesiones y los cuatro proofs históricos MCP/imagen de R05 mantienen sus bytes; no habilitan audio en el fingerprint candidato. La ficha sigue draft/unregistered y el fragmento aprobado de adjuntos conserva su alcance.

| Revisión | Cambio y fuentes | Herramientas o contexto afectados | Compatibilidad |
|---|---|---|---|
| 2 | PDF texto revisado positivo y dos canarios WAV negativos con cierre/ACK; segundo rechazo explícito observado sin causalidad global | Sin herramientas nuevas, proofs WAV o adopción; evidencia consolidada enlazada | PDF raw y otros contenedores de audio siguen bloqueados en este candidato |

La [captura PDF revisado](../../../../evidence/nodia-ai-ai40-pdf-reviewed-text-ui-r01.jpg) y la inspección final del consolidado verifican recarga autenticada: respuesta exacta persistida, compositor habilitado y borrador vacío. Se conservan19 mensajes/10 runs/10 dispatches/cinco adjuntos, el único efecto histórico y cero pendientes, sin reenviar ni confirmar nada.
