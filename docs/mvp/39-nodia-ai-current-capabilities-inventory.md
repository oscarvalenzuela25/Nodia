# NodiaAI inventario de módulos y endpoints actuales

Estado de procedencia AI36-C04:89 módulos locales/46 controladores/217 handlers/336 aliases y866 hashes TS;41 rutas de coordinación y29 migraciones conservadas. Seis ayudantes MCP candidatos, sin nuevos handlers Node o publicación. [Delta C04](../evidence/nodia-ai-ai36-c04-catalog-delta.json); las cifras de etapas anteriores permanecen como snapshots históricos.

Estado de procedencia AI36-C03:87 módulos locales/46 controladores/217 handlers/336 aliases y860 hashes TS;41 rutas de coordinación y29 migraciones conservadas. Un analizador MCP candidato, sin nuevos handlers Node ni publicación. [Delta C03](../evidence/nodia-ai-ai36-c03-catalog-delta.json); cifras de las etapas anteriores conservadas como snapshots históricos.

> Estado: en revisión — inventario estático completo; catálogo40/contratos41 propuestos, integración pendiente
> Fecha: 2026-10-14
> Dependencias: [plan38](38-nodia-ai-research-and-v1-plan.md), [ADR-032](../architecture/decisions/ADR-032-nodia-ai-domain-tools-and-conversation.md), [contrato IA](ai-provider-feature-contract.md), [Finanzas22](22-personal-finance-contracts.md), [Reservas28](28-rental-reservations-contracts.md).
> Datos detallados: [snapshot JSON](nodia-ai-current-endpoints.json).

Actualización AI36-C02 del 2026-10-18: [cuatro preparadores MCP seguros candidatos](82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), con [delta reproducible](../evidence/nodia-ai-ai36-c02-catalog-delta.json). Se reutiliza el módulo/adaptador C01 y los puertos nativos; **86 módulos,46 controladores,217 handlers,336 aliases y854 hashes de fuentes**. Cero rutas, tablas o migraciones nuevas. La publicación permanece en67 lecturas/27 fragmentos. El logout propio declara el requisito basal NodiaAI en MCP sin exigir Ajustes IA; los otros tres preparadores conservan destino y acción nativos. No hay publicación o disponibilidad real por añadir esos metadatos.

Actualización AI36-C01 del 2026-10-18: [contratos y adaptadores candidatos](82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c01--contratos-y-adaptadores-de-preparación-mcp), con [delta reproducible](../evidence/nodia-ai-ai36-c01-catalog-delta.json). Se incorpora un módulo de preparación MCP condicional, sin controlador, rutas, migraciones o tablas nuevas: **86 módulos locales, 46 controladores, 217 handlers, 336 aliases y 854 hashes de fuentes**. Las 41 rutas de coordinación y la cobertura original de 177 handlers permanecen intactas. Los 73 candidatos de preparación reutilizan puertos nativos y conservan publicación pendiente; el inventario de fuentes no acredita activación ni inferencia real.

Actualización AI-07 del 2026-10-15: [módulo/autorización53](53-nodia-ai-ai07-module-authorization.md) añade un módulo Nest sin controlador y una ruta Client protegida para el host NodiaAI, aún sin chat disponible. Se contrastaron las tres adiciones de imports/ruta/catálogo y se reconciliaron sus hashes; el snapshot registra procedencia anterior/nueva y el nuevo módulo: 38 módulos locales y 176 fuentes comprobadas. Se conservan los 177 handlers/296 rutas y los ocho destinos de productos inventariados a continuación. Las cifras 37/175 del método describen la extracción inicial; no se verificaron asignaciones de la BD de uso.

Actualización AI-08 del 2026-10-15: [autoridad54](54-nodia-ai-ai08-transversal-authority.md), firmas actor/sesión/destinatario, DTOs y delegaciones actualizados desde AST. Las 184 fuentes comprobadas incluyen ocho adiciones y35 hashes revisados con procedencia; se conservan 177 handlers/296 rutas/38 módulos. No publica herramientas ni habilita asignaciones.

Actualización AI-09 del 2026-10-15: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) incorpora cuatro módulos internos sin controlador —autorización compartida, conversación, run y runtime—, alcanzables desde AppModule mediante el host NodiaAI. La revisión AST registra **42 módulos locales y 188 fuentes comprobadas**, con imports, líneas y hashes anteriores/nuevos; conserva **34 controladores, 177 handlers y 296 rutas**. No añade endpoints de chat ni publica herramientas MCP. Las estructuras M1 son soporte interno; admisión y consulta HTTP continúan en AI-10.

Actualización AI-10..12 del 2026-10-15: ocho rutas autenticadas de coordinación conversacional se incorporan al snapshot; no son herramientas MCP de negocio. AST actual: **45 módulos locales, 35 controladores, 185 handlers y 304 rutas**, con **264 fuentes comprobadas**. Los 177 handlers originales/296 aliases conservan su semántica y cobertura del catálogo; el coordinador añade creación/listado/detalle/configuración/mensajes/selección y consentimiento revisionado de routing. Contexto/adaptadores y soporte worker quedan trazados por fuentes y módulos, sin atribuir despliegue o inferencia real a la extracción.

Actualización AI-13 del 2026-10-16: [página/drawer59](59-nodia-ai-ai13-chat-page.md), catálogo autorizado y elegibilidad no generativa añaden dos endpoints de coordinación. AST reconciliado: **45 módulos locales,36 controladores,187 handlers,306 rutas y269 fuentes comprobadas**. Diez de28 rutas conversacionales diseñadas están implementadas; las herramientas de negocio conservan su integración pendiente. La ventana reciente de mensajes amplía el contrato existente sin añadir otra ruta.

Actualización AI-14 del 2026-10-16: [registro/gateway60](60-nodia-ai-ai14-capability-registry.md) añade tres rutas GET de capacidades/schemas y dos módulos de composición tipada. Snapshot reconciliado: **47 módulos locales, 37 controladores, 190 handlers, 309 rutas y 286 fuentes comprobadas**; 13/28 rutas de coordinación implementadas. Tres ayudantes comunes implementados como infraestructura local; las familias de negocio reales permanecen vacías. La extracción estática se distingue de 40 comprobaciones HTTP/PostgreSQL desechable; no acredita despliegue ni nuevas inferencias Gemini.

Actualización AI-15 del 2026-10-16: [lecturas61](61-nodia-ai-ai15-product-reads.md) implementa los 67 candidatos de lectura: 59 locales, cinco externos y tres referencias privadas de archivos/exportaciones. Las operaciones externas se ejecutan fuera de transacciones SQL, con preparación y reautorización; los archivos se descargan autenticados mediante `GET /api/v1/nodia-ai/artifacts/:reference`, con semántica de datos actuales al descargar. El extractor distingue los módulos sujetos a publicación: **54 módulos locales —49 de composición estática y 5 condicionales—**, con **38 controladores/191 handlers/310 rutas y 484 fuentes comprobadas**. Las 14 rutas de coordinación implementadas corresponden ahora a un diseño de 29 rutas. Siete bibliotecas compilan 184 definiciones y 134 contratos cerrados. Los hashes y su procedencia se registran en el snapshot JSON y reconciliador AI-15. Una composición condicional, un schema o una extracción AST no habilita herramientas: las 44 fichas y los bindings reales siguen sin publicar. La evidencia SQL, HTTP y worker está en61; este inventario no afirma nuevas inferencias Gemini ni despliegue.

Nodia Server declara **191 operaciones HTTP en 38 controladores registrados**, que producen **310 combinaciones de método y ruta** al expandir aliases. Esto no significa 191 herramientas MCP ni disponibilidad operativa: PUT/PATCH y aliases pueden compartir una capacidad, y las rutas de autenticación/instalación no se convierten en CRUD conversacional.

El inventario recoge el código del checkout, incluidos cambios locales. No se consultó la BD, ejecutó el servidor ni probaron cuentas o inferencias. El estado de un listener desplegado puede diferir de este código. Las capacidades de negocio NodiaAI de las tablas siguen como propuestas de integración. AI-14 implementa el registro/gateway y tres ayudantes técnicos; ningún candidato de negocio queda publicado por este inventario.

## Método y cobertura

Extracción del AST TypeScript con la dependencia instalada del repositorio: prefijo global de main.ts, clases/decoradores de controladores, métodos HTTP, parámetros, DTOs referenciados, llamadas a dependencias y metadata Public/RequireAction. En la extracción original se recorrieron imports locales de módulos desde AppModule para comprobar registro: **37 módulos Nest locales alcanzables**, **34 controladores registrados**, ninguno huérfano, ninguna ruta dinámica sin resolver y ninguna combinación método/ruta duplicada.

La revisión manual contrasta guards, políticas de filtros, contratos de dominio y casos de uso relevantes para permisos, efectos, recuperación y ejemplos del usuario. No se declara una auditoría exhaustiva de todas las reglas de cada servicio. El JSON original guardaba las 296 rutas concretas, líneas, referencias de entrada/dependencias, clasificación propuesta y hashes SHA-256 de 175 archivos fuente de extracción. Es un snapshot; regenerarlo cuando cambien rutas/contratos, no usarlo como catálogo runtime.

Prefijo: `/api/v1`. Una fila de las tablas representa un método de controlador y una ruta válida representativa; `+N` indica aliases adicionales registrados en el JSON. Si se añade un alias, no se duplica el permiso ni se ejecuta otra vez la operación.

La documentación Swagger se configura fuera de producción en `/api/documentation` mediante main.ts; no forma parte del recuento de handlers. APIs privadas del microservicio Gemini y funciones de Redis/R2/Translation no son endpoints HTTP públicos de Nodia Server. TranslationModule está registrado pero no declara controlador propio.

## Decisiones de v1 confirmadas durante el inventario

- Los **7 handlers bulk/import de escritura** quedan para después: crear/actualizar proveedores, productos y logs, más importar proveedores CSV. Es una excepción explícita a la paridad funcional. Las exportaciones de lectura no fueron aplazadas.
- Usuarios distintos de `super_admin` requieren **NodiaAI y módulo de destino asignados**. La asignación se valida al descubrir, ejecutar y recuperar una herramienta, además de sesión/reglas de dominio. `super_admin` conserva la facultad transversal confirmada en38.
- V1 incluirá **filtros, agrupaciones y sumas combinables sobre campos/relaciones permitidos**, no únicamente resúmenes existentes. Ese contrato general aún debe implementarse.
- Mutaciones individuales conservan vista previa editable y confirmación. El borrado solo existe donde el recurso lo admite; no inventar DELETE ni convertir una intención en cancelación/archivado por suposición.
- Entradas con claves, códigos o cookies usan flujos seguros; secretos completos no se entregan al modelo.

## Módulos funcionales y superficie backend

Hay ocho destinos funcionales protegidos por GuardStrict en Client, agrupados aquí por producto. Inicio es otra entrada y detalle de negocio pertenece al mismo producto. Estos destinos proceden del router/catálogo del código; filas de modules y asignaciones reales de BD no fueron consultadas.

| Producto o área | Destinos de Client | Recursos backend |
|---|---|---|
| Ajustes Generales | /settings/users, /settings/roles, /settings/actions, /settings/modules | Usuarios, roles, acciones generales/de negocio, módulos y grupos; business-actions se administra dentro de /settings/actions |
| Ajustes IA | /settings/ai-providers | Conexiones, catálogo, modelos, claves cifradas, eventos, salud y sesiones |
| Negocios | /tools/business y detalle /tools/business/:id | Negocios/colaboradores, proveedores/contactos, productos/logs y facturas/archivos/OCR |
| Finanzas personales | /tools/finances-personal | Movimientos, obligaciones, categorías/grupos y resúmenes |
| Reservas | /tools/reservations | Casas, colaboradores, políticas, reservas, cobros/devoluciones, gastos, bloqueos, preparación, calendario, auditoría/recuperación |
| Sesión/infraestructura | /login, Inicio y infraestructura de navegación | Login/refresh/logout/me, authorization/context, seed y liveness; auxiliares del coordinador |

Fuentes: [router](../../nodia-client/src/routes/index.tsx), [opciones de navegación](../../nodia-client/src/routes/navigationOptions.ts), [AppModule](../../nodia-server/src/app.module.ts), [main.ts](../../nodia-server/src/main.ts).

Correspondencia de recursos al destino para el registro: usuarios→/settings/users; roles→/settings/roles; acciones y business-actions→/settings/actions; módulos y grupos→/settings/modules; conexiones/catálogo/modelos/claves/eventos/sesiones IA→/settings/ai-providers; negocio/proveedores/contactos/productos/logs/facturas→/tools/business; recursos finance→/tools/finances-personal; recursos rental→/tools/reservations. Sesión propia/contexto/seed/liveness tienen tratamiento auxiliar o de infraestructura. La ruta identifica el área del inventario; resolver en backend la identidad estable del módulo y su asignación real, no confiar en una URL aportada por el modelo.

