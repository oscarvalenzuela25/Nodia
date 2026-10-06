# Reservas — contratos Backend e integración Client

> Estado: en revisión documental — Backend implementado y verificado localmente; integración Client y aplicación objetivo pendientes
> Fecha: 2026-10-04
> Dependencias: [entrevista 25](25-rental-reservations-interview.md), [especificación 26](26-rental-reservations-spec.md), [ERD 27](27-rental-reservations-erd.md), [ADR-012](../architecture/decisions/ADR-012-rental-property-collaboration.md), [ADR-013](../architecture/decisions/ADR-013-rental-integrity-and-idempotency.md)

## Alcance y evidencia

El usuario aceptó el ERD 27 y autorizó incorporarlo al JSON de Obsidian, actualizar documentación e implementar Backend en la secuencia acordada. Las rutas, migración y consultas están implementadas y verificadas en HTTP/PostgreSQL aislados según [29](29-rental-reservations-backend-plan.md). El [plan Client 30](30-rental-reservations-client-plan.md) consume estos contratos y sus fixtures ejecutables. Aceptar el ERD o implementar Server no aprueba automáticamente este documento; integración Client y migración/seed objetivo permanecen pendientes.

Se conserva el esquema aceptado: nueve tablas de dominio, dos técnicas y `users` existente; no añadir columnas de saldo, permisos por acción, tablas de ocupación, huéspedes ni invitaciones. Días calendario locales y devolución sobre dinero pagado forman parte del modelo revisado y aceptado. Los valores de tramos, tarifa, horarios y ubicación siguen configurables.

Referencias verificadas en código: `nodia-server/src/main.ts` fija `/api/v1`, query parser `qs` y `ValidationPipe` con whitelist/forbidNonWhitelisted/transform; `src/auth/types/auth.types.ts` aporta `request.auth.user.id`; `src/common/filters/all-exceptions.filter.ts` define la envolvente de errores; `src/finance-common/dto/finance-query.dto.ts` limita paginación; `src/common/utils/ransack-query.policies.ts` exige columnas públicas explícitas. [Finanzas 22](22-personal-finance-contracts.md) se reutiliza como formato, sin copiar su ausencia de deduplicación persistente ni sus fechas de dinero.

## Tipos públicos y validación

| Tipo | Representación y límites propuestos |
|---|---|
| `Id` | String decimal canónico positivo, `1..9223372036854775807`; nunca JSON number, UUID de entidad, signo, exponente o ceros iniciales |
| `Money` | CLP entero como string decimal canónico, `0..9223372036854775807`; pagos/gastos/tarifa requieren > 0; signos solo en resultados netos calculados |
| Agregado | String decimal exacto; SUM/resultados pueden superar bigint de fila, sin cast final a bigint ni conversión a `Number` |
| `Percent` | String decimal de 0 a 100 con hasta dos decimales; normalizado a dos, p. ej. `"20.00"`; convertir a puntos base enteros para calcular |
| `CivilDate` | `YYYY-MM-DD` real del calendario gregoriano, año 1900..9999; no datetime ni fechas normalizadas de forma permisiva |
| `LocalTime` | `HH:mm` de 00:00..23:59; persistir segundos cero; no inferir hora de la zona del host |
| `Instant` | ISO 8601 con offset explícito y precisión máxima de milisegundos; salida UTC `YYYY-MM-DDTHH:mm:ss.sssZ` |
| `Timezone` | Identificador IANA validado por la biblioteca de zonas efectiva, máximo 64 caracteres; no offset fijo como sustituto de zona |
| `RequestKey` | UUID v4 generado para una intención, en header `Idempotency-Key`; no columna de identidad del recurso |
| Texto | Recortar extremos; nombres/contacto/referencia/motivo 1..255, location ≤500, category/method ≤100, notes ≤5000; cadenas opcionales vacías se normalizan a null |

Rechazar campos extra en body/query/params y estructuras anidadas; no aceptar `owner_id`, actor, `property_id` dentro de un body ya delimitado por path, autoría, timestamps de captura, snapshots, sumas ni IDs generados. Usar clases DTO concretas y validación runtime de objetos anidados; `Partial<CreateDto>` y un `@IsObject()` genérico no implementan estas allowlists.

Todos los cuerpos parciales `PUT` requieren al menos un campo permitido. Campo omitido conserva el valor; `null` solo limpia campos declarados nullable, nunca significa cero/false. Boolean de body es boolean real. Query admite únicamente `true`/`false` para campos boolean cuando el contrato lo declare; no `Boolean("false")`. Integer query usa decimal canónico positivo; coerción no convierte vacío/NaN/exponente en valor válido.

Límites de servicio propuestos: cuerpo JSON 64 KiB antes del parseo; 100 reglas por política; 100 IDs por filtro/confirmación; máximo 366 noches por reserva; max_guests 1..1000; minimum_turnover_minutes 0..10080; anticipación mínima por regla 0..36500. Snapshots/operación ≤16 KiB cada uno, auditoría ≤8 KiB por evento. Estos límites son decisiones de contrato para revisar, no valores atribuidos al usuario.

## Acceso, archivo y autoría

Todas las rutas requieren el principal autenticado existente. Actor se deriva de `request.auth.user.id`. Las lecturas se filtran por `owner_id = actor` o colaborador vigente y activo; el rol administrativo de Nodia no otorga acceso transversal a casas ajenas. El caso de uso valida pertenencia también si lo llaman sin controlador. Todas las asociaciones se resuelven por `(property_id,id)`.

| Operación | Propietario | Colaborador activo |
|---|---|---|
| Consultar casa/configuración/políticas, calendario, reservas, dinero, gastos, preparación y auditoría | Sí | Sí |
| Crear/operar reservas, pagos/devoluciones, gastos, bloqueos y preparación | Sí | Sí |
| Crear su propia casa | Sí, cualquier usuario autenticado crea una casa propia | No permite crear para otra persona |
| Editar configuración de casa/políticas; agregar/reactivar/retirar colaboradores; buscar candidatos | Sí | No |
| Consultar miembros de su casa | Sí | Sí, proyección de nombre/cargo/estado sin email |
| Recuperar resultado idempotente | Sí, solo operaciones propias | Sí, solo operaciones propias y mientras conserva acceso |

