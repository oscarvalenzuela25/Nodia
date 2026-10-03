# Persistencia, migraciones y composición ESM

Leer al modificar entidades, repositorios, operaciones compuestas, consultas o arranque/DI.

## Reglas y límite transaccional

Antes de escribir, definir qué se confirma junto: entidad, asociaciones, traducciones, snapshot/auditoría y resultado idempotente. Mantener reglas comprobables en la capa de aplicación prescrita por el proyecto; no esconder toda la autorización en un servicio y simularlo en los tests del caso de uso.

- En TypeORM usar el manager entregado por la transacción para todos los repositorios participantes. Inyectar un repositorio ordinario no lo incorpora al callback transaccional. Pasar manager/contexto o usar la abstracción transaccional existente; no crear un transaction scope implícito sin revisar su propagación. Ver [transacciones de TypeORM](https://typeorm.io/docs/transactions/).
- No capturar un error dentro del callback y devolver éxito si la operación exige rollback. Diferenciar fallos parciales permitidos de una operación indivisible.
- Asociaciones reemplazadas con delete→insert, traducciones y logs deben participar en el mismo límite. Crear/update/upsert y lista omitida/vacía/reemplazo necesitan semántica explícita.
- Un índice UNIQUE/FK/check respalda datos válidos ante carreras. Una comprobación `find`→`save` no reemplaza la restricción. Manejar conflictos con una respuesta de dominio apropiada.
- Elegir locks, versiones o updates condicionales según la invariante y el driver real. Dos desactivaciones o dos cambios de stock deben conservar reglas con varios procesos; un test serial no lo demuestra.
- Evaluar semántica de stock (delta, snapshot, recepción) y precisión monetaria con fuentes de producto. No inventar una decisión que cambie inventario histórico; documentar el cambio costoso según la práctica ADR local.
- DB y almacenamiento externo no comparten rollback. Evitar mantener la transacción abierta durante una llamada larga; diseñar staging/compensación/reconciliación y limpieza recuperable según el flujo. La compensación también puede fallar.
- Para idempotencia, reservar intención/ámbito y hash del payload con persistencia atómica, registrar estado/resultado, resolver reintentos simultáneos y commit con respuesta perdida. Un UUID generado por request no deduplica una intención repetida.

## Consultas construidas por entrada

- Mapear claves de filtro/orden a expresiones conocidas por recurso. Parametrizar valores; no concatenar campos/operadores desde el cliente. Que TypeORM quotee algunas columnas no protege toda expresión interpolada.
- Resolver predicados completos, incluyendo sufijos compuestos; rechazar campos desconocidos y tipos incompatibles. Probar SQL construido sin ejecutarlo si basta para reproducir interpolación, sin afirmar explotación en DB.
- Aplicar scope antes de resultados, conteos, agregados y exportaciones. Respetar orden estable y límites de página/colección; limitar también solicitudes `all` y búsquedas remotas.
- Para bulk, cargar registros/asociaciones por conjuntos y comprobar su ámbito; evitar `findOne` por elemento y fan-out sin límite. Medir consultas, memoria y errores con tamaño representativo.
- Totales globales requieren agregados del conjunto autorizado, no suma de la página actual. Documentar consistencia cuando agregados/listados se consultan por separado.

## Migraciones verificables

- Diferenciar instalación desde DB vacía y actualización de una versión existente. Revisar el historial/base schema, registro de entidades y orden de migraciones; no asumir que `synchronize` creó un baseline desplegable.
- No combinar cambios destructivos y conversión de datos sin preservar origen. Convertir antes de eliminar columnas y verificar conteos/valores; migraciones de credenciales/configuración requieren recuperación real según la política local.
- Planear compatibilidad de versiones, backup y reversión practicable. Un `down` que recrea columnas vacías no recupera datos eliminados. Ensayar restauraciones sintéticas o sanitizadas en DB aislada, sin ejecutar sobre producción por validar código.
- Verificar defaults de entidad, DTO y migración. Un nuevo flag no debe activar un canal/capacidad antes de confirmar intención y soporte.
- Validar configuración efectiva de CLI y aplicación; no probar únicamente una de ellas. Desactivar sincronización automática donde pueda alterar estado persistente fuera del control de migraciones.

## ESM y metadata

- Confirmar `type`, target/moduleResolution, decoradores y emisión de metadata del proyecto. En NodeNext usar extensiones runtime correctas en imports relativos; no copiar imports extensionless de ejemplos CommonJS.
- DTOs y clases/tokens usados para DI deben existir en ejecución. `import type` es adecuado para tipos que no necesita el runtime; no sustituir imports de clases inyectadas sin un token explícito.
- Para relaciones bidireccionales TypeORM en ESM con metadata, usar `Relation<T>` cuando evite referencias tempranas a clases, manteniendo callbacks/targets reales del decorador. No reemplazar entidades por interfaces ni alterar relaciones para silenciar un ciclo.
- Inspeccionar metadata/código emitido y ejecutar la composición compilada cuando el cambio afecte estos mecanismos. Un transpiler de tests puede omitir metadata y ocultar TDZ o fallos de resolución.
- Módulos registran/importan/exportan proveedores y repositorios necesarios, con tokens consistentes. Preferir resolver la dirección de dependencia a encadenar `forwardRef` o convertir todo en global.
- Evitar I/O operativo por importar una clase para un test. Inyectar config/dependencias y aislar composición; no iniciar conexiones reales al descubrir tests.

## Evidencia necesaria

Para rollback/locks/constraints, usar DB aislada representativa si los mocks no prueban la garantía. Para DTO/ESM/DI, inspeccionar y probar el runtime afectado. Registrar qué quedó sin verificar, respetando la política local de tests; build exitoso no equivale a migración segura ni a operación atómica.
