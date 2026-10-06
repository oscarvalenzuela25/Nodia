# Tools → Reservas — plan de implementación Backend y BD

Continuidad Client: [plan30](30-rental-reservations-client-plan.md) implementado después de esta entrega, con tres carriles e integrador; RC-01..37/39 verificadas localmente: 822 pruebas/144 archivos y navegador→API→PostgreSQL temporal. RC-38 conserva aplicación objetivo y smoke con sesión real pendientes. La evidencia Backend histórica se conserva.

> Estado: en revisión documental — Backend implementado y verificado localmente; aplicación a BD objetivo pendiente
> Fecha: 2026-10-04
> Dependencias: [entrevista 25](25-rental-reservations-interview.md), [especificación 26](26-rental-reservations-spec.md), [ERD 27](27-rental-reservations-erd.md), [contratos 28](28-rental-reservations-contracts.md), [ADR-012](../architecture/decisions/ADR-012-rental-property-collaboration.md), [ADR-013](../architecture/decisions/ADR-013-rental-integrity-and-idempotency.md)

## Alcance y estado real

El usuario aceptó el ERD y autorizó implementar el Backend con múltiples agentes. Las once entidades, migración incremental, 44 operaciones HTTP, seed y ensayos están implementados. Se ejecutó SQL exclusivamente en PostgreSQL temporal con datos sintéticos, sin leer `.env` ni conectar a la BD configurada. La migración y el seed están preparados y probados en aislamiento; su aplicación objetivo sigue pendiente; Client se implementó después según30. La ejecución autorizada no aprueba automáticamente este documento o los ADRs.

Dominio modular dentro de Nodia Server existente, separado de Business y Finanzas personales. Sin microservicio, plataforma de cobro, sincronización Airbnb, lectura de chats, inventario de ropa o integración automática de dinero. Valores comerciales, datos de casa y tramos se configuran después; no sembrar tarifas, horarios o porcentajes del ejemplo como reglas de producción.

## Evidencia del repositorio utilizada para planificar

- Server usa ESM, NestJS/TypeORM y PostgreSQL; el manifiesto declara Nest `^12.0.1`, TypeORM `^1.1.1`, TypeScript `^6.0.2`, Vitest `^4.1.2` y Oxlint. Antes de implementar comprobar lockfile y versiones resueltas, sin instalar o actualizar dependencias incidentalmente.
- La arquitectura vertical y pruebas exclusivas de casos de uso están en [AGENTS de Server](../../nodia-server/AGENTS.md); las importaciones relativas terminan en `.js` y las relaciones TypeORM utilizan `Relation<T>`.
- [DataSource de CLI](../../nodia-server/src/config/data-source.ts) y [runtime](../../nodia-server/src/config/db.config.ts) ahora fijan `synchronize: false`. Antes el runtime habilitaba sincronización en desarrollo; se desactivó para impedir DDL implícito al registrar las nuevas entidades. Este cambio alcanza todos los módulos: los cambios de esquema deben aplicarse por migraciones explícitas y una instalación vacía necesita su baseline existente.
- Scripts añadidos: `npm run seed:rental` y `npm run test:rental:integration`. El primero conecta a la BD configurada **solo al invocarlo expresamente**; el segundo compila y crea su propio PostgreSQL temporal. No ejecutar el seed como comprobación local sobre datos reales.
- [Ensayo financiero](../../nodia-server/test/finance.integration.mjs) proporciona una referencia de Docker/PostgreSQL temporal, principal sintético, DTOs/filtro reales y fixtures. Reutilizar el patrón sin acoplar el dominio ni ejecutar su configuración contra datos reales. Los contenedores nuevos siguen el prefijo `template_`.

## Reglas para encargar trabajo

Leer AGENTS raíz/Server y las skills locales `backend-service-quality`, `nestjs-service-quality`; aplicar además NestJS/Node/TypeScript/Vitest/Oxlint según tarea. El detalle de reglas reside en casos de uso, el servicio encapsula persistencia y el controlador adapta HTTP/Swagger/DTOs/actor. No copiar un caso de uso vacío que oculta su regla dentro del mock de un servicio.

Tests unitarios **solo** `use-case/*.use-case.spec.ts`, junto al caso de uso. No crear `controller.spec.ts`, `service.spec.ts` ni suites unitarias aisladas para helpers. Las garantías compartidas se ejercitan desde los casos de uso que las consumen y mediante DB/HTTP aislados. Ningún mock demuestra locks, constraints, ESM/DI o commit/rollback PostgreSQL.

Cada tarea tiene propietario único y dependencia explícita. Los agentes editan únicamente sus archivos; si falta cambiar un archivo común solicitan integración al responsable. Conservar cambios ajenos. Todas las rutas del plan, salvo documentación, son relativas a `nodia-server/`. Entidades se crean primero por el integrador y luego quedan congeladas durante los carriles; los agentes de recurso no las modifican incidentalmente.

## Protocolo común que precede al paralelismo

1. El actor viene de sesión validada; los casos de uso verifican casa y pertenencia vigente. Sin acceso transversal por rol de superadministrador ni por asignación del módulo. Solo propietario modifica configuración, políticas y colaboradores; ambos actores operan el resto conforme a 28.
2. Toda escritura sobre una casa existente adquiere `FOR UPDATE` de la casa antes de leer autoridad/estado, incluida operación monetaria, configuración, revocación y preparación. El orden es **casa → validación de pertenencia → idempotencia → reserva si aplica → filas dependientes**. Nunca adquirir casa después de reserva. La serialización por casa es deliberada para esta primera versión; medir contención antes de cambiarla.
3. La revocación sigue el mismo lock exclusivo de casa: una escritura ya autorizada puede terminar antes de la revocación; después de su commit, una nueva escritura o replay del colaborador falla. Leer pertenencia de nuevo después del lock; el token o contexto cacheado no bastan. Lecturas scoped de detalle/agregado/calendario toman casa `FOR SHARE` y pertenencia dentro del mismo snapshot; GET properties aplica acceso en su consulta. No entregar replay sin revalidarla ni usar la asignación del módulo como pertenencia.
4. Todos los caminos que cambian reserva/bloqueo/preparación o vecinos usan el protocolo exclusivo de disponibilidad, aun con cero filas existentes. `is_active=false` de reserva solo archiva, no libera ocupación de confirmed/in_progress/completed. Bloqueos inactivos sí liberan su intervalo. Cambios de vecinos deben invalidar/revisar aprobaciones de preparación afectadas dentro del mismo commit.
5. Validar comando final y consultar idempotencia antes de reevaluar precondiciones de una intención ya confirmada, después de validar acceso. `rental_operations`, efecto, auditoría y `MutationResult` mínimo de 28 se confirman con el mismo manager. Misma clave/operación/comando recupera resultado; otra intención da 409. Para POST inicial de casa, RB-07 utiliza advisory lock transaccional derivado de actor/UUID y consulta de operación `property.create` entre casas antes de crear la nueva. Sin TTL monetario automático ni retry con clave nueva tras timeout.
6. Fórmulas usan BigInt/aritmética decimal exacta; IDs/montos JSON son strings. Fechas civiles, instantes y zona IANA mantienen la semántica de 27/28. Ningún dato de zona/horario/precio faltante se sustituye con valores inventados.