ID inexistente, casa ajena, relación ajena o miembro revocado: 404 uniforme. Colaborador vigente que intenta una operación exclusiva del propietario: 403. Usuario seleccionado como colaborador debe existir y estar activo; propietario no puede agregarse a sí mismo. POST duplicado de pertenencia da 409; reactivar mediante PUT de la fila existente. No crear cuentas, enviar correos, copiar `action_ids` ni modificar acceso global de Business.

`is_active` archiva visibilidad, no dinero ni ocupación: una reserva archivada confirmed/in_progress/completed sigue ocupando su intervalo y sus pagos cuentan. En casa archivada se permiten lectura/historia, cancelación y liquidación/corrección de registros existentes, completar una estadía ya vigente, retirar colaboradores y reactivación por propietario; se rechaza crear nuevos acuerdos/reservas/bloqueos, nuevas políticas o colaboradores y confirmar drafts. Gastos reales y pagos de reservas existentes siguen registrables para no ocultar caja. Una política inactiva sigue sirviendo a snapshots históricos pero no a nuevos acuerdos.

Autoría/timestamps del ERD se derivan en Server. No borrado físico ni DELETE públicos. Desactivar un bloqueo sí libera su período; no equivale a cancelar una reserva.

## Inventario de endpoints

Todos los paths siguientes son exactos, incluyendo `/api/v1`. `:propertyId`, `:id` son `Id`; `:requestKey` es `RequestKey`. No aliases. Los endpoints de mutación requieren `Idempotency-Key`; preview es una lectura POST y no crea operación ni efectos.

| Método y path | Resultado | Autoridad |
|---|---|---|
| GET `/api/v1/rental/properties` | Casas accesibles paginadas | Sesión |
| POST `/api/v1/rental/properties` | Crea casa propia | Sesión |
| GET `/api/v1/rental/properties/:propertyId` | Casa/configuración + capacidades derivadas | Miembro |
| PUT `/api/v1/rental/properties/:propertyId` | Configura/archiva/reactiva | Propietario |
| GET `/api/v1/rental/properties/:propertyId/collaborators` | Colaboradores paginados | Miembro |
| POST `/api/v1/rental/properties/:propertyId/collaborators` | Agrega usuario existente | Propietario |
| PUT `/api/v1/rental/properties/:propertyId/collaborators/:id` | Cargo/activar/revocar | Propietario |
| GET `/api/v1/rental/properties/:propertyId/collaborator-candidates` | Usuarios activos seleccionables paginados | Propietario |
| GET `/api/v1/rental/properties/:propertyId/cancellation-policies` | Políticas paginadas | Miembro |
| POST `/api/v1/rental/properties/:propertyId/cancellation-policies` | Política + reglas atómicas | Propietario |
| GET `/api/v1/rental/properties/:propertyId/cancellation-policies/:id` | Política y reglas | Miembro |
| PUT `/api/v1/rental/properties/:propertyId/cancellation-policies/:id` | Nombre/estado/reglas atómicas | Propietario |
| GET `/api/v1/rental/properties/:propertyId/reservations` | Reservas paginadas + sumas por reserva | Miembro |
| POST `/api/v1/rental/properties/:propertyId/reservations` | Draft + preparación inicial | Miembro |
| GET `/api/v1/rental/properties/:propertyId/reservations/:id` | Reserva y cálculo monetario | Miembro |
| PUT `/api/v1/rental/properties/:propertyId/reservations/:id` | Edita campos permitidos según fase | Miembro |
| POST `/api/v1/rental/properties/:propertyId/reservations/:id/confirm` | Confirma disponibilidad/acuerdo | Miembro |
| POST `/api/v1/rental/properties/:propertyId/reservations/:id/start` | Registra entrada real como estado | Miembro |
| POST `/api/v1/rental/properties/:propertyId/reservations/:id/complete` | Registra estadía completada | Miembro |
| POST `/api/v1/rental/properties/:propertyId/reservations/:id/cancellation-preview` | Cálculo propuesto, no congela ni cancela | Miembro |
| POST `/api/v1/rental/properties/:propertyId/reservations/:id/cancel` | Cancela y fija devolución aprobada | Miembro |
| GET `/api/v1/rental/properties/:propertyId/payments` | Pagos/devoluciones paginados | Miembro |
| POST `/api/v1/rental/properties/:propertyId/payments` | Dinero efectivo | Miembro |
| GET `/api/v1/rental/properties/:propertyId/payments/:id` | Registro monetario | Miembro |
| POST `/api/v1/rental/properties/:propertyId/payments/:id/void` | Anula registro erróneo | Miembro |
| GET `/api/v1/rental/properties/:propertyId/expenses` | Gastos paginados | Miembro |
| POST `/api/v1/rental/properties/:propertyId/expenses` | Gasto pendiente o pagado | Miembro |
| GET `/api/v1/rental/properties/:propertyId/expenses/:id` | Gasto | Miembro |
| PUT `/api/v1/rental/properties/:propertyId/expenses/:id` | Edita gasto según fase | Miembro |
| POST `/api/v1/rental/properties/:propertyId/expenses/:id/pay` | Registra pago total efectivo | Miembro |
| POST `/api/v1/rental/properties/:propertyId/expenses/:id/void` | Anula captura errónea | Miembro |
| GET `/api/v1/rental/properties/:propertyId/blocks` | Bloqueos paginados | Miembro |
| POST `/api/v1/rental/properties/:propertyId/blocks` | Bloqueo de disponibilidad | Miembro |
| GET `/api/v1/rental/properties/:propertyId/blocks/:id` | Bloqueo | Miembro |
| PUT `/api/v1/rental/properties/:propertyId/blocks/:id` | Intervalo/motivo/activar/desactivar | Miembro |
| GET `/api/v1/rental/properties/:propertyId/turnovers` | Preparaciones paginadas | Miembro |
| GET `/api/v1/rental/properties/:propertyId/turnovers/:id` | Preparación y transición vigente | Miembro |
| PUT `/api/v1/rental/properties/:propertyId/turnovers/:id` | Recambio/limpieza/plan/hecho real | Miembro |
| POST `/api/v1/rental/properties/:propertyId/turnovers/:id/approve-same-day` | Aprueba plan de transición | Miembro |
| GET `/api/v1/rental/properties/:propertyId/calendar` | Reservas/bloqueos/preparación por ventana | Miembro |
| GET `/api/v1/rental/properties/:propertyId/availability` | Disponibilidad de intervalo propuesto | Miembro |
| GET `/api/v1/rental/properties/:propertyId/overview` | Caja, pendientes, próximas estadías | Miembro |
| GET `/api/v1/rental/properties/:propertyId/audit-events` | Historial paginado, proyección segura | Miembro |
| GET `/api/v1/rental/properties/:propertyId/operations/:requestKey` | Resultado de intención propia confirmada | Miembro y actor original |

