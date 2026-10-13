# ADR-028 — CSV reversible de proveedores y contactos

> Estado: propuesto; implementación solicitada por el usuario, sin aprobación documental automática
> Fecha: 2026-10-11

## Contexto

Proveedores incorpora contactos uno-a-muchos. El bulk previo dividía altas/ediciones en peticiones distintas y el parser dividía por líneas/comas, por lo que no podía reimportar los campos CSV escapados de la descarga ni conservar contactos.

## Opciones consideradas

### Opción A — Una fila por contacto

- Facilita editar nombres/correos en una hoja.
- Repite y puede contradecir los datos del proveedor; agrupar contactos y distinguir ausencia/reemplazo requiere un segundo contrato de filas. No corresponde al editor provisional existente de proveedores.

### Opción B — Una fila por proveedor, contactos JSON

- Conserva cardinalidad, teléfonos, horario, IDs y versiones en una única fila; mantiene el editor provisional actual y los CSV históricos sin contactos.
- La edición manual de contactos requiere JSON; se explicita en plantilla, instrucciones y editor. Una descarga puede reimportarse directamente sin editarlo.

## Decisión

Implementar B. Columnas previas se conservan; `contacts`, `fields_json` y `csv_version=2` son adicionales. `fields_json` conserva configuraciones históricas/adicionales; las columnas de mapeo visibles prevalecen cuando cambian, preservando representaciones idénticas. Escapado reversible de celdas con prefijos de fórmula/apóstrofo y parser de comillas, CRLF, BOM y saltos de línea.

`POST /providers/import` y alias `/provider/import` procesa una sola transacción. IDs deben pertenecer al negocio/contacto declarado. Sin ID, un proveedor se resuelve por nombre normalizado en el negocio; coincidencias ambiguas exigen ID. No usar esta vía para renombrar un proveedor existente sin su ID.

Contactos incluidos se crean o actualizan; omitidos, celda vacía y `[]` conservan los existentes. Actualizaciones requieren ID/version; rechazo ante conflicto y replay idéntico de la versión inmediatamente anterior. Contactos nuevos usan una clave determinista del contenido normalizado y posición dentro del proveedor, compatible con la unicidad existente: repetir el mismo archivo no duplica personas. Tras crear, descargar los IDs antes de cambiar/reordenar contactos nuevos; una nueva posición/contenido sin ID representa otra alta. No introducir borrado implícito ni exponer claves internas de idempotencia.

Importaciones del mismo negocio se serializan con advisory lock transaccional; actualización de contactos mantiene comparación atómica de versión con los editores normales. La resolución por nombre no establece unicidad general de nombres para otros escritores; el contrato usa IDs para identidad estable. Filas/IDs duplicados que apunten al mismo proveedor se rechazan.

Descarga de vista actual solicita los IDs de la página visible y conserva su orden; descarga completa incluye activos/inactivos del negocio. Proyección explícita de contactos sin columnas internas. Consultas por conjuntos, límites explícitos: 1000 proveedores, 100 contactos por proveedor, 5000 contactos totales, CSV 2 MiB y cuerpo HTTP 4 MiB. Rechazar excesos sin truncar; parser de cuerpo exclusivo de las dos rutas de importación.

## Consecuencias

- Importación indivisible y reintentos comprobables sin migración; UI conserva borrador/error y notifica éxito/error ES/EN.
- Edición de personas en JSON y descarga posterior a altas como costo de mantener el CSV existente. Excel puede convertir IDs largos o valores antes de guardar: importar la descarga original conserva tipos, pero una conversión externa no puede revertirse automáticamente.
- El contrato no admite eliminar contactos mediante CSV. Para volumen superior se necesita un flujo de trabajos/exportación por lotes, no elevar límites silenciosamente.

## Referencias

- [Contactos y evidencia](../../mvp/31-provider-contacts-proposal.md)
- [ADR-014](ADR-014-provider-contacts.md)
- `nodia-server/test/provider-csv.integration.mjs`: HTTP/DTO/ORM compilados, PostgreSQL desechable y parser Client real, autenticación sintética.
