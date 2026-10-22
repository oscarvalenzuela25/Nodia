# NodiaAI AI-30 — fuentes e informes restringidos

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Estado técnico: AI-30 cerrado técnicamente en laboratorio privado; registro, motor interno, regresiones y activación verificados. AI-31 conserva resultado público, combinación y presentación.

[Plan45](45-nodia-ai-implementation-plan.md) · [Contratos41](41-nodia-ai-v1-contracts.md) · [ADR-055](../architecture/decisions/ADR-055-nodia-ai-restricted-report-sources.md) · [Ficha](../nodia-ai/knowledge/nodia-ai/features/restricted-reports.md).

## Alcance y contratos internos

Registro tipado de fuentes y motor de una fuente por ejecución. DescribeNodiaAiReportsUseCase comparte ReportDescribeInput y filtra metadatos por NodiaAI y módulos de destino vigentes. RunNodiaAiReportUseCase admite el ReportQueryInput estructural existente, limitado a una fuente y combine=separate; múltiples fuentes y compare_compatible devuelven unsupported_semantics hasta AI-31. No hay endpoints nuevos ni herramientas MCP de informes publicadas.

NodiaAiReportsModule queda integrado en el módulo de herramientas como dependencia interna. El compilador no recibe SQL del cliente: sólo mapeos privados del registro. Los descriptores públicos incluyen fuente, módulo, ámbito, campos/tipos/operadores, dimensiones, relaciones, medidas/unidad/moneda/escala/semántica, grano, base temporal y limitaciones. La versión SHA-256 incluye los mapeos SQL: cambiar una regla invalida consultas/cursores anteriores.

El [catálogo lógico comprobado](../evidence/nodia-ai-ai30-source-catalog.json) contiene once fuentes y sólo descriptores públicos, sin mapeos SQL. Su versión es `49567d402fd1c2e0221e260d8ead518029b8fb0b16ef5b4e03b0a652dd2684b1`; este artefacto documenta el registro interno y no publica herramientas MCP.

El resultado interno de una fuente tiene report_id, catalog_version, source_key/source_alias, scope normalizado, columnas y filas escalares, totals por output_key sobre todo el conjunto, matched_records exacto, period/basis_key efectivos, observed_at, group_page_complete y next_cursor. AI-31 ensambla ReportResult público y sus reglas de procedencias/partial/presentación. Este resultado no es una nueva tabla ni un archivo analítico retenido.

## Fuentes actuales

| Fuente lógica | Grano y medidas | Tiempo y límites |
|---|---|---|
| finance_movements | Movimiento; conteo e importes confirmados, gasto pagado e ingreso recibido | created_at instante; pesos enteros nativos, moneda ISO desconocida; sin proveedor o fecha de compra/pago |
| finance_obligations | Obligación; conteo y principal nominal | created_at instante; pesos nativos, principal no es saldo restante |
| business_invoices | Factura; conteo; invoice_amount descrito pero no ejecutable | created_at legacy sin zona, sin fecha de emisión/pago ni moneda contractual; JSON arbitrario excluido |
| business_products | Producto actual; conteo y stock_units | Instantánea actual; existencia de logs filtra sin multiplicar; precios sin moneda excluidos |
| business_product_logs | Snapshot histórico; conteo | No es venta ni movimiento de stock; no se suman snapshots; ámbito del producto padre actual |
| business_providers | Proveedor comercial; conteo | Relaciones explícitas contactos/productos/facturas como existencias; sin JSON ni teléfonos arbitrarios |
| rental_reservations | Reserva; conteo y total comercial | check_in_on/check_out_on civiles o created_at instante; CLP, total comercial no es cobro |
| rental_payments | Pago; conteo y confirmado | occurred_on civil de la casa; CLP; anulados aportan cero dinero |
| rental_refunds | Devolución; conteo e importe confirmado | Separada de pagos; no se inventa neto ni se suman poblaciones |
| rental_expenses | Gasto; conteo, importe incurrido no anulado y pagado | incurred_on/paid_on civiles; CLP; categoría puede ser null |
| rental_blocks | Bloqueo; conteo | starts_at/ends_at instantes; período por inicio no equivale a solapamiento/disponibilidad/noches |

