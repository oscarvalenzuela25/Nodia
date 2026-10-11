# Plan de tarjetas y accesos móviles

Ampliación explícita2026-10-10: el usuario elige Panel de casa para Configuración y solicita revisar móvil en toda la sección de Reservas. Preparación, Colaboradores, Bloqueos, Pagos, Gastos e Historial se incorporan a tarjetas xs con acciones/estado/query compartidos; tablas desde sm. Políticas usan tarjetas en ambos tamaños como parte del rediseño aprobado de Configuración. Agenda/Reservas/Caja y seis pestañas existentes se conservan. Evidencia y límites en36/30; no modifica la barra inferior ni declara aceptación en teléfono físico.

> Estado: diseño visual de la barra aprobado explícitamente; navegación y piloto de tarjetas de Reservas implementados y verificados localmente. Ampliación a otros listados en revisión.
> Fecha: 2026-10-08.
> Alcance autorizado2026-10-08: barra móvil, preferencias locales, selector y piloto ReservationTable. Ampliaciones explícitas2026-10-09 implementadas para catálogos de Ajustes, IA, Negocios y Finanzas personales, registradas al final; otras tandas y aceptación física permanecen pendientes.
> Dependencias: [07 — diseño](07-design-constraints.md), [08 — frontend](08-stack-frontend.md), planes [24 — Finanzas](24-personal-finance-client-plan.md) y [30 — Reservas](30-rental-reservations-client-plan.md), reglas de `AGENTS.md` y skills locales.

## 1. Requisitos confirmados por el usuario

- Cambios exclusivamente en móvil; escritorio conserva su diseño.
- Algunas tablas extensas deben convertirse en tarjetas verticales con información y acciones por registro.
- Navegación inferior: Inicio fijo, centrado y de mayor tamaño; accesos personalizables a ambos lados.
- Aclaración posterior del usuario: **cinco accesos en total**, dos a la izquierda, Inicio al centro y dos a la derecha. Candado flotante a la derecha, algo más arriba que el último acceso; solicitar una barra más estilizada.
- Ajuste posterior confirmado: barra pegada al borde inferior y **sin márgenes a los costados**; conservar Inicio elevado y candado flotante.
- Diseño visual vigente de la barra aprobado explícitamente por el usuario el 2026-10-08: «sí ese diseño me gusta». Referencia: mockup de borde a borde `nodia-mobile-edge-navigation.html`. La aprobación visual no declara implementación ni aceptación operativa completadas.
- Un espacio vacío ofrece `+` y abre un modal para escoger la sección.
- Candado a la derecha: cerrado oculta agregar/editar; abierto permite modificar los accesos.
- Accesos y estado del candado se guardan localmente por persona. Inicio no se configura ni elimina.
- Se solicita primero plan y mockup; no se presupone aprobación de las decisiones propuestas.

El requisito nuevo cambia la representación móvil del patrón de tablas descrito en 07 y en las aplicaciones de Finanzas/Reservas. Las tablas que permanezcan y las vistas desde `sm` conservan `minWidth: 650`, scroll transparente y paginado externo al scroll. Los apartados afectados de 07, 24 y 30 se reconciliaron sin aprobar automáticamente sus ampliaciones.

## 2. Inspección previa a implementar

Estos hallazgos describen la base inspeccionada; la implementación posterior se registra en el apartado 8.

| Hallazgo | Fuente | Implicación |
| --- | --- | --- |
| `BaseLayout` monta Sidenav, Topbar y PageContent; no hay barra inferior | `nodia-client/src/layouts/BaseLayout/` | La barra pertenece al layout autenticado, con espacio reservado debajo del contenido |
| Sidenav utiliza `useVisibleModules`, `getModulePath` y `getModuleIcon`; Inicio ya usa `/` | `src/layouts/components/Sidenav/Sidenav.tsx`, `src/store/generalSettings/` | Reutilizar navegación, permisos, traducciones e iconos existentes |
| La configuración persistida actual contiene solo tema y usa una clave global | `src/store/configStore.tsx` | No añadir accesos compartidos entre usuarios a esa clave sin separar identidad |
| Negocios y proveedores IA ya tienen tarjetas específicas | `Business/Business.tsx`, `AiProviders/components/ProviderCard/` | Conservarlas; no se identificó una lista de tarjetas de registros reutilizable |
| Reservas y Finanzas tienen envoltorios de tabla propios | `RentalTable`, `FinanceTable` | Incorporar una representación alternativa compartiendo datos, filtros, paginado y handlers |
| La tabla de Reservas expone huésped, estancia, noches, estado, activo, saldo y acciones detalle/editar | `ReservationTable/ReservationTable.tsx` | Piloto verificable sin inventar campos ni agregar comandos de negocio |
| El usuario autenticado puede tener ID ausente durante restauración | `src/store/authStore.tsx` | No leer ni escribir preferencias de otra identidad ni usar un usuario genérico |

