# Contratos, autorización e integridad de datos

Leer las secciones afectadas cuando cambien DTOs/esquemas, endpoints, mensajes, persistencia o permisos. Adaptar los mecanismos al stack; estos criterios no requieren una arquitectura concreta.

## Contrato ejecutado y evolución

- Inventariar consumidores: UI, otros servicios, SDK generado, workers y scripts. Un cambio interno de tipo puede alterar serialización o defaults externos.
- Especificar requerido/opcional/nulo, límites de colección/cadena, unidades, precisión y significado de cada campo. En PATCH diferenciar omitir un campo de borrarlo con `null`; aplicar la misma semántica en validación y persistencia.
- Resolver campos desconocidos y coerción deliberadamente. Rechazo estricto en comandos suele prevenir mass assignment; un evento versionado puede necesitar tolerancia compatible. No rechazar extensiones legítimas por una regla universal de `extra=forbid`.
- Para dinero definir moneda, precisión y redondeo del dominio. Usar decimal/enteros menores cuando corresponda; no imponer float ni asumir dos decimales. Rechazar NaN/Infinity donde no tengan significado permitido.
- Para IDs conservar el tipo y comparar identidades reales. Un nombre, alias o clave de catálogo no identifica necesariamente una conexión/instancia.
- Distinguir fecha civil, instante y zona horaria. No inferir la zona del servidor como regla de negocio; acordar ventanas inclusivas/exclusivas y formato de transporte.
- Validar estructura y contenido de respuestas externas antes de convertirlas al contrato interno. Un upstream 200 con payload inválido es un fallo de integración, no éxito con defaults.
- Cambiar esquema, OpenAPI, mensaje/versionado y consumidores coordinadamente. Añadir contratos de regresión para compatibilidad realmente requerida; no conservar para siempre un formato inseguro solo porque existió.

## Proyección de salida y semántica de comandos

- Diseñar la respuesta pública con campos permitidos. Ocultar unas claves de primer nivel no protege secretos anidados, columnas cargadas por relaciones ni datos añadidos al objeto después del saneamiento. Separar campos configurables públicos de credenciales/estado interno; no devolver objetos arbitrarios por comodidad.
- Definir creación, actualización y upsert como operaciones distintas. Una colisión al crear debe seguir el contrato de conflicto; no sobrescribir silenciosamente otro registro. En colecciones distinguir omitir, vaciar y reemplazar, incluyendo traducciones y asociaciones.
- Cuando se mezclen varias fuentes de entrada, validar cada una y el resultado que ejecutará el dominio. La composición posterior puede eludir validadores previos; especificar precedencia y rechazar contradicciones sensibles de actor, ámbito o conexión.

## Autorización y aislamiento

- Mantener una matriz de operaciones con política pública, propia, por acción o por ámbito, según el producto. Detectar nuevas rutas/aliases sin política y excepciones que dejan pasar la falta de metadata. No convertir todas las lecturas en administración ni romper rutas públicas legítimas.
- Verificar la acción antes del trabajo externo costoso y la pertenencia al ámbito antes de leer/escribir. El diseño local determina si se usan casos de uso, policies o guardas; una policy debe cubrir también llamadas que no pasan por HTTP.
- Una credencial de servicio autentica al servicio; no otorga automáticamente a cualquier usuario autorización sobre cualquier negocio. Si se delega actor/ámbito, verificar procedencia e integridad del contexto.
- Filtrar por tenant/recurso en la consulta de persistencia, no solo comprobar un objeto y después actualizar por un ID sin ámbito. Revisar las carreras entre verificación y escritura y la revocación según las garantías requeridas.
- Autorizar lecturas por ID, listados, búsquedas, agregados, archivos, exportación, relaciones y acciones de trabajo/cancelación. No revisar solamente las mutaciones principales.
- Validar asociaciones: un ID de proveedor, rol, archivo o producto puede existir y pertenecer a otro ámbito. Las restricciones relacionales y la lógica deben impedir esa asociación.
- Caches y trabajos incluyen el ámbito relevante y, si cambia el permiso, una política de invalidación/revalidación. El worker no debe heredar autoridad ilimitada porque recibió un mensaje.
- Permitir ordenamiento/filtros mediante un mapa de campos admitidos. Parametrizar valores SQL; los identificadores/operadores requieren allowlist y mapeo, no interpolación de entrada remota.
- En claves/rutas de objetos validar propietario, destino y prefijo permitido. Generar rutas del servidor cuando sea posible; un filename del cliente no debe decidir el destino de almacenamiento.

