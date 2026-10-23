# AI-38: revisión del stream Gemini Web sin candidata

Estado: diagnóstico offline e instrumentación candidata, 2026-10-22. No acredita una causa remota, una nueva inferencia, adopción ni disponibilidad de adjuntos. La [evidencia anterior](nodia-ai-ai38-mcp-post-list-r01.md) conserva sus resultados y límites.

## Hechos comprobados

Los intentos WAV, WebM y PNG anteriores completaron upload HTTP200 y abrieron generación HTTP200, pero sólo observaron dos chunks y224 bytes antes del deadline global de120s. No hubo `ModelOutput`, EOF observado ni recuperación de historial. El fallo está antes de validar el JSON de respuesta; la evidencia no sostiene atribuirlo al parser de JSON del chat ni exclusivamente al audio.

El SDK2.1.1 instalado espera `stall_threshold+5` por siguiente chunk; con watchdog120 y timeout300, la espera puede superar el presupuesto global Nodia de120s. Un chunk alrededor del segundo61 mantiene abierta esa espera hasta que Nodia cancela. `recovery_calls:0` es compatible con ese orden y no demuestra que no hubiera CID remoto. Dos chunks tampoco equivalen a dos frames. Son lecturas del código público instalado y de evidencia ya capturada, sin generación adicional. El [inventario de runtime](nodia-ai-ai38-web-stream-readonly-r01.json) comprueba31 fuentes SDK idénticas a la `.venv` local.

## Hipótesis y siguiente discriminación

Pueden existir frames de espera, error, metadatos de conversación o una forma desconocida sin candidata. La instrumentación anterior no distinguía estos casos. No hay evidencia para modificar credenciales, modelo, MIME o plazos, atribuir cuota agotada ni reenviar un resultado incierto.

El siguiente control debe ser una solicitud nueva de texto sin adjunto, con selección y política existentes. Primero se debe observar su resultado y conciliar/confirmar el recibo; sólo con conversación acreditada procede el canario semántico por formato. No se reutilizan UUID ni se automatiza un retry por timeout. Los resultados nuevos pertenecen a un informe operativo posterior.

## Candidato implementado

[`web_stream_frame_diagnostics.py`](../../nodia-gemini-microservice/web_stream_frame_diagnostics.py) observa formas de envelopes dentro del wrapper existente de respuesta. Su framing incremental UTF-16 se contrasta con `StreamingFrameParser` del SDK real, sin invocar su logging de frames malformados, sustituir su parser de ejecución o retornar contenido al SDK. La versión distinta de2.1.1 deshabilita sólo la observación. Presupuesto:64KiB de bytes y256 partes por generación; buffers privados se descartan al cerrar o alcanzar un límite. No hay archivos, eventos de contenido ni texto de excepciones.

El snapshot `stream_frames` contiene contadores de frames/partes, JSON malformado, listas de status, candidatas, indicadores de finalización/contexto y análisis; CID/RID son exclusivamente booleanos. Los errores se proyectan a seis categorías cerradas; códigos desconocidos quedan en `other`. Estas observaciones no prueban éxito, compatibilidad del formato ni la interpretación interna del proveedor. Requests, uploads, modelo, razonamiento, parser principal, deadline, cancelación y política de reenvío permanecen iguales.

El [lector retrospectivo](scripts/nodia-ai-ai38-web-stream-diag-r01.py) acepta identidad exacta y ventana UTC de hasta900s. Captura logs sólo en memoria con8MiB/25s, exige época estable y emite únicamente allowlists; no despacha solicitudes ni exporta cuerpos, prompts, cookies, URLs o IDs del proveedor.

## Validación offline

- Doce pruebas nuevas correctas: equivalencia de framing con SDK, fragmentación UTF-8/UTF-16/XSSI, campos ausentes, status/error, JSON malformado sin logging, límites, versión incompatible, errores internos, chunks/opciones/excepción originales y cierre por cancelación.
- Suite Windows:517 ejecutadas,515 correctas y dos omisiones de plataforma existentes. Runner `./.venv/Scripts/python.exe run_tests.py`; sin red externa o cuentas reales.
- Cuatro pruebas del lector correctas: allowlists, tipos/cero, identidad exacta y rechazo de época cambiada. `git diff --check` de las fuentes sin errores.

Fuentes candidatas SHA256: `web_generation_diagnostics.py` cc6aa35529860113618b801efe3b1689cd69875d46d9703a8a12f90d7efa96d0; `web_stream_frame_diagnostics.py`0a0346f517f47f7ff8e7241a22425477df206b1c199b49d4f9fe479c34e4d385; prueba ef08f5536d99af134652b6bb5d183f374f1ed192eadb2eb316554fd9a8738fe3. Lector4e8049863c1e7744204bd2c85ef36406f4e7984f5c2fc8da7d64911cdbf46ad8. No se cambió código Server/Client, configuración, publicación o aprobación en esta revisión.