El módulo Reservas sigue pendiente de aceptación operativa sobre la BD objetivo (RC-38). El mockup usa fixtures sintéticos y no demuestra disponibilidad real del módulo.

## 3. Diseño propuesto

### Límite móvil

- Activar tarjetas y barra solo en `xs`, ancho menor que `theme.breakpoints.values.sm` (600 px en el tema actual). Desde 600 px mantener las vistas actuales, incluyendo tablet.
- Padding de página de 16 px ya proporcionado por PageContent; sin añadir un segundo padding exterior.
- Tarjetas en una columna, sin carrusel horizontal ni scroll dentro de cada tarjeta. Scroll vertical natural de la página, separación de 16 px entre registros; separación de 24 px entre bloques de filtros/listado.

### Tarjetas

- Título que identifica el registro, estado con etiqueta, 3–4 datos principales y acción más utilizada; menú de otras acciones en el encabezado.
- Piloto Reservas: huésped; entrada/salida con horas de la casa; noches; saldo pendiente. Estado comercial e inactividad/archivo se distinguen cuando corresponda. Conservar ceros reales y tratar datos ausentes explícitamente.
- `Ver detalle` y menú `Editar` reutilizan los flujos existentes. No agregar cancelar, cobrar o eliminar donde la tabla no permita esas acciones.
- Información secundaria disponible en el detalle existente; evitar convertir todas las columnas automáticamente en una tarjeta larga.
- Propuesta recomendada: **Lectura clara**, con campos visibles. Alternativa en mockup: **Lista compacta**, con resumen y expansión local. La elección todavía no está aprobada.
- Mantener búsqueda, filtros del servidor y paginado. No descargar todos los registros ni introducir scroll infinito en esta fase. Selección, ordenamiento o acciones masivas existentes deben conservarse al adaptar cada sección.
- Carga inicial: Boneyard en información, controles normales deshabilitados. Revalidación: conservar tarjetas, progreso suave y acciones deshabilitadas. Vacío y error diferenciados, Alert/reintento y toast conforme al contrato actual.

### Barra inferior

- **Cinco accesos confirmados**: cuatro configurables, dos por lado, e Inicio fijo. La propuesta anterior de dos espacios personalizables queda reemplazada por la aclaración explícita del usuario.
- Inicio siempre al centro geométrico: círculo elevado de 72 px, adaptado a 64 px en pantallas estrechas. Accesos de 44 px con etiquetas; cinco columnas simétricas. Barra anclada abajo de borde a borde, con superficie opaca del tema, esquinas superiores redondeadas, borde superior tenue, sombra y halo alrededor de Inicio. Sin cápsula separada ni márgenes externos laterales/inferiores; los controles mantienen padding interior para ergonomía.
- Candado circular de 44 px **fuera de las cinco columnas**, flotante arriba a la derecha, alineado cerca del acceso derecho exterior. Reservar su altura completa y separación para no superponer objetivos táctiles ni contenido; no añadir otro control vacío para compensarlo.
- Barra fija en el viewport de producción (`bottom: 0`, `left: 0`, `right: 0`), fuera del padding de PageContent; con `env(safe-area-inset-bottom)` como padding interno sobre el mismo fondo, y altura compartida con el padding inferior de PageContent. No tapar paginado, botones, notificaciones ni contenido final. Revisar `viewport-fit=cover` al implementarla.
- Mantener menú lateral para acceder a todas las secciones. La barra es complementaria; no aparece en login ni layouts públicos.
- Estado inicial propuesto: espacios vacíos y edición abierta, para descubrir `+`. Guardar el candado escogido por usuario.
- **Abierto:** vacíos muestran `+`; ocupados muestran icono y señal de edición. Tocar abre el selector para agregar/cambiar/quitar. Texto visible `Editar accesos` y nombre accesible indican el modo.
- **Cerrado:** ocultar controles `+` y señales de edición; espacios vacíos quedan sin control/foco. Los accesos configurados son enlaces internos (`Link` de React Router) y siguen disponibles. Inicio siempre navega, incluso mientras se editan accesos.
- El candado regula edición de preferencias; no modifica autorizaciones.
- El cambio de significado del toque en un acceso ocupado durante edición es una decisión propuesta y visible en el mockup. Si se requiere navegación también con candado abierto, diseñar una acción separada para editar antes de implementar; no usar pulsación larga como única opción.
- Ruta activa con etiqueta y `aria-current="page"` cuando corresponda; label accesible completo para nombres largos, sin depender de tooltip/hover.

