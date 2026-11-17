# Caja de Negocios — plan de implementación y propuesta visual

> Fecha: 2026-11-17. Estado: **especificado, con rama de desarrollo abierta**.
> El usuario solicita abrir una rama nueva para Caja. La rama
> `codex/business-cash-ledger` parte de `origin/development` (`0049b5fc`). Los requisitos expresos se
> distinguen de las decisiones recomendadas de este plan. Documento y
> [ADR106](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md)
> propuestos; no se atribuye aprobación documental, migración ni despliegue.

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

## 3. Decisiones recomendadas para V1

Estas decisiones completan huecos de la solicitud para hacerla implementable;
son **propuestas para refinar**, no confirmaciones atribuidas al usuario.

| Tema | Propuesta y motivo |
| --- | --- |
| Dinero | CLP enteros positivos, tipo separado `income`/`expense`; cero, negativos y fracciones rechazados. El redondeo a decenas de precios de venta **no se aplica** a Caja ni al total de factura |
| Precisión | `bigint` en DB y string decimal en transporte/sumas; límite por movimiento propuesto `9999999999999`. Sumar sin pasar por `Number`; validar límites al cerrar CASH-01. Facturas mantienen su rango actual, sin ensancharlo implícitamente |
| Fecha | `occurred_on` de tipo SQL DATE, `YYYY-MM-DD` válido y rango inclusivo. Hoy y mes de Caja se obtienen con IANA `America/Santiago`, como los períodos del negocio en plan94, sin offset fijo |
| Fecha de factura | El egreso usa la fecha de emisión civil guardada, sin convertirla como instante. Al vincular exige fecha válida; un histórico sin fecha requiere completarla, sin inventar hoy |
| Categoría | Nombre y descripción obligatorios, textos de negocio sin traducción dinámica; nombre único por negocio ignorando mayúsculas y espaciados, incluidas categorías inactivas. Límites propuestos: nombre120 y descripción500 caracteres; algoritmo canónico en§6.1 |
| Actividad de categoría | Desactivar preserva historial y movimientos; impide nuevas asignaciones. Una edición conserva visible la categoría histórica inactiva y permite mantenerla o cambiarla |
| Descripción de movimiento | Obligatoria en manuales, máximo500; los vinculados muestran referencia legible a factura aun sin folio. La identidad es el ID, nunca el folio |
| Edición de manuales | Categoría, importe, fecha, descripción y actividad editables con control de versión; tipo inmutable para no invertir silenciosamente el significado |
| Edición de vinculados | Importe, fecha y origen derivados de factura; cambiar esos campos remite a su formulario. Cambiar categoría desde Caja o factura actualiza la misma relación bajo una política única |
| Quitar categoría ya vinculada — confirmado R02 | Al guardar null explícito se retira el egreso de Caja y de todos sus resúmenes, incluso listando actividad Todos. No basta con poner `is_active=false`, porque seguiría apareciendo como registro inactivo |
| Auditoría del retiro — recomendación técnica | Retiro lógico separado de actividad, sin borrar evidencia. Guardar una nueva categoría después del retiro restaura el mismo egreso/ID como efecto vigente activo; no duplica registros |
| Cambio de total/fecha de factura | Mientras conserve categoría, actualiza el mismo egreso en la transacción de factura y exige total positivo. Sin categoría se conserva la validación nativa de factura; retirar no exige un egreso positivo. No crea un segundo movimiento |
| Actividad del egreso | Independiente de `invoice.is_active`: inactivar factura no implica anulación financiera. Recategorizar una factura no reactiva un egreso inactivo; se reactiva explícitamente desde Caja |
| Cambiar negocio de factura vinculada | Rechazarlo en V1; no trasladar dinero/categoría entre negocios implícitamente |
| Borrado | Acciones de actividad para categorías/movimientos; retiro del efecto de factura al quitar categoría según R02. Ambos conservan auditoría, sin DELETE físico desde UI |
| Históricos | Sin backfill automático: facturas previas generan egreso sólo ante asignación explícita de categoría. No crear categorías ni movimientos al migrar |

