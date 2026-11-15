# ADR-102 — Alias humano de producto y completitud de identificadores

> Estado: propuesto
> Fecha: 2026-11-14

## Contexto

El usuario solicita conservar el nombre original de factura y permitir un nombre
humano buscable (`alias`). Un producto puede existir antes de recibir un código
de proveedor o de barras; esos identificadores siguen siendo distintos. La
importación OCR existente guarda factura y productos mediante peticiones
separadas, con revisión humana y recuperación de resultados inciertos.

## Opciones consideradas

### Opción A: sustituir `name` o tratar el alias como identidad

- Simplifica la presentación inicial.
- Pierde el nombre original, mezcla identidad/matching con presentación y puede
  asociar productos distintos por un texto que no es único.

### Opción B: alias nullable independiente y revisión explícita del borrador OCR

- Conserva el nombre original, IDs, código/barcode y sus índices/contratos.
- Permite nombre o alias en búsqueda paginada y conserva historia desconocida.
- Exige extender DTOs, formulario, CSV, snapshots y recuperación de guardado.

## Decisión

Implementar B conforme a la solicitud funcional explícita. `products.alias` y
`product_logs.alias` son varchar255 nullable, sin backfill del nombre a históricos.
Omitir alias al actualizar conserva el valor; null o texto vacío tras trim lo
deja sin asignar. Alias no es único, no identifica ni decide matching OCR.

«Utilizar el nombre como alias» es una decisión del formulario: guarda una copia
explícita de `name`, sin otro booleano persistido. El alias personalizado no sigue
cambios posteriores de nombre automáticamente. Escribir texto no vacío desmarca
el checkbox; borrar o escribir sólo espacios lo marca.

Nuevas filas OCR y productos existentes sin alias necesitan revisión explícita:
escribir alias o elegir usar nombre y guardar el editor local. La IA no extrae,
inventa ni confirma alias. Los comandos de todas las filas se validan antes de
guardar la factura. No se declara atomicidad global de un flujo de varias
peticiones; se conservan recuperación/idempotencia existentes.

`q.search` busca literalmente nombre OR alias y no cambia `name_cont` o la
identidad de código/barcode. `q.code_presence` y `q.barcode_presence` admiten
present/missing; Todos omite el parámetro. Nulo, vacío o sólo whitespace es ausente.
Se parametrizan valores y los dos campos son constantes, sin SQL libre.
Modificar alias exige expected_version; snapshots automáticos guardan su valor
de esa revisión sin completar logs históricos con el alias actual.

## Consecuencias

- Alias mejora lectura/búsqueda y sigue siendo opcional para el contrato nativo.
- La columna requiere migración previa al despliegue del código que la consulta.
  Revertir después de escribir alias requiere respaldo; no se borran datos nuevos
  con un down destructivo ni se inventa un alias anterior.
- No se añaden índices sin evidencia de consulta/cardinalidad. La búsqueda y
  los filtros se aplican antes de paginar, dentro de la autoridad de negocio.
- CSV añade columna alias; importaciones antiguas que la omiten lo conservan.
- El POS recibe la búsqueda común de productos, sin ampliar aquí su interfaz,
  estados, contratos comerciales o snapshots de ventas.
- Las herramientas IA publicadas conservan su superficie cerrada. Documentar
  esta feature no habilita escritura/lectura nueva ni publica fichas candidatas.

## Referencias

- [Plan94§38](../../mvp/94-business-point-of-sale-and-product-refactor.md#38-alias-humano-de-productos-y-revisión-ocr--solicitud2026-11-14).
- [ADR095](ADR-095-independent-product-prices-and-reviewed-invoice-binding.md).
- [ADR010](ADR-010-ransack-query-policies.md).
- [Ficha candidata](../../nodia-ai/knowledge/businesses/features/product-alias-and-code-completeness.md).