### Selector de sección

- Dialog MUI presentado como panel inferior en `xs`, reutilizando patrones de BaseModal y InputSearch. Título identifica lado; lista con icono/nombre, selección visible y botón Guardar.
- Catálogo derivado únicamente de `useVisibleModules`, con destinos internos válidos y registrados. Resolver etiquetas/iconos actuales desde el contexto; no mantener un segundo catálogo estático.
- Excluir Inicio, módulos sin destino válido y duplicados de cualquiera de los otros tres espacios. No aceptar URL escrita por usuario. `getModulePath` devuelve `/` para claves desconocidas: no interpretar ese fallback como sección válida para un acceso.
- Permitir cambiar y quitar el acceso ocupado. Cancelar/Escape conserva configuración. Quitar es reversible y no exige confirmación destructiva adicional.
- Carga/error del contexto de permisos tienen representación y reintento; no confundir contexto no cargado con catálogo vacío. Si realmente no hay secciones disponibles, explicar el estado vacío.
- Guardar solo después de validar y persistir. Sileo traducido al guardar/quitar/bloquear y ante fallo; conservar modal y elección cuando falle la persistencia.

## 4. Preferencias locales

- Store específico `mobileNavigationStore`, Zustand/persist o adaptador al almacenamiento existente; no duplicar auth ni gestor de rutas.
- Esquema versionado por origen de Nodia + ID autenticado: `{ version: 1, locked: boolean, slots: [ModuleReference | null, ModuleReference | null, ModuleReference | null, ModuleReference | null] }`. Orden: izquierdo exterior, izquierdo interior, derecho interior, derecho exterior. Inicio se renderiza aparte y no se guarda en este array.
- `ModuleReference` conserva la identidad que entrega el contexto actual (`module_group_key` + `module.key`); verificar unicidad real al integrar. No persistir nombre traducido, icono, tokens ni permisos. Resolver destino con el catálogo autorizado vigente.
- Restaurar solo con identidad validada. Al cambiar usuario, resetear estado en memoria antes de hidratar su clave; conservar las preferencias locales de cada persona tras logout.
- Validar JSON, versión, tamaño del array, identidades y duplicados. Una configuración inválida no debe romper el layout. Tratar almacenamiento bloqueado o sin espacio como error explícito, sin afirmar que se guardó.
- Si una sección seleccionada desaparece o pierde permiso: conservar referencia para revisión, bloquear navegación y mostrar `Acceso no disponible`; permitir reemplazar/quitar al desbloquear. No sustituir automáticamente por otro módulo o por Inicio.
- Preferencias locales a este dispositivo/navegador; no se sincronizan entre dispositivos. Borrar datos del navegador las elimina.
- Sin endpoints, tablas, migraciones ni cambios backend para las preferencias. La transformación de registros tampoco necesita endpoints nuevos mientras los campos existan en el contrato actual.

## 5. Plan de implementación