La fecha inicial local del formulario de factura existente no se modifica por
este plan. Caja y Overview muestran explícitamente el período usado para que
«hoy» y «mes actual» sean comprobables. Un cambio futuro de zona del negocio
necesitaría contrato persistido; no se supone que ese campo existe actualmente.

## 4. Modelo propuesto y garantías

Recursos verticales nuevos, dentro de Nodia Server, sin microservicio:

| Recurso | Campos principales propuestos |
| --- | --- |
| `business_cash_categories` | `id` bigint, `business_id` UUID, `name`, `normalized_name`, `description`, `is_active` true, `version`, auditoría de actor/fechas; clave normalizada administrada por Server |
| `business_cash_movements` | `id` UUID, `business_id`, `category_id` NOT NULL, `type`, `amount` bigint CHECK positivo, `occurred_on` DATE, `description`, `source` manual/invoice, `invoice_id` nullable, `is_active` true, `withdrawn_from_invoice` false, `version`, auditoría |
| Recibos de guardado identificados | Clave de operación UUID, actor/negocio/operación, fingerprint del comando, estado y resultado persistidos para recuperar respuestas perdidas sin repetir efectos |

Invariantes en DB y dominio:

1. FK compuesta categoría/negocio y factura/negocio: referencias de otro negocio
   inválidas aun si el actor tiene acceso a ambos.
2. Un único movimiento con origen factura por `invoice_id`, incluso inactivo o
   retirado. Retiro y posterior asignación conservan identidad e historial.
   Constraint de coherencia: origen invoice implica tipo expense e invoice_id;
   manual no puede declarar un invoice_id arbitrario.
3. Cambiar categoría de factura bloquea la misma factura/movimiento; creación
   concurrente no duplica el vínculo. La revisión obsoleta devuelve409.
4. Categoría desactivada durante la confirmación se valida dentro de la misma
   frontera de autoridad/transacción. Revalidar membresía actual, no un rol cacheado.
5. Toda suma/conteo y búsqueda lleva scope SQL del negocio y excluye efectos
   retirados, independientemente del filtro de actividad. Nada de fetch por
   fila ni sumar sólo los productos/movimientos visibles. La auditoría retirada
   no es un movimiento inactivo recuperable desde el selector Todos.
6. Índices iniciales: negocio/actividad/fecha/id y negocio/categoría/fecha/id;
   unique del vínculo y `(business_id, normalized_name)`, incluyendo inactivas.
   El DTO no acepta la clave normalizada del cliente. Confirmar planes EXPLAIN con
   volúmenes sintéticos antes de añadir índices de búsqueda costosos.
7. Orden de locks compatible con autoridad y negocio existentes; concretar en
   CASH-01 el orden global de factura/productos/categoría/movimiento y probar
   concurrencia antes de cerrar la integración.

El registro de cambios debe conservar actor, revisión y valores anteriores/nuevos
de operaciones de dinero. Editabilidad no equivale a un libro fiscal inmutable.

## 5. Contratos HTTP propuestos, no disponibles actualmente

| Método / ruta candidata | Función |
| --- | --- |
| GET `/business-cash-categories` | Listado paginado/buscable por negocio y actividad; selector y Drawer usan el mismo contrato |
| POST `/business-cash-categories` | Crear categoría con clave de idempotencia |
| PUT `/business-cash-categories/:id` | Editar o activar/desactivar con `expected_version` |
| GET `/business-cash-movements` | Devuelve página, metadatos y summary filtrado consistente |
| GET `/business-cash-movements/:id` | Detalle autorizado y origen/vínculo, útil para edición/recuperación |
| POST `/business-cash-movements` | Crear movimiento manual con clave de idempotencia |
| PUT `/business-cash-movements/:id` | Edición permitida o actividad, con revisión esperada y restricciones por origen |
| POST/PUT `/invoices[/:id]` existentes | Añadir `cash_category_id` opcional; factura+egreso dentro de una sola transacción |
| POST de confirmación OCR, ruta por cerrar en CASH-01 | Comando revisado de factura/productos + categoría opcional + operación identificada + referencia de archivo preparado |

