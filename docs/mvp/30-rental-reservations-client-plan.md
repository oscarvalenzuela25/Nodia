# Tools → Reservas — plan de integración Nodia Client

> Estado: en revisión documental — Client implementado y verificado localmente; aplicación objetivo pendiente
> Fecha: 2026-10-04
> Dependencias: [entrevista 25](25-rental-reservations-interview.md), [especificación 26](26-rental-reservations-spec.md), [ERD 27 aprobado](27-rental-reservations-erd.md), [contratos 28](28-rental-reservations-contracts.md), [Backend 29](29-rental-reservations-backend-plan.md), [sitemap 05](05-sitemap.md), [rutas 06](06-route-specs.md), [diseño 07](07-design-constraints.md), [autenticación 14](14-authentication.md)

## Objetivo y estado comprobado

Actualización móvil 2026-10-08: [35](35-mobile-cards-shortcuts-plan.md) implementa barra inferior y piloto ReservationTable en tarjetas solo en `xs` (<600 px), con huésped, estado/inactividad, entrada/salida, noches y saldo, más detalle y editar. Reutiliza consulta, filtros y paginado; desde 600 px conserva tabla. RentalTable admite render móvil optativo y MobileRecordCard compartido; restantes recursos mantienen sus tablas hasta MC-06. Pruebas de carga/refetch/vacío/error, acciones y paginado, QA aislado en nueve tamaños, ES/EN y claro/oscuro registrados en35. Esta entrega no modifica endpoints, no aplica migraciones ni cierra RC-38.

Integrar la gestión de una casa completa en `/tools/reservations`: configurar casa y colaboradores, registrar estadías por noches, consultar disponibilidad, preparar recambio/limpieza y controlar dinero real en CLP. WhatsApp, Facebook y Airbnb son canales de registro manual. Las tarifas, horarios, abonos y reglas de cancelación los configura el propietario; no sembrar ejemplos como obligaciones comerciales.

El usuario solicitó preparar el plan con subagentes después del Backend y autorizó implementarlo. Client está implementado con los tres carriles y el integrador, sobre las 44 operaciones de Server. Pruebas y navegador contra HTTP/PostgreSQL temporal tienen evidencia propia abajo. La aplicación de migración/seed y la sesión real en la BD objetivo permanecen pendientes en RC-38. El desarrollo no aprueba automáticamente este documento.

Fuentes verificables para cada tarea:

- [AGENTS Client](../../nodia-client/AGENTS.md), skills locales [frontend-quality](../../nodia-client/skills/frontend-quality/SKILL.md), [create-component](../../nodia-client/skills/create-component/SKILL.md) y [regresiones pertinentes](../../nodia-client/skills/frontend-quality/references/regression-scenarios.md).
- [OpenAPI rental](../../nodia-server/test/fixtures/rental/swagger.json), [ejemplos HTTP sintéticos](../../nodia-server/test/fixtures/rental/api.json), [catálogo ES/EN](../../nodia-server/test/fixtures/rental/messages.json) y [proyecciones públicas](../../nodia-server/src/rental-common/rental-response.schemas.ts). Confirmar DTO, entidad y caso de uso concretos antes de escribir cada formulario.
- [Finanzas Client 24](24-personal-finance-client-plan.md), [transporte compartido](../../nodia-client/src/config/api.ts), [API path](../../nodia-client/src/config/apiPath.ts), [QueryCache](../../nodia-client/src/config/reactQuery.ts) y [feedback](../../nodia-client/src/config/httpFeedback.ts). Finanzas aporta patrones visuales, no el protocolo de escritura de Reservas.
- `nodia-client/package.json` y lockfile gobiernan versiones. Manifiesto actual: React 19, MUI 9, Router 8, TanStack Query 5, RHF 7, Zod 4, Axios 1.20.0, Vitest 4. No instalar calendarios, fechas, runners ni actualizar dependencias incidentalmente.

## Experiencia implementada

Una página con selector paginado de casa y siete tabs: **General**, **Calendario**, **Reservas**, **Preparación**, **Gastos**, **Colaboradores**, **Configuración**. General inicia seleccionado. Tab y `property_id` pueden quedar en query string validado; no colocar contactos, importes, notas ni claves de operación en URL. Elegir una única casa disponible al ingresar es admisible después de validar su detalle; una selección explícita nunca se reemplaza silenciosamente al cambiar filtros o perder acceso.

| Sección | Contenido y acciones |
|---|---|
| Sin casa seleccionada | Selector accesible; si no hay casas, explicación y Crear casa. Un error de listado no equivale a no tener casas |
| General | Caja del período, saldo pendiente, devoluciones/gastos pendientes, drafts con dinero, próximas entradas/salidas y preparación; enlaces a listados completos |
| Calendario | Mes o semana, navegación y rango acotados; reservas ocupantes, bloqueos y preparación; alternativa agenda/listado operable con teclado |
| Reservas | Tabla paginada, búsqueda/filtros, Nueva reserva; ficha y edición en modales. Acciones según estado: confirmar, registrar cobro, cancelar, devolver, iniciar, completar y archivar/reactivar |
| Preparación | Tabla y modal: recambio disponible/no disponible/por confirmar, limpieza, hora prevista, hora real y revisión de entradas/salidas del mismo día |
| Gastos | Tabla, crear/editar pendientes, corregir metadatos de pagados, registrar pago y anular captura errónea. Asociación opcional a reserva de la misma casa |
| Colaboradores | Lectura para miembros; propietario busca usuarios existentes, agrega, cambia cargo, retira o reactiva |
| Configuración | Datos y horarios habituales, capacidad, zona y abono sugerido; políticas de cancelación con reglas completas. Colaborador consulta sin acciones de edición |

Pagos/devoluciones se consultan tanto en la ficha de reserva como en un listado paginado abierto desde General. Auditoría abre un modal paginado desde la cabecera de la casa. Bloqueos se gestionan desde Calendario mediante listado y modales. Estos paneles no añaden rutas CRUD, un octavo tab ni tablas de dominio.

Mantener el sistema visual de Settings/Finanzas: MUI/Emotion y tokens existentes, sin cambiar tipografía global. Calendario destaca noches y horas de entrada/salida con leyenda y texto; no depende del color, no admite arrastrar estadías para escribir cambios. BaseLayout ya aporta padding 16/24/32 px; gaps de panel 24 px vertical/16 px horizontal. Botones principales ocupan todo el ancho en xs. Tablas minWidth 650, paginado fuera del desplazamiento horizontal y scrollbars transparentes conforme a 07/AGENTS.

Modales usan BaseModal, RHF/Zod, TextInput, SelectSingleInput/SelectMultipleInput y ConfirmDialog según función. TranslationInput solo si el contrato contiene campos traducibles; nombres de casa, huésped y política no son `translates`. Switch activo sigue Core/UserModal. Skeleton Boneyard solo para contenido sin datos iniciales; refetch conserva datos y usa carga suave. Controles dependientes disabled/loading durante sus peticiones. Vacío, error con reintento y feedback ES/EN se prueban separadamente.

## Contratos que condicionan la UI

