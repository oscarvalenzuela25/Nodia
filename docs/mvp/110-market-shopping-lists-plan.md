# Listas de Market — plan de implementación

**Fecha:** 2026-11-18. **Estado:** implementado y verificado en laboratorio en
`codex/market-shopping-lists`. Integración y verificación operativa pendientes.
El usuario aprobó la maqueta navegable y confirmó que las marcas del
checklist son compartidas entre los usuarios autorizados del negocio.
El usuario solicita la entrega completa y el ensayo de migración antes de
la promoción a producción.

[TODO](TODO.md#cola-actual) ·
[Negocios y POS](94-business-point-of-sale-and-product-refactor.md) ·
[Autoridad de negocio](89-module-access-and-user-data-scope.md) ·
[Navegación canónica](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) ·
[ADR108 propuesto](../architecture/decisions/ADR-108-business-shopping-list-shared-checklist.md) ·
[Ficha candidata](../nodia-ai/knowledge/businesses/features/market-shopping-lists.md).

## 1. Flujo aprobado

| Vista o acción | Comportamiento |
| --- | --- |
| **Market → Listas** | Sección del negocio abierto. Botón **Nueva lista** arriba a la derecha en escritorio y buscador por nombre arriba a la izquierda de la tabla. Cada fila muestra nombre, cantidad de productos, estado y acciones. |
| **Nueva lista** | Abre un modal. En el primer paso se escribe el nombre y **Guardar y continuar** avanza dentro del mismo modal. El nombre queda en el borrador hasta guardar la lista completa. |
| **Productos y cantidades** | Buscar y elegir productos del catálogo de ese negocio. Cada selección agrega una fila debajo del selector con cantidad inicial **1**, cantidad editable y basurero. Quitar un producto requiere una confirmación breve. **Guardar lista** queda abajo a la derecha. |
| **Editar** | El lápiz abre el mismo modal con nombre, productos y cantidades existentes. Permite renombrar, cambiar cantidades, agregar y quitar. Los cambios se guardan juntos. |
| **Activar o desactivar** | Acción confirmada por fila. La lista inactiva sigue visible y se puede reactivar. Conserva su composición y sus marcas. |
| **Copiar** | El icono copia una línea por producto, con su nombre y cantidad. Por ejemplo, `Arroz grano largo × 2`. El texto sirve para pegar en WhatsApp u otro destino. |
| **Checklist** | El icono abre un drawer lateral. Cada fila muestra producto, cantidad y checkbox. Marcar o desmarcar envía un `PUT` sobre esa fila y muestra el estado de guardado. Las marcas se conservan al volver a abrir y los usuarios autorizados leen el mismo estado compartido. |

Las acciones de edición, copia y checklist permanecen disponibles en la
maqueta de una lista inactiva. El estado permite identificar listas que se
dejaron de usar y reactivarlas. El copiado incluye todos los productos de la
lista, independientemente de sus marcas, con una línea por producto y en el
orden del editor. Si el navegador bloquea el portapapeles, se ofrece el mismo
texto seleccionable.

## 2. Punto de partida y navegación

- [BusinessDetail](../../nodia-client/src/modules/business/pages/BusinessDetail/BusinessDetail.tsx)
  resuelve secciones por query param. El destino estable es
  `/business/:id?section=lists`, visible como **Listas** dentro de **Market**.
  **Market** agrupa navegación del negocio y **Productos** conserva su destino
  `section=products`. La autoridad viene del módulo canónico `/business`,
  la sesión y el negocio abierto.
- [Catálogo de productos](../../nodia-server/src/product/entities/product.entity.ts)
  expone identidad, nombre, negocio, unidad y actividad. Reutilizar su lectura
  paginada y su selector, acotados al negocio actual. Enviar IDs de producto
  como cadenas bigint canónicas y validar los nuevos vínculos en Server.
- El [POS vigente](94-business-point-of-sale-and-product-refactor.md#23-lista-de-compra-y-edición-manual-r14--2026-10-30)
  usa «lista de compra» para las partidas de un carrito. Las listas de Market
  son un registro persistente de compras del negocio. Cantidad y check en
  Market representan la compra planificada, independiente de ventas, precios
  e inventario.
- Aplicar el [alcance de negocio](../../nodia-server/src/business-access/business-access.ts)
  y la [política de módulos HTTP](../../nodia-server/src/authorization/http-module-policy.ts)
  a cada lectura y escritura, incluidas búsqueda, copiado y marcas.
  Propietario y colaboradores activos con acceso a Negocios comparten el
  checklist. El bypass de super_admin conserva las invariantes de los datos.

## 3. Datos, validación y convivencia con Productos

| Recurso | Campos e invariantes |
| --- | --- |
| Lista | UUID, negocio propietario, nombre obligatorio recortado, actividad inicial activa, revisión de contenido y fechas. Permite guardar una lista vacía. El ID distingue listas con el mismo nombre. |
| Partida de lista | UUID propio, lista y negocio, producto de origen, nombre registrado al agregar, cantidad positiva y posición. Una partida por producto en cada lista. Quitar y volver a añadir genera otra identidad. |
| Marca compartida | Booleano inicial `false` y revisión por partida. Fecha y actor de la última modificación para trazabilidad; el actor no participa en la identidad de la marca. |

La cantidad inicia en **1** y admite valores entre `0.001` y
`999999999.999`, con hasta tres decimales. El contrato HTTP usa una cadena
decimal con punto y PostgreSQL guarda `numeric(12,3)`. El editor admite la
coma decimal y el copiado muestra la cantidad localizada sin ceros finales.
El [catálogo](../../nodia-server/src/product/product-measurement-unit.ts)
admite `unit`, `kg`, `g` y `bundle`. La cantidad es una planificación propia
de la lista y admite la misma precisión para las cuatro unidades. Un cambio
posterior de unidad en el catálogo no invalida la partida. El nombre de lista
se recorta y admite hasta 150 caracteres. Se admiten hasta 500 partidas.

El selector muestra productos activos del negocio para altas nuevas. Para una
partida existente, usar el nombre vigente si el producto sigue activo en ese
negocio. Si deja de estar disponible por desactivación o traslado, mantener
la cantidad, el nombre registrado al agregar y las marcas, con un aviso de
catálogo. La lista sigue siendo editable y copiable con esos datos propios.
Al editar, sólo las vinculaciones nuevas deben volver a acreditar actividad y
pertenencia. Planificar el vínculo de modo que el traslado legítimo de un
producto entre negocios conserve su comportamiento actual.

## 4. Contratos HTTP

Rutas bajo `/api/v1/businesses/:businessId`. El ID de negocio de la ruta
es la entrada al ámbito, con sesión y autorización verificadas por Server.

| Operación | Contrato |
| --- | --- |
| Listado | `GET /lists?page&limit&search`. Búsqueda literal por nombre sin distinguir mayúsculas ni tildes. Orden estable con ID como desempate y conteo de productos en conjunto. El listado inicial muestra activas e inactivas. |
| Detalle | `GET /lists/:listId` con composición, cantidades, estado y marcas/revisiones. El editor, el drawer y la copia solicitan el detalle al abrir la acción. |
| Alta | `POST /lists` con `request_key`, `name` e `items`, transacción única e idempotencia por negocio, actor y clave de solicitud. Consultar el recibo de la clave ante un resultado incierto. |
| Recibo de alta | `GET /lists/requests/:requestKey` con acceso actual al negocio y coincidencia exacta de actor y clave. Recupera el resultado de un alta confirmada. |
| Edición | `PUT /lists/:listId` con `version`, `name` e `items`. Cada vínculo retenido incluye su `item_id` y el mismo `product_id`. Un vínculo nuevo omite `item_id` y recibe otra identidad. |
| Actividad | `PUT /lists/:listId/activity` con `is_active` explícito y `version`. |
| Marca | `PUT /lists/:listId/items/:itemId/check` con `checked` explícito y `check_version`. Devuelve el ID, la marca y su revisión efectiva. |

El listado devuelve `items` con `id`, `name`, `is_active`, `version` e
`item_count`, además del objeto `pagination`. El detalle añade `items` con
`id`, `product_id`, `name`, `quantity`, `position`, `available`, `checked` y
`check_version`. `position` empieza en cero. Cada partida de un comando
incluye `product_id` y `quantity`. El recibo devuelve el detalle confirmado
por el alta original, bajo autoridad vigente del mismo actor y negocio.

El guardado de composición rechaza toda la petición si una referencia nueva
es ajena o inválida. El Server toma las barreras de sesión/módulo y ámbito
antes de los registros del dominio. La edición toma el lock de la lista y
conserva las marcas de partidas retenidas. Al marcar se verifica la lista
vigente y se actualiza la partida exacta bajo su revisión. Quitar y volver a
añadir un producto evita que un `PUT` tardío de la partida retirada cambie la
marca de la nueva. La [decisión de concurrencia](../architecture/decisions/ADR-108-business-shopping-list-shared-checklist.md)
describe las carreras a cubrir.

Si dos usuarios cambian la misma partida desde la misma revisión, el cambio
confirmado se conserva y el otro recibe conflicto con el estado vigente
autorizado. En cambios sobre partidas distintas se conservan ambos. La revisión
de contenido protege nombre, composición y actividad. La revisión de marca
protege sólo el checkbox.

## 5. Comportamiento del cliente

- **Tabla.** Reutilizar el buscador por nombre, reiniciar el paginado al cambiar
  la búsqueda y conservar resultados visibles durante revalidaciones. En móvil,
  filas adaptadas con estado y botones alcanzables. Si luego se incorpora un
  filtro de actividad, usar el patrón `ActiveStatusSelect` de Negocios.
- **Editor.** Una sola instancia de formulario y borrador para ambos pasos.
  Reutilizar el selector de un producto a la vez, sin duplicados. La confirmación
  del basurero edita el borrador y **Guardar lista** confirma la composición.
  Una petición fallida conserva modal, nombre, productos y cantidades.
- **Checklist.** Cargar el detalle al abrir el drawer y revalidar al volver a
  enfocar el cliente. Mostrar un guardado en curso por fila y aplicar la
  respuesta confirmada. Ante error, conservar el último dato confirmado y
  mostrar la opción de volver a intentar. Ante conflicto o timeout, consultar
  la marca vigente antes de ofrecer otro cambio. El estado compartido se
  refleja al reconsultar; la entrega no requiere conexión en tiempo real.
- **Contexto.** Claves de caché por actor, sesión, negocio y recurso. Ignorar
  respuestas tardías al cambiar de negocio o cerrar la sesión. La copia desde
  el listado usa el detalle autorizado del negocio actual. Confirmaciones,
  errores y mensajes de guardado usan texto ES/EN y feedback de Nodia.

## 6. Verificación de aceptación

- Abrir **Market → Listas** desde el negocio correcto. Buscar por nombre,
  navegar resultados vacíos y recuperar una lista inactiva.
- Crear nombrando y agregando productos en el mismo modal. Ver cantidad 1 en
  cada alta, editarla y comprobar Cancelar/Eliminar en la confirmación. Validar
  que Guardar sea atómico y que un error conserve el borrador.
- Editar una lista mientras otro usuario marca una partida. Guardar la edición
  conserva esa marca. En dos sesiones autorizadas, marcar/desmarcar modifica
  el mismo registro tras reconsultar; el drawer nunca exige Guardar.
- Probar con PostgreSQL concurrente dos checkboxes distintos, dos cambios en
  la misma partida, retirar y volver a agregar un producto, relectura tras
  timeout y alta repetida con la misma clave.
- Probar propietario, colaborador activo, acceso revocado, negocio ajeno y
  super_admin. Verificar que IDs mezclados, traslado de producto y filtros no
  permitan leer nombres de otro negocio o modificar sus datos.
- Verificar el portapapeles con una línea por producto, nombre y cantidad,
  teclado/foco en modal, confirmación y drawer, y layouts ES/EN de móvil y
  escritorio. Las pruebas de laboratorio preceden a la comprobación operativa.

## 7. Fases y primer pendiente

- [x] **LISTA-01 — cerrar contrato y preparar Server.** Revisar cantidades
  según catálogo, proyección de partidas fuera de catálogo y DTOs. Implementar
  modelo, migración, política HTTP e invariantes en PostgreSQL aislado.
- [x] **LISTA-02 — completar API.** Listado, detalle, alta idempotente, edición,
  actividad y marca compartida con autoridad y pruebas de concurrencia.
- [x] **LISTA-03 — entregar Client.** Ubicar Listas en Market, tabla y búsqueda,
  editor reutilizado, confirmaciones, copiado y drawer con guardado por fila.
- [x] **LISTA-04 — verificar y documentar.** Ejecutar la matriz de §6, contrastar
  con la maqueta aprobada, actualizar ficha con evidencia real y preparar la
  entrega por entorno cuando se solicite.

## 8. Migración y entrega

La [migración `1793730000000`](../../nodia-server/src/migrations/1793730000000-CreateBusinessShoppingLists.ts)
agrega listas, partidas y recibos. Las 56 migraciones previas y las tablas de
Productos y Caja se conservan. `synchronize` permanece desactivado. El `down`
de laboratorio comprueba bajo lock que las tres tablas estén vacías antes
de retirarlas. Si ya hay datos, la recuperación conserva el esquema y usa
el [procedimiento de actualización del entorno](../../ops/production/README.md).

La CI ejecuta la [prueba de instalación y actualización](../../nodia-server/test/database-setup.integration.mjs)
y la [integración HTTP](../../nodia-server/test/market-shopping-lists.integration.mjs)
antes de empaquetar Server. El ensayo Linux de `inspect`, `migrate` y `verify`
usó la acción SQL de producción y PostgreSQL 16 aislado con TLS. Partió de
56 migraciones y terminó en 57, con 76 entidades verificadas, sin seed y con
replay rechazado. Ver la [evidencia de la rama](../evidence/market-shopping-lists-20261118.md).

La CI del SHA que se promocione debe completar ambas comprobaciones. El CD
verifica el ledger y el prefijo histórico del artefacto operativo antes de
aplicar la migración. La comprobación funcional posterior abre **Negocios →
Market → Listas** con un actor autorizado en el entorno de destino.