GET sigue `Get*Dto -> Filter*Dto -> RANSACK_POLICIES -> applyRansack`.
Allowlist candidata para movimientos: `business_id_eq` obligatorio,
`category_id_eq`, `occurred_on_gteq`, `occurred_on_lteq`, `is_active_eq`, `s` y
`q.search` acotado a descripción/referencia/categoría. `search` es un filtro de
dominio parametrizado antes del builder común, siguiendo el precedente de
productos; no permitir columnas/SQL/joins enviados por el cliente. Categorías:
negocio, actividad, `name_cont` y orden permitido.

Ejemplo de intención inicial (serialización por el Axios compartido):

```text
GET /business-cash-movements?page=1&limit=10
  &q[business_id_eq]=<negocio>
  &q[occurred_on_gteq]=2026-11-17
  &q[occurred_on_lteq]=2026-11-17
  &q[is_active_eq]=true
```

Las fechas del ejemplo son sintéticas. Defaults los envía explícitamente Client;
en GET omitir actividad significa sin predicado (Todos), no true implícito.
Limpiar restaura hoy/Activo/todas las categorías; limpiar search restaura texto
vacío. Aplicar/quitar filtros o cambiar search reinicia página. Reabrir/redimensionar
conserva la selección aplicada. Rechazar fechas imposibles, inicio>fin, booleanos
inválidos, campos/sort no permitidos y límites de paginado fuera del contrato.