| ID | Trabajo | Resultado verificable |
| --- | --- | --- |
| MC-01 | Estilo de barra aprobado; cantidad confirmada: cuatro espacios más Inicio. Completar selección de tarjetas y actualizar reglas móviles en documentos afectados | Aprobación visual de barra registrada; reconciliación documental pendiente |
| MC-02 | Store local versionado, validación y aislamiento de identidad; selector de módulos con destinos válidos | Recarga y cambio de usuario seguros; fallos de almacenamiento recuperables |
| MC-03 | `MobileBottomNav` y `MobileShortcutDialog` dentro de layouts/components; estilos MUI/Emotion y ES/EN | Inicio centrado, candado y selección funcionales; contenido inferior accesible |
| MC-04 | `MobileRecordCard` de composición: título, estado, campos, acción principal y acciones secundarias; agregar render alternativo optativo en RentalTable | Un solo fetch/query y un único estado de filtros/paginación; escritorio intacto |
| MC-05 | Integrar piloto ReservationTable con campos/handlers actuales | Listado móvil usable, detalle/edición existentes y estados remotos completos |
| MC-06 | Aplicar patrón a listados de Reservas con valor móvil: pagos, gastos, colaboradores, bloqueos y preparaciones; revisar políticas caso por caso | Cada recurso tiene jerarquía propia; nada se transforma globalmente por heurística |
| MC-07 | Segunda tanda: movimientos/mantenimientos de Finanzas y productos/proveedores/facturas de Negocios; Ajustes Usuarios/Roles/Acciones/Módulos tras inventario | Selección explícita de secciones, manteniendo controles y permisos de cada vista |
| MC-08 | QA, pruebas de valor y actualización de evidencia/documentación | Matriz móvil completa y regresión escritorio; sin declarar aceptación real de Reservas pendiente |

Preservar tarjetas actuales de Negocios/IA. Calendario, comparaciones y resúmenes financieros no se convierten automáticamente en tarjetas. No unificar RentalTable y FinanceTable en un framework genérico de tablas como requisito previo: compartir solo la presentación que realmente se repita.

## 6. Pruebas y aceptación

- Store: dos usuarios en un navegador, restauración sin ID, logout/recarga, storage inválido/versiones antiguas/fallo de escritura, dos pestañas con evento storage y cambios de permisos.
- Navegación: Inicio fijo y centrado; agregar/cambiar/quitar; bloqueo persistente; vacíos sin foco al bloquear; enlaces a sección exacta autorizada, módulos sin ruta, duplicados y revocación; apertura/cierre por teclado y retorno de foco.
- Tarjetas: mismas filas y acciones que tabla; búsqueda, filtros/paginación de servidor, cero real/dato ausente, nombres largos, error inicial, refetch fallido con datos presentes y mutación que mantiene formulario al fallar.
- Probar 320/360/390/430 px; bordes 599/600 px y regresión 768/1280/1440 px. Tema claro/oscuro y ES/EN. Comprobar zoom, teclado virtual, orientación, notch/safe area, foco y último registro accesible sobre la barra.
- Crear tests espejo de store/hook/componentes con lógica; mocks sintéticos aislados. Ejecutar tests, typecheck y lint del cliente; build por nuevas importaciones/layouts. Checks del backend solo si se descubre y modifica un contrato.

## 7. Mockup previo

- Dos variantes interactivas: Lectura clara y Lista compacta; fixtures aislados, selector, candado, enlaces simulados, búsqueda, filtros, detalle y expansión.
- Revisión vigente del mockup: cinco accesos, barra de borde a borde pegada abajo, Inicio elevado y candado flotante arriba a la derecha. Reemplaza la cápsula flotante de la revisión anterior. Se muestran tres accesos de ejemplo y uno vacío para probar `+`; esas asignaciones son demostrativas y no cambian el estado inicial vacío propuesto para producción. El estado del visor se versiona para no interpretar el prototipo anterior de dos espacios como configuración de cuatro.
- El mockup conserva los colores y familia tipográfica del tema; usa iconos Lucide del visor como equivalentes visuales. La implementación usará iconos MUI y tokens del theme existentes.
- La preferencia del prototipo se conserva en el estado del visor, separada de la configuración real de Nodia. Los accesos demostrados no prueban permisos ni disponibilidad real.
- La barra se representa dentro del teléfono del prototipo; posicionamiento fijo, safe area y teclado se verifican al implementar en BaseLayout.
- Ajuste de borde a borde comprobado en el prototipo a 390 px: separación izquierda/derecha/inferior de 0 px respecto al interior del teléfono e Inicio centrado (desvío de 0 px). A 320 px no desborda y conserva controles de 44 px e Inicio de 64 px. Candado abierto/cerrado conserva el comportamiento anterior. Esta comprobación visual no demuestra aún posicionamiento fijo en la aplicación real.
- Verificación del diseño actualizado de cinco accesos: navegador a 320/390 px en claro y 430 px en oscuro; cuatro espacios configurables e Inicio, desvío de centrado medido de 0 px, Inicio de 64/72 px según ancho, controles de al menos 44 px y ninguna intersección entre sus objetivos táctiles en 320 px. Candado por encima del último acceso con separación medida de 21 px; sin desbordamiento horizontal en los contenedores comprobados. Agregar el cuarto acceso, exclusión de duplicados de los otros tres, guardar/quitar, bloqueo que conserva los cinco enlaces configurados y oculta edición, navegación simulada y Escape comprobados; iconos y acabado oscuro revisados con carga completa. Sin errores en la lectura de consola realizada. Pruebas de filtros, búsqueda y expansión registradas en la revisión anterior; no se modificaron sus handlers. Estas comprobaciones son del prototipo aislado y no reemplazan MC-08.
- Diseño visual de la barra aprobado por confirmación explícita del usuario el 2026-10-08. Durante esta etapa de mockup la implementación estaba pendiente; no extender esa aprobación a decisiones técnicas o al plan completo. Ver entrega posterior en apartado 8.