## Respuestas

Lectura por ID devuelve proyección del registro. Listados: `{data:T[],meta:{page,limit,total_items,total_pages}}`, con meta numérico entero seguro; si conteo supera el rango seguro responder error de límite, nunca truncar. Proyectar solo los campos de dominio/autoría del ERD y los cálculos documentados; no retornar entidades ORM/usuarios completos/operaciones internas.

Cada mutación devuelve una confirmación pequeña. POST creador: HTTP 201; PUT/comandos: HTTP 200. Client obtiene detalle mediante GET/refetch. Esto evita conservar contactos/notas en las respuestas de idempotencia.

```json
{
  "operation": "payment.create",
  "property_id": "10",
  "resource_type": "payment",
  "resource_id": "78",
  "status": "confirmed",
  "updated_at": "2026-10-04T16:00:00.000Z"
}
```

`operation` enum cerrado coincide con caso de uso: `property.create/update`, `collaborator.create/update`, `policy.create/update`, `reservation.create/update/confirm/start/complete/cancel`, `payment.create/void`, `expense.create/update/pay/void`, `block.create/update`, `turnover.update/approve_same_day`. `resource_type`: property/collaborator/policy/reservation/payment/expense/block/turnover. `status` es estado del registro; para tablas sin status, `active`/`inactive` según is_active; turnover usa cleaning_status. updated_at corresponde al efecto original, no al momento del replay. Crear política responde ID de política; crear draft responde ID de reserva, aunque haya creado además turnover.

Casa añade `membership:{type:"owner"|"collaborator",can_manage_configuration:boolean,can_manage_collaborators:boolean}`. Capacidades son informativas; no sustituyen validación. Colaborador añade `user:{id,name,image_url}` sin email. Candidatos devuelven exclusivamente `{id,name,image_url}` y excluyen propietario/miembros activos; búsqueda por nombre, no enumeración de emails.

Reserva añade `nights`, `check_in_at`, `check_out_at`, `expected_amount`, `received_amount`, `refunded_amount`, `net_received_amount`, `balance_due_amount`, `refund_due_amount`, `retained_amount` (null si no cancelada), `turnover_id`; todos los importes strings. Los dos snapshots permanecen null donde no aplica; política/cancelación usan esquemas finitos siguientes, no JSON arbitrario.

## DTOs de casa, colaboradores y políticas

| Comando | Campos admitidos |
|---|---|
| Crear casa | Requeridos name, timezone, max_guests, check_in_time, check_out_time; opcionales location/null, default_nightly_rate/null, default_deposit_percent/null, minimum_turnover_minutes (default 0), notes/null, is_active (default true) |
| Editar casa | Los anteriores + default_cancellation_policy_id/null; owner no editable; timezone inmutable tras cualquier reserva/bloqueo |
| Crear colaborador | user_id; position/null opcional; is_active opcional true |
| Editar colaborador | position/null, is_active; user_id/property inmutables |
| Crear política | name, rules; is_active opcional true |
| Editar política | name, is_active, rules opcionales; rules omitido conserva, array completo reemplaza; [] rechazado |
| Regla anidada | Solo min_days_before integer y refund_percent Percent |

Casa se crea con política por defecto null; política se crea después, y PUT asigna ID de la misma casa. No hay FK circular temporal inválida. default_nightly_rate nulo permite crear casa sin inventar tarifa; reserva exige importe explícito. Cambiar valores habituales no toca acuerdos anteriores.

Cada política usable contiene 1..100 reglas, umbrales únicos y regla de mínimo cero. Orden ascendente de respuesta. Reemplazo reutiliza fila por umbral cuando corresponda y elimina las reglas sustituidas dentro de la misma transacción; no expone CRUD de reglas ni elimina políticas/historia. Una política activa por defecto no puede desactivarse sin quitar/reemplazar el default en operación coherente; PUT propiedad puede limpiar default primero. Snapshots no cambian por reemplazo.

Cambiar capacidad no admite quedar por debajo de guests_count de reservas confirmed/in_progress futuras/vigentes. Cambiar minimum_turnover_minutes verifica transiciones pendientes y rechaza si invalida aprobaciones de reservas vigentes; no modifica historia completed. Horarios habituales cambian futuras propuestas, nunca horas de reservas existentes. Cambiar timezone por el mismo valor es no-op válido; distinto valor con historia se rechaza.

## Reservas: creación, edición y transiciones

Crear siempre draft. Body requerido: guest_name, guest_contact, guests_count, channel, check_in_on, check_out_on, check_in_time, check_out_time, nightly_rate, deposit_amount. Opcionales: external_reference/null, cleaning_fee default `"0"`, discount_amount default `"0"`, commission_amount default `"0"`, deposit_due_at/null, balance_due_at/null, cancellation_policy_id/null, notes/null, is_active default true. `total_amount` se deriva, no se acepta del cliente; los valores habituales se muestran en UI pero Server no fabrica precio/modelo/horario si el campo requerido falta.

channel: whatsapp/airbnb/facebook/other. No cambiar canal tras acuerdo monetario. `other` se gestiona como directo, no como integración nueva. Reserva directa puede comenzar sin política como cotización, pero requiere política completa para recibir primer pago o confirmar. Airbnb requiere cancellation_policy_id null y deposit_amount `"0"`; la confirmación exige external_reference no vacía y condiciones externas explícitas.

PUT draft sin ninguna fila de pago, incluso voided, permite todos los campos de creación. Desde el primer registro monetario o confirmación, PUT solo admite guest_name, guest_contact, notes, is_active. No cambiar unilateralmente fechas/precio/canal/política/abono, ni reducir precio por debajo de pagos. Un comando específico de modificación de acuerdo, con recálculo de disponibilidad/dinero y aceptación, es ampliación posterior; esta restricción inicial está implementada para evitar edición silenciosa.

Draft con pagos es una reserva pendiente de confirmación, no un hold de disponibilidad. Registrar dinero real no autoconfirma, no retiene fechas y no crea vencimientos automáticos. Availability puede informar conflicto antes de capturar; si el dinero fue recibido realmente, su captura histórica no se rechaza por un conflicto del draft. El usuario podrá resolverlo mediante confirmación válida o cancelación/devolución.

