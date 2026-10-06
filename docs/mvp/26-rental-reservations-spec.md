# Tools → Reservas — primera versión funcional

> Estado: en revisión — borrador; no aprobado ni implementado
> Fecha: 2026-10-04
> Dependencias: [entrevista 25](25-rental-reservations-interview.md), [modelo global 03](03-domain-model-erd.md), [sitemap 05](05-sitemap.md), [ADR-012 propuesto](../architecture/decisions/ADR-012-rental-property-collaboration.md)


## Aceptación del esquema y etapa actual — 2026-10-04

El usuario aceptó explícitamente el [ERD 27](27-rental-reservations-erd.md) y solicitó incorporarlo al JSON de Obsidian y comenzar con Backend. Se añadió el esquema al diagrama y a 03, con respaldo exacto y conservación de objetos anteriores. La aceptación comprende colaboradores operativos por casa, preparación simple sin inventario, días calendario locales para cancelación directa, devolución sobre dinero pagado y redondeos de importes descritos en 27. Tarifas, horarios y valores de tramos siguen configurables; no se inventan datos de la futura casa.

[Contratos28](28-rental-reservations-contracts.md) y [plan Backend 29](29-rental-reservations-backend-plan.md) concretan comandos, casos especiales y tareas para agentes; conservan estado de revisión. El plan Client se prepara después, según la secuencia solicitada. No se aprueba automáticamente toda esta especificación ni los ADRs y no se ha implementado código de Reservas. Las propuestas históricas siguientes se interpretan con esa aceptación y el ERD como referencia vigente.
## Resultado esperado

El propietario y las personas que agregue como colaboradores pueden administrar una casa completa arrendada por noches: conocer disponibilidad, registrar reservas de WhatsApp/Airbnb/Facebook, controlar pagos y devoluciones en CLP, preparar la casa y registrar gastos cuando existan.

El alcance proviene de las respuestas del usuario en documento 25. Los campos, capacidades y detalles operativos siguientes son propuestas concretas para revisión; no se atribuyen al usuario como decisiones textuales.

## Actores y datos compartidos

La unidad de gestión es **la casa**. Reservas, pagos, gastos, preparación y bloqueos pertenecen a esa casa. Un colaborador ve la misma operación que el propietario; no se crean copias personales de las reservas.

| Operación propuesta | Propietario | Colaborador activo |
|---|---|---|
| Consultar calendario, reservas, contactos y resumen monetario | Sí | Sí |
| Crear/editar/cancelar reservas y registrar pagos/devoluciones | Sí | Sí |
| Registrar gastos, bloqueos y preparación | Sí | Sí |
| Configurar casa, horarios y políticas generales | Sí | No |
| Agregar/reactivar/retirar colaboradores | Sí | No |

Esta matriz propone un colaborador operativo, sin catálogo granular por acción. La solicitud de experiencia similar a Business no confirma heredar su `action_ids`, su acceso global ni privilegios especiales de superadministrador sobre casas ajenas. Seleccionar usuarios existentes de Nodia; alta de cuentas y visibilidad del módulo siguen la administración actual. No enviar correo/WhatsApp ni crear invitaciones externas como efecto incidental.

Toda operación debe validar sesión y acceso real a la casa desde Server. Tener el módulo asignado habilita la navegación; no concede pertenencia a todas las casas. Retirar un colaborador conserva datos/autoría, pero impide acceso remoto posterior. Las escrituras concurrentes con revocación necesitan una regla transaccional explícita en los contratos.

## Pantallas propuestas

Una entrada **Tools → Reservas**, con selector de casa cuando el usuario tenga más de una accesible. Hoy se comienza con una casa; no obligar a crear un Business.