1. **Identidad y permisos.** GuardStrict utiliza la ruta constante `RENTAL_RESERVATIONS_ROUTE=/tools/reservations`, que también consume APP_AVAILABLE_ROUTES. El seed Server usa key `rental_reservations`, grupo `tools`. Asignación del módulo y pertenencia a casa son controles distintos. `membership` de la casa determina capacidades de configuración/colaboradores; no copiar `action_ids`, selector de negocio ni bypass de superadministrador. Un 404 de recurso/recovery es ambiguo: revalidar detalle de casa y conservar intención incierta mientras se verifica. Solo si la casa responde404, bloquear ese contexto, limpiar sus datos autorizados previamente y pedir una nueva selección explícita. Un 403 exige revalidar capacidades; no borrar indiscriminadamente datos autorizados de otros ámbitos.
2. **Datos exactos.** IDs y CLP viajan como strings decimales canónicos. BigInt para cálculo/formato; límites de fila bigint y agregados sin ese límite son diferentes. Neto puede ser negativo. `null`, cero, false y campo omitido se conservan. No derivar caja sumando una página ni restar por segunda vez comisión Airbnb.
3. **Fechas.** Estadía se cobra por noches entre fechas civiles, con horas de entrada/salida, en `property.timezone`. No multiplicar intervalos de 24 horas ni usar zona del navegador como autoridad. Fechas civiles, instantes con offset y fechas efectivas de dinero son tipos distintos. Finanzas fija otra semántica de período: sus helpers de fechas no se importan para Rental. Instantes editados requieren resolución de zona explícita y rechazo de horas ambiguas/inexistentes; Server conserva autoridad.
4. **Acuerdo y archivo.** Crear produce draft y preparación inicial, sin ocupar fechas. Primer registro de dinero, incluso posteriormente anulado, o confirmación congela fechas/precio/canal/política/abono. La proyección de reserva no trae `has_payments`: consultar pagos de la reserva seleccionada con limit 1 y sin filtro de estado; `meta.total_items` confirma historial, nunca `received_amount=0`. No hacer esa consulta por cada fila. Archivar no cancela ni libera ocupación de estadías ocupantes.
5. **Confirmación.** Directo requiere política y abono recibido; Airbnb referencia y condiciones externas manuales, sin exigir liquidación. Availability no retiene fechas. `available=false` puede expresar requisitos de recambio; el usuario revisa planes y consiente IDs en `same_day_approvals`. No bloquear ciegamente por ese boolean ni por `plan_valid=false` del vecino prospectivo: Server recalcula vecinos y valida/aprueba atómicamente en confirm. Conflictos de ocupación se muestran y requieren corregir la propuesta.
6. **Preparación.** Recambio es boolean nullable; desconocido no equivale a disponible. Aprobar plan futuro no acredita limpieza real. Start requiere ropa disponible, limpieza completa y ready_at válido; complete exige salida alcanzada. No POST de turnover, edición de `previous_reservation_id` ni estado manual. Una estadía vencida sin start no tiene regularización retroactiva en v1: informar el límite, sin inventar comando.
7. **Cancelación.** Preview es POST de lectura, sin Idempotency-Key ni toast de mutación exitosa. Mostrar cálculo y guardar expected_refund_amount; 409 obliga a recalcular y revisar. Cancel aprueba devolución y libera calendario; no transfiere dinero. Airbnb exige resolución/importe manual incluso cero. Solo draft/confirmed antes de entrada; no cobrar saldo cancelado ni cancelar estadía iniciada desde esta UI.
8. **Dinero.** Payment/refund representa dinero efectivamente movido, no promesa. Captura inmutable: corregir con void motivado, nunca PUT/DELETE. Refund solo cancelada y dentro del importe autorizado; anularlo vuelve a abrir pendiente. Expense tiene estado propio pending/paid/voided y fecha paid_on; no acepta active. Pago parcial de gasto no está soportado.
9. **Proyecciones.** Detalle turnover aporta `current_previous_reservation_id`, `same_day_required`, `plan_valid`, `needs_approval`; lista/calendario no los incluyen. Calendar omite contacto/notas. Overview usa fechas de caja occurred_on/paid_on, pendientes de toda la casa y muestras limitadas a 10; etiquetar ámbitos y enlaces, no presentar muestras como listas exhaustivas.
10. **Límites.** Listas paginadas, limit máximo 100; candidatos búsqueda por nombre ≥3 caracteres y limit ≤20. Calendar [from,to) 1..93 días, máximo 1000 por conjunto; error exige reducir rango, sin mostrarlo completo. Overview/períodos de listas hasta 366 días. Filtros y orden por recurso según 28, sin `all=true`, columnas privadas o búsqueda de email/contactos.

### Ajustes comprobados frente al texto de planificación previo

El filtro global HTTP no conserva `turnover_ids` de una excepción 409. Usar `GET availability` y su `turnover_requirements` para revisar planes; no diseñar un modal que dependa de IDs inexistentes en errores. Antes de guardar draft, esos IDs pueden ser null. Consultar tras crearlo con exclude_reservation_id para obtener la transición de ese registro. El detalle del vecino muestra la transición persistida, no garantiza que describa la futura tras confirmar el draft.

La casa no expone `has_history`/`can_change_timezone`. No inferir editabilidad de zona de una página vacía de reservas. Explicar su inmutabilidad con historial y manejar el rechazo conservando valores; no descargar todo el historial para inventar esa capacidad.

BusinessCollaboratorModal consulta usuarios/acciones globales con `all:true` y email. Ese transporte no aplica a Rental: reutilizar apariencia/inputs, implementar candidatos de la casa sin email, sin creación de usuarios ni permisos por acción.

## Protocolo de escritura y recuperación

Toda mutación usa UUID v4 en `Idempotency-Key`, estable para una intención. Mutaciones devuelven **ack**, no entidad: `{operation,property_id,resource_type,resource_id,status,updated_at}`. Validar en runtime y reconsultar recursos afectados. Recovery devuelve `{schema_version:1,http_status,body:ack}` del efecto original; no sustituye el estado actual del detalle.

Estados de intención mínimos: editable → enviando → confirmada / rechazada conocida / resultado incierto → recuperando. Mantener método, path, payload canónico, actor, casa y clave en memoria de la sesión; no persistir contacto/notas en localStorage, Query keys, URL o logs. Deshabilitar envío concurrente en handler y controles. Una respuesta tardía se atribuye a su ámbito original y no cierra ni altera el formulario actual de otra casa.

- Respuesta exitosa y ack válido: confirmar una sola vez, toast success, invalidar consultas y cerrar el formulario de esa intención. Si el GET posterior falla, informar error de lectura, mantener éxito de escritura y permitir reconsultar; no reenviar el comando.
- Rechazo conocido sin commit según contrato: conservar formulario y mostrar error específico; al corregir se inicia intención nueva. Un 409 por intención incompatible no demuestra qué ocurrió con la clave original: revisar su resultado antes de descartarla.
- Timeout, red perdida o respuesta 2xx que no permite validar ack: no declarar fracaso definitivo ni generar nueva clave. Conservar payload y ofrecer recuperación/repetición explícita de la misma intención, sin retry automático de mutaciones. Si se repite, mismo método/path/body/header; no enviar edición bajo esa clave.
- Casa existente: consultar operations con actor/casa/key; si no aparece resultado, el 404 no demuestra ausencia de commit ni autorización. Repetir la misma intención si conserva acceso; ante revocación bloquearla e informar que el resultado sigue sin confirmar. No enviar con otra cuenta.
- Alta de casa: no existe recovery global y el propertyId puede ser desconocido; repetir exactamente POST con la misma clave. Server deduplica por actor/key entre casas. No buscar por nombre para inferir éxito.
- Renovación Axios tras 401 ya repite request(config); comprobar que conserva clave, payload y actor. Logout/cambio de usuario limpia memoria/caché, no interpreta aborto de transporte como rollback. Al salir con intención incierta explicar la limitación de recuperación tras recargar; v1 no tiene un registro duradero seguro de intenciones del navegador. Resolverla antes de iniciar otra captura equivalente; no prometer deduplicación entre claves nuevas.