| Comando | Origen → destino | Reglas adicionales |
|---|---|---|
| confirm | draft → confirmed | Casa/reserva activas, capacidad, disponibilidad, vecinos/preparación; pago directo ≥ abono >0; Airbnb referencia/condiciones externas, sin exigir liquidación |
| start | confirmed → in_progress | Ahora ≥ check_in_at y < check_out_at; turnover con linen_ready=true, cleaning_status=completed y ready_at≤ahora; no inicia antes del acuerdo |
| complete | in_progress → completed | Ahora ≥ check_out_at; no reduce ocupación histórica ni implica dinero cobrado |
| cancel | draft/confirmed → cancelled | Aviso efectivo antes de check_in_at, snapshots y cálculo válidos; libera intervalo pero conserva dinero |

No transiciones inversas, reabrir cancelada, marca automática según reloj ni cancelación por impago al vencer. Start/complete reciben `{}`; timestamps de autoría son de Server. Estado no se cambia por PUT. Un comando nuevo sobre estado ya cambiado da 409; replay con la misma clave recupera éxito original. Restricción implementada en v1: una estadía ya terminada que nunca se marcó in_progress no puede completarse retrospectivamente con estos comandos. Una ampliación futura puede añadir un comando explícito de cierre retrospectivo; no eludir esta limitación cambiando horarios históricos ni almacenar una llegada ficticia.

confirm directo body admite únicamente `same_day_approvals?:Id[]` (default []). confirm Airbnb requiere además `platform_policy:{reference:string,description:string}` (1..255 y 1..5000) y las aprobaciones opcionales. Referencia describe la política/acuerdo externo conocido, no consulta una integración ni es copia de datos del huésped. Se crea/preserva snapshot antes de confirmar; si un primer pago ya congeló las condiciones externas, el body debe coincidir con ellas, no reemplazarlas.

Si el primer pago directo se registra en draft, Server captura entonces la política completa en policy_snapshot. Confirmación preserva ese acuerdo ya cobrado; si no había pagos, captura al confirmar. FK/fechas/precio quedan inmutables desde ese primer dinero. Pago Airbnb en draft exige external_reference y `platform_policy` en DTO de primer pago; no bloquear la captura de una liquidación real por aún no confirmar. Posteriores pagos no aceptan platform_policy ni reemplazan snapshot.

deposit_due_at/balance_due_at son plazos informativos del acuerdo. Cuando presentes: deposit_due_at≤check_in_at, balance_due_at≤check_out_at y deposit_due_at≤balance_due_at. Su vencimiento no libera fechas ni declara cancelación. No se inventa plazo de hold.

## Dinero exacto, abono y cancelación

Sea N diferencia de fechas civiles; T = N×nightly_rate + cleaning_fee − discount_amount; C=commission_amount; E=T−C. Se requiere T>0, 0≤C≤T y E>0; intermediarios exactos y T dentro del bigint de fila. Para directo 0<deposit_amount≤E al confirmar. Para draft directo se admite abono cero mientras se cotiza, pero no confirma. Airbnb abono cero. Comisión directa solo se registra cuando corresponde a una deducción real; no aplicar comisiones por nombre de canal.

Un porcentaje de abono convertido en UI produce `ceil(T×basis_points/10000)` pesos y el DTO recibe el importe explícito deposit_amount. No se guarda otro porcentaje por reserva ni se recalcula abono al cambiar default. Si la comisión directa deja E menor que abono calculado, exigir ajustar el importe de abono acordado; no truncarlo en silencio.

P=SUM(amount de payment confirmed), R=SUM(amount de refund confirmed), ambos de TODO el historial de la reserva. No depender de filtros/página/is_active. Antes de cancelar: received_amount=P, refunded_amount=R=0, net_received_amount=P, balance_due_amount=E−P≥0, refund_due_amount=`"0"`, retained_amount=null. No sobrepagos. Cobros adicionales no reducen T ni alteran deposit_amount.

Al cancelar: balance_due_amount=`"0"` porque ya no se exige cobrar el saldo de la estadía; T/E se conservan como acuerdo histórico, no como deuda vigente. F=refund_amount aprobado; refund_due_amount=F−R≥0; net_received_amount=P−R; retained_amount=P−F. La cancelación no cobra penalidades pendientes sobre dinero no recibido ni altera comisión automáticamente. Un importe retenido es resultado del acuerdo, no otro pago.

Ejemplo: T=200000, P=40000, regla 50% ⇒ F=20000; tras cancelar saldo de estadía 0, devolución pendiente 20000 y retención 20000. Tras devolver 12000, pendiente 8000; caja de reserva 28000. No mostrar 160000 como saldo a cobrar de reserva cancelada.

Airbnb: T expresa ingreso bruto del anfitrión antes de su comisión, excluyendo cargos exclusivos del huésped. E=T−C y P registra únicamente liquidaciones netas recibidas. T=200000,C=6000,P=194000 ⇒ balance 0, caja194000. No registrar además un pago bruto200000 ni gasto pagado6000 por la misma deducción. Una comisión no descontada realmente se representa como gasto independiente, con commission_amount cero para esa deducción; no inferirlo automáticamente del canal.

### Snapshots de política

Directo, generado solo por Server al primer pago o confirmación:

```json
{
  "schema_version": 1,
  "kind": "direct",
  "policy_id": "30",
  "policy_name": "Condiciones acordadas",
  "captured_at": "2026-10-04T16:00:00.000Z",
  "timezone": "America/Santiago",
  "days_basis": "local_calendar_days",
  "refund_basis": "confirmed_received_amount",
  "rounding": "floor_clp",
  "rules": [
    {"min_days_before": 0, "refund_percent": "0.00"},
    {"min_days_before": 7, "refund_percent": "50.00"},
    {"min_days_before": 14, "refund_percent": "100.00"}
  ]
}
```

Valores ilustrativos, no seeds/defaults aprobados. Snapshot validado/versionado, reglas completas; nombre visible no contiene contactos. Airbnb:

```json
{
  "schema_version": 1,
  "kind": "platform",
  "channel": "airbnb",
  "captured_at": "2026-10-04T16:00:00.000Z",
  "timezone": "America/Santiago",
  "platform_reference": "POLITICA-RESERVA-EXTERNA",
  "platform_description": "Condiciones registradas por el administrador",
  "resolution": "manual_external"
}
```