## 8. Implementación y evidencia — 2026-10-08

La instrucción «vamos con la implementación de ese diseño» autoriza el desarrollo. No constituye aprobación automática del documento completo ni aceptación operativa de Reservas.

- **MC-01:** regla móvil reconciliada en 07/24/30 e índice AGENTS. Para el piloto se implementó la variante de campos visibles; es una decisión de implementación, no una aprobación atribuida al usuario de ambas variantes del mockup.
- **MC-02/MC-03 completados localmente:** store Zustand con adaptador de escritura previa a publicación, Zod estricto/versionado, cuatro referencias únicas por identidad, tamaño máximo de lectura y eventos storage. Cambio de persona, sesión reemplazada y desmontaje del layout limpian memoria; preferencias permanecen por persona en el navegador. Fallos de escritura conservan modal, selección y configuración anterior, con toast y Alert. Enlaces se resuelven solo desde el contexto vigente; referencias revocadas permanecen para revisión, sin navegación.
- El catálogo compartido de destinos vive en `src/routes/navigationOptions.ts`; Modules reexporta la misma metadata. No se duplicó catálogo, autenticación ni consulta HTTP. MobileBottomNav reutiliza el contexto de autorización y el registro de iconos existente.
- BaseLayout monta la barra solo en `xs` y con sesión validada. Inicio fijo de 72/64 px; cuatro accesos de 44 px, candado flotante de 44 px, cero márgenes externos. Padding inferior compartido de 156 px más safe area; avisos Sileo por encima de la barra. La barra se oculta ante reducción visual por teclado y foco editable. Selector MUI al borde inferior, safe area, nombres ES/EN, búsqueda local, flechas de teclado, Escape y retorno de foco.
- **MC-04/MC-05 completados localmente:** MobileRecordCard comparte composición y handlers; RentalTable ofrece `renderMobileRow` optativo. ReservationTable muestra huésped, estado comercial separado de inactivo, entrada/salida con horas civiles, noches y saldo CLP exacto. Detalle/editar, filtros y paginación siguen sus flujos actuales, sin lecturas por fila ni endpoints nuevos. Boneyard visible en carga inicial informativa; refetch conserva registros con progreso suave y controles deshabilitados. Vacío/error/reintento diferenciados.
- **MC-06/MC-07 pendientes:** demás listados de Reservas, Finanzas, Negocios y Ajustes conservan su representación actual. No se transforma automáticamente ningún calendario o resumen.
- **MC-08, evidencia local:** suite completa Client **997 pruebas/165 archivos**; tras ajustes finales, **156 pruebas/51 archivos** focalizadas en navegación, selector, storage, búsqueda y componentes de Reservas, y **27 pruebas/7 archivos** posteriores de navegación/layout/modal/cards. Typecheck, lint y build correctos. Casos cubiertos: identidades, sesión reemplazada/logout/desmontaje, storage corrupto/versionado/duplicado/bloqueado, dos pestañas, ausencia/revocación/errores de permisos, modal preservado, selección por teclado, carga/refetch/vacío/error, cero real, detalle/edición y paginado remoto.
- Navegador con componentes de producción y fixtures aislados: 320/360/390/430/599/600/768/1280/1440 px. En móvil: cinco enlaces configurados, cero separación inferior/lateral respecto al área de contenido, cero desvío de Inicio, controles de al menos 44 px sin intersecciones ni desbordamiento horizontal. Desde 600 px: tabla presente, tarjetas y barra ausentes. Claro/EN a 320 px y oscuro/ES a 390 px inspeccionados; agregar cuatro, exclusión de duplicados, bloquear y restaurar tras recarga verificados. Último paginado a 390 px queda 17 px por encima del área reservada; avisos no cubren la barra. Lectura de consola sin errores en la comprobación realizada.
- Entrada reproducible: `nodia-client/src/test/manual/mobile-navigation/README.md`; fixtures identificados, fuera del bundle del producto. Las capturas de QA muestran datos sintéticos y no prueban disponibilidad real del módulo.
- Capturas y medidas locales: `docs/evidence/mobile-navigation/mobile-dark-es.jpg`, `mobile-light-en-320.jpg`, `desktop-light-en-1280.jpg` y `responsive-evidence.json`. Carga inicial Boneyard observada con diez bloques informativos y creación deshabilitada; desde el último paginado los controles permanecen visibles sobre la barra.
- InputSearch conserva nombre accesible traducido, y Limpiar búsqueda queda deshabilitado junto al input durante carga. Regresión adicional de bloqueo/teclado y navegación: **26 pruebas/5 archivos** correctos al cierre.
- Pendiente: aceptación en teléfono físico de teclado virtual, notch/safe area y orientación/zoom, y RC-38 con sesión/BD objetivo. No hubo migraciones, cambios de datos reales ni despliegue en esta implementación.