Errores GET pertenecen a QueryCache/notifyHttpError existentes, sin toast duplicado en hooks/página. Hooks de mutación son el único responsable de éxito/error; reutilizar deduplicación/abort handling compartidos. Registrar namespace `rental` para códigos Server y copy. Preview usa tratamiento de lectura/error aunque sea POST; no suprimir errores ni contarla como captura. No actualizaciones optimistas de ocupación o dinero.

### Matriz de invalidación por casa y usuario

| Escritura confirmada | Consultas que se invalidan |
|---|---|
| Casa creada/editada/archivada | Listas/detalle de casa; cuando cambien defaults/capacidad/preparación, availability/calendar/turnovers/overview del ámbito |
| Colaborador/política | Listas/detalles respectivos, candidatos, casa/capacidades; políticas también selectores y propuestas no enviadas, sin alterar snapshots |
| Reserva creada/editada/confirm/start/complete/cancel | Listas/detalles de reservas afectados, turnover incluyendo vecinos, calendar/availability/overview; cancel además pagos/refund pendientes |
| Pago/refund/void | Listas/detalles monetarios, reserva y su elegibilidad de edición, overview y preview de cancelación |
| Gasto create/update/pay/void | Listas/detalle de gasto y overview; selector/listado de gastos relacionados cuando aplique |
| Bloqueo o preparación/approve | Listas/detalles de recurso, reservas/turnovers vecinos, calendar/availability/overview |
| Cualquier mutación | Auditoría del ámbito; recovery de su clave cuando corresponda |

No vaciar caché global como invalidación ordinaria. Keys incluyen userId/propertyId/recurso/id/filtros/ventana; properties y property.create se delimitan por actor. Placeholder previo solo en el mismo usuario/casa y recurso; no llevar datos de una casa a otra. Cancelar lecturas al cambiar contexto, no repetir/cancelar escrituras como si eso revirtiera el commit.

## Organización del trabajo multiagente

Esta planificación se revisa con tres subagentes de solo lectura: contratos/transporte, reservas/calendario/preparación y configuración/dinero. Durante implementación, el integrador prepara y congela la base común antes de habilitar estos tres carriles:

| Responsable | Alcance exclusivo | Integración |
|---|---|---|
| Integrador | RC-01..10 y RC-34..39; types/utils/infrastructure/hooks compartidos, componentes base, shell, router, traducciones y documentos | Contratos UI/API comunes, dependencias, composición y checks finales |
| Agente A — casa y administración | RC-11..15; PropertyModal/ConfigurationPanel/PolicyTable/PolicyModal/CollaboratorTable/CollaboratorModal | No modifica Business, router, caché común ni archivos globales |
| Agente B — operación de estadías | RC-16..25; ReservationTable/ReservationModal/ReservationDetail/ReservationConfirm/ReservationCancel/ReservationStayActions/RentalCalendar/BlockTable/BlockModal/TurnoverTable/TurnoverModal/SameDayReview | Expone callbacks tipados para abrir pagos y navegar a preparación; no importa una copia del módulo C |
| Agente C — dinero e historia | RC-26..33; PaymentTable/PaymentModal/PaymentVoid/ExpenseTable/ExpenseModal/ExpenseActions/RentalOverview/RentalAudit | Recibe IDs y contexto tipados, no modifica ficha de reserva ni shell |

Todos incluyen tests espejo bajo `src/test/modules/rentals/` del scope asignado. Las rutas de archivos de tareas son relativas a `nodia-client/`; archivos/componentes implementados; intenciones y ámbito están en infrastructure/intents.ts, useServices.ts y scope.ts. Carpeta PascalCase de componente/página: `.tsx`, `styles.ts`, `index.ts`; schema/hooks/infrastructure/types solo necesarios. No duplicar transporte por panel: `modules/rentals/infrastructure/{services.ts,useServices.ts,schemas.ts}` compartido por integrador. No importar helpers de negocio de Finanzas o Business.

Archivos comunes tienen **un solo editor**. Cada agente entrega al integrador las claves ES/EN requeridas y las solicitudes de endpoint/hook; el integrador incorpora cambios secuencialmente antes de integrar el carril. No despachar tareas que dependan de contratos comunes ausentes ni dejar imports rotos esperando otro agente. Congelar interfaces de props/context/actions y nombres de hooks en RC-08; cambios posteriores se coordinan antes de editar. Root ensambla desde el shell/host de modales y no reescribe componentes de otro agente mientras esté activo.

Orden: RC-01 → bases RC-02/03/04 → RC-05/06/07/08; RC-11 y después RC-09/10. Desde RC-09 pueden trabajar A/B/C en sus dependencias internas. RC-34 compone solo entregas verificadas; luego RC-35/36 → RC-37. RC-38 conserva aplicación objetivo como dependencia operacional; no bloquea planificación o UI con datos sintéticos. RC-39 registra cierres parciales honestos aunque RC-38 siga pendiente.

Cada encargo enumera IDs, dependencias resueltas, archivos permitidos, skills y pruebas. Un agente no crea chats, PRs, cambios de BD o despliegues como efecto secundario. Reporta archivos, checks reales, contratos faltantes y cambios comunes solicitados. No marcar tarea completa por tener render con mocks si sus criterios requieren HTTP integrado.

## Tareas asignables

Todas las tareas siguientes están **pendientes de implementación**. Los criterios de prueba son requisitos de cierre, no evidencia ejecutada en esta entrega.

### RC-01 — Tipos y validación de respuestas

- Dependencias: 28/29 y fixtures disponibles. Responsable: integrador.
- Archivos: `src/modules/rentals/types.ts`, `infrastructure/schemas.ts`; tests espejo.
- [x] Tipar listas/meta, detalles y proyecciones de los once recursos/tablas, snapshots finitos, membership, calendar/availability/overview, ack/recovery y enums de operación.
- [x] Validar respuestas en el límite Zod, sin fabricar fields/defaults. Diferenciar base/detail/calendar; IDs prospectivos nullable según response real.
- Cierre: fixtures reales válidos, respuestas incompatibles rechazadas, cero/null/false conservados y TypeScript estricto.

### RC-02 — CLP, porcentajes y propuestas comerciales

- Dependencias: RC-01. Responsable: integrador.
- Archivos: `utils/money.ts`; tests espejo.
- [x] Strings en inputs/transporte; formato exacto CLP y porcentaje por puntos base, tarifa×noches+limpieza−descuento, Airbnb neto y abono sugerido con redondeo explícito.
- [x] Mostrar porcentaje habitual como sugerencia editable, sin aplicar silenciosamente 20/100 ni tomar total calculado por Client como autoridad Server.
- Cierre: >MAX_SAFE_INTEGER, agregado >bigint de fila, neto negativo, límites, vacío/decimal/exponente y porcentaje cero/100 probados.

### RC-03 — Fechas, noches y zona de la casa

- Dependencias: RC-01. Responsable: integrador.
- Archivos: `utils/dates.ts`; tests espejo.
- [x] Validar CivilDate/LocalTime/Instant, contar noches calendario, definir límites exclusivos y presentar instantes en zona de la casa.
- [x] Resolver entradas de instante con zona/offset comprobados; rechazar hora ambigua/inexistente y validar con Server, sin zona fija ni fallback. Preferir campos civiles para operaciones que ya los admiten.
- Cierre: cambios de mes/año y horario de verano, browser en otra zona, 1/366 noches, ventanas 93/366 y fechas inválidas. No ajuste silencioso de hora.

### RC-04 — Transporte de las 44 operaciones

