# Caja de Negocios — plan de implementación y propuesta visual

> Fecha: 2026-11-17. Estado: **CASH-07 con verificación integral en laboratorio**.
> Rama `codex/business-cash-ledger` desde `origin/development` (`0049b5fc`).
> §1 recoge la solicitud. §§3–6 fijan el contrato V1 para implementación.
> El plan y el [ADR106](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md)
> siguen en revisión. La evidencia de entrega se registra en §16.

> **R02, ampliación2026-11-17:** X para limpiar categoría, + para crearla desde
> formularios y validación de duplicados independiente de mayúsculas/espaciados.
> Quitar la categoría de una factura **retira su egreso** al guardar; esta regla
> expresa sustituye la recomendación anterior que lo impedía. Cierres diarios
> se registran manualmente como ingresos; ventas automáticas fuera de alcance.

[TODO — CASH-001](TODO.md) · [Negocios94](94-business-point-of-sale-and-product-refactor.md)
· [Acceso89](89-module-access-and-user-data-scope.md)
· [Navegación ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md)
· [Ficha candidata Caja](../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md)
· [Producto Negocios](../nodia-ai/knowledge/businesses/README.md).

## 1. Resultado solicitado

Caja permite registrar ingresos y egresos de un negocio y clasificarlos por
categoría. Es un registro operativo de importes: no acredita pagos bancarios,
no calcula impuestos ni constituye por sí mismo una contabilidad de doble
partida. Los cierres de caja se pueden registrar a mano como ingresos; la primera
entrega no incluye un flujo formal de apertura/cierre, arqueo, conciliación
bancaria, cuentas por pagar o integración automática con POS.

| Requisito confirmado | Comportamiento que debe entregar la implementación |
| --- | --- |
| Tab **Caja** dentro de Negocios | Destino `/business/:id?section=cash`, sin nuevo grupo del menú ni permisos derivados de su posición |
| Categorías en Drawer | Crear y administrar nombre/descripción; las mismas categorías sirven para ambos tipos de movimiento |
| Categoría obligatoria por movimiento | Todo ingreso/egreso debe tener una categoría del mismo negocio |
| Filtros arriba a la izquierda | Categoría, rango de fechas y actividad; GET con query params mediante el adaptador Ransack |
| Datos del día inicialmente | Caja comienza en hoy y activos; cambiar el período actualiza tabla y paneles |
| Acciones arriba a la derecha | Agregar ingreso, agregar egreso y gestionar categorías |
| Dos paneles | Cantidad y total de ingresos; cantidad y total de egresos; ambos sobre el conjunto filtrado completo |
| Tabla con buscador propio | Search a la izquierda de la cabecera de tabla; filas con fondo success/error; acciones a la derecha en menú de tres puntos |
| Editar y activar/desactivar | Lápiz dentro del menú; cambio de actividad confirmado y registros activos por defecto |
| Guardar productos desde factura/OCR | Selector opcional de categoría con ayuda; al elegirla se registra un egreso vinculado a esa factura |
| Crear/editar factura manual | Mismo selector opcional y ayuda; primera asignación crea egreso, quitar categoría retira egreso y recategorización conserva un único egreso |
| Limpiar selección | X a la derecha del valor en los selectores de categoría; sólo modifica el borrador hasta guardar el formulario |
| Crear categoría en contexto | + junto al selector de categoría en factura nueva/edición, revisión OCR y formulario de ingreso/egreso; abre modal y selecciona la nueva categoría al crearse |
| Categorías sin duplicación | Mismo negocio: no repetir nombre aunque cambien mayúsculas o espaciados; validación tanto en Drawer como modal rápido |
| Ingresos manuales | Los cierres de caja se agregan a mano como ingresos; sólo las facturas generan egresos automáticamente en esta entrega |
| **Ampliación Overview** | Dos nuevas cards de ingresos y egresos del mes actual, con cantidad y total |

La búsqueda también afecta los paneles de Caja: «valores filtrados de la tabla»
significa todos los registros coincidentes, no únicamente la página visible.
Las cards mensuales de Overview son independientes del filtro del tab Caja.

## 2. Hechos actuales y fronteras a conservar

- [BusinessDetail](../../nodia-client/src/modules/business/pages/BusinessDetail/BusinessDetail.tsx)
  ya selecciona tabs por `section`; [OverviewTab](../../nodia-client/src/modules/business/pages/BusinessDetail/components/OverviewTab/OverviewTab.tsx)
  es la ubicación de las dos cards nuevas. No hay tab ni API Caja implementados.
- [BusinessAction](../../nodia-server/src/business-action/entities/business-action.entity.ts)
  es un catálogo de acciones/permisos; **no es un movimiento financiero**.
  Finanzas personales tiene otro ownership por persona y estados propios;
  no se reutilizarán sus tablas como si fueran de un negocio.