Fuentes adicionales de componentes internos: [servicios de Acciones](../../nodia-client/src/modules/generalSettings/pages/Actions/infrastructure/services.ts), [servicios de Módulos/grupos](../../nodia-client/src/modules/generalSettings/pages/Modules/infrastructure/services.ts). Los grupos/acciones de negocio heredan el destino de esa página, no necesitan un módulo de navegación artificial.

## Recuento por familia

| Familia | Controladores | Operaciones declaradas | Rutas con aliases |
|---|---:|---:|---:|
| Administración de catálogos y usuarios | 6 | 30 | 60 |
| Conexiones IA | 3 | 33 | 82 |
| Negocios | 6 | 40 | 80 |
| Finanzas personales | 5 | 23 | 23 |
| Reservas | 11 | 44 | 44 |
| Infraestructura y sesión | 3 | 7 | 7 |
| NodiaAI — coordinación conversacional | 4 | 14 | 14 |
| Total | 38 | 191 | 310 |

Clasificación de los 177 handlers base —sin las 14 rutas nuevas de coordinación—: A=6, B=7, F=5, I=18, L=64, M=75, O=2. Son modalidades de integración propuestas, no herramientas ya disponibles.

## Clasificación propuesta por operación

| Código | Tratamiento NodiaAI | Aclaración |
|---|---|---|
| L | Consulta candidata | Lectura paginada/acotada; filtros permitidos y proyección pública |
| M | Mutación candidata | Propuesta, confirmación exacta, reglas y recuperación; no equivale a estar lista |
| I | Flujo seguro/interactivo | Autenticación o secreto fuera del modelo; asistido desde la app |
| F | Archivo, OCR o exportación | Ver si lee/escribe, límites, almacenamiento y costos; no asumir ejecución síncrona simple |
| A | Auxiliar del coordinador | Contexto, renovación, observación o recuperación; no nueva intención de negocio |
| B | Escritura por lote excluida de v1 | Decisión expresa del usuario, conservar en inventario |
| O | Infraestructura/instalación | Inventariada; propuesta de no convertir liveness/seed en herramientas de negocio |

L puede usar POST: product-logs/query y cancellation-preview son lecturas. F puede usar GET: CSV/view-url no escriben registros. HTTP por sí solo no determina efectos.

## Operaciones reutilizables y límites por producto

| Área | Qué podrá pedir el usuario al integrar el catálogo | Límite vigente o trabajo previo |
|---|---|---|
| Usuarios | Listar, crear por email, editar datos/actividad y asignar roles/módulos | No GET individual ni DELETE en UserController. Vista previa debe mostrar pérdida de acceso; conservación del último superadministrador requiere pruebas desde reglas reales |
| Roles/acciones/módulos/grupos | Listar, crear, editar y eliminar donde hay DELETE; consultar detalle donde existe | Proteger rol reservado/FKs y explicar efectos sobre asignaciones. PUT/PATCH de varios catálogos comparten caso de uso, no son dos herramientas |
| Conexiones IA | Consultar conexiones/modelos/salud/eventos; crear/editar catálogo/conexiones, seleccionar claves, sincronizar modelos y desconectar sesiones | `ai:manage` vigente o super_admin; modelo/estado dinámicos. Crear/reemplazar secreto y completar login requieren canal seguro. No DELETE de conexión/catálogo |
| Negocios | Listar/ver, crear/editar negocio, administrar colaboradores | Listado/detalle por propietario/colaborador o super_admin; actualización/colaboradores por propietario o super_admin. No DELETE de negocio |
| Proveedores/contactos | Listar/ver, crear/editar proveedor; listar/crear/editar/desactivar contacto; exportar CSV | No DELETE de proveedor/contacto ni GET individual de contacto. Teléfono dentro de contacto; crear requiere request_key y editar version/nombre. Bulk/import después |
| Productos/logs | Listar/ver/crear/editar producto y log; consultar logs por IDs/códigos; exportar productos CSV | No DELETE de producto/log. Cambiar actividad solo donde el contrato lo contiene; logs no tienen is_active en la política pública. Bulk después |
| Facturas | Listar/ver/crear/editar, acceder a archivo, verificar IA y extraer un documento | No DELETE. Crear puede recibir archivo o no. Extraer no guarda factura; observación OCR no es job duradero. Recovery R2 no prueba deduplicación de una intención del chat |
| Finanzas | CRUD de movimientos, obligaciones, categorías/grupos; confirmar/anular/archivar conforme a updates; resúmenes | Propietario actual request.auth.user.id; super_admin transversal nuevo no implementado. Ledger, CLP exacto, deuda/préstamo y DELETE protegidos; deduplicación de intención pendiente |
| Reservas | Crear/editar casa, colaboradores/políticas/bloqueos, reservas, confirmar/iniciar/completar/cancelar, registrar/anular pagos y gastos, preparación y calendario | Sin DELETE en los 11 controladores. Propietario/colaborador vigentes; super_admin transversal pendiente. Idempotency-Key y recuperación existentes; no cambiar autoría |
| Informes combinables | Consultas específicas con filtros, agrupaciones y sumas admitidas, dentro o entre módulos | Contrato nuevo: entidades/campos/relaciones/medidas y semántica de fechas; no generar SQL libre ni atribuir pagos a totales de facturas |

La ausencia de DELETE o GET individual es un hecho del controlador, no una decisión automática de implementar un endpoint nuevo. El chat debe informar la capacidad real; ampliar el dominio requiere definir el efecto e integrar todos sus consumidores.

## Autorización actual y diferencias con NodiaAI

AppModule registra RateLimitGuard → AuthGuard → UserRateLimitGuard → ActionPermissionGuard. AuthGuard autentica todas las rutas excepto Public; cinco handlers tienen esa metadata. Public no significa sin condiciones: seed exige secreto y login/refresh/logout tienen su contrato propio.

ActionPermissionGuard retorna true cuando no hay RequireAction. Solo los controladores IA del inventario declaran `ai:manage`. No deducir un permiso granular por método en las demás rutas ni convertir esa ausencia en autorización anónima. La administración sin permisos por acción es una decisión de producto existente.

La asignación de módulo protege rutas de Client mediante GuardStrict; no aparece como guard global de módulo de destino en este backend. La decisión nueva para NodiaAI requiere una comprobación explícita en el catálogo/coordinador, junto a los controles de los casos de uso. No copiar un JWT, user_id o rol enviado por el modelo como identidad.

En Finanzas, los controladores derivan el usuario de request.auth.user.id y los casos de uso filtran propiedad. En Reservas, RentalTransactionService.context comprueba propietario/colaborador y ownerOnly bajo locks; no consulta rol super_admin para ese bypass. La ampliación administrativa de38/22/28 aún debe desarrollarse. Herramientas propias pueden reutilizar el contrato actual; herramientas transversales no quedan desbloqueadas por haber escrito la decisión.

Las llamadas internas no atraviesan automáticamente guards/ValidationPipe HTTP. El adaptador debe validar el comando final y aplicar autenticación, módulo y RequireAction antes de invocar casos de uso. Cuatro lecturas de catálogos delegan directamente a Service (actions, business-actions, modules y roles); AppService corresponde a infraestructura. Adaptar esas lecturas a un caso de uso/política comprobable, sin inventar CRUD genérico.

### Invariantes administrativas pendientes de comprobar y completar

Las reglas de producto exigen claves inmutables y al menos un superadministrador activo. En el camino revisado de UserService.update se guarda el usuario y luego se eliminan/recrean roles/módulos sin una transacción que abarque el conjunto ni una comprobación explícita del último superadministrador. UpdateUserUseCase solo delega. No se probó el efecto en BD; la garantía no está demostrada por este código y debe cerrarse antes de habilitar esa mutación en NodiaAI.

UpdateModuleDto hereda parcialmente CreateModuleDto, incluido key; ModuleService.update aplica rest mediante Object.assign y save sin una protección explícita de la clave en ese camino. RoleService sí protege el cambio de la clave super_admin y DeleteRoleUseCase protege el borrado de ese rol; eso no demuestra la garantía de conservar uno activo ante cambios de usuario/rol. Verificar de forma compartida todos los escritores, con pruebas de concurrencia y asociaciones, no ocultar controles faltantes en un prompt del chat.