Ajustes Generales conserva sus lecturas autorizadas. Usuarios, credenciales, sesiones y configuración IA no se convierten en fuentes analíticas por introspección; fuentes adicionales requieren contrato explícito.

## Compilación y exactitud

Sin filtro de actividad explícito se incluyen activos e inactivos; is_active es visibilidad y no anula un efecto financiero. Estado comercial/financiero y actividad son criterios independientes. No se hereda el default visual de listados nativos.

Filtros all/any planos: AND(all) AND OR(any), ausencia o lista vacía sin predicado. Cada campo permite operadores concretos; valores parametrizados, claves mapeadas, imports enteros de 64 bits como cadenas y false/0/null preservados. No se permiten SQL, tabla, join, URL, expresiones recursivas, HAVING ni campos JSON libres.

EXISTS mantiene el grano padre en 1:N. Cada predicado relacionado se evalúa independientemente: neq significa que existe una hija con valor distinto, no que no exista una hija con el valor consultado; all puede satisfacerse con hijas diferentes. La consulta no promete correlación sobre la misma hija o NOT EXISTS.

Un CTE materializado filtrado origina agregados, grupos y matched_records en una única sentencia. Los totales preceden a paginación; dos hechos distintos con igual importe cuentan dos veces. SUM y COUNT se serializan como cadenas exactas, sin Number ni SUM(DISTINCT). Ninguna fuente fallida se transforma en cero. Un conjunto filtrado vacío sí entrega cero conocido y status=empty.

Paginación keyset por dimensiones registradas con NULLS LAST, limit+1 y cursor ligado a consulta, versión, actor/sesión y ámbito. El cursor no concede acceso ni preserva una fotografía entre páginas; cada petición reautoriza, y los datos pueden cambiar entre páginas. No se carga toda la población en Node; SQL tiene el límite temporal de la política50 y los resultados conservan límites de grupos/filtros/colecciones/bytes.

## Autoridad y coherencia

Barrera compartida de autoridad antes de lecturas; sesión actual y asignación NodiaAI más módulo destino. Finanzas reutiliza el ámbito nativo por dueño y super_admin; Reservas reutiliza la casa/colaborador y lock nativo frente a revocación. Las lecturas nativas de productos/facturas/proveedores siguen su acceso global autenticado intencional, acotado por negocio/proveedor pedido; no se introduce aislamiento nuevo. Business y proveedor se bloquean en el orden nativo para validar pertenencia durante la consulta.

Se utiliza READ COMMITTED porque los resultados completos salen de una sentencia y la autorización nativa reconsulta tras bloquear la casa. Se rechaza un manager externo inactivo o con otro aislamiento. No hay llamada generativa, I/O externo ni transacción larga sobre un proveedor.

## Tiempo, unidades y dudas

Un período es [from,to_exclusive), con dimensión y zona IANA explícitas. Instantes requieren offset y orden exacto hasta microsegundos; civiles no se convierten a instantes. En civiles de Reservas se exige la zona configurada de la casa; si falta, needs_clarification. La base mostrada es la dimensión elegida del período, no una etiqueta default engañosa.

Finanzas suma cantidades en pesos enteros conforme22 con unit=peso y currency=null; no declara CLP ni convierte. Facturas no acredita dinero pagado, moneda ni fecha de compra: pedir gasto por proveedor/mes necesita aclarar concepto y base, y una suma no soportada se rechaza. No se completan campos de dominio ausentes para hacer pasar el informe.

## Verificación y entrega

Verificación del 2026-10-17, con fecha de trabajo del cliente:

