# AI36-C05-R03 — manifest MCP y aceptación restante

Fecha: 2026-10-19. Estado: continuación cerrada parcialmente, con validación congelada; AI36-C05 sigue abierto. Sin aprobación documental automática.

Baseline: [R02 congelado](nodia-ai-ai36-c05-r02-validation.json), cuatro capacidades aceptadas de siete y 22 starts acumulados. R01/R02, sus inputs, validadores, cohortes y entornos conservan su procedencia. El workflow aceptado en R02 no acredita por sí mismo los preparadores de preferencia o gasto utilizados para construir sus borradores de entrada.

## Defecto reproducido

El [control previo](nodia-ai-ai36-c05-preferences-stdio-control-pre-fix.json) utiliza exactamente los nueve descriptores del caso de preferencias, con catálogo SHA `e080d296391b619d8a238aa5617ce0666e0ce3e1180e7f172fd184f3d8563fa6` y 21.873 bytes en su representación nativa. La admisión acepta schema14/catálogo16, pero el lector rechaza manifest17 por volver a contar el envoltorio. El proceso stdio real termina con exit2 antes de `initialize`, sin stderr. El rol, configuración temporal única, permisos y limpieza se verifican por separado.

Esta reproducción demuestra un defecto local que afecta ese catálogo. No explica los timeouts de descubrimiento con RPC observados en R02 ni permite atribuirlos a cuota, autenticación, red o razonamiento.

## Arreglo y límites

[ADR-066 propuesto](../architecture/decisions/ADR-066-nodia-ai-mcp-manifest-depth-boundary.md): manifest17 exclusivamente para un envoltorio cerrado; revalidación del catálogo como raíz con profundidad16. Argumentos, RPC entrantes, bytes, cardinalidad, contexto acumulado, permisos y confirmación mantienen sus límites. El cambio de producción se limita a `native_mcp_stdio.py`; rol y hash de política se conservan.

## Secuencia de verificación

1. Control real stdio/gate con los nueve descriptores, consumidor CLI y respuestas de negocio explícitamente sintéticos; regresiones de profundidad, entradas inválidas y cierre. No se presenta como inferencia ni aceptación de una capacidad.
2. Suite Python oficial Windows y QA Linux aplicable en una imagen inmutable derivada de902d, con un único archivo de producción modificado y comparación del resto de fuentes/configuración.
3. Activación bajo drenaje y propietario único, con backup reversible; canario real propio de la nueva instancia y cierre/ACK exactos. No se transfieren las acreditaciones efímeras de la sesión anterior.
4. Casos independientes pendientes de preferencias y Finanzas, con selección durable, callbacks reales, terminales completos, confirmación HTTP exacta, idempotencia y recibos atómicos en PostgreSQL desechable. La BD configurada conserva sólo lecturas.

Presupuesto de esta continuación: un canario y dos generaciones por cada uno de los dos casos, máximo cinco starts nuevos. No incluye replays de las inferencias inciertas de R02; cada intento anterior está cerrado y conciliado antes del siguiente entorno. No cambiar modelo, esfuerzo, proveedor o deadline para acomodar los ensayos.

Node operativo conserva su baseline de932 assets. El compilado de aceptación971/2.803 archivos totales se valida de forma independiente; probarlo en laboratorio no implica adopción operativa o productiva. Los 77 candidatos restantes y los gates de AI-36 posteriores mantienen su alcance.

## QA local del arreglo

La [validación local](nodia-ai-ai36-c05-manifest-depth-validation.json) congela `native_mcp_stdio.py` con SHA `7016d5735a989b30f61e4dd6108392b3ce5c0e4f62716a5123517bf99925097c`. Suite oficial Windows:451 pruebas,449 correctas y las mismas dos omisiones históricas; seis regresiones nuevas verifican los límites y entradas rechazadas. Se conserva un snapshot público de la fuente anterior con su hash original.

El [control independiente de raíz](nodia-ai-ai36-c05-preferences-stdio-root-independent.json) pasa con los nueve descriptores exactos, materialización de rol/configuración, stdio real, `tools/list`, hook, dos respuestas sintéticas y cierre/ACK/limpieza. Dos fallos intermedios del consumidor sintético quedan preservados y diferenciados en la validación; no se presenta una causa establecida para ellos ni se ocultan como inferencias reales. El control posterior y la repetición independiente utilizan la misma fuente productiva congelada. No se ejecutan preparadores de negocio, CLI de proveedor o BD operativa en estos controles.

