---
{
  "schema_version": 1,
  "document_id": "businesses.cash-ledger-and-invoice-expenses",
  "product_id": "businesses",
  "kind": "feature",
  "revision": 2,
  "document_status": "draft",
  "implementation": {
    "status": "planned",
    "notes": "Refinamiento confirmado2026-11-17: selectores de categoría con X para limpiar y + para alta rápida; categoría nueva seleccionada tras éxito, sin duplicados por negocio ignorando mayúsculas y whitespace. En factura, null explícito al guardar retira el egreso; omitir en PUT parcial conserva. Asignar otra categoría conserva identidad y reasignar después de retiro restaura el mismo egreso. Retiro lógico auditado separado de actividad es recomendación técnica por implementar. Facturas automáticas sólo generan egresos; cierre de caja se registra manualmente como ingreso, POS sin integración. Dos paneles mensuales en Overview. Sin implementación, migraciones, endpoints ni herramientas nuevos; planned/draft/unregistered/approval:null. No habilita Caja en NodiaAI ni amplía las capacidades publicadas de Facturas, Productos, Ventas o Reportes."
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
    "checked_on": null,
    "evidence_paths": [],
    "notes": "Planificación documental. La entidad/DTO actuales de Facturas no contienen el vínculo de Caja: sus referencias sólo identifican el punto a ampliar. Validación de contratos, autorización, integridad, concurrencia, agregación e integración real pendientes. La revisión de una maqueta no acredita backend ni operación productiva."
  },
  "approval": null
}
---

# Caja y egresos de factura — contexto funcional para NodiaAI

## Qué resuelve y qué significa

[Plan109](../../../../mvp/109-business-cash-ledger-plan.md) recoge una nueva pestaña
**Caja** dentro de cada negocio para registrar y agrupar ingresos y egresos.
El usuario solicita planificarla y refinar sus vistas antes de implementarla.
Esta ficha es candidata; Caja no está disponible por añadir este documento.

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

Recomendaciones de diseño sujetas al refinamiento de plan109/ADR106: dinero CLP
entero positivo, bigint persistido y cadena decimal en API; fecha civil DATE del movimiento; movimiento vinculado cuyo importe
y fecha siguen el total y la fecha de emisión de la factura; edición de esos
datos desde Facturas; actividad del movimiento independiente de la factura;
retiro lógico auditado separado de actividad. La recomendación anterior de
impedir quitar una categoría ya vinculada queda sustituida por la regla explícita
de retiro al guardar. No aplicar redondeo de precio de
venta a los importes contables. Las tarjetas de Overview usarían cantidad/total
de movimientos activos del mes civil, independientes del filtro de Caja.
Hoy y mes actual se resolverían en America/Santiago, sin offset fijo y sin
cambiar el default civil local del formulario de factura de plan94§42.

Para unicidad se recomienda un canonicalizador compartido/versionado:
normalización NFKC, minúsculas con regla española determinista definida en plan109
y eliminación de todo whitespace Unicode, incluido FEFF, conservando acentos.
No limitarse a trim ni a colapsar espacios. La validación
de Client no sustituye el índice único por negocio y nombre canónico en Server/DB;
la carrera entre altas y los duplicados con categorías inactivas se resuelven allí.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Datos faltantes/ambigüedad | Aclaración o respuesta segura |
|---|---|---|---|
| «Muéstrame los egresos de hoy de este negocio» | Consultar Caja | Negocio si no hay contexto válido | Informar que Caja está planificada y no tiene herramienta de consulta publicada; no inventar resultados |
| «Registra un ingreso en Ventas» | Crear movimiento | Negocio, categoría real, importe y fecha | No ejecutar por chat; flujo manual futuro de Caja, sin equipararlo a crear una venta POS |
| «Guarda esta factura como egreso de Mercadería» | Factura con vínculo de Caja | Factura, categoría autorizada y total válido | Flujo manual futuro con selector opcional; la capacidad actual de Facturas no habilita este efecto adicional |
| «Cambia la categoría del egreso de esta factura» | Actualizar vínculo existente | Identidad de factura y categoría destino | Conservar identidad del egreso según plan; operación aún no implementada ni disponible en runtime |
| «Quita esta factura de Caja» | Retirar egreso derivado | Factura exacta y revisión vigente | Flujo manual futuro: X deja el borrador sin categoría; guardar confirma el retiro. No ejecutar por chat |
| «Registra el cierre de caja como ingreso» | Crear ingreso manual | Negocio, categoría, importe y fecha | Flujo manual previsto de Caja; no implica integración automática POS ni cierre/arqueo formal |
| «Pasa todos los egresos al otro negocio» | Traslado entre ámbitos | Autoridad e integridad de relaciones | No efectuar traslado masivo ni inferir acceso por organización del menú; mantener ámbito del recurso |
| «Haz una venta y agrégala a Caja» | Venta y eventual ingreso automático | Son efectos distintos | No preparar ni ejecutar ventas por NodiaAI; R17 conserva ventas/reportes sólo lectura y POS manual |