Airbnb no recibe reglas directas ni una política artificial a partir de discovery. La descripción se mantiene acotada y no admite secretos/JSON de plataforma. No hay conexión externa ejecutada.

### Preview y cancelación

Directo: body `{cancelled_at:Instant}`. Airbnb: `{cancelled_at:Instant,refund_amount:Money,resolution_note:string}`; monto 0..P y resolution_note 1..1000 obligatoria. Aviso no futuro, y antes de entrada acordada; un aviso anterior a created_at puede registrarse si la reserva fue capturada tarde, pero sigue sujeto a fecha de entrada. No presentación, salida anticipada y cancelación efectiva después de entrada no se calculan usando silenciosamente tramo0: quedan fuera del cálculo automático inicial.

D=fecha_local(check_in_at)−fecha_local(cancelled_at), contando cambios de fecha, no bloques24h. Antes de entrada del mismo día D=0. Seleccionar regla con mayor min_days_before≤D. F=floor(P×basis_points/10000) pesos; aritmética bigint exacta, sin coma flotante, nunca más que P. Ejemplo P=10001 y 33.33% ⇒ floor(33333333/10000)=3333. Horas/DST no alteran D.

Preview devuelve `{reservation_id,as_of,check_in_at,cancellation_snapshot,refund_amount,balance_due_after_cancellation:"0",refund_due_after_cancellation}`. No guarda snapshots, no reserva saldo ni crea operación. El comando cancel admite además `expected_refund_amount:Money` obligatorio (en Airbnb igual a refund_amount), y recalcula bajo lock: si cambió pago/política aplicable y F difiere, 409 `rental:cancellation_changed` para volver a revisar. El hash de idempotencia incluye el instante efectivo y el esperado.

Cancelación de draft sin pagos permite F=0 aunque aún no tenga policy_snapshot; cancellation_snapshot.kind=`unpaid_draft` conserva motivo operativo `no_received_payment`, fecha local y anticipación, sin aplicar una política ficticia. Draft con pago debe tener snapshot completo congelado y aplica sus condiciones. Cancelación de confirmado usa siempre snapshot, nunca política actual.

Directo, snapshot generado al cancelar:

```json
{
  "schema_version": 1,
  "kind": "direct",
  "cancelled_at": "2026-10-10T13:00:00.000Z",
  "computed_at": "2026-10-10T13:01:00.000Z",
  "timezone": "America/Santiago",
  "check_in_on": "2026-10-20",
  "cancellation_local_on": "2026-10-10",
  "days_before": 10,
  "days_basis": "local_calendar_days",
  "refund_basis": "confirmed_received_amount",
  "received_amount": "40000",
  "payment_count": 1,
  "payment_ledger_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "selected_rule": {"min_days_before": 7, "refund_percent": "50.00"},
  "rounding": "floor_clp",
  "refund_amount": "20000",
  "retained_amount": "20000"
}
```

Hash ilustrativo. Ledger hash se calcula SHA-256 de JSON canónico de pagos confirmed ordenados por id, con id/amount/occurred_on; puede iterarse por stream/conjuntos sin colocar un array ilimitado en snapshot. Eventos y filas monetarias permanecen consultables. Snapshot plataforma reemplaza selected_rule/rounding/days_basis por `resolution:"manual_external"` y resolution_note; conserva instantes, timezone, fecha de entrada, received_amount, payment_count, hash, refund_amount y retained_amount. Snapshot unpaid_draft contiene schema_version/kind/cancelled_at/computed_at/timezone/check_in_on/cancellation_local_on/days_before/reason/received_amount=`"0"`/refund_amount=`"0"`/retained_amount=`"0"`; sin hash/política inventados. Todos los esquemas rechazan claves desconocidas.

## Pagos y gastos

Crear pago: reservation_id, type (`payment`|`refund`), amount>0, occurred_on; method/null, reference/null, notes/null opcionales. status se fija confirmed en Server. Solo primer payment Airbnb en draft puede añadir platform_policy según esquema previo. No PUT de dinero registrado: corrección mediante void explícito y nuevo registro con intención nueva, manteniendo la historia.

payment admitido en draft/confirmed/in_progress/completed, con sum(P)+amount≤E y política capturada antes de cobrar draft directo. Antes del primer pago directo, el abono debe estar acordado como 0<deposit_amount≤E; un draft cotizado con abono cero se configura antes de recibir dinero para no congelarlo en una fase imposible de confirmar. occurred_on≤fecha local actual y puede ser anterior a captura; no fabricar ingreso futuro. refund solo en cancelled y amount≤F−R; occurred_on no anterior a fecha local cancelled_at ni futuro. Refund es dinero devuelto efectivamente; no crear filas pending para una obligación futura.

void recibe `{reason:string}` (1..1000), solo sobre confirmed; reason se conserva en audit changes, no agrega columna. Anular payment en draft permitido; en confirmed/in_progress/completed no puede dejar un directo por debajo del abono acordado ni invalidar coherencia. Después de cancelar, no crear/anular payment porque cambiaría la base congelada; corrección de resolución requiere futura operación específica. Anular refund erróneo en cancelled restablece su pendiente, nunca cambia F. void no ejecuta devolución bancaria. Registro voided no se reactiva ni se vuelve a anular con intención nueva.

Crear gasto: name, amount>0, incurred_on, status (`pending`|`paid`); reservation_id/null, category/null, notes/null opcionales; paid exige paid_on, pending exige paid_on omitido/null. No alta voided. incurred_on/paid_on no futuras; paid_on≥incurred_on. Anticipos/prepagos de gastos no están en este contrato.

PUT pending: name/category/amount/incurred_on/reservation_id/notes. PUT paid: solo name/category/notes/reservation_id (asociación informativa de misma casa); no reescribir importe/fecha efectiva. pay recibe `{paid_on:CivilDate}` y pasa pending→paid por importe total. void pending/paid recibe reason; pasa a voided y paid_on queda null, conservando fecha previa en audit. No pagos parciales, reversión a pending ni reapertura. Anular es corregir captura errónea, no afirmar que el proveedor reembolsó dinero real.

Gasto sin reserva válido. Todos los movimientos monetarios y auditoría se confirman con operación idempotente en una transacción. La referencia libre de pago no promete deduplicación bancaria entre claves distintas.