- Dependencias: RC-01. Responsable: integrador.
- Archivos: `infrastructure/services.ts`; tests espejo.
- [x] mainInstance + apiPath; paths `/rental/properties`, params/query allowlists por recurso, AbortSignal de lectura y header de intención en 22 mutaciones.
- [x] Cubrir 21 GET, POST preview de lectura y 22 mutaciones; comandos `{}` cuando corresponda. ACK no se interpreta como entidad; recovery con schema_version/http_status/body.
- Cierre: método/path/body/query/header exactos por operación, scopes sin actor en body, baseURL sin duplicar `/api/v1`, malformed response sin éxito ficticio.

### RC-05 — Intenciones idempotentes y resultado incierto

- Dependencias: RC-01/04. Responsable: integrador.
- Archivos: `infrastructure/intents.ts`, `components/RentalIntentReview/`; tests espejo.
- [x] Implementar estados del protocolo, UUID v4 estable, payload congelado, protección de doble envío y recuperación explícita de casa existente/alta sin propertyId.
- [x] Diferenciar éxito de escritura de fallo del GET posterior; timeout/2xx incompatible, 404 de recovery y 409 de intención incompatible no autorizan clave nueva. Los rechazos comerciales conocidos sin commit permiten corregir e iniciar otra intención. Memoria de sesión sin PII persistida; política de salida/recarga explicada.
- Cierre: respuesta perdida con commit, retry misma clave, alta recuperable, payload cambiado bloqueado, logout y actor tardío; ningún segundo registro por el mismo intento.

### RC-06 — Caché, permisos y feedback común

- Dependencias: RC-01/04/05. Responsable: integrador.
- Archivos: `infrastructure/useServices.ts`, `infrastructure/scope.ts`; cambios mínimos de feedback compartido solo si necesarios, con sus tests.
- [x] Query keys por actor/casa y parámetros, enabled sesión/casa/panel, paginación/abort y matriz de invalidación; sin retry automático de mutation ni optimistic cash/calendar.
- [x] Capacidades reactivas: revalidar casa ante404 de recurso/recovery antes de purge por revocación confirmada, conservando intención incierta. Deduplicar errores con QueryCache y éxito/error de mutación una sola vez, incluida recuperación. Preview mantiene feedback de lectura.
- Cierre: dos casas/usuarios, late response, revocación, refetch fallido con datos, errores runtime y doble toast; 401-renovación preserva intención.

### RC-07 — Traducciones y catálogo de navegación

- Dependencias: RC-01. Responsable: integrador, único editor global.
- Archivos: `src/translate/{es,en}/rental.json`, `src/translate/index.ts`, claves necesarias modules/core/home/layout existentes; tests espejo.
- [x] Namespace rental con catálogo Server y copy de tablas/modales/estados/riesgos comerciales; claves simétricas ES/EN y labels Tools/Reservas donde la navegación dinámica los requiera.
- [x] Labels comprensibles para noches, abono recibido, caja, refund aprobado/efectivo, recambio desconocido, archivado y resultado por confirmar.
- Cierre: catálogo completo, sin claves crudas/defaultValue, render/toasts ES/EN y sin mensajes técnicos de locks en UI.

### RC-08 — Contrato UI y reutilizables del módulo

- Dependencias: RC-02/03/06/07. Responsable: integrador.
- Archivos: `components/{RentalTable,RentalFilters,RentalRemoteSelect,RentalActiveSwitch}/`, tipos de props comunes; tests espejo.
- [x] Tabla Settings, barra búsqueda/crear, paginado y menú de acciones; filtro draft/applied, reset page, active solo recursos compatibles; selectores remotos paginados y selección fuera de página.
- [x] Congelar contrato de actor/casa/capacidades, callbacks para abrir ficha/pagos/preparación, busy/feedback y host de modal por intención. Reutilizar inputs y estilos existentes, sin crear variantes globales innecesarias.
- Cierre: estados inicial/refetch/vacío/error, reset filtro, scroll móvil/paginado, IDs estables y acciones bloqueadas; no transporte financiero en componentes base.

### RC-09 — Shell, selector y onboarding

- Dependencias: RC-08/11. Responsable: integrador.
- Archivos: `pages/RentalReservations/`, `components/RentalPropertySelect/`; tests espejo.
- [x] Selector paginado, detalle autorizado, siete tabs con consultas solo panel visible, query string validado y creación de primera casa realmente funcional.
- [x] Diferenciar lista vacía/error/selección revocada; contexto y modales por ID. Cambio de casa cancela lecturas y protege intención en vuelo antes de descartar un formulario.
- Cierre: varias casas mismo nombre, selección fuera de primera página, alta con ack/refetch, sin casa, URL inválida y logout tardío.

### RC-10 — Ruta y menú dinámico

- Dependencias: RC-07/09. Responsable: integrador.
- Archivos: `constants/routes.ts`, `src/routes/index.tsx`, `src/modules/generalSettings/pages/Modules/constants/routes.ts`; tests ruta/catalogo espejo.
- [x] Constante única importada por router y APP_AVAILABLE_ROUTES; lazyWithRetry/Suspense, GuardStrict modulePath igual a ruta y BaseLayout.
- [x] Integrar navegación Server de grupo tools/key rental_reservations, sin añadir tarjeta manual ni asignar el módulo a todos.
- Cierre: URL directa sin sesión/sin módulo/con módulo, opciones traducidas, lazy import/build; acceso a casa sigue validación independiente.

### RC-11 — Crear y editar datos de casa

- Dependencias: RC-08. Responsable: A.
- Archivos: `components/PropertyModal/` y schema/tests propios.
- [x] Campos DTO exactos; nombre, zona IANA, capacidad y horas obligatorios. Location/defaults/notas nullable; distinguir sin tarifa/abono habitual de cero.
- [x] Alta sin default policy, edición PUT parcial, switch Core; preservación ante timezone/history409, ack desconocido y errores.
- Cierre: casa sin defaults válida, campos omitidos/null, límites y formulario reintentable; sin datos comerciales inventados.

### RC-12 — Configuración y estado de casa

- Dependencias: RC-09/11. Responsable: A.
- Archivos: `components/ConfigurationPanel/`; tests propios.
- [x] Detalle leído por ambos roles, edición/archivo/reactivación owner-only; ConfirmDialog explica efectos sobre nuevos acuerdos y conservación de historia/liquidación.
- [x] Asignar/quitar default policy de la misma casa mediante opciones remotas; horarios/defaults solo nuevas propuestas, no acuerdos existentes.
- Cierre: colaborador sin edición incluso modal abierto, casa archivada con historia consultable, cambios rechazados conservados.

### RC-13 — Políticas de cancelación por anticipación

- Dependencias: RC-09/12. Responsable: A.
- Archivos: `components/{PolicyTable,PolicyModal}/`, schemas/tests propios.
- [x] Listado/detalle y editor de 1..100 reglas únicas incluyendo umbral 0, percent decimal; enviar política/reglas en un comando atómico, no CRUD por regla.
- [x] Activar/desactivar con owner y advertencia de default activo; quitar/reemplazar default es operación separada explícita, sin simular transacción del navegador.
- Cierre: reglas faltantes/repetidas/límites, error con borrador completo, snapshots históricos inalterados; cambios no editan reservas.

### RC-14 — Colaboradores de la casa

- Dependencias: RC-09. Responsable: A.
- Archivos: `components/{CollaboratorTable,CollaboratorModal}/`; tests propios.
- [x] Listado autorizado para miembros; candidatos owner-only por nombre≥3, debounce y paginado≤20, ID estable, sin email/action_ids ni catálogo global.
- [x] Agregar usuario existente, editar cargo y reactivar fila existente; retirar con ConfirmDialog conservando autoría.
- Cierre: candidato off-page, propietario excluido, duplicado409, búsqueda tardía, retirada y UI revocada; no all:true.

### RC-15 — Regresión de administración y membresía

