# Nodia CV — preparación de interfaz

- **Fecha de revisión** 2026-11-24, Chile
- **Base revisada** `50bb9ec4`, rama `codex/nodia-cv`
- **Alcance** CV-00 y entrada a CV-02

Se contrastaron el [Plan113](../mvp/113-nodia-cv-implementation-plan.md), la
[guía UI](../features/nodia-cv/ui-design.md), el [sistema de diseño](../../nodia-client/DESIGN.md),
la [autoridad de módulos](../mvp/89-module-access-and-user-data-scope.md) y la
[decisión de destinos estables](../architecture/decisions/ADR-092-stable-module-navigation-routes.md)
con Client y sus pruebas. Los hallazgos de base sirven para implementar y
probar los recorridos nuevos.

## Integraciones comprobadas en la base

| Área | Hallazgo comprobado por código y aplicación para CV |
| --- | --- |
| Destino y asignación | Incorporar una sola constante para `/nodia-cv` en el Router lazy y `GuardStrict` bajo `BaseLayout`, y usarla en `APP_AVAILABLE_ROUTES`. `ModuleModal` consume el catálogo por reexport y `UserModal` maneja las asignaciones por ID. Registrar la ruta vuelve seleccionable el destino, que adquiere permisos mediante las asignaciones del módulo. [Router](../../nodia-client/src/routes/index.tsx) · [Opciones](../../nodia-client/src/routes/navigationOptions.ts) · [GuardStrict](../../nodia-client/src/routes/GuardStrict.tsx) |
| Layout | `PageContent` aporta 16/24/32 px laterales, 16 px verticales y la reserva móvil de navegación. En el flujo estándar permite scroll de documento. Dejar ese layout como propietario del padding exterior y limitar el scroll extra a tabla, modal o visor que lo requiera. [BaseLayout](../../nodia-client/src/layouts/BaseLayout/styles.ts) |
| Listado y editor de perfiles | `MobileRecordCard` tiene título accesible, campos de ancho completo, menú y acción primaria. Reusar para lista `xs`, con tabla paginada a partir de `sm`. `CalendarDayEditor` usa `useFieldArray` con una clave visual por fila. Mantener el ID persistente en el valor del agregado y separar su ciclo de la clave visual de React Hook Form. `DateInput` siempre entrega `YYYY-MM-DD`. Usar controles de precisión de mes o año compatibles con el contrato y conservar ausencia donde corresponde. [Tarjeta](../../nodia-client/src/components/MobileRecordCard/MobileRecordCard.tsx) · [Field array](../../nodia-client/src/modules/teacher/components/StudyCalendar/CalendarDayEditor.tsx) · [Fecha civil](../../nodia-client/src/components/inputs/DateInput/DateInput.tsx) |
| Abrir, confirmar y recuperar | `BaseModal` ignora el fondo y admite Escape configurable. Su X invoca `onClose` directamente, por lo que el consumidor protege el cierre en edición sucia o pendiente. `ConfirmDialog` ignora Escape y fondo y bloquea X, Cancelar y Confirmar en espera. Exponer Cancelar/X y retener objetivo, mensaje y botón de reintento ante error. La revisión mostrada acompaña el ID de la confirmación. [BaseModal](../../nodia-client/src/components/BaseModal/BaseModal.tsx) · [ConfirmDialog](../../nodia-client/src/components/ConfirmDialog/ConfirmDialog.tsx) |
| Selector de generación | `ComposerSelection` recibe catálogo, elegibilidad y callbacks del consumidor. Resume modelo/modo en un disparador de 44 px y abre un `Popover` anclado arriba, de ancho máximo 36 rem con márgenes de 16 px y dos columnas en `xs`. Preserva cambios parciales y comprueba coincidencia exacta de conexión, modo, modelo e intensidad. Reusar el patrón con transporte, autorización, elegibilidad y aplicación propios de CV. El texto `configuration.scope` de la implementación actual menciona la conversación y `onApply` pasa `routingEnabled`. Adaptar esa interfaz de presentación para expresar el alcance de CV antes de conectarla. [Selector](../../nodia-client/src/modules/nodiaAi/components/ComposerSelection/ComposerSelection.tsx) · [Estilos](../../nodia-client/src/components/AiComposerSelector/styles.ts) · [Catálogo propio de Teacher](../../nodia-client/src/modules/teacher/components/SelectionPanel/SelectionPanel.tsx) |
| Carga y error | Boneyard sólo para contenido informativo en primera carga sin datos. Conservar datos y valores de formulario durante revalidación, mostrar error y reintento en contexto además de Sileo traducido y desactivar envíos dependientes. `QueryErrorAlert` cubre error de consulta y acción de refetch. [Reglas de Client](../../nodia-client/AGENTS.md#manejo-de-estados-carga-loading-vacío-empty-y-error) · [Alerta](../../nodia-client/src/components/QueryErrorAlert/QueryErrorAlert.tsx) |

## Verificación al conectar CV-02

- Probar acceso directo por cuenta asignada y denegación con sesión vigente
  para una cuenta sin módulo o revocada. Comprobar selección en Módulos,
  asignación en Usuarios y traslado de grupo con la URL canónica intacta.
- Abrir perfiles vacíos, carga inicial, error recuperable y segunda página.
  Borrar el último de una página y comprobar página, selección y foco. En
  Perfiles, Generar CV y CV guardados se mantiene la jerarquía de navegación.
  La habilitación de Generar depende de una lectura exitosa de perfiles y el
  flujo de generación se conecta en CV-04.
- Añadir y quitar cartas de experiencia con identificadores estables, con
  fecha parcial y textos largos. Comprobar que editar conserva valores e IDs,
  duplicar abre un formulario de alta y el alta de una copia recibe IDs nuevos.
  Guardar y borrar presentan estados pendientes, de error y de confirmación.
- Comprobar teclado completo, foco visible y retorno al disparador o al
  vecino tras borrar, y mensajes accesibles vinculados a los campos. Probar
  disparadores de 44 px, 320/390 px, 599/600 px, 899/900 px y escritorio, en
  ES/EN y claro/oscuro. Añadir zoom y un caso de teclado virtual real para el
  editor antes del piloto. Distinguir navegador, emulación y teléfono físico.

## Línea base ejecutada

`npm ci --no-audit --no-fund` sobre el lock de Client y Node v24.20.0.
Vitest pasó 66 pruebas de ocho archivos en el worktree. Se incluyeron
`GuardStrict`, `ModuleModal`, `BaseModal`, `ConfirmDialog`, `MobileRecordCard`,
`CalendarDayEditor`, `DateInput` y `ComposerSelection`. Estas suites se
ejecutaron en jsdom con los componentes actuales. La geometría, el teclado
virtual, las peticiones de CV y los perfiles nuevos se verifican en CV-02.

## Próximas pruebas de integración

La pantalla de CV se verifica con la combinación implementada del guard,
catálogo, DTOs y persistencia. Después se prueba el selector con la selección
exacta del propio módulo, el paso de borrador a artefacto revisado y la
descarga de los mismos bytes guardados. La validación de lectura del PDF y
la comprobación de un ATS conservan resultados independientes.