## Calendario, bloqueos y preparación

Convertir check_in_on/time y check_out_on/time usando timezone de casa, con resolución explícita de DST. Hora local inexistente o ambigua se rechaza con 400 `rental:invalid_local_time`; v1 no elige offset arbitrario ni añade columnas de offset. Noches es diferencia de fechas; ocupación `[check_in_at,check_out_at)`.

confirmed/in_progress/completed ocupan fechas aunque estén archivadas. draft/cancelled no ocupan. Bloqueo activo ocupa `[starts_at,ends_at)`; inactive no ocupa. Intersección estricta `a.start<b.end && b.start<a.end` genera conflicto. Bloqueos activos tampoco se solapan entre sí, para evitar duplicar indisponibilidad sin significado adicional.

Crear/PUT bloqueo admite starts_at,ends_at,reason,notes/null,is_active (create true). ends_at>starts_at; no reserva/casa/actor de body. Activar/modificar verifica reservas y otros bloqueos bajo lock. Bloqueo no cambia dinero ni cancela reservas existentes; conflicto se rechaza.

POST draft crea turnover inicial con incoming_reservation_id fijo, previous_reservation_id derivado, linen_ready null, cleaning_status pending, plan/ready/aprobación null. No POST público de turnover. previous corresponde a reserva ocupante anterior de esa casa cuyo checkout es más cercano antes de la entrada; draft/cancelled no son salidas reales. Un draft puede preparar su plan sin bloquear calendario.

PUT turnover admite linen_ready (boolean|null), cleaning_status pending/in_progress/completed, planned_ready_at/null, ready_at/null, notes/null. ID entrante/casa/anterior/same_day_approved_at no son editables. ready_at solo con linen_ready=true y cleaning_status=completed, nunca futuro y no antes de checkout previo; puede describir preparación tardía después del horario acordado sin fabricar puntualidad. Start requiere ready_at≤ahora; marcar realizado no es requisito para confirmar una reserva de meses después. planned_ready_at sí debe estar dentro de ventana compatible con checkout previo + minimum_turnover_minutes y checkin entrante, cuando haya salida previa.

Salida/entrada en la misma fecha local requiere intervalos compatibles, separación≥minimum_turnover_minutes, linen_ready=true como disponibilidad de recambio planificada, planned_ready_at compatible y aprobación expresa. approve-same-day body `{}` relee transición vigente y fija same_day_approved_at de Server; plan futuro aprobado no implica limpieza realizada. Si no es transición del mismo día, rechaza comando por no aplicable.

confirm relee vecinos afectados del calendario resultante. `same_day_approvals` puede aceptar atómicamente los turnovers de entrada afectada, incluido el de una reserva previamente confirmada cuya salida anterior cambia; todos deben pertenecer a la casa, ser los afectados exactos y tener plan compatible ya registrado. Server recalcula previous antes de validar/fijar aprobación. Si falta un plan/aprobación válido, responde409. El caso de uso incluye IDs de turnovers afectados en su excepción, pero el filtro HTTP global no conserva ese campo: Client obtiene los requisitos públicos mediante availability, sin depender de IDs en el error. No aprobar listas arbitrarias ni reservar intervalos desde preview.

Cualquier cambio de intervalo/vecinos o plan material invalida aprobación anterior (`same_day_approved_at=null`) y, si cambia la transición real ya preparada, también ready_at/cleaning_status se revisan sin conservar un hecho de preparación para otra entrada. Invalidar por cancelación de una salida puede quitar la necesidad de aprobación; recalcularlo sin inventar aprobación. Un cambio que introduzca nueva transición mismo día para reserva confirmada se rechaza salvo aprobación atómica válida. Start exige hecho real vigente; aprobación de plan no lo sustituye.

Calendar query requiere `from_on,to_on` fechas con intervalo [from_on,to_on), 1..93 días. Devuelve `{scope:{property_id,timezone,from_on,to_on,includes_archived_occupancy:true},reservations,blocks,turnovers}` con proyecciones sin guest_contact/notes, y solo entradas intersectando ventana o turnovers ligados. Máximo1000 filas por conjunto; si excede, error explícito de ventana, no calendario truncado presentado como completo. Draft/cancelled se incluyen solo con `include_non_occupying=true`; por defecto únicamente ocupantes.

Availability query requiere check_in_on/check_out_on/check_in_time/check_out_time; exclude_reservation_id opcional validado de la casa. Devuelve `{available:boolean,checked_at,check_in_at,check_out_at,conflicts:[{resource_type,id,starts_at,ends_at}],turnover_requirements:[{incoming_reservation_id,turnover_id,needs_approval,plan_valid}]}`. ≤100 conflictos; si más, responde error de límite. available solo true si no ocupación/bloqueo y transiciones de mismo día resolubles con planes ya aprobados; requisitos faltantes dan false. Lectura informativa, sin guarantee/hold: confirm revalida todo bajo lock.

## Listados, filtros y General

DTO propio: page default1/máximo1000000; limit default10/máximo100. No `all=true`. Orden estable mapeado por recurso y desempate id. active=active|inactive|all default active solo donde existe is_active; status=confirmed no se convierte en active. Pagos/gastos sin columna is_active no aceptan active.

| Recurso | Filtros/orden públicos permitidos |
|---|---|
| Casas | active, q[name_cont], q[s] name asc/desc; default name asc,id asc |
| Colaboradores | active, q[position_cont], q[s] created_at asc/desc; default created_at desc,id desc |
| Candidatos | search obligatorio 3..100 caracteres, page/limit≤20; name asc,id asc |
| Políticas | active, q[name_cont], q[s] name asc/desc; default name asc,id asc |
| Reservas | active, status_in/channel_in (arrays enums ≤5/4), from_on/to_on por intersección civil, q[guest_name_cont], q[external_reference_cont], q[s] check_in_on asc/desc o created_at asc/desc; default check_in_on desc,id desc |
| Pagos | reservation_id, type, status, from_on/to_on sobre occurred_on [from,to); q[reference_cont], q[s] occurred_on asc/desc; default occurred_on desc,id desc |
| Gastos | reservation_id, status, category exacta, from_on/to_on sobre incurred_on, q[name_cont], q[s] incurred_on asc/desc; default incurred_on desc,id desc |
| Bloqueos | active, starts_at/ends_at instantes por intersección, q[reason_cont], q[s] starts_at asc/desc; default starts_at desc,id desc |
| Preparación | cleaning_status, incoming_reservation_id, linen_ready (`true`/`false`/`unknown`), from_on/to_on por checkin; q[s] planned_ready_at asc/desc NULLS LAST; default checkin asc,id asc |
| Auditoría | resource_type, resource_id, action, from_at/to_at [from,to); created_at desc,id desc |