- Dependencias: RC-11..14. Responsable: A.
- Archivos: tests espejo del carril A; correcciones solo scope A.
- [x] Probar owner/member/revocado, casa archivada, zona con historial, política default, formularios conservados y ausencia de campos globales Business.
- Cierre: entrega de carril con tests/typecheck/lint aplicables, inventario de claves y solicitudes comunes al integrador; no afirmar autorización HTTP por pruebas UI.

### RC-16 — Lista de reservas

- Dependencias: RC-09. Responsable: B.
- Archivos: `components/ReservationTable/`; tests propios.
- [x] Paginación, búsqueda de huésped/referencia explícita, estado/canal/período/active según 28; noches y dinero de proyección, sin N+1 de pagos/turnovers por fila.
- [x] Menús por estado y callbacks de ficha/edición/comandos; distinguir archivada de cancelada y draft con dinero de confirmada.
- Cierre: filtros reales y reset page, historia archivada, cero/null y límites; datos/refetch mantenidos.

### RC-17 — Modal de reserva y acuerdo

- Dependencias: RC-16. Responsable: B.
- Archivos: `components/ReservationModal/`, schema/tests propios.
- [x] Campos requeridos según DTO; sugerencias explícitas de casa, noches/importe estimado, abono editable; Airbnb usa abono0/política null y condiciones externas en comandos pertinentes.
- [x] Edición comercial solo draft sin ninguna fila monetaria; consultar pagos del ID seleccionado limit1 sin status antes de habilitar. PUT posterior limita a huésped/contacto/notas/archivo.
- Cierre: defaults ausentes, cobro anulado con saldo0, cambio de canal, acuerdo409, conflicto no impide guardar cotización ni inventa hold.

### RC-18 — Ficha y puntos de entrada de acciones

- Dependencias: RC-16/17. Responsable: B.
- Archivos: `components/ReservationDetail/`; tests propios.
- [x] Consultar detalle por ID y representar estado/acuerdo/snapshots/saldos/turnover; contacto/notas solo desde detalle, no calendario.
- [x] Exponer callbacks tipados de pago/refund/historial/preparación y comandos; archivo con explicación, sin copiar componentes de dinero ni estado como select editable.
- Cierre: IDs diferentes no comparten borrador, lectura fallida tras ack permite refetch sin recaptura, historia inmutable visible.

### RC-19 — Revisión y confirmación

- Dependencias: RC-18/25. Responsable: B.
- Archivos: `components/ReservationConfirm/`; tests propios.
- [x] Availability fresca del draft con excludeID; mostrar ocupación y requisitos de preparaciones afectadas, condiciones directas/Airbnb y consentimiento explícito de IDs.
- [x] Confirm único atómico con same_day_approvals; Server valida transición prospectiva. No exigir available=true/plan_valid=true como sustituto de regla transaccional; tras409 conservar revisión y refrescar requisitos.
- Cierre: abono insuficiente, vecino que cambia, lista de aprobaciones ajena, availability cambió entre lectura/commit y snapshot externo; sin confirm automático por cobro.

### RC-20 — Preview y cancelación

- Dependencias: RC-18. Responsable: B.
- Archivos: `components/ReservationCancel/`; schema/tests propios.
- [x] Preview lectura y confirmación comercial del importe; cancel con cancelled_at, expected_refund_amount y refund_amount/resolution_note cuando correspondan según DTO. No enviar campo motivo adicional.
- [x] Invalidar preview al cambiar inputs/pagos; 409 recalcula y solicita revisión explícita. Mostrar devolución pendiente sin declarar transferencia realizada.
- Cierre: tramo por días civiles y medianoche, preview cambiante, Airbnb0, anticipo/ahora no válido, fallo conserva modal/valores y no repite escritura.

### RC-21 — Entrada y salida de estadía

- Dependencias: RC-18/24. Responsable: B.
- Archivos: `components/ReservationStayActions/`; tests propios.
- [x] Comandos start/complete `{}` en ConfirmDialog; explicar horario acordado y preparación real requerida, sin estado automático por reloj.
- [x] Informar pendientes y límite de estadía vencida sin inicio; Server decide hora/estado vigente, no reloj Client como única validación.
- Cierre: plan aprobado sin ready_at no habilita entrada, ready futuro, salida anticipada, carrera y estado actualizado tras ack.

### RC-22 — Calendario y agenda accesibles

- Dependencias: RC-09/16. Responsable: B.
- Archivos: `components/RentalCalendar/`; tests propios.
- [x] Ventanas mes/semana hasta93 días, instantes en zona de casa, estados/leyenda, agenda/listado alternativo y callbacks por ID. Opción no ocupantes explícita.
- [x] No datos privados ni ocupación calculada solo desde reservas activas paginadas; error window_too_large ofrece reducir rango, no calendario truncado.
- Cierre: checkout exclusivo, archivada ocupa, draft/cancelled no, bloqueo, DST y navegador otra zona; teclado, listado y carga suave.

### RC-23 — Bloqueos de disponibilidad

- Dependencias: RC-22. Responsable: B.
- Archivos: `components/{BlockTable,BlockModal}/`, schema/tests propios.
- [x] Listado, crear/editar intervalo de instantes y motivo; activar/desactivar con efecto explícito y reglas de casa archivada.
- [x] PUT valida solapamientos en Server; sin mutar reserva al crear bloqueo ni arrastrar eventos del calendario.
- Cierre: intervalo inválido/conflicto/rehabilitación409, formulario preservado, block inactive libera y refetch correctos.

### RC-24 — Preparación planificada y realizada

- Dependencias: RC-09. Responsable: B.
- Archivos: `components/{TurnoverTable,TurnoverModal}/`, schema/tests propios.
- [x] Listado/filtros y GET detalle para estado derivado; ropa tri-state, limpieza, plan/hora real/notas. Nunca crear preparación ni editar vecinos/aprobación derivada.
- [x] Marcar realizado requiere recambio/limpieza y instante no futuro; cambios materiales advierten revisión de plan/aprobación, conservar Server como autoridad.
- Cierre: desconocido≠false/true, vecino cambia tras cancelación, ready invalidado, horarios incompatibles y failure deja valores.

### RC-25 — Revisión de recambio del mismo día

- Dependencias: RC-18/24. Responsable: B.
- Archivos: `components/SameDayReview/`; tests propios.
- [x] Revisar requirements de availability y detalles solo de planes seleccionados/necesarios, con ventana acotada; consentimiento por turnover ID y acción explícita approve-same-day `{}` cuando aplique.
- [x] Aprobar no representa limpieza realizada; transición prospectiva usa confirm con IDs consentidos, no una secuencia de aprobaciones que prometa atomicidad.
- Cierre: vecino confirmado afectado, requirements con null previo a draft, respuesta409 sin turnover_ids, horarios incompletos y aprobación obsoleta.

### RC-26 — Historial de cobros y devoluciones

- Dependencias: RC-09. Responsable: C.
- Archivos: `components/PaymentTable/`; tests propios.
- [x] Panel reutilizable por casa/reserva, paginado type/status/occurred_on/reference y detalle por ID. No active, no editable amount ni DELETE.
- [x] Distinguir confirmado/anulado y pago/refund; navegar a reserva sin sumar página como saldo.
- Cierre: >una página, consulta scoped, rowdetail no inventado y valor grande exacto.

### RC-27 — Registrar dinero efectivo

- Dependencias: RC-26. Responsable: C.
- Archivos: `components/PaymentModal/`, schema/tests propios.
- [x] Payload DTO de payment/refund, fecha efectiva/no futura, método/referencia/notas; reserva elegida de la misma casa con selección persistente paginada.
- [x] Airbnb primer pago draft incluye acuerdo externo requerido; directo exige política antes de primera captura. Mostrar neto esperado/límite de Server, sin simular cobro externo.
- Cierre: pagos parciales, sobrepago, draft con conflicto ya recibió dinero real, estado cancelado/refund aprobado y key estable ante timeout.