La implementación concreta de locks, replay, proyecciones y validadores queda centralizada en `src/rental-common/`. Este protocolo no es una constraint declarativa de no solapamiento: todos los escritores coordinados deben cumplirlo y RB-31 demostrarlo. No crear un mutex en memoria o Redis como fuente de integridad.

## Orden y propiedad de archivos

| Responsable | Archivos exclusivos y tareas |
|---|---|
| Integrador | `src/rental-common/`; todas las `entities/` nuevas; migración; `rental-audit/`, `rental-operation/`, `rental-navigation/`; AppModule/controladores/módulos; scripts, package.json, integración/fixtures y documentación. RB-01..RB-08, RB-26..RB-34. |
| Agente A — configuración y miembros | DTOs/types/servicios/use-cases de `rental-property/`, `rental-collaborator/`, `rental-cancellation-policy/`. RB-09..RB-12. No `entities/`, controladores o módulos. |
| Agente B — reservas y preparación | DTOs/types/servicios/use-cases de `rental-reservation/`, `rental-turnover/`. RB-13..RB-19. No `entities/`, controladores o módulos. |
| Agente C — dinero y consultas | DTOs/types/servicios/use-cases de `rental-payment/`, `rental-expense/`, `rental-block/`, `rental-calendar/`, `rental-overview/`. RB-20..RB-25. No `entities/`, controladores o módulos. |

Base secuencial RB-01 → RB-02 → RB-03 → RB-04 → RB-05 → RB-06 → RB-07 → RB-08. Después se despachan A/B/C sobre archivos separados. RB-13 necesita política/lectura de casa RB-09/RB-12, y RB-15/RB-16 necesitan pagos RB-20/RB-21; son puntos de entrega, no importaciones circulares entre módulos. Contratos de persistencia/snapshots comunes están disponibles antes del carril; compartir reglas por `rental-common`, no hacer que Payment importe Reservation y Reservation importe Payment.

Integrador compone en RB-26 cuando los carriles terminan; RB-27/RB-28 pueden prepararse tras la base sin editar sus archivos. RB-29..RB-32 verifican y RB-33/RB-34 entregan. Cada agente avanza sus tareas en orden de dependencia; nunca dos agentes escriben un mismo servicio o caso de uso. Frontend puede planificarse con 28, pero su integración depende de RB-33.

## Tareas asignables

### RB-01 — Fijar contrato ejecutable y matriz de comandos

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: ninguna; leer 25/26/27/28 y ADR-012/013 primero.
- Propietario/archivos exclusivos: integrador; `src/rental-common/types/`, `dto/`, `validation/` y `rental-query.ts`.
- [x] Definir tipos públicos/DTOs base: IDs, CLP exacto, porcentajes, fechas civiles, horas locales, timestamps con offset, enums y snapshots versionados; excluir actor/propietario/timestamps/saldos del body.
- [x] Congelar matriz de rutas/operaciones de 28, actualizaciones permitidas por estado, active/status independientes y clases DTO runtime; propiedades omitidas preservan, null solo borra campos explícitamente nulos.
- [x] Definir límites de página/ventana/JSON/reglas/textos/arrays y políticas Ransack locales explícitas; prohibir `all=true`, SQL libre y exposición de campos de autoridad.
- [x] Definir `MutationResult` mínimo `{operation,property_id,resource_type,resource_id,status,updated_at}` sin entidades/contactos; POST preview es lectura sin mutación. Alta inicial de casa usa protocolo idempotente específico de 28, sin inventar columnas/ámbito.
- Cierre/pruebas: build de tipos/DTOs sin abrir DB; fixtures sintéticos base y matriz consumible por agentes. Casos de uso posteriores ejercitan validación real; HTTP RB-32 valida metadata/whitelist/coerción.

### RB-02 — Entidades de casa, colaboración y política

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-01.
- Propietario/archivos exclusivos: integrador; `src/rental-property/entities/`, `rental-collaborator/entities/`, `rental-cancellation-policy/entities/`.
- [x] Crear exactamente cuatro tablas de 27, incluida `rental_cancellation_rules`; PK BIGINT/autoría/tiempos y Relation<T>/.js.
- [x] UNIQUE de pertenencia y umbrales; referencia compuesta opcional de política por defecto de la misma casa. Sin FK a pertenencia para autoría ni action_ids.
- [x] Casa inicialmente sin política por defecto; configuración posterior no obliga a inserción circular inválida. Mapear nulabilidad/checks/defaults exactamente.
- Cierre/pruebas: metadata compilada sin TDZ y comparación por campo/índice/FK con 27/03/JSON; DB real en RB-30.

### RB-03 — Entidades de reservas, dinero y preparación

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-02.
- Propietario/archivos exclusivos: integrador; `src/rental-reservation/entities/`, `rental-payment/entities/`, `rental-expense/entities/`, `rental-block/entities/`, `rental-turnover/entities/`.
- [x] Crear cinco tablas con FKs compuestas por casa; snapshots JSONB, fechas date/time/timestamptz y monto BIGINT exacto.
- [x] Reservas con UNIQUE(property_id,id), referencia externa y estado/importe/cancelación coherentes; preparación entrante única y previo diferente del entrante.
- [x] No agregar saldos editables, inventario, perfiles de huésped, pago pendiente ficticio ni dependencias hacia tablas de Finanzas.
- Cierre/pruebas: metadata y correspondencia de campos/constraints, importación ESM compilada sin I/O; FK/CHECK y restricciones reales en RB-30.

### RB-04 — Entidades técnicas de auditoría e idempotencia

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-03.
- Propietario/archivos exclusivos: integrador; `src/rental-audit/entities/`, `rental-operation/entities/`.
- [x] Dos tablas de 27: eventos append-only y operaciones con UNIQUE(property_id,actor_id,request_key), hash/operación/respuesta mínima.
- [x] Mantener UUID como clave de intención, PK BIGINT; timestamps sin updated_at en ambas. No estado job/pending ni CRUD público de escritura.
- [x] Definir proyecciones/acciones finitas; resource_id tipado no simula FK polimórfica ni prueba pertenencia.
- Cierre/pruebas: once tablas nuevas exactas y metadata completa; no migrar todavía.