Fuentes: [UserService.update](../../nodia-server/src/user/user.service.ts#L252), [UpdateUserUseCase](../../nodia-server/src/user/use-case/update-user.use-case.ts), [UpdateModuleDto](../../nodia-server/src/module/dto/update-module.dto.ts), [ModuleService](../../nodia-server/src/module/module.service.ts), [RoleService](../../nodia-server/src/role/role.service.ts), [DeleteRoleUseCase](../../nodia-server/src/role/use-case/delete-role.use-case.ts). Hallazgos de fuente y pendientes de verificación, sin cambios de código ni datos.

Fuentes: [guards globales](../../nodia-server/src/app.module.ts), [AuthGuard](../../nodia-server/src/auth/auth.guard.ts), [ActionPermissionGuard](../../nodia-server/src/authorization/action-permission.guard.ts), [permiso IA](../../nodia-server/src/authorization/use-case/check-action-permission.use-case.ts), [transacción/acceso Reservas](../../nodia-server/src/rental-common/rental-transaction.service.ts), [controlador Finanzas](../../nodia-server/src/finance-movement/finance-movement.controller.ts).

## Filtros e informes

Los listados generales usan DTOs y RANSACK_POLICIES con campos explícitos: usuarios name/email, catálogos key, negocio name/owner, proveedores negocio/name/tax, productos negocio/proveedor/código/precios/stock, logs producto/código/precios, facturas negocio/proveedor/código/total/fechas y columnas declaradas de IA. No habilitar todas las columnas ORM por reflexión.

PaginationQueryDto admite page/limit/size/all/includes sin máximo global de limit en su DTO. NodiaAI necesita admisión acotada y no traducir «todo» a all=true automáticamente. Revisar también límites efectivos de cada servicio; el DTO solo no demuestra una consulta ilimitada ejecutada.

Finanzas tiene active=active|inactive|all, page/limit (máximo100), categoría/grupo/obligación y q; overview y sus resúmenes por categoría/grupo reutilizan filtros. Fechas corresponden a created_at, no a una fecha de pago que no existe.

Reservas dispone de DTOs propios por listado, calendario from_on/to_on y disponibilidad con fechas y horas de entrada/salida. Propiedad y preparación afectan la interpretación; no deducir cupo solo de ausencia de una fila.

No se encontró controlador de informes generales ni endpoint de total mensual de facturas por proveedor en este inventario. Hay resúmenes específicos de Finanzas y Reservas. El contrato nuevo debe definir filtros/relaciones/agregados admitidos, composición entre módulos, precisión, rangos de fecha y consultas por conjuntos; registrar versión y evidencia.

Ejemplo: «total de compras del proveedor X en octubre» requiere resolver proveedor/negocio, preguntar criterio si es dudoso y sumar facturas una sola vez. Invoice solo declara total_amount y created_at, sin columnas de pago ni fecha de emisión; no llamar a ese resultado dinero pagado ni sumar una página como si fuese el universo.

Fuentes: [políticas públicas](../../nodia-server/src/common/utils/ransack-query.policies.ts), [paginación](../../nodia-server/src/common/dto/pagination-query.dto.ts), [filtros Finanzas](../../nodia-server/src/finance-common/dto/finance-query.dto.ts), [calendario/disponibilidad](../../nodia-server/src/rental-calendar/dto/rental-calendar.dto.ts), [Invoice](../../nodia-server/src/invoice/entities/invoice.entity.ts).

## Campos mínimos y datos que no debe preguntar al usuario

Los DTOs enlazados en cada fila son la referencia de entrada; se inventarió el tipo declarado, no se generó un esquema MCP ejecutable ni se verificó completamente cada validador/herencia. Antes de implementar herramientas, derivar esquemas estrictos y contrastar validación final/condicional con casos de uso. No inferir obligatoriedad únicamente por el signo ? de TypeScript.

| Ejemplo | Entrada mínima comprobada | Valores del coordinador/servidor |
|---|---|---|
| Usuario nuevo | email válido | IDs/timestamps; roles y módulos solo si se solicitan |
| Negocio nuevo | name | owner desde actor autorizado; descripción/traducciones opcionales |
| Proveedor nuevo | business_id y name | ID y valores por defecto propios del contrato |
| Producto nuevo | business_id, code, name, cost_price, cost_price_tax, profit_percentage, sale_price | No deducir precios/márgenes faltantes; stock/proveedor según opcionalidad real |
| Contacto nuevo | providerId de ruta, name y request_key | UUID de intención generado por coordinador; teléfonos/email/horario opcionales |
| Editar contacto | providerId/id, name y version | Leer la versión real y conservar valores necesarios del update; no preguntarle al usuario un número de versión |
| Movimiento | name, amount, type, status, category_id | Usuario desde contexto; obligación solo si aplica y cumple reglas |
| Reserva | Casa, huésped/contacto, cantidad, canal, fechas/horarios, tarifa y abono requeridos | Actor, Idempotency-Key y timestamps; omitir opcionales válidos |
| Disponibilidad | Casa y fechas/horarios | Si faltan horarios, aclarar; fecha sola no representa todo el contrato |

No usar DTOs legacy como única prueba de rechazo estricto: CreateInvoiceDto transforma ciertos totales inválidos a0 y JSON inválido a{}; Provider.fields es objeto genérico. Revisar esas fronteras antes de habilitar generación de comandos por modelo, preservando ceros reales y errores de entrada. Un DTO importado no valida una llamada directa a execute.

Fuentes: [usuario](../../nodia-server/src/user/dto/create-user.dto.ts), [producto](../../nodia-server/src/product/dto/create-product.dto.ts), [contactos](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts), [factura](../../nodia-server/src/invoice/dto/create-invoice.dto.ts), [reserva](../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts).

## Recuperación de escrituras

| Área | Hecho actual | Trabajo requerido para NodiaAI |
|---|---|---|
| Reservas | Idempotency-Key, locks, auditoría y respuesta persistida con efecto; GET operations/:requestKey | Conservar actor/casa/intención/payload y aplicar autoridad transversal nueva sin simular propietario |
| Contactos | Creación request_key/hash; update con version | Reutilizar creación y conflictos; definir respuesta perdida al editar sin sobrescribir ni duplicar |
| Factura con archivo | Intento duradero de upload y compensación/reconciliación R2 | Separar recuperación de archivo de idempotencia de mensaje/confirmación; no repetir OCR ni INSERT por timeout |
| Finanzas y demás CRUD | Hay reglas/transacciones específicas; no consta protocolo uniforme de deduplicación/recovery por intención en las rutas | Inventariar por caso de uso, introducir garantías faltantes antes de ejecución en background; no afirmar exactamente una vez |
| Sesiones/OCR | Rutas de login/observación y cancelación propias | Mantenerlas separadas de ejecuciones persistidas del chat; logout/shared session afecta otros consumidores |

Una vista previa no demuestra que una escritura sea idempotente. Persistir intención y resultado después de un commit independiente no elimina la ventana de duplicación. No mantener transacciones abiertas esperando al modelo o al usuario.

Fuentes: [Reservas](../../nodia-server/src/rental-common/rental-transaction.service.ts), [creación contacto](../../nodia-server/src/provider-contact/use-case/create-provider-contact.use-case.ts), [factura/upload](../../nodia-server/src/invoice/use-case/create-invoice.use-case.ts).

## Pendientes concretos de la v1

| ID | Pendiente | Criterio para cerrarlo |
|---|---|---|
| NI-01 | Registro versionado de capacidades | Cada operación/familia tiene descripción, esquema, permisos, efectos, respuesta y correspondencia backend; aliases/PUT-PATCH no duplican intención |
| NI-02 | Autoridad del catálogo | NodiaAI + módulo de destino para ordinarios; revalidar al ejecutar/recuperar. Definir destino de recursos sin página propia y verificar revocación |
| NI-03 | Superadministrador transversal | Actor y destinatario separados en Finanzas/Reservas, contratos/DTOs/queries/capacidades/cache y pruebas alineados |
| NI-04 | Confirmación | ID/versión/hash exactos de propuesta, impacto de DELETE/asignaciones, correcciones invalidan confirmación anterior |
| NI-05 | Idempotencia/recovery | Garantías por mutación, respuesta perdida/reinicio/concurrencia y estado persistido, sin reenvío ciego |
| NI-06 | Informe estructurado nuevo | Entidades públicas, relaciones/medidas/períodos, agrupación/suma exacta y límites; regresiones de joins y permisos |
| NI-07 | Validación del comando final | Esquema runtime por operación, DTOs/herencia/reglas condicionales y saneamiento de respuestas; revisar coerciones legacy |
| NI-08 | Trabajos y límites | Seguir tras salir, recuperar estado, cancellation/deadline/admisión, concurrencia compartida con OCR/login |
| NI-09 | Archivos/voz y flujos seguros | Ownership, retención, límites, transcripción/interpretación revisable y cero secretos en modelo/historial/logs |
| NI-10 | Viabilidad Gemini por modo | Herramientas, continuidad/cambio de modelo, aislamiento y multimodal comprobados en API/Web/Agentic por separado |
| NI-11 | Metadatos de módulos y evolución | Integrar módulo nuevo sin cambiar el núcleo; catálogo/cache versionados y documentación funcional opcional vigente |
| NI-12 | Pruebas de paridad y UI | Casos de uso/BD aislada, navegación/caché/ES-EN y visualización de efecto real; runtime y aceptación productiva separados |
| NI-13 | Invariantes de escrituras administrativas | Último superadministrador, asociaciones atómicas y claves inmutables ejecutadas en reglas compartidas/DB con regresiones y concurrencia; no publicar mutación cuya garantía falta |

B de tablas queda excluido de v1 por confirmación del usuario. No quedan pendientes esas tres decisiones de bulk/módulo/informes; sí su implementación y contratos. Retención de chats/adjuntos, límites numéricos y orden de entregas continúan en38.

## Inventario completo por controlador

B = body; Q = query; P = DTO de path; H = header generado/validado. Tipos simples de params figuran en JSON. Las llamadas de destino reflejan el controlador; si el caso de uso delega a un servicio, sus reglas requieren revisión adicional antes de publicar la herramienta.

### Administración de catálogos y usuarios

#### Acciones generales

Fuente: [ActionController](../../nodia-server/src/action/action.controller.ts#L23). 6 operaciones; prefijos `/api/v1/action`, `/api/v1/actions`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/action](../../nodia-server/src/action/action.controller.ts#L36) (+1) | B: [CreateActionDto](../../nodia-server/src/action/dto/create-action.dto.ts) | [CreateActionUseCase.execute](../../nodia-server/src/action/use-case/create-action.use-case.ts) | M |
| [GET /api/v1/action](../../nodia-server/src/action/action.controller.ts#L47) (+1) | Q: [GetActionsDto](../../nodia-server/src/action/dto/get-actions.dto.ts) | [GetAllActionsUseCase.execute](../../nodia-server/src/action/use-case/get-all-actions.use-case.ts) | L |
| [GET /api/v1/action/:id](../../nodia-server/src/action/action.controller.ts#L52) (+1) | Sin Body/Query DTO declarado | [ActionService.findOne](../../nodia-server/src/action/action.service.ts) | L |
| [PUT /api/v1/action/:id](../../nodia-server/src/action/action.controller.ts#L57) (+1) | B: [UpdateActionDto](../../nodia-server/src/action/dto/update-action.dto.ts) | [UpdateActionUseCase.execute](../../nodia-server/src/action/use-case/update-action.use-case.ts) | M |
| [PATCH /api/v1/action/:id](../../nodia-server/src/action/action.controller.ts#L70) (+1) | B: [UpdateActionDto](../../nodia-server/src/action/dto/update-action.dto.ts) | [UpdateActionUseCase.execute](../../nodia-server/src/action/use-case/update-action.use-case.ts) | M |
| [DELETE /api/v1/action/:id](../../nodia-server/src/action/action.controller.ts#L83) (+1) | P: [ActionIdDto](../../nodia-server/src/action/dto/action-id.dto.ts) | [DeleteActionUseCase.execute](../../nodia-server/src/action/use-case/delete-action.use-case.ts) | M |

#### Acciones de negocio

Fuente: [BusinessActionController](../../nodia-server/src/business-action/business-action.controller.ts#L11). 5 operaciones; prefijos `/api/v1/business-action`, `/api/v1/business-actions`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/business-action](../../nodia-server/src/business-action/business-action.controller.ts#L21) (+1) | B: [CreateBusinessActionDto](../../nodia-server/src/business-action/dto/create-business-action.dto.ts) | [CreateBusinessActionUseCase.execute](../../nodia-server/src/business-action/use-case/create-business-action.use-case.ts) | M |
| [GET /api/v1/business-action](../../nodia-server/src/business-action/business-action.controller.ts#L26) (+1) | Q: [GetBusinessActionsDto](../../nodia-server/src/business-action/dto/get-business-actions.dto.ts) | [GetAllBusinessActionsUseCase.execute](../../nodia-server/src/business-action/use-case/get-all-business-actions.use-case.ts) | L |
| [GET /api/v1/business-action/:id](../../nodia-server/src/business-action/business-action.controller.ts#L31) (+1) | Sin Body/Query DTO declarado | [BusinessActionService.findOne](../../nodia-server/src/business-action/business-action.service.ts) | L |
| [PUT /api/v1/business-action/:id](../../nodia-server/src/business-action/business-action.controller.ts#L36) (+1) | B: [UpdateBusinessActionDto](../../nodia-server/src/business-action/dto/update-business-action.dto.ts) | [UpdateBusinessActionUseCase.execute](../../nodia-server/src/business-action/use-case/update-business-action.use-case.ts) | M |
| [DELETE /api/v1/business-action/:id](../../nodia-server/src/business-action/business-action.controller.ts#L44) (+1) | Sin Body/Query DTO declarado | [DeleteBusinessActionUseCase.execute](../../nodia-server/src/business-action/use-case/delete-business-action.use-case.ts) | M |

#### Grupos de módulos

Fuente: [ModuleGroupController](../../nodia-server/src/module-group/module-group.controller.ts#L22). 4 operaciones; prefijos `/api/v1/module-group`, `/api/v1/module-groups`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/module-group](../../nodia-server/src/module-group/module-group.controller.ts#L34) (+1) | B: [CreateModuleGroupDto](../../nodia-server/src/module-group/dto/create-module-group.dto.ts) | [CreateModuleGroupUseCase.execute](../../nodia-server/src/module-group/use-case/create-module-group.use-case.ts) | M |
| [GET /api/v1/module-group](../../nodia-server/src/module-group/module-group.controller.ts#L45) (+1) | Q: [GetModuleGroupsDto](../../nodia-server/src/module-group/dto/get-module-groups.dto.ts) | [GetAllModuleGroupsUseCase.execute](../../nodia-server/src/module-group/use-case/get-all-module-groups.use-case.ts) | L |
| [PUT /api/v1/module-group/:id](../../nodia-server/src/module-group/module-group.controller.ts#L50) (+1) | B: [UpdateModuleGroupDto](../../nodia-server/src/module-group/dto/update-module-group.dto.ts) | [UpdateModuleGroupUseCase.execute](../../nodia-server/src/module-group/use-case/update-module-group.use-case.ts) | M |
| [DELETE /api/v1/module-group/:id](../../nodia-server/src/module-group/module-group.controller.ts#L63) (+1) | P: [CatalogIdDto](../../nodia-server/src/common/dto/catalog-id.dto.ts) | [DeleteModuleGroupUseCase.execute](../../nodia-server/src/module-group/use-case/delete-module-group.use-case.ts) | M |

#### Módulos

Fuente: [ModuleController](../../nodia-server/src/module/module.controller.ts#L24). 6 operaciones; prefijos `/api/v1/module`, `/api/v1/modules`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/module](../../nodia-server/src/module/module.controller.ts#L37) (+1) | B: [CreateModuleDto](../../nodia-server/src/module/dto/create-module.dto.ts) | [CreateModuleUseCase.execute](../../nodia-server/src/module/use-case/create-module.use-case.ts) | M |
| [GET /api/v1/module](../../nodia-server/src/module/module.controller.ts#L48) (+1) | Q: [GetModulesDto](../../nodia-server/src/module/dto/get-modules.dto.ts) | [GetAllModulesUseCase.execute](../../nodia-server/src/module/use-case/get-all-modules.use-case.ts) | L |
| [GET /api/v1/module/:id](../../nodia-server/src/module/module.controller.ts#L53) (+1) | Sin Body/Query DTO declarado | [ModuleService.findOne](../../nodia-server/src/module/module.service.ts) | L |
| [PUT /api/v1/module/:id](../../nodia-server/src/module/module.controller.ts#L58) (+1) | B: [UpdateModuleDto](../../nodia-server/src/module/dto/update-module.dto.ts) | [UpdateModuleUseCase.execute](../../nodia-server/src/module/use-case/update-module.use-case.ts) | M |
| [PATCH /api/v1/module/:id](../../nodia-server/src/module/module.controller.ts#L71) (+1) | B: [UpdateModuleDto](../../nodia-server/src/module/dto/update-module.dto.ts) | [UpdateModuleUseCase.execute](../../nodia-server/src/module/use-case/update-module.use-case.ts) | M |
| [DELETE /api/v1/module/:id](../../nodia-server/src/module/module.controller.ts#L84) (+1) | P: [CatalogIdDto](../../nodia-server/src/common/dto/catalog-id.dto.ts) | [DeleteModuleUseCase.execute](../../nodia-server/src/module/use-case/delete-module.use-case.ts) | M |

#### Roles

Fuente: [RoleController](../../nodia-server/src/role/role.controller.ts#L23). 6 operaciones; prefijos `/api/v1/role`, `/api/v1/roles`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/role](../../nodia-server/src/role/role.controller.ts#L36) (+1) | B: [CreateRoleDto](../../nodia-server/src/role/dto/create-role.dto.ts) | [CreateRoleUseCase.execute](../../nodia-server/src/role/use-case/create-role.use-case.ts) | M |
| [GET /api/v1/role](../../nodia-server/src/role/role.controller.ts#L44) (+1) | Q: [GetRolesDto](../../nodia-server/src/role/dto/get-roles.dto.ts) | [GetAllRolesUseCase.execute](../../nodia-server/src/role/use-case/get-all-roles.use-case.ts) | L |
| [GET /api/v1/role/:id](../../nodia-server/src/role/role.controller.ts#L49) (+1) | Sin Body/Query DTO declarado | [RoleService.findOne](../../nodia-server/src/role/role.service.ts) | L |
| [PUT /api/v1/role/:id](../../nodia-server/src/role/role.controller.ts#L54) (+1) | B: [UpdateRoleDto](../../nodia-server/src/role/dto/update-role.dto.ts) | [UpdateRoleUseCase.execute](../../nodia-server/src/role/use-case/update-role.use-case.ts) | M |
| [PATCH /api/v1/role/:id](../../nodia-server/src/role/role.controller.ts#L67) (+1) | B: [UpdateRoleDto](../../nodia-server/src/role/dto/update-role.dto.ts) | [UpdateRoleUseCase.execute](../../nodia-server/src/role/use-case/update-role.use-case.ts) | M |
| [DELETE /api/v1/role/:id](../../nodia-server/src/role/role.controller.ts#L80) (+1) | P: [RoleIdDto](../../nodia-server/src/role/dto/role-id.dto.ts) | [DeleteRoleUseCase.execute](../../nodia-server/src/role/use-case/delete-role.use-case.ts) | M |

#### Usuarios

Fuente: [UserController](../../nodia-server/src/user/user.controller.ts#L9). 3 operaciones; prefijos `/api/v1/user`, `/api/v1/users`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/user](../../nodia-server/src/user/user.controller.ts#L20) (+1) | Q: [GetUsersDto](../../nodia-server/src/user/dto/get-users.dto.ts) | [GetAllUsersUseCase.execute](../../nodia-server/src/user/use-case/get-all-users.use-case.ts) | L |
| [POST /api/v1/user](../../nodia-server/src/user/user.controller.ts#L25) (+1) | B: [CreateUserDto](../../nodia-server/src/user/dto/create-user.dto.ts) | [CreateUserUseCase.execute](../../nodia-server/src/user/use-case/create-user.use-case.ts) | M |
| [PUT /api/v1/user/:id](../../nodia-server/src/user/user.controller.ts#L33) (+1) | B: [UpdateUserDto](../../nodia-server/src/user/dto/update-user.dto.ts) | [UpdateUserUseCase.execute](../../nodia-server/src/user/use-case/update-user.use-case.ts) | M |

### Conexiones IA

#### Claves API

Fuente: [AiApiKeyController](../../nodia-server/src/ai-provider/ai-api-key.controller.ts#L20). 4 operaciones; prefijos `/api/v1/ai-api-key`, `/api/v1/ai-api-keys`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/ai-api-key](../../nodia-server/src/ai-provider/ai-api-key.controller.ts#L30) (+1) | Q: [GetAiApiKeysDto](../../nodia-server/src/ai-provider/dto/get-ai-api-keys.dto.ts) | [GetAllAiApiKeysUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-all-ai-api-keys.use-case.ts) | L — Solo proyección pública/máscaras |
| [POST /api/v1/ai-api-key](../../nodia-server/src/ai-provider/ai-api-key.controller.ts#L35) (+1) | B: [CreateAiApiKeyDto](../../nodia-server/src/ai-provider/dto/create-ai-api-key.dto.ts) | [CreateAiApiKeyUseCase.execute](../../nodia-server/src/ai-provider/use-case/create-ai-api-key.use-case.ts) | I — Entrada de secreto en formulario seguro; metadata/configuración pública puede asistirse |
| [PUT /api/v1/ai-api-key/:id](../../nodia-server/src/ai-provider/ai-api-key.controller.ts#L40) (+1) | B: [UpdateAiApiKeyDto](../../nodia-server/src/ai-provider/dto/update-ai-api-key.dto.ts) | [UpdateAiApiKeyUseCase.execute](../../nodia-server/src/ai-provider/use-case/update-ai-api-key.use-case.ts) | I — Entrada de secreto en formulario seguro; metadata/configuración pública puede asistirse |
| [DELETE /api/v1/ai-api-key/:id](../../nodia-server/src/ai-provider/ai-api-key.controller.ts#L45) (+1) | Sin Body/Query DTO declarado | [DeleteAiApiKeyUseCase.execute](../../nodia-server/src/ai-provider/use-case/delete-ai-api-key.use-case.ts) | M |

#### Eventos IA

Fuente: [AiProviderEventController](../../nodia-server/src/ai-provider/ai-provider-event.controller.ts#L6). 1 operaciones; prefijos `/api/v1/ai-provider-event`, `/api/v1/ai-provider-events`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/ai-provider-event](../../nodia-server/src/ai-provider/ai-provider-event.controller.ts#L13) (+1) | Q: [GetAiProviderEventsDto](../../nodia-server/src/ai-provider/dto/get-ai-provider-events.dto.ts) | [GetAllAiProviderEventsUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-all-ai-provider-events.use-case.ts) | L |

#### Catálogo, conexiones, modelos y sesiones IA

Fuente: [AiProviderController](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L29). 28 operaciones; prefijos `/api/v1/ai-provider`, `/api/v1/ai-providers`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/ai-provider/:id/session](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L49) (+1) | Q: [CodexSessionDto](../../nodia-server/src/ai-provider/dto/codex-session.dto.ts) | [ManageCodexSessionUseCase.session](../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts) | L |
| [POST /api/v1/ai-provider/:id/session/login](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L55) (+1) | B: [CodexSessionDto](../../nodia-server/src/ai-provider/dto/codex-session.dto.ts) | [ManageCodexSessionUseCase.start](../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/:id/session/login/current](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L61) (+1) | Sin Body/Query DTO declarado | [ManageCodexSessionUseCase.current](../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/:id/session/login/:jobId](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L67) (+1) | Sin Body/Query DTO declarado | [ManageCodexSessionUseCase.status](../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [POST /api/v1/ai-provider/:id/session/login/:jobId/cancel](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L73) (+1) | Sin Body/Query DTO declarado | [ManageCodexSessionUseCase.cancel](../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [POST /api/v1/ai-provider/:id/session/logout](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L79) (+1) | B: [CodexSessionDto](../../nodia-server/src/ai-provider/dto/codex-session.dto.ts) | [ManageCodexSessionUseCase.logout](../../nodia-server/src/ai-provider/use-case/manage-codex-session.use-case.ts) | M — Afecta sesión compartida del servidor; alcance visible y confirmación |
| [GET /api/v1/ai-provider/gemini-engines](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L85) (+3) | Sin Body/Query DTO declarado | [GetGeminiEnginesUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-gemini-engines.use-case.ts) | L |
| [POST /api/v1/ai-provider/gemini-login/start](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L90) (+1) | Sin Body/Query DTO declarado | [ManageGeminiLoginUseCase.start](../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [POST /api/v1/ai-provider/gemini-session/logout](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L96) (+1) | Sin Body/Query DTO declarado | [ManageGeminiLoginUseCase.disconnect](../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts) | M — Afecta sesión compartida del servidor; alcance visible y confirmación |
| [POST /api/v1/ai-provider/gemini-agentic-login/start](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L102) (+1) | Sin Body/Query DTO declarado | [ManageGeminiAgenticLoginUseCase.start](../../nodia-server/src/ai-provider/use-case/manage-gemini-agentic-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/gemini-agentic-login/current](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L108) (+1) | Sin Body/Query DTO declarado | [ManageGeminiAgenticLoginUseCase.current](../../nodia-server/src/ai-provider/use-case/manage-gemini-agentic-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/gemini-agentic-login/:jobId](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L114) (+1) | Sin Body/Query DTO declarado | [ManageGeminiAgenticLoginUseCase.status](../../nodia-server/src/ai-provider/use-case/manage-gemini-agentic-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [POST /api/v1/ai-provider/gemini-agentic-login/:jobId/code](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L120) (+1) | B: [SubmitGeminiAgenticCodeDto](../../nodia-server/src/ai-provider/dto/submit-gemini-agentic-code.dto.ts) | [ManageGeminiAgenticLoginUseCase.submit](../../nodia-server/src/ai-provider/use-case/manage-gemini-agentic-login.use-case.ts) | I — Código OAuth mediante flujo seguro; no entregar al modelo |
| [POST /api/v1/ai-provider/gemini-agentic-login/:jobId/cancel](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L127) (+1) | Sin Body/Query DTO declarado | [ManageGeminiAgenticLoginUseCase.cancel](../../nodia-server/src/ai-provider/use-case/manage-gemini-agentic-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/gemini-login/:jobId](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L133) (+1) | Sin Body/Query DTO declarado | [ManageGeminiLoginUseCase.status](../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [POST /api/v1/ai-provider/gemini-login/:jobId/cancel](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L139) (+1) | Sin Body/Query DTO declarado | [ManageGeminiLoginUseCase.cancel](../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/gemini-login/:jobId/frame](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L145) (+1) | Sin Body/Query DTO declarado | [ManageGeminiLoginUseCase.frame](../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [POST /api/v1/ai-provider/gemini-login/:jobId/input](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L151) (+1) | B: [GeminiLoginInputDto](../../nodia-server/src/ai-provider/dto/gemini-login-input.dto.ts) | [ManageGeminiLoginUseCase.input](../../nodia-server/src/ai-provider/use-case/manage-gemini-login.use-case.ts) | I — Trabajo de autenticación con actor, TTL y entradas/código/frame privados |
| [GET /api/v1/ai-provider/catalog](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L157) (+3) | Sin Body/Query DTO declarado | [GetAiProviderCatalogUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-ai-provider-catalog.use-case.ts) | L |
| [POST /api/v1/ai-provider/catalog](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L162) (+3) | B: [CreateAiProviderCatalogDto](../../nodia-server/src/ai-provider/dto/create-ai-provider-catalog.dto.ts) | [CreateAiProviderCatalogUseCase.execute](../../nodia-server/src/ai-provider/use-case/create-ai-provider-catalog.use-case.ts) | M |
| [PUT /api/v1/ai-provider/catalog/:id](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L167) (+3) | B: [UpdateAiProviderCatalogDto](../../nodia-server/src/ai-provider/dto/update-ai-provider-catalog.dto.ts) | [UpdateAiProviderCatalogUseCase.execute](../../nodia-server/src/ai-provider/use-case/update-ai-provider-catalog.use-case.ts) | M |
| [GET /api/v1/ai-provider/supported](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L175) (+3) | Sin Body/Query DTO declarado | [GetSupportedAiProvidersUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-supported-ai-providers.use-case.ts) | L |
| [GET /api/v1/ai-provider/health](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L180) (+5) | Sin Body/Query DTO declarado | [GetAiProvidersHealthUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-ai-providers-health.use-case.ts) | L |
| [GET /api/v1/ai-provider/models](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L185) (+3) | Q: [GetSelectableModelsDto](../../nodia-server/src/ai-provider/dto/get-selectable-models.dto.ts) | [GetSelectableModelsUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-selectable-models.use-case.ts) | L |
| [GET /api/v1/ai-provider](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L190) (+1) | Q: [GetAiProvidersDto](../../nodia-server/src/ai-provider/dto/get-ai-providers.dto.ts) | [GetAllAiProvidersUseCase.execute](../../nodia-server/src/ai-provider/use-case/get-all-ai-providers.use-case.ts) | L |
| [POST /api/v1/ai-provider](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L195) (+1) | B: [CreateAiProviderDto](../../nodia-server/src/ai-provider/dto/create-ai-provider.dto.ts) | [CreateAiProviderUseCase.execute](../../nodia-server/src/ai-provider/use-case/create-ai-provider.use-case.ts) | M |
| [POST /api/v1/ai-provider/:id/sync-models](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L200) (+1) | Q: `string`; Q: `string`; Q: [GeminiExecutionEngine](../../nodia-server/src/common/ai/ai.types.ts) | [SyncAiProviderModelsUseCase.execute](../../nodia-server/src/ai-provider/use-case/sync-ai-provider-models.use-case.ts) | M |
| [PUT /api/v1/ai-provider/:id](../../nodia-server/src/ai-provider/ai-provider.controller.ts#L215) (+1) | B: [UpdateAiProviderDto](../../nodia-server/src/ai-provider/dto/update-ai-provider.dto.ts) | [UpdateAiProviderUseCase.execute](../../nodia-server/src/ai-provider/use-case/update-ai-provider.use-case.ts) | M |

### Negocios

#### Negocios y colaboradores

Fuente: [BusinessController](../../nodia-server/src/business/business.controller.ts#L23). 5 operaciones; prefijos `/api/v1/business`, `/api/v1/businesses`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/business](../../nodia-server/src/business/business.controller.ts#L34) (+1) | Q: [GetBusinessesDto](../../nodia-server/src/business/dto/get-businesses.dto.ts) | [GetMyBusinessesUseCase.execute](../../nodia-server/src/business/use-case/get-my-businesses.use-case.ts) | L |
| [GET /api/v1/business/:id](../../nodia-server/src/business/business.controller.ts#L42) (+1) | Sin Body/Query DTO declarado | [GetBusinessByIdUseCase.execute](../../nodia-server/src/business/use-case/get-business-by-id.use-case.ts) | L |
| [POST /api/v1/business](../../nodia-server/src/business/business.controller.ts#L50) (+1) | B: [CreateBusinessDto](../../nodia-server/src/business/dto/create-business.dto.ts) | [CreateBusinessUseCase.execute](../../nodia-server/src/business/use-case/create-business.use-case.ts) | M |
| [PUT /api/v1/business/:id](../../nodia-server/src/business/business.controller.ts#L58) (+1) | B: [UpdateBusinessDto](../../nodia-server/src/business/dto/update-business.dto.ts) | [UpdateBusinessUseCase.execute](../../nodia-server/src/business/use-case/update-business.use-case.ts) | M |
| [PUT /api/v1/business/:id/collaborators](../../nodia-server/src/business/business.controller.ts#L67) (+1) | B: [AssignCollaboratorsDto](../../nodia-server/src/business/dto/assign-collaborators.dto.ts) | [AssignBusinessCollaboratorsUseCase.execute](../../nodia-server/src/business/use-case/assign-business-collaborators.use-case.ts) | M |

#### Facturas, archivo y análisis

Fuente: [InvoiceController](../../nodia-server/src/invoice/invoice.controller.ts#L31). 9 operaciones; prefijos `/api/v1/invoice`, `/api/v1/invoices`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/invoice](../../nodia-server/src/invoice/invoice.controller.ts#L44) (+1) | Q: [GetInvoicesDto](../../nodia-server/src/invoice/dto/get-invoices.dto.ts) | [GetAllInvoicesUseCase.execute](../../nodia-server/src/invoice/use-case/get-all-invoices.use-case.ts) | L |
| [GET /api/v1/invoice/verify-ia-providers](../../nodia-server/src/invoice/invoice.controller.ts#L49) (+3) | Sin Body/Query DTO declarado | [VerifyIaProvidersUseCase.execute](../../nodia-server/src/invoice/use-case/verify-ia-providers.use-case.ts) | L |
| [GET /api/v1/invoice/:id/view-url](../../nodia-server/src/invoice/invoice.controller.ts#L54) (+1) | Sin Body/Query DTO declarado | [GetInvoiceViewUrlUseCase.execute](../../nodia-server/src/invoice/use-case/get-invoice-view-url.use-case.ts) | F — Acceso al archivo mediante URL autorizada, sin path genérico |
| [POST /api/v1/invoice/analysis-observations](../../nodia-server/src/invoice/invoice.controller.ts#L59) (+1) | B: [ReserveAnalysisObservationDto](../../nodia-server/src/invoice/dto/reserve-analysis-observation.dto.ts) | [AnalysisObservationsUseCase.reserve](../../nodia-server/src/invoice/use-case/analysis-observations.use-case.ts) | A — Observación efímera OCR; no usar como job duradero del chat |
| [GET /api/v1/invoice/analysis-observations/:id](../../nodia-server/src/invoice/invoice.controller.ts#L65) (+1) | Q: `string \| undefined` | [AnalysisObservationsUseCase.read](../../nodia-server/src/invoice/use-case/analysis-observations.use-case.ts) | A — Observación efímera OCR; no usar como job duradero del chat |
| [GET /api/v1/invoice/:id](../../nodia-server/src/invoice/invoice.controller.ts#L71) (+1) | Sin Body/Query DTO declarado | [GetInvoiceByIdUseCase.execute](../../nodia-server/src/invoice/use-case/get-invoice-by-id.use-case.ts) | L |
| [POST /api/v1/invoice/analyze](../../nodia-server/src/invoice/invoice.controller.ts#L76) (+1) | Archivo: `Express.Multer.File`; B: [AnalyzeInvoiceDto](../../nodia-server/src/invoice/dto/analyze-invoice.dto.ts); Q: [Partial<AnalyzeInvoiceDto>](../../nodia-server/src/invoice/dto/analyze-invoice.dto.ts) | [AnalyzeInvoiceUseCase.execute](../../nodia-server/src/invoice/use-case/analyze-invoice.use-case.ts) | F — Extracción multimodal/costo externo; guardar factura es otro paso |
| [POST /api/v1/invoice](../../nodia-server/src/invoice/invoice.controller.ts#L97) (+1) | Archivo: `Express.Multer.File \| undefined`; B: [CreateInvoiceDto](../../nodia-server/src/invoice/dto/create-invoice.dto.ts) | [CreateInvoiceUseCase.execute](../../nodia-server/src/invoice/use-case/create-invoice.use-case.ts) | F — Crear factura, archivo opcional y recuperación R2 |
| [PUT /api/v1/invoice/:id](../../nodia-server/src/invoice/invoice.controller.ts#L110) (+1) | B: [UpdateInvoiceDto](../../nodia-server/src/invoice/dto/update-invoice.dto.ts) | [UpdateInvoiceUseCase.execute](../../nodia-server/src/invoice/use-case/update-invoice.use-case.ts) | M |

#### Historial de productos

Fuente: [ProductLogController](../../nodia-server/src/product/product-log.controller.ts#L16). 7 operaciones; prefijos `/api/v1/product-log`, `/api/v1/product-logs`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/product-log](../../nodia-server/src/product/product-log.controller.ts#L28) (+1) | Q: [GetProductLogsDto](../../nodia-server/src/product/dto/get-product-logs.dto.ts) | [GetAllProductLogsUseCase.execute](../../nodia-server/src/product/use-case/get-all-product-logs.use-case.ts) | L |
| [POST /api/v1/product-log/query](../../nodia-server/src/product/product-log.controller.ts#L33) (+3) | B: [QueryProductLogsDto](../../nodia-server/src/product/dto/query-product-logs.dto.ts) | [QueryProductLogsUseCase.execute](../../nodia-server/src/product/use-case/query-product-logs.use-case.ts) | L — POST de consulta; no insertar logs |
| [POST /api/v1/product-log/bulk](../../nodia-server/src/product/product-log.controller.ts#L38) (+1) | B: [BulkCreateProductLogDto](../../nodia-server/src/product/dto/bulk-create-product-log.dto.ts) | [CreateBulkProductLogsUseCase.execute](../../nodia-server/src/product/use-case/create-bulk-product-logs.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [PUT /api/v1/product-log/bulk](../../nodia-server/src/product/product-log.controller.ts#L43) (+1) | B: [BulkUpdateProductLogDto](../../nodia-server/src/product/dto/bulk-update-product-log.dto.ts) | [UpdateBulkProductLogsUseCase.execute](../../nodia-server/src/product/use-case/update-bulk-product-logs.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [GET /api/v1/product-log/:id](../../nodia-server/src/product/product-log.controller.ts#L48) (+1) | Sin Body/Query DTO declarado | [GetProductLogByIdUseCase.execute](../../nodia-server/src/product/use-case/get-product-log-by-id.use-case.ts) | L |
| [POST /api/v1/product-log](../../nodia-server/src/product/product-log.controller.ts#L53) (+1) | B: [CreateProductLogDto](../../nodia-server/src/product/dto/create-product-log.dto.ts) | [CreateProductLogUseCase.execute](../../nodia-server/src/product/use-case/create-product-log.use-case.ts) | M |
| [PUT /api/v1/product-log/:id](../../nodia-server/src/product/product-log.controller.ts#L58) (+1) | B: [UpdateProductLogDto](../../nodia-server/src/product/dto/update-product-log.dto.ts) | [UpdateProductLogUseCase.execute](../../nodia-server/src/product/use-case/update-product-log.use-case.ts) | M |

#### Productos

Fuente: [ProductController](../../nodia-server/src/product/product.controller.ts#L16). 7 operaciones; prefijos `/api/v1/product`, `/api/v1/products`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/product](../../nodia-server/src/product/product.controller.ts#L28) (+1) | Q: [GetProductsDto](../../nodia-server/src/product/dto/get-products.dto.ts) | [GetAllProductsUseCase.execute](../../nodia-server/src/product/use-case/get-all-products.use-case.ts) | L |
| [POST /api/v1/product/bulk](../../nodia-server/src/product/product.controller.ts#L33) (+1) | B: [BulkCreateProductDto](../../nodia-server/src/product/dto/bulk-create-product.dto.ts) | [CreateBulkProductsUseCase.execute](../../nodia-server/src/product/use-case/create-bulk-products.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [PUT /api/v1/product/bulk](../../nodia-server/src/product/product.controller.ts#L38) (+1) | B: [BulkUpdateProductDto](../../nodia-server/src/product/dto/bulk-update-product.dto.ts) | [UpdateBulkProductsUseCase.execute](../../nodia-server/src/product/use-case/update-bulk-products.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [GET /api/v1/product/export-csv](../../nodia-server/src/product/product.controller.ts#L43) (+1) | Q: [ExportProductsCsvDto](../../nodia-server/src/product/dto/export-products-csv.dto.ts) | [ExportProductsCsvUseCase.execute](../../nodia-server/src/product/use-case/export-products-csv.use-case.ts) | F — Exportación existente, acotar descarga y entregar archivo privado |
| [GET /api/v1/product/:id](../../nodia-server/src/product/product.controller.ts#L50) (+1) | Sin Body/Query DTO declarado | [GetProductByIdUseCase.execute](../../nodia-server/src/product/use-case/get-product-by-id.use-case.ts) | L |
| [POST /api/v1/product](../../nodia-server/src/product/product.controller.ts#L55) (+1) | B: [CreateProductDto](../../nodia-server/src/product/dto/create-product.dto.ts) | [CreateProductUseCase.execute](../../nodia-server/src/product/use-case/create-product.use-case.ts) | M |
| [PUT /api/v1/product/:id](../../nodia-server/src/product/product.controller.ts#L60) (+1) | B: [UpdateProductDto](../../nodia-server/src/product/dto/update-product.dto.ts) | [UpdateProductUseCase.execute](../../nodia-server/src/product/use-case/update-product.use-case.ts) | M |

#### Contactos de proveedores

Fuente: [ProviderContactController](../../nodia-server/src/provider-contact/provider-contact.controller.ts#L24). 4 operaciones; prefijos `/api/v1/providers/:providerId/contacts`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/providers/:providerId/contacts](../../nodia-server/src/provider-contact/provider-contact.controller.ts#L32) | P: [ContactParamsDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts); Q: [ContactListDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts) | [GetProviderContactsUseCase.execute](../../nodia-server/src/provider-contact/use-case/get-provider-contacts.use-case.ts) | L |
| [POST /api/v1/providers/:providerId/contacts](../../nodia-server/src/provider-contact/provider-contact.controller.ts#L38) | P: [ContactParamsDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts); B: [CreateProviderContactDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts) | [CreateProviderContactUseCase.execute](../../nodia-server/src/provider-contact/use-case/create-provider-contact.use-case.ts) | M |
| [PUT /api/v1/providers/:providerId/contacts/:id](../../nodia-server/src/provider-contact/provider-contact.controller.ts#L44) | P: [ContactIdParamsDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts); B: [UpdateProviderContactDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts) | [UpdateProviderContactUseCase.execute](../../nodia-server/src/provider-contact/use-case/update-provider-contact.use-case.ts) | M |
| [PATCH /api/v1/providers/:providerId/contacts/:id/status](../../nodia-server/src/provider-contact/provider-contact.controller.ts#L50) | P: [ContactIdParamsDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts); B: [ToggleProviderContactDto](../../nodia-server/src/provider-contact/dto/provider-contact.dto.ts) | [UpdateProviderContactUseCase.execute](../../nodia-server/src/provider-contact/use-case/update-provider-contact.use-case.ts) | M |

#### Proveedores comerciales

Fuente: [ProviderController](../../nodia-server/src/provider/provider.controller.ts#L18). 8 operaciones; prefijos `/api/v1/provider`, `/api/v1/providers`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/provider](../../nodia-server/src/provider/provider.controller.ts#L31) (+1) | Q: [GetProvidersDto](../../nodia-server/src/provider/dto/get-providers.dto.ts) | [GetAllProvidersUseCase.execute](../../nodia-server/src/provider/use-case/get-all-providers.use-case.ts) | L |
| [POST /api/v1/provider/bulk](../../nodia-server/src/provider/provider.controller.ts#L36) (+1) | B: [BulkCreateProviderDto](../../nodia-server/src/provider/dto/bulk-create-provider.dto.ts) | [CreateBulkProvidersUseCase.execute](../../nodia-server/src/provider/use-case/create-bulk-providers.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [POST /api/v1/provider/import](../../nodia-server/src/provider/provider.controller.ts#L41) (+1) | B: [ImportProvidersDto](../../nodia-server/src/provider/dto/import-providers.dto.ts) | [ImportProvidersUseCase.execute](../../nodia-server/src/provider/use-case/import-providers.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [PUT /api/v1/provider/bulk](../../nodia-server/src/provider/provider.controller.ts#L46) (+1) | B: [BulkUpdateProviderDto](../../nodia-server/src/provider/dto/bulk-update-provider.dto.ts) | [UpdateBulkProvidersUseCase.execute](../../nodia-server/src/provider/use-case/update-bulk-providers.use-case.ts) | B — Escritura por lote/importación excluida expresamente de v1 por el usuario |
| [GET /api/v1/provider/export-csv](../../nodia-server/src/provider/provider.controller.ts#L51) (+1) | Q: [ExportProvidersCsvDto](../../nodia-server/src/provider/dto/export-providers-csv.dto.ts) | [ExportProvidersCsvUseCase.execute](../../nodia-server/src/provider/use-case/export-providers-csv.use-case.ts) | F — Exportación existente, acotar descarga y entregar archivo privado |
| [GET /api/v1/provider/:id](../../nodia-server/src/provider/provider.controller.ts#L58) (+1) | Sin Body/Query DTO declarado | [GetProviderByIdUseCase.execute](../../nodia-server/src/provider/use-case/get-provider-by-id.use-case.ts) | L |
| [POST /api/v1/provider](../../nodia-server/src/provider/provider.controller.ts#L63) (+1) | B: [CreateProviderDto](../../nodia-server/src/provider/dto/create-provider.dto.ts) | [CreateProviderUseCase.execute](../../nodia-server/src/provider/use-case/create-provider.use-case.ts) | M |
| [PUT /api/v1/provider/:id](../../nodia-server/src/provider/provider.controller.ts#L68) (+1) | B: [UpdateProviderDto](../../nodia-server/src/provider/dto/update-provider.dto.ts) | [UpdateProviderUseCase.execute](../../nodia-server/src/provider/use-case/update-provider.use-case.ts) | M |

### Finanzas personales

#### Grupos de categorías financieras

Fuente: [FinanceCategoryGroupController](../../nodia-server/src/finance-category-group/finance-category-group.controller.ts#L41). 5 operaciones; prefijos `/api/v1/finance/category-groups`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/finance/category-groups](../../nodia-server/src/finance-category-group/finance-category-group.controller.ts#L72) | Q: [FinanceQueryDto](../../nodia-server/src/finance-common/dto/finance-query.dto.ts) | [GetFinanceCategoryGroupsUseCase.execute](../../nodia-server/src/finance-category-group/use-case/get-finance-category-groups.use-case.ts) | L |
| [GET /api/v1/finance/category-groups/:id](../../nodia-server/src/finance-category-group/finance-category-group.controller.ts#L83) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [GetFinanceCategoryGroupUseCase.execute](../../nodia-server/src/finance-category-group/use-case/get-finance-category-group.use-case.ts) | L |
| [POST /api/v1/finance/category-groups](../../nodia-server/src/finance-category-group/finance-category-group.controller.ts#L98) | B: [CreateFinanceCategoryGroupDto](../../nodia-server/src/finance-category-group/dto/create-finance-category-group.dto.ts) | [CreateFinanceCategoryGroupUseCase.execute](../../nodia-server/src/finance-category-group/use-case/create-finance-category-group.use-case.ts) | M |
| [PUT /api/v1/finance/category-groups/:id](../../nodia-server/src/finance-category-group/finance-category-group.controller.ts#L113) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts); B: [UpdateFinanceCategoryGroupDto](../../nodia-server/src/finance-category-group/dto/update-finance-category-group.dto.ts) | [UpdateFinanceCategoryGroupUseCase.execute](../../nodia-server/src/finance-category-group/use-case/update-finance-category-group.use-case.ts) | M |
| [DELETE /api/v1/finance/category-groups/:id](../../nodia-server/src/finance-category-group/finance-category-group.controller.ts#L131) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [DeleteFinanceCategoryGroupUseCase.execute](../../nodia-server/src/finance-category-group/use-case/delete-finance-category-group.use-case.ts) | M |

#### Categorías financieras

Fuente: [FinanceCategoryController](../../nodia-server/src/finance-category/finance-category.controller.ts#L41). 5 operaciones; prefijos `/api/v1/finance/categories`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/finance/categories](../../nodia-server/src/finance-category/finance-category.controller.ts#L70) | Q: [FinanceQueryDto](../../nodia-server/src/finance-common/dto/finance-query.dto.ts) | [GetFinanceCategoriesUseCase.execute](../../nodia-server/src/finance-category/use-case/get-finance-categories.use-case.ts) | L |
| [GET /api/v1/finance/categories/:id](../../nodia-server/src/finance-category/finance-category.controller.ts#L79) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [GetFinanceCategoryUseCase.execute](../../nodia-server/src/finance-category/use-case/get-finance-category.use-case.ts) | L |
| [POST /api/v1/finance/categories](../../nodia-server/src/finance-category/finance-category.controller.ts#L94) | B: [CreateFinanceCategoryDto](../../nodia-server/src/finance-category/dto/create-finance-category.dto.ts) | [CreateFinanceCategoryUseCase.execute](../../nodia-server/src/finance-category/use-case/create-finance-category.use-case.ts) | M |
| [PUT /api/v1/finance/categories/:id](../../nodia-server/src/finance-category/finance-category.controller.ts#L107) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts); B: [UpdateFinanceCategoryDto](../../nodia-server/src/finance-category/dto/update-finance-category.dto.ts) | [UpdateFinanceCategoryUseCase.execute](../../nodia-server/src/finance-category/use-case/update-finance-category.use-case.ts) | M |
| [DELETE /api/v1/finance/categories/:id](../../nodia-server/src/finance-category/finance-category.controller.ts#L122) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [DeleteFinanceCategoryUseCase.execute](../../nodia-server/src/finance-category/use-case/delete-finance-category.use-case.ts) | M |

#### Movimientos financieros

Fuente: [FinanceMovementController](../../nodia-server/src/finance-movement/finance-movement.controller.ts#L40). 5 operaciones; prefijos `/api/v1/finance/movements`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/finance/movements](../../nodia-server/src/finance-movement/finance-movement.controller.ts#L65) | Q: [FinanceQueryDto](../../nodia-server/src/finance-common/dto/finance-query.dto.ts) | [GetFinanceMovementsUseCase.execute](../../nodia-server/src/finance-movement/use-case/get-finance-movements.use-case.ts) | L |
| [GET /api/v1/finance/movements/:id](../../nodia-server/src/finance-movement/finance-movement.controller.ts#L74) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [GetFinanceMovementByIdUseCase.execute](../../nodia-server/src/finance-movement/use-case/get-finance-movement-by-id.use-case.ts) | L |
| [POST /api/v1/finance/movements](../../nodia-server/src/finance-movement/finance-movement.controller.ts#L89) | B: [CreateFinanceMovementDto](../../nodia-server/src/finance-movement/dto/create-finance-movement.dto.ts) | [CreateFinanceMovementUseCase.execute](../../nodia-server/src/finance-movement/use-case/create-finance-movement.use-case.ts) | M |
| [PUT /api/v1/finance/movements/:id](../../nodia-server/src/finance-movement/finance-movement.controller.ts#L104) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts); B: [UpdateFinanceMovementDto](../../nodia-server/src/finance-movement/dto/update-finance-movement.dto.ts) | [UpdateFinanceMovementUseCase.execute](../../nodia-server/src/finance-movement/use-case/update-finance-movement.use-case.ts) | M |
| [DELETE /api/v1/finance/movements/:id](../../nodia-server/src/finance-movement/finance-movement.controller.ts#L119) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [DeleteFinanceMovementUseCase.execute](../../nodia-server/src/finance-movement/use-case/delete-finance-movement.use-case.ts) | M |

#### Préstamos y deudas

Fuente: [FinanceObligationController](../../nodia-server/src/finance-obligation/finance-obligation.controller.ts#L40). 5 operaciones; prefijos `/api/v1/finance/obligations`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/finance/obligations](../../nodia-server/src/finance-obligation/finance-obligation.controller.ts#L65) | Q: [FinanceQueryDto](../../nodia-server/src/finance-common/dto/finance-query.dto.ts) | [GetFinanceObligationsUseCase.execute](../../nodia-server/src/finance-obligation/use-case/get-finance-obligations.use-case.ts) | L |
| [GET /api/v1/finance/obligations/:id](../../nodia-server/src/finance-obligation/finance-obligation.controller.ts#L76) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [GetFinanceObligationByIdUseCase.execute](../../nodia-server/src/finance-obligation/use-case/get-finance-obligation-by-id.use-case.ts) | L |
| [POST /api/v1/finance/obligations](../../nodia-server/src/finance-obligation/finance-obligation.controller.ts#L89) | B: [CreateFinanceObligationDto](../../nodia-server/src/finance-obligation/dto/create-finance-obligation.dto.ts) | [CreateFinanceObligationUseCase.execute](../../nodia-server/src/finance-obligation/use-case/create-finance-obligation.use-case.ts) | M |
| [PUT /api/v1/finance/obligations/:id](../../nodia-server/src/finance-obligation/finance-obligation.controller.ts#L104) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts); B: [UpdateFinanceObligationDto](../../nodia-server/src/finance-obligation/dto/update-finance-obligation.dto.ts) | [UpdateFinanceObligationUseCase.execute](../../nodia-server/src/finance-obligation/use-case/update-finance-obligation.use-case.ts) | M |
| [DELETE /api/v1/finance/obligations/:id](../../nodia-server/src/finance-obligation/finance-obligation.controller.ts#L122) | P: [FinanceIdDto](../../nodia-server/src/finance-common/dto/finance-id.dto.ts) | [DeleteFinanceObligationUseCase.execute](../../nodia-server/src/finance-obligation/use-case/delete-finance-obligation.use-case.ts) | M |

#### Resumen financiero

Fuente: [FinanceOverviewController](../../nodia-server/src/finance-overview/finance-overview.controller.ts#L23). 3 operaciones; prefijos `/api/v1/finance/overview`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/finance/overview](../../nodia-server/src/finance-overview/finance-overview.controller.ts#L36) | Q: [FinanceOverviewQueryDto](../../nodia-server/src/finance-overview/dto/finance-overview-query.dto.ts) | [GetFinanceOverviewUseCase.execute](../../nodia-server/src/finance-overview/use-case/get-finance-overview.use-case.ts) | L |
| [GET /api/v1/finance/overview/categories](../../nodia-server/src/finance-overview/finance-overview.controller.ts#L52) | Q: [FinanceSummaryQueryDto](../../nodia-server/src/finance-overview/dto/finance-overview-query.dto.ts) | [GetFinanceCategorySummaryUseCase.execute](../../nodia-server/src/finance-overview/use-case/get-finance-category-summary.use-case.ts) | L |
| [GET /api/v1/finance/overview/category-groups](../../nodia-server/src/finance-overview/finance-overview.controller.ts#L68) | Q: [FinanceSummaryQueryDto](../../nodia-server/src/finance-overview/dto/finance-overview-query.dto.ts) | [GetFinanceGroupSummaryUseCase.execute](../../nodia-server/src/finance-overview/use-case/get-finance-group-summary.use-case.ts) | L |

### Reservas

#### Bloqueos de calendario

Fuente: [RentalBlockController](../../nodia-server/src/rental-block/rental-block.controller.ts#L44). 4 operaciones; prefijos `/api/v1/rental/properties/:propertyId/blocks`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/blocks](../../nodia-server/src/rental-block/rental-block.controller.ts#L61) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CreateRentalBlockDto](../../nodia-server/src/rental-block/dto/rental-block.dto.ts); H: `string` ('idempotency-key') | [CreateRentalBlockUseCase.execute](../../nodia-server/src/rental-block/use-case/create-rental-block.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/blocks](../../nodia-server/src/rental-block/rental-block.controller.ts#L85) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalBlockQueryDto](../../nodia-server/src/rental-block/dto/rental-block.dto.ts) | [GetRentalBlocksUseCase.execute](../../nodia-server/src/rental-block/use-case/get-rental-blocks.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/blocks/:id](../../nodia-server/src/rental-block/rental-block.controller.ts#L100) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalBlockUseCase.execute](../../nodia-server/src/rental-block/use-case/get-rental-blocks.use-case.ts) | L |
| [PUT /api/v1/rental/properties/:propertyId/blocks/:id](../../nodia-server/src/rental-block/rental-block.controller.ts#L113) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalBlockDto](../../nodia-server/src/rental-block/dto/rental-block.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalBlockUseCase.execute](../../nodia-server/src/rental-block/use-case/update-rental-block.use-case.ts) | M |

#### Calendario y disponibilidad

Fuente: [RentalCalendarController](../../nodia-server/src/rental-calendar/rental-calendar.controller.ts#L31). 2 operaciones; prefijos `/api/v1/rental/properties/:propertyId`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/rental/properties/:propertyId/calendar](../../nodia-server/src/rental-calendar/rental-calendar.controller.ts#L46) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalCalendarQueryDto](../../nodia-server/src/rental-calendar/dto/rental-calendar.dto.ts) | [GetRentalCalendarUseCase.execute](../../nodia-server/src/rental-calendar/use-case/get-rental-calendar.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/availability](../../nodia-server/src/rental-calendar/rental-calendar.controller.ts#L61) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalAvailabilityQueryDto](../../nodia-server/src/rental-calendar/dto/rental-calendar.dto.ts) | [GetRentalAvailabilityUseCase.execute](../../nodia-server/src/rental-calendar/use-case/get-rental-calendar.use-case.ts) | L |

#### Políticas de cancelación

Fuente: [RentalCancellationPolicyController](../../nodia-server/src/rental-cancellation-policy/rental-cancellation-policy.controller.ts#L40). 4 operaciones; prefijos `/api/v1/rental/properties/:propertyId/cancellation-policies`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/cancellation-policies](../../nodia-server/src/rental-cancellation-policy/rental-cancellation-policy.controller.ts#L57) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CreateRentalCancellationPolicyDto](../../nodia-server/src/rental-cancellation-policy/dto/create-rental-cancellation-policy.dto.ts); H: `string` ('idempotency-key') | [CreateRentalCancellationPolicyUseCase.execute](../../nodia-server/src/rental-cancellation-policy/use-case/create-rental-cancellation-policy.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/cancellation-policies](../../nodia-server/src/rental-cancellation-policy/rental-cancellation-policy.controller.ts#L81) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalConfigurationQueryDto](../../nodia-server/src/rental-property/dto/rental-configuration-query.dto.ts) | [GetRentalCancellationPoliciesUseCase.execute](../../nodia-server/src/rental-cancellation-policy/use-case/get-rental-cancellation-policies.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/cancellation-policies/:id](../../nodia-server/src/rental-cancellation-policy/rental-cancellation-policy.controller.ts#L96) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalCancellationPolicyUseCase.execute](../../nodia-server/src/rental-cancellation-policy/use-case/get-rental-cancellation-policy.use-case.ts) | L |
| [PUT /api/v1/rental/properties/:propertyId/cancellation-policies/:id](../../nodia-server/src/rental-cancellation-policy/rental-cancellation-policy.controller.ts#L109) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalCancellationPolicyDto](../../nodia-server/src/rental-cancellation-policy/dto/update-rental-cancellation-policy.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalCancellationPolicyUseCase.execute](../../nodia-server/src/rental-cancellation-policy/use-case/update-rental-cancellation-policy.use-case.ts) | M |

#### Colaboradores de alojamiento

Fuente: [RentalCollaboratorController](../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts#L43). 4 operaciones; prefijos `/api/v1/rental/properties/:propertyId`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/collaborators](../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts#L60) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CreateRentalCollaboratorDto](../../nodia-server/src/rental-collaborator/dto/create-rental-collaborator.dto.ts); H: `string` ('idempotency-key') | [CreateRentalCollaboratorUseCase.execute](../../nodia-server/src/rental-collaborator/use-case/create-rental-collaborator.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/collaborator-candidates](../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts#L84) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalCollaboratorCandidatesQueryDto](../../nodia-server/src/rental-property/dto/rental-configuration-query.dto.ts) | [GetRentalCollaboratorCandidatesUseCase.execute](../../nodia-server/src/rental-collaborator/use-case/get-rental-collaborator-candidates.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/collaborators](../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts#L99) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalConfigurationQueryDto](../../nodia-server/src/rental-property/dto/rental-configuration-query.dto.ts) | [GetRentalCollaboratorsUseCase.execute](../../nodia-server/src/rental-collaborator/use-case/get-rental-collaborators.use-case.ts) | L |
| [PUT /api/v1/rental/properties/:propertyId/collaborators/:id](../../nodia-server/src/rental-collaborator/rental-collaborator.controller.ts#L114) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalCollaboratorDto](../../nodia-server/src/rental-collaborator/dto/update-rental-collaborator.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalCollaboratorUseCase.execute](../../nodia-server/src/rental-collaborator/use-case/update-rental-collaborator.use-case.ts) | M |

#### Auditoría y recuperación de Reservas

Fuente: [RentalHistoryController](../../nodia-server/src/rental-common/rental-history.controller.ts#L26). 2 operaciones; prefijos `/api/v1/rental/properties/:propertyId`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/rental/properties/:propertyId/audit-events](../../nodia-server/src/rental-common/rental-history.controller.ts#L36) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalAuditQueryDto](../../nodia-server/src/rental-audit/dto/rental-audit-query.dto.ts) | [GetRentalAuditEventsUseCase.execute](../../nodia-server/src/rental-audit/use-case/get-rental-audit-events.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/operations/:requestKey](../../nodia-server/src/rental-common/rental-history.controller.ts#L51) | P: [RentalOperationParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalOperationUseCase.execute](../../nodia-server/src/rental-operation/use-case/get-rental-operation.use-case.ts) | A — Recuperación por intención/actor, no nueva ejecución |

#### Gastos de alojamiento

Fuente: [RentalExpenseController](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L49). 6 operaciones; prefijos `/api/v1/rental/properties/:propertyId/expenses`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/expenses](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L68) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CreateRentalExpenseDto](../../nodia-server/src/rental-expense/dto/rental-expense.dto.ts); H: `string` ('idempotency-key') | [CreateRentalExpenseUseCase.execute](../../nodia-server/src/rental-expense/use-case/create-rental-expense.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/expenses](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L92) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalExpenseQueryDto](../../nodia-server/src/rental-expense/dto/rental-expense.dto.ts) | [GetRentalExpensesUseCase.execute](../../nodia-server/src/rental-expense/use-case/get-rental-expenses.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/expenses/:id](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L107) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalExpenseUseCase.execute](../../nodia-server/src/rental-expense/use-case/get-rental-expenses.use-case.ts) | L |
| [POST /api/v1/rental/properties/:propertyId/expenses/:id/pay](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L120) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [PayRentalExpenseDto](../../nodia-server/src/rental-expense/dto/rental-expense.dto.ts); H: `string` ('idempotency-key') | [PayRentalExpenseUseCase.execute](../../nodia-server/src/rental-expense/use-case/pay-rental-expense.use-case.ts) | M |
| [PUT /api/v1/rental/properties/:propertyId/expenses/:id](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L146) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalExpenseDto](../../nodia-server/src/rental-expense/dto/rental-expense.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalExpenseUseCase.execute](../../nodia-server/src/rental-expense/use-case/update-rental-expense.use-case.ts) | M |
| [POST /api/v1/rental/properties/:propertyId/expenses/:id/void](../../nodia-server/src/rental-expense/rental-expense.controller.ts#L171) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [VoidRentalExpenseDto](../../nodia-server/src/rental-expense/dto/rental-expense.dto.ts); H: `string` ('idempotency-key') | [VoidRentalExpenseUseCase.execute](../../nodia-server/src/rental-expense/use-case/void-rental-expense.use-case.ts) | M |

#### Resumen de alojamiento

Fuente: [RentalOverviewController](../../nodia-server/src/rental-overview/rental-overview.controller.ts#L25). 1 operaciones; prefijos `/api/v1/rental/properties/:propertyId/overview`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/rental/properties/:propertyId/overview](../../nodia-server/src/rental-overview/rental-overview.controller.ts#L39) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalOverviewQueryDto](../../nodia-server/src/rental-overview/dto/rental-overview.dto.ts) | [GetRentalOverviewUseCase.execute](../../nodia-server/src/rental-overview/use-case/get-rental-overview.use-case.ts) | L |

#### Cobros y devoluciones

Fuente: [RentalPaymentController](../../nodia-server/src/rental-payment/rental-payment.controller.ts#L44). 4 operaciones; prefijos `/api/v1/rental/properties/:propertyId/payments`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/payments](../../nodia-server/src/rental-payment/rental-payment.controller.ts#L61) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CreateRentalPaymentDto](../../nodia-server/src/rental-payment/dto/rental-payment.dto.ts); H: `string` ('idempotency-key') | [CreateRentalPaymentUseCase.execute](../../nodia-server/src/rental-payment/use-case/create-rental-payment.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/payments](../../nodia-server/src/rental-payment/rental-payment.controller.ts#L85) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalPaymentQueryDto](../../nodia-server/src/rental-payment/dto/rental-payment.dto.ts) | [GetRentalPaymentsUseCase.execute](../../nodia-server/src/rental-payment/use-case/get-rental-payments.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/payments/:id](../../nodia-server/src/rental-payment/rental-payment.controller.ts#L100) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalPaymentUseCase.execute](../../nodia-server/src/rental-payment/use-case/get-rental-payments.use-case.ts) | L |
| [POST /api/v1/rental/properties/:propertyId/payments/:id/void](../../nodia-server/src/rental-payment/rental-payment.controller.ts#L113) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [VoidRentalPaymentDto](../../nodia-server/src/rental-payment/dto/rental-payment.dto.ts); H: `string` ('idempotency-key') | [VoidRentalPaymentUseCase.execute](../../nodia-server/src/rental-payment/use-case/void-rental-payment.use-case.ts) | M |

#### Alojamientos

Fuente: [RentalPropertyController](../../nodia-server/src/rental-property/rental-property.controller.ts#L37). 4 operaciones; prefijos `/api/v1/rental/properties`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties](../../nodia-server/src/rental-property/rental-property.controller.ts#L54) | B: [CreateRentalPropertyDto](../../nodia-server/src/rental-property/dto/create-rental-property.dto.ts); H: `string` ('idempotency-key') | [CreateRentalPropertyUseCase.execute](../../nodia-server/src/rental-property/use-case/create-rental-property.use-case.ts) | M |
| [GET /api/v1/rental/properties](../../nodia-server/src/rental-property/rental-property.controller.ts#L76) | Q: [RentalConfigurationQueryDto](../../nodia-server/src/rental-property/dto/rental-configuration-query.dto.ts) | [GetRentalPropertiesUseCase.execute](../../nodia-server/src/rental-property/use-case/get-rental-properties.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId](../../nodia-server/src/rental-property/rental-property.controller.ts#L89) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalPropertyUseCase.execute](../../nodia-server/src/rental-property/use-case/get-rental-property.use-case.ts) | L |
| [PUT /api/v1/rental/properties/:propertyId](../../nodia-server/src/rental-property/rental-property.controller.ts#L101) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalPropertyDto](../../nodia-server/src/rental-property/dto/update-rental-property.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalPropertyUseCase.execute](../../nodia-server/src/rental-property/use-case/update-rental-property.use-case.ts) | M |

#### Reservas y transiciones

Fuente: [RentalReservationController](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L52). 9 operaciones; prefijos `/api/v1/rental/properties/:propertyId/reservations`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/reservations/:id/cancel](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L74) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CancelRentalReservationDto](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts); H: `string` ('idempotency-key') | [CancelRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/cancel-rental-reservation.use-case.ts) | M |
| [POST /api/v1/rental/properties/:propertyId/reservations/:id/complete](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L100) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [EmptyRentalCommandDto](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts); H: `string` ('idempotency-key') | [CompleteRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/complete-rental-reservation.use-case.ts) | M |
| [POST /api/v1/rental/properties/:propertyId/reservations/:id/confirm](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L126) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [ConfirmRentalReservationDto](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts); H: `string` ('idempotency-key') | [ConfirmRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/confirm-rental-reservation.use-case.ts) | M |
| [POST /api/v1/rental/properties/:propertyId/reservations](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L152) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [CreateRentalReservationDto](../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts); H: `string` ('idempotency-key') | [CreateRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/create-rental-reservation.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/reservations/:id](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L176) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/get-rental-reservation.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/reservations](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L189) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalReservationQueryDto](../../nodia-server/src/rental-reservation/dto/rental-reservation-query.dto.ts) | [ListRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/list-rental-reservation.use-case.ts) | L |
| [POST /api/v1/rental/properties/:propertyId/reservations/:id/cancellation-preview](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L204) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [PreviewRentalCancellationDto](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts) | [PreviewRentalCancellationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/preview-rental-cancellation.use-case.ts) | L — POST de cálculo previo; no cancelar ni congelar acuerdo |
| [POST /api/v1/rental/properties/:propertyId/reservations/:id/start](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L220) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [EmptyRentalCommandDto](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts); H: `string` ('idempotency-key') | [StartRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/start-rental-reservation.use-case.ts) | M |
| [PUT /api/v1/rental/properties/:propertyId/reservations/:id](../../nodia-server/src/rental-reservation/rental-reservation.controller.ts#L246) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalReservationDto](../../nodia-server/src/rental-reservation/dto/update-rental-reservation.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalReservationUseCase.execute](../../nodia-server/src/rental-reservation/use-case/update-rental-reservation.use-case.ts) | M |

#### Preparación y recambio

Fuente: [RentalTurnoverController](../../nodia-server/src/rental-turnover/rental-turnover.controller.ts#L40). 4 operaciones; prefijos `/api/v1/rental/properties/:propertyId/turnovers`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/rental/properties/:propertyId/turnovers/:id/approve-same-day](../../nodia-server/src/rental-turnover/rental-turnover.controller.ts#L57) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [EmptyRentalCommandDto](../../nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts); H: `string` ('idempotency-key') | [ApproveSameDayRentalTurnoverUseCase.execute](../../nodia-server/src/rental-turnover/use-case/approve-same-day-rental-turnover.use-case.ts) | M |
| [GET /api/v1/rental/properties/:propertyId/turnovers/:id](../../nodia-server/src/rental-turnover/rental-turnover.controller.ts#L83) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts) | [GetRentalTurnoverUseCase.execute](../../nodia-server/src/rental-turnover/use-case/get-rental-turnover.use-case.ts) | L |
| [GET /api/v1/rental/properties/:propertyId/turnovers](../../nodia-server/src/rental-turnover/rental-turnover.controller.ts#L96) | P: [RentalPropertyParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); Q: [RentalTurnoverQueryDto](../../nodia-server/src/rental-turnover/dto/rental-turnover-query.dto.ts) | [ListRentalTurnoverUseCase.execute](../../nodia-server/src/rental-turnover/use-case/list-rental-turnover.use-case.ts) | L |
| [PUT /api/v1/rental/properties/:propertyId/turnovers/:id](../../nodia-server/src/rental-turnover/rental-turnover.controller.ts#L111) | P: [RentalResourceParamsDto](../../nodia-server/src/rental-common/dto/rental-params.dto.ts); B: [UpdateRentalTurnoverDto](../../nodia-server/src/rental-turnover/dto/update-rental-turnover.dto.ts); H: `string` ('idempotency-key') | [UpdateRentalTurnoverUseCase.execute](../../nodia-server/src/rental-turnover/use-case/update-rental-turnover.use-case.ts) | M |

### Infraestructura y sesión

#### Liveness

Fuente: [AppController](../../nodia-server/src/app.controller.ts#L5). 1 operaciones; prefijos `/api/v1`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1](../../nodia-server/src/app.controller.ts#L9) | Sin Body/Query DTO declarado | [AppService.getHelloWorld](../../nodia-server/src/app.service.ts) | O — Liveness técnico; no operación de producto |

#### Autenticación Nodia

Fuente: [AuthController](../../nodia-server/src/auth/auth.controller.ts#L26). 5 operaciones; prefijos `/api/v1/auth`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [POST /api/v1/auth/login](../../nodia-server/src/auth/auth.controller.ts#L37) | B: [LoginDto](../../nodia-server/src/auth/dto/login.dto.ts) | [AuthCookieService.write](../../nodia-server/src/auth/auth-cookie.service.ts); [LoginUseCase.execute](../../nodia-server/src/auth/use-case/login.use-case.ts) | I — Sesión propia y cookies/tokens fuera del contexto del modelo |
| [POST /api/v1/auth/refresh](../../nodia-server/src/auth/auth.controller.ts#L51) | Sin Body/Query DTO declarado | [AuthCookieService.write](../../nodia-server/src/auth/auth-cookie.service.ts); [RefreshSessionUseCase.execute](../../nodia-server/src/auth/use-case/refresh-session.use-case.ts); [AuthCookieService.read](../../nodia-server/src/auth/auth-cookie.service.ts) | A — Sesión propia y cookies/tokens fuera del contexto del modelo |
| [POST /api/v1/auth/logout](../../nodia-server/src/auth/auth.controller.ts#L69) | Sin Body/Query DTO declarado | [LogoutUseCase.execute](../../nodia-server/src/auth/use-case/logout.use-case.ts); [AuthCookieService.read](../../nodia-server/src/auth/auth-cookie.service.ts); [AuthCookieService.clear](../../nodia-server/src/auth/auth-cookie.service.ts) | I — Sesión propia y cookies/tokens fuera del contexto del modelo |
| [GET /api/v1/auth/me](../../nodia-server/src/auth/auth.controller.ts#L83) | Sin Body/Query DTO declarado | Contexto/resultado del controlador | A — Sesión propia y cookies/tokens fuera del contexto del modelo |
| [POST /api/v1/auth/seed](../../nodia-server/src/auth/auth.controller.ts#L90) | B: [SeedAuthDto](../../nodia-server/src/auth/dto/seed-auth.dto.ts) | [SeedAuthUseCase.execute](../../nodia-server/src/auth/use-case/seed-auth.use-case.ts) | O — Instalación con secreto; no herramienta de negocio |

#### Contexto de autorización

Fuente: [AuthorizationController](../../nodia-server/src/authorization/authorization.controller.ts#L6). 1 operaciones; prefijos `/api/v1/authorization`.

| Método y ruta representativa | Entrada declarada | Destino en código | NodiaAI |
|---|---|---|---|
| [GET /api/v1/authorization/context](../../nodia-server/src/authorization/authorization.controller.ts#L13) | Sin Body/Query DTO declarado | [GetAuthorizationContextUseCase.execute](../../nodia-server/src/authorization/use-case/get-authorization-context.use-case.ts) | A — Contexto propio para el coordinador, no credencial ni elevación de privilegios |

### Coordinación privada de artefactos NodiaAI

El [controlador de artefactos](../../nodia-server/src/nodia-ai-products/artifacts/nodia-ai-artifacts.controller.ts) añade `GET /api/v1/nodia-ai/artifacts/:reference`; `reference` es un UUID del recibo emitido por el Gateway. La ruta usa sesión Nodia, autorización del chat y módulo de destino, límites de tamaño/filas y reautorización antes de devolver bytes. No es una herramienta adicional del modelo ni acepta URLs, claves de almacenamiento o SQL. Su módulo sólo se compone cuando hay capacidades correspondientes publicadas. Las otras 13 rutas del coordinador constan en el [contrato HTTP](nodia-ai-v1-coordination-api.json).

## Cierre del inventario

Derivación posterior: [catálogo40](40-nodia-ai-tool-catalog-v1.md), [manifiesto trazable](nodia-ai-v1-tool-catalog.json), [contratos41](41-nodia-ai-v1-contracts.md) y [schemas comunes](nodia-ai-v1-common-contracts.schema.json). Corrección de clasificación: submitGeminiAgenticCode es flujo I por código OAuth, no mutación M expuesta al modelo. M75/I18 son los recuentos vigentes;177/296 no cambian. Usuario confirma secuencia con efectos parciales recuperables, botón sobre preview exacta e informes cruzados con medidas compatibles/procedencia separada.

- [x] 34 controladores alcanzables desde AppModule, 177 handlers y 296 métodos/rutas registrados en snapshot.
- [x] DTOs, parámetros, aliases, llamadas y metadata de autorización trazables a archivos/líneas.
- [x] Tres decisiones de bulk, módulo de destino e informes registradas sin modificar código.
- [x] Derivar catálogo de diseño:141 herramientas de dominio,11 comunes nuevas y4 flujos seguros; cobertura de177 handlers.
- [x] Redactar contratos comunes de autoridad, informes, confirmación y recuperación en41; propuesta sin implementación.
- [ ] Esquemas ejecutables MCP por dominio, registro versionado implementado y validación de reglas/autoridad/recuperación.
- [ ] Pruebas Gemini/HTTP/BD aislada y aceptación en runtime objetivo.

Este cierre es de inventario estático. No marca la planificación v1, el ADR o la integración como aprobados ni disponibles.

Delta AI-16:39 controladores/195 handlers/314 rutas y55 módulos locales (50 estáticos/5 condicionales),488 hashes de fuente. Cuatro GET nuevos de coordinación/observación, sin añadir capacidades MCP de negocio. El índice de30 rutas de coordinación distingue18 implementadas y12 pendientes. AST/contratos verificados de nuevo; [62](62-nodia-ai-ai16-observation-navigation.md) contiene límites y evidencia runtime separada.

## Entrega incremental AI-18

[AI-18/64](64-nodia-ai-ai18-human-confirmation.md) implementa desafío/confirmación por revisión/hash exactos, admisión atómica y recuperación sin duplicados. Metadatos humanos y edición de cinco campos escalares; registro productivo de ejecutores vacío hasta AI-19..20. No publica MCP prepare ni escribe en dominios.

El inventario AST actual registra43 controladores,202 handlers,321 pares HTTP/path y58 módulos (53 estáticos y5 condicionales);31 rutas de coordinación,25 implementadas. Las67 capacidades de lectura y27 fragmentos publicados conservan su release. Disponibilidad operativa de ejecución no se deduce de la existencia de rutas.

## Reconciliación incremental hasta AI-28

El [reconciliador AI-28](../evidence/scripts/reconcile-nodia-ai-ai28.cjs) conserva43 controladores,204 handlers y323 pares método/ruta; registra74 módulos locales (69 estáticos/5 condicionales) y741 hashes productivos. Las rutas IA mantienen `ai:manage` y ahora derivan el actor para los cuatro escritores compartidos de conexión/catálogo. No hay endpoints nuevos:69 ejecutores internos (12 financieros,14 de Negocios,22 de Reservas,17 Core y4 de configuración IA). [Entrega74](74-nodia-ai-ai28-provider-configuration.md) distingue estos efectos de67 lecturas/27 fragmentos publicados, sincronización remota pendiente y canales seguros AI-29. Las cifras siguientes son históricas.

## Reconciliación incremental hasta AI-27

El [reconciliador AI-27](../evidence/scripts/reconcile-nodia-ai-ai27.cjs) registra73 módulos locales (68 estáticos/5 condicionales),43 controladores,204 handlers,323 pares método/ruta y733 hashes productivos. No hay rutas nuevas:17 puertos Core elevan el registro interno48→65 ejecutores (12 financieros,14 de Negocios,22 de Reservas y17 Core). Usuarios conserva sólo create/update; cinco catálogos también delete y BusinessAction conserva su desactivación nativa. [Entrega73](73-nodia-ai-ai27-core-administration.md) documenta asociaciones, impacto y frontera exclusiva NI-13. El catálogo público mantiene67 lecturas/27 fragmentos; configuración IA sigue en AI-28/29. Las cifras siguientes son históricas.

## Reconciliación incremental hasta AI-26

El [reconciliador AI-26](../evidence/scripts/reconcile-nodia-ai-ai26.cjs) actualiza la composición a72 módulos locales (67 estáticos/5 condicionales),43 controladores,204 handlers,323 pares método/ruta y722 hashes productivos. Añade diez puertos internos, sin rutas nuevas:48 ejecutores totales (12 financieros,14 de Negocios y22 de Reservas). La familia de Reservas conserva44 operaciones nativas:21 lecturas publicadas,22 escritores individuales internos y1 recuperación del coordinador bajo actor original. [Entrega72](72-nodia-ai-ai26-rental-money-occupancy-preparation.md) distingue esos puertos de las67 capacidades/27 fragmentos publicados y de su aceptación pendiente con Gemini. Las cifras del párrafo siguiente son la línea base histórica de AI-25.

El cierre anterior corresponde a AI-18. El [snapshot actual](nodia-ai-current-endpoints.json) y su [reconciliador AI-25](../evidence/scripts/reconcile-nodia-ai-ai25.cjs) registran ahora70 módulos locales (65 de composición estática/5 condicionales),43 controladores,204 handlers,323 pares método/ruta y688 hashes de fuentes productivas. El contrato común conserva31 rutas de coordinación declaradas. AI-25 no añade controladores ni rutas: registra seis puertos internos que reutilizan casos de uso nativos de Reservas.

Los38 ejecutores internos —12 financieros,14 de Negocios,6 de configuración de Reservas y6 del ciclo comercial— son distintos del catálogo publicado de67 lecturas/referencias y27 fragmentos. [AI-25/71](71-nodia-ai-ai25-rental-reservation-lifecycle.md) separa implementación, pruebas, activación y los gates de publicación MCP/Gemini. Ningún número de este inventario estático certifica por sí solo autoridad, atomicidad, disponibilidad o inferencia.


### AI36-C03 — procedencia de análisis de factura

El [delta C03](../evidence/nodia-ai-ai36-c03-catalog-delta.json) reconcilia87 módulos/46 controladores/217 handlers/336 aliases/860 hashes TS, preservando los snapshots históricos y41 definiciones de coordinación. Se incorpora un módulo candidato de análisis en generación activa y una acreditación privada de adjuntos antes del dispatch; no se añade ningún handler/ruta Node, tabla o migración. El contrato puro privado Python constituye una ruta interna del microservicio existente y se documenta separadamente en [entrega82](82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c03--análisis-de-facturas-en-la-generación-activa). C01/C02 conservan77 preparadores candidatos y se agrega un analizador;67 lecturas publicadas/27 fragmentos no cambian. No se atribuyen publicación, inferencia real ni disponibilidad por existir un archivo de contrato.


### AI36-C04 — seis ayudantes comunes

[Entrega82](82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) registra los cuatro lectores y dos preparadores con contratos cerrados y puertos nativos. Dos módulos internos sin controladores añaden seis fuentes TS; los wrappers humanos conservan firmas y contratos, y sus puertos internos reutilizan el manager del gateway. No hay rutas, tablas o migraciones nuevas. Se mantiene el inventario de141 dominios y los67 bindings publicados; los seis ayudantes completan contratos candidatos, no amplían el catálogo operativo. El schema de publicación admite explícitamente las dos clases ya previstas, cambiando su huella sin nuevos bindings. [Delta C04](../evidence/nodia-ai-ai36-c04-catalog-delta.json) conserva metadatos históricos y todos los handlers/aliases anteriores.