### RC-28 — Anular captura y liquidar devolución

- Dependencias: RC-27. Responsable: C.
- Archivos: `components/PaymentVoid/`; tests propios y composición payment/refund del carril C.
- [x] Void completo con motivo en ConfirmDialog; no corregir parcialmente registro. Refund hasta pendiente permitido y fecha no anterior a cancelación.
- [x] Base de cancelación congelada no admite void/create payment posterior; anular refund vuelve a abrir pendiente. UI revalida saldo tras cada ack.
- Cierre: void baja del abono confirmado, pago usado por cancelación, refund repetido/timeout, anulación devuelve pendiente y formulario conservado.

### RC-29 — Lista de gastos

- Dependencias: RC-09. Responsable: C.
- Archivos: `components/ExpenseTable/`; tests propios.
- [x] Paginación/búsqueda nombre, status/category/reservation/fechas incurred_on; categorías texto, sin CRUD ni filtros active.
- [x] Edición comercial solo pending; pagado permite nombre/categoría/notas/asociación, no monto/fecha incurrida. Pagar/anular según estado; paid_on separado de incurred_on.
- Cierre: período de gasto no se confunde con caja, nombres repetidos y página vacía tras cambios.

### RC-30 — Crear/editar gasto

- Dependencias: RC-29. Responsable: C.
- Archivos: `components/ExpenseModal/`, schema/tests propios.
- [x] Captura pending/paid según DTO, amount>0, incurred_on, paid_on solo donde corresponda, reserva opcional de la misma casa y null explícito al limpiar.
- [x] Selección remota paginada conserva ID, no autoselecciona primera reserva; PUT pagado solo metadatos permitidos. PUT nunca modifica status/paid_on; voided no admite edición.
- Cierre: null/cero/vacío, paid_on inválido, asociación ajena404 y borrador preserved ante rechazo/uncertainty.

### RC-31 — Pagar/anular gasto

- Dependencias: RC-30. Responsable: C.
- Archivos: `components/ExpenseActions/`; tests propios.
- [x] Pay con paid_on y void con motivo; confirmaciones explican dinero efectivo/corrección, sin pago parcial ni borrado.
- Cierre: comandos repetidos, fecha futura/anterior, casa archivada y timeout con recovery, caja refrescada una sola vez.

### RC-32 — General y pendientes

- Dependencias: RC-26/29. Responsable: C.
- Archivos: `components/RentalOverview/`; tests propios.
- [x] Período caja [from,to)≤366 días, importes exactos, pendientes globales y drafts con dinero separados. No denominar neto de caja utilidad/rentabilidad.
- [x] Muestras de próximas estadías/preparación con as_of/zona y enlaces a listados, callbacks de ficha/pagos/gastos. Error nunca muestra ceros ficticios.
- Cierre: caja distinta de pendientes, agregado superior a rango de fila, comisión no restada dos veces, listas10 rotuladas y refetch conserva cifras.

### RC-33 — Auditoría de la casa

- Dependencias: RC-09. Responsable: C.
- Archivos: `components/RentalAudit/`; tests propios.
- [x] Lectura paginada y filtros públicos; actor/hora/acción/proyección segura con copy traducido, sin editor ni contactos extraídos de snapshots.
- Cierre: ID/recurso/action exactos, scopes, página posterior, vacío/error/reintento y refresh tras comandos.

### RC-34 — Composición de los tres carriles

- Dependencias: RC-10/15/19/20/21/22/23/25/28/31/32/33. Responsable: integrador.
- Archivos: shell/context/host común y traducciones; componentes de carril solo después de devolución explícita de ownership.
- [x] Conectar callbacks ficha↔pagos↔preparación↔calendario y General↔listas, sin imports circulares ni todos los queries montados en tabs ocultos.
- [x] Comprobar cobertura visible de las44 operaciones, consistencia de busy/contexto y claves; eliminar cualquier placeholder temporal.
- Cierre: recorrido funcional sintético alta casa→política→draft→abono→confirmación→preparación→estadía; cancelación/refund/gastos y colaboración accesibles.

### RC-35 — Regresiones adversas de integración Client

- Dependencias: RC-34. Responsable: integrador.
- Archivos: `src/test/modules/rentals/` y tests de infraestructura/rutas compartidas afectados.
- [x] Ejercitar matriz de escenarios: doble clic, timeout con commit, ack2xx inválido, GET posterior fallido, renew401, logout/revocación, casas mismo nombre y late response.
- [x] Preservar inputs distintos de los iniciales tras rechazo, payload congelado incierto, cero/null/false, límites/páginas y filtros; no reducir assertions para pasar.
- Cierre: test/typecheck/lint, build por imports/rutas; informar número real y fallos preexistentes sin atribuir garantías PostgreSQL a mocks.

### RC-36 — QA visual, accesibilidad y traducciones

- Dependencias: RC-34. Responsable: integrador.
- Archivos: evidencia de QA en este plan; correcciones con ownership cedido.
- [x] Navegador 390/768/1440 px, light/dark y ES/EN; estados inicial/refetch/vacío/error, controles busy, scroll y paginado fijo accesible.
- [x] Teclado: tabs/selector, calendario y agenda, menús/modales, foco al abrir/cerrar, labels y errores; leyenda sin depender del color.
- Cierre: capturas/evidencia real y regresiones para defects relevantes. No declarar a11y total por comprobar solo un screenshot.

### RC-37 — Integración Client → HTTP → PostgreSQL aislado

- Dependencias: RC-35/36 y entorno aislado de29 reproducible. Responsable: integrador.
- Archivos: harness/fixtures de integración bajo tests, registro en este plan; Server solo cambios de pruebas coordinados.
- [x] Levantar Client real y API/PG temporal con datos sintéticos y migración/seed; adaptar harness de29 de forma confinada a pruebas, no relajar auth/guards del runtime productivo.
- [x] Demostrar requests desde navegador de flujo directo/Airbnb, cancelación/refund/gasto, recambio mismo día, bloqueos, revocación y respuesta perdida con una sola fila monetaria.
- [x] Separar principal sintético de sesión Google real; comprobar ack/GET y headers reales. Mock unitario o ensayo HTTP de29 por sí solo no cierra esta tarea.
- Cierre: evidencia reproducible Client→API→PG y checks finales; sin conexión a BD configurada ni datos privados.

### RC-38 — Aplicación objetivo y smoke con sesión real

- Dependencias: RC-37 y runbook de29/migración/seed/auth14 sobre entorno objetivo autorizado y respaldado. Responsable: integrador.
- Archivos: evidencia operacional/documentos; sin DDL implícito ni cambios improvisados de entorno.
- [ ] Revisar baseline y migraciones pendientes, apply/seed explícitos, módulo asignado, sesión/refresh/Redis y acceso owner/colaborador reales según runbooks existentes.
- [ ] Verificar ruta directa, casa seleccionada, captura/consulta y revocación con datos de prueba delimitados; no usar dinero/huéspedes reales como fixture.
- Cierre: evidencia objetivo y limpieza de pruebas. Mantener pendiente si falta entorno/sesión; runtime synchronize=false significa que iniciar Server no aplica esquema.

### RC-39 — Documentación y entrega de Client

- Dependencias: RC-34/35/36; incluir estado real de RC-37/38. Responsable: integrador.
- Archivos: este plan, README/progress/05/06/07/11/12 y contratos28 si cambia evidencia.
- [x] Marcar solo tareas verificadas, adjuntar checks/fixtures/QA y distinguir mocks, navegador aislado y sesión objetivo; registrar limitaciones de intención tras recarga y regularización de estadías.
- [x] Conservar revisión de contratos/planes/ADRs; no modificar ERD/Obsidian por presentación ni declarar producción lista por build local.
- Cierre: continuidad con primer paso pendiente y documentos coherentes; implementación parcial no se convierte en aprobación documental.

