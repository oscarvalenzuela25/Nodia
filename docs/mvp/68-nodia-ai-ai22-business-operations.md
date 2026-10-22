# NodiaAI AI-22 — operaciones individuales de Negocios y archivos

> Estado documental: en revisión; sin aprobación automática.
> Fecha: 2026-10-17.
> Dependencias: [plan45](45-nodia-ai-implementation-plan.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md), [lecturas61](61-nodia-ai-ai15-product-reads.md), [recuperación66](66-nodia-ai-ai20-execution-recovery.md) y [Finanzas67](67-nodia-ai-ai21-financial-operations.md).

## Alcance y estado de publicación

AI-22 incorpora catorce puertos internos de escritura individual en Negocios: tres de negocios/colaboradores, dos de productos, dos de logs, dos de proveedores, tres de contactos y dos de facturas. Reutiliza los casos de uso nativos y la transacción del efecto confirmado de AI-20/21. No crea un segundo modelo de productos, un lenguaje SQL del agente ni tablas por familia.

Continúan las doce lecturas SQL de Negocios ya publicadas: obtener/listar negocios, productos, proveedores y facturas; obtener/listar/consultar logs y listar contactos. Los archivos/exportaciones mantienen tres referencias privadas: factura, CSV de productos y CSV de proveedores. La elegibilidad externa de conexiones OCR es otra lectura, de modo que Negocios conserva dieciséis capacidades publicadas de lectura/referencia. El análisis OCR no se transforma en creación de factura o actualización automática de inventario.

**Los catorce preparadores son registros internos, sin publicación MCP.** No se acredita preparación ni escritura de Negocios desde Gemini por registrar código, aprobar una propuesta sintética o actualizar Markdown. El release de herramientas sigue siendo de 67 lecturas/referencias y 27 fragmentos funcionales; las siete fichas de lectura aprobadas de Negocios conservan sus cuerpos. La nueva [ficha de efectos confirmados](../nodia-ai/knowledge/businesses/features/confirmed-business-effects.md) queda draft/unregistered y excluida de la publicación.

## Matriz de operaciones

| Recurso | Preparadores internos | Escritores nativos y efectos |
|---|---|---|
| Negocios | `nodia_businesses_prepare_create`, `nodia_businesses_prepare_update` | `CreateBusinessUseCase`, `UpdateBusinessUseCase`; negocio y traducciones en la misma transacción |
| Colaboradores | `nodia_businesses_prepare_set_collaborators` | `AssignBusinessCollaboratorsUseCase`; cambios de colaboradores y sus asociaciones conforme al endpoint nativo, sin convertirlo en importación masiva |
| Productos | `nodia_products_prepare_create`, `nodia_products_prepare_update` | `CreateProductUseCase`, `UpdateProductUseCase`; producto y snapshot de log nativo atómicos |
| Historial de productos | `nodia_product_logs_prepare_create`, `nodia_product_logs_prepare_update` | `CreateProductLogUseCase`, `UpdateProductLogUseCase`; snapshot explícito vinculado a producto, sin simular venta o pago |
| Proveedores | `nodia_providers_prepare_create`, `nodia_providers_prepare_update` | `CreateProviderUseCase`, `UpdateProviderUseCase`; proveedor comercial, impuesto y configuración propios |
| Contactos | `nodia_provider_contacts_prepare_create`, `nodia_provider_contacts_prepare_update`, `nodia_provider_contacts_prepare_set_active` | `CreateProviderContactUseCase`, `UpdateProviderContactUseCase`; protocolo nativo de request_key/version y colecciones completas |
| Facturas | `nodia_invoices_prepare_create`, `nodia_invoices_prepare_update` | `CreateInvoiceUseCase`, `UpdateInvoiceUseCase`; metadatos SQL sin nuevo upload desde el chat |

No se publican los siete handlers bulk/import excluidos de v1 ni DELETE ausentes en esta familia. Desactivar no se presenta como eliminación física. Una operación nativa compuesta, como producto más log, sigue siendo un paso; las secuencias dependientes y sus resultados parciales pertenecen a AI-23.

## Preparación y revisión

Cada puerto expone campos permitidos, mínimos, valores predeterminados reales, tipos y proyección antes/después. La preparación incompleta pide aclaraciones; un update vacío no ejecuta un escritor. Los envelopes almacenados mantienen versión, negocio de origen, objetivo cuando corresponde, comando y orígenes. Los contactos añaden sus bindings nativos. `schema_version`, claves de recuperación, versiones y orígenes internos no son una entrada confiable por aparecer en JSON del modelo: la preparación pública y la reconstrucción de templates almacenados usan métodos separados.

