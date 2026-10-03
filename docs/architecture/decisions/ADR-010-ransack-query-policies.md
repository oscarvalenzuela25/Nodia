# ADR-010 — Políticas explícitas para consultas Ransack

> Estado: propuesto; implementación local bajo autorización de desarrollo, sin aprobación documental automática
> Fecha: 2026-10-03

## Contexto

El constructor compartido de Nodia Server interpolaba campos de filtro/orden enviados por el cliente. Normalizar ASC/DESC no limita la expresión de columna. Sufijos compuestos como `not_eq` y `not_null` se separaban incorrectamente y algunos operadores declarados no se implementaban. La superficie afecta 14 consultas de administración, negocio e IA. El usuario confirmó acceso global entre negocios y administración sin permisos por acción para su público específico; esta decisión trata validez/seguridad de consultas, sin imponer aislamiento nuevo.

## Opciones consideradas

### Opción A — Exponer automáticamente todas las columnas del ORM

- Ventajas: poca configuración y compatibilidad automática al añadir columnas.
- Desventajas: nuevas columnas/credenciales/JSON ampliarían la superficie pública accidentalmente; getters y relaciones no se corresponden necesariamente con columnas.

### Opción B — Políticas de campos y tipos declaradas por recurso

- Ventajas: superficie pública revisable; campos arbitrarios y relaciones no registradas se rechazan; mappings de alias son explícitos y los tipos guían operadores/valores.
- Desventajas: entidades, políticas y DTOs deben mantenerse alineados; nuevas opciones de UI requieren declarar su contrato ejecutable.

## Decisión

Se implementa localmente la opción B en `nodia-server/src/common/utils/ransack-query.policies.ts`. Cada llamada a `applyRansack` debe pasar su política explícita; no hay fallback a todas las columnas. El constructor reconoce sufijos completos, valida columna/dirección/operador/valor y usa parámetros únicos para datos. Los campos y mappings pertenecen al servidor, nunca al payload.

Se conserva el formato `q[campo_predicado]` y un ordenamiento `q[s]` por solicitud. Dirección omitida equivale a ASC; direcciones desconocidas, expresiones, relaciones no registradas o arrays de ordenamiento producen 400. Los DTOs HTTP siguen delimitando los predicados expuestos; declararlos en el tipo TypeScript no los publica automáticamente.

Se limitan 32 entradas por objeto q, nombres de clave de 128 caracteres, 1000 elementos por lista y 2048 caracteres por valor de texto. La envolvente se valida antes de consumir filtros especiales de roles, stock, variación de precio y fechas de factura. Los filtros ordinarios se validan completamente antes de agregar cláusulas. Esto no limita por sí solo el número de filas, el costo de subconsultas especiales ni la duración de una consulta.

Las búsquedas `cont`, `not_cont`, `start` y `end` tratan `%`, `_` y `!` como texto literal mediante `ESCAPE '!'`. `in=[]` no encuentra registros; `not_in=[]` no excluye registros. `null`/`not_null` se activan con flag verdadero y se omiten con falso. Identificadores bigint se conservan como strings; se rechazan valores/fechas inválidos sin fabricar defaults.

## Consecuencias

- Consecuencias positivas: eliminación local de interpolación arbitraria, corrección de predicados negativos/nulos y límites consistentes; `ai_provider.key` mapea a `catalog.key`, incluso con includes=false; alias connection_id mapea a provider_id donde corresponde.
- Costos o riesgos aceptados: clientes que enviaban expresiones, direcciones incorrectas o comodines SQL implícitos obtienen rechazo o búsqueda literal; revisar tamaño de listas de integraciones existentes. Un campo SQL público no autoriza automáticamente un nuevo predicado HTTP.
- Trabajo posterior: probar consultas y planes con PostgreSQL aislado/volumen representativo, mantener DTOs/políticas/consumidores alineados y resolver límites de filas, paginación, costo de stock/precios e índices como tareas separadas. No modificar políticas de acceso global por esta entrega.

## Referencias

- [Auditoría y seguimiento](../../mvp/19-prelaunch-review.md).
- [OWASP: prevención de inyección SQL](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
- [QueryBuilder de TypeORM](https://typeorm.io/docs/query-builder/select-query-builder/).
