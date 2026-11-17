---
{
  "schema_version": 1,
  "document_id": "businesses.cash-ledger-and-invoice-expenses",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 6,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "CASH-02/03 implementan categorías, movimientos manuales, recibos y agregados. CASH-04 añade vínculo de egreso único por factura, retiro/restauración y confirmación OCR atómica y recuperable en Server. CASH-05…07 cubren UI y entrega. La ficha conserva draft, unregistered y approval null."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Negocios y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/109-business-cash-ledger-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/94-business-point-of-sale-and-product-refactor.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/business-cash/business-cash-categories.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business-cash/business-cash-receipts.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business-cash/business-cash-movements.controller.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793690000000-CreateBusinessCashCategories.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793700000000-CreateBusinessCashMovements.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793710000000-LinkBusinessCashInvoiceExpenses.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/migrations/1793720000000-LinkInvoiceUploadsToCashAttempts.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/use-case/save-cash-invoice.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/invoice-cash-compatibility.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/business-cash/invoice-cash-expense.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/entities/invoice.entity.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/dto/create-invoice.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/dto/update-invoice.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/use-case/create-invoice.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/invoice/use-case/update-invoice.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-17",
    "evidence_paths": ["docs/mvp/109-business-cash-ledger-plan.md"],
    "notes": "Plan109 §§11–13 registra la implementación y las comprobaciones locales de categorías, movimientos, recibos, agregados y confirmación nativa de Facturas/OCR. La UI y adopción por entorno son pasos separados."
  },
  "approval": null
}
---

# Caja y egresos de factura — contexto funcional para NodiaAI

## Qué resuelve y qué significa

[Plan109](../../../../mvp/109-business-cash-ledger-plan.md) recoge una nueva pestaña
**Caja** dentro de cada negocio para registrar y agrupar ingresos y egresos.
Los recursos nativos de categorías, recibos, movimientos manuales y
resúmenes están implementados localmente. Server procesa el vínculo de
Facturas y la confirmación revisada OCR a través de rutas identificadas.
El tab de Caja corresponde a CASH-05. Los selectores de factura y las
tarjetas de Overview corresponden a CASH-06.

Confirmado por la solicitud:

- Cada movimiento pertenece a un negocio y tiene una categoría obligatoria.
  Las categorías son identificaciones comunes para ingresos y egresos, sin
  clasificación fija por tipo. Se administran en un Drawer con nombre y descripción
  obligatorios.
- Filtro de categoría, rango de fechas y actividad; al abrir, día actual y activos.
  Dos paneles muestran cantidad y total de ingresos/egresos del conjunto filtrado.
  La tabla tiene búsqueda, acciones de editar y activar/desactivar, y fondo
  success/error acompañado de tipo textual.
- La factura manual y el guardado de productos desde OCR incorporarán un selector
  opcional de categoría, con ayuda visible mediante icono. Primera asignación
  genera un egreso por factura; cambiarlo conserva identidad; quitarlo con X
  y guardar retira el egreso. La ausencia del campo en PUT parcial conserva la relación.
- Los formularios de ingreso/egreso, alta/edición de factura y guardado OCR
  incorporan X para limpiar el selector y + para crear una categoría en un modal
  con nombre/descripción. Al crear correctamente se selecciona la categoría nueva.
  Se rechazan duplicados por negocio ignorando mayúsculas y espaciados.
- La automatización de facturas sólo genera egresos. Los cierres de caja se
  registran manualmente como ingresos; POS no se integra con Caja por ahora.
- Overview incorporará dos tarjetas de ingresos/egresos del mes actual.

