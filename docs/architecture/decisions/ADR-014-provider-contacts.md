# ADR-014 — Contactos de proveedores y datos de contacto estructurados

> Estado: propuesto
> Fecha: 2026-10-05

## Contexto

El usuario solicita una nueva tabla `personal_info_provider` para vendedores, despacho y otros contactos de proveedores comerciales, con varios teléfonos, email, horario semanal, comentario y estado. El formato persistido afecta a Server, Client y migraciones; cambiarlo después de ingresar datos tiene costo de conversión.

## Opciones consideradas

### Opción A

Objeto JSONB de teléfonos con claves ordinales como `primary` y `secondary`, y un objeto de horario por día con un único rango.

- Ventajas: coincide con el ejemplo inicial y es compacto.
- Desventajas: eliminar/reordenar teléfonos exige renombrar claves; agregar rangos en un día requiere convertir el contrato.

### Opción B

Una fila por contacto asociada a un proveedor; lista ordenada JSONB de números internacionales y objeto JSONB de días con listas de rangos horarios, ambos con contratos anidados estrictos.

- Ventajas: mantiene la tabla solicitada, permite editar/reordenar teléfonos y ampliar rangos sin claves ordinales.
- Desventajas: PostgreSQL no impone automáticamente todas las invariantes internas; DTOs y casos de uso deben validarlas. Editar un JSONB reemplaza el valor y exige definir la política de concurrencia.

### Opción C

Tablas hijas normalizadas para cada teléfono y rango horario.

- Ventajas: restricciones relacionales y actualizaciones independientes; adecuada para búsqueda global de teléfonos o planificación operativa.
- Desventajas: aumenta tablas, joins y escrituras para una agenda de contactos sin esos requisitos confirmados.

## Decisión

Se implementó la opción B bajo la autorización del usuario del 2026-10-05. `providers.fields` conserva su función de configuración de facturas. El horario pertenece a cada contacto y se almacena en `personal_info_provider.schedule`. La autorización de implementación y esta confirmación no aprueban automáticamente el ADR.

Límites: diez teléfonos E.164 por contacto; un rango por día en hora local `America/Santiago`; descripción general de 2000 y descripción de visita de 255 caracteres. Validación estricta idéntica en ambos lados. `version` se compara atómicamente al editar para impedir sobrescrituras; `creation_key` UUID y `creation_hash` evitan duplicados por reintento de creación. Un replay idéntico recupera el resultado; un payload diferente con clave usada o una edición concurrente distinta devuelve 409. El cliente conserva la intención hasta resolver un resultado incierto.

## Consecuencias

- Consecuencias positivas: contacto separado de configuración de facturas; edición de teléfonos sin claves ordinales; descubrimiento y carga de contactos bajo demanda.
- Costos o riesgos: validación anidada obligatoria; reemplazo completo JSONB protegido por versión; claves de creación retenidas junto al contacto, sin borrado físico en esta versión. No es una agenda operativa con búsqueda global por teléfono ni múltiples rangos.
- Evidencia: Server/Client implementados, casos de uso/componentes y migración/HTTP/PostgreSQL aislado verificados. Modelo global, rutas y Kanban reconciliados. Tras la incidencia del endpoint, migración aplicada en la BD local configurada con respaldo previo y comando específico. Sesión real, otros entornos y aprobación documental siguen pendientes; detalles en 31.

## Referencias

- [Propuesta de contactos de proveedores](../../mvp/31-provider-contacts-proposal.md)
- [Modelo de dominio](../../mvp/03-domain-model-erd.md)
- [Revisión técnica y alcance de autorización](../../mvp/19-prelaunch-review.md)
