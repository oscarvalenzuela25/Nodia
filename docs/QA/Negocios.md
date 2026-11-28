# QA de Negocios

Ejecutar con una sola cuenta `super_admin`. Entrar por `/business` y abrir
el negocio explícito en `/business/:id`. Market agrupa Proveedores, Productos,
Facturas y Listas. Caja, Punto de venta, Ventas y Reportes se comprueban en
el mismo negocio. Para consultas conversacionales usar [NodiaAI](nodiaAI.md).

En producción, limitar la suite a las lecturas solicitadas y verificar
el negocio seleccionado antes de consultar. Los casos de mutación y
fallo controlado usan un entorno aislado. Repetir cada caso marcado `IA`
según la [matriz de IA](README.md#matriz-de-ia).

## Preparación

- Para el laboratorio, usar dos negocios sintéticos con registros distintos.
  Preparar en el negocio principal un producto activo controlado con saldo 5
  y precio CLP 1.500, otro sin control de stock, uno inactivo y otro con precio
  cero. Asignar datos de búsqueda diferenciables, incluido un código con un
  cero inicial. En el segundo negocio, incluir un producto con ese mismo
  código para comprobar el contexto de la búsqueda.
- Preparar un proveedor con OCR habilitado y otro sin habilitar, dos categorías
  de Caja activas y una factura PDF sintética legible con folio y renglones
  conocidos. Usar un folio y un nombre de ejecución diferenciables por selección
  cuando se guarde la factura. Partir del mismo estado de datos de revisión en
  cada repetición de OCR.
- Tomar saldos, precios, totales y cantidades del negocio antes de cada escritura.
  Para las verificaciones entre pantallas, usar el mismo período civil de
  `America/Santiago` y cotejar identidades, importes y estado después de recargar.

## Casos

| Caso | Tipo | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- | --- |
| NEG-01 · Negocio y secciones | Lectura | Abrir dos negocios autorizados desde el listado. En el primero, cambiar de Market a Caja y volver con el historial. Recargar el enlace directo a Listas. | El título, la sección y los datos corresponden al negocio de la URL. Cambiar de negocio mantiene sus datos separados aunque `super_admin` pueda abrir ambos. Registrar los destinos y el alcance observado. |
| NEG-02 · Búsqueda y actividad del catálogo | Lectura | En Market → Productos buscar por nombre, alias, código de factura y código de barras. Incluir el cero inicial del fixture cuando se use. Aplicar presencia de código, cambiar la actividad a Inactivo y Todos, y usar Limpiar. | El buscador devuelve las coincidencias del negocio antes de paginar. Presencia y actividad se combinan con el texto. Limpiar vuelve a Activo y página 1. Registrar filas y total por filtro. |
| NEG-03 · Cambios de catálogo | Aislado | Crear un producto sintético, editar su alias y precio, desactivarlo y volver a encontrarlo con Inactivo. Guardar la edición con un rechazo controlado y luego corregir el dato. | La edición fallida muestra el error y conserva el formulario. El producto aparece en el filtro que corresponde y conserva identidad, alias y precio tras recargar. Comprobar que un precio cero permitido se muestra como cero. |
| NEG-04 · Carritos y stock | Aislado | En Punto de venta, abrir dos carritos. En el primero agregar dos unidades del producto de CLP 1.500. Cambiar de carrito, recuperar el primero y confirmar en efectivo. Buscar de nuevo el producto y volver a cargar Ventas. | Cada carrito conserva sus partidas. Antes de confirmar, el saldo es 5. Se genera una venta de CLP 3.000, su comprobante y un saldo 3. La reimpresión desde el historial conserva venta, medio y total. Cotejar ID de venta y stock. |
| NEG-05 · Stock insuficiente | Aislado | Con saldo 1, intentar agregar o cobrar 2 unidades. En una variante, abrir el carrito con saldo suficiente, reducir el saldo en el laboratorio y después confirmar. Probar también un producto activo sin control de stock. | Se bloquea la cantidad incompatible y el carrito permanece disponible para corregir. La confirmación rechazada no crea venta ni descuento. El producto sin control puede venderse sin cambiar su saldo. Registrar el estado previo y posterior. |
| NEG-06 · Medios combinados y anulación | Aislado | Preparar una venta de CLP 3.000. Activar Combinar pagos y elegir efectivo y tarjeta. Intentar un reparto que no sume el total y corregir a CLP 1.000 más CLP 2.000. Confirmar y anular desde una fila de Ventas. | El reparto inválido no se confirma. El válido conserva un solo cobro de venta, dos asignaciones y un solo descuento de stock. La anulación afecta la venta completa. Registrar ID de transacción, montos, estados y recibo. |
| NEG-07 · Ventas y Reportes | Lectura | Fijar fechas y medio de pago en Ventas. Comparar el total filtrado con el conjunto de coincidencias, incluidos resultados en otra página si existen. Abrir el resumen comercial con el mismo alcance. | El total filtrado cubre todas las filas seleccionadas y el resumen comercial responde a su agregado de transacciones confirmadas. Las anuladas se distinguen. Registrar período, filtros, conteo y totales de cada vista. |
| NEG-08 · Caja y Overview | Aislado | Crear un ingreso manual de CLP 10.000 y un egreso de CLP 3.000 para hoy. Filtrar por fecha y categoría, desactivar el egreso y recargar Caja y Overview. | Sobre el conjunto del fixture, Caja suma CLP 10.000 y CLP 3.000 con ambos activos, con neto CLP 7.000. Al desactivar, el egreso sale del filtro Activo y de los agregados de activos. Todos conserva su rastro. El resumen mensual de Overview refleja los movimientos activos del mes. |
| NEG-09 · Factura manual vinculada con Caja | Aislado | Guardar una factura de CLP 6.000 con categoría de egreso en el editor de Facturas. Cambiar folio, importe y fecha. Luego retirar la categoría y volver a asignar una activa. | Cada lectura muestra a lo sumo un egreso vinculado. Importe, fecha y referencia siguen la factura vigente. Retirar excluye el egreso incluso con Todos. Restaurar reutiliza el ID de egreso. Registrar los recibos y el ID antes y después. |
| NEG-10 · Proveedores y contactos | Aislado | Crear o editar un proveedor comercial y su contacto. Guardar un día de visita con hora por confirmar. Reabrir y cambiar a un intervalo válido. Revisar qué proveedores admite el selector comercial del OCR. | Los dos estados del día sobreviven a la recarga y el selector comercial muestra sólo los proveedores elegibles por su configuración OCR. Registrar el ID del proveedor y el estado guardado sin datos de contacto personales. |
| NEG-11 · Listas de Market | Aislado | Crear una lista con dos productos y cantidades 1 y 2. Marcar uno en Checklist, cerrar y reabrir. Usar Copiar y verificar el texto localmente. Desactivar la lista y recuperarla con el filtro. | Nombre, cantidades y marca persisten. Copiar incluye ambas líneas aunque una esté marcada. La lista inactiva conserva la composición. Cotejar el ID y los valores tras recargar, sin enviar el texto a otro servicio. |
| NEG-12 · Extracción OCR | IA | En el laboratorio, abrir el importador desde Productos. Elegir el proveedor comercial habilitado, el PDF sintético y la selección exacta del caso IA. Analizar, revisar folio, total y filas contra el original y cotejar el catálogo antes de guardar. Repetir con cada formato de factura habilitado para la selección. | El análisis real deja un borrador revisable, con magnitudes y campos cotejables con el archivo. No se registran factura, productos ni egreso a partir del análisis sin confirmación comercial. Registrar selección, formato, resultado y cierre de cada análisis. |
| NEG-13 · Confirmación OCR | Aislado | Usar el borrador de NEG-12, revisar coincidencias manuales y elegir una categoría de egreso. Si el corte incluye stock, elegir explícitamente un ajuste para un producto con control. Confirmar una vez. Con un fallo controlado de respuesta, recuperar el resultado por el mecanismo previsto. | Factura, cambios elegidos y egreso concuerdan con el borrador confirmado. El ajuste explícito se aplica una vez y la cantidad facturada conserva su valor. Verificar recibo, producto y egreso después de recargar, sin duplicar efectos. |
| NEG-14 · Disponibilidad y cancelación de OCR | IA | En un entorno que permita observar el cierre, iniciar el análisis de un PDF sintético y cancelar mientras trabaja. Usar Comprobar disponibilidad y revisar el borrador o archivo existente. | Se observan bloqueo durante la ejecución, estado de cierre real o resultado incierto, y conservación del archivo según el flujo. La comprobación de disponibilidad no envía otra inferencia ni cambia la selección. Registrar intención y cierre sin asumir cancelación remota. |

## Fuentes

- Catálogo, ventas, medios combinados, stock y OCR. [Plan de Negocios](../mvp/94-business-point-of-sale-and-product-refactor.md).
- Alcance de Caja y vínculo con facturas. [Plan de Caja](../mvp/109-business-cash-ledger-plan.md).
- Listas, checklist y copiado. [Plan de Listas](../mvp/110-market-shopping-lists-plan.md).
- Contactos y horarios de visita. [Plan de Contactos](../mvp/31-provider-contacts-proposal.md).