Los cambios de una revisión generan otra revisión/hash y exigen un botón humano nuevo. El binding comprende el envelope completo, la herramienta, contrato y scope. El objetivo y negocio de origen no se cambian por un canal de edición de campos; un traslado permitido se representa como destino explícito en el comando, con `destination_business_id` resuelto por el backend y congelado en las precondiciones.

Los números de precios/porcentajes/stock/factura conservan la representación y límites de sus columnas/DTOs: enteros JSON, sin convertir texto inválido a cero. El total de factura admite cero y llega hasta 2147483647. Los IDs bigint son strings; negocios y logs conservan UUID. No se infieren impuestos, precios, stock o estados a partir del nombre de una entidad. La edición parcial entrega sólo claves congeladas: no permite que los inicializadores de un `PartialType` reactiven o reinicien campos omitidos.

Objetos y listas se muestran como `ReviewValue` etiquetados, preservando ceros, null y orden relevante. Datos JSON de factura se reemplazan exactamente cuando se proporcionan; no se convierten JSON roto en `{}` ni cantidades inválidas en `0`. El presupuesto de bytes/profundidad/colecciones procede de la política50 y rechaza exceso sin esconder efectos mediante truncado. El editor humano expone sólo controles registrados compatibles con el campo; los objetos completos no se convierten en SQL o instrucciones.

## Autoridad, relaciones y concurrencia

NodiaAI exige su módulo y `/tools/business` a usuarios ordinarios, además de sesión actual. Editar negocio y gestionar sus colaboradores conserva la restricción de dueño o super_admin nativo. El acceso autenticado global a productos, proveedores, contactos, facturas y archivos es una decisión vigente del producto conforme19; AI-22 no introduce un aislamiento por negocio o permisos por acción nuevos. Esa globalidad no permite mezclar relaciones incompatibles ni suplantar al dueño de otro chat.

Los snapshots incluyen valores materiales y timestamps PostgreSQL completos, no sólo `updated_at` convertido a milisegundos. Se congelan negocio de origen/destino, referencias y asociaciones afectadas. El orden compartido comienza con autoridad y coordinación de ejecución; en dominio se bloquean negocios en orden UUID, proveedor y producto antes de su log, contacto o factura cuando corresponda. Los escritores nativos usan el mismo EntityManager que el witness y cierre de ejecución; no comprometen cambios mediante repositorios globales fuera del callback.

Proveedor/producto/factura se validan frente al negocio efectivo. Cambiar un proveedor, una relación, traducciones, colaboradores, valores del objetivo o una versión de contacto invalida la revisión material. La ejecución no actualiza silenciosamente una propuesta aprobada con el estado reciente. Los constraints de PostgreSQL siguen resolviendo carreras de FK y unicidad; no se añaden supuestas unicidades por nombre/código cuando el dominio no las define.

Esta coherencia no se limita al puerto del chatbot. Los escritores nativos de producto y factura toman referencias bajo locks compatibles con el traslado de proveedor; mover un proveedor que dejaría productos/facturas en otro negocio se rechaza. La actualización de factura elimina relaciones hidratadas obsoletas cuando cambia su FK para que TypeORM no restaure el proveedor o negocio anterior. La ausencia de un campo conserva el valor y relación existentes. Crear/editar factura sin manager abre su transacción nativa; con manager hereda la activa y no inicia otro commit.

Las rutas legacy de actualización masiva de proveedores y creación/actualización masiva de productos también aplican esas barreras. Validan el conjunto de referencias y bloquean objetivos y relaciones en orden estable; productos y sus logs comparten una transacción. No se admite repetir un objetivo dentro de la misma actualización masiva. Esto evita que otra ruta HTTP rompa la coherencia de una propuesta confirmada; no incorpora lotes al catálogo MCP ni cambia su exclusión de v1.

Contactos preserva su request_key de creación y la versión esperada de edición. Nombre conserva mayúsculas tras normalización nativa, teléfono/email/horario mantienen sus contratos y omitir/vaciar/reemplazar una colección no son equivalentes. La clave nativa queda vinculada a la intención del paso y no se regenera al recuperar una ejecución. No se deduplica una nueva petición humana sólo porque tenga un teléfono o texto parecido.

## Facturas, archivos y límites explícitos