### RB-05 — Preparar migración incremental y reversión

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-04.
- Propietario/archivos exclusivos: integrador; `src/migrations/<timestamp>-CreateRentalReservations.ts`.
- [x] Crear únicamente las once tablas, 38 FKs e índices/checks de 27; no recrear users ni modificar datos de módulos existentes.
- [x] Crear casa/política antes de agregar FK circular opcional; down retira FK antes de sus tablas, en orden inverso seguro.
- [x] Fórmula total con aritmética NUMERIC intermedia exacta y validación del rango final; estados/cancelación/paid_on/preparación y porcentajes con CHECK de fila. No fingir CHECK entre tablas para capacidad o saldos.
- [x] Documentar down destructivo para datos de Reservas y respaldo/restauración necesarios; `synchronize=false` en todo ensayo.
- Cierre/pruebas: migración preparada y revisada contra metadata/27; **no aplicada** a BD objetivo. Up/down/up solo RB-30, registrando que no hay baseline completo de instalación vacía si sigue sin existir.

### RB-06 — Acceso por casa, revocación y orden de locks

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-05.
- Propietario/archivos exclusivos: integrador; `src/rental-common/access/`, `transactions/`, `types/`.
- [x] Ofrecer primitives de persistencia para lock de casa, pertenencia y reserva; reglas de permiso invocadas por casos de uso reales, nunca sustituidas por un service mock que siempre autoriza.
- [x] Aplicar casa FOR UPDATE a todas las escrituras scoped, incluidas dinero/revocación/configuración/disponibilidad; leer acceso vigente tras adquirir lock.
- [x] Ámbito en selección/update/asociaciones; 404 uniforme ajeno/inexistente, 403 para operación owner-only dentro de casa accesible según 28. Sin privilegio extra por nombre de rol.
- [x] Definir transacciones cortas, espera acotada y errores seguros; sin red externa ni mutex local.
- Cierre/pruebas: consumido por casos de uso A/B/C con propietario/colaborador/externo/revocado; carrera real escritura/revocación en RB-31.

### RB-07 — Protocolo persistente de intención, auditoría y recuperación

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-06.
- Propietario/archivos exclusivos: integrador; `src/rental-common/idempotency/`, `audit/`, `src/rental-operation/` excepto entidades; `src/rental-audit/` excepto entidades.
- [x] Canonicalizar operación/ámbito/comando validado, incluyendo valores por defecto acordados; hash determinista sin confiar en orden JSON ni valores dinámicos de configuración.
- [x] Misma clave/intención revalida acceso y recupera resultado antes de precondiciones ya consumidas; clave con otra operación/body produce 409. Un replay no agrega otro evento de auditoría.
- [x] Efecto/auditoría/operación/respuesta mínima en una transacción manager única; fallo antes de commit no deja efecto ni éxito. Resolver colisión simultánea sin leer desde una transacción abortada por UNIQUE.
- [x] POST casa: advisory xact lock de actor/UUID, consulta `property.create` por actor/key entre casas y hash del comando; replay exige propiedad vigente de la casa resultante. Primera ejecución inserta casa/operación/auditoría juntas, sin claves nulas o nueva tabla. Colisión del hash de advisory lock puede serializar más intenciones, no identificarlas como iguales.
- [x] GET de operación actor/clave/casa devuelve resultado mínimo del contrato, sin contactos/notas/hash bruto; propietario no utiliza la clave para recuperar la operación de otro actor.
- [x] Auditoría permite lectura paginada por casa; cambios allowlist con información sensible excluida y sin edición/borrado. Sin expiración automática de claves monetarias.
- Cierre/pruebas: use-cases de recovery/audit y consumidores con replay/conflicto/fallo; duplicado concurrente/commit-respuesta perdida/rollback real RB-31/RB-32.

### RB-08 — Núcleo de dinero, fechas y disponibilidad compartida

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-07.
- Propietario/archivos exclusivos: integrador; `src/rental-common/money/`, `dates/`, `availability/`, tipos/contratos internos de consulta.
- [x] Noches por fechas civiles; zona IANA y conversión de horas ambiguas/inexistentes con rechazo explícito. Semántica exacta [entrada,salida), ventana y horas de 28.
- [x] Consultar ocupación de reservas por status sin excluir archivadas, bloqueos activos y vecinos con un único ámbito; disponibilidad nunca depende de la página visible.
- [x] Centralizar cálculo de abono/redondeo, expected_amount/saldos/refunds/caja y snapshots; no usar Number para CLP ni SUM de solo una página.
- [x] Persistencia de revisión de vecinos/planes sin dependencia circular de módulos: reglas siguen comprobables desde casos de uso de reserva/bloqueo/preparación.
- Cierre/pruebas: matriz sintética compartida DST/adyacencia/noches/dinero fuera de safe integer; consumo real y no mock de regla bajo prueba en RB-13..RB-25.

### RB-09 — Lecturas y alta de casas accesibles

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-08.
- Propietario/archivos exclusivos: agente A; `src/rental-property/{dto,types,use-case}/` y `rental-property.service.ts`.
- [x] GET lista/detalle solo propietario o colaborador activo; conteos/lista con mismo ámbito, sin users/guest completos o N+1.
- [x] POST casa deriva propietario/autoría de sesión, exige configuración válida y permite política por defecto nula; audita alta en transacción.
- [x] Idempotencia inicial por advisory lock actor/UUID y consulta de operación `property.create` antes de insertar; casa/operación/auditoría en mismo commit. Replay revalida propietario y devuelve ack mínimo, seguido de lectura fresca.
- Cierre/pruebas: specs de casos de uso owner/member/externo, casa sin política y payload de autoridad rechazado; no contactos reales.

### RB-10 — Configuración y archivo de casa

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-09.
- Propietario/archivos exclusivos: agente A; update DTO/use-case/service/specs de `rental-property/`.
- [x] PUT owner-only con lock exclusivo, idempotencia/auditoría; owner inmutable, omisiones/nulos según 28.
- [x] Zona inmutable cuando hay reservas/bloqueos; capacidad/intervalo mínimo/configuración validan efectos sobre ocupación y planes existentes sin reinterpretar acuerdos guardados.
- [x] Archivar conserva historia; comportamiento de operaciones sobre casa archivada y nuevas asociaciones sigue 28, sin borrado físico.
- Cierre/pruebas: miembro no configura, zona histórica rechazada, cambio de capacidad/config inválido rollback, replay; confirmar expectativas con 28 antes de resolver una ambigüedad.

