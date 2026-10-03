# Autorización, DTOs y salida pública

Leer al cambiar entrada HTTP, guards, permisos, actor/tenant o representación de respuestas.

## Cobertura de políticas

Inventariar método, ruta y aliases, política pública/propia/por acción, ámbito y caso de uso. Revisar también listados, URLs firmadas, exportaciones y análisis costosos. No inferir permisos de la UI ni del nombre del controlador.

- Inspeccionar guards globales, de controlador y de método; validar precedencia de `Reflector.getAllAndOverride`/combinación elegida y excepciones anónimas. Método y clase pueden declarar reglas distintas.
- Si la falta de metadata permite continuar, exigir clasificación de rutas sensibles y una verificación de cobertura adecuada al repositorio. No convertir automáticamente toda ruta sin decorador en pública ni romper auth, refresh o endpoints propios legítimos.
- Verificar composición `APP_GUARD`/`useExisting`: identidad autenticada debe existir al evaluar permisos del actor. Evitar instancias duplicadas con estado distinto o un guard creado manualmente sin dependencias necesarias.
- En autorización por negocio, resolver pertenencia/acciones reales. Pasar un contexto confiable al caso de uso; no aceptar un actor enviado en body como prueba de identidad. Proteger llamadas desde jobs/mensajes según sus políticas.
- Aplicar scope en la consulta y asociaciones: producto, proveedor, factura y archivo deben pertenecer al ámbito autorizado. No basta validar la existencia individual de IDs.
- La asignación de privilegios exige reglas explícitas sobre quién puede otorgarlos. Invariantes como un rol reservado o último administrador activo pertenecen al producto y deben soportar concurrencia, cuando existan.

## DTOs que realmente validan

Nest necesita clases concretas e imports de valor para identificar DTOs en ejecución. `@Query() query: Partial<CreateDto>` produce un tipo estático, sin la clase requerida por `ValidationPipe`. `PartialType` crea una clase, pero no elimina campos que deban ser inmutables. Ver [validación oficial de Nest](https://docs.nestjs.com/techniques/validation).

- Revisar configuración real del pipe: transformación, campos desconocidos, propiedades omitidas/nulas y errores. No asumir que Swagger o un tipo enum valida `@Query('engine') engine: Engine`.
- Definir DTO concreto para query/params y para cada comando. Si se usa un pipe por parámetro, debe validar el dominio apropiado; escoger UUID/int/string según los IDs reales del proyecto.
- Para arrays/objetos anidados, usar validación y transformación de elementos apropiadas o un esquema explícito. Acotar cardinalidad, profundidad y longitud antes de trabajo costoso. Un objeto libre requiere un contrato para sus campos sensibles.
- Mantener diferencias entre ausencia, null, vacío, cero y false. Revisar cómo los validadores instalados tratan `@IsOptional()` y cómo la persistencia trata colecciones vacías; no inferirlo del nombre del decorador.
- Coerciones aceptan únicamente formatos acordados. `Number('')`, `Boolean('false')`, parseo JSON con catch→`{}` y `value || default` pueden fabricar valores válidos. Probar representaciones multipart/query y formatos numéricos límite.
- Validar cada origen y el comando compuesto si se mezclan query/body/config. Documentar precedencia y rechazar modo/engine/instancia contradictorios. El objeto final no adquiere validación porque un fragmento pasó el pipe.
- La capa de aplicación conserva las invariantes necesarias para llamadas sin HTTP, sin duplicar el mismo esquema en cada adaptador.

## Serialización y errores

- Proyectar una respuesta pública con campos admitidos. Revisar entidades, relaciones y JSON anidado; `select: false` protege la carga ordinaria de una columna, no todos los objetos creados en memoria ni otros campos JSON.
- No retornar entidades/fields arbitrarios si pueden contener credenciales. Separar esquema público y estado interno; evitar sanear mutando el mismo objeto que luego se persiste.
- DTOs/configuración públicos no deben exponer cookies, tokens, ciphertext ni contenido personal completo. Probar con marcadores sintéticos y casos anidados, sin leer secretos reales.
- No fabricar capacidades, modelos seleccionados, disponibilidad, cuotas o unidades por falta de datos. Desconocido permanece desconocido, y no habilita una capacidad sin evidencia.
- Traducir errores de dominio/transporte sin perder validación, permiso, conflicto, cuota, timeout y disponibilidad. Un filtro que admite todo `HttpException` puede filtrar mensajes de SDK incrustados en un 500; construir mensajes seguros en el adaptador.

## Regresiones útiles

| Entrada/actor | Resultado esperado |
|---|---|
| Usuario común sobre administración; nueva ruta/alias sin policy | Operación sensible rechazada, cobertura explícita |
| Actor válido con ID/relación/archivo de otro ámbito | Ninguna lectura, firma o escritura ajena |
| Modelo de query genérico o enum solo anotado | El dato inválido es rechazado por un mecanismo runtime comprobado |
| JSON roto, importe inválido, cero, null, vacío | Rechazo o conservación según contrato; nunca default accidental |
| Body/query/config contradictorios | El comando final no cambia identidad/modo fuera de contrato |
| Fields con secreto anidado | El valor sintético no aparece en respuesta ni log público |

## Orden de ejecución relevante

Los guards anteceden a interceptores y pipes; un guard no debe confiar en que el DTO ya fue validado por estos. El parsing de middleware puede ocurrir antes de los guards. Ver [ciclo de petición de Nest](https://docs.nestjs.com/faq/request-lifecycle). Colocar controles baratos de transporte/admisión donde realmente protejan el costo previo, respetando autenticación y semántica HTTP del producto.
