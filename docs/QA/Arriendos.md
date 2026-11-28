# QA de Arriendos

Ejecutar con una sola cuenta `super_admin`. Abrir Reservas en `/reservations`
y elegir el alojamiento explícito. La suite cubre los recorridos nativos de
agenda, reservas y caja. Las consultas con IA se prueban desde [NodiaAI](nodiaAI.md).

En producción se limitan las acciones a las lecturas solicitadas. Usar un
entorno aislado para mutaciones, simulación de errores y control de reloj.

## Preparación

- Crear dos alojamientos sintéticos aislados con eventos distinguibles para
  la misma ventana en `America/Santiago`. Mantener una sola sesión personal
  de `super_admin`, aunque un alojamiento sintético pertenezca a otra cuenta.
- Para confirmación y cancelación, usar una estadía directa de dos noches de
  CLP 100.000 cada una, abono de CLP 40.000 y una política de prueba con un
  tramo de devolución del 50 % aplicable a la fecha del aviso. Seleccionar
  explícitamente entrada, salida y horarios. Fijar el reloj del laboratorio
  donde el caso dependa de la hora actual.
- Usar un contacto, una referencia externa y movimientos monetarios
  sintéticos. Registrar únicamente IDs y resultados de operaciones autorizadas.

## Casos

| Caso | Tipo | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- | --- |
| ARR-01 · Alcance de alojamiento | Lectura | Abrir dos alojamientos autorizados y cambiar entre ellos en la misma ventana de fechas. Recargar el destino con el alojamiento seleccionado y abrir el detalle de una reserva. | Cada vista carga la identidad y los eventos del alojamiento elegido. El cambio no conserva la reserva del alojamiento anterior. Verificar ruta, IDs y alcance de las lecturas. |
| ARR-02 · Agenda, calendario y detalle | Lectura | Sobre una reserva confirmada de duración conocida, comparar Agenda, Mes y Semana. Abrir su ficha y reducir el ancho del navegador. | La ocupación civil termina antes de la noche de salida. La ficha conserva el alojamiento, la reserva, los horarios y el saldo. El contenido se adapta o desplaza dentro de su región. Registrar fecha civil, zona y estado. |
| ARR-03 · Borrador, abono y confirmación | Aislado | Crear la reserva directa del fixture completando Estadía, Huésped y Acuerdo. Revisar disponibilidad tras guardar. Intentar confirmar sin abono, registrar CLP 40.000 como pago recibido y volver a confirmar. | El borrador no ocupa fechas, ingresar el pago no lo confirma por sí solo y el abono insuficiente bloquea confirmar. Después de confirmar, el saldo a cobrar es CLP 160.000, la reserva ocupa sus noches y el detalle conserva el pago. |
| ARR-04 · Conflicto y bloqueo | Aislado | Preparar una reserva confirmada y un bloqueo activo en una ventana distinta. Crear un borrador que interseque la primera y otro que interseque el bloqueo. Intentar confirmar ambos con los acuerdos válidos. | El servidor vuelve a comprobar disponibilidad y rechaza ambos conflictos sin crear otra ocupación. Los registros existentes permanecen visibles. Conservar para cada intento el resultado de disponibilidad y el error de confirmación. |
| ARR-05 · Preparación y estadía | Aislado | Preparar una salida y una entrada en el mismo día con horarios compatibles. Registrar recambio y hora prevista, aprobar la transición, completar limpieza y registrar hora efectiva. Intentar iniciar antes de la entrada y completar antes de la salida con reloj controlado. | La transición requiere plan y aprobación vigentes. Iniciar se habilita en su ventana con preparación efectiva. Completar sólo procede al llegar la salida acordada. Cotejar estados, horarios y cambios de preparación. |
| ARR-06 · Cancelación y devolución | Aislado | En una reserva directa confirmada con CLP 40.000 recibidos, abrir la vista previa de cancelación con la fecha de aviso válida para el tramo del 50 %. Confirmar la cancelación y registrar una devolución real sintética de CLP 12.000. | El preview calcula CLP 20.000 sin cambiar caja. Cancelar libera disponibilidad y deja CLP 20.000 por devolver. Después de registrar la devolución quedan CLP 8.000 pendientes, saldo de estadía 0 y caja neta de la reserva CLP 28.000. Guardar IDs y resumen del ledger. |
| ARR-07 · Caja y liquidación de plataforma | Aislado | Preparar otra reserva con canal Airbnb, importe bruto CLP 200.000, comisión CLP 6.000, referencia y condiciones sintéticas. Confirmar, registrar la liquidación neta de CLP 194.000 y sumar un gasto pendiente de CLP 10.000. Marcarlo pagado dentro del mismo período. | La caja parte de CLP 194.000 para este conjunto, sin duplicar bruto ni comisión. El gasto pendiente se muestra separado y el total queda en CLP 184.000 cuando se paga. Comparar con fechas efectivas y registros de origen. |
| ARR-08 · Recuperación de guardado | Aislado | Provocar un rechazo controlado al guardar un borrador y corregirlo. Con el transporte del laboratorio, descartar la respuesta de un registro monetario después de su confirmación en Server. Desde el mismo contexto, usar la opción de consultar el resultado de esa intención. | Ante el rechazo se conserva el formulario. Recuperar la intención consulta el resultado previo con la misma clave y el actor original. Verificar una sola operación monetaria y su recibo. |

## Fuentes

- Estados, disponibilidad, preparación, dinero y recuperación. [Contratos de Reservas](../mvp/28-rental-reservations-contracts.md).
- Calendario, ficha y operación móvil. [Plan de Reservas](../mvp/36-reservations-redesign-proposal.md).
- Recuperación de intenciones en Client. [Plan Client de Reservas](../mvp/30-rental-reservations-client-plan.md).
- Alcance de `super_admin` y autoría real. [Autoridad transversal](../mvp/54-nodia-ai-ai08-transversal-authority.md).