Pares de período requieren ambos extremos y fin>inicio; listas de período≤366 días, q envolvente≤32 claves/8KiB, texto búsqueda≤255. Ransack solo operadores/columnas de tabla anterior, sin actor/property/guest_contact/JSON/notas, ni relaciones arbitrarias. Validar envolvente antes de extraer filtros especiales, mapear SQL y parametrizar. IDs de filtros de recurso ajeno producen vacío, nunca información de otra casa; GET detalle/asociación escritura ajena404. No permitir `s` arbitrario, predicados rechazados no se ignoran.

GET overview requiere from_on/to_on, ≤366 días, y devuelve:

```json
{
  "scope": {
    "property_id": "10", "timezone": "America/Santiago",
    "from_on": "2026-10-01", "to_on": "2026-11-01",
    "cash_dates": "occurred_on_and_paid_on",
    "includes_archived_history": true,
    "pending_scope": "all_current_property_records"
  },
  "cash": {"received_amount":"40000","refunded_amount":"0","paid_expenses_amount":"5000","net_amount":"35000"},
  "pending": {"reservation_balance_amount":"160000","refund_amount":"0","expense_amount":"0"},
  "counts": {"confirmed_reservations":1,"in_progress_reservations":0,"pending_turnovers":1},
  "upcoming_check_ins": [], "upcoming_check_outs": [], "pending_turnovers": []
}
```

cash suma payment/refund confirmed por occurred_on y expense paid por paid_on en [from,to), usando historia archivada; net=Pperiod−Rperiod−Gperiod. Pendientes son TODOS los saldos actuales de casa, sin amputar historial ni depender de filtro de caja: reservas confirmed/in_progress/completed con E−P, drafts con dinero también se informan aparte en `draft_received_amount` y `draft_count`; refund pendientes cancelled F−R; gastos pending. Cotizaciones draft sin dinero no se suman a cobros comprometidos. counts vigentes por estado, no montos del período. Añadir campos draft anteriores a pending/counts de ejemplo; valores0 explícitos para ausencia real.

Próximas listas máximo10 por conjunto, orden instante,id, con `as_of` de Server; rango [ahora,ahora+30 días civiles] en zona casa. Son muestras y counts describen conjunto completo. Proyección mínima id/fechas/guest_name/estado, sin contactos. No mezclar dinero de otra casa ni Finanzas. Fallo de consulta/agregado produce error, no indicadores0 ficticios. Consultas por conjuntos, sin N+1 de pagos/políticas/preparación.

## Transacciones, revocación e idempotencia

Todas las escrituras de una casa existente siguen una transacción READ COMMITTED y orden único: fila casa `FOR UPDATE` → releer actor/pertenencia → operación idempotente → precondiciones del estado actual → reservas implicadas por id ascendente → filas dependientes → auditoría/resultado. Replay de una intención exitosa no vuelve a exigir casa/reserva activa, abono disponible ni estado origen: esas precondiciones ya fueron consumidas. Incluso con casa archivada devuelve ack original si el actor conserva autoridad para esa operación; una revocación sí lo impide. La serialización por casa es propuesta conservadora para el volumen inicial de una unidad; cubre revocación/configuración, dinero, preparación y calendario. No extender a llamadas externas ni usar mutex en memoria como garantía. Optimizar granularidad más adelante exige preservar orden/locks de pertenencia y repetir pruebas.

Revocación también adquiere casa FOR UPDATE. Si escritura ya adquirió lock, termina antes de revocación; si revocación gana, la escritura/replay relee y devuelve404 sin efecto. No autorizar antes del lock y después reutilizar un check viejo. Los repositorios vienen del manager transaccional; effect/audit/operation se confirman juntos o rollback juntos. No Promise.all de consultas sobre una misma conexión.

Lecturas de detalle/agregados/calendario usan transacción READ COMMITTED y casa `FOR SHARE`, comprobando pertenencia en una consulta nueva DESPUÉS de ganar el lock. Al mantenerlo, ningún escritor de esa casa del protocolo puede cambiar pertenencia/datos durante los agregados secuenciales. No reutilizar un snapshot REPEATABLE READ tomado antes de esperar el lock: podría conservar una pertenencia recién revocada. Lectura que espera una revocación relee tras su commit y es rechazada; lectura que ya ganó lock puede terminar antes de revocar. GET properties filtra acceso en una única consulta snapshot; no concede lectura posterior del detalle. Respuestas `Cache-Control:no-store` para datos privados; cachés Client incluyen usuario/casa y se invalidan al cambiar sesión/revocación. No prometer eliminar de un navegador datos que el usuario ya vio.

Idempotencia de escritura scoped:

1. Validar header UUID v4, comando/path y límites; actor autenticado.
2. Con lock de casa y pertenencia fresca, buscar `(property_id,actor_id,request_key)`.
3. request_hash=SHA256 de UTF8 de JSON canónico `{schema_version:1,operation,property_id,resource_id:null|Id,command}`. Orden de claves determinista; normalizar strings/instantes/porcentajes y defaults conocidos, conservar diferencia omisión/null en PUT; arrays de conjuntos ordenados por ID, rules por umbral. No incluir token, fecha de ejecución ni headers de transporte. Hash no se expone a Client.
4. Si existe y operation/hash coinciden, devolver el resultado original con mismo status HTTP; si cambia intención/body/path:409 `rental:idempotency_conflict`.
5. Si no existe, ejecutar reglas/efecto, insertar audit y rental_operation con resultado validado en misma transacción. Persistir solo éxito; errores de validación/conflicto/rollback no consumen clave.
6. Ante timeout de lock (2s) o statement(5s) devolver503 `rental:temporarily_busy`; Client puede recuperar/reintentar LA MISMA clave/comando. Deadlock no produce éxito ni cambio parcial. No retries en varias capas; máximo un reintento técnico interno con misma intención si PostgreSQL abortó con certeza, sin superar deadline10s.

`response` de rental_operations esquema cerrado:

