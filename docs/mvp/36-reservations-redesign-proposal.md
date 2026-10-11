# Reservas — rediseño y campos de fecha compartidos

> Estado: variante «Calendario primero» elegida y autorizada por el usuario; integración Client implementada, aceptación operativa pendiente
> Fecha: 2026-10-09
> Dependencias: 07, 08, 25, 26, ERD 27 aprobado, contratos 28, plan Client 30, plan móvil 35 y ADR-020

## Solicitud y límite de esta entrega

El usuario considera difícil utilizar Reservas y solicita reformular completamente la experiencia, investigar calendarios compatibles con MUI, extender los selectores de fecha al resto de la aplicación y probar primero un mockup interactivo. La fase inicial produjo la investigación y el prototipo sin modificar la aplicación. El 2026-10-09 el usuario eligió explícitamente «Calendario primero» y autorizó su implementación. La segunda fase integra el diseño y los inputs compartidos en Client; no cambia Server ni BD y no aprueba automáticamente documentos anteriores.

## Diagnóstico comprobado antes del rediseño

- `RentalWorkspace` reparte el flujo entre siete pestañas y abre pagos, detalle y preparación en distintos modales. General inicia seleccionado.
- `RentalCalendar` crea una celda por fecha y repite el botón con huésped, estado, fechas y horarios en cada noche. No dibuja una barra continua ni incluye cabeceras de días de la semana.
- Nueva reserva se inicia desde el listado. El calendario no entrega fechas seleccionadas al formulario.
- `ReservationModal` dispone muchos campos en un único formulario: estancia, huésped, canal, precio, abono, plazos y notas.
- El proyecto usa React 19, MUI 9.3.1, Emotion, DM Sans y paletas claro/oscuro. No tiene instalada una librería de calendario ni MUI X Date Pickers.
- `GetRentalCalendarUseCase` entrega una ventana con reservas, bloqueos y preparación; no devuelve importes ni saldos. Limita a 93 días y rechaza más de 1000 elementos por colección. El detalle monetario debe consultarse al seleccionar; no mediante una petición por evento.
- Los horarios pertenecen a cada reserva. La zona del alojamiento sigue siendo necesaria internamente para fechas e instantes, conforme a ADR-020.

## Propuesta de experiencia

Una cabecera de alojamiento y seis destinos de uso habitual: **Agenda**, **Reservas**, **Preparación**, **Caja**, **Colaboradores** y **Configuración**. Bloqueos, gastos e historial quedan accesibles en **Administrar**. La distribución parte de «Calendario primero»; por solicitud explícita del 2026-10-10, Colaboradores y Configuración pasan a ser pestañas permanentes, sin requerir abrir Administrar. Agenda conserva la selección inicial y enlaces anteriores conservan acceso a sus destinos.

| Tarea | Propuesta |
| --- | --- |
| Conocer ocupación | Mes/semanas con cabeceras L–D y barras que atraviesan las noches de la estadía; salida exclusiva |
| Revisar una entrada | Seleccionar la barra o evento; ficha contextual con horarios, canal, huéspedes, estado y acceso a pagos/preparación |
| Crear reserva | Acción siempre visible y clic en fecha libre; formulario progresivo Estadía → Huésped → Acuerdo; borrador explícito |
| Registrar dinero | Desde la reserva, indicar fecha efectiva y monto recibido; distinguir saldo, abono acordado y dinero recibido |
| Preparar la casa | Limpieza y ropa de cama por llegada; advertencia de recambio en el mismo día con revisión independiente |
| Usar móvil | Agenda en lugar de una cuadrícula comprimida; selección abre inmediatamente la ficha y cerrar vuelve a la agenda conservada |
| Administrar | Mantener CRUD, permisos, políticas, auditoría y bloqueos existentes detrás de acceso secundario claramente rotulado |

Dos variantes completas del mockup: **Calendario primero** y **Agenda primero**. Comparten el concepto y ofrecen distintos puntos de entrada. Se conservan tokens y tipografía de Nodia; botones principales completos en móvil, espaciado 16/24/32 y foco/labels visibles.

La implementación debe preservar selección explícita de alojamiento, paginado/filtros del servidor y acciones existentes: edición, confirmación, inicio/finalización, cancelación y devolución, archivado/reactivación, revisión de recambio, gastos, políticas y colaboradores. Simplificar navegación no elimina capacidades. La ficha monetaria no debe aparecer hasta disponer de su respuesta validada; un fallo del calendario nunca se interpreta como disponibilidad.