[CASH-01](../../../../mvp/109-business-cash-ledger-plan.md#3-reglas-de-caja-v1)
fija CLP entero positivo como cadena decimal, fecha civil de Santiago y exactitud
de conteos y sumas. Monto, fecha y categoría del egreso vinculado se editan en la
factura origen. Caja controla actividad independiente. Toda baja por retiro
permanece auditada. Overview usa activos del mes civil en Santiago con su propio
período. El formulario manual de factura conserva su fecha civil inicial de §42.

La unicidad se resuelve en Server/DB por negocio, también para inactivas. La
clave aplica NFKC y elimina espacios Unicode/FEFF antes de convertir a minúsculas
con regla española determinista, conservando acentos. Ver plan109 §6.1.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración o respuesta segura |
|---|---|---|---|
| «Muéstrame los egresos de hoy de este negocio» | Consultar Caja | Negocio si no hay contexto válido | Caja cuenta con consulta HTTP nativa en Server local. La consulta por chat no está publicada |
| «Registra un ingreso en Ventas» | Crear movimiento | Negocio, categoría real, importe y fecha | No ejecutar por chat; flujo manual futuro de Caja, sin equipararlo a crear una venta POS |
| «Guarda esta factura como egreso de Mercadería» | Factura con vínculo de Caja | Factura, categoría autorizada y total válido | HTTP nativo identificado en Server. El selector de Client corresponde a CASH-06 |
| «Cambia la categoría del egreso de esta factura» | Actualizar vínculo existente | Identidad de factura, revisión y categoría destino | La edición nativa conserva identidad del egreso. La operación carece de herramienta en NodiaAI |
| «Quita esta factura de Caja» | Retirar egreso derivado | Factura exacta y revisión vigente | Flujo manual futuro: X deja el borrador sin categoría; guardar confirma el retiro. No ejecutar por chat |
| «Registra el cierre de caja como ingreso» | Crear ingreso manual | Negocio, categoría, importe y fecha | Flujo manual previsto de Caja; no implica integración automática POS ni cierre/arqueo formal |
| «Pasa todos los egresos al otro negocio» | Traslado entre ámbitos | Autoridad e integridad de relaciones | No efectuar traslado masivo ni inferir acceso por organización del menú; mantener ámbito del recurso |
| «Haz una venta y agrégala a Caja» | Venta y eventual ingreso automático | Son efectos distintos | No preparar ni ejecutar ventas por NodiaAI; R17 conserva ventas/reportes sólo lectura y POS manual |

## Operaciones y contratos

| Operación semántica | Clase/efecto propuesto | Herramienta y estado real | Contrato | Resultado esperado de implementación |
|---|---|---|---|---|
| Listar movimientos y resumir filtros | Lectura paginada y agregada | Ninguna herramienta Caja registrada | GET y DTO Ransack implementados localmente en CASH-03 | data/meta/summary juntos desde una sentencia para la selección completa |
| Administrar categorías | Escritura manual por negocio | No disponible en NodiaAI | HTTP nativo de categorías y recibos implementado localmente, plan109 §11. Alta rápida en Client corresponde a CASH-05/06 | Nombre y descripción, revisión al editar y duplicados rechazados incluso bajo concurrencia |
| Crear/editar/activar/desactivar movimiento | Escritura manual | No disponible en NodiaAI | HTTP nativo con revisión y recibo implementado en CASH-03 | Movimiento con categoría obligatoria, importe válido e identidad estable |
| Vincular/retirar/restaurar egreso de factura | Escritura dependiente | Ninguna ampliación publicada de Facturas | HTTP nativo identificado en CASH-04, plan109 §13 | Primera asignación crea uno; recategorizar conserva ID; null retira; reasignar restaura el mismo |
| Confirmar revisión OCR de Facturas | Escritura compuesta | No disponible en NodiaAI | POST nativo identificado y multipart en CASH-04 | Factura, productos, logs, egreso opcional y recibo en un commit |
| Resumen mensual de Overview | Lectura agregada | No disponible en NodiaAI | Ruta mensual implementada en CASH-03, tarjetas en CASH-05 | Conteos y totales de movimientos activos por negocio |

El campo `cash_category_id` pertenece a los comandos HTTP nativos
identificados y se verifica por negocio. Los DTO conversacionales conservan
su lista de campos previa. El guard de Facturas protege el egreso cuando
se intenta cambiar su importe o fecha desde esas rutas.

## Datos mínimos y resolución de dudas

| Dato/concepto | Carácter propuesto | Fuente y significado | Resolución |
|---|---|---|---|
| Negocio | Obligatorio | Ámbito nativo del recurso, conforme89 | Autoridad actual del actor; no aceptar IDs cruzados |
| Categoría | Obligatoria en movimiento; opcional en factura | Categoría propia del negocio, común a ambos tipos; nombre y descripción obligatorios | Elegir categoría activa; limpiar movimiento deja campo requerido inválido hasta seleccionar; factura sin categoría no genera egreso o retira el existente al guardar |
| Tipo | Obligatorio en movimiento manual | Ingreso o egreso | Factura vinculada siempre egreso; una categoría no determina el tipo |
| Importe | CLP entero positivo, como decimal canónico | Valor registrado o total de factura | Total cero impide un egreso vigente |
| Fecha | Fecha civil | Movimiento manual o emisión de factura vinculada | Rango inclusivo en Santiago; usar fecha de emisión confirmada |
| Descripción | Obligatoria en categoría y movimiento manual | Texto registral. Egreso vinculado presenta referencia de factura | Límites en plan109 §3 |
| Actividad | Activo/inactivo | Estado del movimiento separado del tipo | Actividad del egreso se cambia de forma independiente |
| Retiro del vínculo | Efecto explícito de null al guardar factura | Retiro lógico auditado | Excluido de lista/resumen incluso con Todos. Recupera el mismo ID al restaurar |
| Identidad de origen | Administrada por Server | Factura origen y egreso único | Folio opcional no identifica ni deduplica la factura |

## Reglas, acceso y restricciones

Reutilizar autoridad de Negocios de [plan89](../../../../mvp/89-module-access-and-user-data-scope.md)
y destino canónico del recurso. Categoría, factura y movimiento deben pertenecer
al mismo negocio y verificarse en Server; un menú o un filtro de Client no otorgan
acceso. Plan109 §5 aplica sesión y módulo canónico `/business`, con dueño,
colaborador activo o super_admin y revalidación transaccional del ámbito.

No habrá backfill automático ni ingreso automático por venta POS en este
alcance. Se permite registrar manualmente el cierre de caja como un ingreso con
su categoría. El cierre/arqueo formal y la integración POS quedan fuera del alcance;
eso no impide este registro manual. Caja registra movimientos del negocio; no es un libro legal certificado,
conciliación bancaria ni prueba de pago de una factura. Mantener procedencias
para no sumar una factura y su egreso como dos salidas.

El contrato contempla desactivación explícita con confirmación. Categorías
inactivas conservan el historial y la referencia actual. Toda asignación nueva
o restauración requiere categoría activa.

La unicidad de categorías se aplica por negocio, también frente a categorías
inactivas, con la misma clave canónica y sin clasificar por ingreso/egreso.
El alta rápida no abre dos overlays que compitan por el foco: conserva el borrador
del formulario origen, muestra el modal de categoría como único overlay activo y
devuelve foco al selector al cancelar o finalizar. Error conserva nombre y
descripción para corregir; cancelar no crea ni cambia la selección anterior.

### Matriz de categoría de factura confirmada

| Estado previo | Campo al guardar | Resultado |
|---|---|---|
| Factura nueva | Sin categoría/null | Sin egreso |
| Factura nueva | Categoría válida | Un egreso |
| Factura existente sin vínculo | Categoría válida | Crear un egreso |
| Cualquier factura existente | Campo ausente en PUT parcial | Conservar relación. Una edición identificada de total o fecha sincroniza el egreso vigente |
| Factura con vínculo | Otra categoría válida | Mismo ID de egreso, categoría actualizada |
| Factura con vínculo | null explícito | Retirar el egreso de Caja al guardar |
| Factura con vínculo retirado | Categoría válida | Restaurar el mismo ID y activar de nuevo su efecto, sin duplicado |

X modifica sólo el borrador hasta guardar. Cancelar la factura conserva el estado
persistido. La unicidad histórica por factura y el retiro lógico separado de
actividad se respaldan con constraints y auditoría implementados en CASH-04.
Un movimiento retirado queda fuera de lista, conteos y totales de Caja, incluso
con actividad Todos; no se expone como simple inactivo que pueda reactivarse al
margen de la factura. Restaurar vuelve a usar la misma identidad y relación.
Factura sin categoría, incluido el retiro, admite total0 según el contrato nativo;
la positividad y la fecha válida corresponden al egreso vigente.

La restricción [plan94 R17](../../../../mvp/94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30)
sigue vigente para ventas/reportes. No se amplía por analogía a todo dato
comercial ni se usa para habilitar Caja: esta función aún no tiene operaciones
publicadas de lectura o escritura en NodiaAI. La ficha aprobada
[Facturas y archivos](invoices-and-files.md) conserva cuerpo/aprobación propios;
esa aprobación no cubre el efecto futuro factura→egreso.

## Filtros e informes

| Campo/medida | Selección propuesta | Fecha/moneda/grano | Procedencia |
|---|---|---|---|
| Categoría | Query param Ransack de igualdad | Categoría del negocio | Relación validada por Server |
| Rango de fechas | Desde/hasta civiles inclusivos | Default hoy para Caja | Fecha de movimiento, no fecha técnica de creación |
| Actividad | Activo, Inactivo, Todos | Default Activo; limpiar restaura Activo | Todos omite predicado de actividad, pero nunca incluye vínculos retirados; ActiveStatusSelect en filtro |
| Búsqueda | q.search literal de dominio aplicado a lista y resumen | Conjunto filtrado completo | Descripción y categoría, más folio vigente o ID de facturas vinculadas |
| Cantidad y total de ingresos | COUNT/SUM de tipo ingreso | CLP; todos los registros filtrados, antes de paginar | Movimientos Caja, no ventas POS |
| Cantidad y total de egresos | COUNT/SUM de tipo egreso | CLP; todos los registros filtrados, antes de paginar | Movimientos Caja, incluidos vínculos únicos de factura |
| Overview mensual | Misma agregación; activos del mes actual | Mes civil corriente, por negocio; independiente de filtro Caja | Sólo movimientos Caja, con el origen sin duplicar |

El GET de CASH-03 aplica la lista permitida de predicados, límites y orden de
plan109 mediante el adaptador Ransack existente. No descargar toda
la colección para calcular totales en Client ni usar el tamaño de la página como
cantidad global. Cero es un resultado real; error o información ausente no se
presentan como cero. No comparar CLP con otros importes o monedas sin contrato.

## Vista previa, confirmación y recuperación

El formulario futuro muestra tipo, categoría, importe, fecha y actividad antes de
guardar. El selector opcional de factura explicará que genera un egreso con su
total, que otra categoría actualiza el mismo egreso y que quitarla retirará ese
egreso cuando se guarde. El alta rápida con + conserva la factura/movimiento en
borrador y selecciona la nueva categoría sólo tras éxito. No usar un
botón de guardar factura existente para esconder un efecto contable nuevo sin
esa información.

[ADR106 propuesto](../../../../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md)
evalúa una transacción nativa factura+egreso y unicidad por factura para evitar
duplicados al editar, hacer doble clic o reintentar. La confirmación
identificada implementada en CASH-04 registra factura, productos,
egreso y recibo en una transacción tras preparar el archivo. La recuperación
consulta la misma clave en el ámbito del actor y negocio. Las pruebas de rollback,
conflictos y reintentos quedan en plan109 §§6.4 y 9.

Error conserva formulario y borrador, notifica por Sileo y permite recuperación
sin replay ciego ante resultado incierto. Desactivar/reactivar exige confirmación
y no cambia tipo ni origen. Concurrencia, idempotencia y resultado recuperable
deben probarse en DB antes de declarar el flujo listo.

## Integración y evidencia

- [x] Solicitud, plan canónico y ficha candidata enlazados. Estado partial/draft/unregistered y aprobación null.
- [x] Contratos y reglas de CASH-01 refinados en plan109 §§3–7.
- [ ] Aprobación documental de la ficha, si se solicita.
- [x] Entidades, DTOs, endpoints y autoridad para categorías y recibos implementados localmente.
- [x] Movimientos manuales y agregados implementados en Server local.
- [x] Igualdad de filtros, página y resumen, y mes civil de Santiago verificados en el alcance manual de CASH-03.
- [x] Vínculo de Facturas y confirmación OCR identificada implementados en Server local.
- [x] Vínculo de factura, concurrencia, reintentos y rollback comprobados en PostgreSQL aislado.
- [ ] Alta rápida, clave canónica/duplicados, X/null frente a omisión PUT parcial, retiro/restauración de identidad y exclusión incluso con Todos comprobados.
- [ ] UI responsive, ES/EN, carga/vacío/error, ayuda y borradores comprobados con los contratos reales.
- [ ] Integración de Caja en NodiaAI especificada y registrada separadamente, si se incorpora al alcance futuro.

La validación de CASH-02…04 usa PostgreSQL aislado y peticiones HTTP con
usuarios sintéticos. La ficha candidata permanece excluida del contexto publicado.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Solicitud2026-11-17, plan109 y ADR106 propuesto: Caja, categorías, egreso de factura y Overview mensual | Sólo contexto candidato; sin capacidades/bindings nuevos | Implementar contratos manuales sin ampliar silenciosamente efectos de preparadores aprobados; revalidar facturas vinculadas y compatibilidad de propuestas antes de cualquier integración futura |
| 2 | Refinamiento confirmado2026-11-17: X y alta rápida +, unicidad sin mayúsculas/whitespace, null retira egreso y reasignar restaura ID; cierres manuales como ingresos | Sólo candidata, planned y sin publicación | Sustituye la recomendación rev1 de impedir vaciar categoría ya vinculada; retiro auditado independiente de actividad. Facturas automáticas sólo egresos, sin integración POS ni cierre/arqueo formal |
| 3 | CASH-01 cierra la especificación V1 de reglas, consultas, edición desde Facturas, confirmación OCR y recibos | Sólo candidata; conserva aprobación null | El guard bajo lock protege propuestas previas. CASH-02…07 implementan y verifican |
| 4 | CASH-02 implementa categorías y recibos con unicidad concurrente y autoridad por negocio | Sólo contexto candidato. Integración de herramientas independiente | CASH-03 implementa movimientos y agregados |
| 5 | CASH-03 implementa movimientos manuales con revisión, auditoría, recibos, filtros y resumen mensual por negocio | Sólo contexto candidato | CASH-04 continúa con Facturas/OCR |
| 6 | CASH-04 implementa el egreso único por factura, retiro/restauración y guardado OCR con revisión y recibo | Sólo contexto candidato. El guard mantiene el alcance de herramientas existentes | CASH-05 y CASH-06 integran la UI |

El escritor común aplica la revisión y el recibo al efecto nativo identificado.
Los preparadores de NodiaAI revalidan el vínculo al preparar, antes de subir
archivos y al ejecutar bajo lock. Un cambio de monto o fecha con egreso
vigente se remite al editor manual y una factura con historial se conserva
en su negocio. La actividad de Facturas y Caja se controla por separado.