El [build Linux01](nodia-ai-ai36-c05-r03-build01-report.json) produce la imagen `0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa`, derivada de902d con una capa y un único cambio de47 fuentes, el stdio congelado. Configuración de imagen y doce dependencias relevantes coinciden. Pasa436 pruebas Linux aplicables, sin omisiones; los15 métodos C03 de un módulo ausente en la base se excluyen expresamente y no se presentan como ejecutados. El build no monta perfiles/entorno operativo, utiliza red deshabilitada y conserva la instancia902d activa sin modificarla.

## Activación y canario Gemini del nuevo entorno

La [activación](nodia-ai-ai36-c05-r03-role-activation.json) sustituye902d por061552 bajo propietario único, conservando mounts, entorno, UID, puerto privado y recursos. El backup permite volver a902d. No se modifica Node operativo.

El [canario R03](nodia-ai-ai36-c05-r03-role-canary01-canary-report.json) y el [original AI15](nodia-ai-ai36-c05-r03-role-canary01-original-ai15-report.json) pasan: disponibilidad High actual, MCP falso antes, un callback con nonce, terminal `completed` y proceso cerrado, ACK exacto a las 20:32:03,032 UTC de la VM y MCP verdadero después. Un start R03/23 acumulados, sin efectos de negocio. El wrapper conserva su etiqueta histórica R01 y su hash; el [supervisor R03](nodia-ai-ai36-c05-r03-role-canary01-runner-report.json) acredita el entorno de esta continuación.

Tras confirmar SQL/estado nativo sin pendientes, R05 preservado y cuatro servicios activos a las 20:32:30 UTC de la VM, se ejecutan los casos independientes. El canario acredita el canal de esta sesión; no sustituye sus criterios de aceptación.

## Resultado de los casos y cierre parcial

La [validación R03 congelada](nodia-ai-ai36-c05-r03-validation.json), SHA `1c606670bb23ec110597cb903b7a426feb138958c91673b3dd78c3a12c74259c`, conserva cuatro capacidades aceptadas de siete, sin nuevas aceptaciones en R03. Se consumen cuatro de los cinco starts previstos: canario, dos etapas de preferencias y descubrimiento de Finanzas. Total histórico observado:26. El start restante no se utiliza por rutina.

- [Preferencias](nodia-ai-ai36-c05-r03-case-attempt01-preferences-case-report.json): descubrimiento completado y ACK exacto; la ejecución ya inicializa MCP con los nueve descriptores. `nodia_preferences_prepare` y `nodia_preferences_list` completan dos callbacks reales, con SQL de92 y45ms; las llamadas llegan a108,43 y114,54s. No llega el terminal del CLI antes del límite. El intento queda `unknown` cerrado, conciliado y reconocido a las20:36:54,904 UTC de la VM. No hay confirmación humana ni efecto; ambas capacidades siguen pendientes de aceptación completa.
- [Finanzas](nodia-ai-ai36-c05-r03-case-attempt01-finance-case-report.json): descubrimiento agotado a119,047s, con seis RPC de inicialización/catálogo, cero callbacks y sin eventos de herramienta o terminal. El intento queda cerrado y conciliado, ACK a las20:40:28,860 UTC de la VM. No se abre ejecución posterior, no hay efectos y la capacidad sigue pendiente.

La comparación distingue dos hechos: el manifiesto corregido ya permite cargar el catálogo y ejecutar las herramientas de preferencias; las demoras de inferencia/cierre persisten. Los tiempos SQL medidos no explican la espera anterior a esos callbacks. No se atribuye una causa de cuota, autenticación, reintento o razonamiento sin señal comprobable.

Estado final observado a las20:41:13 UTC de la VM: cero intentos SQL/nativos pendientes y cero slots ocupados; cuatro servicios activos, imagen061552 y Node operativo932 intacto, chat R05 conservado. El compilado Node971 sigue siendo candidato de laboratorio. Los controles del validador pasan:63 negativos y nueve positivos, con las mismas funciones de procedencia, ACK y aceptación; no se rebaja el requisito de terminal completo para aceptar un callback tardío.

## Alcance de los contadores y espera interna del CLI

Los campos históricos `automatic_inference_retries: 0` describen los reenvíos controlados por Nodia y su arnés. No miden las solicitudes o reintentos internos del CLI/proveedor. Los starts observados tampoco son tokens, facturación o generaciones upstream comprobadas; esos valores permanecen desconocidos.

La documentación oficial consultada el2026-10-19 describe reintentos internos ante errores transitorios en CLI1.2.1 y reglas de espera en1.2.13. CLI1.3.4, posterior al1.3.1 instalado, anuncia corregir esperas entre reintentos que podían llegar a cuatro minutos. Es un precedente para investigar; no demuestra que ocurriera en estos intentos ni garantiza un backoff concreto en1.3.1. No se actualiza el binario ni se modifica el deadline a partir de esa hipótesis. [Changelog oficial](https://www.antigravity.google/docs/changelog/).