No arrastrar/redimensionar reservas para escribir cambios en esta primera propuesta. Fechas y horarios se editan mediante el flujo validado; el servidor conserva la autoridad ante concurrencia y preparación.

## Bibliotecas investigadas

Investigación inicial del 2026-10-09 en documentación oficial y metadatos públicos del registro npm. En esa fase se verificó compatibilidad declarada; el resultado de la integración posterior se registra al final.

| Opción | Hecho verificado | Evaluación |
| --- | --- | --- |
| FullCalendar Standard + React/MUI | Integración oficial `@fullcalendar/mui`, soporte MUI 9 desde 7.1.1 y React 17–19; Standard MIT | Propuesta para calendario de estadías y agenda |
| MUI X Date Pickers Community | MUI 9/React 19 declarados en peers; `DatePicker`, `TimePicker`, `DateTimePicker`, adaptación y localización | Propuesta para todos los campos de fecha/hora pertinentes |
| MUI X Date/Time Range Pro | Rangos incluidos en licencia comercial | No comprar ni introducir como dependencia implícita; coordinar dos selectores Community |
| MUI X Scheduler | La documentación actual lo identifica como beta/preview | No seleccionarlo para el flujo principal en esta fase |
| FullCalendar Premium | Timeline de recursos requiere licencia comercial en uso comercial | No necesario para una casa completa; no instalar Scheduler incidentalmente |

El peer `@fullcalendar/react-scheduler` de `@fullcalendar/mui` es **opcional**, comprobado con `peerDependenciesMeta`. Standard no implica contratar Premium.

La integración MUI de FullCalendar requiere `cssVariables: true` en el theme. `MUIProvider` no lo activaba antes del rediseño. Se realizó una prueba acotada antes de adoptar el wrapper: CSS variables, claro/oscuro, overlays, estilos globales y compilación. Conservar el provider único, paleta y tipografía. Si esta integración exige una alteración incompatible del theme, evaluar React Standard con toolbar MUI propia y tokens puente, sin recrear un motor de calendario.

Fuentes:

