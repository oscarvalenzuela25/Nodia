# AI-37 — Rendimiento y recuperación operativa

Fecha: 2026-10-20. Estado: implementado y verificado en aislamiento; sin aprobación documental automática.

## Alcance y dependencias

Esta etapa del [plan45](45-nodia-ai-implementation-plan.md) mide consultas y crecimiento con datos sintéticos y comprueba recuperación sin replay. Conserva [la arquitectura43](43-nodia-ai-execution-architecture.md), [política50](50-nodia-ai-ai04-runtime-policy.md) y los contratos de autorización/retención existentes.

AI-36/C05 sigue abierto: cuatro de siete capacidades aceptadas; preferencias preparar/listar y creación de movimiento financiero siguen pendientes de aceptación real. AI-37 no traslada esos gates ni acepta capacidades por compilar, probar SQL o crear alertas. No requiere consumir Gemini para estas pruebas.

## Cambios

- Auditoría del listado global por conjunto, con un evento/correlación por chat ajeno en la misma transacción. Se conserva la autorización de `super_admin` y no se registran mensajes en la auditoría.
- Observación interna agregada de cola, deadlines, leases, unknown y limpieza, con categorías cerradas. Cadencia de la política, coalescencia local y avisos de cambio/resolución; sin endpoints o tablas nuevas. Disponibilidad del proveedor y coste externo no medido: desconocidos.
- Mantenimiento ordenado que no deja de intentar retención, limpieza y observación por una excepción previa de recuperación.
- Gate de arranque API/worker y preparación de restore aislado, manifiesto externo acotado, invalidación de confirmaciones y cuarentena durable del trabajo restaurado. [ADR-069 propuesto](../architecture/decisions/ADR-069-nodia-ai-quarantined-restore-and-operational-observation.md).

## Validación requerida

- PostgreSQL desechable con EXPLAIN/ANALYZE/BUFFERS para listados, mensajes, búsqueda, claims, purga e informes; comparar auditoría por fila/conjunto y mantener exactamente sus eventos.
- Tamaños JSONB/índices/contexto serializado; rechazos efectivos y cardinalidad de consultas, sin estimar tokens, cuotas, precios o SLA a partir de bytes.
- Reinicio/rolling deploy y fencing con procesos/SQL; restore de backup sintético anterior a caducidad/borrado manual, sin reenvío automático ni uso de confirmaciones viejas.
- Fallos de limpieza y recuperación que conservan testigos/cuarentena; observación agregada sin filtraciones y sin cambiar los datos observados.
- Build/tipado de producción, casos de uso, lint, contratos y preservación de la publicación; fixtures históricos de tipado separados de nuevas regresiones.

Los resultados y sus límites se detallan a continuación; enumerar un gate no acredita su adopción operativa.

## Operación y límites

La restauración ocurre sin listeners, workers, credenciales o egress del proveedor. El flag `NODIA_AI_OPERATION_MODE` no es una barrera de red: API/worker rechazan `quarantine` antes de NestFactory; sólo el comando de restore offline la requiere. `normal` por defecto preserva instalaciones existentes; un valor inválido no se acepta como `normal`.

Una copia con trabajo aparentemente no enviado puede ser anterior a un efecto real. Ni la ausencia de un recibo en el backup ni un lease vencido autorizan replay. La marca de restore conserva esa incertidumbre frente a recuperación automática y reanudación humana ordinarias. El preparador no certifica conciliación con el dominio actual o los procesos nativos, y nunca autoriza por sí solo habilitar tráfico.

El journal externo de borrados debe ser completo y confiable hasta la cuarentena. Si falta, no se abre el chat restaurado. Sus IDs opacos/generaciones no son un archivo adicional de contenido: se retiran al dejar de existir copias capaces de resucitarlo, conforme50. Deben verificarse por entorno rotación máxima de siete días, cifrado, inventario de versiones/objetos y conciliación actual. Las pruebas aisladas no afirman que esa infraestructura continua esté desplegada.

## Cierre verificado

[Validación consolidada reproducible](../evidence/nodia-ai-ai37-validation.json) y [calidad](../evidence/nodia-ai-ai37-quality.json): 4.274 pruebas en 237 archivos correctas, build/tipado de producción y lint sin errores; tres advertencias históricas. El tipado global de fixtures conserva exactamente 192 diagnósticos previos, sin nuevos. Una suite previa tuvo un fallo de 5,39 s en DI de publicación (`STACK_TRACE_ERROR`); se conservó, el caso focal pasó 11/11 y la suite completa posterior pasó sin cambios de fuente o timeout. La causa sigue desconocida.

[Rendimiento](../evidence/nodia-ai-ai37-performance.json): 61 comprobaciones en 19 perfiles, más 11 de equivalencia SQL/concurrencia. La selección de trabajos con 20.000 conversaciones históricas pasa de agotar 10 s a una mediana de 5,93 ms al preagrupar trabajos activos por dueño. La auditoría de 100 conversaciones pasa de 100 inserts a uno y de 34,59 a 6,27 ms; para una sola fila sube de 0,340 a 0,392 ms. No se agregaron índices.