## Ampliación Modules — 2026-10-09

MC-07 completado parcialmente para módulos y grupos por selección explícita del usuario. Ambos listados usan MobileRecordCard en xs y tablas desde sm, compartiendo búsqueda, filtros y paginado remoto. Grupos incorpora filtro exclusivo Activos/Inactivos/Todos; ambos inician activos. Eliminación con confirmación, error conservado y notificación traducida. Grupos con módulos incluso inactivos se bloquean en backend. Reglas futuras registradas en DESIGN.md 9.6; otros listados de MC-06/MC-07 continúan pendientes. Contrato vigente en Modules/CONTRACT.md; ADR-021 registra limpieza transaccional.

Evidencia local de esta ampliación: Client1043/168, Server793/107;27 pruebas Client focalizadas y46 peticiones PostgreSQL/HTTP aisladas. Navegador320/390/599/600/768/1280px, ES oscuro/EN claro, tarjetas sin overflow, tabla desde600px y página conservada; conflicto por módulos inactivos, eliminación de grupo vacío y error/reintento de módulo verificados. Capturas externas en el directorio modules-qa del progreso00. Sin eliminación de registros reales. Aceptación física permanece pendiente.

### Texto del estado bloqueado — 2026-10-09

Por solicitud explícita se retira el rótulo persistente «Tus accesos · bloqueados» y su equivalente EN de la barra inferior. El candado conserva su estado y nombre accesible. Se mantienen la indicación de personalización al editar y los avisos de carga/error.

## Ampliación Usuarios — 2026-10-09

MC-07 completado parcialmente para Users por selección explícita del usuario. Activos por defecto y al limpiar filtros; quitar chip permite todos. Tarjetas en xs con nombre/email, estado y asignaciones reales; IDs completos, copiar, editar y activar/desactivar por los handlers existentes. Tabla desde sm y misma consulta, filtros/página y contratos. Paginado fuera de Skeleton/scroll; refetch conserva tarjetas y bloquea acciones. Continúan pendientes otras secciones y aceptación en teléfono físico. Sin migraciones ni modificaciones de cuentas reales. Contrato en Users/CONTRACT.md y referencia en DESIGN.md9.6.

Evidencia local: **1049 pruebas/168 archivos** de Client y28 focalizadas; tipado/lint/build correctos. QA con transporte sintético a320/390/599/600/1280px, ES oscuro/EN claro: sin overflow horizontal, página conservada, copia de ID bigint exacta, edición fallida conserva borrador y permite reintento, desactivación retira el registro de activos. Nombre/roles/módulos ausentes, vacío y error comprobados. Fixture `src/test/manual/users`; captura externa en el directorio users-qa indicado en00. La evidencia de navegador no sustituye aceptación en teléfono físico ni pruebas contra cuentas reales.

## Ampliación Acciones — 2026-10-09

