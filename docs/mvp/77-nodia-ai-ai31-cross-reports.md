# NodiaAI AI-31 — informes cruzados y presentación

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: AI-31 cerrado técnicamente en laboratorio privado; implementación, SQL/worker, UI, checks finales y activación verificados.

[Plan45](45-nodia-ai-implementation-plan.md) · [Contratos41](41-nodia-ai-v1-contracts.md) · [AI-30](76-nodia-ai-ai30-restricted-reports.md) · [ADR-056](../architecture/decisions/ADR-056-nodia-ai-cross-report-composition.md) · [Ficha](../nodia-ai/knowledge/nodia-ai/features/restricted-reports.md).

## Composición y límites

ComposeNodiaAiReportUseCase valida toda la solicitud antes del primer agregado y reutiliza RunNodiaAiReportUseCase. separate devuelve bloques con los totales de todo el filtro, no sumas de páginas. compare_compatible coteja unidad/moneda/escala/significado/grano, período/base temporal y dimensiones; alinea por valores tipados y distingue null de cero. No calcula un total entre fuentes, netos ni conversión monetaria.

Una comparación agrupada sólo se acepta si cada fuente cabe completa en su asignación acotada de grupos. Si necesita otra página, devuelve unsupported_semantics; se puede usar separate o refinar filtros. Los cursores de separate vinculan consulta completa, versión, actor/sesión y cursores nativos por fuente; conservan fallos parciales. Una página nueva puede observar datos nuevos.

Las fuentes usan transacciones independientes; snapshot_consistency=independent_source_snapshots y cada bloque entrega observed_at. Un fallo operativo o revocación de fuente deja un error seguro y estado partial, conservando lo disponible. Revocación de sesión/NodiaAI, cancelación, plazo agotado o solicitud inválida impiden entregar el informe. La autoridad final de los bloques exitosos se revalida antes de publicar el recibo.

El límite global de grupos se reparte entre las fuentes solicitadas; también se acotan filtros, columnas, profundidad, colecciones y bytes según política50. No hay SQL, relaciones o expresiones aportados por el modelo.

## Contratos y ejecución

El schema dedicado es nodia-server/src/nodia-ai-reports/config/report-composition.schema.json. Extiende la forma conceptual ReportResult con combine, snapshot_consistency y source_results, donde cada bloque conserva totals exactos. No modifica los contratos comunes ni los bytes de las fichas publicadas. La validación ejecutada comprueba forma y coherencia entre solicitud, bloques, medidas, columnas, filas, procedencia, estados y cursores.

nodia_reports_describe y nodia_reports_run son herramientas técnicas de sólo lectura del gateway existente. La admisión congela sus hashes y el grant; requieren Agentic o delegación Web→Agentic opt-in existente. Web sigue conversacional. Describe filtra módulos actuales y los permitidos en el turno; la existencia de un nombre en Markdown no lo habilita.

El callback reserva presupuesto y un recibo validated; ejecuta las fuentes fuera del checkpoint de persistencia y entra en uno nuevo para comprobar autoridad/contrato y guardar resultado/evento. Repetir un callback completado no recalcula. Una reserva interrumpida no se repite automáticamente con el mismo identificador. Leer el recibo humano reautoriza el chat y cada ámbito exitoso; no vuelve a consultar agregados ni llama al proveedor.

## Presentación

ReportObservation abre el recibo a petición desde la actividad del chat. Muestra primero totales por fuente, ámbito, período/base y observación; importes y conteos siguen cadenas exactas y se formatean mediante BigInt sin convertirlos a Number. La unidad nativa peso de Finanzas no se etiqueta CLP por suposición.

Expandir detalles muestra grupos de la misma consulta persistida. No descarga todos los registros ni genera otra inferencia. La comparación sólo usa un resultado compatible del backend; una fuente fallida muestra desconocido. El panel conserva datos ante revalidación operativa, pero elimina el resultado si se revoca acceso. Una dimensión null se muestra «Sin valor» y una medida ausente «Desconocido»; el cero conocido sigue siendo cero. El panel y su validador se cargan por intención, con retry local de chunk y descarte al desmontar; no se atribuye una mejora de rendimiento sin medición comparativa. ES/EN, estados inicial/vacío/error y tabla con scroll local para móvil.

## Verificación y pendientes

[Evidencia consolidada](../evidence/nodia-ai-ai31-validation.json), comprobable con `node docs/evidence/scripts/reconcile-nodia-ai-ai31-validation.cjs --check`.

Backend final: 3.248 pruebas en205 archivos y83 casos focales en4 archivos, sin fallos; TypeScript/build/lint sin errores, con tres advertencias históricas. La [evidencia SQL](../evidence/nodia-ai-ai31-sql-validation.json) acredita273 comprobaciones y145 agregados reales en cuatro suites sobre PostgreSQL desechable:57 casos AI-31,147 AI-30,40 AI-14 y29 de observación AI-16. Incluye worker/callbacks reales, recibo único, replay sin recalcular, lectura por dueño/super_admin, aislamiento de chats y revocación; sólo el adaptador de inferencia es sintético. Se preservaron dos errores iniciales de fixture (gasto cero inválido y un regex que confundía correlation_id con relation), corregidos sin cambiar reglas productivas.

[Activación con backup](../evidence/nodia-ai-ai31-lab-activation.json) y [salud final](../evidence/nodia-ai-ai31-final-health.json):886 dist idénticos al compilado probado,949 archivos de paquete, API/worker/Gemini/nginx activos, HTTP200 y0 pendientes;25 migraciones/18 tablas NodiaAI/241 columnas conservadas. No se reinició Gemini ni se alteraron conexiones, credenciales o entorno.

[QA visual](../evidence/nodia-ai-ai31-ui-validation.json) con datos sintéticos en origen aislado:320/390/599/600/900/1440 px, ES/claro y EN/oscuro, expansión, comparación, transporte fallido y revocación. Se corrigió desbordamiento del contenido expandido: documento310px y tabla650px dentro de viewport efectivo310px. Es prueba de navegador/iframe, no de teléfono físico o performance.

Cliente:1.658 pruebas en211 archivos correctas con `npm test -- --maxWorkers 4`. Los intentos de concurrencia sin acotar se conservaron: un timeout de importación fría ya se reprodujo con el grafo anterior al panel y otro afectó un diálogo de atajos ajeno a AI-31; el texto null cambió durante un intento previo. El smoke de rutas resuelve el módulo real antes de verificar acceso/idioma/GET, sin mocks de página, quitar assertions o aumentar timeouts. La ejecución final usa el árbol congelado; TypeScript, lint y build también correctos. El bundle separa ReportObservation10,29kB (4,15kB gzip) y reportSchemas4,73kB (1,83kB gzip) para carga por intención. No constituye una medición de carga fría productiva ni una comparación de performance. No se atribuye una inferencia Gemini nueva a las pruebas SQL o de UI sintéticas. Los gates históricos de archivos/R2 y preparadores de escritura conservan su estado independiente.

Sin tablas, columnas, migraciones, dependencias o rutas nuevas. La ficha permanece draft/unregistered y ADR-056 propuesto.
