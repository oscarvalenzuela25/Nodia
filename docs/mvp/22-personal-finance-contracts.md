# Finanzas personales — contratos para implementación

> Estado: implementado y verificado localmente — revisión documental pendiente
> Fecha: 2026-10-04
> Dependencias: 03-domain-model-erd.md, 20-personal-finance-interview.md, 21-personal-finance-erd.md

## Alcance confirmado y decisiones propuestas

Confirmado: datos por usuario; una categoría por movimiento; grupos muchos a muchos como filtros; una obligación opcional por movimiento; amount inicial en obligación; liquidación con pagos parciales sin intereses; pesos enteros; solo created_at/updated_at. Sin purpose, cancellation_reason, currency, occurred_on, pivotes de pagos, intereses ni recurrencias automáticas.

El usuario autorizó ejecutar el plan de Backend con múltiples agentes. Los contratos siguientes están implementados en Nodia Server y verificados sobre PostgreSQL aislado. La BD configurada del usuario no se modificó y Client implementa estos contratos con validación runtime y pruebas locales. El flujo completo del navegador contra la BD objetivo continúa pendiente. Cambios futuros deben coordinar este documento y sus consumidores; esta implementación no aprueba automáticamente los documentos del producto.

## Representaciones

- IDs y amount: strings decimales positivos sin signo, exponentes, separadores ni decimales. Rango de bigint positivo: 1..9223372036854775807. SUM y saldos pueden exceder el rango de una fila: devolver strings y calcular exactamente, nunca Number sin límite. Neto puede ser negativo y se serializa con signo.
- name/key: strings recortados, 1..255 caracteres. key única por usuario dentro de cada mantenedor; sin unicidad entre tablas diferentes. description: null o string, máximo propuesto 5000 caracteres. No exigir traducciones a nombres escritos por el usuario.
- is_active boolean. Timestamps ISO 8601 de servidor, timestamptz en BD; usuario no puede enviarlos ni modificarlos.
- status: income admite pending/received/cancelled; expense admite pending/paid/cancelled. Solo received/paid afectan los agregados financieros.
- Respuesta de movimiento: campos del ERD más category resumida {id,name,key} y obligation resumida {id,name,type} o null. Sin entidades ORM completas, usuarios anidados ni sesiones.
- Respuesta de obligación: campos del ERD, paid_amount, remaining_amount y initial_movement {id,type,status,amount,category_id}. Campos calculados, sin columnas nuevas. remaining_amount es string para obligación vigente y null si su origen está anulado; la UI muestra Anulada, no un monto ficticio. Resolver initial_movement por dirección opuesta a los pagos según loan/debt, sin purpose ni FK adicional.
- Respuesta de grupo: campos del ERD y category_count. GET por ID añade categorías seleccionadas {id,name,key,is_active}; selección máxima propuesta 100 por grupo. No descargar todos los catálogos.
- Listados: {data: T[], meta:{page,limit,total_items,total_pages}} siguiendo el formato de businesses. Crear/actualizar devuelve la proyección del registro; crear obligación devuelve además el movimiento inicial en la misma respuesta.

## API implementada

Prefijo existente /api/v1. Sin aliases innecesarios. Todas las rutas requieren sesión validada y actúan sobre request.auth.user.id; no depender de nombres de roles ni inventar RBAC administrativo para este módulo. Visibilidad de ruta en Client requiere módulo asignado mediante GuardStrict.

| Recurso | Lecturas | Crear | Actualizar |
|---|---|---|---|
| Movimientos | GET /finance/movements; GET /finance/movements/:id | POST /finance/movements | PUT /finance/movements/:id |
| Categorías | GET /finance/categories; GET /finance/categories/:id | POST /finance/categories | PUT /finance/categories/:id |
| Grupos | GET /finance/category-groups; GET /finance/category-groups/:id | POST /finance/category-groups | PUT /finance/category-groups/:id |
| Obligaciones | GET /finance/obligations; GET /finance/obligations/:id | POST /finance/obligations | PUT /finance/obligations/:id |
| General | GET /finance/overview; GET /finance/overview/categories; GET /finance/overview/category-groups | No aplica | No aplica |