| Capa | Resultado comprobado |
|---|---|
| Pruebas unitarias Server | 3.202 pruebas correctas en 202 archivos, ejecución final de 108 segundos; 89 casos focales de informes en cuatro archivos, incluidos dentro de ese total |
| Calidad | Tipado de producción y build correctos; Oxlint sin errores y tres advertencias históricas ajenas a esta etapa |
| PostgreSQL real desechable | 147 comprobaciones y 118 consultas del motor, ejecutando las once fuentes y sus mapeos compilados con registros sintéticos; limpieza completada y sin usar la BD configurada |
| Contratos e inventario | 790 hashes comprobados; 44 controladores, 206 handlers y 325 pares método-ruta; no se añaden endpoints |
| Conocimiento compilado | 54 fuentes documentales, 27 excluidas y las mismas 67 lecturas/referencias y 27 fragmentos publicados; release de build `9e57cbe2a469543df6f2d9db5a400e549268fb68012c59c34878ab2b996e2cfd` |
| Regresiones de coordinación | 135 comprobaciones correctas en cuatro suites: AI-14 (40), AI-15 (41), AI-08 (39) y AI-29-R01 (15), sin nueva inferencia |
| Activación del laboratorio | Backup de 284.695 bytes; 882 archivos dist idénticos al compilado probado y 944 archivos de paquete; API/worker activos, salud HTTP200 y cero jobs/intentos/slots pendientes |
| Salud posterior | [Comprobación final](../evidence/nodia-ai-ai30-final-health.json): API, worker, Gemini y Nginx activos; API/Gemini/Client/túnel HTTP200; 25 migraciones, 18 tablas NodiaAI y 241 columnas conservadas, con cero pendientes |

Las pruebas de PostgreSQL comprueban importes iguales, fan-out por membresías/snapshots/pagos, bigint superior al entero seguro de JavaScript, estados financieros, cero/null, filtros parametrizados, rangos y zonas, paginación con total completo y revocación de sesión/módulos/colaboradores. Los mocks de las pruebas unitarias verifican orquestación y contratos; la ejecución SQL desechable comprueba los mapeos y la composición real de Nest por separado.

La [evidencia consolidada](../evidence/nodia-ai-ai30-validation.json) y la [activación del laboratorio](../evidence/nodia-ai-ai30-lab-activation.json) separan pruebas unitarias, SQL real desechable y despliegue. La activación no modifica entorno, dependencias, proveedores o sesiones; no reinicia Gemini ni solicita login, logout o inferencia. No hay nuevas tablas, columnas o migraciones ni escrituras de negocio. La compilación SQL comprobada y el despliegue comparten el árbol dist `cb652d958c15bc8e3f5704ed3c5306538f44562f33ad35be8e4d7398f48a4876`.

Trazabilidad de los escenarios de informes pendientes en la matriz del plan:

| Escenario | Cobertura AI-30 y límite vigente |
|---|---|
| NR-05 | Se aclara o rechaza la ausencia de relación de proveedor, fecha económica o unidad/moneda necesarias; no se inventan campos para responder |
| NR-06 | Grano y agregación verificados con SQL real: movimientos financieros de igual importe cuentan por separado y relaciones 1:N no multiplican hechos; facturas admiten conteo y rechazan suma monetaria sin unidad/moneda contractual |
| NR-07 | La combinación entre fuentes, compatibilidad, procedencia separada, partial y presentación conservan su implementación y aceptación integral en AI-31 |

El siguiente paso es AI-31. No se solicita inferencia a Gemini para probar este motor interno; publicación, resultado público y presentación conservan sus gates explícitos.

Sin cambios visuales, tablas, columnas, migraciones o dependencias. La ficha es draft/unregistered, approval null y ADR-055 propuesto. Las 67 lecturas y 27 fragmentos publicados conservan su alcance; añadir documentación no publica informes ni escrituras.

La [traza cerrada de conocimiento](../evidence/nodia-ai-ai30-knowledge-delta.json) reconstruye el release AI-29-R01 retirando únicamente la nueva ficha excluida y restaurando el orden anterior de source_paths. Se verificaron cinco mutaciones rechazadas y las 53 comprobaciones del compilador; las fichas aprobadas, fragmentos y contratos publicados conservan sus bytes. Los pins de src y dist coinciden con el compilado activado; no se reescribe la evidencia histórica de AI-29.