| Sección | Contenido |
|---|---|
| General | Próximas entradas/salidas, preparación pendiente, cobros pendientes y resultado de caja del período |
| Calendario | Reservas y bloqueos; disponibilidad y revisión de salidas/entradas del mismo día |
| Reservas | Tabla, búsqueda y filtros por fechas, origen y estado; creación/edición en modales |
| Preparación | Recambio de ropa de cama, limpieza y casa lista desde una fecha/hora |
| Gastos | Gastos de la casa, pagados/pendientes/anulados y relación opcional con una reserva |
| Colaboradores | Personas agregadas, activación/desactivación y acceso operativo |
| Configuración | Datos de casa, capacidad, zona horaria, horarios y políticas editables |

Pagos y devoluciones se consultan/registran dentro de cada reserva. La disposición de tabs y ruta técnica se fijará con ERD/contratos y especificación de rutas; este documento no crea rutas activas.

Aplicar MUI/Emotion, i18n ES/EN, inputs reutilizables y modales existentes. Boneyard solo para primera carga informativa; revalidación suave, controles deshabilitados en peticiones, estados vacío/error, toasts y preservación de formulario al fallar. Calendario y tablas deben ser utilizables en móvil; no depender únicamente de colores para representar estados.

## Información mínima propuesta

| Registro | Información |
|---|---|
| Casa | Propietario, nombre, ubicación, zona horaria, capacidad, horarios y configuración comercial |
| Colaborador | Casa, usuario existente, estado y autoría de asignación |
| Reserva | Casa, responsable/contacto, cantidad de huéspedes, entrada/salida, horarios acordados, canal, referencia opcional, estado, notas, importes y política acordados |
| Pago/devolución | Reserva, tipo, monto CLP, fecha efectiva, medio/referencia opcional y usuario que registró |
| Bloqueo | Casa, período, motivo y autor |
| Preparación | Próxima entrada, recambio disponible/no disponible/por confirmar, estado de limpieza, hora prevista de preparación y notas |
| Gasto | Casa, concepto, monto CLP, fecha, estado, fecha efectiva de pago, categoría/nota opcionales y reserva opcional |

No exigir datos de todos los acompañantes ni documentos sensibles de identidad. Capacidad y zona horaria se configuran cuando se conozca la casa. No inferir ubicación a partir de CLP ni usar la zona del servidor para las estadías.

## Reservas y disponibilidad

- Se arrienda toda la casa: una sola ocupación a la vez. Calcular noches por fechas civiles locales, sin dividir milisegundos entre 24  horas.
- La noche de salida no cuenta como ocupada. Considerar horarios acordados y preparación si se permite una nueva entrada en esa fecha.
- La regla debe considerar tanto reservas que ocupan disponibilidad como bloqueos por uso propio/mantenimiento/preparación. Un calendario vacío no demuestra disponibilidad si la consulta falló.
- Reservas directas con abono recibido suficiente pueden confirmarse según el acuerdo registrado. Confirmación de Airbnb se registra desde su estado externo; su liquidación pendiente no deja la estadía sin confirmar.
- Consultas/cotizaciones no bloquean automáticamente. Si se introducen reservas tentativas, exigir vencimiento y liberación definidos antes de implementarlas.
- Evitar doble reserva incluso si propietario y colaborador envían peticiones simultáneas. Concretar y probar transacción/concurrencia en PostgreSQL sobre todos los caminos de escritura.
- Modificar fechas, horarios o importe de una reserva con pagos requiere revisar disponibilidad, acuerdo y efectos monetarios; no sobrescribir de forma silenciosa.

## Abonos, cancelaciones y caja