Respuesta conceptual:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 10, "total_items": 0, "total_pages": 0 },
  "summary": {
    "income": { "count": 0, "total_amount": "0" },
    "expense": { "count": 0, "total_amount": "0" },
    "currency": "CLP"
  }
}
```

Conservar la convención vigente de `meta` y PaginationQueryDto/servicios al
implementar. Página, count y sums deben provenir del mismo snapshot autorizado
(consulta única o transacción de lectura consistente, no tres READ COMMITTED
independientes). La página vacía conserva summary correcto. Overview reutiliza
el agregador con activos y primer/último día del mes actual, sin search ni
categoría del tab Caja; puede pedir `limit=1` sin descargar el libro completo.
No almacenar contadores duplicados en Business ni lanzar una consulta por card.

## 6. Facturas, OCR e idempotencia

Semántica de `cash_category_id`:

| Situación | Resultado esperado |
| --- | --- |
| Alta sin categoría | Factura sin egreso |
| Edición sin enviar el campo | Conserva relación/categoría; no crea ni elimina efectos implícitos |
| Primera asignación válida | Crea exactamente un egreso con total/fecha de esa factura |
| Asignación repetida o reintento | Mismo egreso, sin duplicado |
| Cambio de categoría de egreso vigente | Mismo ID de egreso, nueva categoría, actividad intacta |
| Campo null/vacío sin vínculo | Sigue sin egreso |
| Campo null/vacío con egreso vigente — R02 | Retira ese egreso al guardar; sale de lista, conteos y totales diarios/mensuales, también con actividad Todos |
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

La retirada lógica es una recomendación de implementación para cumplir la
eliminación observable pedida sin perder auditoría, no una capacidad ya existente.

### 6.1. Nombre único y creación rápida de categorías — R02

La comparación ignora mayúsculas y espacios de cualquier posición, no sólo
trim. Contrato propuesto: normalización Unicode NFKC, minúsculas con regla
española determinista y eliminación de whitespace Unicode (incluido FEFF).
Se conservan acentos: no inventar equivalencia entre palabras diferentes.
`Mercadería`, ` MERCADERÍA ` y `Mer ca dería` producen la misma clave.
El nombre visible puede conservar separación legible; no usar la descripción
como identidad. Rechazar nombre vacío/espacios. Verificar este contrato común en
Server y fixture Client, sin confiar en el control preventivo de la UI.

Persistir clave canónica privada calculada por Server y constraint unique por
negocio; conflicto concurrente o nombre de categoría inactiva devuelve409 con
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

La X reutiliza `SelectSingleInput` con `clearable` (ya soportado en Client), con
nombre accesible y área táctil44px. En factura/OCR limpia el campo opcional; en
ingreso/egreso manual permite limpiar el borrador pero guardar exige otra categoría.
Acotar esta entrega a los selectores de categoría; no se cambia globalmente la
semántica de actividad u otros selects de la aplicación.

### 6.2. Confirmación identificada y recuperación

Factura manual: ampliar casos de uso existentes para que factura y egreso
confirmen juntos; usar el protocolo de archivo recuperable actual. Repetir una
misma intención con igual clave/fingerprint devuelve recibo anterior; la misma
clave con otro cuerpo produce409. No usar folio como clave porque es opcional.

OCR: preparar archivo antes de la transacción y enviar una confirmación nativa
identificada que prevalide todos los comandos revisados y conserve CAS de los
productos existentes. Dentro de SQL: factura, productos/logs, egreso y recibo
confirman juntos, o ninguno. R2/inferencia nunca dentro del lock/transacción.
Conservar el borrador de revisión y su identidad; un timeout muestra resultado
desconocido hasta consultar recibo, sin recrear factura o repetir análisis.

Esta es una **garantía por implementar en CASH-04**, no una propiedad del flujo
actual. No habilitar la integración OCR con Caja como entrega terminada sin
haber probado commit, rollback, concurrencia y respuesta perdida. Los clientes
anteriores siguen usando su contrato vigente y no generan egresos ocultos.

## 7. Diseño y responsive para refinar

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
   confirmación de estado antes de escribir.
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
| **CASH-01 — contratos y reglas** | Cerrar ajustes visuales y decisiones propuestas; DTOs/errores, meta real, límites, orden de locks, recibos/ruta OCR y política de edición de vinculados definidos | Primer pendiente. La [PR 50](https://github.com/oscarvalenzuela25/Nodia/pull/50) ya está integrada en la base e incluye folio opcional y preferencia OCR |
| **CASH-02 — modelo y categorías** | Migración aditiva, scope/políticas, CRUD categoría y normalización de nombre única por negocio/mayúsculas/whitespace, con conflicto concurrente | 01 |
| **CASH-03 — movimientos y agregados** | CRUD manual idempotente/CAS, filtros Ransack, snapshot página+summary y agregador mensual | 02 |
| **CASH-04 — vínculo factura/OCR** | Único egreso, asignación/recategorización/retiro/restauración, sync total/fecha, manual atómico y confirmación OCR transaccional recuperable | 03; cambios de guardado nativo antes de habilitar selector OCR |
| **CASH-05 — UI Caja y categorías** | Tab, Filter, cards, tabla/tarjetas, drawer, formularios y acciones ES/EN | Contratos03; puede preparar componentes aislados sin fingir endpoints |
| **CASH-06 — Overview y selectores factura** | Dos cards mensuales; categoría opcional con ayuda/X/+ en ambos flujos; modal creación rápida, borrador/foco e invalidación | 04/05 |
| **CASH-07 — validación y entrega** | Unidades, integración SQL/HTTP aislada, QA visual proporcional, documentación/fichas y CI de SHA final | 02…06; despliegue/adopción con pedido propio |

Checklist de estado:

- [x] Solicitud y ampliación mensual documentadas, contratos actuales contrastados.
- [x] Fuente canónica, ADR propuesto, ficha candidata y TODO preparados.
- [ ] Refinar/aceptar diseño y decisiones de CASH-01; no se marca aprobación automática.
- [ ] CASH-02/03: persistencia, autorización, categorías, movimientos y agregados.
- [ ] CASH-04: factura/OCR identificados, atómicos y recuperables según alcance.
- [ ] CASH-05/06: UI e integraciones reales, incluyendo cards mensuales.
- [ ] CASH-07: verificación e integración/adopción por entorno.

La rama parte de la base integrada de Negocios y Teacher. Para CASH-01, el
guardado actual de factura y productos OCR en llamadas separadas sigue siendo
la frontera a ampliar antes de introducir el egreso automático en CASH-04.

## 9. Pruebas de valor de la implementación futura

- Unidades de dinero/fechas/reglas:0 vs ausente, negativos/fracciones/overflow,
  bisiestos, rango invertido, límites de mes y DST America/Santiago; no redondear
  CLP de Caja a decenas. Serialización decimal exacta de importes y sumas.
- Categorías: nombre duplicado normalizado, descripción requerida, misma empresa,
  desactivación conserva historia y categoría histórica visible al editar. Probar
  mayúsculas, whitespace inicial/final/repetido/interno, tab/NBSP/FEFF, Unicode
  equivalente y dos POST simultáneos; inactivas también impiden duplicado.
- SQL/HTTP aislados: rol sin módulo, negocio ajeno, colaborador revocado durante
  operación, super_admin, filtros/search/sort malformados y agrupación autorizada.
- Agregados: más de una página, página sin filas, cero real, activos/inactivos/Todos,
  search y categoría, commit concurrente sin mezclar snapshots. Overview mensual
  no hereda filtro diario/search y no duplica ventas/facturas.
- Factura: sin categoría→con categoría→otra categoría conserva un egreso; dos
  sesiones asignando, con→null retira y null→con restaura sin duplicar; omisión
  no retira. Ningún retirado aparece en Todos ni en cards mensuales. X y cancelar
  no modifican persistencia; total0/fecha histórica inválida,
  cambio de negocio y revisión obsoleta; cambios total/fecha no duplican/reactivan.
- Confirmación OCR: fallo de producto/CAS o categoría revierte factura/egreso/logs;
  respuesta perdida devuelve mismo recibo; hash distinto con misma clave rechaza;
  upload tardío/expirado y rollback conservan recuperación R2 sin archivo huérfano.
- Unidades pequeñas de filtros/hooks/formulario y errores de transporte: reintento
  conserva inputs, resultado incierto no crea otra intención, teclado/foco y
  resize no descartan editor. No generar suites espejo de páginas completas.
- Creación rápida: duplicado devuelve409 y conserva inputs; éxito selecciona ID
  nuevo y conserva el resto del formulario; cancelar no altera selección. Probar
  factura nueva/editar, OCR e ingreso/egreso, borrador del modal suspendido y foco
  al regresar; no guardar movimiento por crear categoría.
- QA Chromium320/600/900/1440, claro/oscuro y ES/EN, montos/nombres largos,
  paginado/menús/drawer, estados vacío/error/carga y zoom. Teléfono físico y
  adopción no quedan acreditados con una maqueta o captura.

## 10. Impacto NodiaAI y verificación de este plan

La [ficha nueva](../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md)
permanece `planned/draft/unregistered/approval:null`; producto e índice enlazan
el alcance futuro. Registrar el path para validación no publica herramientas.
No cambiar documentos aprobados, schemas de ventas, autoridad o permisos ni
presentar Caja como disponible en chat. Una integración IA futura requiere
especificación, contrato, revisión/confirmación y evidencias propias.

La verificación de este turno sólo cubre referencias/metadata y la maqueta local
con fixtures; las garantías SQL/HTTP/transaccionales anteriores son gates futuros.
[Evidencia de planificación](../evidence/business-cash-planning-20261117.md):
build/check de conocimiento y58pruebas correctos,97fuentes/53excluidas con
44documentos/46fragmentos/153capacidades conservadas. Maqueta Chromium con
filtros/search/resúmenes/paginado/formularios locales y anchos320/600/900/1440
comprobados; nueve capturas fuera de Git. No equivale a pruebas de implementación.
R02 añade comprobación local de X/+/Drawer/modal, duplicados Unicode e inactivos,
matriz completa de factura y retiro/restauración sin duplicados; ocho capturas
adicionales ignoradas. Evidencia anterior conserva su corte e identifica el nuevo
hash;58pruebas de conocimiento y check final correctos, sin implementar Caja.

Compatibilidad obligatoria en CASH-04: un escritor NodiaAI ya existente no puede
actualizar total/fecha de una factura vinculada y producir un efecto de Caja
oculto bajo una confirmación antigua. Hasta especificar/verificar esa ampliación,
rechazar el comando que afectaría Caja y remitir al formulario manual. Crear o
editar facturas sin vínculo y sin categoría conserva su alcance anterior;
`is_active` de factura no propaga actividad. La procedencia de ejecución se obtiene
del coordinador confiable, nunca de un flag editable enviado por HTTP/modelo.
Probar propuestas antiguas y cambios concurrentes de vínculo como regresión.
