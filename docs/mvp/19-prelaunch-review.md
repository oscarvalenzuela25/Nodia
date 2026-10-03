# Revisión técnica previa al lanzamiento de Nodia

Fecha: 2026-10-02. Estado: **en revisión**. Alcance: `nodia-client`, `nodia-server`, `nodia-gemini-microservice` y sus contratos. El diagnóstico inicial corresponde al estado anterior a las correcciones. Los seguimientos finales registran las entregas locales de Client/Gemini y la revisión actualizada de Server del 2026-10-03; prevalecen sobre el diagnóstico histórico para su alcance. No aprueban el lanzamiento ni los documentos.

## Dictamen

**Con el alcance global confirmado por el usuario el 2026-10-03, recomiendo cerrar la integridad de las importaciones y validar en PostgreSQL/staging los cambios de consultas antes de publicar los flujos afectados. S-03 está corregido localmente por políticas explícitas y regresiones; ver el seguimiento Ransack al final.** La ausencia de permisos por acción en administración y de aislamiento entre negocios se considera intencional para su público específico; no se propone imponer esos controles como requisito de lanzamiento. El soporte dual de cuotas de IA todavía no está demostrado. El diagnóstico inicial encontró un reemplazo agéntico por Web; la corrección local de Gemini lo retiró y declara Antigravity no disponible hasta verificar una integración real. Server aún conserva selección y métricas inferidas que deben corregirse antes de presentar ambos motores como utilizables.

Hay una base aprovechable: autenticación global, refresh de sesión, límites distribuidos, token entre servicios, validación de archivos, persistencia atómica de cookies y pruebas de casos de uso. No propongo reemplazar el stack ni añadir microservicios. Las correcciones deben concentrarse en cerrar los contratos existentes y probar escenarios adversos.

Prioridades: **P0** impide exposición pública por seguridad; **P1** debe resolverse antes de lanzar el flujo afectado por integridad, disponibilidad o comportamiento incorrecto; **P2** admite trabajo posterior cuando no afecta un compromiso de la primera versión.

## Alcance y evidencia

Se revisaron las instrucciones, documentos del MVP, ADR relevantes, rutas, entidades, DTO, casos de uso, transporte HTTP, consultas, formularios, importaciones, adaptadores de IA, pruebas, dependencias y configuración local de despliegue. Los hallazgos describen el árbol de trabajo existente, con cambios sin commit. Se observaron modificaciones de archivos durante la revisión; los resultados siguientes corresponden a la última ejecución de cada comprobación, no a un commit congelado.

| Proyecto | Comprobación ejecutada | Resultado |
|---|---|---|
| Client | `npm run build` | Correcto en la última ejecución |
| Client | `npm run lint` | Falla: 6 errores y 11 advertencias |
| Client | Suite Vitest completa | 448 pruebas correctas, 67 archivos |
| Server | `npm run build` | Correcto |
| Server | `npm run lint` | Correcto, con 8 advertencias |
| Server | Suite unitaria | 236 pruebas correctas, 74 archivos |
| Gemini | `python -m unittest discover -s tests -p 'test_*.py' -q` usando `.venv` | 27 pruebas correctas; algunas conectaron realmente a Google |
| Gemini | `pip check` | Sin incompatibilidades declaradas; no equivale a auditoría de vulnerabilidades |
| Client / Server | `npm audit --omit=dev` | Avisos altos en Axios del cliente y en la cadena Nest platform-express/Multer del servidor |

La primera ejecución del cliente falló por una variable sin uso y una prueba de cancelación de login. Esos archivos cambiaron durante la revisión; al repetir, build y pruebas pasaron. El comportamiento de cancelación sigue teniendo una rama inalcanzable, descrita en C-07.

La suite Python no es completamente aislada: se observaron inicialización de cliente real, consulta de cuotas y persistencia de sesión. No se envió una factura real a propósito. No repetir esa suite contra credenciales operativas hasta corregir G-03.

No se ejecutaron migraciones sobre la base de datos existente ni ataques contra una API desplegada. La prueba de consultas generó SQL con TypeORM sin ejecutarlo. Quedan pendientes pruebas HTTP en un entorno aislado, navegador real, revisión visual móvil/accesibilidad, carga, restauración de backups y comprobaciones externas de VPS/Cloudflare/servicios gestionados. Por tanto, no se afirma una auditoría completa de infraestructura ni conformidad WCAG.

## Contradicciones documentales a reconciliar

- La política actual de `AGENTS.md` prohíbe todas las API keys. `00-progress.md`, los documentos de gestión de IA y partes del código aún contemplan keys y contingencias por API. Registrar la transición al soporte exclusivo Antigravity/Gemini Web antes de implementar cambios basados en esos documentos; conservar el historial de decisiones.
- `00-progress.md` declara eliminado el catálogo estático de modelos, pero `agentic_models.py` contiene una lista fija y Gemini mantiene fallbacks. También declara el foco OCR informativo, mientras el caso de uso lo usa para elegir el modelo de ejecución.
- El modelo histórico documenta bigint universal; negocios usa UUID. Reconciliar documentación y ADR con las entidades actuales. No migrar identificadores existentes solo para cumplir una frase histórica.
- La autorización para desarrollar sigue vigente. Esta revisión y sus propuestas no cambian el estado de aprobación de documentos del producto.

## Hallazgos en Nodia Server

### S-01 · P0 · Administración sin permisos por acción

`src/authorization/action-permission.guard.ts` permite la ruta cuando no tiene `RequireAction`. Los controladores de usuarios, roles, acciones, módulos y grupos no declaran esas acciones. `src/user/user.service.ts`, método `update`, acepta los roles enviados y reemplaza las asociaciones sin conocer al actor.

**Consecuencia:** un usuario autenticado activo puede acceder a operaciones administrativas sin que se compruebe su permiso. La combinación de listar roles y modificar sus propias asociaciones abre una vía de escalamiento a superadministrador. La ocultación de Settings en React no protege las rutas HTTP. La ruta se identifica en código; no se explotó contra una cuenta real.

**Acción:** definir la matriz ruta/acción, proteger todas las operaciones sensibles y autorizar al actor dentro de los casos de uso. Hacer explícitas las excepciones públicas o de usuario propio. Impedir que el rol reservado se asigne o modifique desde una operación general sin la autorización correspondiente. Validar con casos de uso usuario común/superadministrador, autoasignación y cambio de roles de terceros; complementar con una prueba HTTP aislada.

### S-02 · P0 · Recursos de negocios sin autorización por objeto

`src/business/business.controller.ts` sí transmite el actor y verifica pertenencia. Los controladores y servicios de proveedores, productos, movimientos y facturas no aplican uniformemente esa protección. El filtro `business_id` viene del solicitante; las búsquedas por ID, actualizaciones y exportaciones no establecen el ámbito autorizado. `GetInvoiceViewUrlUseCase` firma el archivo sin recibir al usuario. Los DTO de facturas también admiten `path_storage` enviado por el cliente.

**Consecuencia:** conocer un ID o modificar un filtro puede permitir leer/modificar información de otro negocio. Una ruta de almacenamiento manipulada puede solicitar la firma de un objeto ajeno dentro del almacenamiento configurado. La validación proveedor-negocio del análisis no comprueba que el usuario pertenezca al negocio.

**Acción:** centralizar la resolución de negocios autorizados y aplicar el ámbito en la consulta SQL, las mutaciones, las relaciones y las URLs firmadas. El servidor debe gestionar y validar la pertenencia de las claves R2. Comprobar proveedor/producto/factura del mismo negocio. Probar propietario, colaborador autorizado, colaborador de lectura, usuario externo y objetos de otro negocio, incluidas exportaciones y análisis.

### S-03 · P0 · Ordenamiento SQL sin lista de campos permitidos

`src/common/utils/ransack-query.builder.ts:18` concatena el campo de `q[s]` en `addOrderBy`. La dirección está normalizada, el campo no. Se reprodujo sin base de datos:

```text
Entrada: q[s] = "id,pg_sleep(5) desc"
SQL generado: SELECT * FROM "products" "product" ORDER BY product.id,pg_sleep(5) DESC
```

