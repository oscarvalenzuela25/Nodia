# AI36-C05-R05 — Observación y retry previo al armado

Fecha:2026-10-19. Estado: diagnóstico parcial concluido; aceptación real pendiente, sin aprobación documental automática.

Baseline inmutable [R04](nodia-ai-ai36-c05-r04-validation.json):4/7 capacidades aceptadas y28 starts nativos observados. High/Web disponibles al retornar a061/CLI1.3.1, con MCP sin acreditar en la instancia reiniciada; cuatro servicios y quiet0. Node operativo932 se conserva.

## Defecto y arreglo

[ADR-068 propuesto](../architecture/decisions/ADR-068-nodia-ai-pre-dispatch-observation-timeout.md). _observe perdía la categoría al vencer su contexto externo de12s; el worker agrupaba esa observación con drift y omitía los retries seguros existentes. Corregir únicamente esa clasificación: Python conserva agentic_timeout, snapshot inválido/cierre/liberación/cancelación; Node sólo permite retry predispatch para Gemini Agentic directo, reason exacto e identidades física/sesión/configuración estables.

Mismo run/job, selección, deadline y contadores. Cada reentrega conserva el checkpoint del fence vigente y obtiene un nuevo intento/fence al reclamarse; no se comparte la identidad de un dispatch entre entregas. Máximo dos retries1s/3s de política50; no se envía inferencia antes del armado. Sin retry nuevo para delegación que carece de pin físico del target, admisión sin job, indisponibilidad genérica, drift, señal abortada o cualquier resultado posterior al dispatch. No se amplían120/600 ni cambian High/CLI/rol/herramientas/esquemas de negocio o confirmación.

## QA y compilados congelados

La [validación Python](nodia-ai-ai36-c05-r05-observation-timeout-validation.json) añade cinco regresiones y demuestra el fallo semántico contra la fuente R04: se perdía la categoría de timeout. Suite Windows467:465 correctas y las mismas dos omisiones históricas. Un primer fallo del stdio histórico se conserva;42 pruebas nativas y la suite completa posterior pasan sin cambios intermedios de fuente, sin atribuir una causa no observada.

El [build Linux01](nodia-ai-ai36-c05-r05-build01-report.json), SHA `8bae6884285389544a7190d03d687703bc5d0916010f554de1ffb9911eec3b05`, produce `1a483f3f72de21374e9ba2546dba2df5e07e5a5e7bd4a159a5ee6ca7a444a3fb`: un único delta de47 fuentes respecto de948, configuración/política y13 dependencias conservadas. Pasa452 pruebas Linux aplicables, sin omisiones;15 C03 de un módulo ausente se excluyen expresamente. Durante el build el operativo061 sigue intacto; base de construcción y baseline operativo no se confunden.

La [validación Node](nodia-ai-ai36-c05-r05-node-observation-validation.json), SHA `ac39552c06ab98231998654aa6a7475fe36c39b4b9ed169435dc2526eae1c1af`, pasa4208 pruebas en233 archivos, build/lint sin errores y192 diagnósticos históricos de fixtures sin nuevos. Cambian ProcessStage y la allowlist del diagnóstico. La UI conserva su mensaje de fallo traducido; no expone una nueva clave cruda. La reentrega usa el Retry real/checkpoint en pruebas aisladas:1s/3s, máximo dos retries, sin armar/enviar antes, sin extender deadline y sin compartir intento/fence entre entregas.

El [delta compilado](nodia-ai-ai36-c05-r05-node-compiled-delta.json), SHA `35cb9163c5be2de589c96e0c4312246574a8f5c7052da401da331d49ea15eec0`, conserva2803 outputs/971 assets y sólo cinco diferencias: ProcessStage.js/map/d.ts y diagnóstico.js/map. El caché incremental adicional tsconfig.tsbuildinfo no es un asset runtime y se excluye expresamente del paquete, sin borrarlo ni ocultar su detección. El bundle final conserva releasebde y74 contratos/31 fragmentos/59 fuentes/28 excluidos. El pin transitorio de src que Nest copia antes de context:build no es el pin final: el gate sólo usa el compilado completo verificado y sus hashes.

## Verificación real prevista

QA Python y de casos de uso Node, controles contra la fuente anterior y compilado candidato reproducible. Imagen pública derivada de948 con el delta Python, usando el binario operativo1.3.1 y los seis mounts originales. Build aislado sin credenciales/perfiles/red y compare de fuentes/configuración/política.

Presupuesto real: un canario actual de1.3.1 y hasta dos starts del caso financiero; máximo tres nuevos. No repetir por rutina preferencias: su espera postdispatch no cambia con esta corrección de metadatos. El canario y cada capacidad necesitan sus propios terminales/ACK/semántica. No trasladar pruebas R04 entre instancias ni certificar consumo upstream por contar starts.

