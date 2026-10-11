# ADR-025 — Calendario de estadías y selectores de fecha compartidos

> Estado: adoptado para la variante «Calendario primero» autorizada el 2026-10-09; integración Client verificada, aceptación operativa pendiente
> Fecha: 2026-10-09

## Contexto

Reservas necesita una experiencia centrada en ocupación y transiciones, con barras continuas y agenda móvil. El usuario solicita también unificar todos los inputs de fecha de Nodia. Son dos necesidades diferentes: planificación de estadías y captura de fechas/horas. El cambio alcanza Reservas, Finanzas, Facturas y posiblemente el provider MUI; tiene alternativas relevantes y costo de reversión.

## Opciones consideradas

### Opción A — FullCalendar Standard + MUI X Date Pickers Community

- Ventajas: motor de calendario React con integración oficial MUI; captura de fechas del mismo ecosistema; ambos con componentes MIT adecuados para este alcance. Peers públicos compatibles con React19/MUI9.
- Desventajas: dos dependencias con responsabilidades distintas; FullCalendar MUI exigió activar CSS variables y comprobar el theme y regresiones transversales.

### Opción B — MUI X Scheduler + Date Pickers

- Ventajas: ecosistema MUI único.
- Desventajas: Scheduler está beta/preview según documentación comprobada el 2026-10-09; requiere evaluar madurez/contratos antes de confiarle el flujo principal.

### Opción C — Calendario y selectores propios

- Ventajas: control total del estilo sin dependencias nuevas.
- Desventajas: mantener teclado, localización, distribución de eventos, accesibilidad y calendarios añade deuda técnica. El mockup local no constituye un motor apto para producción.

## Decisión

Se adopta A tras la elección explícita del prototipo «Calendario primero» y la integración comprobada en Client. FullCalendar Standard cubre mes/semanas/agenda, con toolbar MUI y estilos del tema. MUI X Community cubre Date/Time/DateTime. Dos selectores coordinados resuelven entrada/salida sin contratar rangos Pro. No instalar FullCalendar Premium/Scheduler para una sola casa.

El wrapper MUI declara soporte MUI9 desde7.1.1 y su peer Scheduler es opcional. Verificar peers y lockfile nuevamente al instalar, sin asumir que investigación implica integración exitosa. Si activar CSS variables compromete el theme, evaluar el paquete React Standard con toolbar MUI propia como variante de integración antes de cambiar el sistema visual global.

Los contratos de fecha civil, hora e instante permanecen distintos. La biblioteca representa/edita; Nodia Server mantiene autoridad de disponibilidad, dinero, concurrencia, acceso, preparación y recuperación idempotente. No introducir escrituras por arrastre en esta etapa.

## Consecuencias

- Consecuencias positivas: calendario legible y captura de fechas homogénea, con responsabilidades separadas y componentes compartidos.
- Costos o riesgos aceptados: prueba de CSS variables/theme, costo de bundle medido durante integración, migración explícita de consumidores y pruebas de zonas/DST.
- Mantenimiento posterior: conservar provider único y ES/EN, calendario dentro del módulo y todos los flujos del contrato existente; completar aceptación operativa y repetir regresiones pertinentes ante cambios.

## Referencias

- [Propuesta y evidencia 36](../../mvp/36-reservations-redesign-proposal.md).
- [Contratos de Reservas 28](../../mvp/28-rental-reservations-contracts.md), [plan Client30](../../mvp/30-rental-reservations-client-plan.md), ADR-020.
- [FullCalendar MUI](https://fullcalendar.io/docs/mui), [licencia Standard/Premium](https://fullcalendar.io/license).
- [MUI X Date Pickers](https://mui.com/x/react-date-pickers/quickstart/), [licencias](https://mui.com/x/introduction/licensing/), [Scheduler beta](https://mui.com/x/react-scheduler/).

## Verificación de la decisión — 2026-10-09

React/MUI FullCalendar 7.1.1 y MUI X Community 9.15.0 instalados; Scheduler opcional ausente. CSS variables funcionan en el provider existente en ambos temas y con overlays; no se creó un theme paralelo. DateCalendar y MultiSectionDigitalClock se componen con los campos existentes para conservar borradores strings/RHF. DateTimeInput convierte mediante las utilidades civiles/DST existentes en zona explícita. Dos DateInput coordinan el rango sin Pro.

QA aislado: 22 casos Edge, ocho anchos de320..1440px, claro/oscuro, ES/EN, selección/lectura única, fallo/invalidación/vacío y rechazo de borrador conservado. Tests de salida exclusiva, bloqueo parcial, borradores y DST. Auditoría sin vulnerabilidades. La configuración usa propiedades v7 color/contrastColor y plugins/rangos estables; datesSet no desencadena un ciclo de estado. Evidencia/checks en36 y00. RC-38/sesión real y teléfono físico pendientes; no hay cambios de Server/BD en esta entrega.