## Operaciones y contratos

| Operación semántica | Clase/efecto propuesto | Herramienta y estado real | Contrato | Resultado esperado de implementación |
|---|---|---|---|---|
| Listar movimientos y resumir filtros | Lectura paginada y agregada | Ninguna herramienta Caja registrada | GET y DTO Ransack propuestos en plan109; pendientes | data/meta/summary juntos, desde la misma lectura consistente y selección; sin sumar sólo la página |
| Administrar/crear rápidamente categorías | Escritura manual por negocio | No disponible en NodiaAI | Recurso, canonicalizador e índice único nuevos por implementar | Nombre/descripción, categoría seleccionada tras alta y duplicados rechazados incluso concurrentemente |
| Crear/editar/activar/desactivar movimiento | Escritura manual | No disponible en NodiaAI | Recurso, DTO y casos de uso nuevos por implementar | Movimiento con categoría obligatoria, importe válido e identidad estable |
| Vincular/retirar/restaurar egreso de factura | Escritura dependiente | Ninguna ampliación publicada de Facturas | Ampliación futura de contratos nativos identificados en fuentes | Primera asignación crea uno; recategorizar conserva ID; null retira; reasignar restaura el mismo |
| Resumen mensual de Overview | Lectura agregada | No disponible en NodiaAI | Mismo agregador de Caja, alcance fijo mensual propuesto | Conteos y totales activos por negocio, sin doble conteo con POS |

Las entidades/DTO actuales de Facturas no incluyen categoría de Caja. Sus
contratos existentes no deben recibir un campo desconocido ni asumir un efecto
contable. No se crea herramienta, binding ni permiso por escribir nombres de
endpoints propuestos. No se invoca SQL/HTTP arbitrario.

## Datos mínimos y resolución de dudas

| Dato/concepto | Carácter propuesto | Fuente y significado | Resolución |
|---|---|---|---|
| Negocio | Obligatorio | Ámbito nativo del recurso, conforme89 | Autoridad actual del actor; no aceptar IDs cruzados |
| Categoría | Obligatoria en movimiento; opcional en factura | Categoría propia del negocio, común a ambos tipos; nombre y descripción obligatorios | Elegir categoría activa; limpiar movimiento deja campo requerido inválido hasta seleccionar; factura sin categoría no genera egreso o retira el existente al guardar |
| Tipo | Obligatorio en movimiento manual | Ingreso o egreso | Factura vinculada siempre egreso; una categoría no determina el tipo |
| Importe | Positivo, CLP entero recomendado | Valor registrado; vinculado desde total de factura | No deducir pago, saldo bancario o impuesto; total cero no permite crear vínculo |
| Fecha | Fecha civil recomendada | Movimiento manual o emisión de factura vinculada | No desplazar un día por conversiones UTC; rango inclusivo con contrato explícito |
| Descripción | Obligatoria en categoría; campo previsto de movimiento | Texto identificador del movimiento o categoría | Límites finales de DTO en plan109; no inferir datos de productos |
| Actividad | Activo/inactivo | Estado del movimiento separado del tipo | Actividad de factura no desactiva automáticamente el egreso según propuesta v1 |
| Retiro del vínculo | Efecto explícito de null al guardar factura | Marcador propuesto withdrawn_from_invoice independiente de is_active | No equivale a desactivar; excluido de lista/resumen incluso con Todos; conservar auditoría e identidad |
| Identidad de origen | Administrada por Server | Factura origen y egreso único | Folio opcional no identifica ni deduplica la factura |

## Reglas, acceso y restricciones

Reutilizar autoridad de Negocios de [plan89](../../../../mvp/89-module-access-and-user-data-scope.md)
y destino canónico del recurso. Categoría, factura y movimiento deben pertenecer
al mismo negocio y verificarse en Server; un menú o un filtro de Client no otorgan
acceso. La matriz concreta de permisos de los recursos nuevos sigue pendiente.

No habrá backfill automático ni ingreso automático por venta POS en este
alcance. Se permite registrar manualmente el cierre de caja como un ingreso con
su categoría. El cierre/arqueo formal y la integración POS quedan fuera del alcance;
eso no impide este registro manual. Caja registra movimientos del negocio; no es un libro legal certificado,
conciliación bancaria ni prueba de pago de una factura. Mantener procedencias
para no sumar una factura y su egreso como dos salidas.

La propuesta contempla desactivación explícita con confirmación, no eliminación
física de movimientos o de categorías usadas. Categorías inactivas conservan
histórico y su referencia actual; la asignación nueva debe usar una opción
permitida por el contrato que se implemente.

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
| Cualquier factura existente | Campo ausente en PUT parcial | Conservar relación y estado, sin retiro implícito |
| Factura con vínculo | Otra categoría válida | Mismo ID de egreso, categoría actualizada |
| Factura con vínculo | null explícito | Retirar el egreso de Caja al guardar |
| Factura con vínculo retirado | Categoría válida | Restaurar el mismo ID y activar de nuevo su efecto, sin duplicado |