## Matriz de cobertura de contrato

| Grupo HTTP | Operaciones | Tareas consumidoras |
|---|---:|---|
| Casas: list/detail/create/update | 4 | RC-09/11/12 |
| Colaboradores: list/candidates/create/update | 4 | RC-14/15 |
| Políticas: list/detail/create/update | 4 | RC-12/13/17 |
| Reservas: list/detail/create/update/confirm/start/complete/preview/cancel | 9 | RC-16..21 |
| Dinero: list/detail/create/void | 4 | RC-26..28 |
| Gastos: list/detail/create/update/pay/void | 6 | RC-29..31 |
| Bloqueos: list/detail/create/update | 4 | RC-22/23 |
| Preparación: list/detail/update/approve | 4 | RC-24/25 |
| Calendar/availability/overview/audit/recovery | 5 | RC-05/19/22/25/32/33 |
| **Total: 21 GET + 1 POST lectura + 22 mutaciones** | **44** | Transporte RC-04; integración RC-34..38 |

## Criterios de entrega y pendientes

Planificación inicial: 39 tareas con dependencias y ownership. Implementación local: RC-01..37 y RC-39 cerradas; RC-38 permanece pendiente como aplicación operacional separada. Cerrar tareas verificadas no equivale a aprobar el documento.

Implementación: pruebas de cada tarea más `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` desde Client al integrar; scripts actuales del manifiesto. QA y flujo HTTP aislado tienen evidencia propia, la operación objetivo tiene la suya. Documentar herramientas ausentes o limitaciones sin instalar un runner como atajo ni etiquetar mocks como integración.

Pendientes confirmados: RC-38 (baseline, migración/seed/asignación del módulo y smoke con sesión real), revisión documental de26/28/29/30 y ADR-012/013. No se necesita fijar ahora tarifa, dirección, horas o tramos reales para implementar formularios configurables. Persistencia durable de intenciones, cambios de acuerdos congelados, regularización retroactiva, pagos externos, inventario de ropa y sincronización de canales requieren contratos posteriores.

## Revisión multiagente de esta planificación

Tres scopes de lectura aportan comprobación de contratos/transporte, estadías/calendario/preparación y administración/dinero. Hallazgos incorporados: ack distinto de entidad, alta recuperable sin propertyId, candidatos sin catálogo global, historial monetario aunque neto0, zona sin capacidad editable inferida, 409 sin turnover_ids y disponibilidad prospectiva cuya confirmación revalida vecinos bajo transacción. Las conclusiones documentales no son pruebas ejecutadas de Client.

Validación documental inicial, anterior a la implementación, ejecutada el 2026-10-04: 39 IDs únicos y consecutivos, todas las dependencias RC existentes y grafo sin ciclos; cero casillas de implementación marcadas. Se comprobaron164 enlaces locales en los once documentos de esa entrega, sin destinos faltantes, y44 operaciones de OpenAPI (21 GET, 16 POST incluyendo preview, 7 PUT). Las pruebas de implementación posteriores se registran abajo.

## Entrega Client y evidencia — 2026-10-04

RC-01..37/39 implementadas y verificadas localmente; RC-38 pendiente. La ruta `/tools/reservations` usa constante compartida, lazy/GuardStrict/BaseLayout y navegación dinámica Tools. Siete tabs incluyen Preparación; pagos/devoluciones y auditoría abren modales paginados. Los tres carriles entregaron casa/administración, estadías/preparación y dinero/historia; el integrador consolidó contratos, transporte, intenciones, caché, traducciones, composición y pruebas. Las cuotas de agentes terminaron durante el cierre; el integrador completó las correcciones y verificaciones finales.

| Comprobación final | Resultado |
|---|---|
| `npm run test` | **822 pruebas / 144 archivos** correctos, incluidas suites previas de Core y Finanzas |
| `npm run typecheck`, `npm run lint`, `npm run build` | Correctos; build muestra un aviso informativo de tiempos de plugins |
| Contratos y traducciones | 44 operaciones con fixtures reales y validadores runtime; 355 claves principales rental simétricas ES/EN |
| QA navegador | 390/768/1440 px × ES/EN × claro/oscuro: doce capturas y geometría; ensayos funcionales separados |
| Ensayo Backend después de adaptar el harness | `node test/rental.integration.mjs`: 282 peticiones correctas; report/fixtures regenerados y contrato de 44 operaciones verificado |

Las [regresiones de infraestructura](../../nodia-client/src/test/modules/rentals/infrastructure/useServices.test.tsx) cubren doble envío, respuesta perdida, ack inválido, rechazo comercial, 404 ambiguo, 409 de idempotencia traducido, renovación401 conservando UUID/body, logout/respuesta tardía y GET posterior fallido sin recapturar. El error del GET se notifica separadamente y conserva datos cacheados. El [selector remoto](../../nodia-client/src/test/modules/rentals/components/RentalRemoteSelect/RentalRemoteSelect.test.tsx) cubre búsqueda privada, páginas, selección fuera de página e IDs >MAX_SAFE_INTEGER con nombres iguales, distinguibles también en pantalla. Los formularios conservan sus valores modificados ante rechazo.

### Navegador → Client real → API → PostgreSQL temporal

Desde `nodia-server`, ejecutar `node test/rental.integration.mjs --client`; requiere Docker y dependencias instaladas de ambos proyectos. Crea PostgreSQL16 temporal en loopback, comprueba migración up/down/up y seed doble y sirve la UI en `http://127.0.0.1:5176/__rental_qa`. Vite usa configuración de ensayo con envDir=false y API del proceso aislado; no importa `.env`, Google, Redis ni BD configurada. Identidades sintéticas1/2/3; módulo asignado únicamente a1/2 en esa BD. No se relajan guards de producción. Terminar prueba o el límite de45min cierra UI/API y elimina únicamente el contenedor temporal mediante finally.

[Reporte completo](../../nodia-client/src/test/modules/rentals/integration/evidence/full-flow-http.json): **170 exchanges**, dos reservas,18 operaciones persistidas y tres filas monetarias. Registra método/path/actor/clave/status, sin bodies/contactos. Incluye rechazos comerciales corregidos expresamente.

- Casa, política con umbral0/devolución50%, default y reserva directa por dos noches: total200000/abono40000. Confirmación después del cobro.
- El POST del abono confirmó201 en Server y perdió la respuesta antes de Client. UI mantuvo la intención congelada y recuperó por GET operations con la misma UUID. [Reporte en ese punto](../../nodia-client/src/test/modules/rentals/integration/evidence/lost-payment.json): exactamente **una fila payment40000**, una escritura original y recovery200.
- Airbnb de dos noches, neto180000 tras comisión20000, referencia externa de reserva y condiciones manuales. Rechazo por referencia faltante conservó el formulario; se incorporó bloqueo explicado y regresión. Cobrar no confirma automáticamente.
- Entrada Airbnb el mismo día de salida directa: plan futuro revisado, ropa disponible, consentimiento fresco y confirmación atómica. Aprobar plan no acredita limpieza realizada.
- Cancelación directa con preview:40000 recibidos,20000 aprobados. Cancelar libera ocupación; refund separado registra devolución20000. No se ejecutan transferencias externas.
- Gasto de limpieza15000 pendiente y comando de pago separado. Caja Server: **220000 cobros−20000 devoluciones−15000 gastos=185000 neto**; pendientes0.
- Bloqueo visible en calendario. Colaborador agregado por candidato acotado sin email, configuración de solo lectura. Revocación seguida de404 de gasto y revalidación404 de casa retira sus paneles/datos.

