# AI36-C05-R04 — Comparación del CLI fijado1.4.2

Fecha:2026-10-19. Estado: comparación cerrada parcialmente, con validación congelada; AI-36/C05 abiertos. Sin aprobación documental automática ni adopción operativa del candidato.

Baseline inmutable: [R03](nodia-ai-ai36-c05-r03-validation.json), cuatro capacidades aceptadas de siete y26 starts nativos observados. Las dos herramientas de preferencias completaron callbacks reales en R03, pero su intento no terminó dentro del plazo; Finanzas no superó descubrimiento. Esos resultados conservan sus identidades, cierres y ACK; no se reenvían.

## Intervención y límites

[ADR-067 propuesto](../architecture/decisions/ADR-067-nodia-ai-pinned-cli-compatibility-experiment.md). El changelog del proveedor anuncia una corrección posterior a nuestro CLI1.3.1 de esperas entre reintentos. No demuestra que esos reintentos expliquen los timeouts observados. El paquete histórico1.3.4 no pudo fijarse con metadatos oficiales; no se inventa su URL/hash.

Se evalúa explícitamente [CLI1.4.2 fijado](nodia-ai-ai36-c05-cli-1.4.2-package-pin.json), no una actualización automática a latest. Paquete SHA512 comprobado contra manifiesto HTTPS; ELF derivado SHA512 `f63dd18d9aee3742055452c6eefbc22740ac4cb7bd7ad4c6b5cac2cccbd69d0548058ef5a3f7105d57146f7ce0a3ae07ef9dd89cde84dcac2cba64edc6f8dbdc`. No se obtuvo firma independiente.

Cambios de código previstos y acotados: selección explícita de versión compatible, verificación de hash/salida real y compatibilidad de observación chat/MCP. OCR y adjuntos1.4.2 permanecen bloqueados hasta calificarse por separado. No cambian High, esfuerzo, proveedor, herramientas, rol, argumentos, esquemas publicados, confirmación, presupuestos o deadline.

## Control offline

[Offline02](nodia-ai-ai36-c05-r04-cli-offline02-report.json): versión real1.4.2 en95,8ms y help en107,5ms, ambos exit0. Help declara las diez opciones utilizadas por el runtime; no acredita parseo real del rol, herencia, autenticación o wire MCP. Contenedor desechable, rednone, rootreadonly, UID10001, capdropALL, sin entorno o perfiles operativos; HOME vacío, cero inferencias y operativo061 intacto.

[Offline01](nodia-ai-ai36-c05-r04-cli-offline01-report.json) se conserva: el arnés buscaba los flags sólo en stdout, pero el CLI entrega help por stderr. Es un falso negativo del extractor, corregido de forma explícita en02; no un fallo de compatibilidad del proveedor.

## QA de las fuentes y de la imagen

La [validación Windows](nodia-ai-ai36-c05-cli-version-r04-validation.json) congela las tres fuentes y11 regresiones nuevas:462 pruebas,460 correctas y las mismas dos omisiones históricas. La repetición independiente de las11 regresiones pasa. La verificación estricta de inicialización conserva hash/versión exactos y también rechaza un `--version` con exit distinto de cero.

El [build01 Linux](nodia-ai-ai36-c05-r04-build01-report.json), SHA `59a8747bfcefaf22f0df463ca56400c380c55700928f3f9135c0e4f3670bce97`, produce imagen `9482df4c8ad2db5d591e3f1ac76e2c7cdc2a8fe7b296fa76374dc139c234a47e`. Sólo cambian tres de47 fuentes; configuración y política MCP permanecen iguales, con una capa adicional y trece dependencias relevantes comprobadas. Pasa447 pruebas Linux aplicables, sin omisiones;15 pruebas C03 de un módulo ausente en esa base se excluyen expresamente. Binario, perfiles y entorno operativo no entran en la imagen. Durante el build no se reinician servicios ni se consume inferencia.

La revisión independiente del retorno detecta y corrige un `finally` que reactivaba consumidores incluso si fallaba quiet o la comparación del descriptor. El script corregido sólo inicia API/worker tras restaurar exactamente061, entorno, seis mounts, UID, puerto, recursos y drop-in, con quiet previo y posterior. Si falla un guard mantiene la pausa y el propietario necesario para recuperar el estado. No restaura credenciales antiguas ni elimina marcadores.

## Plan de la comparación real