Esto confirma aceptación de expresiones SQL en un punto que debería admitir solo identificadores de columnas. No demuestra que ese ejemplo particular se ejecute correctamente en PostgreSQL ni se probó un ataque allí. Además, dividir por el último guion bajo interpreta `name_not_eq` como campo `name_not` y predicado `eq`, y `name_not_null` como `name_not IS NULL`.

**Acción:** usar una lista de campos/relaciones admitidos por recurso y direcciones enumeradas; resolver predicados por sufijo completo, incluyendo `not_eq` y `not_null`. Rechazar entradas desconocidas antes de construir SQL. Añadir regresiones desde los casos de uso de listado, comprobando ordenamientos válidos y rechazo de expresiones.

### S-04 · P1 · Cambios administrativos pueden bloquear el sistema

El PRD aprobado exige claves inmutables, protección de `super_admin` y al menos un superadministrador activo. `UpdateRoleDto` hereda los campos de creación, los servicios permiten cambiar `key`/`is_active` y la actualización de usuarios no garantiza conservar ese administrador. Usuarios y asociaciones se guardan en operaciones separadas.

**Acción:** DTO de actualización explícitos, reglas de rol reservado y transacción para usuario/roles/módulos. Serializar la comprobación del último superadministrador para que dos desactivaciones concurrentes no eliminen a ambos. Probar concurrencia y fallo al reemplazar asociaciones.

### S-05 · P1 · Importación de factura sin atomicidad ni idempotencia

`ProductInvoiceImport.handleSubmitAll` hace varias peticiones para productos existentes, productos nuevos y factura. `src/product/product.service.ts` guarda producto y movimiento separadamente. El archivo puede subirse a R2 antes de guardar la factura. No hay una operación única que asegure un resultado completo ni una clave persistida que evite duplicación al reintentar.

**Consecuencia:** si falla el último paso, los productos pueden haber cambiado sin factura; el reintento puede duplicar registros o movimientos. Dos importaciones simultáneas también pueden sobrescribir stock.

**Acción:** un caso de uso para confirmar la importación con transacción PostgreSQL, clave de idempotencia y restricción única. Definir si la cantidad recibida incrementa stock o reemplaza inventario: hoy el cliente manda el stock extraído como valor final. Resolver concurrencia de stock con bloqueo o versión. Tratar R2 con archivos temporales y compensación/limpieza; no puede participar en la transacción SQL. El análisis de Google debe finalizar antes de abrir esa transacción. Crear ADR para este contrato. Probar fallo a mitad, reintento y confirmaciones concurrentes.

### S-06 · P1 · Migraciones incompletas para instalación y actualización seguras

Las migraciones son incrementales: `1789257600000-AuthSessions.ts` supone tablas existentes. No se identificó un baseline reproducible del esquema inicial. `db.config.ts` activa `synchronize` en cualquier entorno distinto de `production`. `1790553700000-AddTokenPlanFlagsToCatalogAndProviders.ts` elimina `mode`, `key` y `fields_version` antes de convertir la configuración anterior, y agrega modos con API activada/Web desactivado por defecto. Una conexión Web previa puede perder su modo. La incorporación previa de `catalog_id` tampoco demuestra una conversión completa de los datos anteriores.

**Acción:** separar la instalación nueva de la actualización de una base existente; preservar y convertir datos antes de retirar columnas, incluidas conexiones/modelos. Desactivar sincronización fuera de desarrollo explícito. Probar migración sobre PostgreSQL vacío y copia anonimizada de datos anteriores, comparar contra las entidades y ensayar restauración. Un método `down` que recrea columnas vacías no recupera los datos eliminados. No ejecutar este proceso sobre producción para probarlo.

### S-07 · P1 · Selección de IA no respeta una configuración estricta

`src/invoice/use-case/analyze-invoice.use-case.ts` captura un proveedor explícito inexistente y elige otro; no rechaza uniformemente proveedor inactivo, modo deshabilitado o modelo sin asignar. El foco OCR puede sustituir al modelo seleccionado. `engine` y `mode` pueden contradecirse. El nivel de razonamiento persistido se calcula pero solo se transmite en ciertas ramas cuando viene también en el DTO. La validación de razonamiento acepta capacidad o permiso en lugar de requerir ambos.

**Acción:** un resolvedor tipado que produzca proveedor/instancia, motor, modo, modelo y capacidades válidos, o un error preciso. No sustituir decisiones explícitas del usuario por otra conexión. Exigir modelo configurado y aplicar `can_use_model`. Derivar capacidades del descubrimiento actual. Probar cada combinación inválida y comparar el resultado con `/verify-ia-providers`.

`get-selectable-models.use-case.ts` también usa valores como `48384` y «Ilimitado / Según plan» cuando no dispone de cuotas. Reemplazarlos por datos medidos o un estado desconocido; no presentar un límite artificial como capacidad contratada.

### S-08 · P1 · Superficie de API keys aún activa

Siguen registrados recursos de claves, opciones `use_api_key`, catálogo compatible y el servicio Mistral. El análisis conserva ramas para ese servicio y el cliente permite gestionar keys. La política actual no autoriza este camino.

**Acción:** inventariar consumidores y datos existentes; retirar de ejecución, rutas y UI el camino por keys y actualizar la documentación. Separar la retirada del código de la eliminación de datos cifrados existentes, que necesita una transición trazable. El reemplazo es el adaptador real de sesión agéntica, no otro proveedor con facturación por token.

### S-09 · P1 · Límites y procesamiento masivo insuficientes

`PaginationQueryDto` no tiene máximo de `limit`, `all=true` evita paginación, y varias entradas bulk no tienen límite de cantidad. Las actualizaciones masivas buscan registros individualmente y generan consultas por elemento. Las relaciones incluidas y el contexto de autorización también pueden multiplicar filas.

**Acción:** límites servidor para página, bulk e includes; comprobar permisos también en exportaciones; cargar conjuntos en una consulta y persistir en lotes transaccionales. Exportar con lectura acotada o streaming. Medir consultas y planes con datos representativos antes de añadir índices indiscriminadamente.

### S-10 · P1 · Dependencia vulnerable en carga multipart