X modifica sólo el borrador hasta guardar. Cancelar la factura conserva el estado
persistido. Se recomienda mantener la unicidad histórica por factura y registrar
el retiro lógico auditado mediante un estado propio, separado de is_active.
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
| Búsqueda | q.search de dominio acotado aplicado a lista y resumen | Conjunto filtrado completo | Campos permitidos y predicado final en DTO pendiente |
| Cantidad y total de ingresos | COUNT/SUM de tipo ingreso | CLP; todos los registros filtrados, antes de paginar | Movimientos Caja, no ventas POS |
| Cantidad y total de egresos | COUNT/SUM de tipo egreso | CLP; todos los registros filtrados, antes de paginar | Movimientos Caja, incluidos vínculos únicos de factura |
| Overview mensual | Misma agregación; activos del mes actual | Mes civil corriente, por negocio; independiente de filtro Caja | Sólo movimientos Caja, con el origen sin duplicar |

Contrato de GET, lista permitida de predicados, límites y orden estable deben
implementarse según plan109 y el adaptador Ransack existente. No descargar toda
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
duplicados al editar, hacer doble clic o reintentar. La atomicidad global de
productos OCR/factura no está acreditada por los contratos actuales. La integración
OCR depende de CASH-04: confirmación nueva identificada e idempotente en Server,
con factura+productos+egreso en una transacción tras staging del archivo. No
declarar completa la integración hasta comprobar rollback, conflictos y reintentos
de esa frontera. Mantener R2 fuera de transacciones SQL con la recuperación
existente de archivos. Estas garantías son objetivos de implementación, no
comportamiento ya comprobado.

Error conserva formulario y borrador, notifica por Sileo y permite recuperación
sin replay ciego ante resultado incierto. Desactivar/reactivar exige confirmación
y no cambia tipo ni origen. Concurrencia, idempotencia y resultado recuperable
deben probarse en DB antes de declarar el flujo listo.

## Integración y evidencia

- [x] Solicitud, plan canónico y ficha candidata enlazados; estado planned/draft/unregistered y aprobación null.
- [ ] Definiciones recomendadas refinadas y aprobación documental específica, si se solicita.
- [ ] Entidades, DTOs, endpoints, ownership y relaciones implementados/contrastados.
- [ ] Igualdad de filtros/lista/resumen y resumen mensual verificadas en Server.
- [ ] Vínculo de factura, concurrencia, reintentos y fallo parcial comprobados.
- [ ] Alta rápida, clave canónica/duplicados, X/null frente a omisión PUT parcial, retiro/restauración de identidad y exclusión incluso con Todos comprobados.
- [ ] UI responsive, ES/EN, carga/vacío/error, ayuda y borradores comprobados con los contratos reales.
- [ ] Integración de Caja en NodiaAI especificada y registrada separadamente, si se incorpora al alcance futuro.

No hay inferencia, proveedor, migración, despliegue ni evidencia operativa nueva
por esta planificación. Las vistas propuestas contienen sólo datos sintéticos.
El registro explícito de esta fuente permite validarla; permanece excluida de
publicación mientras conserve draft y ninguna capacidad la use.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Herramientas/contexto afectados | Compatibilidad/propuestas pendientes |
|---|---|---|---|
| 1 | Solicitud2026-11-17, plan109 y ADR106 propuesto: Caja, categorías, egreso de factura y Overview mensual | Sólo contexto candidato; sin capacidades/bindings nuevos | Implementar contratos manuales sin ampliar silenciosamente efectos de preparadores aprobados; revalidar facturas vinculadas y compatibilidad de propuestas antes de cualquier integración futura |
| 2 | Refinamiento confirmado2026-11-17: X y alta rápida +, unicidad sin mayúsculas/whitespace, null retira egreso y reasignar restaura ID; cierres manuales como ingresos | Sólo candidata, planned y sin publicación | Sustituye la recomendación rev1 de impedir vaciar categoría ya vinculada; retiro auditado independiente de actividad. Facturas automáticas sólo egresos, sin integración POS ni cierre/arqueo formal |

Una ampliación futura de los escritores nativos de Facturas debe distinguir los
comandos que no incluyen Caja y los que expresan explícitamente el nuevo efecto.
Modificar una factura ya vinculada podrá afectar importes/categoría. CASH-04 debe
rechazar esos cambios desde escritores NodiaAI existentes y remitir al formulario
manual hasta especificar/verificar la revisión y confirmación exactas del efecto
nuevo. La procedencia se obtiene del coordinador confiable, no de un flag del
modelo/HTTP. Crear/editar sin vínculo ni categoría conserva su alcance; actividad
de factura no se propaga al egreso. No heredar confirmación antigua para efectos
nuevos, incluso cuando el vínculo haya cambiado concurrentemente. Una factura
con vínculo retirado también tiene historia contable que debe evaluar ese guard;
no tratarla como factura que nunca tuvo vínculo ni permitir que un preparador
antiguo restaure o altere silenciosamente su efecto.