Capturas del flujo: [escritorio con caja](../../nodia-client/src/test/modules/rentals/integration/evidence/desktop-es-light.jpg), [colaborador](../../nodia-client/src/test/modules/rentals/integration/evidence/collaborator-readonly.jpg), [revocación](../../nodia-client/src/test/modules/rentals/integration/evidence/revoked-access.jpg). Un segundo ensayo independiente verifica la [matriz visual](../../nodia-client/src/test/modules/rentals/integration/evidence/visual-matrix.json) sobre una casa vacía y acceso sin módulo; [HTTP visual](../../nodia-client/src/test/modules/rentals/integration/evidence/visual-http.json), [denegación](../../nodia-client/src/test/modules/rentals/integration/evidence/module-denied.jpg). Las capturas matrix no corresponden a la caja del primer ensayo.

En390px: documento380px sin desbordamiento horizontal, tabla650px con contenedor346px desplazable y paginación externa ([medición](../../nodia-client/src/test/modules/rentals/integration/evidence/mobile-table.json)). Enter navega período y abre/cierra formulario; flecha derecha mueve foco de Reservas a Preparación; el diálogo recibe foco y lo devuelve a Crear al cerrar ([registro](../../nodia-client/src/test/modules/rentals/integration/evidence/keyboard.json)). Calendario ofrece agenda y leyenda textual. Estados vacío/error/refetch/busy se prueban en componentes y se complementan con errores comerciales, respuesta perdida y revocación reales. No es una auditoría WCAG completa. Se separó el bootstrap del componente del harness para evitar una segunda raíz React durante HMR; el segundo ensayo terminó sin nuevos errores de runtime.

### Límites y continuidad

No se modificó la BD objetivo ni se ejecutó Server configurado, seed/asignación general, deploy o commit. Renovación401 unitaria e identidades sintéticas no validan OAuth/refresh/Redis reales. Start/complete tienen comandos y pruebas UI/Backend; el navegador utilizó fechas futuras, sin simular una estadía real en curso.

Intenciones en memoria de sesión: salir advierte sobre resultado incierto; recargar/logout no ofrece recuperación durable. Archivar estadía ocupante no libera fechas. Regularización de estadía vencida sin start no existe en v1. Canales manuales, sin sincronización ni ejecución de pagos externos.

**Primer paso pendiente: RC-38**, con el runbook de29: baseline, inventario de todas las migraciones pendientes, respaldo/restauración, aplicación explícita, seed, asignación individual y smoke con sesión real. Revisión/aprobación documental de contratos/planes/ADRs sigue separada; solo ERD27 tiene aceptación explícita.

## Revisión de endpoints y recuperación Client — 2026-10-08

Solicitud: revisar Reservas y la interacción de sus endpoints con el frontend. Se contrastaron transporte, DTOs, contratos runtime, autoridad por casa, comandos monetarios, estados y recuperación. No cambia el ERD, los contratos HTTP ni las decisiones de negocio.

| Hallazgo reproducido | Corrección |
|---|---|
| Un refetch de la casa fallido desmontaba el workspace y destruía formularios abiertos, aunque existieran datos previos | Se conserva el workspace ante errores temporales. Un 401/403/404 con respuesta sigue retirando el contenido cuando no hay intención pendiente; con intención pendiente conserva recuperación y bloquea operaciones nuevas. Una caída temporal no se interpreta como revocación; cada escritura conserva autorización en Server. |
| Fallar la revalidación del detalle cerraba el editor de reserva o bloqueo y perdía sus inputs; retirar ese detalle de la caché podía destruir el hook de recuperación de una escritura incierta | Se conserva el detalle validado al abrir la intención de edición, junto con sus valores y recuperación. Error y reintento permanecen dentro del modal; envío y campos quedan deshabilitados hasta recuperar la lectura. El handler también bloquea el envío. No se usa la fila del listado como sustituto de una primera lectura del detalle. |
| Una comprobación de acceso iniciada en otra sesión del mismo usuario podía retirar datos nuevos después de esperar la cancelación de consultas | La comprobación valida usuario y versión de sesión antes de cancelar, retirar e invalidar; una sesión nueva no recibe efectos tardíos de la anterior. |
| El botón de reconsultar la casa quedaba deshabilitado por una intención incierta | La lectura de recuperación solo se bloquea mientras su propia consulta está en curso; no reenvía ni descarta la escritura pendiente. |

Regresiones espejo en página, workspace y hooks reproducen los defectos anteriores; se conservan pruebas de respuesta perdida, ack inválido, payload/UUID congelados, refresh401, lectura posterior fallida, rechazo conocido y revocación. El transporte se verificó con respuestas HTTP recién generadas por el ensayo aislado y también con fixtures históricos. Las salidas regeneradas se restauraron después de verificar para evitar cambios de fechas/UUID sin valor en los fixtures versionados.

Evidencia de Server: `npm run test -- src/rental` pasó **159 pruebas/14 suites**; `npm run test:rental:integration` pasó **282 peticiones**, con **44 operaciones** y **42 rutas de casa** que rechazan externos/revocados/anónimos. Incluye PostgreSQL temporal, migración up/down/up, seed idempotente, ESM/DI compilada, validación de respuestas, rollback, concurrencia, revocación con locks, importes CLP y recuperación. El principal del ensayo es sintético: no certifica OAuth/refresh/Redis reales. Build pasó; lint conserva dos advertencias previas del módulo IA.

Client: **200 pruebas/51 suites de Reservas** y **970 pruebas/160 suites de la aplicación completa**, con `npm run test -- --maxWorkers=4`; typecheck/lint/build correctos. Se añadieron seis regresiones, incluidas conservación de inputs al fallar la revalidación, retirada de detalle de caché con una intención incierta y cambio de sesión durante una purga. La concurrencia del runner se acotó para evitar que la carga de imports agotara la espera del test existente de contactos de proveedores; se conservaron sus assertions.

### Estado comprobado del entorno configurado

Inspección **solo de lectura**, usando el DataSource compilado, sin imprimir credenciales ni datos comerciales: `public` contiene **0 tablas `rental_*`**, **0 filas del módulo `rental_reservations`** y **0 registros de `CreateRentalReservations1791146000000`** en el historial de migraciones. Esto confirma que RC-38 sigue abierto; los flujos HTTP aislados no demuestran que ese entorno pueda operar Reservas.

El historial del entorno declara **9 migraciones pendientes**: `AuthSessions1789257600000`, `AddIconToModulesAndModuleGroups1789257700000`, `CreateAiProviderCatalogAndRefactorAiProviders1789257800000`, `SeedSecurityActions1790553500000`, `HardenAiApiKeyEncryption1790553600000`, `AddTokenPlanFlagsToCatalogAndProviders1790553700000`, `AddIsDefaultToAiProviders1790553800000`, `CreatePersonalFinance1791085000000` y `CreateRentalReservations1791146000000`. Una migración pendiente en el historial no demuestra que todos sus cambios físicos estén ausentes; el baseline debe reconciliar ese estado. `migration:run` aplicaría el conjunto pendiente, no exclusivamente Reservas. Mantener el runbook de29 y revisar también las migraciones históricas IA antes de cualquier aplicación.

No se aplicó DDL, seed o asignación de módulos en el entorno configurado. La revisión no modifica la aprobación documental ni cierra RC-38. En esta revisión no se repitió el flujo de navegador de la entrega inicial; la nueva recuperación de UI se verifica mediante Testing Library y el contrato HTTP mediante PostgreSQL aislado.
