# QA de Finanzas

Ejecutar con una sola cuenta `super_admin`. Entrar por `/finances-personal`
y comprobar el propietario seleccionado en el encabezado. La vista inicial
usa el ámbito propio. En producción, consultar sólo el ámbito solicitado.
La suite cubre las pantallas nativas. Las consultas con IA se prueban desde
[NodiaAI](nodiaAI.md).

Usar un entorno aislado para crear, editar o eliminar datos, simular errores
y contrastar dos propietarios sintéticos con la misma sesión administrativa.

## Preparación

- Preparar dos propietarios sintéticos con nombres de registros y categorías
  distinguibles. Autenticarse únicamente como `super_admin`.
- Para verificar totales, preparar en un mismo período dos movimientos
  confirmados, ingreso CLP 10.000 y gasto CLP 3.000, y un ingreso pendiente
  de CLP 2.000. Mantener otros movimientos fuera del período o del conjunto
  de filtros usado para esa comprobación.
- Preparar una categoría que pertenezca a dos grupos activos y movimientos
  suficientes para comprobar el total con más de una página. Usar un fixture
  separado para obligaciones y eliminación.

## Casos

| Caso | Tipo | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- | --- |
| FIN-01 · Propietario activo y navegación | Lectura | Abrir General, Movimientos y Préstamos y deudas. En laboratorio, seleccionar un propietario sintético distinto, cargar sus movimientos y regresar al ámbito propio. | El propietario corresponde al encabezado y al conjunto leído. Cambiar de ámbito no recicla los movimientos anteriores. Cotejar el identificador de propietario, los filtros y el alcance observado. |
| FIN-02 · Totales y filtros trasladados | Lectura | Aplicar el rango civil que contenga los tres movimientos del fixture. Cotejar las tarjetas de General y activar Ver todos los movimientos. Repetir con un filtro por categoría y limpiar. | El ingreso confirmado aporta CLP 10.000, el gasto CLP 3.000 y el neto CLP 7.000. El pendiente se cuenta aparte. Movimientos recibe los filtros aplicados y limpiar vuelve a Activo. El total cubre todas las páginas. |
| FIN-03 · Categorías y grupos | Aislado | Crear una categoría y asociarla a dos grupos. Registrar un movimiento de CLP 1.000 en ella. Filtrar por ambos grupos simultáneamente y abrir los desgloses de categorías y grupos. | El total global contabiliza ese movimiento una vez aunque aparezca en el desglose de más de un grupo. Verificar los IDs de grupo y categoría y el conteo e importe global. |
| FIN-04 · Movimiento manual y rechazo | Aislado | Crear un movimiento pendiente. Editar un importe entero válido y pasarlo a recibido si es ingreso o pagado si es gasto. Intentar guardar con un fallo controlado y recargar tras la resolución. | El dinero afecta el agregado cuando queda confirmado. Ante rechazo se muestran el error y el borrador. La recarga confirma el último estado guardado. Si se pierde la respuesta, comprobar la escritura mediante lectura antes de intentar otra. |
| FIN-05 · Préstamo y deuda | Aislado | Crear un préstamo y una deuda de CLP 10.000 cada uno en el fixture. Registrar un pago de CLP 3.000 para cada obligación en la dirección correspondiente. Archivar un pago y consultar el saldo. Intentar exceder lo adeudado. | Cada obligación nace con un solo movimiento inicial. El préstamo desembolsa y luego recibe. La deuda recibe y luego paga. Cada saldo queda en CLP 7.000 incluso si el pago confirmado se archiva. El sobrepago se rechaza y los importes persisten al recargar. |
| FIN-06 · Eliminación protegida | Aislado | En una obligación de prueba con pagos, intentar eliminar su movimiento inicial y después la obligación. En otra obligación con sólo su movimiento inicial, eliminar la obligación desde su confirmación. | La primera conserva toda su historia. La segunda elimina exactamente su obligación y el origen asociado. Verificar por recarga y revisar los totales correspondientes. |
| FIN-07 · Estado vacío y error de lectura | Aislado | Consultar un filtro sin coincidencias y, en otra navegación, provocar un fallo de lectura controlado. Reintentar la carga y comprobar el formulario con un rechazo de guardado. | El conjunto vacío y el error son distinguibles. El error no se presenta como totales cero. El reintento restaura los datos cuando vuelve el servicio y el rechazo de guardado conserva el borrador. |

## Fuentes

- Agregados, estados, pagos y eliminación. [Contratos de Finanzas](../mvp/22-personal-finance-contracts.md).
- Ruta, navegación y formularios. [Plan Client de Finanzas](../mvp/24-personal-finance-client-plan.md).
- Propietario explícito y permisos vigentes. [Autoridad transversal](../mvp/54-nodia-ai-ai08-transversal-authority.md).