- [Invoice](../../nodia-server/src/invoice/entities/invoice.entity.ts) pertenece
  a un negocio, tiene total entero y folio nullable. La fecha está en
  `data.issue_date`; no existe columna tipada para ella. El folio opcional y
  demás cambios de [94§42](94-business-point-of-sale-and-product-refactor.md#42-precios-de-venta-redondeados-división-local-y-proveedores-ocr--solicitud2026-11-17)
  se preservan.
- [CreateInvoiceUseCase](../../nodia-server/src/invoice/use-case/create-invoice.use-case.ts)
  prepara R2 fuera de SQL y confirma factura/intención de limpieza dentro de
  transacción. `InvoiceService` admite `EntityManager`; se conserva esa frontera.
- [ProductInvoiceImport](../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx)
  guarda hoy factura y lotes de productos mediante peticiones separadas.
  **Ese recorrido no es una transacción integral**. El plan incluye una
  confirmación nativa idempotente; no se resolverá con un POST adicional a Caja.
- [Scope de negocio](../../nodia-server/src/business-access/business-access.ts)
  debe aplicarse antes de paginar/agregar. Las nuevas familias HTTP requieren
  política explícita en [http-module-policy](../../nodia-server/src/authorization/http-module-policy.ts).
- Plan94/R17 mantiene NodiaAI en lectura de ventas/reportes. Una venta
  registrada o su medio «efectivo» no prueba un cobro. Caja no crea ingresos
  automáticos desde ventas ni habilita herramientas IA por esta especificación.

## 3. Reglas de Caja V1

CASH-01 fija los siguientes criterios técnicos para implementación. Las reglas
expresas de la solicitud están en §1. Esta definición técnica deja el documento
y el ADR en revisión.

| Tema | Regla |
| --- | --- |
| Moneda e importe | CLP enteros positivos, de `1` a `9999999999999` por movimiento. En JSON, decimal canónico como string, sin signo, ceros iniciales, exponente ni fracciones. SQL `bigint` por movimiento y suma exacta `numeric`, sin el límite individual. Caja mantiene el monto en pesos enteros |
| Fecha civil | `occurred_on` SQL DATE, fecha gregoriana real `YYYY-MM-DD` en años 0001–9999. El rango incluye los extremos. Día inicial, limpieza y mes toman `America/Santiago` con fechas civiles |
| Categoría | Compartida por ingresos y egresos. Nombre y descripción obligatorios. Nombre visible recortado tras NFKC, 1–120 puntos de código, y descripción recortada, 1–500. Unicidad por negocio según §6.1, incluidas inactivas |
| Actividad de categoría | La inactiva sigue visible en el historial y como selección actual. Se permite guardar la misma categoría de un movimiento vigente. Primera asignación, reasignación y restauración requieren categoría activa. Los movimientos tienen actividad independiente |
| Movimiento manual | Categoría, importe, fecha y descripción recortada de 1–500 puntos de código. Tipo `income` o `expense` inmutable. Activo al crear por defecto. Se permiten edición y cambio de actividad con revisión |
| Movimiento de factura | Egreso con total, fecha y categoría editables desde la factura origen. En Caja, Editar abre esa factura y la acción de actividad sólo cambia el movimiento. La referencia se compone del ID y folio actual. Folio nulo muestra «Sin folio» en Client |
| Actividad y retiro | La factura y su egreso conservan actividad independiente. Retirar una categoría al guardar oculta el egreso incluso con Todos. Restaurar reactiva el mismo ID. Cambiar datos de un egreso vigente conserva su actividad |
| Historia | Sin borrado en UI ni backfill financiero. La factura con un egreso vigente o retirado permanece en su negocio para conservar la relación histórica. Facturas sin historia conservan la política nativa de transferencia |

## 4. Modelo lógico y garantías

| Recurso | Identidad y campos necesarios |
| --- | --- |
| `business_cash_categories` | `id` bigint, `business_id` UUID, `name`, `normalized_name` privado, `description`, `is_active`, versión, autor y fechas de alta/edición |
| `business_cash_movements` | `id` UUID, `business_id` UUID, `category_id` bigint obligatorio, `type`, `amount`, `occurred_on`, `description` nullable sólo para origen factura, `source` manual/invoice, `invoice_id` bigint nullable, `is_active`, `withdrawn_from_invoice`, versión y auditoría |
| Auditoría de movimientos | Apéndice transaccional por movimiento y nueva versión, con negocio, actor, instante, operación y campos de Caja antes/después. Registra alta, modificaciones, actividad, retiro y restauración. Sin copiar archivo, JSON de factura ni datos de inferencia |
| Recibo | Una fila por negocio/actor/`request_key`, con operación, versión de contrato, hash, estado y resultado mínimo según §6.4. El estado de staging se vinculará en CASH-04 con la intención recuperable de `invoice_uploads` |
| Facturas | Columna de versión inicializada a 1 para facturas nuevas e históricas, sin crear movimientos. Todos los escritores que cambian la fila incrementan la versión. Cambiar la categoría vigente también incrementa la versión de factura |

- Usar FK compuestas categoría/negocio y factura/negocio. La clave de factura
  es única en movimientos de origen factura, incluso inactivos o retirados.
  Constraints restringen tipo, importe, origen, nulabilidad y retiro. Sólo
  origen factura admite `invoice_id` y retiro. Ese origen siempre es egreso.
- Versiones enteras positivas de 32 bits. Altas comienzan en 1 y cambios
  efectivos incrementan la revisión. Guardar sin cambios con revisión vigente confirma
  el resultado existente, sin incrementar versión ni insertar otra auditoría.
- Indexar inicialmente negocio/actividad/fecha/ID y negocio/categoría/fecha/ID
  para movimientos vigentes, además de las claves únicas y FKs. Guiar índices
  de búsqueda adicionales con EXPLAIN y volumen sintético en CASH-03.
- Actor y negocio se resuelven en Server. El cliente no escribe propietario,
  versión resultante, origen, ID de factura en Caja, clave canónica o retiro.

## 5. Contrato HTTP V1 de Caja

Categorías y lectura de recibos corresponden a CASH-02. Movimientos
corresponden a CASH-03 y Facturas/OCR a CASH-04. Los nuevos
controladores y alias listados se registran explícitamente bajo el destino
`/business` en la política HTTP. Todas las peticiones requieren sesión y
autorización al negocio actual, como propietario, colaborador activo o
super_admin. Un recurso ajeno y uno inexistente comparten respuesta 404.
El acceso a dos negocios no autoriza una referencia cruzada. Ver
[plan89](89-module-access-and-user-data-scope.md#contratos-y-barreras) y
[ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md).

| Método y ruta | Entrada y resultado |
| --- | --- |
| GET `/business-cash-categories` | `page`, `limit`, `q` de categorías. Devuelve `{data: Category[], meta}` |
| GET `/business-cash-categories/:id` | Detalle de categoría autorizada, incluso inactiva |
| POST `/business-cash-categories` | Cuerpo `{request_key, business_id, name, description, is_active?}`. 201 y resultado identificado |
| PUT `/business-cash-categories/:id` | Cuerpo `{request_key, expected_version, name?, description?, is_active?}`. Al menos un campo editable. 200 y resultado identificado |
| GET `/business-cash-movements` | `page`, `limit`, `q` de movimientos. Devuelve `{data: Movement[], meta, summary}` |
| GET `/business-cash-movements/monthly-summary?business_id=…` | Sólo negocio. Devuelve `{period: {from, to, time_zone}, summary}` para activos del mes civil actual. Ruta estática antes de `:id` |
| GET `/business-cash-movements/:id` | Detalle vigente, incluso inactivo. Retirados devuelven 404 |
| POST `/business-cash-movements` | Cuerpo `{request_key, business_id, type, category_id, amount, occurred_on, description, is_active?}`. Tipo y origen validados por Server, origen manual. 201 y resultado identificado |
| PUT `/business-cash-movements/:id` | Cuerpo `{request_key, expected_version, category_id?, amount?, occurred_on?, description?, is_active?}`. Al menos un campo editable. Para vinculados sólo `is_active`. 200 y resultado identificado |
| GET `/businesses/:businessId/cash-mutation-requests/:key` | Recibo del actor y negocio actuales, incluidas operaciones de factura descritas en §6.2. Respuesta 200 con estado y `Cache-Control: no-store` |

En creación, `is_active` omitido implica `true`. En PUT parcial los campos
omitidos se conservan. Los campos editables de Caja de estas rutas no aceptan
`null` ni strings en lugar de booleanos JSON. Campos fuera del DTO se rechazan.
`business_id` y `request_key` son UUID, igual que el ID de movimiento.
IDs bigint viajan como strings de dígitos, de `1` a `9223372036854775807`
sin ceros iniciales. Los parámetros de ruta se validan antes de consultar.
Los PUT resuelven el negocio por la fila y el recibo conserva ese ámbito.

**Proyecciones**

- `Category`: `{id, business_id, name, description, is_active, version}`.
- `Movement`: `{id, business_id, category_id, category: {id, name, is_active}, type, amount, occurred_on, description, is_active, version, source, invoice}`.
  `invoice` es null en manuales y `{id, code}` en originados por factura.
  `code` puede ser null. En origen factura `description` es null. Una categoría
  histórica inactiva llega en la proyección para poder mostrarla al editar.
- `summary`: `{currency: "CLP", income: {count, total_amount}, expense: {count, total_amount}}`.
  Los conteos y `meta` se proyectan como enteros JSON seguros, con comprobación
  explícita antes de convertir. Los totales son strings, incluido `"0"`.
  `period.from` y `period.to` son fechas civiles inclusivas y `time_zone` es
  `"America/Santiago"`. Error de lectura conserva su condición de error.

**Filtros y orden**

Mantener el adaptador Ransack, con DTOs cerrados y política por recurso
según [ADR010](../architecture/decisions/ADR-010-ransack-query-policies.md).
Abrir `q` sólo tras validar la envolvente. `q[business_id_eq]` UUID es
obligatorio. Las listas admiten `page` 1–100000, `limit` 1–100, defaults
1/10 como el resto de Negocios y el tope de Ventas. No admiten `all`,
`includes` ni `size`. Arrays, claves repetidas, null, operadores no listados,
orden vacío y booleanos distintos de `true`/`false` producen 400.

| Recurso | Campos de `q` además de negocio | Orden `q[s]` |
| --- | --- | --- |
| Categorías | `is_active_eq`, `name_cont` literal recortado, hasta 255 puntos de código | `name asc` o `name desc`, mapeado a la clave de nombre de Server, con ID asc de desempate. Default `name asc` |
| Movimientos | `category_id_eq`, `occurred_on_gteq`, `occurred_on_lteq`, `is_active_eq`, `search` literal hasta 255 puntos de código, recortado | `occurred_on asc`, `occurred_on desc`, `amount asc` o `amount desc`. ID en la misma dirección como desempate. Default `occurred_on desc` |

Un rango puede tener un solo extremo. Si se envían ambos, desde ≤ hasta.
`q[search]` aplica OR entre descripción, nombre de categoría y folio/ID de
factura como texto. Escapar `%`, `_` y `!` como literales con parámetros y
agrupar el OR dentro de los filtros de negocio. Una búsqueda vacía tras
recortar se omite. El filtro por un ID válido de categoría ajena o ausente
devuelve cero coincidencias en un negocio autorizado. La asignación a ese ID sí
falla con 404. Client codifica comas como `%2C` para el parser `qs` con
`comma:true` y conserva `false` en la serialización de actividad.

La pantalla usa `ActiveStatusSelect` y envía hoy en ambos extremos y activo
al entrar o limpiar filtros.
Todos omite `is_active_eq`. Una lectura HTTP sin filtro de fecha cubre todo el
período. La lista de selección para una asignación nueva pide sólo activas.
el filtro de movimientos puede buscar categorías activas e inactivas. Aplicar,
quitar filtros o cambiar el buscador reinicia página y conserva los demás
criterios aplicados. Reabrir o redimensionar conserva filtros y borrador.

Usar el mismo conjunto filtrado y autorizado para página, metadatos y totales
en **una sentencia SQL**. El predicado excluye retirados tanto en página como
en count/sum. El agregado se calcula antes de paginar y sigue disponible al
pedir una página sin filas. Usar un CTE equivalente al
[precedente de Ventas](../../nodia-server/src/sale/use-case/read-sales.use-case.ts)
y reutilizar la agregación para Overview, que aplica activos y mes de Santiago
con una única fecha civil de referencia del Server. Ejemplo sintético vacío:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 10, "total_items": 0, "total_pages": 0 },
  "summary": {
    "currency": "CLP",
    "income": { "count": 0, "total_amount": "0" },
    "expense": { "count": 0, "total_amount": "0" }
  }
}
```

**Errores públicos**

| HTTP | Contrato para Client |
| --- | --- |
| 400 | DTO, asociaciones mal formadas, campo inmutable o comando vacío. Para regla de importe/fecha de vínculo usar `business:cash_invoice_invalid_amount` / `business:cash_invoice_invalid_date`. Mantener el envelope común de validación |
| 401 / 403 | Sesión no válida o falta de destino activo/asignado. Usar errores de Auth/ModuleAccess existentes |
| 404 | `business:resource_not_found` en negocio, instancia o asociación ausente/ajena. Un recibo válido ausente dentro del negocio visible se reporta `unconfirmed` |
| 409 | `business:cash_category_name_exists`, `business:cash_category_inactive`, `business:cash_version_conflict`, `business:cash_request_key_conflict`, `business:cash_invoice_review_required`, `business:cash_invoice_transfer_not_allowed`. Los conflictos de producto conservan el contrato de Productos |
| 413 | Límite de bytes multipart. El contenido/MIME incompatible conserva la validación 400 de Facturas |
| 503 | Dependencia temporalmente indisponible antes de poder confirmar el resultado. Tras incertidumbre consultar recibo y conservar intención/borrador |

Los códigos de dominio se entregan como `message` traducible, sin incluir
mensajes SQL/SDK ni datos ajenos. Un 409 de revisión exige leer el recurso
actual, presentar diferencias y confirmar otra intención. El error conserva
el borrador y se notifica en ES/EN.

## 6. Facturas, OCR e idempotencia

Semántica de `cash_category_id`:

| Situación | Resultado esperado |
| --- | --- |
| Alta sin categoría | Factura sin egreso |
| Edición sin enviar el campo | Conserva vínculo y categoría. Si el vínculo está vigente, un cambio de total o fecha sincroniza el mismo egreso mediante guardado identificado y revisado |
| Primera asignación válida | Crea exactamente un egreso con total/fecha de esa factura |
| Asignación repetida o reintento | Mismo egreso, sin duplicado |
| Cambio de categoría de egreso vigente | Mismo ID de egreso, nueva categoría, actividad intacta |
| Null explícito sin vínculo o con vínculo ya retirado | Conserva la ausencia de un egreso vigente |
| Null explícito con egreso vigente — R02 | Retira ese egreso al guardar. Sale de lista, conteos y totales diarios/mensuales, también con actividad Todos |
| Categoría después de un retiro | Restaura el mismo ID como egreso vigente activo, con importe/fecha actuales; no duplica |
| Categoría ajena/inactiva nueva o fecha/importe inválidos al crear/mantener/restaurar egreso vigente | Falla la escritura completa; conserva borrador y estado anterior. Sin categoría o al retirarla, aplicar validación nativa de factura, incluido total0 |

El selector se llama **Categoría de egreso**, tiene icono de ayuda accesible y
texto: «Opcional. Con categoría, esta factura registra un egreso por su total y
fecha. Cambiarla conserva el mismo egreso; quitarla retira el egreso al guardar».
Con vínculo existente se muestra esa condición explícitamente y, al limpiar,
la consecuencia «Al guardar se retirará el egreso de Caja». X sólo modifica el
borrador; cancelar conserva la factura/egreso actuales. No generar/retirar egreso
al elegir en el input, crear categoría, analizar OCR, abrir modal o cambiar filtro.

`cash_category_id` omitido en update conserva el efecto vigente; `null` explícito
lo retira. Los formularios convierten selección vacía en null intencional, sin
confundirla con ausencia del campo. El recibo/fingerprint incluye esa intención.
Al retirar, se conserva el último `category_id` en el registro auditado, con
`withdrawn_from_invoice=true`; la proyección vigente de factura muestra categoría
null. Listas, detalle operativo y agregados Caja lo excluyen. Nueva asignación
valida una categoría activa y restaura ese registro con `withdrawn_from_invoice=false`
e `is_active=true`. Cambiar categoría de un egreso vigente inactivo conserva
su actividad, como antes. Serializar estos casos contra cambios concurrentes de
categoría/importe/actividad y guardar factura/efecto/recibo en una transacción.
El total positivo y fecha válida son requisitos del egreso vigente; retirar la
categoría de una factura de total0 no debe quedar bloqueado por esa regla.

La retirada lógica conserva la auditoría y cumple la eliminación observable
pedida. La implementación de esta regla corresponde a CASH-04.

### 6.1. Nombre único y creación rápida de categorías — R02

La clave canónica aplica NFKC, quita `\p{White_Space}` y U+FEFF en cualquier
posición, convierte a minúsculas con `toLocaleLowerCase('es')` y aplica NFKC
final. Quitar espacios primero mantiene equivalentes `ΟΣ` y `Ο Σ` al evaluar
la sigma final. Los acentos se conservan. `Mercadería`, ` MERCADERÍA ` y
`Mer ca dería` producen la misma clave. El nombre visible conserva separación
legible. Rechazar clave vacía, más de 1024 bytes UTF-8, NUL y sustitutos Unicode
inválidos. Validar texto también en Server aunque Client haga comprobaciones
preventivas.

Persistir clave privada calculada por Server y constraint unique por negocio
con colación determinista `C`. Conflicto concurrente o categoría inactiva con
el mismo nombre devuelve 409 con
mensaje traducible `business:cash_category_name_exists`. El modal conserva
nombre/descripción y permite corregir; no seleccionar ni reactivar una categoría
ajena/inactiva silenciosamente. Drawer y modal usan el mismo caso de uso.

El + es una acción separada del selector, con nombre accesible «Crear categoría».
Crear confirma sólo la categoría; seleccionarla en el formulario origen no guarda
factura/movimiento ni genera egreso. La categoría creada permanece aunque luego
se cancele el formulario principal. Conservar borrador completo, errores y foco;
al volver tras crear, seleccionar por ID la opción retornada sin descargar todo
el catálogo. Al cancelar/error no cambiar la selección anterior. Un solo overlay
activo: suspender/restaurar el editor de movimiento al abrir creación rápida,
sin dos focus traps ni descarte del borrador. No agregar + a filtros de consulta.

La selección reutiliza `SelectSingleInput` y la X es un control hermano del
disparador, con nombre accesible y área táctil de 44 px. Enter/Espacio limpia
sin abrir la lista y devuelve el foco al disparador al desaparecer la X. El
control interno actual es más pequeño y comparte el evento del disparador.
En factura/OCR limpia el campo opcional. En ingreso/egreso manual permite
limpiar el borrador pero guardar exige otra categoría.
Acotar esta entrega a los selectores de categoría; no se cambia globalmente la
semántica de actividad u otros selects de la aplicación.

### 6.2. Factura manual, revisiones y compatibilidad

Conservar `POST /invoices`, `PUT /invoices/:id` parcial y sus alias
`/invoice`. Identificar el contrato nuevo con `request_key` UUID en el
cuerpo. El POST acepta JSON o multipart existente con un archivo opcional.
El PUT recibe JSON y exige `expected_version` junto a `request_key`.
En multipart, `cash_category_id` acepta el ID decimal o el token exacto
`null`. En JSON acepta string decimal o null. El campo ausente permanece ausente.
El valor vacío del selector se serializa como null. La API rechaza `""`.
`cash_category_id` sin `request_key`, o `expected_version` sin intención
identificada, produce 400. Un PUT con `request_key` y sin revisión, o un POST
que envíe `expected_version`, también produce 400.

Las lecturas nativas de factura incorporan `version` positiva y
`cash_expense: {movement_id, category: {id, name, is_active}} | null`.
Se proyecta en consulta por conjunto. El valor es null si no hay egreso
vigente. `is_active` dentro de `category` describe la categoría. La
actividad del egreso se consulta en Caja y se cambia con su propia versión.
Mutaciones identificadas devuelven recibo según §6.4. Las no identificadas
conservan la forma de respuesta anterior. El editor obtiene la versión de la
lectura que mostró y elige la clave al confirmar.

Los campos nativos de factura continúan conservando nombre y significado. Los
DTO de escritura identificada validan estrictamente los campos presentes,
incluido `total_amount` entero 0–2147483647, código nullable recortado de
hasta 255, proveedor nullable y `data` como objeto. Enviar `data` reemplaza
el objeto completo como en la ruta actual. Omitirlo lo conserva. Un archivo
nuevo usa el staging nativo. Referencias nativas a almacenamiento siguen
sujetas al contrato existente de Facturas. En la confirmación OCR el archivo
se obtiene exclusivamente de la parte `file`. El PUT identificado mantiene
el negocio de origen. Enviar otro `business_id` sin historia de egreso
produce 400 en ese contrato. El cliente anterior puede trasladar una factura sin
historia de egreso según el contrato previo. Si existe historia, vigente o
retirada, el traslado devuelve 409 aun para super_admin.

El [DTO parcial vigente](../../nodia-server/src/invoice/dto/update-invoice.dto.ts)
hereda defaults de creación. Materializar el DTO con sólo `code` también
materializa total 0, ruta vacía, datos vacíos y activo true. CASH-04 debe
capturar presencia antes de transformaciones/defaults para todo escritor
nativo, conservar campos omitidos y calcular el candidato efectivo bajo lock.
Validar fecha de egreso sólo desde `data.issue_date` persistida/candidata. El
fallback de fecha de creación usado por listados de Facturas queda fuera de
esta decisión. Guardado sin vínculo y retiro explícito admiten total 0 y se
rigen por la validación nativa cuando no hay egreso vigente.

La comprobación se aplica en el punto común antes de guardar la factura y
después de adquirir su lock. Cualquier cliente legado que trate de cambiar
total o fecha civil efectiva de un egreso vigente recibe 409
`business:cash_invoice_review_required`. Omitir el campo de categoría en un
PUT identificado permite sincronizar total/fecha ya revisados conforme a la
matriz. El formulario muestra el efecto vigente y el cambio de total/fecha o
el retiro antes de confirmar. Actualizar metadatos compatibles, incluido
`invoice.is_active`, conserva el egreso. La revisión se compara antes de
escribir cualquier efecto y después de comprobar si ya existe un recibo igual.

**NodiaAI y compatibilidad de propuestas.** La procedencia se fija desde el
coordinador de Server al entrar al escritor común. El body, `data`, la
presencia de un manager, super_admin o el modo/proveedor carecen de esa
autoridad. Comprobar elegibilidad al preparar la propuesta y al preparar su
archivo. Al aplicar, releer el vínculo bajo lock. Bloquear
cambios a monto/fecha de egreso vigente, incluido inactivo, y traslado con
cualquier historia de egreso. Comparar valores efectivos: reemplazar `data`
y perder `issue_date` cuenta como cambio. Las propuestas previas
incompatibles reciben `nodia_ai:preconditions_changed` del ciclo de ejecución
existente, con orientación al editor manual donde corresponda y sin
reanudación. Mantener forma/hash/recibos firmados y proyecciones antiguas.
Operaciones sin efecto de Caja conservan su alcance, sin publicar campos de
Caja como contexto o herramientas. Aplicar también §26 de
[Negocios94](94-business-point-of-sale-and-product-refactor.md).

### 6.3. Confirmación de productos desde OCR

`POST /invoices/ocr-confirmations` y alias `/invoice/ocr-confirmations`.
Recibe exactamente una parte `command` JSON UTF-8 de hasta 1 MiB y una parte
`file` de hasta 10 MiB, con el validador actual PDF/PNG/JPEG/WebP por contenido.
Aplicar límites al parser multipart antes de materializar datos y rechazar
partes extra o repetidas antes de staging.
`command` contiene `{request_key, business_id, invoice, items}`.
`invoice` admite `{provider_id?, code?, total_amount, issue_date?, cash_category_id?}`,
con proveedor/folio/categoría/fecha opcionales y null admitido. El total sigue
el rango entero de Facturas. La factura nueva queda activa. El archivo, la
ruta y los metadatos de revisión persistidos se resuelven en Server.
Si el OCR carece de fecha, conservar esa ausencia en la revisión y pedir
fecha civil si se asigna categoría. Se mantiene el default de hoy del
formulario manual de factura, que es otro recorrido.

`items` tiene 1–500 filas. El límite de filas y bytes acota validación y
duración de una operación SQL indivisible. Rechazar exceso antes de R2.
Cada fila tiene `kind`, `line` y datos de catálogo según la tabla.
`line` conserva `{invoice_code, name, alias, alias_reviewed, cost_price, quantity}`
revisados. `invoice_code` admite null. El alias revisado es texto no vacío
y `alias_reviewed` es true, como exige la revisión actual. Cantidad es un
número finito no negativo y puede ser fraccionaria. El costo de la línea es
entero entre 0 y 2147483647, como los precios de Productos. A partir de estas
filas, Server deriva `items_count` y `extracted_items` compatibles con la
revisión OCR actual. Cantidad pertenece al snapshot, sin transformarla en
stock ni activar una actualización de inventario adicional.

| `kind` | Campos de la fila y regla de escritura |
| --- | --- |
| `create` | `product: {code, name, alias, cost_price, cost_price_tax, sale_price, is_active}`. Server añade negocio y proveedor de factura, con `has_stock: true` |
| `update` | `product_id` bigint, `expected_version`, y el mismo objeto `product`. Actualiza los campos enviados por el flujo automático y el proveedor de factura. Conserva `has_stock` y demás campos ajenos |
| `manual_match` | `product_id` bigint, `expected_version`, `changes` no vacío con sólo `code`, `name`, `alias`, `cost_price`, `cost_price_tax`, `sale_price` seleccionados. Conserva los demás campos, incluido proveedor, actividad y disponibilidad |

Cuando el catálogo recibe `name`, `alias` o `cost_price`, su valor normalizado
debe coincidir con el de `line`. `invoice_code` conserva la referencia de la
factura y puede diferir del código de catálogo en un vínculo manual. Server
deriva el destino y `selected_update_fields` de la fila validada.

En este flujo de alta, el código de catálogo es obligatorio. Para ediciones
se conserva la semántica de código nullable de Productos. Nombre, códigos y
alias de catálogo se acotan a 255 caracteres. Los campos de catálogo están
sujetos a [Productos](../../nodia-server/src/product/dto/create-product.dto.ts)
y al redondeo de venta del [plan94 §42](94-business-point-of-sale-and-product-refactor.md#42-precios-de-venta-redondeados-división-local-y-proveedores-ocr--solicitud2026-11-17).
Mostrar valores normalizados antes de confirmar. Rechazar identificadores o
versiones inválidas, IDs destino repetidos y códigos de catálogo no vacíos
repetidos en las filas revisadas, comparados tras trim y minúsculas, antes de
staging. Revalidar estado, pertenencia,
unicidad y CAS con los locks en SQL. Reutilizar las validaciones y casos de
uso nativos con el mismo manager, manteniendo los campos no seleccionados y
los logs. `use_ocr` sigue controlando sólo el selector. No aceptar caminos
R2, respuestas de inferencia como autorización o campos fuera del DTO.

El resultado confirmado registra factura, filas de producto, logs, egreso
opcional y auditoría/recibo en una única transacción. La pantalla migra al
endpoint compuesto para toda confirmación, con o sin categoría. Las rutas
antiguas conservan sus contratos separados. Si el endpoint compuesto falla,
la UI conserva el borrador y no vuelve a las tres peticiones ni repite el
análisis. La ruta y el selector OCR se habilitan juntos tras los gates de
CASH-04 y CASH-06.

### 6.4. Recibos, archivos y orden de locks

**Identidad y respuesta.** Aplicar el precedente de
[mutación de Ventas](../../nodia-server/src/sale/use-case/mutate-sale.use-case.ts)
para la identidad `(business_id, actor_id, request_key)` y resolverla antes
del CAS. El hash fijo v1 cubre operación, destino, revisión esperada, comando
normalizado y, si aplica, SHA-256 de los bytes de archivo y su tipo validado.
Distinguir campos omitidos de null explícito en updates, excluir la propia
clave, ruta y metadata interna, conservar el orden de las filas. Derivar
actor/ámbito de sesión y recurso. Canonicalizar propiedades de objetos, IDs,
textos y defaults del comando mediante la misma función de validación previa
en cada intento. Resolver el recibo con la autoridad actual antes de revisar
CAS, categoría o estado del producto para un efecto nuevo. Una clave
vinculada a otro hash u operación devuelve 409.
Al confirmar otra intención después de un error definitivo se usa nueva clave.

La respuesta exitosa identificada es
`{request_key, status: "committed", operation, result}`. Las operaciones son
`category_create`, `category_update`, `movement_create`, `movement_update`,
`invoice_create`, `invoice_update` e `invoice_ocr_confirm`. El resultado
de categorías es `{category: Category}` y el de movimientos `{movement: Movement}`
según §5. Facturas devuelven `{invoice_id, invoice_version, cash_movement_id}`,
con ID de movimiento null si no queda vigente. OCR añade `products` en orden
de las filas, con `{id, version}` por producto. El recibo histórico devuelve
los mismos datos confirmados, no el estado de una edición posterior. Para
mostrar datos actuales se vuelve a consultar el recurso.

| Estado en GET | Semántica y recuperación |
| --- | --- |
| `unconfirmed` | Sólo `{request_key, status}`. Ausencia de recibo visible, sin prueba de rollback. Conservar clave y borrador, volver a consultar o reenviar la misma intención exacta |
| `processing` | `{request_key, status, operation}`. Otro intento mantiene la concesión. POST/PUT igual devuelve 202 con esa misma forma, sin ejecutar otra vez |
| `committed` | Devuelve el recibo indicado arriba. POST/PUT igual recupera recibo y código de éxito original, 201 para altas/OCR o 200 para edición |
| `rejected` | `{request_key, status, operation, error: {status_code, message}}`. Fallo definitivo confirmado sin efectos. Reenvío igual devuelve el mismo error público |
| `retryable` | `{request_key, status, operation}`. Fallo transitorio comprobado o concesión vencida. Autoriza reintento explícito del mismo comando con la misma clave, bajo un nuevo intento identificado |

GET comprueba sesión, módulo y negocio actuales incluso para recibos previos.
Sólo el actor original puede recuperarlos, también si fue super_admin. Otra
persona dentro de un negocio visible recibe `unconfirmed` para esa clave.
Mantener identidad y resultado durante la conservación del registro asociado.
Una eventual poda de payload exige mantener el marcador de deduplicación y
su criterio de recuperación. V1 no incluye una purga que vuelva reutilizable
una clave ya consumida.

**Staging y resultado incierto.** Reservar en transacción corta y autorizada
la identidad/hash y un intento con concesión de 120 s según reloj SQL.
Antes de PUT a R2, persistir `invoice_uploads` para una clave privada de ese
intento y validar archivo. El límite actual de PUT R2 es 60 s y la limpieza
conserva la gracia nativa de 10 min. Confirmar SQL sólo si el recibo sigue
perteneciendo al intento y la intención de archivo está vigente, preparada y
sin limpieza iniciada. Consumirla en el commit de factura+efectos+recibo.
Liberar toda transacción antes de R2. Revalidar autoridad antes de reservar y
dentro de la confirmación. Tras expiración, un reintento reclama el recibo
bajo lock y usa un intento y clave de archivo nuevos. El anterior queda
cercado y su intención se reconcilia. Comprobar el cercado también antes de
sellar el estado terminal, para evitar que un intento viejo sobrescriba al
nuevo. Una excepción de COMMIT no marca rechazo ni limpia a ciegas. Releer
primero el recibo y la pertenencia del archivo. El worker reutiliza el patrón
[de recuperación de Facturas](../../nodia-server/src/invoice/use-case/recover-invoice-uploads.use-case.ts),
comprueba adjunto persistido y conserva protección frente a un PUT tardío.
El recibo público sólo expone su proyección. Client conserva el comando y
archivo de la intención mientras está pendiente y puede retener en sesión
únicamente la identidad mínima para releer el recibo tras recargar. Si no
dispone del comando/archivo original, permite recuperar el estado y exige
reconstruir la misma intención para reenviar con esa clave.

**Orden de persistencia.** Para operaciones que comparten recursos usar
`READ COMMITTED`, el mismo manager y el siguiente orden, omitiendo filas
que la operación no toca:

1. Barrera de autoridad común SHARE, actor/sesión actuales y revalidación de
   módulo destino `/business` con el manager. Bloquear todos los negocios
   por UUID ascendente FOR SHARE y releer la pertenencia después, en otra
   sentencia. Reutilizar el patrón [sale-authority](../../nodia-server/src/sale/sale-authority.ts).
2. Recibo propio FOR UPDATE y, si el intento nativo staged tiene archivo,
   su intención privada FOR UPDATE. El recolector toma sólo su intención,
   libera SQL antes de R2 y no adquiere locks de factura/negocio mientras la
   retiene. Los cercados de ejecución/archivo conversacionales siguen en su
   propio protocolo y no comparten estas intenciones.
3. Proveedores requeridos por ID bigint ascendente FOR SHARE, facturas por
   ID ascendente FOR UPDATE, productos existentes por ID bigint ascendente
   FOR UPDATE. Las facturas nuevas se insertan en el paso 5. Si se leyeron referencias
   para fijar el orden, comprobarlas tras bloquear la entidad y devolver
   conflicto si cambiaron. Los escritores de productos que hoy bloquean
   producto antes de negocio/proveedor deben alinearse antes de habilitar
   la confirmación compuesta. Comprobar productores de logs y otros
   escritores en la misma matriz de concurrencia.
4. Categorías por ID ascendente FOR SHARE para asignar, FOR UPDATE si el
   comando cambia esa categoría. Movimientos existentes por UUID ascendente
   FOR UPDATE. Desactivar categoría sólo toma su fila, sin recorrer
   movimientos. Para actividad de un movimiento de factura, resolver y
   bloquear primero su factura, y releer origen y estado tras el lock.
   Ningún escritor de movimientos toma luego un lock de factura.
5. Ejecutar cambios, logs y auditoría. Confirmar resultado del recibo y
   consumir la intención del archivo en el mismo commit. El rechazo
   definitivo posterior al rollback se registra en una transacción corta,
   sólo por el intento vigente.

En SQL usar los tiempos de autoridad del repositorio (2 s de lock y hasta
5 s por sentencia). Serializar alta simultánea por factura con su lock y la
restricción única. Los ids de los productos a bloquear se conocen antes
de aplicar cambios. Las lecturas de Caja revalidan la autoridad con los
locks comunes y usan una sola sentencia para su snapshot de datos.

## 7. Criterios de UI y responsive

Conservar el shell/theme/tipografía Nodia y `PageContent`, sin doble padding.
Espaciados de panel24px vertical/16px horizontal; tokens success/error con alpha
sutil en filas, sin depender sólo del color. Mismo tratamiento al pasar el mouse,
en oscuro, en selección/foco y para registros inactivos.

Orden de Caja:

1. Barra superior: Filter a la izquierda; Ingreso/Egreso y Categorías a la derecha.
   Selección aplicada visible: hoy/rango, categoría y estado.
2. Dos paneles iguales: etiqueta, total CLP y cantidad; contexto del período.
3. Tabla: buscador arriba a la izquierda; columnas fecha, tipo, descripción/origen,
   categoría, importe, actividad y acciones. `⋮` abre Editar/Activar/Desactivar;
   confirmación de estado antes de escribir. En vinculados, Editar abre el
   formulario de la factura origen por ID estable.
4. Paginado fuera del scroll; tabla desde sm minWidth650. En xs usar tarjetas de
   registro con tipo textual/fondo semántico y las mismas acciones/datos/consulta.

Drawer de categorías: cabecera/cierre, buscador y actividad, listado con nombre y
descripción, edición inline o formulario dentro del mismo Drawer. No anidar
modales que compitan por el foco. Crear, editar y cambiar actividad con feedback
Sileo ES/EN; error conserva campos y permite reintento. La propuesta visual debe
mostrar de forma directa el Drawer y el modal de creación rápida, además del
recorrido desde + en los formularios; no dejar esos diseños sólo implícitos.

Formulario de movimiento: tipo visible, categoría, importe CLP, fecha,
descripción y tarjeta Activo al final; tipo inicial según botón Ingreso/Egreso.
Inputs compartidos, React Hook Form/Zod y switch patrón UserModal. Móvil acciones
principales de ancho completo, objetivos44px y selector de sección existente;
drawer ocupa el ancho disponible sin perder borrador al redimensionar.
Cada selector de categoría de registro incorpora X y botón +; reservar ancho
para ambos sin aplastar el texto en320px y mantener ayuda accesible.
Navegar al tab por `section=cash` y conservar los destinos actuales. Al añadir
la sección, preservar o reemplazar por nombres los índices que hoy usa Overview.

Overview: añadir **Ingresos del mes** y **Egresos del mes** como cards del mismo
lenguaje de las actuales, cada una con cantidad y total; subtítulo del mes/año.
Se muestran sólo movimientos activos del negocio en ese período; no sumar
facturas además de sus movimientos ni confundir con ventas registradas.

Estados remotos futuros: Boneyard sólo carga inicial informativa; revalidación
mantiene contenido con soft loading. Controles bloqueados durante su petición,
vacío diferenciado de error, Alert+reintentar y toast. Fallos de escritura nunca
cierran editor ni descartan borrador. Query keys incluyen actor/negocio/filtros;
invalidar Caja y cards mensuales tras efectos, sin vaciar otras secciones.

La [fuente editable de la maqueta](../features/businesses/cash-ledger-preview.fragment.html)
se conserva como fragmento HTML de propuesta, separado del código productivo.
Se puede volver a mostrar con el renderizador de la skill visualize; no es una
pantalla integrada en Client ni usa APIs reales. La visualización de este chat
usa la misma fuente como `caja-negocios.html`, con fixtures e interacciones locales.
Capturas en `output/playwright/cash-planning-20261117/` ignoradas por Git.
Las decisiones duraderas están en este documento y la fuente es portable;
retomar no depende de conservar una captura o un proceso local.

## 8. Secuencia de desarrollo

| Paso | Entrega y cierre verificable | Dependencia |
| --- | --- | --- |
| **CASH-01 — contratos y reglas** | Cierre documental 2026-11-17. Reglas, DTOs/errores, respuestas, idempotencia/CAS, frontera OCR y criterios UI fijados en §§3–7 | Cerrado por alcance documental. La [PR 50](https://github.com/oscarvalenzuela25/Nodia/pull/50) ya está integrada en la base e incluye folio opcional y preferencia OCR |
| **CASH-02 — modelo y categorías** | Implementación local de la migración aditiva, alta/edición/actividad, listado/detalle, autoridad y recibos | Ver §11 |
| **CASH-03 — movimientos y agregados** | Alta, edición y actividad manuales con recibo y revisión; filtros Ransack, página y resumen sobre un snapshot y agregado mensual | Implementado localmente. Ver §12 |
| **CASH-04 — vínculo factura/OCR** | Único egreso, asignación/recategorización/retiro/restauración, sync total/fecha, manual atómico y confirmación OCR transaccional recuperable | Implementado localmente en Server. Ver §13 |
| **CASH-05 — UI Caja y categorías** | Tab, filtros, totales, tabla/tarjetas, drawer, formularios y acciones ES/EN | Implementado localmente. Ver §14 |
| **CASH-06 — Overview y selectores factura** | Dos tarjetas mensuales; categoría opcional con ayuda/X/+ en ambos flujos; creación rápida, borrador, foco, recibos e invalidación | Implementado localmente. Ver §15 |
| **CASH-07 — validación y entrega** | Unidades, integración SQL/HTTP aislada, QA móvil y fichas en §16. CI sobre el SHA de entrega | El resultado remoto se registra en GitHub Actions. La adopción por entorno tiene pedido propio |

Checklist de estado:

- [x] Solicitud y ampliación mensual documentadas, contratos actuales contrastados.
- [x] Fuente canónica, ADR propuesto, ficha candidata y TODO preparados.
- [x] Definir contratos, reglas, criterios de UI y verificación de CASH-01.
- [x] CASH-02: persistencia, autorización, administración de categorías y recibos.
- [x] CASH-03: movimientos manuales y agregados.
- [x] CASH-04: factura/OCR identificados, atómicos y recuperables en Server local.
- [x] CASH-05: pestaña Caja, categorías, movimientos y agregados filtrados en Client local.
- [x] CASH-06: tarjetas mensuales e integración de Facturas/OCR desde Client.
- [x] CASH-07: verificación local con Client, HTTP y PostgreSQL aislados. La CI del commit de entrega se consulta en Actions.
- [ ] Adopción y comprobación por entorno operativo, con pedido propio.

La ampliación transaccional del guardado OCR y la compatibilidad de escritores de
Facturas/Productos corresponden a CASH-04. La aprobación del plan o del ADR
requiere confirmación documental explícita.

## 9. Pruebas de valor de la implementación futura

- Unidades de dinero/fechas/reglas:0 vs ausente, negativos/fracciones/overflow,
  bisiestos, rango invertido, límites de mes y DST America/Santiago; no redondear
  CLP de Caja a decenas. Serialización decimal exacta de importes y sumas.
- Categorías: nombre duplicado normalizado, descripción requerida, misma empresa,
  desactivación conserva historia y categoría histórica visible al editar. Probar
  mayúsculas, whitespace inicial/final/repetido/interno, tab/NBSP/FEFF, sigma final,
  NFKC expansivo, bytes de clave y dos POST simultáneos. Inactivas también impiden
  duplicados. Competir asignación con desactivación en dos transacciones.
- SQL/HTTP aislados: rol sin módulo, negocio ajeno, colaborador revocado durante
  operación, super_admin, filtros/search/sort malformados y agrupación autorizada.
  Probar coma literal con Axios/qs reales y comodines literales con PostgreSQL.
- Agregados: más de una página, página sin filas, cero real, activos/inactivos/Todos,
  search y categoría, commit concurrente sin mezclar snapshots. Overview mensual
  no hereda filtro diario/search y no duplica ventas/facturas.
- Factura: sin categoría→con categoría→otra categoría conserva un egreso; dos
  sesiones asignando, con→null retira y null→con restaura sin duplicar; omisión
  no retira. Ningún retirado aparece en Todos ni en cards mensuales. X y cancelar
  no modifican persistencia; total0/fecha histórica inválida,
  cambio de negocio con historial retirado y revisión obsoleta. Cambios total/fecha
  conservan ID y actividad. PUT con sólo folio conserva monto, fecha, ruta y actividad.
- Confirmación OCR: fallo de producto/CAS o categoría revierte factura, egreso y logs.
  Respuesta perdida devuelve el mismo recibo antes de CAS. Misma clave con otro
  comando, orden de filas o bytes de archivo se rechaza. Medir un lote mixto cerca
  de los límites con el timeout SQL real. Probar límites, concesión
  vencida, intento tardío, reconciliación de commit y autorización revocada durante
  staging o antes de leer el recibo. Probar concurrencia con producto/actualización
  legacy y desvinculación frente a actividad desde Caja.
- NodiaAI: la propuesta antigua concurrente con el alta de vínculo no escribe
  ni queda reanudable si cambia total/fecha. Los metadatos y propuestas compatibles
  mantienen su contrato. Probar que campos de procedencia enviados por HTTP o en
  JSON de factura no conceden efectos.
- Unidades pequeñas de filtros/hooks/formulario y errores de transporte: reintento
  conserva inputs, resultado incierto no crea otra intención, teclado/foco y
  resize no descartan editor. No generar suites espejo de páginas completas.
- Creación rápida: duplicado devuelve409 y conserva inputs; éxito selecciona ID
  nuevo y conserva el resto del formulario; cancelar no altera selección. Probar
  factura nueva/editar, OCR e ingreso/egreso, borrador del modal suspendido y foco
  al regresar; no guardar movimiento por crear categoría.
- QA Chromium320/600/900/1440, claro/oscuro y ES/EN, montos/nombres largos,
  paginado/menús/drawer, estados vacío/error/carga y zoom. Teléfono físico y
  adopción requieren evidencia propia. X y + deben ser controles independientes
  con teclado, foco, borrador y objetivo táctil comprobados.

## 10. Impacto NodiaAI y verificación de este plan

La [ficha de Caja](../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md)
queda `partial/draft/unregistered/approval:null` por el alcance local de
categorías y recibos. Producto e índice enlazan el estado técnico.
No cambiar documentos aprobados, schemas de ventas, autoridad o permisos ni
presentar Caja como disponible en chat. Una integración IA futura requiere
especificación, contrato, revisión/confirmación y evidencias propias.

### Verificación de CASH-01 — 2026-11-17

Contrastados los contratos y casos de uso de Facturas, Productos, Ventas,
Business Access y autorización de NodiaAI. La revisión local del código reprodujo
los defaults del DTO parcial, la interpretación de comas por Axios/qs y la
diferencia de normalización de sigma cuando se quitan espacios demasiado tarde.
Se validaron JSON, UTF-8/LF, enlaces, compilación de conocimiento y 58 pruebas
del compilador y del pin. El corpus conserva 44 documentos, 46 fragmentos y
153 capacidades con el mismo release. El §9 recoge los gates SQL/HTTP/UI
de implementación.

### Evidencia previa de planificación R01/R02

[Evidencia de planificación](../evidence/business-cash-planning-20261117.md):
build/check de conocimiento y58pruebas correctos,97fuentes/53excluidas con
44documentos/46fragmentos/153capacidades conservadas. Maqueta Chromium con
filtros/search/resúmenes/paginado/formularios locales y anchos320/600/900/1440
comprobados; nueve capturas fuera de Git. No equivale a pruebas de implementación.
R02 añade comprobación local de X/+/Drawer/modal, duplicados Unicode e inactivos,
matriz completa de factura y retiro/restauración sin duplicados; ocho capturas
adicionales ignoradas. Evidencia anterior conserva su corte e identifica el nuevo
hash. Las garantías de persistencia corresponden a CASH-02…07.

## 11. Categorías y recibos implementados — CASH-02, 2026-11-17

La [migración 1793690000000](../../nodia-server/src/migrations/1793690000000-CreateBusinessCashCategories.ts)
añade `business_cash_categories` y `business_cash_mutation_requests`. La
unicidad usa negocio y nombre canónico con colación `C`, también para
categorías inactivas. El rollback de la migración requiere tablas vacías.

Server expone listado, detalle, alta, edición y actividad de categorías.
El listado obtiene página y total en una sentencia. El caso de uso revalida
sesión, módulo y pertenencia antes de operar en el negocio. Un colaborador
revocado recibe la misma respuesta pública que para un recurso ausente.

La escritura reserva el recibo por negocio, actor y clave, después toma la
fila del recibo y verifica su intento antes de aplicar el cambio. El efecto
y el resultado se confirman juntos. Un duplicado de nombre concurrente o una
revisión obsoleta produce un rechazo recuperable. Guardar sin cambios con la
revisión vigente conserva la versión. El GET de recibo es privado y la
concesión vencida permite retomar el mismo comando con la misma clave.

Los puntos de entrada, migración y pruebas corresponden al backend local.
Los movimientos y agregados de CASH-03 se documentan en §12.

La [prueba de integración](../../nodia-server/test/business-cash-categories.integration.mjs)
pasó los 10 grupos de comprobaciones en PostgreSQL 16.15 aislado y Nest
compilado con sesión y permisos sintéticos. Incluye migración aditiva, ambos
casos de rollback, autorización HTTP, alta concurrente con una y dos claves,
CAS concurrente, no-op, actividad, Ransack, 202, rollback SQL y recuperación
de concesión vencida. La carrera de revocación se prueba esperando el lock del
negocio antes de releer membresía. Se ejecuta desde `nodia-server` después de
`npm run build` con `node test/business-cash-categories.integration.mjs`.
El script crea PostgreSQL 16 desechable por defecto y acepta un puerto
loopback con base vacía y marcada para el laboratorio.

Server local: 65 pruebas focales correctas y suite general de 6202 casos
correctos y uno omitido en Windows, con `--testTimeout 20000`. Pasaron el
tipado de producción, build y lint, con el aviso preexistente en
`test/nodia-ai-live-unknown.fixture.mjs`.

La migración permanece pendiente de aplicación operativa.

## 12. Movimientos manuales y agregados — CASH-03, 2026-11-17

La [migración 1793700000000](../../nodia-server/src/migrations/1793700000000-CreateBusinessCashMovements.ts)
añade movimientos manuales y auditoría por movimiento y versión. La FK
compuesta exige categoría del mismo negocio. El rollback requiere ambas
tablas vacías. El Server devuelve `source: "manual"` e `invoice: null`.
CASH-04 incorpora la persistencia del vínculo de factura y su retiro.

El [recurso HTTP](../../nodia-server/src/business-cash/business-cash-movements.controller.ts)
permite crear ingresos y egresos, editar campos parciales con revisión,
cambiar actividad, consultar detalle y listar. Reutiliza la autorización del
negocio y los recibos privados de CASH-02. Una asignación nueva requiere
categoría activa bajo lock. Una edición con la misma categoría conserva la
referencia histórica aunque se haya desactivado. Los cambios efectivos
guardan el antes/después de los campos del movimiento y el recibo junto con
el efecto. Guardar los mismos valores con revisión vigente confirma el
recibo y conserva la versión.

Ransack filtra por categoría, actividad, fechas inclusivas y texto literal
en descripción o nombre de categoría. La lista calcula sus totales antes de
paginar y devuelve página, conteos y sumas desde la misma sentencia, incluso
si la página está vacía. El resumen mensual reutiliza la agregación y toma
sólo activos del mes civil actual en America/Santiago. Los importes y sumas
CLP viajan como decimales exactos en texto.

La [integración de movimientos](../../nodia-server/test/business-cash-movements.integration.mjs)
pasó 8 grupos en PostgreSQL 16.15 aislado con Nest compilado y sesiones
sintéticas. Verificó la FK, autorización, altas y ediciones concurrentes,
recibos de la versión original, rechazo recuperable, rollback por fallo de
sellado, reintento tras el vencimiento, filtros, resumen mensual y una suma
exacta de `9009999999999099`. La integración de categorías pasó sus 10
grupos tras compartir el ejecutor y comprobó la recuperación de un recibo
existente con el hash V1 de CASH-02. Ejecutar desde `nodia-server` después
de `npm run build` con `node test/business-cash-movements.integration.mjs`.
La prueba crea un PostgreSQL 16 desechable por defecto o usa
`CASH03_TEST_PORT` con una base loopback vacía y marcada para laboratorio.

Se evaluó `EXPLAIN (ANALYZE, BUFFERS)` con 120.000 movimientos sintéticos
distribuidos en tres negocios y 60 categorías. La consulta con actividad
y fecha usó el índice negocio/actividad/fecha/ID. La consulta por categoría
y fecha usó el índice negocio/categoría/fecha/ID. La consulta sin filtros de
actividad ni fecha recorrió los 40.000 movimientos del negocio para
computar el resumen. El CTE materializado evitó duplicar la evaluación de
la búsqueda literal. Se conservaron los índices iniciales. La medición
corresponde al laboratorio local.

Server local pasó 129 pruebas focalizadas y 6266 en la suite general con
`--testTimeout 20000`, con una omitida. Pasaron tipado, build y lint, con el
aviso preexistente en `test/nodia-ai-live-unknown.fixture.mjs`. Pasaron las 58
pruebas de la compilación de conocimiento. La ficha candidata sigue excluida
del contexto publicado.

Comprenden este corte el backend local y la traducción de sus errores
compartidos. La pestaña corresponde a CASH-05 y las tarjetas de Overview a CASH-06.
Las migraciones quedan pendientes de aplicación en un entorno operativo.

## 13. Facturas y OCR vinculados con Caja — CASH-04, 2026-11-17

La [migración 1793710000000](../../nodia-server/src/migrations/1793710000000-LinkBusinessCashInvoiceExpenses.ts)
inicializa en 1 la revisión de facturas existentes y nuevas. Conserva las
facturas previas sin generar egresos. La restricción única por factura se
mantiene tras un retiro, y la FK compuesta exige el mismo negocio. Un
cambio efectivo de factura incrementa su revisión. Asignar o retirar sólo
la categoría también la incrementa. La edición de actividad desde Caja
mantiene la revisión de Facturas.

POST y PUT identificados de Facturas guardan su efecto en Caja bajo el mismo
lock y en el mismo commit que el recibo. Omitir la categoría conserva el
vínculo y permite sincronizar el total y la fecha revisados. Null explícito
retira el egreso y lo excluye de detalle, filtros y agregados. Una nueva
asignación a categoría activa restaura el mismo UUID como activo. Caja
muestra el folio vigente y permite buscar por folio o ID de factura.

Los escritores legados conservan los campos omitidos. La protección común
rechaza cambios legados de importe o fecha efectivos con egreso vigente y
traslados con historial. NodiaAI comprueba compatibilidad al preparar, al
preparar el archivo y al ejecutar bajo lock. Los cambios incompatibles se
resuelven desde Facturas nativas. Los DTO y proyecciones publicados de NodiaAI
conservan sus contratos y la ficha de Caja sigue como candidata.

La [confirmación OCR nativa](../../nodia-server/src/invoice/use-case/save-cash-invoice.use-case.ts)
recibe el comando y el archivo con límites de transporte, valida la revisión
de cada producto y registra factura, productos, logs, egreso opcional,
auditoría y recibo en la misma transacción. Una intención idéntica recupera
el mismo resultado, incluidos los IDs y versiones en el orden revisado.

La [migración 1793720000000](../../nodia-server/src/migrations/1793720000000-LinkInvoiceUploadsToCashAttempts.ts)
vincula la intención privada de archivo con el intento del recibo. R2 se
ejecuta fuera de SQL. La confirmación verifica concesión, subida preparada
y ausencia de limpieza, y consume la intención en el commit. Cada reintento
tiene su propia clave de archivo. El recolector de Facturas conserva la
gracia de limpieza y verifica la propiedad del adjunto antes de borrarlo.

La [integración de CASH-04](../../nodia-server/test/business-cash-invoice.integration.mjs)
ejercitó ocho grupos en PostgreSQL 16.15 aislado y HTTP compilado con
almacenamiento sintético. Verificó las migraciones sin backfill, ambos
alias de Facturas, permisos y recibos por actor, concurrencia de revisión,
efecto único por factura, retiro y restauración, los tres tipos de fila
OCR y el rollback de factura, productos, logs, movimiento y auditoría
al fallar el sellado del recibo. Un intento vencido o una carga fallida
se recuperaron con una nueva clave privada. Los DTO y límites multipart
rechazaron comandos inválidos antes de subir el archivo.

Desde `nodia-server`, ejecutar `node test/business-cash-invoice.integration.mjs`
después del build. Por defecto, el script crea PostgreSQL 16 desechable.
`CASH04_TEST_PORT` admite una base loopback vacía y marcada para laboratorio.
Pasaron las regresiones HTTP de CASH-02/03, acceso de Facturas, 18
escenarios de carga legada con S3 sintético y siete grupos de precios/OCR.
La suite general del Server pasó 6305 pruebas y omitió una con
`--testTimeout 20000`. Pasaron tipado, build y lint, con el aviso
preexistente en `test/nodia-ai-live-unknown.fixture.mjs`.

La verificación de conocimiento recompiló las referencias a los escritores
existentes tras el cambio de locks y el guard de Facturas. Pasaron 58
pruebas y la comprobación de los pins locales. El contexto emitido conserva
44 documentos, 46 fragmentos y 153 capacidades. La ficha candidata de Caja
queda excluida de publicación.

El uso de esta ruta desde el guardado OCR de Client y los selectores de
categoría corresponden a CASH-06. Las migraciones quedan pendientes de
aplicación en un entorno operativo.

## 14. Pestaña Caja y gestión de movimientos — CASH-05, 2026-11-17

La [pestaña Caja](../../nodia-client/src/modules/business/pages/BusinessDetail/components/CashTab/CashTab.tsx)
se abre con `section=cash` en el detalle de un negocio y se puede seleccionar
desde el control móvil. La navegación usa nombres de sección, incluidas las
acciones de Overview. Cambiar de ancho conserva filtros, búsqueda y página.
Se muestran tarjetas por debajo de 600 px y tabla con scroll local desde
600 px. La paginación queda fuera del scroll. Tipo y actividad tienen
etiquetas textuales en ambas vistas.

El filtro inicial y la acción de limpiar usan hoy en America/Santiago y
actividad Activo. El rango, categoría, actividad y búsqueda se envían a
Server. Los paneles muestran conteos y sumas exactas en CLP de todos los
movimientos de la selección antes de paginar. Las lecturas y las claves de
caché mantienen actor, sesión y negocio. Un error de lectura ofrece
reintento y conserva la distinción entre información desconocida y cero.

Los formularios permiten crear y editar movimientos manuales y confirmar
su cambio de actividad. El Drawer gestiona categorías, con búsqueda y
paginación. El alta rápida cambia temporalmente el contenido del mismo
diálogo, conserva el borrador y selecciona la categoría creada. Se puede
conservar la categoría histórica inactiva de un movimiento. El formulario
permite revisar la versión actual antes de reenviar una edición en conflicto.
Cuando el resultado queda incierto, conserva el comando en el editor y
ofrece consulta del recibo y reintento explícito con la misma clave.

Client descarga el módulo de Caja al seleccionar la sección. La carga
fallida muestra un reintento dentro del panel y conserva la navegación del
negocio. En Vite, el archivo de BusinessDetail pasó de 149,31 a 122,37 kB
gzip entre la variante estática y la diferida. Caja quedó en un archivo
propio de 21,06 kB gzip. Chromium observó la descarga al entrar a Caja,
su ausencia al abrir Overview y que un fallo simulado de carga queda
contenido en Caja con la acción de reintentar visible.

En CASH-05, Editar desde un egreso abre la factura por ID exacto dentro del
mismo detalle y permite cambiar metadatos. CASH-06 amplía ese acceso con
edición identificada de importe, fecha y categoría. Ver §15.

La verificación Chromium local usó transporte sintético y el detalle de
Negocios con su navegación real. Se comprobó el cambio de tabla a tarjetas
en 599/600 px, el layout en 320, 390, 900 y 1280 px, ES oscuro y EN claro,
la conservación de la página y filtros, el alta rápida con borrador intacto,
la edición de factura vinculada y la recuperación con la misma clave tras
un 503. El Drawer ocupó el ancho completo a 320 px y devolvió el foco a su
botón al cerrar con Escape. Una respuesta inválida mostró error y
reintento. Una respuesta vacía válida mostró el estado vacío y los dos
ceros. Las capturas permanecen en `output/playwright/cash05/`. La prueba
local de Client complementa la verificación HTTP y SQL de CASH-02…04.

Pasaron 3266 pruebas de Client en 395 archivos, tipado y build. El lint
pasó excluyendo los fixtures históricos ignorados en `nodia-client/.tmp`.
También pasaron 58 pruebas de conocimiento. Caja conserva su ficha
candidata y los 44 documentos, 46 fragmentos y 153 capacidades publicados.

## 15. Resumen mensual y guardado desde Facturas y OCR — CASH-06, 2026-11-17

[Overview](../../nodia-client/src/modules/business/pages/BusinessDetail/components/OverviewTab/CashMonthlyCards.tsx)
muestra ingresos y egresos de movimientos activos, con conteos y sumas
exactas en CLP del mes civil de Santiago devuelto por Server. La lectura
tiene caché propia por actor, sesión y negocio, independiente de los
filtros de Caja. Distingue el cero confirmado del importe desconocido.

El [selector común](../../nodia-client/src/modules/business/components/CashExpenseCategoryPicker/CashExpenseCategoryPicker.tsx)
busca categorías activas del negocio y conserva visible una selección
histórica inactiva. X limpia la selección y + abre el formulario de
creación rápida con nombre y descripción. Al guardar la categoría se
selecciona, con el borrador y archivo conservados. Cerrar devuelve el foco
al selector. La ayuda explica el egreso en ambos flujos.

El [editor manual](../../nodia-client/src/modules/business/pages/BusinessDetail/components/InvoicesTab/components/InvoiceModal/InvoiceEditor.tsx)
usa guardado identificado desde Facturas y desde Caja. El importe,
fecha y categoría del egreso cambian desde la factura origen. La edición
usa la revisión exacta de la factura y muestra el efecto antes de guardar.
Conservar la selección omite el campo de categoría y limpiar un vínculo
envía null para retirar el egreso. Volver a asignar restaura su identidad.
Un conflicto permite revisar la factura vigente y conservar el borrador.

La [revisión OCR](../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx)
envía el archivo y las filas revisadas en una confirmación multipart.
Cuando se vincula un egreso, el usuario confirma una fecha de emisión
válida y un total positivo. Server registra factura, productos, logs,
egreso opcional y recibo en la misma transacción definida en §13.

En ambos flujos un resultado pendiente conserva en el editor la misma
intención, archivo y clave. Client permite consultar el recibo y reenviar
explícitamente cuando corresponde. Sólo un recibo confirmado cierra el
guardado e invalida las lecturas de Facturas, Caja y Overview. El recibo
OCR actualiza también las proyecciones dependientes de productos y logs.

Chromium local verificó Overview a 320 px en español oscuro y a 1280 px
en inglés claro, incluida una suma exacta superior al límite entero
seguro de JavaScript. En Facturas a 390 px se comprobó la creación rápida,
el foco, el borrador y PDF conservados, el retiro con la revisión exacta
y la actualización del agregado mensual. En OCR a 320 px se comprobó la
fecha obligatoria al vincular, la revisión de un producto existente y uno
nuevo, y el envío mediante una sola ruta de confirmación. Ambos flujos
se recuperaron de un 503 con consulta del recibo y un reenvío explícito
del mismo multipart. Esta QA usó HTTP sintético con el Client real.
Las capturas quedan en `output/playwright/cash06/`. En paralelo, los ocho
grupos del contrato nativo pasaron con HTTP compilado, PostgreSQL 16
desechable y almacenamiento sintético, incluida la recuperación
transaccional de OCR. Pasaron 3284 pruebas de Client en 397 archivos,
tipado, build y lint con la exclusión de fixtures históricos ignorados
en `nodia-client/.tmp`. La verificación de conocimiento pasó 58 pruebas
y conserva 44 documentos, 46 fragmentos y 153 capacidades emitidos en local.

CASH-07 reúne la verificación integral de la rama en §16. Las
migraciones permanecen pendientes en entornos operativos.

## 16. Verificación de entrega — CASH-07, 2026-11-17

### QA en Chromium

| Recorrido | Verificación |
| --- | --- |
| Caja, 320/390/599/600/900/1440 px | Tarjetas hasta 599 px, tabla con scroll local desde 600 px y ancho medido de al menos 698 px. El documento conservó su ancho de cliente. Cambiar de tamaño preservó la segunda página y los totales de la selección. |
| Caja, estados y guardado | Una respuesta inválida mostró reintento. Una lectura vacía válida devolvió dos ceros. El conflicto de nombre conservó el borrador de categoría. El alta rápida conservó el importe y la descripción del ingreso. Tras un 503, el reenvío explícito mantuvo el mismo comando y clave. |
| Caja y Overview, 320 px en inglés claro | El Drawer ocupó el ancho disponible y Escape devolvió el foco a Categorías. Overview mostró una suma exacta de CLP 9.007.199.254.740.993. |
| Facturas, 320 px con entrada táctil emulada | Limpiar, añadir y ayuda midieron 44 × 44 px y se probaron como controles separados. Cancelar el alta rápida conservó la categoría y el borrador. Enter limpió la selección, devolvió el foco y dejó cerrado el selector. El editor mantuvo su ancho con el tamaño de fuente raíz al 200 %. |

Estos casos usaron el Client real con respuestas HTTP sintéticas para
forzar errores y comprobar estados. Las capturas están en
`output/playwright/cash07/`, fuera del repositorio.

### Contratos nativos y carga OCR

Con HTTP compilado y PostgreSQL 16.15 desechable pasaron los 10 grupos
de [categorías](../../nodia-server/test/business-cash-categories.integration.mjs),
los 8 de [movimientos](../../nodia-server/test/business-cash-movements.integration.mjs)
y los 8 de [Facturas y OCR](../../nodia-server/test/business-cash-invoice.integration.mjs).
Incluyen permisos por negocio, unicidad concurrente, versión y recibos,
agregados paginados, retiro y restauración, carga multipart y rollback.

Una confirmación OCR de 500 filas combinó 180 altas, 160 ediciones y
160 coincidencias manuales. El comando ocupó 177.814 bytes. En el
laboratorio se observaron los límites SQL de 5 s por sentencia y 2 s
por lock. Confirmar tomó 524 ms. Forzar un fallo al sellar el recibo
tomó 411 ms y revirtió el lote, factura, egreso y logs. Reenviar la
misma intención tomó 405 ms y confirmó con un nuevo intento de archivo.
Cambiar el orden con la misma clave fue rechazado, y una fila 501 fue
rechazada antes de subir el archivo. Los tiempos describen esta
ejecución local con almacenamiento sintético.

### Recorrido completo

Chromium usó el Client real, los controladores y casos de uso compilados
de Nest, y PostgreSQL 16 aislado. A 320 y 600 px se crearon un ingreso y
un egreso manual. La búsqueda SQL coincidió literalmente con coma, %
y _. El filtro persistió al cruzar el breakpoint. Una categoría
duplicada devolvió 409 y el formulario conservó los campos.

Desde Facturas se adjuntó un PDF, se creó y seleccionó la categoría y se
guardó la factura. Limpiar la selección y cancelar conservó el vínculo.
Guardar sin categoría lo retiró, y reasignarla restauró el mismo UUID
de egreso con el importe actualizado. En OCR se confirmó la fecha de
emisión que faltaba. Un único POST multipart creó la factura, su egreso
y dos logs, actualizó un producto de versión 7 a 8 y creó otro en
versión 1. El stock del producto existente se conservó.

En el ingreso manual, la factura manual y OCR, el puente ocultó una
respuesta 201 después de un commit efectivo. El Client conservó la
intención y recuperó cada recibo confirmado por GET. Overview mostró
exactamente CLP 9.999.999.999.999 de ingresos y CLP 73.100 de egresos.
El servidor devolvió 404 al consultar un negocio ajeno y 403 al actor
sin módulo. El laboratorio simuló extracción, observación, proveedor
y almacenamiento. La entrada táctil y el viewport fueron emulados.

### Commit de entrega

El chequeo de instalación limpia compara las columnas físicas de
PostgreSQL con las propiedades persistidas de TypeORM. Excluye las
proyecciones `@VirtualColumn`, incluida `invoices.cash_expense`.
La instalación limpia pasó los 40 controles de esquema y migración.

[Nodia CI de la rama](https://github.com/oscarvalenzuela25/Nodia/actions/workflows/ci.yml?query=branch%3Acodex%2Fbusiness-cash-ledger)
registra la validación del SHA de entrega mediante una PR a
`development`. La adopción, las migraciones operativas y la prueba
con teléfono físico o un proveedor OCR real tienen evidencia propia.
