# Negocios: contrato vigente de interfaz

## Alta desde barcode desconocido en POS — 2026-11-14

Sólo404 product:not_found del lookup exacto abre la decisión de registro. Sí
reutiliza ProductModal con barcode textual precargado (ceros preservados); No,
cierre o cancelación limpia y devuelve el foco al lector. Asociación con producto
existente permanece explícita con revisión/confirmación. Al terminar el alta se
añade una unidad a la misma venta local una sola vez y se limpia/enfoca el lector
(plan94§40); no confirma/cobra la venta. Cancelar/error conserva partidas.
El alta conserva
el guardado recuperable y los errores del formulario. Lookup/overlays bloquean
acciones dependientes y descartan resultados de otro actor/sesión/negocio/venta.
Ver plan94§39 y recibo de pruebas para distinguir local, VM y hardware físico.

## Productos: alias y códigos — solicitud2026-11-14

Alias nullable independiente del nombre de factura, máximo255caracteres y
normalizado por trim. CRUD incluye checkbox «Utilizar el nombre como alias»:
marcado con vacío/blancos, escritura personalizada desmarca, guardar marcado
copia el nombre sin bool persistido. Edición con alias requiere expected_version.
OCR requiere revisión explícita de nuevos/existentes sin alias; lápiz abre
modal local con nombre arriba y alias/checkbox. Con alias existente se conserva.
Prevalidar todas las filas/comandos antes del primer POST; errores conservan
borrador y modal. No declarar transacción global del flujo de varias peticiones.
Vinculación manual rotula «(Sin código)» y conserva ID/revisión/campos elegidos.
El buscador de Productos y la exportación de su vista usan `q.catalog_search`
para buscar en Server por código de barras, código de factura/proveedor, alias
o nombre; POS y vinculación OCR conservan `q.search` por nombre o alias. Al
entrar en Productos el buscador recibe foco al quedar habilitado. El modal
mantiene los filtros de presencia `q.code_presence` y `q.barcode_presence`
(`present`/`missing`, Todos omitido) como selectores sin caja de búsqueda.
Limpiar restaura Todos en ambos y Activo en actividad; aplicar/quitar reinicia
página. CSV agrega alias y omitir columna conserva el anterior; fingerprint de
recuperación incluye alias.
[Plan94§38](../../../../docs/mvp/94-business-point-of-sale-and-product-refactor.md#38-alias-humano-de-productos-y-revisión-ocr--solicitud2026-11-14).

Actualizado por solicitud del usuario el 2026-10-09. Registro de implementación; no implica aprobación documental automática.

- Rutas canónicas: `/business` y `/business/:id`, independientes del grupo del menú. Los enlaces anteriores `/tools/business` sólo redirigen al mismo destino guardado (ADR-092, 2026-11-01).
- Descripción opcional con un TextInput multilinea, independiente del idioma de interfaz. DTO existente `translates`: guardar el mismo texto en es/en; alta vacía `[]`, borrado en edición ambas cadenas vacías. Priorizar description canónica sobre comment legado; no recuperar comment después de borrar description.
- Resumen: últimas diez facturas activas, predicado aplicado por Server antes de paginar, orden created_at descendente. Consulta acotada separada de los agregados generales; no cambia el alcance de los KPIs ni supone anulación financiera de una factura inactiva.
- Proveedores, productos y facturas: activos desde la primera consulta. Filter conserva búsqueda y reinicia página al cambiar estado; Limpiar restaura activos, quitar chip permite todos. Proveedores incorpora Filter reutilizable: botón de filtro, chip de estado debajo y luego barra con buscador a la izquierda y acciones de descarga/administración a la derecha desde sm; en xs el buscador y las acciones se apilan con ancho completo.
- Colaboradores: sin título duplicado ni tarjeta exterior; filtro, chip de estado y luego barra con buscador a la izquierda y Agregar colaborador a la derecha desde sm, apilados/ancho completo en xs, seguida del listado. InputSearch con debounce por nombre/correo/posición/ID y Filter activo/inactivo. Activos por defecto; filtrar la colección completa de colaboradores del negocio, usando is_active de la asociación.
- Factura: iconos nativos de fechas del color del texto del input en tema claro/oscuro; control nativo conservado. Switch Activo inmediatamente después de Ruta / Archivo, antes de Notas.
- Móvil xs: listado de negocios y cinco pestañas adaptados; proveedores/productos/facturas/colaboradores/contactos mediante tarjetas específicas. Tabla desde sm con minWidth650 y scroll local transparente. Misma consulta/página/acciones; redimensionar conserva estado, sin fetch por tarjeta. Productos conserva historial y variación del precio; proveedores conserva mapeos/instrucciones; contactos conserva teléfono, correo, horario y sus acciones.
- Cabecera y pestañas apiladas en xs con orientación vertical real y16px de separación superior e inferior en el bloque de pestañas, igual a sus laterales; paneles internos12–16px, PageContent16px sin duplicarlo. Buscadores y botones principales ancho completo; paginado envuelve sin ocultar controles.
- Importaciones CSV/facturas: barras de acciones y paneles compactos/apilados. Las tablas de comparación y revisión de importación conservan650px y scroll local también en xs por su propósito; no se modifica extracción IA ni procesamiento de archivos.
- Carga inicial con Boneyard sobre contenido; paginado fuera del Skeleton. Refetch conserva datos y bloquea controles. Vacío/error diferenciados, reintento y sileo traducido. Fallo de guardado conserva modal y borrador; cierre solo tras éxito.

QA reproducible: `src/test/manual/business/README.md`, componentes y rutas de producción con transporte e identidad sintéticos. Sin peticiones a servicios reales, escrituras de BD ni inferencias. Evidencia de sesión en docs/mvp/00-progress.md y35-mobile-cards-shortcuts-plan.md. Aceptación en teléfono físico y sesión real pendientes.

- Normalización solicitada el 2026-10-09: dentro de Filter, actividad mediante ActiveStatusSelect (SelectSingleInput) con Activo / Inactivo / Todos, Activo inicial y tras Limpiar. Todos incluye ambos sin predicado; reabrir refleja selección aplicada y aplicar/quitar reinicia página. Etiqueta Estado de actividad distingue actividad de estados comerciales. Regla estricta en AGENTS.md; no cambia estados comerciales ni switches de edición, ni aprueba automáticamente documentos.