La instalación contiene Multer `2.2.0`; `npm audit` reporta avisos altos en la cadena `@nestjs/platform-express`/Multer. Los avisos incluyen [denegación de servicio mediante nombres de campo](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm) y [archivos huérfanos en cargas abortadas](https://github.com/advisories/GHSA-3pph-fpjx-jg34). Son la misma cadena de dependencia, no dos problemas independientes de autorización.

**Acción:** actualizar a versiones corregidas y compatibles verificadas en el lockfile. El aviso de archivos huérfanos indica corrección en `2.4.0`; comprobar todas las entradas del audit, no solo una. Revisar el interceptor usado, límites totales, memoria y abortos. No se comprobó explotación contra este servidor.

### S-11 · P2 · Contratos y operaciones que parecen exitosas sin serlo

- `CreateInvoiceDto` convierte ciertos JSON inválidos en `{}` y números inválidos en `0`; el contenido OCR queda poco tipado. Se oculta un error de entrada como dato válido. Definir contratos finitos y límites para cantidades/importes; preservar desconocidos para revisión manual.
- Crear usuarios o algunos catálogos con una clave/email existente puede actualizar el registro existente. Separar creación, conflicto y upsert explícito para evitar sobrescrituras inesperadas.
- Los `DELETE` de roles/acciones/módulos llegan a métodos plantilla que devuelven texto sin persistir la eliminación. Retirar rutas no soportadas o implementar el cambio autorizado con caso de uso.
- `TranslationService` retorna ante una lista vacía, por lo que borrar traducciones no tiene la misma semántica que editar; también hace operaciones individuales fuera de la transacción principal. Definir vaciar, conservar y reemplazar de manera explícita.
- Al modificar email, `UserService.update` pierde el valor anterior antes de invalidar el contexto Redis. Guardar email anterior y revocar ambas entradas. No confiar en un contexto cacheado para permitir acciones; el guard de acciones actual consulta sus permisos por separado.

## Hallazgos en Nodia Client

### C-01 · P1 · Lint falla pese a compilar y pasar tests

La última ejecución encuentra dos actualizaciones de estado en efectos y dos `any` en `ProductInvoiceImport.tsx`, además de `prefer-const` en `AiProviders.tsx` y `ProviderDetail.tsx`. Hay 11 advertencias adicionales, incluidas dependencias inestables y `watch` de React Hook Form incompatible con memoización del compilador.

**Acción:** resolver la selección derivada de proveedor/modo sin efectos que se realimenten, tipar respuestas de análisis y corregir las declaraciones. Atender advertencias funcionales antes de silenciar reglas. Usar `useWatch` donde corresponda. Exigir build, lint y tests del mismo commit.

### C-02 · P1 · Totales del negocio calculados sobre una página

`OverviewTab.tsx:62`, `:70` y `:78` solicitan hasta 50 productos/proveedores/facturas; después calculan distribución de stock, proveedores activos/inactivos, valorización y acumulados sobre esos arrays. El total de productos sí aprovecha `meta.total_items`, pero los agregados restantes no cubren el negocio completo cuando se supera ese volumen.

**Acción:** endpoint de agregados autorizado por negocio y período. No solucionar con `all=true` y cálculo en navegador. Probar más de 50 registros y límites de mes/fecha.

### C-03 · P1 · Facturas posteriores a las primeras 100 quedan inaccesibles

`InvoicesTab.tsx:229` pide `limit: 100` sin controles para pasar a otra página. Algunos selectores relacionados repiten el límite. Filtrar los datos cargados no equivale a buscar en todo el negocio.

**Acción:** paginación y búsqueda en servidor, usando `meta.total` y filtros persistentes. Selectores con búsqueda paginada o consulta puntual por ID. Probar más de 100 facturas, página vacía y cambio de filtro.

### C-04 · P1 · Errores de consulta se muestran como ausencia de datos

Varios tabs de negocio y consultas de IA consumen `data ?? []` sin representar `isError`. No hay una política global uniforme de toast para fallos de consultas; el transporte normaliza errores pero eso no genera el feedback requerido. `BusinessDetail` sí tiene un error visual para su consulta principal: el problema es la falta de consistencia en los datos secundarios.

**Acción:** toast deduplicado de errores HTTP en consultas, excluyendo cancelaciones intencionales, y estado de error con reintento en cada bloque informativo. Conservar datos en refetch fallido y distinguir carga inicial de revalidación. Los formularios deben preservar valores y cerrar solo tras éxito; hay implementaciones correctas que se pueden reutilizar.

### C-05 · P1 · Instancias de IA identificadas por la clave del catálogo

`ProductInvoiceImport.tsx:221` usa `p.key` como valor de opción y busca el primer proveedor coincidente. Dos conexiones Gemini comparten clave; elegir la segunda puede ejecutar con la primera. Algunas asociaciones de estado en Settings también recurren a la clave como alternativa al ID.

**Acción:** usar el ID persistido de instancia en selección, caché, salud y mutaciones. La clave de catálogo solo identifica el tipo de proveedor. Probar dos conexiones del mismo catálogo con distintos modelos/modos.

### C-06 · P1 · Acciones del detalle no reflejan permisos del colaborador

El detalle de negocio expone acciones y tabs sin aplicar de forma uniforme `user_role`/`user_action_ids`. La vista de lista sí tiene algunas restricciones por propietario. El contrato fino no se consume consistentemente en el detalle.

**Acción:** resolver primero S-01/S-02; luego compartir una política tipada de capacidades para mostrar/habilitar acciones. Probar propietario, colaborador de lectura y colaborador con edición. Esta UI complementa la protección del servidor.

### C-07 · P2 · Cancelación de login local inalcanzable

`RemoteLoginModal.tsx:37` incluye `isRunning` en `isActionBlocked`. `handleClose` retorna si está bloqueado y después intenta cancelar cuando `isRunning` es verdadero: esa rama no se alcanza. El botón llamado Cancelar permanece deshabilitado. La prueba actual comprueba ese bloqueo, no una cancelación efectiva.

**Acción:** diferenciar una petición de inicio/cancelación en vuelo del trabajo prolongado que ya se inició. Permitir solicitar cancelación de ese trabajo con feedback y mantener el modal si falla. Si el producto decide no ofrecer cancelación, retirar botón, código y contrato engañosos de forma coherente. No extrapolar esta corrección al login gráfico del VPS, que sigue pendiente.

### C-08 · P2 · Validaciones, accesibilidad y tamaño de componentes

Hay mensajes de validación hardcodeados en español en helpers de importación, textos de alertas en `AiProviders.tsx` y etiquetas como `aria-label="close"`. `BaseModal` ignora su parámetro `disableEscapeKeyDown`; revisar la política de cierre por teclado y la preservación de formularios. Los indicadores deben representar datos medidos o desconocido, conforme a S-07/G-01.

`ProductInvoiceImport` supera 1.600 líneas y la gestión de proveedores mezcla mucha configuración, salud y estado de formularios. Dividir después de fijar el contrato: hooks de datos, máquina de estados de importación, formularios y resolvedores puros. Evitar una reescritura amplia antes del lanzamiento. Medir carga de rutas y fuentes: el build emite muchas variantes tipográficas y chunks grandes; reducir imports solo después de comprobar uso y efecto en red real.

Actualizar Axios según el audit. El [aviso sobre opciones heredadas de FormData](https://github.com/advisories/GHSA-x97p-jq2g-jp4f) afecta escenarios Node con contaminación previa de prototipos; no demuestra por sí mismo explotación de la SPA. Verificar aplicabilidad de cada aviso y versión corregida, sin confundir dependencia marcada con exploit demostrado.

## Hallazgos en Gemini Microservice

### G-01 · P1 · El motor agéntico usa Web como reemplazo

`agentic_service.py:is_available` considera disponible el motor por marcadores de entorno, directorio local, cliente Web inicializado o API key. `get_status` deriva `has_active_session` de ese resultado sin validar una sesión agéntica. El SDK se ejecuta en la rama con API key; sin ella, `analyze_invoice` delega en `gemini_web_service`. `main.py:/agentic/status` consulta la cuota del cliente Web para exponer cifras del motor agéntico.

**Consecuencia:** no existe evidencia de consumo independiente de la cuota Antigravity de la sesión activa. El sistema puede declarar dos motores disponibles cuando ambos consumen el mismo camino Web. Un marcador de entorno tampoco garantiza que se pueda inferir.

**Acción:** verificar e implementar un adaptador real de la sesión Antigravity permitida, con descubrimiento, estado y cuotas independientes; retirar el camino por API key. Hasta demostrarlo, declarar el motor no disponible y no sustituirlo silenciosamente por Web. La viabilidad concreta en VPS queda pendiente de una prueba operativa; esta revisión no la inventa. Documentar la decisión de integración mediante ADR.

### G-02 · P1 · Modelos estáticos y sustituciones silenciosas

`agentic_models.py` contiene una lista fija presentada como oficial. `GeminiWebService` usa un nombre estático al faltar configuración. La generación busca coincidencia exacta y después heurísticas por `pro`/`lite`/`flash`. Ante `except (ModelInvalidError, Exception)` reintenta con modelo por defecto: el bloque captura también errores de cuota, timeout y fallos de proveedor.

**Acción:** resolución exacta desde configuración persistida y descubrimiento activo. Si falta asignación, informar y rechazar procesamiento según el contrato Nodia. Eliminar catálogos artificiales y heurísticas. Tipar errores; no cambiar modelo ni motor al reintentar, y no reintentar automáticamente una cuota agotada. Probar modelo retirado, desconocido, sin asignar, timeout y cuota, contando invocaciones.

### G-03 · P1 · Tests unitarios consumen sesión real

`tests/test_dual_engine.py` importa `main` y llama a estado/modelos sin sustituir todos los servicios reales. La ejecución de revisión conectó con Google. Además, las pruebas afirman nombres concretos de la lista estática y una delegación a Web como éxito del motor agéntico; protegen comportamientos que contradicen la política actual.

**Acción:** configurar el entorno de tests antes de importar la aplicación, usar servicios simulados y directorios temporales, y prohibir red por defecto. Separar integración real como ejecución voluntaria con una sesión de prueba. Las pruebas deben validar el contrato y el motor utilizado, no la mera forma del JSON.

### G-04 · P1 · Límites de análisis no acotan toda la carga de entrada

`main.py` valida `Content-Length` si existe y limita la lectura de archivo, pero Starlette ya puede haber procesado/spooleado el multipart antes de ejecutar la ruta. La carga sin esa cabecera no queda cubierta por el chequeo inicial. El semáforo de dos análisis se aplica después de recibir/escribir el archivo; no limita cuántas cargas pueden ocupar disco simultáneamente.

**Acción:** límite efectivo de bytes del cuerpo antes del parser, límites en proxy/ASGI y admisión acotada de cargas/trabajos. Definir respuesta de saturación con `Retry-After`, limpiar temporales abandonados y probar abortos/cuerpos fragmentados. Mantener límites de archivo y timeout existentes como capas adicionales.

### G-05 · P1 · Operación de sesión y errores sin prueba suficiente

El login con navegador local se controla desde Nest solo en desarrollo. No hay verificación del ciclo completo de login/renovación/recuperación en VPS. Python expone en algunas respuestas `str(error)` y texto de rechazos del modelo. Nest convierte parte de `429`/timeouts a `503`, perdiendo distinciones necesarias para reintentar.

**Acción:** runbook operativo de acceso privado, reinicio frío, expiración, renovación y restauración de volúmenes. Probar todo mediante Nodia Server; conservar FastAPI privado según ADR-007/008. Devolver errores estables sin texto bruto, conservar semántica 429/503/504 y plazo de reintento. Añadir ID de solicitud y métricas de duración, cola, autenticación, cuota y errores por motor sin registrar cookies ni OCR completo.

### G-06 · P2 · Parser duplicado, cuotas costosas y escalado implícito

`gemini_service.py` e `invoice_parser.py` duplican prompts, normalización y detección de rechazo; cambios en una rama pueden no llegar a la otra. La salida de análisis no tiene un contrato tan estricto como salud/estado; ciertos faltantes se convierten en cero y el cliente puede convertir cantidad cero en uno.

Centralizar parser/prompt y validar con Pydantic números finitos, rangos y campos necesarios; mostrar incertidumbre para revisión humana. Probar JSON incompleto, no numéricos, montos inválidos y listas corruptas. Reutilizar una lectura de cuota por sesión con caché corta y control de consultas concurrentes; no consultar el mismo servicio repetidamente por cada conexión configurada.

La sesión, locks y semáforo son locales al proceso. Declarar despliegue de un solo worker para v1, configurar usuario del contenedor y límites de memoria/disco/CPU, y comprobar cierre ordenado. Varios workers compartiendo perfil/cookies requieren coordinación externa antes de habilitar ese escalado.

## Limpieza propuesta

Son candidatos, no una orden de borrado automático. Verificar referencias en código, pruebas, scripts, documentación y generación antes de retirar cada uno.

| Proyecto | Candidato | Tratamiento |
|---|---|---|
| Client | `src/modules/auth/pages/Register/` y `useRegister` | No aparece conectado al router; conserva flujo de registro/demo ajeno al login actual. Retirar junto con tests/traducciones exclusivas si se confirma fuera del alcance |
| Client | Reexport antiguo `src/layouts/components/LanguageSelector/index.ts` | Retirar si no hay consumidor; conservar el selector compartido que sí se utiliza |
| Server | `@google/genai` | Sin import de ejecución encontrado en `src`; comprobar scripts/transitivos antes de eliminar dependencia |
| Server | DTO/types de traducciones sin consumidor y métodos sin llamadas como `RedisService.flushAll`, `canAnalyzeInvoice` | Verificar grafo y retirar piezas sin contrato público; revisar especialmente el borrado global de caché |
| Server | Métodos `remove` plantilla | Retirar junto con rutas no soportadas o sustituir por implementación real; no mantener una respuesta ficticia de éxito |
| Gemini | `generate_text` sin consumidor y código de parser/prompt duplicado | Retirar superficie sin uso y consolidar la lógica compartida que sí está en ejecución |
| Gemini | Lista fija `ANTIGRAVITY_SUPPORTED_MODELS` y tests asociados | Sustituir por descubrimiento comprobado; no reemplazar por otra lista estática |
| Compartido | Ramas/configuración API keys y Mistral, README plantilla, `dbml-error.log`, descripción raíz de servicios «futuros» | Retirada por etapas tras inventario y actualización documental; no borrar datos históricos ni migraciones necesarias |

No clasificar como sobrantes dependencias de peers como Emotion/reflect-metadata, migraciones históricas, entidades con registro implícito ni archivos de sesión por ausencia de import directo.

## Plan de acción por proyecto

### Nodia Server

Secuencia vigente tras la revisión del 2026-10-03. Los pasos siguientes **están pendientes de implementación**, salvo las skills y documentación descritas al final. Cada paso debe dejar regresiones de casos de uso y checks pertinentes; build/tests verdes no cierran automáticamente un hallazgo. **Aclaración posterior del usuario (2026-10-03): no implementar los controles por acción/negocio de los pasos 1 y 2; el acceso global a administración y a productos/facturas/archivos de otros negocios es intencional.** Esos pasos se conservan como historial; separar sus invariantes de integridad de la política de acceso que se deja sin cambios.

1. **P0 · Cerrar permisos administrativos (S-01) y blindar privilegios (S-04).** Inventariar método/ruta/aliases y política; exigir acción en usuarios, roles, módulos/grupos, acciones y demás administración. Transmitir actor al caso de uso, impedir asignación indebida de privilegios, proteger claves/rol reservado y último superadministrador. **Aceptación:** usuario común no administra ni se eleva; operaciones legítimas siguen funcionando; dos cambios concurrentes no dejan cero administradores. Verificar reglas reales, no un mock que acepta todo.
2. **P0 · Aislar negocios y archivos (S-02).** Introducir contexto autenticado y alcance uniforme en productos, proveedores, movimientos, facturas, exports, análisis y firma R2. Comprobar asociaciones del mismo negocio y gestionar rutas de almacenamiento desde servidor. **Aceptación:** propietario/colaborador con acción permitida accede; usuario externo y colaborador sin acción no leen, modifican ni firman objetos ajenos, aunque manipulen IDs/filtros.
3. **P0/P1 · Cerrar SQL dinámico y cargas ilimitadas (S-03/S-09).** Mapear campos/relaciones por recurso, reconocer sufijos completos y rechazar expresiones; acotar `limit`, `all`, arrays bulk y exportaciones. Revisar N+1 y añadir agregados autorizados donde los requiera Client. **Aceptación:** SQL no incorpora identificadores arbitrarios; `not_eq`/`not_null` correctos; tamaños fuera de contrato se rechazan y más de una página sigue siendo accesible sin descargar todo.
4. **P1 · Recuperar integridad de comandos/importaciones (S-05/S-11/S-12).** DTOs concretos y estrictos para body/query/params, comando compuesto validado, contenido de factura tipado y entradas inválidas rechazadas. Separar crear/conflicto/upsert y omitir/vaciar/reemplazar. Definir stock/idempotencia en ADR cuando corresponda; implementar confirmación única con transacción compartida para productos, movimientos, asociaciones y factura, más staging/compensación recuperable de R2. **Aceptación:** JSON roto o importe inválido nunca se vuelve `{}`/`0`; fallo del segundo paso no deja estado parcial local; reintento concurrente o respuesta perdida produce un resultado recuperable, sin duplicación.
5. **P1 · Hacer reproducible instalación y actualización (S-06).** Verificar baseline desde DB vacía; convertir datos previos antes de eliminar columnas, revisar defaults y desactivar sincronización automática sobre estado persistente. Ensayar migración/restauración aisladas y coordinación de versiones. **Aceptación:** instalación nueva y actualización conservan configuraciones/datos; rollback o restauración tiene evidencia. No ejecutar migraciones sobre cuentas/DB reales como parte del desarrollo.
6. **P1 · Alinear Server con Client y Gemini (S-07/S-08).** Resolver conexión por ID, modo habilitado y modelo exacto; rechazar proveedor explícito inexistente, engine/mode contradictorios y falta de configuración. Retirar ejecución/contratos de API keys y Mistral por etapas, conservando datos históricos necesarios. Conservar capacidades/cuotas desconocidas y Antigravity no disponible hasta integración real; no elegir primer modelo ni fabricar métricas. **Aceptación:** configuración seleccionada atraviesa todas las capas sin sustituciones, nombres o cuotas inventadas; contrato con Web/Antigravity probado sin llamadas reales en unit tests.
7. **P1/P2 · Dependencias, respuesta segura y limpieza (S-10/S-11/S-13).** Actualizar la cadena Nest/Express/Multer a versiones compatibles corregidas, validar multipart/abortos y auditar lockfile. Proyectar respuestas públicas, separar secretos de JSON configurable y sanear errores R2/SDK. Implementar o retirar rutas DELETE de plantilla; revisar `@google/genai`, helpers/DTO sin consumidores e invalidación Redis por email anterior/nuevo. **Aceptación:** audit de producción sin avisos conocidos de la cadena afectada; marcadores sensibles anidados no salen; ninguna ruta responde éxito ficticio y consumidores legítimos se conservan.
8. **P1/P2 · Calidad de evidencia y salida operativa (S-14).** Mover reglas de aplicación a casos de uso comprobables, cubrir escenarios anteriores e integración aislada para locks/constraints/DI/HTTP cuando los mocks no basten. Validar configuración, TLS de DB/Redis, deadlines/cierre de clientes, liveness/readiness, límites de memoria/concurrencia, imagen y pipeline pertinente. **Aceptación:** build/lint/tests y contrato compilado correctos; revocación, fallos, restauración y exposición privada/pública comprobados en staging. El paso operativo no se declara cerrado con un proceso local ni con esta auditoría.

### Gemini Microservice

Secuencia concretada el **2026-10-03**, en revisión. La implementación autorizada posteriormente se registra en «Seguimiento de implementación de Gemini» al final de este documento. Se mantiene aquí para evitar otro documento temporal; las pruebas posteriores usan el aislamiento descrito en ese seguimiento.

1. **Aislar pruebas e inicialización (G-03, P1).** Preparar configuración de prueba antes de importar la aplicación, sustituir clientes Google/Playwright y usar directorios temporales. Evitar que importar módulos inicialice sesiones o escriba en directorios operativos; introducir inyección de servicios o una fábrica de aplicación donde haga falta. Mantener `unittest`, bloquear conexiones externas por defecto y separar la integración real como ejecución explícita con sesión de prueba. **Cierre:** la suite completa funciona sin Google, Chrome, cookies reales ni cambios en perfiles/sesiones operativas; comprueba que los adaptadores simulados reciben las llamadas esperadas.

2. **Corregir la identidad de los motores (G-01, P1).** Retirar la ejecución por API key y la delegación agéntica a Web. No deducir autenticación de una variable, un directorio o un cliente Web inicializado. Separar estado, modelos y cuotas por motor; los datos no comprobados se declaran desconocidos. Primero aplicar este comportamiento seguro y después comprobar la viabilidad de un adaptador de sesión Antigravity sin keys, localmente y en VPS, documentando las alternativas en un ADR. **Cierre:** una solicitud agéntica utiliza realmente Antigravity o recibe indisponibilidad explícita; nunca consume Web a escondidas. La compatibilidad del SDK y la disponibilidad de cuotas agénticas siguen pendientes de evidencia, y no bloquean las correcciones locales posteriores.

3. **Resolver exactamente el modelo configurado (G-02, P1).** Eliminar la lista fija, los nombres de respaldo y las coincidencias por `pro`/`flash`/`lite`. Alinear el modelo recibido de Nodia Server con el descubrimiento del motor elegido y sus capacidades reportadas. Rechazar ausencia de asignación, modelos retirados o incompatibles, sin sustituir modelo ni motor. **Cierre:** pruebas de modelo ausente/desconocido/retirado y de cuota agotada verifican el error y el número de invocaciones; una cuota agotada no causa otra ejecución automática.

4. **Unificar extracción y validar el contrato (G-06, P1).** Compartir prompt, parser y detección de rechazos entre los adaptadores; definir respuesta de análisis con Pydantic y contrastarla con DTOs/casos de uso de Server y revisión del borrador en Client. Distinguir faltantes, `null` y cero; rechazar números no finitos, rangos inválidos y estructuras corruptas. Los campos legítimamente incompletos deben quedar señalados para revisión según el contrato, sin inventar valores. **Cierre:** JSON incompleto, cantidades cero, importes inválidos y listas corruptas tienen resultados explícitos y coherentes en ambos motores.

5. **Estabilizar errores y recuperación (G-02/G-05, P1).** Devolver códigos estables y un ID de solicitud, sin `str(error)` ni respuesta/OCR bruto. Distinguir saturación/cuota, indisponibilidad y timeout; coordinar con Server la conservación de `429`, `503`, `504` y `Retry-After`. Acotar recuperación de autenticación y reintentos a casos seguros, conservando motor/modelo. Verificar liberación de clientes, locks y trabajos de login al fallar o cancelar. **Cierre:** las pruebas de fallos conservan su causa, no duplican análisis y dejan recursos reutilizables; ninguna respuesta o registro expone cookies o documentos completos.

6. **Acotar cargas y trabajo simultáneo (G-04, P1).** Limitar bytes reales del cuerpo antes del parser multipart, incluso sin `Content-Length`, y aplicar límites complementarios en el proxy. Acotar archivos/partes, cargas admitidas, análisis y espera antes de ocupar temporales; configurar límites según los recursos del host. Mantener validación de firma, límite de archivo y timeout existentes. **Cierre:** cuerpos fragmentados, archivos inválidos, saturación, desconexiones y timeouts respetan los límites, limpian temporales y liberan los cupos; la saturación informa cuándo reintentar.

7. **Reducir consultas y retirar superficie sin uso (G-06, P2).** Conservar la caché de cuotas de TTL corto ya existente y compartir una consulta concurrente por motor/sesión; invalidarla al cambiar de sesión e indicar origen/antigüedad de los datos. Auditar consumidores antes de retirar `generate_text`, parser duplicado, configuración de keys y dependencias obsoletas. Actualizar README/plantilla de configuración y comprobar consistencia y vulnerabilidades de dependencias por separado. **Cierre:** consultas simultáneas comparten la lectura de cuota, un cambio de sesión descarta su caché y no quedan referencias rotas ni políticas antiguas en documentación. No borrar perfiles, cookies ni volúmenes por considerarlos archivos sin uso.

8. **Cerrar operación privada en VPS (G-05/G-06, P1).** Declarar un solo worker mientras perfil, locks, caché y semáforos sean locales al proceso. Ajustar usuario/permisos y límites de CPU, memoria y almacenamiento del contenedor. Mantener token exclusivo de Server y red privada; comprobar autenticación de todas las rutas sensibles. Documentar y ensayar login/renovación, arranque sin sesión, reinicio frío, expiración, restauración y cierre ordenado, con métricas mínimas por motor. **Cierre:** desde Internet no se accede a FastAPI; sin token las rutas privadas rechazan la llamada; Server funciona con identidad válida y existe evidencia de recuperación de sesión. El login remoto del VPS continúa pendiente hasta implementar y probar su procedimiento privado.

**Dependencias y puerta de salida:** ejecutar primero el aislamiento; después avanzar en orden, dejando la prueba operativa Antigravity claramente pendiente si no puede realizarse aún. Coordinar los pasos 2–5 con S-07/S-08 y los contratos de análisis/errores de Server; la autorización de usuarios y negocios sigue siendo responsabilidad de Server. Antes de publicar, cerrar los P1 del alcance, probar operación privada y registrar la evidencia. No declarar completado el soporte dual sin demostrar un adaptador Antigravity real; no sustituirlo por API keys, Web ni modelos artificiales.

### Nodia Client

1. **Dejar verificación estable (C-01).** Corregir lint y fijar un commit para build/tests. Entrega: cero errores sin desactivar reglas para ocultarlos.
2. **Aplicar contratos de seguridad e IA (C-05/C-06).** Capacidades por acción, ID de instancia, modelo asignado y estado real de cada motor, tras S-01/S-02/S-07/G-01. Entrega: dos conexiones Gemini se distinguen y un colaborador solo ve acciones permitidas.
3. **Integrar confirmación única de importación (S-05).** Enviar intención/elementos revisados y clave de idempotencia al nuevo caso de uso, sin coordinar varias escrituras desde React. Entrega: error conserva formulario y reintento no duplica ni pierde stock.
4. **Corregir tablas y métricas (C-02/C-03).** Consumir agregados y paginación servidor. Entrega: negocio con más de 50 productos/100 facturas mantiene totales y acceso completos.
5. **Uniformar feedback y recuperación (C-04/C-07/C-08).** Toast es/en, error visual con reintento, carga inicial/soft loading, cancelación de trabajo, teclado y datos preservados. Entrega: simular 403, 429, timeout y refetch fallido en componentes de valor.
6. **Reducir superficie y verificar navegador.** Retirar registro/demo y reexports confirmados, actualizar Axios, dividir componentes con contratos ya estables; pruebas manuales móvil/escritorio, claro/oscuro, teclado y dominio real de producción para login/refresh/logout. Evaluar rendimiento con medidas, no por tamaño de archivo solamente.

## Orden global de ejecución y salida a producción

1. Congelar un commit de trabajo, registrar hallazgos como tickets y reconciliar las contradicciones de IA sin aprobar automáticamente documentos.
2. Resolver P0 del servidor. Los arreglos visuales o los tests actuales no compensan estos huecos.
3. En paralelo técnico entre proyectos, cerrar integridad de importación/migraciones y comprobar el adaptador agéntico. Las integraciones del cliente dependen de sus contratos definitivos.
4. Completar límites, dependencias y feedback; desplegar en staging con datos sintéticos representativos y los dominios previstos.
5. Ensayar como mínimo: acceso por roles y negocios; importación fallida/reintentada/concurrente; modelos retirados y cuotas agotadas; >100 registros; renovación/cancelación de sesión; caída de Redis/Google; migración y restauración.
6. Ejecutar el runbook existente: comprobar desde fuera que Gemini/DB/Redis no están expuestos, verificar proxy/CORS/cookies/headers de Cloudflare, TLS y secretos por servicio. Los headers de `vite.server` solo cubren desarrollo y no prueban los headers de Pages. El `build` de la raíz solo ejecuta Client; el pipeline debe incluir Server y Python explícitamente.
7. Publicar cuando P0 y P1 del alcance lanzado estén cerrados con evidencia, backup restaurable y un procedimiento de reversión. Registrar P2 como backlog ordenado; no retrasar v1 por una reescritura estética ni declarar verificados los controles externos sin ejecutarlos.

Las mejoras centrales son control de acceso, integridad y operación de IA verificable. La limpieza debe seguir esos contratos para retirar código que ya no corresponde al producto, sin eliminar piezas utilizadas por una migración o recuperación.


## Seguimiento de implementación de Client — 2026-10-02

El usuario autorizó ejecutar las mejoras por etapas y retirar el documento temporal del plan al terminar. Se implementaron las correcciones disponibles con los contratos actuales de Client. No se modificó código de Server/Gemini en esta entrega, no se ejecutaron migraciones ni se desplegó. Se conservaron los cambios de trabajo existentes, incluidos los previamente staged; la entrega continúa sin commit.

| Etapa | Resultado de esta entrega | Pendiente de cierre |
|---|---|---|
| 1. Tipado y verificación | Selección de IA derivada, helpers tipados, dependencias estables y corrección de lint; respuestas de extracción y campos numéricos validados | Ninguno para los checks locales ejecutados |
| 2. Identidad y configuración IA | Selección, detalle y asociación de salud por ID de instancia; configuración aislada por modo; modelo ausente bloquea análisis; razonamiento por capacidades descubiertas; motor desconocido no se presenta operativo; cuotas solo si fueron reportadas | S-07/S-08/G-01/G-02: ejecución agéntica real, disponibilidad/cuotas fiables y validación definitiva de modelos |
| 3. Errores, carga y formularios | QueryCache con toast deduplicado, incluyendo errores de auth propagados; cancelaciones intencionales sin error; panel de fallo con reintento; datos visibles en refetch; formularios de conexión compartidos; guardado fallido conserva modal/datos; login remoto permite cancelar y reintentar una cancelación fallida | Prueba integrada de fallos de red/autenticación en staging |
| 4. Permisos y paginación | Edición del negocio y gestión de colaboradores restringidas al contexto propietario; facturas con page/limit/total y ajuste de página; selectores remotos de proveedores/códigos con debounce, páginas de 50 y conservación de seleccionados | S-01/S-02: matriz dinámica de acciones por negocio y autorización HTTP; ocultar controles no cierra seguridad |
| 5. Totales | Overview deja de presentar inventario, stock y facturación calculados sobre una primera página incompleta como totales; avisa y oculta esos indicadores | S-09/C-03: endpoint de agregados y definición de fecha/zona horaria; los indicadores globales permanecen pendientes |
| 6. Importaciones | Cantidad cero preservada; faltantes/NaN/Infinity/negativos requieren revisión; impuesto real del proveedor, incluidos precios netos/brutos derivados y tasa cero; códigos duplicados bloquean confirmación; total inválido no se envía; preparación y guardado bloquean envíos simultáneos | S-05: confirmación transaccional, idempotencia y regla de stock. La creación de factura y los bulk siguen siendo peticiones separadas y pueden dejar resultados parciales. El catálogo completo y el historial aún usan all=true: se requiere búsqueda por conjuntos con códigos normalizados y último registro por producto |
| 7. Limpieza y mantenimiento | Retirados Register/useRegister sin ruta, sus pruebas/traducciones exclusivas, reexport antiguo de LanguageSelector, modales/hooks/servicios de escritura de API keys y estilos sin consumidores. Formularios de conexión unificados y lógica pura de selección/validación separada. Axios 1.20.0 y dependencias transitivas de herramientas corregidas con lockfile | Se conservan campos/tipos de lectura históricos de API keys mientras Server migra sus respuestas y datos; no hay controles para crear ni usar keys. Optimización adicional de bundle/fuentes se evaluará con datos de carga en staging |
| 8. Interacción y entrega | Navegador local: portada a 390/768/1440 px y login móvil sin desbordamiento horizontal; navegación al login y acceso directo a ajustes IA sin sesión redirigido al login. Teclado/cierre de BaseModal y feedback es/en cubiertos por pruebas | Login/refresh/logout con dominios reales, CORS/cookies/headers, sesiones Google, verificación completa de pantallas autenticadas y temas en staging; no se consumieron cuotas Google desde tests |

### Evidencia de cierre local

- `npm run lint`: correcto, sin errores ni advertencias.
- `npm run build`: correcto; incluye `tsc -b` y bundle de producción.
- `npm test`: **454 pruebas correctas, 70 archivos, cero fallos**. Se actualizaron casos obsoletos de API keys y disponibilidad implícita. Regresiones de valor: dos instancias Gemini, configuración por modo, motor desconocido, cuotas ausentes, guardado fallido, cancelación fallida/reintento, refetch fallido con datos conservados y un único toast, paginación con 151 facturas, indicadores con más de 50 registros y extracción inválida/duplicada.
- `npm audit`: **0 vulnerabilidades**, incluyendo dependencias de desarrollo. Axios 1.20.0; actualizaciones compatibles de `@humanfs/node`, `brace-expansion` y `undici`, sin actualizar todo el stack.
- Navegador de desarrollo: Google Identity Services emitió avisos de inicialización repetida durante recargas HMR/remontajes de login. No se confirmó una falla de autenticación ni se verificó ese comportamiento en producción; revisar el flujo real en staging.
- Medición del build: entrada principal ~339 kB (~109 kB gzip), chunk de transporte/dependencias ~408 kB (~127 kB gzip), detalle de negocio ~215 kB (~57 kB gzip) y ajustes IA ~109 kB (~28 kB gzip). Se conserva la carga diferida existente. Estas cifras son tamaños de artefactos y no tiempos de carga ni consumo de red medidos en producción.

**La entrega no cierra los P0 de Server ni garantiza atomicidad de importación o soporte dual real de IA.** Los siguientes trabajos requieren los contratos y verificaciones indicados arriba. El documento temporal del plan se eliminó a petición del usuario; este seguimiento mantiene los hechos y dependencias sin crear un plan nuevo ni aprobar automáticamente etapas.

## Seguimiento de implementación de Gemini — 2026-10-03

El usuario autorizó implementar la secuencia. Se realizaron las correcciones locales y los ajustes de contrato necesarios en Server/Client, preservando el trabajo previo. No se ejecutaron migraciones, despliegues ni inferencias con cuenta real; no se modificaron cookies, perfiles ni volúmenes operativos. No se creó otro documento temporal del plan. ADR-009 sigue **propuesto**, sin aprobación documental automática.

| Paso | Implementado y verificado localmente | Pendiente de cierre |
|---|---|---|
| 1. Aislamiento | Fábrica de aplicación, inicialización en lifespan, inyección de servicios; runner instala bloqueo de red/Google/Playwright y directorios temporales antes de descubrir pruebas | Integración real separada de la suite |
| 2. Motores | Retirada de SDK/ramas de API key, catálogo fijo y delegación a Web; estado/modelos/cuotas agénticos desconocidos y análisis 503 explícito | Adaptador Antigravity real sin keys, descubrimiento y cuota observada. Usuario confirmó app de escritorio; hay instalación local, pero eso no valida su sesión ni un protocolo de inferencia |
| 3. Modelo | Modelo explícito y resolución exacta contra catálogo vivo; recuperación de autenticación conserva el mismo ID; no heurísticas ni capacidades inventadas | Sincronizar las configuraciones existentes. SDK Web actual no informa capacidades de razonamiento; se rechazan opciones no verificadas |
| 4. Extracción | Parser/prompt únicos, Pydantic estricto, cero/faltantes diferenciados; cantidades fraccionarias preservadas y derivación solo con factores configurados; tipos y normalización Server/Client alineados | Confirmación transaccional de factura/stock sigue pendiente en Server; probar una extracción real con documento sintético |
| 5. Errores | Códigos seguros e ID de solicitud, 429/503/504 y Retry-After conservados en Server; reintento solo por autenticación y una vez; limpieza en cancelación/error | Correlación y recuperación con sesión real en staging/VPS |
| 6. Límites | Admisión antes de uploads, cuerpo acotado antes de multipart sin depender de Content-Length, partes/archivo/firma/tiempos limitados; limpieza y liberación tras desconexión | Configurar proxy y dimensionar límites contra recursos reales del host |
| 7. Cuotas/limpieza | Lectura compartida con caché de 30 s por sesión, origen/antigüedad; fallo o sustitución de sesión no refresca datos antiguos; retirados generate_text/parser duplicado/dependencia agéntica y modelos artificiales; dependencias declaradas fijadas | Compatibilidad futura del SDK y su acceso interno a cuotas; actualización de TestClient cuando su dependencia sucesora sea compatible |
| 8. Operación | Worker único, imagen base fijada por digest, UID 10001, recursos/tmpfs acotados, shutdown y health/readiness separados; runbook actualizado | Volúmenes/permisos Linux reales, cuota de disco persistente, login/renovación/restauración privados y comprobación externa en VPS |

**Evidencia de validación:**

- Microservicio: **57 pruebas** en Windows y Linux, sin red externa ni sesión real. Cubren modelos, cuotas, extracción, auth, multipart, saturación, desconexión, timeout, limpieza y contrato OpenAPI.
- Imagen Linux construida y ejecutada sin red con UID 10001; `.env` no incluido. Arranque sin cookies: health 200, rutas privadas 401 sin token, ready 503, Antigravity no disponible y análisis Web 503; temporales vacíos. No se montaron perfiles ni archivos operativos.
- `pip check` local y en imagen: sin conflictos. Auditoría del manifiesto fijado con `pip-audit --no-deps --disable-pip`: **sin vulnerabilidades conocidas** a esta fecha; no incluye paquetes del sistema/base de imagen o navegador. Dependencias fijadas sin hashes de artefactos.
- Compose: configuración válida. La simulación local no prueba aislamiento externo ni recursos/volúmenes reales del VPS.
- Server: build y **245 pruebas en 74 archivos** correctos. Lint sin errores y siete advertencias previas fuera del alcance; pruebas nuevas en el caso de uso de análisis, sin crear specs de servicio/controlador.
- Client: build y **43 pruebas** de importación/selección IA correctos; ajuste de tipo `total_amount` nullable. La suite completa anterior de Client no se volvió a ejecutar en esta entrega.

**Siguiente trabajo necesario:** verificar un puente de sesión Antigravity compatible con el escritorio del usuario sin reutilizar cuotas Web ni exponer secretos; completar S-07/S-08 en Server; ensayar el runbook privado en VPS y una extracción real revisada. El soporte dual y la salida a producción **no se consideran completos** con simulaciones. Las demás incidencias de Server conservan la prioridad del plan original.


## Revisión actualizada de Nodia Server — 2026-10-03

**Dictamen actual, ajustado a la aclaración posterior del usuario:** S-01/S-02 corresponden a acceso global intencional y no se mantienen como bloqueos de lanzamiento por esos motivos. S-03 se corrigió localmente en la entrega Ransack posterior; permanecen pendientes su comprobación con PostgreSQL/staging y los demás riesgos de integridad/operación. También persisten riesgos de integridad, migración y configuración IA. Esta revisión no implementa sus correcciones; instala instrucciones preventivas y actualiza el plan anterior. Las mejoras de Gemini no eliminan los defaults y decisiones incorrectas que todavía toma Server.

### Evidencia local actual

| Comprobación | Resultado y alcance |
|---|---|
| `npm run build` | Correcto; no demuestra arranque con infraestructura ni metadata DI correcta en todos los flujos |
| `npm run lint` | 0 errores, 7 advertencias existentes |
| `npm run test` | 245 pruebas correctas, 74 archivos; algunas prueban delegación y simulan las reglas que falta verificar |
| `npm audit --omit=dev --json` | 2 paquetes con severidad alta en la misma cadena `@nestjs/platform-express` → Multer, con corrección disponible; no se actualizó el lockfile |
| QueryBuilder sin conexión PostgreSQL | `q[s] = id,(SELECT(1)) asc` genera `ORDER BY "product"."id",(SELECT(1)) ASC`; confirma expresión admitida, sin ejecutar SQL ni probar explotación |
| Filtros compuestos | `name_not_eq`/`name_not_null` producen campo `product.name_not` y predicado incorrecto |
| DTO de factura con datos sintéticos | Importe `invalid` y data `{broken-json` se transforman en `0` y `{}`; `class-validator` devuelve cero errores con whitelist/forbidNonWhitelisted |
| Paginación sintética | `limit=1000000` y `all=true` pasan el DTO sin errores de validación |
| Código compilado de análisis | `design:paramtypes` contiene `[Object, AnalyzeInvoiceDto, Object]`: la query `Partial<AnalyzeInvoiceDto>` no conserva un DTO concreto |
| Proyección sintética de proveedor | `fields.token_plan_web.token = SYNTHETIC_TOKEN` permanece íntegro después de `sanitizeProviderFields`; no se leyeron secretos ni se usó cuenta real |

No se inició la aplicación contra DB/Redis/R2, ejecutó una migración o probó una cuenta de Google/VPS. El estado auditado es el árbol de trabajo, con cambios previos del usuario; no un commit congelado. La auditoría de dependencias identifica versiones afectadas, no demuestra explotación de cada aviso en esta configuración. El [aviso de Multer sobre cargas abortadas](https://github.com/advisories/GHSA-3pph-fpjx-jg34) indica `2.4.0` como versión corregida; resolver toda la cadena compatible, no un único aviso aislado.

### Hallazgos anteriores contrastados

| Hallazgo | Estado actual |
|---|---|
| S-01 · P0 | Guard de acciones permite ausencia de metadata; administración sin `RequireAction`; usuario puede solicitar reemplazo de roles sin actor/autorización en ese flujo |
| S-02 · P0 | Business tiene verificación de actor, pero productos/proveedores/movimientos/facturas/URLs firmadas no la reciben uniformemente; filtros/IDs no establecen pertenencia |
| S-03 · P0 | Interpolación y predicados rotos reproducidos en construcción SQL offline |
| S-04 · P1 | DTO UpdateRole hereda claves editables; no garantía concurrente del último administrador; asociaciones guardadas en pasos separados |
| S-05 · P1 | Productos y logs se guardan separadamente; importación no tiene comando único/idempotencia; R2 se sube antes de factura sin recuperación completa |
| S-06 · P1 | Migraciones dependen de schema previo y eliminan campos antes de conversión suficiente; defaults de canales difieren; synchronize fuera de producción no sustituye baseline |
| S-07 · P1 | Análisis puede reemplazar proveedor explícito inexistente; catálogo selecciona primer modelo, deduce capacidades/contexto y fabrica créditos/porcentajes; sync conserva heurísticas por nombre |
| S-08 · P1 | Ramas/controladores/configuración API keys y Mistral continúan activos, contra política vigente de Nodia |
| S-09 · P1 | `limit` sin máximo, `all` sin cota y bulk con consultas por elemento; no generalizar N+1 a conteos de Business, que ya se agrupan |
| S-10 · P1 | Audit vuelve a confirmar la cadena afectada; actualización pendiente |
| S-11 · P2/P1 | Continúan creación como upsert, DELETE plantilla, vaciado de traducciones e invalidación del email anterior; **conversión de factura inválida se eleva a P1** por pérdida silenciosa de integridad confirmada |

### S-12 · P1 · Tipos borrados y mezcla posterior eluden validación

`InvoiceController.analyze` recibe `@Query() queryParams?: Partial<AnalyzeInvoiceDto>` y combina query/body después del pipe. La metadata compilada de query es `Object`; sus restricciones de DTO no se aplican como una clase concreta. `AiProviderController.syncModels` recibe mode/engine como strings/tipos de TypeScript sin un DTO enum ejecutable equivalente. El body validado no convierte una query arbitraria en datos seguros ni valida el comando compuesto.

**Acción:** DTO concreto de query/params, coerciones deliberadas y validación del comando final con precedencia definida; resolver mode/engine contra la instancia habilitada en el caso de uso. **Aceptación:** query con engine/modo inválido, campos desconocidos o datos contradictorios se rechaza antes del trabajo remoto. El mecanismo está descrito en la [documentación oficial de validación Nest](https://docs.nestjs.com/techniques/validation).

### S-13 · P1 · Saneamiento superficial y mensajes crudos de dependencias

`CreateAiProviderDto.fields` acepta un objeto arbitrario. `sanitizeProviderFields` enmascara algunas claves directas pero deja intactos valores sensibles anidados; la prueba sintética confirma ese límite, sin demostrar que existan secretos reales guardados allí. Las columnas cifradas con `select: false` son un control útil, pero no protegen ese JSON. `StorageService` incorpora `error.message` del SDK en una `InternalServerErrorException`; el filtro global conserva mensajes de `HttpException` incluso en 500 y registra su stack.

**Acción:** esquema de configuración pública separado de credenciales y proyección explícita de respuesta; errores clasificados seguros/correlacionados, sin mensajes brutos SDK ni payloads. **Aceptación:** marcadores sensibles anidados y errores sintéticos no aparecen en respuesta/log público; sigue disponible información segura para diagnóstico.

### S-14 · P2 · Pruebas de delegación no cubren reglas del dominio

Casos de uso como actualización de usuario/productos delegan en servicios que contienen las escrituras/reglas. Sus mocks y aserciones de llamadas no ejecutan autoridad, transacciones, cambios asociados ni concurrencia. La arquitectura local pide reglas en casos de uso y persistencia en servicios; mantener toda la lógica simulada produce evidencia insuficiente aunque la suite esté verde.

**Acción:** al implementar cada paso, llevar reglas de aplicación a casos de uso reales y probar rechazos/efectos. Mantener la política de unit tests solo en `use-case/*.spec.ts`; comprobar DB/HTTP/DI aisladamente cuando la garantía requiera esa capa. **Aceptación:** un defecto de permiso/ámbito/integridad hace fallar una regresión pertinente. No crear tests que solo comparen el contenido de estas skills.

### Prevención instalada

- Se amplió `backend-service-quality` con cobertura explícita de operaciones, validación de entradas compuestas, proyección pública, contexto transaccional y tests que ejecutan la regla real. Fuente: `C:\Users\Oscar\Desktop\skills\backend\backend-service-quality`.
- Se creó `nestjs-service-quality` para guards/metadata, clases DTO, DI/ESM, TypeORM y evidencia de runtime. Fuente: `C:\Users\Oscar\Desktop\skills\backend\nestjs-service-quality`. Contiene SKILL, metadata UI y tres referencias condicionales.
- Ambas se instalaron en `nodia-server/skills/`; `nodia-server/AGENTS.md` exige aplicarlas y conserva las restricciones locales. Se corrigieron la identificación de Server Template y la contradicción del catálogo Vitest con tests solo de casos de uso, sin cambiar la convención Docker existente.
- La copia genérica del microservicio se sincronizó para evitar divergencia; la skill Python no cambia. Las instrucciones se validan por estructura, enlaces y equivalencia de copias. Esta entrega no corrige los hallazgos de ejecución ni sustituye controles automatizados y revisión de cada cambio.


### Aclaración de alcance del usuario — 2026-10-03

El usuario confirmó que la administración sin permisos por acción y el acceso a productos, facturas y archivos de otros negocios son intencionales para el público específico de Nodia. S-01/S-02 se reclasifican como decisiones de alcance, **no como defectos corregidos**. Mantener autenticación actual; esta aclaración no autoriza acceso anónimo ni elimina invariantes de integridad o protección de secretos. No implementar restricciones granulares/aislamiento por defecto para esos accesos.

La decisión contradice las secciones 2/4.8 del PRD V2 histórico, que exigen permisos en endpoints. Se registra revisión parcial de autorización y reconciliación pendiente del contrato producto/UI/API; no se aprueban nuevos documentos automáticamente. La explicación de S-03 se mantiene: valores parametrizados no validan nombres de campos, y una expresión arbitraria puede entrar en ORDER BY. Su reproducción fue offline, sin ejecución PostgreSQL ni demostración de lectura/borrado de datos.


## Seguimiento de implementación de Ransack — 2026-10-03

**S-03 corregido localmente.** Se reforzó `applyRansack` y sus 14 consumidores con políticas explícitas de campos/tipos por recurso, sin cambiar el acceso global confirmado por el usuario. Se mantiene `q[campo_predicado]` y ordenamiento por una columna. Campos, relaciones, expresiones, direcciones, operadores y valores incompatibles se rechazan con 400; los valores siguen parametrizados y los nombres de parámetros no colisionan con parámetros anteriores.

- Sufijos compuestos completos; soporte real para `not_eq`, `not_null`, `not_in` y `not_cont`, además de operadores existentes.
- Límites antes de filtros especiales: 32 entradas q, claves de 128 caracteres, listas de 1000 elementos y valores de texto de 2048 caracteres. `all`, número de filas, duración y costo de subconsultas no se acotan por esta entrega; S-09 continúa parcialmente pendiente.
- Búsquedas de texto literales con `%`, `_` y `!` escapados. `in=[]` no encuentra filas, `not_in=[]` no excluye filas; flags nulos falsos omiten la condición. Se conservan false/cero y IDs bigint como strings, y se rechazan datos no finitos/estructuras inválidas.
- Se preservan filtros de roles/módulos/acciones, stock/variación de precios y fechas de factura. `ai_provider.key` usa `catalog.key` con join incluso en includes=false; connection_id remite al provider_id real en claves/eventos.
- DTO de productos amplía explícitamente el contrato HTTP: nombre exacto/distinto/no contiene, código distinto/no incluido, proveedor nulo/no nulo y rango de stock. Otros DTOs conservan sus predicados públicos; el soporte genérico no implica publicar automáticamente todas las opciones.

**Evidencia:** build correcto, lint con cero errores y siete advertencias previas, 287 pruebas en 74 archivos correctas. Las 42 regresiones nuevas recorren el caso de uso/servicio/compiler reales y simulan únicamente la ejecución de DB; incluyen inputs manipulados, semántica negativa/nula, límites, caracteres literales, IDs grandes, filtros de dominio y ValidationPipe/DTO real. Comprobación adicional del runtime ESM compilado: 14 políticas y 111 columnas verificadas contra metadata real, incluyendo key de catálogo, sin inicializar conexión ni ejecutar SQL. Integración PostgreSQL con ejecución/planes/carga representativa y staging sigue pendiente; no se ejecutaron migraciones, despliegue ni cuentas externas.

La decisión y compatibilidad están en [ADR-010 propuesto](../architecture/decisions/ADR-010-ransack-query-policies.md). AGENTS indexa el contrato y exige políticas/DTOs alineados. No se creó un plan temporal, cambió la política de acceso ni se declararon resueltos los otros hallazgos.