### RB-11 — Colaboradores y selector acotado de usuarios

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-10.
- Propietario/archivos exclusivos: agente A; `src/rental-collaborator/{dto,types,use-case}/`, servicio.
- [x] Lista compartida y selector candidates owner-only de usuarios activos, búsqueda mínima tres caracteres y paginación de hasta 20 según 28; proyección mínima, sin búsqueda irrestricta de emails.
- [x] Owner crea/reactiva/retira pertenencia existente bajo lock exclusivo; UNIQUE y no propietario como colaborador, sin invitaciones externas/asignación automática del módulo.
- [x] Autoría histórica se mantiene tras revocar; otra casa/user actor no permite modificaciones, replay revisa acceso.
- Cierre/pruebas: specs owner/member/externo, duplicado y reactivación conserva ID; retiro conserva pagos/autoría. Carrera real con dinero/disponibilidad RB-31.

### RB-12 — Políticas y reglas de cancelación transaccionales

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-11.
- Propietario/archivos exclusivos: agente A; `src/rental-cancellation-policy/{dto,types,use-case}/`, servicio.
- [x] Lista/detalle por casa; owner crea/edita/archiva política con reglas acotadas, umbrales únicos >=0 y regla 0, porcentajes [0,100] y decimal exacto.
- [x] Reemplazo de rules completo en manager único; body omitido preserva y colección inválida/vacía rechaza según 28. Sin endpoint CRUD de regla individual ni porcentaje ilustrativo por defecto.
- [x] Fuente/destino de default policy de misma casa; snapshots anteriores no cambian ni se borran al editar política. Inactivar default exige tratamiento explícito de 28.
- Cierre/pruebas: casos límite exactos de umbrales, repetidos/cobertura ajena, regla 0 ausente y fallo en una regla revierte todas; fixture usable por B.

### RB-13 — Lecturas y borrador de reserva

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-09, RB-12.
- Propietario/archivos exclusivos: agente B; `src/rental-reservation/{dto,types,use-case}/`, servicio; lecturas y create.
- [x] Lista/detalle por casa paginados y filtrados según 28; importes y estado de dinero por agregados, no consulta de pagos por fila ni SUM de página.
- [x] Crear draft con huésped/contacto mínimos, canal, fechas/horarios, capacidad y fórmula exacta; propiedad/autoría de contexto, referencia vacía normalizada a null.
- [x] Draft no ocupa fechas ni representa pago; registra preparación inicial automática en el mismo commit con ID derivado de Server. Intención/autoría/auditoría protegidas.
- Cierre/pruebas: draft con fechas ocupadas no afirma disponibilidad reservada, canal/capacidad/monto inválidos y ajeno; precio/noches/ID exactos y nulabilidad pública.

### RB-14 — Editar reserva y revisar vecinos

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-13.
- Propietario/archivos exclusivos: agente B; update DTO/use-case/persistencia/specs de reserva.
- [x] Campos comerciales/fechas/channel editables solamente en draft sin ninguna fila payment, incluidas voided. Casa y autoría inmutables; otros estados limitan edición a metadatos/archivo según 28. Enmiendas con dinero quedan fuera de versión inicial.
- [x] Cambio permitido con lock exclusivo valida disponibilidad, horarios/capacidad, importes/pagos y vecinos; audita acuerdo e invalida plan afectado de forma coherente.
- [x] is_active solo archiva; conserva ocupación/pagos/saldo/historia y no equivale a cancelación. No eliminar físicamente para liberar calendario.
- Cierre/pruebas: campos omitidos/null, edición con dinero/estado protegido, solapamiento y fallo intermedio sin pérdida de plan; guard por casa incluido.

### RB-15 — Confirmación directa y de Airbnb

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-14, RB-20, RB-21.
- Propietario/archivos exclusivos: agente B; confirm DTO/use-case/specs/persistencia de reserva.
- [x] Transición explícita draft → confirmed bajo lock exclusivo de casa/reserva; releer disponibilidad, vecinos y pagos al confirmar.
- [x] Directa exige abono configurado >0 y recibido suficiente y política completa; Airbnb exige referencia/snapshot de plataforma y abono directo 0, sin esperar liquidación neta.
- [x] Snapshot congelado al primer payment o confirmación, lo que ocurra primero. `same_day_approvals` permite aprobar en el mismo commit turnovers afectados, con IDs/vecinos/condiciones recalculados; no dejar que un GET previo garantice disponibilidad.
- Cierre/pruebas: depósito insuficiente/suficiente, política 0 ausente, Airbnb sin referencia y doble confirmación misma clave; confirmación/reserva/bloqueo concurrentes RB-31.

### RB-16 — Preview y cancelación con devolución aprobada

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-15, RB-21.
- Propietario/archivos exclusivos: agente B; preview/cancel DTOs/use-cases/specs/persistencia de reserva.
- [x] POST preview es lectura sin mutación/auditoría/idempotencia monetaria; devuelve cálculo sobre snapshot y pagos vigentes, no garantía de precio congelado hasta siguiente petición.
- [x] Cancel comando incluye expected_refund_amount y revalida todo bajo lock; si F difiere del importe revisado, 409 rental:cancellation_changed. Días calendario de zona y porcentaje sobre pagado con redondeo de 27/28; timestamp del aviso distinto de captura.
- [x] Solo draft/confirmed antes de entrada programada permiten cancel; draft con pago utiliza snapshot y sin pago tiene resolución cero específica. Airbnb registra resolución manual validada <= recibido; no aplicar policy directa ni inventar cálculo de no show/anfitrión/salida anticipada.
- [x] Guarda cancelled/refund_amount/cancellation_snapshot y libera fechas/revisa vecinos; conserva precio/pagos, balance_due_amount cancelado = 0 y devolución pendiente separada. Replay no recalcula con pagos/política posteriores.
- Cierre/pruebas: umbral exacto/DST/snapshot editado/aviso retroactivo inválido; preview obsoleto se recalcula en cancel; error no libera fechas ni registra falsa devolución.

### RB-17 — Entrada y finalización de estadía

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-16.
- Propietario/archivos exclusivos: agente B; start/complete DTOs/use-cases/specs de reserva.
- [x] Comandos confirmed → in_progress → completed con guard de estado/fechas/ready y condiciones de 28: start no anterior a checkin ni posterior a checkout, complete no anterior a checkout. Nunca transición implícita por cron u hora del host.
- [x] start verifica preparación real requerida; planned_ready_at o recambio aislado no prueban casa lista. No consumir pago pendiente ficticio.
- [x] completed conserva ocupación histórica; cancelled terminal según contrato. Operación/auditoría/replay usan mismo protocolo.
- Cierre/pruebas: entrada sin preparación/transición indebida, finalización válida y reintento; archivo o completed no abre noches históricas.