MC-07 ampliado por selección explícita: acciones generales y de negocio usan tarjetas xs/tablas sm con la misma consulta, filtros/página, perspectivas y handlers. Ambos inician activos; generales permite todos quitando chip y Limpiar restaura activos, negocio ofrece Activos/Inactivos/Todos. Tarjetas muestran clave/nombre, estado, ID completo y descripción real/ausencia explícita; edición, estado, copia y eliminación accesibles. Confirmación general informa limpieza permanente de asignaciones a roles/traducciones y se conserva al fallar. Paginado fuera de Skeleton/scroll y controles bloqueados durante consultas/mutaciones.

Evidencia: Client **1056/168**, Server **806/108**, 24 pruebas Client focalizadas y40 Backend sobre borrado de catálogos. HTTP/DI con PostgreSQL temporal:26 peticiones, IDs grandes, aliases/filtros, limpieza selectiva, rollback y ambos órdenes de carrera; sin registros reales. Navegador320/390/599/600/1280px, ES oscuro/EN claro; sin overflow, tabla desde600px, página conservada, icono error.main, error/reintento, copia exacta y vacío/error verificados. Fixture `src/test/manual/actions`; contrato vigente y ADR-022 propuesto. Continúan pendientes otros listados y aceptación física; no se aprueba el plan automáticamente.


### Ajustes Roles — 2026-10-09

MC-07 ampliado por selección explícita: activos por defecto, Limpiar restaura activos y quitar chip permite todos. Tarjetas xs con estado textual, nombre traducido o clave, ID bigint completo, identificador y todas las acciones con etiquetas que envuelven; editar, copiar y cambiar estado reutilizan handlers. Eliminar con trash/error.main, confirmación y recuperación ante error; opción omitida para super_admin. La clave reservada es solo lectura y las traducciones siguen editables. Tabla desde600px; filtros de roles/acciones/búsqueda aplicados por Server antes de paginar, sin recortar las acciones incluidas. Misma página/consulta al redimensionar; paginado fuera del Skeleton/scroll y último registro eliminado vuelve a página anterior.

Evidencia: Client **1068/169** con maxWorkers4,36 focalizadas; Server **821/109**,66 focalizadas de catálogos/roles; builds/tipado/lint correctos, dos warnings históricos Server conservados. HTTP/DI/PostgreSQL temporal:35 peticiones y protección activa/inactiva/renombrado, limpieza selectiva, rollback de borrado/edición y ambas carreras de asignaciones a usuarios/acciones. Navegador320/390/599/600/1280px en ES oscuro y320px EN claro: sin overflow, controles de tarjeta44px, página conservada, cancelación/error/reintento y estados vacío/error distintos. En390px, fin del paginado671.22px frente a inicio de barra749.75px tras desplazarse al final. ID exacto renderizado; callback de copia cubierto por prueba unitaria. Fixture `src/test/manual/roles`; capturas/matriz externas en roles-qa registrado en00. La corrida inicial Client tuvo timeout de carga lazy de Contactos; la suite completa con cuatro workers pasó. Otros listados, aceptación física y sesión real siguen pendientes; no se aprueba el documento automáticamente.


### Ajustes proveedores IA — 2026-10-09

Por selección explícita del usuario, listado/detalle compactan sus paddings internos en xs sin duplicar PageContent. El detalle móvil conserva conexión/Volver/acciones y omite la cabecera completa del listado; pestañas verticales con teclado y estado persistente al redimensionar. Nombres de modelo/ID envuelven; OCR/razonamiento apilados y acciones principales44px. Panel Web ajustado a320px, cuotas/métricas desconocidas preservadas. API keys se presenta en tarjetas específicas xs y tabla650px desde sm, compartiendo consulta/página/handlers, máscara recibida, selección y papelera directa según contrato IA. Se mantiene confirmación y formulario ante errores. `unverified` recibe badge neutro/Sin verificar en el detalle.

Evidencia: Client **1072/169**,128 regresiones IA/11 archivos y build/tipado/lint correctos. Navegador320/390/599/600/1280px ES oscuro y320px EN claro: página de claves conservada al alternar tarjetas/tabla, OpenAI sin pestaña Web, ausencia de observación sin métricas inventadas, datos largos sin overflow, vacío/error, edición fallida con borrador/reintento y borrado fallido con confirmación/reintento. Paginado final658.53px por encima de barra749.75px a390px tras desplazarse al final. Fixture aislado `src/test/manual/ai-providers`; capturas y matriz externas en ai-providers-qa referenciado en00. No se autentican cuentas ni ejecutan inferencias reales. Otros listados y aceptación física permanecen pendientes; documento sin aprobación automática.