El Node de aceptación y su nuevo manifiesto se mantienen separados de Node operativo932. Si el canario propio de1a483/CLI1.3.1 pasa y queda quiet/invariantes correctas, se permite conservar ese fix Python activo y reanudar los cuatro servicios bajo guard; no implica adoptar CLI1.4.2 o Node candidato. Ante fallo de activación/compatibilidad se restaura061 sólo después de conciliación/quiet. El soporte MCP se describe según la instancia realmente activa al cerrar. Los informes R01–R04 y sus compilados históricos conservan su procedencia; sus modos de check ligados al dist local anterior no son requisitos perpetuos para los siguientes builds. La nueva consolidación verifica la cadena de artefactos congelados, sin editar los validadores históricos.

## Resultado real y recuperación

El primer control se detuvo por el enlace de dependencias ausente en el root real del compilado, antes de activar el candidato o enviar inferencias: cero starts. Se conservó el fallo y sólo se añadió el enlace al conjunto de dependencias ya verificado; el segundo control usa un runner separado, sin reescribir el original.

El [canario02](nodia-ai-ai36-c05-r05-role-canary02-canary-report.json) admite exactamente un start con CLI1.3.1 y la imagen1a483. Agota119s sin nonce y termina abandoned_unknown con process_closed=true. La conciliación y el ACK corresponden al mismo attempt/proof; permiten cerrar y recuperar, no aceptar MCP o repetir la inferencia. El [suplemento de cierre](nodia-ai-ai36-c05-r05-closure-supplement.json) enlaza ocho crudos: global28→29, cero capacidades nuevas, Finanzas no ejecutado y cero efectos comerciales operativos.

No se conservaron los WARN estructurales antes de recrear el contenedor durante la restauración. RPC, callbacks, fase y causa quedan desconocidos; no se usa su ausencia como evidencia de cero actividad. Una siguiente prueba necesita preservar primero ese diagnóstico estructurado y acotado, sin prompts, resultados o credenciales. No procede repetir el mismo canario sólo para buscar un resultado favorable.

La [fotografía final](nodia-ai-ai36-c05-r05-runtime-after.json), a21:23:51 UTC de la VM, verifica imagen061 y descriptor original, seis mounts, entorno/UID/recursos/drop-in, Node operativo932 exacto y cuatro servicios activos. La versión1.3.1 y SHA512 de esa fotografía son configuración anclada, no una nueva ejecución de --version o hash del binario. SQL y artefactos nativos pendientes0, chatR05 conservado. Las observaciones no generativas finales encuentran Web y High disponibles, supportsMCP=false y modalidades verificadas vacías en la instancia restaurada. No se transfieren pruebas de otra instancia ni se restauran tokens antiguos.

Los candidatos Python R05 y Node quedan en código/compilados probados, **sin adopción operativa**. Se mantienen4/7 capacidades aceptadas: propuestas, operaciones, descripción de adjuntos y conjuntos dependientes. Siguen pendientes nodia_preferences_prepare, nodia_preferences_list y nodia_finance_movements_prepare_create. La causa de las esperas posteriores al envío sigue sin establecerse; el arreglo local de metadatos/retry no se presenta como su solución. AI-36/C05 permanecen abiertos. La validación consolidada [R05](nodia-ai-ai36-c05-r05-validation.json) conserva la cadena histórica y la publicación vigente.

La [revisión independiente posterior](nodia-ai-ai36-c05-postdispatch-review.md) no encuentra otra causa local demostrada. El siguiente control debe conservar el resumen estructural antes de retirar el contenedor y distinguir RPC totales de tools/list exitoso, y recepción de init de identidad real de agente/modelo. Se mantiene el orden seguro de cierre, conciliación y ACK; no se ejecuta otra inferencia en esa revisión.

Consolidado R05 congelado: SHA256 `25f3ee4a8a82f778522c55ff88922905acc6a22d40f2e74617ba6791baf236c4`. Revisión root independiente: --check y --self-test correctos;77 controles negativos y13 positivos, incluido rechazo de un cuarto start sobre el máximo3. Los reportes R03/R04 heredaban un campo de presentación de presupuesto7 aunque sus gates/inputs aplicaron5; la aclaración derivada R05 conserva los originales y no altera sus conteos o aceptación.

[Cierre de fichas e impacto](nodia-ai-ai36-c05-r05-knowledge-impact.json): context-execution rev13 y runtime-policy rev4 permanecen draft/unregistered/approval null. Las31 fichas aprobadas, registro, manifiesto y31 fragmentos siguen idénticos; compilación en memoria y check de publicación conservan releasebde/74 capacidades/59 fuentes/28 excluidas. Sin regenerar assets congelados.
