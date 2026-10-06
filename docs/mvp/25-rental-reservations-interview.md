# Reservas de alojamiento — entrevista de dominio

> Estado: en revisión — requisitos registrados y ERD 27 aceptado; contratos/planes en revisión
> Actualización: 2026-10-04
> Dependencias: [01](01-interview.md), [02](02-prd-v1.md), [03](03-domain-model-erd.md), [05](05-sitemap.md); Finanzas personales [20](20-personal-finance-interview.md) solo si se propone integración


## Aceptación del esquema y etapa actual — 2026-10-04

El usuario aceptó explícitamente el [ERD 27](27-rental-reservations-erd.md) y solicitó incorporarlo al JSON de Obsidian y comenzar con Backend. Se añadió el esquema al diagrama y a 03, con respaldo exacto y conservación de objetos anteriores. La aceptación comprende colaboradores operativos por casa, preparación simple sin inventario, días calendario locales para cancelación directa, devolución sobre dinero pagado y redondeos de importes descritos en 27. Tarifas, horarios y valores de tramos siguen configurables; no se inventan datos de la futura casa.

[Contratos28](28-rental-reservations-contracts.md) y [plan Backend 29](29-rental-reservations-backend-plan.md) concretan comandos, casos especiales y tareas para agentes; conservan estado de revisión. El plan Client se prepara después, según la secuencia solicitada. No se aprueba automáticamente toda esta especificación ni los ADRs y no se ha implementado código de Reservas. Las propuestas históricas siguientes se interpretan con esa aceptación y el ERD como referencia vigente.
## Contexto confirmado

- El usuario solicita un nuevo módulo dentro de Tools para gestionar reservas de alojamiento de corta estancia, tipo Airbnb.
- En el futuro tendrá una casa para arrendar por días y necesita gestionar las fechas de estadía.
- Es nuevo en esta actividad y solicita ayuda para identificar qué información adicional registrar.
- Se arrendará la **casa completa**; no habitaciones por separado.
- Los canales iniciales serán **WhatsApp, Airbnb y Facebook**.
- La primera versión debe incluir **control monetario**, además de fechas y huéspedes.
- Moneda confirmada: **pesos chilenos (CLP)**.
- Para reservas directas, se exigirá un **abono inicial variable**: el usuario menciona 20% en baja demanda y hasta 100% en alta demanda, para reducir el impacto de cancelaciones sobre otras oportunidades de reserva. Son ejemplos, no porcentajes exclusivos ni reglas automáticas de temporada.
- La posibilidad de salida y entrada el mismo día depende de la preparación. El usuario solicita un lugar para registrar si hay recambio inmediato de frazadas/ropa de cama sin esperar el lavado.
- Tras explicar noches y horarios, el usuario confirmó **cobro por noches con horarios de entrada/salida configurables**. Su suposición inicial de bloques de 24  horas queda sustituida por esta respuesta.
- Para reservas directas, la política de cancelación se definirá según **cuántos días antes de la entrada se avise**; tramos y porcentajes todavía no definidos.
- Sobre el detalle de ropa de cama, contestó «sí» a una pregunta con dos alternativas. Se interpreta provisionalmente como registro simple de recambio disponible; no es una confirmación inequívoca de conteo de inventario.
- El propietario podrá **agregar colaboradores para administrar la casa**, siguiendo la experiencia de Business.
- Se registrarán **gastos de la casa cuando existan**, como limpieza, lavandería, reparaciones y servicios; no exigir gastos para crear reservas.
- Estas respuestas no confirman integración automática con plataformas, sitio público para huéspedes, cobros automáticos, tarifas concretas ni valores de los tramos de cancelación.

## Interpretación operativa de las respuestas

Se interpreta que el anfitrión registrará manualmente en Nodia las reservas procedentes de esos canales. Airbnb o Facebook son el origen de la reserva, no una integración implementada. No se ha confirmado captura automática, sincronización de calendarios ni lectura de conversaciones.