### RB-18 — Lecturas y actualización de preparación

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-14.
- Propietario/archivos exclusivos: agente B; `src/rental-turnover/{dto,types,use-case}/`, servicio; get/update.
- [x] Turnover por entrada único, lista acotada y detalle por casa; previous_reservation_id se deriva/valida con vecino real, no asociación arbitraria.
- [x] linen_ready null/false/true diferenciados, cleaning_status, plan/hora real y notas; ready_at exige recambio y limpieza completed.
- [x] Actualización bajo lock exclusivo; cambiar condiciones invalida aprobación incompatible y revisa entrada afectada sin fabricar disponibilidad.
- Cierre/pruebas: nuevo vecino/ajeno/mismo entrante/ready sin limpieza, planificación distinta de hecho real y rollback de cambios.

### RB-19 — Aprobar recambio el mismo día

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-15, RB-18.
- Propietario/archivos exclusivos: agente B; approve-same-day DTO/use-case/specs/persistencia de turnover.
- [x] Plan aprobado identifica previo vigente, recambio completo y hora prevista compatible con entrada/minimum_turnover_minutes de 28.
- [x] Approval solo bajo lock exclusivo con disponibilidad/vecinos frescos; 0 minutos no aprueba automáticamente. Hora real no puede preceder salida si expresa preparación posterior a esa estadía.
- [x] Crear/editar/cancelar reservas/bloqueos invalida/revisa aprobación afectada con protocolo compartido; no queda un flag reutilizable para cualquier vecino futuro.
- Cierre/pruebas: vecino/horario/plan cambia, aprobación inválida rechazable y siguiente entrada permitida solo con condiciones vigentes; carreras reales RB-31.

### RB-20 — Consultar y registrar cobros recibidos

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-08.
- Propietario/archivos exclusivos: agente C; `src/rental-payment/{dto,types,use-case}/`, servicio; get/create payment.
- [x] GET listado/detalle por casa/reserva y POST payment, money/date/método/referencia; no registrar promesas como cobro.
- [x] Lock exclusivo de casa más reserva, acceso revalidado, suma confirmada exacta y límite expected_amount; payment en draft congela snapshot completo. Tras cancelled no se permite crear/anular payment.
- [x] Airbnb registra neto del anfitrión una vez; comisión no agrega segundo ingreso/gasto. Payment confirmado inmutable con auditoría/operación atómicas.
- Cierre/pruebas: abono/parcial/exacto/sobrepago/fecha efectiva/ajeno, mayor safe integer y rollback; doble cobro concurrente RB-31.

### RB-21 — Registrar devolución y anular error de dinero

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-20.
- Propietario/archivos exclusivos: agente C; create refund/void DTOs/use-cases/specs/persistencia de payment.
- [x] Refund solo contra cancelación aprobada según 28; <= aprobado pendiente y <= pagos efectivos, sin duplicar devolución ni alterar cobro original.
- [x] Void corrige error registral con condición explícita/autoría; no devolución bancaria simulada. Tras cancelación solo refund permite create/void; no anular payment ni cambiar base aprobada.
- [x] Registro financiero inmutable, corrección por void/reingreso y clave nueva solo para intención nueva conocida; replay de intención pasada no exige nuevamente su precondición consumida.
- Cierre/pruebas: devolución parcial/exacta/excesiva y cobro anulado incoherente rechazado; dos refunds/concurrente cancel-payment/void-refund en RB-31.

### RB-22 — Gastos opcionales y su caja

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-21.
- Propietario/archivos exclusivos: agente C; `src/rental-expense/{dto,types,use-case}/`, servicio.
- [x] CRUD permitido de 28: lista/detalle/crear/editar y comandos pay/void, sin DELETE físico. Reserva opcional, misma casa; no obligar a gasto al reservar.
- [x] Estado pending/paid/voided; paid_on obligatorio solo para paid, incurred_on distinto de captura; campos monetarios de paid protegidos según contrato.
- [x] Intento, estado, auditoría/caja atómicos; corregir gasto registrado erróneo conserva historia y no simula devolución real. Sin pagos parciales ni distribución entre reservas.
- Cierre/pruebas: gasto sin reserva/ajena/pending no afecta caja/paid sí; replay pay/void y cambio de monto inmutable, fechas/nulos y rollback.

### RB-23 — Bloqueos de disponibilidad

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-08.
- Propietario/archivos exclusivos: agente C; `src/rental-block/{dto,types,use-case}/`, servicio.
- [x] GET lista/detalle y POST/PUT con intervalo [starts_at,ends_at), motivo, activo; ámbito y auditoría/idempotencia del protocolo.
- [x] Lock exclusivo antes de consultar reservas/bloqueos/vecinos, cubrir calendario vacío y reactivación; inicio < fin y ausencia de conflicto según 28.
- [x] Cambio/archivo afecta disponibilidad y preparación de vecinos; no modificar dinero ni desactivar reservas para dejar pasar bloqueo.
- Cierre/pruebas: límite adyacente permitido/conflicto/ID ajeno/archivo/reactivación, plan afectado revisado y race reserva-bloqueo en RB-31.

### RB-24 — Calendario y consulta de disponibilidad

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-13, RB-18, RB-23.
- Propietario/archivos exclusivos: agente C; `src/rental-calendar/{dto,types,use-case}/`, servicio.
- [x] GET calendar/availability por casa y ventana acotada exacta de 28; reservas ocupantes aun archivadas, bloqueos activos y plan de entradas relevantes.
- [x] Distinguir libre/ocupado/cambio condicionado/error; misma regla de fechas y vecinos que escrituras, sin devolver libre por ausencia accidental de datos.
- [x] Listas/acotación de eventos según contrato con señal explícita si exceden capacidad; no truncar silenciosamente el calendario ni asegurar reserva por lectura previa.
- Cierre/pruebas: cero datos real/archivada/ventana parcial/DST/cambio mismo día/bloqueo; ámbito A/B, consulta adversaria y consistencia SQL RB-31.

### RB-25 — Resumen operativo y caja por fechas efectivas

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-21, RB-22, RB-24.
- Propietario/archivos exclusivos: agente C; `src/rental-overview/{dto,types,use-case}/`, servicio.
- [x] GET overview con próximas entradas/salidas/preparación, cobros y devoluciones pendientes y caja; separar scope de período/operación vigente según 28.
- [x] Pagos confirmed por occurred_on − refunds confirmed por occurred_on − gastos paid por paid_on; no sumar precio total ni restar nuevamente comisión neta Airbnb.
- [x] Agregaciones por conjuntos, snapshot consistente cuando se leen varios agregados y todos los importes exactos aun SUM > bigint de fila; sin N+1 o duplicación por JOIN.
- Cierre/pruebas: más de una página, cero real, captura/fecha efectiva distintas, pago voided, refund pendiente y gastos pending; resultado no etiquetado utilidad contable.