No DELETE físico. Cambios de is_active usan PUT parcial con {is_active:boolean} y ConfirmDialog en Client. Cada controlador declara Swagger/DTOs y delega inmediatamente al caso de uso; @Req solo adapta la identidad autenticada.

### Payloads de creación

| Operación | Campos |
|---|---|
| Categoría | name, key; is_active opcional true |
| Grupo | name, key, category_ids (array, puede ser vacío); is_active opcional true |
| Movimiento ordinario | name, amount, type, status, category_id; obligation_id omitido/null; is_active opcional true |
| Pago de obligación | Mismos campos; obligation_id requerido y dirección de liquidación correcta |
| Obligación | name, key, type loan/debt, amount, category_id para movimiento inicial; description opcional; is_active opcional true |

POST de obligación crea una fila de obligación y su movimiento inicial, con mismo usuario e importe, nombre de la obligación y categoría elegida. Loan genera expense/paid; debt genera income/received. Todo en una transacción y sin dos peticiones del navegador.

POST de movimiento vinculado solo admite liquidación: income para loan, expense para debt. El desembolso inicial se crea mediante POST de obligación; no permitir segundos desembolsos sobre la misma obligación.

### Updates y reglas de saldo implementadas

- DTOs Update permiten solo campos definidos: no user_id, IDs de identidad, timestamps ni saldos calculados. Distinguir campo omitido y null; categoría nunca null.
- Categorías: name/key/is_active. Grupos: name/key/is_active y category_ids; omitido preserva miembros, [] vacía las asociaciones, lista reemplaza atómicamente. Desactivar/reutilizar pivotes existentes.
- Obligaciones: name/key/description/is_active y amount. Type se mantiene desde creación. Cambiar amount actualiza también el importe del movimiento inicial en la misma transacción y no puede quedar por debajo de pagos confirmados. El tipo de obligación no se cambia retroactivamente.
- Movimientos ordinarios: editar nombre/categoría/importe/tipo/estado/activo con combinación type/status válida. Corregir dirección entre income/received y expense/paid mantiene la fase confirmada; no admite volver a pending ni reabrir cancelled. Movimientos de liquidación: nombre/categoría/importe/estado/activo, manteniendo obligación y dirección. Movimiento inicial: nombre/categoría/activo/estado según reglas; editar su importe mediante obligación para mantener coherencia.
- Para cualquier cambio que afecte obligación: lock de la fila de obligación y comprobación de suma con lecturas frescas, con todos los repositorios del manager transaccional. Pending no reserva saldo. Confirmación o aumento de pago no puede exceder pendiente.
- Cancelar pago lo excluye de liquidación; no crear además un inverso. Cancelar origen permitido solo sin pagos confirmados vigentes; conservar registros, y bloquear nuevos pagos sobre origen cancelado. Regla implementada bajo el mismo lock de obligación, sin automatización adicional.
- Archivar movimiento no cambia su validez ni su aporte al saldo de obligación. Categoría/grupo/obligación archivados conservan historia; nuevas operaciones requieren relación activa. Editar un nombre no debe fallar por una relación antigua inactiva que no está siendo reemplazada.

## Filtros, búsqueda y paginación