Tras congelar QA y fuentes, construir imagen inmutable derivada de061 con sólo las fuentes acordadas. Mantener CLI1.3.1 y descriptor originales intactos; montar el ELF1.4.2 readonly en otra ruta y declarar versión/hash exactos en el override temporal. Pausar API y worker durante toda la comparación para que sólo el supervisor use el perfil. No iniciar otro CLI contra el mismo perfil ni imprimir/exportar credenciales.

Comprobar metadatos no generativos y selección exacta High. Si pasan, un canario con el original AI15, nonce, callback, cierre y ACK propio. Sólo tras acreditarlo iniciar preferencias y Finanzas, hasta dos starts por caso. Máximo cinco starts nuevos; no se utilizan etapas dependientes tras fallar un prerrequisito. Un callback sin terminal completo no acredita capacidad.

Al terminar, conciliar intentos inciertos y restaurar imagen061/CLI1.3.1 y los cuatro servicios. Comprobar el perfil mediante el CLI oficial sin restaurar ciegamente tokens antiguos tras rotación. Node932, configuración persistida y R05 se conservan. La acreditación de una sesión candidata no se transfiere al reiniciar o volver a otra instancia.

## Resultado real y retorno

La [validación R04 congelada](nodia-ai-ai36-c05-r04-validation.json), SHA `e6521fd7f0e77a282c976401e8865da595f1a7f14e915000b8ea87a1171b444b`, conserva4/7 capacidades aceptadas, sin nuevas aceptaciones. Consume dos starts: canario y descubrimiento de preferencias; total histórico28. No utiliza el resto del presupuesto por rutina.

El canario1.4.2 pasa con nonce/callback, terminal completed cerrado a las20:55:46,160 UTC de la VM, ACK exacto y MCP verdadero. La identidad del ELF, su versión real, mountreadonly, imagen y epoch se verifican por separado. Se acredita compatibilidad efectiva del loop; el encoding de arguments permanece desconocido porque el puente lo normaliza. No se deduce un formato por la versión ni se atribuye causalidad a una corrección del changelog.

Preferencias attempt01 falla antes de Node/dispatch porque el supervisor interpretaba exit3 de un servicio pausado como fallo de comando; cero starts. Se conserva el original y un runner-v2 separado. El caso attempt02 utiliza el mismo productor/fixture congelados y verifica por suplemento las parejas inactive/3 para API/worker y active/0 para Gemini/nginx. Su descubrimiento agota119,044s con RPC6, cero callbacks, init/prompt_received, sin terminal ni indicadores de error. Cierre y ACK a las20:59:00,685 UTC de la VM, sin confirmación o efectos; ambas capacidades siguen pendientes.

Finanzas usa runner-v3 con parejas de estado/exit cerradas. No llega a dispatch: observación High no disponible con reason agentic_unavailable después de12,050s; cero starts. No se repite esa inferencia ni se inventa una identidad nativa inexistente.

La [restauración final](nodia-ai-ai36-c05-r04-restoration01-runtime-after.json) verifica061/CLI1.3.1 con digest real, drop-in, seis mounts, entorno, UID, recursos y Node932 exactos. Quiet previo/posterior0; reanuda los cuatro servicios sólo tras esos guards. A las21:03:21 UTC de la VM no quedan jobs, intentos, slots o marcadores pendientes, y R05 permanece. Dos [observaciones no generativas finales](nodia-ai-ai36-c05-r04-restoration01-modalities.json) encuentran Web y Agentic/High disponibles; MCP falso y modalidades vacías corresponden a la nueva instancia, no a un traslado de pruebas del candidato. No se restaura contenido de credenciales ni se promete compatibilidad general de migración a partir de dos lstat.

La comparación no resuelve las esperas. Se identificó por lectura un defecto local posterior: el timeout externo de _observe pierde su categoría y el worker no lo trata como retry seguro predispatch. Se aborda separadamente en [R05](nodia-ai-ai36-c05-r05-acceptance.md), conservando R04 y sus resultados inmutables.

## Alcance restante

Las tres capacidades y AI-36/C05 siguen abiertos. No se presenta el paquete o help como inferencia; el wire se describirá sólo con señales realmente observadas y su encoding quedará desconocido si no se expone de forma segura. Los reintentos upstream, tokens y facturación siguen desconocidos; los starts cuentan admisiones nativas observadas y los reenvíos de Nodia permanecen deshabilitados.
