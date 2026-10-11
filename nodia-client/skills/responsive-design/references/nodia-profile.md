# Perfil Nodia — aplicar únicamente en este proyecto

Este perfil adapta la guía reusable al checkout de Nodia. Las rutas siguientes parten de la raíz que contiene `nodia-client` y `docs`; no de la carpeta de esta skill. Fuera de Nodia, usar las reglas del proyecto destino.

## Fuentes de verdad y alcance

Leer `docs/mvp/README.md`, `docs/mvp/00-progress.md`, `docs/mvp/07-design-constraints.md` y las dependencias afectadas. Consultar `docs/mvp/35-mobile-cards-shortcuts-plan.md` para tarjetas/barra inferior y `docs/mvp/08-stack-frontend.md` para el stack. Conservar estados de revisión y pendientes operativos; no atribuir aprobación a una implementación.

Aplicar `AGENTS.md`, `nodia-client/AGENTS.md` y sus skills obligatorias `frontend-quality`/`create-component`. Leer otras skills locales solo cuando el alcance lo necesite. `package.json`, lockfile y código actual resuelven APIs/versiones; no trasladar un ejemplo externo de Tailwind, Radix, Bootstrap o API MUI antigua.

07 conserva un alcance práctico de accesibilidad para el MVP. Mantener semántica, labels, teclado/foco y ergonomía de los componentes existentes conforme a reglas posteriores aplicables; no imponer una auditoría WCAG global, rediseño tipográfico ni nuevo objetivo de certificación. Ante una contradicción real con documentos aprobados, señalarla antes de introducir el cambio dependiente.

## Layout y estilo

- Theme en `nodia-client/src/theme/*`, composición en `src/providers/MUIProvider.tsx`. Breakpoints verificados en `src/theme/breakpoints.tsx`: xs0, sm600, md900, lg1200, xl1536; consultar nuevamente si cambia el theme. Móvil es `down("sm")`.
- `BaseLayout/PageContent` aporta padding xs16/sm24/md32 px. Páginas hijas no añaden otro padding exterior. Paneles: separación vertical24/horizontal16 px; los patrones específicos de tabla/filtros de 07 conservan sus separaciones particulares.
- Acciones principales de cabeceras, toolbars y modales ocupan ancho completo en xs. Mantener nombres accesibles y targets cómodos sin alterar acciones/permisos.
- MUI/Emotion, paleta, tipografía y tokens actuales; no crear otro theme ni sustituir fuentes por recomendaciones estéticas de una skill externa.
- Scroll: reutilizar overrides de `src/theme/components.tsx`. Track transparente `!important`, flechas ocultas y tamaño0, thumb6px/radio9999px/sin borde, blanco en dark o negro en light con alpha0.2/hover0.35; `scrollbar-width: thin` y `scrollbar-color: <thumb> transparent`, además de pseudo-clases WebKit.

## Tablas y tarjetas

- Tablas sin adaptación específica y vistas desde sm conservan `minWidth: 650` dentro de TableContainer con scroll horizontal local. Paginado fuera de ese scroll, en el contenedor visual existente.
- Listados existentes se adaptan por selección explícita; nuevos CRUD orientados a registros siguen DESIGN.md 9.6 por solicitud del 2026-10-09. ReservationTable, Modules (módulos/grupos), Users y Actions son referencias; reutilizar `MobileRecordCard` y la extensión optativa `renderMobileRow` de RentalTable cuando corresponda. Buscar los archivos actuales antes de editar.
- Compartir query, filtros, página, identidad y handlers. No generar todas las tarjetas a partir de columnas ni transformar calendarios/resúmenes automáticamente. Consultar el estado vigente de MC-06/MC-07 del plan35 antes de ampliar listados; invocar esta skill no implementa por sí solo tareas pendientes.
- Mantener precisión monetaria, datos ausentes, estados comerciales/activo separados y acceso a las acciones reales del recurso. Ver entidades/DTOs/casos de uso de `nodia-server` si hay dudas de contrato.

## Barra inferior y modales

BaseLayout autenticado ya dispone de MobileBottomNav en xs: cuatro accesos configurables más Inicio fijo, candado y catálogo autorizado. Mantener permisos, aislamiento por persona, rutas registradas y persistencia existente. No añadir una segunda navegación ni trasladar su catálogo a una lista estática.

Reutilizar `MOBILE_NAV_RESERVED_HEIGHT` en `src/layouts/components/MobileBottomNav/styles.ts` y la reserva existente de PageContent. Safe area y avisos deben convivir con la barra; aprovechar su detección actual de teclado, sin duplicar listeners ni fijar una altura adicional en páginas hijas. La aceptación física pendiente del plan35 no se considera cerrada por una prueba sintética.

Formularios usan los inputs reutilizables: TranslationInput para traducciones dinámicas, TextInput, SelectSingleInput, SelectMultipleInput, InputSearch y ConfirmDialog según tarea. Mantener BaseModal y el switch activo con patrón UserModal (`SwitchWrapper`, labelPlacement start, etiqueta600 y switch success). Una presentación inferior en xs no reemplaza su contrato/foco.

## Datos y feedback

- Boneyard solo para carga inicial informativa sin datos; controles con disabled/loading, sin skeleton. Refetch/mutación conserva datos con carga suave y bloqueo de controles correspondiente.
- Vacío informativo traducido; error con toast y Alert/reintento. Un responsable del feedback evita toasts duplicados.
- Mutaciones y acciones de estado emiten Sileo success/error internacionalizado. Conservar mensaje permitido del servidor y fallback traducido; ES/EN obligatorios. Fallo de escritura conserva modal y inputs; cierre automático solo tras éxito confirmado.
- Datos operativos desde contrato comprobable; ausencia explícita y ceros reales preservados. No inventar valores para rellenar tarjetas. No modificar modelos/proveedores IA al adaptar la presentación.

## Verificación

Usar la matriz proporcional de [responsive-verification.md](responsive-verification.md) y los scripts reales de Client. Aprovechar `nodia-client/src/test/manual/mobile-navigation/README.md` cuando intervenga barra/piloto, verificando que las fixtures sigan vigentes. Cambios de instrucciones no requieren levantar servidores, consumir APIs ni aplicar migraciones.