- page basado en 1, limit default 10 y máximo propuesto 100. Orden estable por created_at DESC,id DESC para movimientos; nombre,id para catálogos. Rechazar lectura ilimitada all=true para Finanzas.
- active=active|inactive|all, default active. Es filtro de visibilidad, independiente de status. Limpiar filtros devuelve active, nunca all. Implementar DTO específico para no heredar defaults peligrosos de PaginationQueryDto.
- q para predicados Ransack públicos: name_cont, key_cont en catálogos, type_eq/status_eq cuando aplica, created_at_gteq/created_at_lt en movimientos. No user_id público ni filtros SQL arbitrarios. Mapa de orden explícito, parametrizado; rechazar combinaciones contradictorias.
- Movimientos: category_ids, category_group_ids, obligation_id como filtros de dominio validados/acotados. Categoría/grupo se combinan por intersección entre filtros; múltiples grupos se combinan por unión de sus categorías. Usar EXISTS/subconsulta equivalente, sin multiplicar filas/conteos/importes por la pivote.
- Selectores remotos reutilizan GET paginado y búsqueda. Al editar, GET por ID hidrata la selección aunque esté fuera de la página; una opción inactiva existente puede mostrarse, no sustituirse silenciosamente.
- IDs de filtros inexistentes o ajenos producen un conjunto vacío, sin consultar ni revelar otro propietario; lectura por ID, escritura o asociación ajena devuelven 404.
- Arrays vacíos de filtros no restringen el conjunto; omission y [] en category_ids de un update de grupo mantienen su semántica de preservar/vaciar, respectivamente.
- Máximo implementado 100 IDs por filtro/selección. Validar envolvente q antes de extraer filtros de dominio conforme a ADR-010.
- Si se incluye período, usar created_at con rango [inicio,fin), instantes ISO UTC. UI construye límites de calendario en America/Santiago, no en zona del host; sin campo ocurrido o fecha de pago.

## Contrato del centro de mando

GET overview devuelve scope normalizado, totals {income_amount,expense_amount,net_amount,movement_count,pending_count,cancelled_count}, counts {categories,category_groups,loans,debts}, obligations {loan_remaining_amount,debt_remaining_amount}. Totales de entrada/salida/neto usan movimientos confirmados del conjunto filtrado; conteos pending/cancelled son informativos, no se suman al dinero.

Las listas/overview comienzan con active. Los totales visibles describen ese filtro: no presentarlos como saldo bancario ni suma de toda la historia. Saldos de obligaciones seleccionadas por su activo se calculan con TODOS sus pagos confirmados, incluyendo pagos archivados y fuera del período visible. Los filtros de movimientos no amputan el historial de amortización. La respuesta scope declara esta diferencia.

En los breakdowns name_cont/key_cont y s buscan/ordenan el catálogo; type_eq/status_eq/created_at_gteq/created_at_lt y filtros de IDs restringen movimientos. En GET overview, name_cont busca movimientos. scope expone los filtros financieros y confirma que no restringen el historial de obligaciones.

GET overview/categories y overview/category-groups son paginados, buscables y devuelven {id,name,key,is_active,movement_count,income_amount,expense_amount,net_amount} con el mismo filtro financiero. Incluir categorías/grupos con cero movimientos, sin convertir cero en vacío. Los grupos pueden solaparse; no sumar sus filas para obtener el total general.

Consultas por conjuntos y límites: no SUM de una página en Client, no N+1 por obligación/categoría, no descargar all=true. Un fallo parcial no se convierte en indicadores cero; error recuperable o respuesta completa.

## Errores y reintentos

- 400: entrada/estado/tipo/filtro inválido; 401: sesión inválida; 404: ID inexistente o ajeno, sin revelar otro propietario; 409: key duplicada, sobrepago, modificación incoherente o conflicto concurrente.
- Mensajes/códigos estables finance:*, compatibles con el filtro de excepciones existente; no filtrar SQL, payloads personales o trazas. Client conserva mensaje permitido de servidor y fallback i18n.
- Mutaciones sin retry automático. Tras timeout no anunciar fallo definitivo ni éxito inventado; conservar formulario y pedir revisar el resultado mediante refetch antes de repetir. El esquema actual no incorpora un registro de idempotencia; FB-22 define el mecanismo mínimo o documenta la limitación sin añadir tablas/campos unilateralmente. Deshabilitar doble envío no garantiza deduplicación entre sesiones.