```json
{
  "schema_version": 1,
  "http_status": 201,
  "body": {
    "operation":"payment.create", "property_id":"10", "resource_type":"payment",
    "resource_id":"78", "status":"confirmed", "updated_at":"2026-10-04T16:00:00.000Z"
  }
}
```

HTTP status solo200/201; body usa MutationResult previamente definido, sin contacto/notas/entidad completa ni snapshots de política. Revalidar pertenencia y actor también al recuperar. GET operations devuelve ese objeto o404; no devuelve hash/body original. Resultado describe efecto ORIGINAL: para estado actual usar GET recurso. No TTL/limpieza automática de claves; retención indefinida inicial. Nueva clave es nueva intención y puede duplicar una captura manual si el usuario no concilia referencias.

POST properties resuelve que aún no hay property_id sin cambiar el ERD: adquirir `pg_advisory_xact_lock` derivado de dominio fijo `rental.property.create` + actor + request_key (hash estable a bigint firmado), buscar operación `property.create` por actor/key en todas sus propiedades; si existe, comprobar dueño y hash del comando sin property_id, devolver resultado. Si no, crear casa, auditoría y operación con nuevo property_id, todo en misma transacción. El ámbito excepcional de creación es `(operation=property.create,actor,key)` global entre casas; no buscar cualquier operación del actor con esa clave ni recuperar un payment.create de otra casa. Para el resto, el ámbito sigue `(property_id,actor,key)` y admite claves iguales en casas distintas sin mezclar resultados. Colisión del hash advisory solo serializa trabajo, no mezcla identidad: query compara operation/actor/key exactos. Locks transaccionales se liberan con rollback/commit/crash; todos los escritores de creación usan el protocolo. Este lookup inicial no aprovecha prefijo property_id del UNIQUE y requiere medir con volumen; no inventar nueva tabla ni reemplazar el índice aprobado sin revisión. Reintento de creación usa mismo body/header, o GET properties para recuperar la casa si se perdió la respuesta; después conoce property_id y puede usar GET operations.

Auditoría append-only action igual a operation, resource_type/id y changes finitos. changes contiene campos técnicos modificados y reason de anulación; datos sensibles guest_contact/notes/platform_description no se copian en historial ni logs: conservar nombres de campos modificados con indicador redacted sin valores. Montos, estados, fechas e IDs propios sí se conservan para conciliar. Eventos de confirmación incluyen aprobación/vecinos revisados. No API para editar/borrar audit ni operaciones.

## Errores, consumidores y evidencia necesaria

Conservar envolvente global `{statusCode,timestamp,path,method,error,message}`. message string código estable `rental:*`; error categoría segura. No añadir un code que el filtro actual eliminaría ni retornar SQL/stack/contactos. 400 validación/fechas/filtros;401 sesión;403 operación exclusiva;404 fuera de ámbito;409 conflicto de disponibilidad/estado/abono/sobrepago/snapshot/idempotencia;413 cuerpo;429 limiter existente;503 saturación temporal/dependencia. Códigos propuestos: `rental:invalid_input`, `rental:invalid_local_time`, `rental:not_found`, `rental:owner_required`, `rental:availability_conflict`, `rental:turnover_required`, `rental:deposit_required`, `rental:overpayment`, `rental:refund_exceeds_approved`, `rental:agreement_immutable`, `rental:invalid_transition`, `rental:cancellation_changed`, `rental:unsupported_cancellation`, `rental:idempotency_conflict`, `rental:window_too_large`, `rental:temporarily_busy`.

Client futuro deberá generar/preservar intención y key cuando respuesta sea incierta, recuperar/reenviar el mismo comando, cerrar formulario solo tras éxito y emitir toasts ES/EN mediante el dueño de feedback existente. No generar nueva clave por cada retry, no convertir una respuesta perdida en éxito/fallo definitivo, no mostrar mensajes de dinero redondeados con float. preview no representa cancelación exitosa ni dispara notificación de mutación.

Pruebas necesarias del plan Backend: DTO real rechaza mass assignment/números/fechas nulas/JSON extra; principal/ámbito/revocación y replay revocado; create property concurrente misma clave; pagos draft sin hold y confirmación por abono; cancelación P=40000/F=20000 con saldo0; redondeo33.33%; DST y días0/7/14; Airbnb neto194000 sin segunda comisión; refunds concurrentes/void y snapshots preservados; disponibilidad reserva-reserva/reserva-bloqueo con calendario vacío; cambio de vecinos y aprobaciones same-day; rollback de effect/audit/operation; sums fuera de bigint fila; calendario/lists bounded y overview sin N+1. Tests unitarios solo `use-case/*.use-case.spec.ts`; locks/constraints requieren PostgreSQL aislado y HTTP/DI de integración permitidos, no suites unitarias de servicio/controlador.

Backend implementó este contrato; [plan 29](29-rental-reservations-backend-plan.md) registra la evidencia de casos de uso, PostgreSQL/HTTP aislados y aplicación objetivo pendiente. Las 44 operaciones están en OpenAPI y fixtures sintéticos. Se conserva revisión documental; el plan Client posterior consume esta entrega, sin afirmar login real ni despliegue verificados.

## Concreciones de la entrega Backend — 2026-10-04

GET turnover detalle añade `current_previous_reservation_id` (Id|null), `same_day_required`, `plan_valid` y `needs_approval` (booleanos) calculados con vecinos vigentes; la lista conserva la proyección base. Los demás recursos y el resultado mínimo mantienen las proyecciones descritas. [OpenAPI completo](../../nodia-server/test/fixtures/rental/swagger.json) contiene esquemas explícitos y [fixtures HTTP](../../nodia-server/test/fixtures/rental/api.json) tienen un éxito por cada operación, contrastado contra su esquema.

Los errores implementados y mensajes para Client ES/EN están en [catálogo](../../nodia-server/src/rental-common/rental-error-catalog.ts) y [fixture](../../nodia-server/test/fixtures/rental/messages.json); `unsupported_cancellation` no se emite en esta versión. El parser transforma exceso/malformación en 413/400; DTOs Rental producen `rental:invalid_input` sin alterar errores de otros módulos. Headers scoped `Cache-Control:no-store` y `X-Request-Id` generado por Server; logs de método/ruta/status/duración sin body/query. Locks 2 s, statements 5 s y presupuesto de transacción 10 s comprobados en aislamiento; el presupuesto empieza tras abrir la transacción, no cubre espera por conexión. No hay retry interno ni expiración de operaciones.