Crear factura desde el puerto AI-22 exige negocio y código; proveedor es opcional, total predetermina cero, datos `{}` y actividad true conforme al contrato real. La vista previa muestra estos defaults. El archivo es opcional en el endpoint existente, por lo que una factura de metadatos puede guardarse sin él. Actualizar conserva los campos omitidos y admite cambios de metadatos con el writer heredado.

El modelo no proporciona `path_storage`, una URL, un buffer ni una referencia prestada de otra factura para asociar un archivo. Una creación AI-22 usa clave vacía; un update conserva la asociación que ya tiene el registro y muestra sólo `file_attached`, sin exponer la clave interna ni URL firmada en el prompt. La clave privada sí participa en el snapshot del backend para detectar cambios antes del efecto.

**Subir/promover un adjunto nuevo desde NodiaAI queda en AI-32**, donde se implementará staging por chat, ownership, firma/tamaño y copia a una clave de dominio independiente. Actualmente no existe ese protocolo de adjuntos; llamar al POST nativo con un archivo dentro de la transacción del efecto mantendría locks durante R2 y dejaría dos commits sin witness común. Se rechaza expresamente `manager + file` antes de registrar o subir nada. Esto limita la paridad de archivos de AI-22 y no se declara como cobertura completa.

El traslado entre negocios de una factura sin archivo es posible si el proveedor resultante corresponde al destino o es null. **Una factura con archivo no se traslada por este puerto** hasta disponer de copia/promoción recuperable: las referencias privadas de AI-15 exigen una clave `invoices/{business_id}/...`; conservar la clave antigua al moverla rompería ese binding. No se acepta borrar la clave como atajo.

El POST nativo de factura con archivo conserva el protocolo de [ADR-026](../architecture/decisions/ADR-026-invoice-upload-recovery.md): validar PDF/JPEG/PNG/WebP de hasta 10 MiB, intent durable antes de PUT, I/O fuera de SQL, commit corto de factura/consumo del intent y cleanup recuperable. El worker no elimina un objeto cuya factura sí quedó comprometida, conserva el marcador ante un PUT tardío y aplaza un DELETE fallido. **Ese recovery de almacenamiento no sustituye la deduplicación de intención conversacional** y no ofrece por sí solo idempotencia del POST legacy.

Las referencias y GET humanos de AI-15 siguen vigentes: autenticación y autorización actuales, `private, no-store`, bytes/filas acotados, CSV regenerado al descargar y revalidación tras I/O. No hay archivos persistentes nuevos para exportar ni URLs firmadas en el chat. Borrar o expirar un chat elimina su referencia, no el original del negocio. La descarga binaria R2 real conserva el gate abierto `invoice_binary_download_r2_real`; un 503 por almacenamiento no configurado no acredita descarga positiva.

## Recibos, recuperación y conservación

Los recibos de operación de Negocios identifican versión, recurso, operación, ID afectado y negocio efectivo mediante `BusinessEffectReceipt`. El backend valida esa identidad contra el puerto y destino congelados. No reconstruye éxito consultando si actualmente existe el registro ni reejecuta el writer para averiguarlo. Cancelar conserva un commit ya realizado; un rollback local probado permite reanudación humana con la misma intención, bajo sesión y autoridad actuales, conforme66.

Se reutilizan ejecución, pasos, grants, witness y outbox existentes; no se crean tablas ni migraciones para cada familia. Los recibos resueltos desaparecen con el chat bajo la política de 90 días; no eliminan registros de Negocios. Preparación MCP, aceptación de Gemini y despliegue productivo son gates separados.

## Verificación y continuidad

Las catorce operaciones individuales están implementadas y verificadas en el laboratorio privado. La [evidencia consolidada](../evidence/nodia-ai-ai22-validation.json) distingue suites, integración SQL, UI sintética y activación del laboratorio. Pasaron 2.204 pruebas Server en 187 archivos y 1.396 Client en 201 archivos, builds/tipado y lint sin errores nuevos. Las tres advertencias Server existentes y la advertencia de tamaño de chunks Client siguen registradas; no se afirma aceptación de rendimiento productivo.

La integración nueva comprobó 57 casos con PostgreSQL 16 desechable, HTTP y procesos compilados: los catorce puertos, permisos/módulos, revisión/confirmación, claves y CAS de contactos, recibos atómicos, recuperación tras caída/COMMIT incierto, relaciones y cinco carreras de concurrencia. Las rutas masivas legacy también se comprobaron, incluyendo rechazo de traslados incompatibles y rollback del conjunto de productos/logs cuando falla un log. No se utilizó la base de negocio configurada para esas escrituras ni se invocó Gemini.