La búsqueda amplia tarda aproximadamente 1,45–1,50 s con caché caliente; estas mediciones sintéticas no son percentiles de producción. La paginación de mensajes mantiene tres consultas de datos al pedir 1, 5, 10 o 100 mensajes. La consulta de uso con un dueño próximo a su cuota tarda 45,35 ms. El contexto serializado de 300 mensajes del corpus ocupa 199,5 KB y el de 500 supera el presupuesto de 262.144 bytes y se rechaza: no es un límite fijo de mensajes ni una estimación de tokens. Coste externo desconocido; no hubo inferencias.

[Operación SQL/DI](../evidence/nodia-ai-ai37-operations-sql.json): 17 comprobaciones con 1.006 jobs; un agregado y cuatro sentencias contando transacción, 9,84 ms en el ensayo. Resuelve el worker/collector mediante DI real sin iniciar loops, mantiene hashes de filas y no llama a proveedores. Incluye cuarentena de restore aunque no haya slots unknown. La suite focal del colector tiene 25 casos. Los avisos del worker se deduplican por transición y sólo anuncian recuperación si completaron sus comprobaciones, nunca al interrumpirlas por drain. El timeout de sentencia SQL no acota la espera por una conexión del pool.

[Recuperación](../evidence/nodia-ai-ai37-recovery.json): 33 comprobaciones SQL/procesos, con SIGKILL, fences antiguos, compatibilidad de catálogo, pg_dump/pg_restore real en una nueva BD, CLI en otro proceso, confirmaciones revocadas y limpieza que falla cinco veces antes de reparación explícita. Los objetos se borran mediante un puerto sintético: eso no acredita R2. [Runbook de restore](../evidence/nodia-ai-ai37-recovery-runbook.md).

Los encabezados históricos failed/partially_completed conservan su estado para respetar la única ejecución activa por chat. Los jobs de ejecución fallidos restaurados pasan a unknown y sus pasos inseguros también: no se ofrecen como reanudables. La purga conserva dos testigos desprendidos del chat con su marca de restore y la recuperación habitual no los borra. Se comprueba el contraejemplo 23505 de promover todos los históricos a activos y el rollback completo ante un descriptor al límite de 8.192 bytes; ninguno permite abrir la copia.

El control de arranque Linux sobre el candidato04 bloquea main/worker para quarantine o un valor inválido antes de NestFactory; cuatro casos con contadores de sockets/fetch en cero, incluso si una dependencia capturase su error. No sustituye el aislamiento de red/credenciales del runbook. Un primer control Windows agotó su plazo de laboratorio y se conservó; el control Windows posterior y el control Linux final pasaron, sin deducir de ello una causa upstream.

El benchmark se ejecutó sobre el compilado02; todos sus hashes de dependencias medidas coinciden con el04 final. El04 añade los ajustes de observación/restore comprobados en sus propios ensayos. [Paquete04](../evidence/nodia-ai-ai37-candidate04.json): 2.827 outputs/979 assets runtime y 924 fuentes; respecto al candidato local R05, ocho assets nuevos y veinte modificados, sin tablas, migraciones o índices nuevos. No se presenta la medición02 como una ejecución04.

[Contexto y publicación](../evidence/nodia-ai-ai37-knowledge.json): ficha runtime-policy rev5 draft/unregistered/approval null; las 31 fichas aprobadas y las 74 capacidades/31 fragmentos/59 fuentes/28 excluidas se conservaron. El paquete04 conserva el release bde409 y sus comprobaciones previas a actualizar el checklist. La actualización final del plan45 cambia exclusivamente un hash de fuente de una ficha publicada: la compilación en memoria produce c70317, sin cambios en fichas, fragmentos, herramientas o permisos. La [adenda de cierre documental](../evidence/nodia-ai-ai37-documentation-finalization.json) registra esa diferencia y el fallo esperado del comparador histórico C05, sin sobrescribirlo. No se emitieron assets ni se adoptó ese nuevo release; el siguiente build y su paquete deben fijar el identificador nuevo antes de cualquier despliegue.

[Comprobación operativa final](../evidence/nodia-ai-ai37-operational-state.json): cuatro servicios activos y 932 outputs de Node operativo idénticos al baseline; imagen/sesiones/configuración preservadas, cero jobs/attempts/slots o testigos nativos pendientes y chat R05 conservado. Esa comprobación SQL es sólo de lectura; los ensayos usan PostgreSQL desechable. No se reiniciaron servicios ni se consultó al proveedor. Gemini no se revalida por probar SQL o arranque.

## Gates que permanecen

AI-37 cierra implementación y ensayos aislados; no declara entrega productiva o adopción del candidato sobre el Node operativo. AI-36/C05 conserva sus tres capacidades de aceptación real pendientes y los 77 candidatos aún sin publicar. AI-38 mantiene aceptación por entorno, tráfico/caché fría, aislamiento, cifrado/rotación real de backups, journal externo continuo y comprobación de todas las versiones/objetos que puedan reconstruir contenido.

La preparación de restore siempre devuelve release_authorized:false. No implementa un liberador automático ni autoriza retirar marcas/slots para que avance el worker: requiere conciliación contra dominio/runtimes actuales, incluidos recursos ausentes en la copia. Los borrados reales del proveedor y el coste externo no observado continúan desconocidos. Las pruebas de laboratorio no convierten el objetivo de limpieza 24 h o el horizonte de backup 7 d en garantías desplegadas.