### RB-26 — Composición NestJS, controladores y Swagger

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-10, RB-11, RB-12, RB-16, RB-17, RB-19, RB-21, RB-22, RB-23, RB-24, RB-25, RB-28.
- Propietario/archivos exclusivos: integrador; todos los `src/rental-*/<resource>.controller.ts` y `.module.ts`, `src/rental-common/rental-common.module.ts`, `src/app.module.ts`; `src/main.ts` solo si es necesario para el límite de cuerpo scoped definido en 28.
- [x] Registrar DI/repositorios/casos de uso/entidades sin ciclos; shared no importa módulos de recurso que a su vez lo importan.
- [x] Todas las rutas `/api/v1/rental` de 28, anidadas por propertyId salvo listado/alta de casa; controladores delgados con DTOs/clases reales, sesión global y actor validado.
- [x] Ordenar rutas estáticas/:id, códigos/status/errores/proyecciones y Swagger exactos. Sin endpoints públicos de seed ni CRUD público de audit/operations/rules.
- [x] Importaciones .js/Relation<T> y sin ESM metadata type-only incorrecta para DTOs/proveedores.
- [x] Aplicar límite JSON de 64 KiB antes de parsing sobre la superficie rental y Cache-Control:no-store; no basta revisar longitud del objeto después del parseo. Integrar parser/configuración sin cambiar inadvertidamente límites o comportamiento de otros módulos.
- Cierre/pruebas: build/arranque compilado de composición aislada; smoke DTO real en RB-32. No crear controller.spec/service.spec.

### RB-27 — Seed idempotente de Tools y Reservas

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-05, RB-08.
- Propietario/archivos exclusivos: integrador; `src/rental-navigation/`, `scripts/seed-rental-reservations.mjs`, script nuevo `seed:rental` en `package.json`.
- [x] Registrar `module_groups.key=tools`, `modules.key=rental_reservations`, link `/tools/reservations`, iconos y traducciones ES/EN según 28; respetar Tools existente.
- [x] Doble ejecución conserva IDs/claves/traducciones sin alterar otros módulos ni asociar Reservas a todos los usuarios.
- [x] Caso de uso invocable por CLI operacional coherente con seed:finance; asignación explícita en Settings y colaboración por casa son operaciones distintas.
- [x] No sembrar casa real, usuarios, huéspedes, cobros, tarifas o políticas comerciales; no ejecutar el nuevo script contra BD configurada al prepararlo.
- Cierre/pruebas: caso de uso unitario y doble seed PostgreSQL aislado en RB-30; cero asignaciones y mismos IDs. Estado separado: seed preparado/probado aislado/aplicado objetivo.

### RB-28 — Mensajes de dominio, correlación y seguridad de salida

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-08.
- Propietario/archivos exclusivos: integrador; `src/rental-common/errors/`, `dto/` de proyección común y catálogo/traducciones de seed rental-navigation.
- [x] Claves `rental:*` de 28 en errores públicos sin SQL, stack, contacto/notas/hash/request body; no hacer que un 404 revele huésped ajeno.
- [x] Proyecciones explícitas para recursos/operaciones/auditoría y logs clasificados con correlación/resultado/duración; sin contenido personal ni etiquetas de alta cardinalidad.
- [x] Mensajes relevantes de Server/Core ES/EN y clasificación 400/401/403/404/409/indisponibilidad; Client aplicará toast/formulario en su plan posterior.
- Cierre/pruebas: marcadores sensibles sintéticos ausentes de recovery/audit/errores/logs; efectos de filtro real comprobados RB-32.

### RB-29 — Regresiones de ámbitos, contratos y filtros

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-26.
- Propietario/archivos exclusivos: integrador; specs `use-case/*.use-case.spec.ts` de rental, tras entrega exclusiva de esos archivos por agentes A/B/C.
- [x] Matriz propietario/colaborador activo/revocado/externo/superadmin externo en cada ruta y asociaciones de casas distintas; ninguna API confía solo en módulo asignado.
- [x] Reglas reales del caso de uso, no mocks de permiso/saldo/disponibilidad; guardar/replay con propiedad de otra casa y key de otro actor rechazados.
- [x] Ransack/query con campos/orden/arrays/booleanos desconocidos; data/meta mismo ámbito y búsqueda SQL parametrizada, sin `all=true`.
- [x] active/status, omitido/null/false/0, snapshots desconocidos, UUID/money/date inválidos y ausencia de datos legítima.
- Cierre/pruebas: suite unitaria de casos de uso correcta; no editar concurrentemente specs que todavía trabaja un agente. HTTP/SQL se mantienen como evidencia separada.

### RB-30 — Ensayo PostgreSQL de esquema, migración y seed

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-05, RB-27.
- Propietario/archivos exclusivos: integrador; `test/rental.integration.mjs` fase schema, `test/fixtures/rental-schema-report.json`, script `test:rental:integration` en `package.json`.
- [x] Contenedor `template_rental_integration_<id>` con puerto dinámico loopback, credenciales sintéticas y cleanup propio; **no leer .env ni importar DataSource que abra BD configurada**.
- [x] Baseline sintético existente con users/módulos/traducciones/tablas anteriores necesarias; up/down/up preserva IDs/datos previos y metadata TypeORM no deriva cambios por drift.
- [x] Probar FK compuestas cross-house, UNIQUE de colaborador/regla/ref externa/intención/turnover y CHECK money/status/date/formula/ready/paid_on reales; calendario vacío no presume constraint de exclusión que no existe.
- [x] Doble seed mismos IDs/traducciones y cero user_modules nuevos; pg_dump/restauración sintéticos en otra BD aislada preservan dominio e historia.
- Cierre/pruebas: informe reproducible de versión SQL y resultado; si no hay PostgreSQL/Docker marcar prueba pendiente, sin sustituirla por mocks. No DB objetivo ni despliegue.