La misma compilación pasó 157 comprobaciones numeradas de regresión: AI-19 (32), AI-20 (36), AI-21 (47), artefactos AI-15 (24) y recuperación de uploads con SDK/almacenamiento local (18). Son 214 comprobaciones numeradas en total, más dos suites de contactos y acceso a facturas cuyo fixture informa éxito sin contador; no se les asigna una cifra inventada. Los ocho JSON están enlazados desde la evidencia consolidada.

La [UI sintética](../evidence/nodia-ai-ai22-ui-validation.json) comprobó etiquetas ES/EN, enteros y ceros reales, rechazo de notación científica, conservación del borrador/foco al cambiar a 390 px, nueva revisión y recibos históricos con enlaces. Su transporte es aislado y no acredita operación del modelo. El despachador local conserva 15 regresiones focales de registros/contratos, colisiones, contexto y compatibilidad financiera. Las pruebas de archivos usan dependencias sintéticas/SDK contra almacenamiento local; no acreditan R2 real.

El [laboratorio](../evidence/nodia-ai-ai22-lab-activation.json) quedó activo con backup previo, health 200 y 26 registros de ejecutores (12 financieros y14 de Negocios). La [observación de runtime](../evidence/nodia-ai-ai22-lab-runtime.json) comprobó 24 migraciones, 18 tablas/239 columnas de NodiaAI y cero trabajos, intentos abiertos o slots pendientes. La [igualdad del despliegue](../evidence/nodia-ai-ai22-deployed-equality.json) verificó 814 archivos compilados contra el archivo final, sin cambiar dependencias, credenciales, perfiles ni reiniciar Gemini. No se añadieron migraciones/tablas/columnas ni registros de negocio al entorno configurado.

La [verificación offline](../evidence/nodia-ai-v1-catalog-contracts-validation.json) compila134 definiciones comunes y184 de dominio,320 fixtures estructurales,31 rutas de coordinación y625 hashes de fuentes. El inventario AST actual identifica43 controladores,204 handlers,323 pares método-ruta y68 módulos locales, incluyendo cinco módulos nuevos de puertos/efecto/persistencia. Se conserva el catálogo de156 nombres y la exclusión de siete handlers bulk. Esta validación acredita consistencia estructural y trazabilidad; no se contabiliza como ejecución de permisos, SQL o herramientas desde Gemini.

`knowledge:check` validó46 fuentes,19 borradores excluidos y27 documentos/fragmentos publicados. La nueva sourcepath de esta etapa cambia el pin de release aunque esté excluida; el backend debe compilar/cargar el asset resultante. La cantidad publicada de capacidades permanece67, y no hay binding publicado para la nueva ficha de efectos. No se reescribieron los cuerpos de las siete fichas de lectura de Negocios aprobadas previamente.

La [decisión técnica propuesta](../architecture/decisions/ADR-049-nodia-ai-business-operation-ports.md) registra puertos SQL por familia, claves nativas y el límite de archivos. La documentación/ficha siguen sin aprobación automática. AI-23 abordará secuencias dependientes; AI-30/31 informes combinables; AI-32 adjuntos nuevos. No se amplía publicación por marcar una etapa técnica como implementada.


Revalidación de archivos AI-32-R02 (2026-10-18): [entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r02--formatos-de-audio-y-traslado-legacy) incorpora destino público y traslado de factura legacy sin adjunto nuevo. Copia fuera de SQL, intent recuperable, descriptor compatible y recibo atómico;135 comprobaciones SQL de etapa/regresión, almacenamiento sintético. Resuelve ese pendiente interno de AI-22; R2 real y publicación/aceptación de preparadores MCP siguen separados. Las menciones anteriores a traslado pendiente corresponden al snapshot original.

## Revalidación AI-32-R06

[Entrega78](78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) y [facturas R06](../evidence/nodia-ai-ai32-r06-invoice-validation.json) verifican creación con PNG, reemplazo con PDF distinto, traslado legacy sin adjunto nuevo, recibo/intento atómicos, rollback y conservación de la copia de factura al purgar el chat. Compilado real, SQL desechable e inspector/R2 reales;16 checks funcionales y limpieza separada sin replay. Se cierra el gate de copia/traslado R2 de estos puertos internos. No se publican preparadores MCP ni se acredita por esta prueba la descarga binaria nativa/HTTP de AI-15; las referencias a R2 pendiente en los snapshots anteriores conservan su carácter histórico. Sin cambios en código, contratos, permisos o aprobación documental.