- [FullCalendar y MUI](https://fullcalendar.io/docs/mui).
- [FullCalendar React](https://fullcalendar.io/docs/react).
- [Licencias FullCalendar](https://fullcalendar.io/license).
- [Quickstart MUI X Date Pickers](https://mui.com/x/react-date-pickers/quickstart/).
- [Licencias MUI X](https://mui.com/x/introduction/licensing/).
- [MUI X Scheduler](https://mui.com/x/react-scheduler/).

## Contratos de la migración global de fechas

Crear componentes compartidos sobre MUI X, con `LocalizationProvider` único y adaptador Day.js, integrados con RHF/Zod y traducciones ES/EN. Contratos separados:

- `DateInput`: fecha civil `YYYY-MM-DD` o vacío/nulo según contrato. Nunca convertir una fecha civil a UTC para serializarla.
- `TimeInput`: hora local `HH:mm`, sin fecha ficticia en el contrato HTTP.
- `DateTimeInput`: edición en zona explícita del recurso y conversión a instante ISO con offset cuando el backend pide un instante; rechazar horas inexistentes/ambiguas según las utilidades actuales.
- Entrada/salida: dos selectores coordinados y resumen de noches; salida posterior, salida exclusiva, validación de disponibilidad y recambio con horarios. No clonar DateRangePicker Pro ni su código.

Inventario comprobado de consumidores para migrar, incluyendo tipos calculados que una búsqueda literal no detecta:

| Área | Consumidores |
| --- | --- |
| Reservas | `ReservationModal` (entrada/salida y horarios), `RentalOverview` (período), `RentalFilters` (fechas civiles dinámicas) |
| Dinero de alojamiento | `PaymentModal` (`occurred_on`), `ExpenseModal` (campos `_on`), `ExpenseActions` (fecha de pago) |
| Facturas | `InvoicesTab` (desde/hasta), `InvoiceModal` (fecha de factura) |
| Finanzas | `FinanceFilters` (desde/hasta); volver a inventariar campos semánticos y futuros consumidores antes de cerrar la migración |
| Instantes actuales en texto | `BlockModal` (`starts_at`/`ends_at`), `TurnoverModal` (`planned_ready_at`/`ready_at`), `ReservationCancel` (`cancelled_at`), `ReservationModal` (plazos de abono/saldo) |

Migrar explícitamente los consumidores; evitar que `TextInput` cambie de semántica silenciosamente según `type`. Conservar refs, error/helperText, labels, required, disabled, límites y borradores incompletos. El adaptador de edición no cambia DTOs ni la semántica del campo. Incluir una búsqueda final de inputs nativos/dinámicos para cerrar cobertura.

## Seguimiento del rediseño

- [x] Diagnóstico y contraste con contratos.
- [x] Investigación de librerías/licencias/peers.
- [x] Mockup interactivo y QA de comportamiento/layout.
- [x] Revisar experiencia: usuario elige «Calendario primero» y solicita implementación el 2026-10-09.
- [x] Integración de dependencias y CSS variables, themes y lockfile; auditoría sin vulnerabilidades.
- [x] DateInput, TimeInput y DateTimeInput compartidos; borradores vacíos/inválidos, localización y DST cubiertos.
- [x] Workspace/calendario integrados conservando contratos, recuperación idempotente y permisos.
- [x] Inputs nativos de fecha migrados, incluidos discriminadores dinámicos; búsqueda final sin consumidores productivos type=date.
- [x] QA Client de loading inicial/refetch/vacío/error y regresiones de cambio de ámbito, respuestas tardías, permisos, datos históricos y confirmación/recambio/cancelación/refund; alcance sintético y pruebas indicado abajo.
- [x] Verificaciones Client:1119 pruebas/178 archivos, typecheck, lint/build, auditoría y QA aislado correctos.
- [ ] Revisión con sesión real según RC-38 y aceptación en teléfono físico.

## Prototipo previo a la integración: alcance y límites

Fixture sintética independiente: alojamiento, nombres, precios, horarios, estados, pagos y gastos son ficticios. La UI lo indica expresamente. No usa HTTP ni credenciales y no escribe en la aplicación. En esa fase, calendario y selectores estaban dibujados para explorar la interacción, sin integrar todavía las librerías. La integración posterior se describe al final de este documento.

Implementa selección, navegación Mes/Semana/Agenda, buscador/estado, formulario por pasos, selector mensual, revisión de solapamiento de noches, borrador, registro de pago, abono previo a confirmación directa, preparación, gasto y bloqueo. Administrar muestra la ubicación propuesta de colaboradores/configuración/historial, con contenido limitado. No pretende simular todos sus CRUD.

Limitaciones explícitas: el mockup opera con importes seguros pequeños y cálculo local; producción mantiene strings decimales exactos/BigInt. Sus conflictos no prueban concurrencia, horarios, DST, archivo ocupante ni bloqueo por instantes. La demo de Caja agrega su fixture; producción consume el resumen del servidor por fechas efectivas y distingue liquidaciones netas Airbnb, devoluciones y gastos. Cancelación/refund, edición histórica, selección multi alojamiento y políticas completas se conservan como alcance de implementación, no están ejecutables en este mockup.

QA ejecutado con Edge headless mediante Playwright: ventanas exteriores 320/390/599/600/768/900/1024 px (el renderer reserva 32 px, anchos efectivos 288..992); sin overflow del documento. Ambos diseños, selección y detalle móvil inmediato, validación/retención del formulario, picker, conflicto, creación, pago/confirmación, preparación, bloqueo/gasto, búsqueda conservada al redimensionar, vacío, fallo de lectura, navegación semanal y Escape. Sin errores JavaScript. Capturas revisadas en claro/oscuro y móvil. No equivale a un teléfono físico ni a integración con Backend.

Fuente editable/evidencia de este chat: `C:/Users/Oscar/.codex/visualizations/2026/10/09/01a122cc-c313-7bf2-b636-485bd5292431/` (`reservas-nodia.html`, `verify-reservas.cjs`, `qa-result.json` y capturas). [ADR-025](../architecture/decisions/ADR-025-reservation-calendar-date-inputs.md) registra la decisión transversal y su adopción tras la elección del usuario; el prototipo por sí solo no acredita la migración.

## Integración Client — 2026-10-09

- Dependencias resueltas: FullCalendar React/MUI 7.1.1, MUI X Date Pickers Community 9.15.0, Day.js 1.11.23 y temporal-polyfill 1.0.5. Sin Scheduler/Premium/Pro. Instalación y actualización acotada de source-map-js; auditoría completa y productiva con cero vulnerabilidades.
- Provider MUI único con cssVariables y LocalizationProvider (AdapterDayjs, locale y controles ES/EN). Paletas/tipografía permanecen en el theme existente. Calendario sigue dentro de la ruta de Reservas, no en el shell global.
- Agenda abre por defecto; mes y semana FullCalendar, agenda explícita de siete días y agenda móvil para el mismo período seleccionado. Navegación móvil mensual coherente con la vista inicial; reducir ventana usa siete días. Cambiar ancho conserva fecha, selección y formulario.
- Estadías all-day por noches civiles con salida exclusiva. Bloqueos proyectados en zona del alojamiento, incluyendo un final parcial y excluyendo medianoche; tooltip/agenda conserva instantes reales. Estado textual y archivo visibles, tonos del theme, borradores/cancelaciones diferenciados. Sin escrituras por arrastre.
- Ficha de una sola reserva seleccionada con horarios, canal, huéspedes, saldo exacto y preparación; un GET al seleccionar, cero lecturas por evento. Foco en ficha tras lectura y retorno a la tarjeta móvil. Detalle completo conserva edición/confirmación/cancelación/inicio/finalización/devoluciones/archivo. Cobro rápido reutiliza PaymentModal y sus validaciones.
- Nueva reserva siempre disponible y por día/rango, en Estadía → Huésped → Acuerdo. Entrada/salida coordinadas por límites civiles; horarios empiezan vacíos. Retiene valores entre pasos, errores y rechazos. Solo el último paso envía el borrador; disponibilidad y recambio se validan en la confirmación existente, porque una cotización no ocupa fechas. La ficha del borrador creado puede verse aunque el filtro de ocupación lo excluya.
- Caja reutiliza agregados autorizados de RentalOverview, sin sumar la ventana del calendario ni páginas de reservas. Gastos siguen accesibles desde Caja/Administrar; Colaboradores y Configuración son pestañas principales permanentes; sus componentes/políticas, bloqueos e historial mantienen permisos.
- DateInput usa DateCalendar Community en popover escritorio/dialog móvil con campo de borrador civil; TimeInput usa MultiSectionDigitalClock de 24h. Esta composición conserva el texto incompleto sin normalizarlo a vacío, ref/label/errores/RHF y transporte string. DateTimeInput compone ambos en una zona explícita y emite ISO solo para una hora única; conserva el borrador ambiguo/inexistente para que la validación impida enviarlo. No añade una fecha ficticia al contrato de horas.
- Utilidades civiles compartidas en src/utils/civilDates.ts; imports de rentals/utils/dates.ts compatibles. Migrados Reservas, cobros/gastos, filtros de Caja y Finanzas, filtro y fecha de Facturas, bloqueos, preparación, cancelación y plazos. Filtros avanzados de instantes que no reciben zona del recurso conservan texto ISO con offset; no adivinan una zona.

### Evidencia y límites

Fixture [QA calendario](../../nodia-client/src/test/manual/reservations-calendar/README.md), componentes/servicios reales y adaptador Axios exclusivamente sintético. Los ejemplos Server se capturaron en distintos momentos del test de integración; el adapter QA reconcilia identidades y filtra la ventana, sin introducir datos de prueba en producción.

Edge headless/Playwright: 22 casos, 320/390/599/600/768/900/1024/1440 px en claro/oscuro; ficha inmediata móvil, lectura única, calendario de selección, cero overflow de página/diálogo; carga, vacío, caída y respuesta inválida; wizard ES/EN con rechazo 409, modal y montos preservados. Evidencia en el directorio externo del chat: calendar-browser-results.json y calendar-*.png. Se corrigió el bucle detectado en datesSet estabilizando plugins/rangos; FullCalendar 7 usa color/contrastColor, comprobados en navegador.

Regresiones Client incluyen salida exclusiva/bloqueos parciales, selección de borrador fuera de ocupación, edición conservada al fallar lectura, contratos de dinero/confirmación/preparación/cancelación, pasos y DST. Suite completa:1119 pruebas/178 archivos correctos; build (incluye tipado), lint, diff acotado y auditoría sin vulnerabilidades. Activación por teclado de un evento y foco en cierre de ficha comprobados en navegador. Reporte calendar-test-results.json y resumen calendar-implementation-verification.json conservados fuera del repositorio. Los viewports son redimensionados en Edge; no acreditan teléfono físico, teclado virtual ni sesión/BD reales. RC-38 conserva su aceptación pendiente.

## Nuevo mockup de Configuración — 2026-10-10

El usuario solicita replantear la vista de Configuración y revisar otro mockup antes de implementar. Dos propuestas interactivas independientes de producción: **Panel de casa**, con datos de alojamiento/valores sugeridos en paneles y políticas de cancelación debajo; **Por secciones**, con navegación local La casa / Valores sugeridos / Cancelación para enfocarse en una tarea. Ambas conservan el contexto de las seis pestañas, los campos actuales y la separación entre sugerencias/acuerdos capturados. Datos y acciones identificados como simulación, sin API/BD ni cambios de la interfaz productiva.

El prototipo permite editar datos/sugerencias, crear/editar tramos, elegir política predeterminada, filtrar por actividad y archivar/reactivar con confirmación local. Diseño ajustable mediante controles del host: radio, permisos de propietario y campos sin asignar. Filtros verticales, botón eliminar rojo y simulación de solo lectura. No agrega horarios de entrada/salida ni zona como campos editables del alojamiento. Contratos comprobados contra PropertyModal/ConfigurationPanel/PolicyTable, DTO de actualización y esquemas Client. No constituye una aprobación del diseño ni de un cambio de contratos.

QA Edge headless del mockup envuelto en iframe:8 combinaciones320/390/736/1024px, temas claro/oscuro, edición de casa/sugerencias, alta de política, selección predeterminada, filtros, archivo/reactivación y navegación de ambas variantes; sin overflow horizontal ni errores JS. Archivos configuracion-reservas.html y configuracion-mockup-qa.json en C:/Users/Oscar/.codex/visualizations/2026/10/09/01a122cc-c313-7bf2-b636-485bd5292431/. **Elección confirmada: el usuario acepta la primera variante, Panel de casa, y solicita incluir móvil en toda la sección de Reservas.**

## Panel de casa y ampliación móvil — 2026-10-10

Configuración integra la variante elegida: datos del alojamiento y valores sugeridos en paneles, políticas de cancelación en tarjetas y archivo/reactivación al final. Una columna en xs/sm; paneles y tarjetas en dos columnas desde md. Theme, padding exterior de PageContent, traducciones y contratos existentes conservados. Edición por grupo reutiliza PropertyModal, enviando solo campos modificados; alta completa permanece disponible. Valores ausentes se muestran explícitamente y ceros/importes exactos se conservan.

Las tarjetas muestran tramos ordenados, estado y política predeterminada, edición o lectura según permisos y selección predeterminada por ID. Selector existente permite elegir o quitar la predeterminada, incluida una política fuera de la página actual, sin descargar todo el catálogo. Se conserva búsqueda/paginación del servidor, filtro vertical Activo/Inactivo/Todos, protección contra desactivar la predeterminada, modales/borradores ante fallos y recuperación de resultados inciertos. La revalidación de la política guardada no desmonta editores ni reinicia filtros.

Ampliación móvil autorizada: Preparación, Colaboradores, Bloqueos, Pagos, Gastos e Historial usan MobileRecordCard en xs con campos y acciones definidos explícitamente; desde sm mantienen tablas650px con scroll local. ReservationTable y agenda móvil existentes se conservan. RentalTable comparte datos, filtros, página y handlers entre presentaciones; políticas usan tarjetas en ambos tamaños como parte del diseño aprobado. Acciones principales de cabecera/listado y formularios de reservas tienen área táctil de44px; contenida la contracción de Preparación/detalle. Sin nuevos proveedores, dependencias, endpoints ni cambios de Server/BD.

Evidencia Client y limitaciones: suite completa1136 pruebas/181 archivos y35 focalizadas/7 archivos, build/tipado/lint correctos. Verificación Edge headless con transporte sintético:138 comprobaciones en320/390/599/600/768/1440px, ES oscuro/EN claro, pestañas principales y paneles de bloques/pagos/historial, borradores al redimensionar/rechazar, guardado/default protegido/archivo con revalidación, ausencia/invalidación/fallo de políticas, permisos de lectura y texto largo/importes máximos, sin overflow horizontal. Script reproducible verify-configuration-mobile.cjs en fixture manual de calendario; resultados/capturas en el directorio externo indicado arriba. Confirmaciones operativas con sesión real y teléfono físico siguen pendientes; la elección visual no aprueba automáticamente otros documentos ni cierra RC-38.