## Navegación propuesta

- Ruta única /finances/personal, constante PERSONAL_FINANCE_ROUTE en nodia-client/src/modules/finances/constants/routes.ts.
- APP_AVAILABLE_ROUTES en src/modules/generalSettings/pages/Modules/constants/routes.ts importa esa constante. Router utiliza el mismo valor con lazyWithRetry, BaseLayout y GuardStrict modulePath.
- Grupo finances, módulo personal_finance y traducciones de Core se crean/registran de forma idempotente; no asignar el módulo automáticamente a todos los usuarios. Asignación mediante Settings existente.
- Tabs General (inicial), Movimientos, Préstamos y deudas, Categorías, Grupos de categorías. Se puede conservar tab en query string; no rutas CRUD separadas.

## Entrega Backend y evidencia

- Implementación vertical: src/finance-category, finance-category-group, finance-movement, finance-obligation y finance-overview; validación/queries/Swagger compartidos en finance-common.
- 19 operaciones HTTP sobre 11 paths, protegidas por autenticación global en AppModule y consultas personales. Swagger tiene esquemas de request/response; fixtures sintéticos en [finance-api.json](../../nodia-server/test/fixtures/finance-api.json) y [finance-openapi.json](../../nodia-server/test/fixtures/finance-openapi.json).
- Migración incremental [CreatePersonalFinance](../../nodia-server/src/migrations/1791085000000-CreatePersonalFinance.ts): cinco tablas. up/down/up, constraints y equivalencia metadata/migración verificados con synchronize=false. down elimina datos de Finanzas: respaldo obligatorio antes de usarlo.
- Escrituras usan transacciones READ COMMITTED con lock de obligación previo al cálculo; lecturas de saldos y overview usan REPEATABLE READ. Consultas sobre un mismo manager se ejecutan secuencialmente.
- Dinero probado en JSON como strings, incluida suma 18446744073709551614, superior al bigint de una fila.
- npm run build y npm run lint correctos; 369 pruebas/80 archivos pasan. Lint mantiene siete advertencias previas de IA/facturas, ninguna del alcance nuevo.
- npm run test:finance:integration ejecuta Nest compilado y HTTP con DTOs/filtro global reales, PostgreSQL 16 propio y principal sintético. Valida ámbito A/B, rechazo de payload/filtros, pagos/estados, rollback inyectado, carreras de pagos/confirmación/anulación, 2000 movimientos y respaldo/restauración. No prueba login Google ni todo AppModule contra Redis real.
- Registro de navegación invocable con npm run seed:finance, después de migrar la BD objetivo. Es transaccional e idempotente, conserva IDs y no asigna módulos a usuarios; no ejecutado en la BD configurada.
- Deduplicación persistente de POST continúa fuera del esquema. Una respuesta descartada se recuperó por refetch en el ensayo; no se afirma efecto único al reintentar.

## Referencias de implementación verificadas

- Server: src/user estructura vertical; src/business/business.controller.ts adapta request.auth.user.id; src/auth/types/auth.types.ts; src/common/utils/ransack-query.policies.ts; src/config/data-source.ts (CLI synchronize false), src/config/db.config.ts (runtime sincroniza fuera de producción: controlar al probar migraciones).
- Client: src/routes/index.tsx y GuardStrict; APP_AVAILABLE_ROUTES; Users/Users.tsx como referencia visual (su aplicado activo empieza null y usa all=true: no copiar esos comportamientos); Filter; InputSearch; BaseModal; ConfirmDialog; TextInput; selectores con onSearchChange/onLoadMore/hasMore/loadingOptions; UserModal/styles.ts como switch.
- QueryCache existente ya notifica errores HTTP en src/config/reactQuery.ts. Finanzas debe tener un único dueño del toast por operación, evitando duplicación de query/hook/componente.