### Negocios: ampliación móvil — 2026-10-09

Por solicitud explícita, listado y detalle con cinco pestañas compactan padding interno y apilan acciones/pestañas verticales reales. Proveedores, productos, facturas, colaboradores y contactos usan tarjetas xs y tablas650px desde sm; consulta, búsqueda, filtros, paginado y handlers compartidos. Se mantienen mapeos/instrucciones del proveedor, historial/variación del producto y teléfonos/correo/horarios del contacto. Paginado fuera del Skeleton y scroll, controles44px y etiquetas ES/EN. Comparaciones de importación conservan tabla con scroll local también en xs; controles de CSV/factura apilados, sin modificar procesamiento o inferencia.

Contrato complementario: descripción única opcional compatible con DTO translates; últimas10 facturas activas filtradas antes de paginar; activos iniciales en proveedores/productos/facturas/colaboradores y búsqueda de colaboradores. Iconos nativos de fechas del color del texto; Activo de factura después de Ruta/Archivo. Ver [contrato vigente](../../nodia-client/src/modules/business/CONTRACT.md),06/07 y DESIGN9.6/9.7.

Evidencia: Client1083/170 y build/tipado/lint correctos. Navegador320/390/599/600/1280px ES oscuro,320px EN claro; sin overflow de página, frontera tarjetas/tabla y página26–27 conservada. Contactos largos con todos sus canales, vacío diferenciado de error, recuperación de carga y formulario fallido conservado/reintentado. Calendario blanco/negro comprobado visualmente en oscuro/claro; no se atribuye soporte verificado a navegadores no utilizados. Paginado final728.31px frente a barra805.75px en390x900. Fixture aislado src/test/manual/business; capturas/matriz business-qa referidas en00. QA de importación limitado a presentación sin archivos/inferencia; prueba sintética no sustituye sesión real ni aceptación física. Documento sin aprobación automática.


### Paginación móvil compartida — 2026-10-09

Ajuste solicitado para todas las tablas con presentación móvil: primera fila «Filas por página»/selector; segunda rango/flechas juntas. MUI global separa las filas con flex, justifyContent center y salto decorativo en xs, conserva el orden DOM/foco y botones44px; desde sm permanece la fila única. Retirados overrides locales duplicados de catálogos, Negocios, Finanzas, Reservas y claves IA. Tamaño fijo mantiene rango/flechas sin selector ni fila vacía; página/tamaño/handlers no cambian. Referencia futura DESIGN9.6 y07.

Evidencia: Client1083/170, build/tipado/lint correctos. Nueve variantes con componentes/theme reales y estado sintético verificadas320/390/599/600/1280px: primera/segunda fila alineadas, sin overflow, página conservada y selector operable. ES oscuro/EN claro; Módulos de producción con transporte sintético a390px muestra rango1–3 de3 y flechas bajo label/selector, pie alcanzable sobre barra móvil. Fixture src/test/manual/pagination; captura/matriz pagination-qa referidas en00. Sin modificaciones de BD ni servicios, sin afirmar aceptación física o aprobación documental automática.

## MC-07: Finanzas personales — 2026-10-09

Selección explícita del usuario implementada para toda la sección: General (indicadores, últimos movimientos y resúmenes por categoría/grupo), movimientos, préstamos/deudas, categorías y grupos. Cards xs/tablas sm con mismas consultas/filtros/página/handlers; selector de sección compacto solo xs, importes fullWidth exactos y paginado global centrado. Formularios y confirmación con scroll/acciones táctiles. Eliminación restringida transaccional según22/ADR-024; resultado incierto se revisa sin replay automático. Reglas futuras DESIGN9.6/9.7 reconciliadas.

QA sintético35 combinaciones de secciones y anchos320/390/599/600/768/900/1280; ES oscuro y EN claro, sin overflow, página/búsqueda conservadas, éxito/error/reintento y restricciones de eliminación, borrador persistente tras error. Evidencia en finances-mobile-qa registrado en00; PostgreSQL temporal verifica integridad/carreras sin datos reales. Otras tandas y aceptación física siguen pendientes; no aprobación documental automática.