## Escrituras, concurrencia e idempotencia

Para una operación compuesta, expresar la invariante antes del mecanismo: por ejemplo, todos los cambios de inventario se confirman juntos o ninguno se aplica.

- Usar una transacción para escrituras en el mismo recurso transaccional. Todas las escrituras participantes, incluidas asociaciones, traducciones y auditoría, deben usar su misma conexión/contexto; envolver una llamada no incorpora automáticamente repositorios globales. Restricciones UNIQUE/FK/checks y locks/versiones deben respaldar invariantes sensibles a carreras; un `find` seguido de `save` sin protección permite duplicados.
- Escoger aislamiento/locking según la contención. No declarar un lock distribuido por usar un semáforo en memoria, ni serializar todas las operaciones por comodidad.
- Una clave de idempotencia representa actor/ámbito + operación + misma intención. Registrar hash/identidad del payload, estados y resultado de forma atómica. Repetir la misma intención recupera su resultado; distinta intención con misma clave requiere conflicto según contrato.
- Probar dos solicitudes simultáneas con la misma clave. Definir cómo responde la segunda mientras la primera está en curso, qué ocurre tras un crash y cuánto tiempo se conserva el resultado. Un TTL que expira durante la ejecución reabre duplicaciones.
- Diferenciar efecto fallido de resultado incierto. Un timeout después del commit no autoriza deshacer o repetir sin reconciliación.
- Para almacenamiento/servicios externos, definir orden, outbox o compensación disponible. La compensación puede fallar y necesita estado/reintento propios; un `try/catch` que intenta borrar algo no demuestra rollback completo.
- Asegurar que un borrador de OCR/importación no se confunde con una escritura confirmada. Validar nuevamente datos y autoridad al confirmar; evitar confiar en totales/precios/roles calculados por el cliente.

## Consultas y performance

- Consultas y respuestas tienen tamaño acotado. Paginación necesita orden estable; elegir offset/cursor por necesidades reales. No aumentar un límite arbitrario para prometer resultados completos.
- Metadatos y agregados usan el mismo ámbito/filtros. Sumar una página no produce un total global; definir snapshot/coherencia cuando listados y totales se calculan por separado.
- Eliminar N+1 mediante joins/cargas por conjuntos cuando aporte valor. Seleccionar columnas necesarias y evitar fan-out ilimitado. Para bulk definir número máximo, tamaño de payload y semántica de fallos parciales/atomicidad.
- Antes de añadir índices, considerar filtros reales, cardinalidad, plan de ejecución y costo de escritura. Medir consultas y volumen representativos; no afirmar escalabilidad por el patrón del ORM.
- Exportaciones y batch también requieren autorización, backpressure y límites; streaming o trabajo asíncrono pueden ser apropiados si el tamaño excede una respuesta interactiva.

## Migraciones y borrado de superficie

- Evaluar lectura/escritura de versiones mezcladas y datos existentes. Añadir validación más estricta puede rechazar datos históricos; planear conversión explícita sin inventar información faltante.
- Ensayar la migración con una restauración representativa, registrar compatibilidad y rollback real. Un método `down` vacío no proporciona reversión; un cambio de cifrado puede requerir backup anterior y claves históricas protegidas.
- Conservar datos/credenciales/perfiles según la política del proyecto. No borrar ciphertext, backups o migraciones por no encontrar imports.
- Verificar consumidores de variables/dependencias/rutas en ejecución, tests, scripts, configuración, generación y operación. Retirar consumidores exclusivos y actualizar documentación; no dejar un endpoint que responde éxito sin hacer trabajo.
- No ejecutar una migración o publicación como efecto incidental de validar documentación o una skill.