- Dinero en pesos chilenos enteros. Separar precio/acuerdo de dinero realmente recibido. Abono requerido puede variar hasta el total; 20% y 100% son ejemplos confirmados, no temporadas fijas.
- Definir porcentaje o monto de abono por reserva y conservar su equivalencia acordada. Redondeo según ERD 27 aceptado; contratos 28 detallan vencimientos y borradores que no retienen fechas.
- Cancelación directa basada en anticipación. Umbrales y porcentajes configurables; días calendario locales y base sobre dinero pagado según ERD 27; no cargar como defaults aprobados los ejemplos 14/7 días de la entrevista.
- Proponer política conservada con cada reserva. Cambios de configuración general no cambian acuerdos anteriores.
- Registrar fecha efectiva del aviso y mostrar cálculo de devolución/retención antes de confirmar. Usar días calendario locales según el modelo aceptado, sin convertirlos en períodos de 24 horas.
- Cancelar libera fechas y conserva dinero/historia. Monto a devolver es una obligación pendiente; solo la devolución efectuada afecta caja.
- Pagos recibidos, devolución real y registro de gasto deben ser trazables e idempotentes. Reintentos tras una respuesta perdida no pueden duplicar el dinero registrado.
- Para Airbnb, registrar el importe neto recibido por el anfitrión como entrada de caja y conservar comisión/desglose como información. No registrar como dos ingresos el pago del huésped y la liquidación, ni restar de nuevo una comisión ya deducida del neto.

Propuesta de indicador de **resultado de caja del período**:

`cobros efectivamente recibidos − devoluciones efectuadas − gastos pagados`

Usar fechas efectivas de esos movimientos. Mostrar pendientes aparte; no sumar el precio de una reserva todavía sin cobrar ni gastos pendientes como caja. El indicador no representa por sí solo utilidad contable, rentabilidad completa o resultado tributario. No se ejecutan cobros, devoluciones bancarias ni movimientos en Finanzas personales automáticamente.

## Gastos y preparación

Gastos manuales cuando existan; no exigirlos para reservar ni generar gastos recurrentes ficticios. Asociar opcionalmente limpieza/lavandería a una reserva; servicios/reparaciones pueden pertenecer solo a la casa. Proponer estados pendiente, pagado y anulado, con trazabilidad de correcciones. No incorporar pagos parciales de gastos ni distribución entre varias reservas sin una necesidad definida.

Para preparación, proponer el registro simple de recambio disponible y estado de limpieza. La interpretación simple fue presentada y aceptada en ERD 27; no incluye inventario. Evaluar la transición entre estadías: frazadas disponibles no garantizan limpieza terminada ni disponibilidad futura. Separar plan para una entrada futura de confirmación de casa realmente preparada.

## Límites de la primera versión

Sin integración automática con canales, lectura de chats, portal público, pasarela de cobro, inventario de ropa, tarifas estacionales automáticas, contabilidad general ni sincronización automática con Finanzas personales. No crear microservicio para este dominio. Estos límites son la propuesta de primera versión y pueden revisarse por instrucción del usuario.

En el registro manual, la coordinación con Airbnb depende del anfitrión: Nodia solo conoce sus registros. El control interno de solapamientos no sincroniza ni garantiza disponibilidad en plataformas externas.

## Validación necesaria al implementar

Casos de uso: propietario/colaborador/externo/revocado; autoría conservada; reservas simultáneas, bloqueos y cambios de fechas; noches y cambios de hora; mismo día con preparación; límites de tramos de cancelación; abonos parciales; devolución pendiente/efectuada; gastos opcionales pagados/pendientes; reintentos monetarios; asociaciones de distinta casa rechazadas; neto Airbnb sin duplicar comisión.

Client: errores con formularios preservados, inicial/refetch diferenciados, estados vacíos/error, usuario con varias casas y revocación de acceso, móvil/teclado y feedback ES/EN. PostgreSQL aislado debe demostrar constraints y carreras; mocks no prueban esas garantías.

## Continuidad y evidencia

ERD 27 aceptado e incorporado. Contratos 28, ADR-012/013 y tareas Backend29 conservan revisión documental; [plan Client30](30-rental-reservations-client-plan.md) preparado después del Backend, con revisión de tres subagentes. Documentos 03/05/06/07/11/12 reconciliados sin aprobarlos automáticamente. Datos configurables de la futura casa no necesitan inventarse para implementar formularios; RC-01 inicia la base común antes de los tres carriles Client.

Backend implementado según 28/29 y verificado con 528 pruebas de Server y PostgreSQL/HTTP aislados. Migración incremental y seed preparados; BD configurada y Client de Reservas pendientes. Ver evidencia/runbook en 29; se conserva el estado de revisión documental.