En ese flujo manual, el anfitrión debe mantener también la disponibilidad publicada en Airbnb cuando registre una reserva directa, y cargar en Nodia las reservas recibidas por Airbnb. La protección de solapamientos en Nodia solo cubre los registros que conoce; no garantiza disponibilidad coordinada con plataformas externas.

La casa completa constituye una unidad arrendable: dos reservas que ocupen disponibilidad no pueden coincidir. La salida y entrada en el mismo día es condicional, con recambio y limpieza. Los valores concretos de horarios se configurarán en la casa; el registro simple de recambio fue presentado y aceptado en ERD 27.

## Aclaración verificada: noches, horarios y canales

Consulta a documentación oficial de Airbnb el 2026-10-04:

- Airbnb calcula el alojamiento con **precio por noche y cantidad de noches**; su cálculo del importe para anfitriones contempla cargos y deducciones. Fuente: [cálculo de liquidaciones](https://www.airbnb.com/help/article/3389).
- Entrada y salida tienen horarios propios. Cuando no se especifican, Airbnb indica 15:00 para entrada y 11:00 para salida, salvo indicación del anfitrión. No se adoptan estos horarios automáticamente en Nodia. Fuente: [horarios de entrada y salida](https://www.airbnb.com/help/article/3433).
- Por tanto, una noche no supone entregar 24  horas desde la llegada. Ejemplo propuesto: entrar el viernes a las 15:00 y salir el sábado a las 11:00 es una noche, con un intervalo posterior para preparar la casa.
- El abono configurable de reservas directas no debe trasladarse a cobros externos de reservas Airbnb. Airbnb prohíbe en general pagos de reservas fuera de su plataforma, con excepciones específicas que no se presuponen aplicables a esta casa. Fuente: [política sobre actividad fuera de plataforma](https://www.airbnb.com/help/article/2799).
- Las cancelaciones de Airbnb siguen la política aplicable a la reserva y sus reglas de plataforma; no reemplazarlas con la política de reservas directas. Fuente: [consulta de la política de cancelación](https://www.airbnb.com/help/article/149).

Decisión funcional confirmada después de esta explicación: **cobro por noches y horarios de entrada/salida separados**, configurables para la casa. Propuesta técnica: conservar en cada reserva los horarios acordados, incluidas excepciones, sin que editar los horarios de la casa altere estadías ya confirmadas. Los horarios del ejemplo no están confirmados como valores de la casa.

## Evidencia del proyecto

- Nodia dispone de `module_groups`, `modules` y asignación de módulos a usuarios. Tools puede utilizar ese mecanismo; no necesita otro sistema de navegación.
- El catálogo de rutas del cliente y el router revisados no contienen una ruta de reservas. No se encontró un dominio de reservas implementado en los archivos examinados.
- La navegación propuesta es **Tools → Reservas**. Keys, traducciones y ruta se definirán al cerrar el alcance; no se ha creado ni sembrado el grupo.
- La autorización general para desarrollar permanece vigente. Las preguntas siguientes recogen requisitos de negocio; no solicitan permiso para programar ni aprueban documentos.
- Business ya tiene propietario y colaboradores relacionados con usuarios existentes; `business_collaborators` incluye `position`, `action_ids` e `is_active`. Su detalle/listado utiliza pertenencia y contempla acceso de superadministrador. Su servicio asigna colaboradores desde propietario/superadministrador. Esta evidencia no demuestra que todas sus operaciones tengan el mismo ámbito.
- La decisión previa de acceso global a productos/facturas/archivos de Negocios conserva su alcance. No se modifica Business ni se extiende automáticamente ese acceso a Reservas. La propuesta de datos compartidos por casa se registra en [ADR-012](../architecture/decisions/ADR-012-rental-property-collaboration.md).

## Propuesta de primera versión, pendiente de confirmar

Herramienta de gestión para el anfitrión y sus colaboradores, propuesta con registro manual de reservas y acceso autenticado. Comenzar con una casa completa, conservando la asociación de cada reserva a una propiedad para poder ampliar después sin rehacer la historia. Casa completa, canales, CLP, noches, abono variable, cancelación según anticipación, registro de preparación, colaboradores y gastos están confirmados; capacidades detalladas y reglas siguientes siguen como propuesta. Alcance consolidado en [26-rental-reservations-spec.md](26-rental-reservations-spec.md).

| Área | Información o comportamiento propuesto |
|---|---|
| Propiedad | Nombre, ubicación, zona horaria, capacidad máxima y horarios habituales de entrada/salida |
| Calendario | Disponibilidad, próximas entradas/salidas, reservas y bloqueos de fechas |
| Reserva | Propiedad, huésped responsable, contacto, entrada, salida, cantidad de huéspedes, origen y notas |
| Importes | Control monetario confirmado; se propone precio acordado de la estadía, cargos adicionales, descuentos y total; pagos y devoluciones registrados por separado |
| Seguimiento | Estado de reserva independiente del estado de cobro |
| Bloqueos | Uso propio, mantenimiento o preparación entre estadías, con período y motivo |
| Preparación entre estadías | Recambio de ropa de cama, limpieza y hora prevista en que la casa estará lista; detalle por confirmar |
| Colaboradores | Usuarios agregados por el propietario para administrar esa casa |
| Gastos | Concepto, monto, fecha y estado; opcionalmente relacionados con una reserva |

Nombre y contacto del responsable bastan como punto de partida propuesto. No exigir documentos de identidad, datos de tarjetas ni información sensible de todos los acompañantes sin una necesidad definida. Cantidad de adultos/niños, mascotas, hora prevista de llegada y requerimientos especiales quedan como opciones por validar.

El lugar para registrar recambio de ropa de cama y los gastos operativos se incorporan al alcance funcional. Un inventario con conteos, un sistema completo de tareas, notificaciones externas, contratos, depósitos por daños y tarifas estacionales automáticas no están confirmados para la primera versión.

### Experiencia propuesta

- **General:** próximas entradas/salidas, cobros pendientes y resumen del dinero efectivamente recibido. Separar los importes de reservas confirmadas de los pagos recibidos.
- **Calendario:** vista principal de disponibilidad de la casa, reservas y bloqueos; crear o consultar una reserva desde su período.
- **Reservas:** listado con búsqueda/filtros, origen y estados; ficha o modal con huésped, fechas, importes e historial de pagos.
- **Configuración de la casa:** capacidad, horarios y reglas de preparación; definir precio habitual solo si se confirma su uso.
- **Preparación:** recambio y limpieza relacionados con la próxima entrada, distinguiendo planificación de disponibilidad real.
- **Gastos:** captura cuando existan; filtros por fecha, concepto/estado y reserva opcional.
- **Colaboradores:** administración de usuarios asociados a la casa por su propietario.

Los pagos se registran dentro de la reserva. No exigir mantener un módulo financiero separado para saber cuánto debe un huésped. El tipo de vista de calendario, tabs y disposición final no están confirmados.

## Reglas propuestas que evitan errores operativos

1. **Estadías por noches:** entrada el 10 y salida el 13 representan tres noches. La fecha de salida no cuenta como noche ocupada. El cálculo usa fechas locales de la propiedad, no diferencias de milisegundos afectadas por cambios de hora.
2. **Disponibilidad de la casa completa:** reservas que ocupan disponibilidad y bloqueos deben impedir solapamientos sobre la misma casa. No se incorpora inventario de habitaciones a esta primera versión.
3. **Preparación entre estadías:** salida y entrada el mismo día solo si la planificación de recambio/limpieza y el intervalo entre horarios lo permiten. Si hace falta una noche intermedia, representar ese bloqueo explícitamente. Ropa de cama limpia no significa por sí sola que la casa esté lista.
4. **Consulta versus reserva:** una consulta o cotización no bloquea automáticamente el calendario. Si se desean reservas tentativas, definir su vencimiento y cuándo liberan disponibilidad.
5. **Reserva y cobro independientes:** propuesta de estados de reserva: confirmada, en estadía, finalizada y cancelada. Estados de cobro derivados de importes y pagos; no convertir una reserva en cancelada por tener saldo pendiente.
6. **Historia comercial:** cambiar una tarifa de la propiedad no debe cambiar el precio ya acordado de una reserva. Registrar los importes acordados en la propia reserva.
7. **Cancelación y devolución:** cancelar libera disponibilidad, pero no borra pagos ni supone que el dinero ya fue devuelto. Si hay pagos, registrar devoluciones reales y reglas comerciales por separado.
8. **Concurrencia:** la disponibilidad debe protegerse en el servidor y en PostgreSQL al crear o cambiar fechas/estados/bloqueos. Comprobarla únicamente en el calendario o antes de guardar no evita dos reservas simultáneas.
9. **Reintentos:** concretar un mecanismo de idempotencia antes de implementar creación de reservas y registro de pagos, para no duplicar operaciones tras una respuesta incierta.
10. **Propiedad de datos:** la casa tiene propietario y colaboradores agregados por él; información operativa compartida dentro de esa casa. Autor de un gasto/pago no es el propietario exclusivo de ese registro. El acceso compartido deliberado de Negocios no se extiende automáticamente a huéspedes y reservas.

Estas reglas son propuestas, no decisiones aprobadas ni garantías implementadas. La solución técnica de concurrencia y el modelo definitivo se evaluarán en un ADR y ERD después de cerrar el dominio.

## Pagos e integración con Finanzas

Controlar pagos en Reservas significa registrar abonos, pagos y devoluciones; no implica ejecutar cobros bancarios ni conectar una pasarela.

El control de importes, CLP y abono inicial variable para reservas directas están confirmados. Cancelaciones directas según anticipación confirmadas; pendientes tramos, porcentajes; la base sobre dinero pagado quedó aceptada en 27. Queda por definir vencimiento del abono/saldo y tratamiento del cobro según el canal. Una reserva procedente de una plataforma puede requerir distinguir total de huésped, comisión y monto recibido por el anfitrión; no dar por equivalentes esas cantidades ni fijar un porcentaje de comisión.

### Abono variable — alcance confirmado y detalle propuesto

- Confirmado: exigir abono para reservas directas y permitir que varíe según demanda/acuerdo; 20% y 100% son ejemplos del usuario.
- Propuesto: establecer porcentaje o monto requerido por reserva, mostrar su equivalente en CLP y conservar el acuerdo. Importes en pesos enteros; concretar el redondeo si se usa porcentaje antes de implementar.
- Propuesto: guardar abono requerido y dinero recibido por separado. Una promesa de transferencia no cuenta como pago.
- Propuesto: confirmar una reserva directa cuando el propietario registre la recepción del abono suficiente. Definir qué ocurre con las fechas mientras se espera: sin bloqueo o con retención temporal y vencimiento; no mantener bloqueos indefinidos.
- Para Airbnb, registrar la confirmación de la plataforma independientemente de cuándo liquide al anfitrión. No exigir un abono directo ni tratar la demora en la liquidación como falta de confirmación.
- No convertir el objetivo de proteger otras reservas en una regla automática de «abono no reembolsable». Porcentaje anticipado y condiciones de cancelación son acuerdos distintos. La estructura por anticipación está confirmada; los valores de retención/devolución de reservas directas permanecen pendientes.

Ejemplo CLP para reserva directa vigente de $200.000: con abono requerido de 20%, se esperan $40.000 iniciales y quedan $160.000 después de recibirlos; con 100%, se esperan $200.000 iniciales y saldo cero tras recibirlos. No son tarifas reales ni una política de cancelación.

### Cancelación según anticipación — estructura confirmada, valores propuestos

Proponer una política configurable para reservas directas con tramos de anticipación y porcentaje a devolver. Las reglas de Airbnb se registran como las de esa plataforma, no como esta política directa.

Ejemplo para visualizar la configuración; **no son valores confirmados ni una política aplicada**:

| Anticipación respecto a la entrada | Porcentaje propuesto para el ejemplo |
|---|---|
| 14 días o más | Devolver 100% de lo pagado |
| De 7 a 13 días | Devolver 50% de lo pagado |
| De 0 a 6 días | Devolver 0% de lo pagado |

Los días y porcentajes se editarían en la configuración; no constituyen un catálogo fijo de temporadas. Proponer que la devolución se calcule sobre el **dinero efectivamente pagado por el huésped**, no sobre el precio total de una estadía que todavía no pagó. Ejemplo: reserva de $200.000 con $40.000 pagados; devolver 50% de lo pagado equivale a $20.000, no a $100.000. Base de cálculo pendiente de confirmar; no generar automáticamente deudas adicionales por cancelación.

Detalle de comportamiento propuesto:

- Conservar en cada reserva la política acordada al confirmar. Cambiar las reglas generales afecta acuerdos nuevos; no cambia silenciosamente las condiciones de reservas ya confirmadas.
- Mostrar al registrar cancelación: fecha efectiva del aviso, anticipación, tramo aplicable, base de cálculo, monto a devolver y monto retenido.
- Separar fecha efectiva del aviso de la fecha de captura en Nodia. Si se registra después, no reducir artificialmente la anticipación del huésped. Conservar trazabilidad de correcciones.
- Precisar antes de implementar si los días son diferencias de fechas locales o períodos completos de 24  horas respecto al check-in. No mezclar ambas interpretaciones en los límites de tramos.
- Exigir tramos sin solapamientos ni huecos y definir explícitamente qué ocurre exactamente en cada umbral. Cancelaciones posteriores a la entrada/no presentación requieren una regla separada, pendiente.
- Calcular propuesta de devolución y confirmar la cancelación de forma coherente. Cancelar libera disponibilidad; una devolución pendiente sigue siendo pendiente hasta registrar la salida real del dinero.
- Conservar pagos originales y devoluciones efectuadas. Evitar duplicar devoluciones ante reintentos y descontar lo ya devuelto del monto pendiente.

Todavía no se ha elegido una política concreta para los huéspedes. La estructura se puede implementar como configuración cuando se cierre su contrato, sin fijar los porcentajes ilustrativos en las reglas del producto.

### Registro monetario propuesto

- Guardar el monto acordado de cada reserva y, si se utiliza tarifa por noche, conservar el desglose acordado en ese momento.
- Permitir varios pagos por reserva: monto, fecha efectiva, medio y referencia opcional. Fecha efectiva distinta de `created_at`, para poder registrar hoy un pago recibido anteriormente.
- Registrar devoluciones por separado, conservando el pago original. Corregir errores con trazabilidad; no sobrescribir dinero recibido como si no hubiera existido.
- Calcular saldo a partir del importe exigible y los pagos aplicables; no permitir editar el saldo manualmente.
- Si una plataforma cobra al huésped, distinguir ese cobro de la liquidación recibida por el anfitrión. No sumar ambos como dos ingresos.
- Registrar gastos de limpieza, reparaciones o servicios cuando existan. Separar pendientes de pagados. El resumen compara cobros recibidos, devoluciones efectuadas y gastos pagados; denominarlo resultado de caja del período, sin presentarlo como utilidad contable completa.

Ejemplo didáctico en CLP, sin confirmar tarifa: una reserva directa vigente de cuatro noches a $50.000 suma $200.000; un abono recibido de $60.000 deja $140.000 pendientes, si no existen cargos, descuentos ni devoluciones. Cancelaciones y liquidaciones de plataformas requieren su propia regla de importe exigible; este ejemplo no define su cálculo.

No crear movimientos automáticos en Finanzas personales todavía. Antes de integrar, decidir cuándo se reconoce una entrada, cómo se representa una devolución y cómo impedir duplicados. Su modelo actual no distingue la fecha de captura de la fecha efectiva de cobro; revisar ese límite si se requieren reportes por período real de pagos. CLP fue confirmado expresamente para Reservas; no cambia las reglas de Finanzas.

## Colaboradores — alcance confirmado y propuesta de acceso

- Confirmado: el propietario agrega personas para que también administren la casa, con experiencia similar a Business.
- Propuesto: utilizar usuarios existentes y activos de Nodia. Agregar una relación a la casa no crea automáticamente una cuenta ni envía invitaciones externas.
- Propuesto: colaboradores operativos pueden gestionar reservas, pagos/devoluciones, gastos, bloqueos y preparación. El propietario conserva gestión de colaboradores y configuración general de la casa. No se solicita un catálogo de permisos por cada acción para esta primera versión.
- Propuesto: revocar/desactivar pertenencia impide nuevas operaciones y futuras lecturas remotas; conserva los registros creados por ese usuario y su autoría.
- Registrar quién creó/confirmó/corrigió operaciones, especialmente monetarias. Caches/selector de casa no conceden acceso por sí solos; validar pertenencia desde el servidor en listados, detalles, agregados y mutaciones.
- No vincular una casa obligatoriamente a `businesses` ni crear colaboradores globales para todas las casas. La experiencia se reutiliza; el ámbito y los datos pertenecen a Reservas.

## Gastos — alcance confirmado y propuesta mínima

- Captura manual opcional, sin gastos recurrentes automáticos ni filas de gastos ficticias.
- Campos propuestos: casa, concepto, monto en CLP, fecha del gasto, estado pendiente/pagado/anulado, fecha efectiva de pago cuando proceda, nota opcional y reserva relacionada opcional.
- Gastos de limpieza de una estadía pueden asociarse a su reserva; servicios/reparaciones generales pueden quedar asociados solo a la casa. No exigir una reserva para registrar un gasto.
- La reserva relacionada debe pertenecer a la misma casa. Propietario/colaboradores comparten la vista del gasto; registrar autor no convierte el gasto en personal.
- Solo gastos pagados afectan caja. Conservar anulaciones y trazabilidad de correcciones; no tratar `is_active` como borrado de dinero.
- Registrar categorías solo si aportan al filtro/resumen; propuesta de categorías editables, no inventario ni contabilidad general.
- Si un pago Airbnb se registra por su importe neto, la comisión ya deducida no se resta otra vez como gasto. Diferenciar detalle informativo de comisión de salida efectiva de caja.

## Preparación y ropa de cama

Necesidad confirmada: registrar si es posible cambiar frazadas/ropa de cama inmediatamente para una nueva estadía, sin depender de lavar lo que acaba de usarse.

Primera propuesta simple, por recambio entre estadías. Se adopta provisionalmente esta alternativa a partir del «sí» ambiguo del usuario y se comunica esa interpretación; no se declara confirmado un inventario:

| Dato | Propuesta |
|---|---|
| Próxima entrada | Reserva y fecha/hora para la que se prepara la casa |
| Recambio completo disponible | Sí, no o por confirmar; debe alcanzar para las camas que se prepararán |
| Limpieza | Pendiente, en proceso o lista |
| Casa lista desde | Fecha/hora prevista; distinguir de la confirmación real de casa preparada |
| Notas | Falta de ropa limpia, lavado previsto u otra condición operativa |

Una reserva futura puede planificarse antes de que se efectúe la limpieza. No exigir casa físicamente lista hoy para confirmar una entrada dentro de meses; sí revisar y aceptar explícitamente el plan cuando haya salida/entrada el mismo día. La confirmación del plan no equivale a marcar la limpieza como realizada.

Alternativa futura si el usuario la solicita: contar juegos limpios, en uso y en lavado, diferenciados por tipo/tamaño si resulta necesario. No inferir que una cifra total de frazadas garantiza recambio completo ni asumir un sistema de inventario a partir de la solicitud inicial. El registro de stock actual tampoco garantiza existencias en una fecha futura.

No bloquear siempre una noche ni habilitar recambio inmediato para todas las reservas mediante un único switch permanente. La condición se evalúa para cada transición entre estadías; concretar cuánto de esa evaluación será manual en la primera versión.

## Respuestas iniciales — 2026-10-04

1. Unidad arrendable: «casa completa».
2. Canales: «por ahora seria por whats y airbnb o face».
3. Control monetario: «si seria bueno tener controlado lo monetario».

## Segunda ronda de respuestas — 2026-10-04

1. Pesos chilenos confirmados. El usuario desconoce cómo cobra Airbnb y plantea que un día podría ser 24  horas desde la llegada; se explica el modelo por noches sin dar por aprobada su adopción.
2. Abono inicial variable, con ejemplos de hasta 100% en alta demanda y 20% en baja demanda para proteger oportunidades de reserva. Retención/devolución no confirmada.
3. Entrada y salida el mismo día dependen del recambio de frazadas; se pide un lugar para registrar su disponibilidad sin esperar al lavado.

## Tercera ronda de respuestas — 2026-10-04

1. «sí» al modelo de noches y horarios configurables.
2. «sí» a la pregunta de registro simple o conteo: interpretación provisional comunicada de registro simple; respuesta no inequívoca sobre inventario.
3. «definirla basado cuantos dias con anticipacion cancelen»: cancelación por tramos de anticipación confirmada, sin valores específicos.

## Cuarta ronda de respuestas — 2026-10-04

1. «colaboradores como tenemos con la seccion de business»: otras personas podrán administrar si el propietario las agrega.
2. «registremos esos gastos si es que se necesita»: gastos incluidos con captura cuando existan.

## Alcance consolidado y detalles configurables

La [especificación funcional 26](26-rental-reservations-spec.md) reúne el alcance confirmado y propuestas concretas para preparación, acceso y caja. El [ADR-012 propuesto](../architecture/decisions/ADR-012-rental-property-collaboration.md) aborda el ámbito compartido por casa y la separación de Business/Finanzas personales. Ninguno está aprobado automáticamente.

Los tramos de cancelación pueden quedar configurables; el ejemplo anterior no requiere aprobarse como regla fija para poder seguir especificando el módulo. El ERD 27 aceptado concreta base sobre pagado, días calendario locales y redondeo; contratos 28 detallan comandos antes de implementar.

## Preguntas posteriores según las respuestas

- ¿En qué lugar estará la casa y cuántas personas podrá alojar?
- ¿Cómo se trata una cancelación y una devolución, y cuándo vence el saldo de una reserva directa?
- ¿Cuándo vence el abono y se retienen temporalmente las fechas mientras se espera?
- ¿Se necesitan reservas tentativas con fecha de vencimiento?
- ¿Se conservarán contactos reutilizables de huéspedes o basta una ficha en cada reserva?

No todas estas preguntas bloquean una primera versión. Unidad arrendable, canales, control monetario, CLP, noches, abono variable, cancelación según anticipación, colaboradores, gastos y necesidad de registro de preparación están respondidos. Registro simple de ropa de cama es una inferencia comunicada. Datos futuros de la casa y valores de políticas pueden configurarse posteriormente; semántica de contratos/reglas debe concretarse antes de implementar los comportamientos afectados.

## Continuidad

Las cuatro rondas de respuestas están registradas y el alcance funcional consolidado en documento 26. ERD 27 incorporado; documentos 03/05/06/07/11/12 reconciliados. Continuar desde contratos 28 y tareas Backend 29 con pruebas de negocio; después plan Client. Se conserva revisión documental de los añadidos. Backend implementado y verificado aisladamente según 29; migración/seed de la BD objetivo y Client pendientes.

Esta entrevista conserva el contexto funcional; la implementación Backend y su evidencia posterior están en 29. No se modificó la BD objetivo ni se integraron plataformas externas; no se aprueba automáticamente el módulo.