### RB-31 — Ensayo concurrente de autorización, dinero y calendario

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-26, RB-30.
- Propietario/archivos exclusivos: integrador; fases concurrency/query de `test/rental.integration.mjs`, `test/fixtures/rental-concurrency-report.json`, `rental-query-plan.json`.
- [x] Dos reservas del mismo intervalo; reserva contra bloqueo; confirmar/cancelar/editar/reactivar bloqueo con calendario vacío o vecino cambiante. Solo estado final compatible y plan revisado.
- [x] Mismo día: aprobación contra fecha/horario/vecino/mínimo modificados y entrada contra preparación; no aprobación residual basada en vecino anterior.
- [x] Dos cobros/refunds que juntos exceden límite, pago contra cancelación, void contra refund y dos pay de gasto; ningún saldo negativo/efecto parcial.
- [x] Dos reintentos misma clave/intención dejan un efecto/una auditoría/una operación, incluido POST inicial de casa y su advisory lock; clave divergente 409; fallo entre writes revierte; crash antes de commit y commit con respuesta perdida recuperables.
- [x] Revocar colaborador frente a pago/reserva/replay: orden observable conforme a protocolo, ninguna escritura nueva tras revocación confirmada. Sin deadlocks por orden inverso.
- [x] Volumen mayor a página/ventana; consulta por conjuntos y EXPLAIN representativo, conteos/sumas/ocupación correctos; medir planes y tiempos sin prometer escala de producción.
- Cierre/pruebas: conexiones separadas/barreras deterministas en PostgreSQL real, reporte de isolation/lock usados y límites. Requests seriales no demuestran carrera.

### RB-32 — API HTTP real con identidad sintética y fixtures

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-26, RB-28, RB-31.
- Propietario/archivos exclusivos: integrador; fase HTTP de `test/rental.integration.mjs`, `test/fixtures/rental-api.json`, `rental-openapi.json`.
- [x] Composition compilada, controladores/pipes/DTOs/serialización/filtro global reales sobre PostgreSQL aislado, principal owner/member/externo sintético; sin login Google/Redis/secretos reales.
- [x] Recorrer cada método/path 28 y validar payload desconocido/money string/null/arrays/enum/offset/query/params reales; 401/403/404/409 y mensajes seguros.
- [x] Flujo casa→política→colaborador→draft→cobro→confirmación→preparación→estadía/gasto/cancelación/refund/recovery; ruta Airbnb neta/ref externa cubierta sin API externa.
- [x] Descartar respuesta de una escritura confirmada y recuperarla por key; igualdad de resultado mínimo, luego lectura fresca de recurso. Revocado no recupera operación.
- Cierre/pruebas: fixtures/OpenAPI completos para Client y evidencia HTTP/DB separada de auth real; ausencia de servicios externos no se declara sesión de producción verificada.

### RB-33 — Cierre de calidad y entrega de contratos al Client

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-27, RB-29, RB-30, RB-31, RB-32.
- Propietario/archivos exclusivos: integrador; integración Server y fixtures/contratos de entrega, sin refactors ajenos.
- [x] Ejecutar `npm run build`, `npm run lint`, `npm run test` en Server; corregir errores del alcance y distinguir warnings históricos.
- [x] Ejecutar `npm run test:rental:integration` aislado cuando ya exista; checks ESM/DI/migración/locks/SQL/HTTP correctos y reproducibles.
- [x] Comparar endpoints/schemas/campos/errores con 28 y ERD, entregar fixtures definitivos y explicar cambios antes de que Frontend los consuma.
- [x] Revisar importaciones/límites/logs, ningún secreto ni modificación accidental de Business/Finanzas; preservar tests anteriores.
- Cierre/pruebas: tabla de resultados por capa y pendientes explícitos; pruebas aisladas no cierran login real, operación objetivo, despliegue o aprobación documental.

### RB-34 — Documentación y runbook de aplicación objetivo

- Estado: completado localmente; evidencia en «Entrega Backend».
- Dependencias: RB-33.
- Propietario/archivos exclusivos: integrador; docs/mvp 00/03/25/26/27/28/29 y ADR-012/013 según diferencias reales.
- [x] Registrar tareas cerradas solo con evidencia/archivos/comandos y límites; reconciliar versiones finales de esquema/contrato/JSON si difieren, sin aprobación automática.
- [x] Preparar secuencia de respaldo verificable, detener writers, aplicar migración mediante CLI controlado, seed:rental, asignación explícita, smoke e inspección postaplicación. Separar preparación de ejecución efectiva.
- [x] Registrar riesgo de runtime synchronize de desarrollo y mecanismo operacional para impedir cambios fuera de migración; no convertir revisión documental en arranque accidental contra datos reales.
- [x] Down conserva objetos previos pero destruye Reservas; rollback de datos requiere backup probado. No ejecutar BD objetivo/seed/deploy como efecto de cerrar plan local.
- Cierre/pruebas: enlaces/estado/ERD/Swagger coherentes y lista de pasos operacionales pendiente de ejecución. El plan Frontend posterior consume RB-33 sin afirmar implementación del cliente.

## Checklist para despachar y cerrar

- [x] RB-01..RB-08 entregadas, contrato28 y entidades congelados antes de tres carriles.
- [x] Agentes A/B/C reciben solo sus archivos y criterios; integrador conserva todos los comunes, entidades, módulos/controladores, scripts/package, integración y documentos.
- [x] Puntos de entrega A→B (casa/política) y C→B (pagos) disponibles antes de confirmación/cancelación; ninguna dependencia circular entre tareas/módulos.
- [x] Cada checklist/prueba tiene resultado y evidencia, sin marcar completado por propuesta o delegación.
- [x] Ensayo DB schema/seed/concurrencia y HTTP completado en aislamiento; SQL no ejecutado sobre BD del usuario para demostrarlo.
- [x] Estados separados al entregar: **migración preparada / probada aislada / aplicada objetivo** y **seed preparado / probado aislado / aplicado objetivo**.
- [x] Plan Frontend preparado después del Backend e implementado según30, con evidencia Client propia; BD objetivo y sesión real pendientes RC-38.

## Plantilla de encargo a un agente

Implementa [RB-ID/título] del plan29. Lee AGENTS raíz/Server, skills locales aplicables, ERD27/contratos28 y ADR-012/013. Dependencias terminadas: [IDs/evidencia]. Tus únicos archivos son [lista]; no modificar entities, rental-common, controladores/módulos, package, migración o documentos comunes sin asignación del integrador. Usa el mismo protocolo de acceso/locks/idempotencia/auditoría y manager transaccional. Completa criterios/pruebas reales desde casos de uso. Devuelve comportamiento, archivos, comandos/resultados y límites de evidencia. No leer secretos, alterar BD objetivo, inventar datos configurables ni aprobar documentos. Si requiere cambiar contrato, comunica y espera el ajuste coordinado antes de implementar esa parte; continúa en lo independiente.

## Verificación de la preparación

La preparación inicial contrastó arquitectura, contratos y diagramas sin ejecutar SQL. La entrega posterior implementó las tareas y ejecutó las verificaciones descritas a continuación. Se mantienen 44 operaciones y once tablas del ERD aceptado; Obsidian no necesita otro cambio de esquema.

## Entrega Backend — 2026-10-04

Los tres carriles implementaron configuración/pertenencia/políticas, reservas/preparación y dinero/consultas. El integrador compuso módulos/controladores, persistencia común, migración, navegación y pruebas. Las reglas residen en casos de uso; servicios reciben el manager transaccional. No se modificó Client en esa entrega Backend ni se añadieron dependencias. La entrega Client posterior se registra en30; el harness ahora admite --client solo para ensayos aislados.

| Evidencia | Resultado y alcance |
|---|---|
| `npm run build` | ESM y tipado de producción correctos; composición Nest aislada arranca sin ciclos |
| `npm run lint` | Sin errores ni advertencias nuevas; siete advertencias históricas en IA/facturas |
| `npm run test` | 528 pruebas / 94 archivos correctos; 159 pruebas de Reservas / 14 suites de casos de uso |
| `npm run test:rental:integration` | PostgreSQL 16.15 temporal; migración up/down/up, metadata sin drift, seed doble sin asignaciones, constraints y restore verificados |
| HTTP | Las 44 operaciones tienen una respuesta exitosa validada contra su esquema Swagger; las 42 rutas por casa rechazan externos, revocados y anónimos |
| Concurrencia | Alta de casa/pago con misma clave; dos confirmaciones; reserva/bloqueo y reactivación; cobros/devoluciones excesivos; pago/cancelación, void/refund y doble pay de gasto |
| Atomicidad y revocación | Fallo al insertar operación después del efecto/audit; terminación de backend antes de commit; pertenencia releída tras esperar un lock; recovery original sin datos privados |
| Límites y dinero | Cancelación de statement y deadline de transacción; SUM exacto superior a bigint de fila; consultas por conjuntos y límites de calendario |

Artefactos reproducibles: [ensayo](../../nodia-server/test/rental.integration.mjs), [reporte](../../nodia-server/test/fixtures/rental/report.json), [OpenAPI](../../nodia-server/test/fixtures/rental/swagger.json), [44 ejemplos HTTP sintéticos](../../nodia-server/test/fixtures/rental/api.json) y [mensajes ES/EN](../../nodia-server/test/fixtures/rental/messages.json). El reporte agrupa las fases schema/concurrency/query propuestas en archivos separados durante la planificación; no incluye credenciales. Los ejemplos contienen únicamente identidad/contactos sintéticos.

Cambios concretados sin cambiar tablas: DTO de respuesta mínimo y esquemas explícitos para todas las lecturas; detalle de turnover añade `current_previous_reservation_id`, `same_day_required`, `plan_valid`, `needs_approval`, mientras su lista conserva la proyección base. Catálogo público de errores ES/EN, validación rental con código estable, parser scoped de 64 KiB, `Cache-Control:no-store`, correlación generada por Server y logs de ruta/status/duración sin body/query. Se usa un reloj inyectable para ensayar start/complete sin modificar acuerdos históricos.

Locks: casa exclusiva para escrituras y compartida para lecturas scoped; revocación usa el mismo protocolo. READ COMMITTED, lock 2 s, statement 5 s y presupuesto de transacción 10 s desde que comienza la transacción. Un QueryRunner privado reduce el timeout de SQL cuando se agota ese presupuesto; rollback ocurre antes de propagar un fallo. No se abandona una transacción viva con Promise.race. Este presupuesto no incluye la adquisición de conexión del pool ni promete una latencia HTTP de 10 s.

Los ensayos usan identidad sintética y omiten Google/Redis: no verifican login ni cuotas distribuidas en producción. El EXPLAIN describe datos sintéticos locales, no capacidad del despliegue. Se conserva la limitación de v1: una estadía vencida que nunca se inició requiere un futuro comando explícito de cierre retrospectivo. Nodia no sincroniza disponibilidad ni ejecuta pagos/reembolsos externos.

## Aplicación objetivo — preparada, todavía no ejecutada

1. Confirmar el entorno/BD objetivo mediante el proceso operativo existente. Construir el Server y revisar `typeorm migration:show -d dist/config/data-source.js` en ese entorno; verificar baseline y migraciones pendientes. El script `migration:run` aplica **todas** las pendientes, incluidas Finanzas/auth si corresponde; no asumir que solo ejecutará Reservas.
2. Detener writers y generar un respaldo con pg_dump mediante la conexión operativa del entorno. Restaurarlo en otra BD aislada y verificar datos antes de proceder. El restore de esta entrega solo demuestra el procedimiento con información sintética.
3. Aplicar el conjunto revisado de migraciones con `npm run migration:run`. La nueva es [1791146000000-CreateRentalReservations.ts](../../nodia-server/src/migrations/1791146000000-CreateRentalReservations.ts); preserva objetos previos y no aporta el baseline completo de una instalación nueva.
4. Ejecutar `npm run seed:rental`. Verificar Tools/Reservas y traducciones, luego asignar explícitamente el módulo al usuario desde Settings. Pertenencia por casa y asignación del módulo siguen siendo distintas.
5. Reiniciar Server con `synchronize=false`, inspeccionar migration history/tablas/FKs y realizar smoke con sesión real: casa propia, colaborador, reserva, pago, confirmación/calendario/recovery. No sembrar datos comerciales inventados ni usar datos sintéticos como registros reales.
6. Si falla la aplicación, mantener writers detenidos. El down retira las once tablas y **destruye toda la historia de Reservas**; conservar el backup y restaurar datos para una reversión completa. No usar down como solución a una respuesta HTTP incierta: recuperar/reintentar la misma clave.

Estado operacional: migración preparada / probada aislada / **no aplicada objetivo**; seed preparado / probado aislado / **no aplicado objetivo**. Client posterior implementado usando contratos28, OpenAPI y fixtures con evidencia propia en30. Próximo paso operacional: RC-38. No se aprueba automáticamente el lanzamiento ni los documentos en revisión.

Revisión de errores de persistencia: las pérdidas de conexión y rollback no disponible producen una respuesta segura; los detalles del driver no se propagan a logs públicos. Un fallo al devolver la conexión al pool después del commit se registra y conserva el ack ya confirmado. Tres regresiones adicionales de casos de uso cubren estos caminos. Resultado final: 528 pruebas / 94 archivos y 159 pruebas de Reservas / 14 suites; ensayo HTTP final: 282 peticiones, incluidos cuerpo malformado, actor externo con etiqueta superadmin y límite de 1001 drafts sin presentar calendario truncado como completo. Páginas de 1/100 gastos usan 9 statements en ambos casos; páginas de reservas mantienen igual cantidad de consultas, verificable en el reporte.
