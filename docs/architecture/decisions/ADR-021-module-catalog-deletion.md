# ADR-021 — Eliminación transaccional de módulos y grupos

> Estado: propuesto (implementación local por solicitud explícita; documento no aprobado automáticamente)
> Fecha: 2026-10-09

## Contexto

El usuario solicita eliminar módulos y grupos desde Ajustes. El DELETE de módulo respondía con un stub; los grupos no ofrecían eliminación. UserModule referencia módulos y las traducciones son polimórficas sin limpieza por FK. Un grupo con cualquier módulo debe permanecer, incluso si está inactivo.

## Opciones consideradas

### Opción A — Solo desactivar

- Ventajas: conserva asignaciones e identidad.
- Desventajas: no satisface la eliminación solicitada; deja filas sin uso.

### Opción B — Eliminación permanente transaccional

- Ventajas: comportamiento explícito, limpia asignaciones/traducciones del registro, evita huérfanos y carreras.
- Desventajas: es irreversible; recrear un módulo no restaura asignaciones. Requiere confirmación y comunicar consecuencias.

## Decisión

Implementar B como acción adicional; conservar Activar/Desactivar. DELETE módulo limpia user_modules y traducciones modules antes del registro, dentro de una transacción. DELETE grupo rechaza 409 si tiene módulos y limpia exclusivamente traducciones module_groups. Bloquear fila padre FOR UPDATE; las FK NO ACTION existentes serializan nuevas asociaciones. Invalidar autorización después del commit. Casos de uso concentran lógica y controladores solo validan/delegan.

## Consecuencias

- Listas y navegación se actualizan tras éxito; una limpieza fallida revierte todas las filas.
- Sin migración ni cambio de protección global. IDs bigint permanecen strings con validación de rango.
- Confirmación describe permanencia/asignaciones; fallo conserva target y permite reintento.
- Pruebas unitarias de casos de uso e integración PostgreSQL temporal comprueban rollback y ambos órdenes de asociación concurrente.

## Referencias

- [Contrato de Modules](../../../nodia-client/src/modules/generalSettings/pages/Modules/CONTRACT.md)
- [Reglas de diseño](../../../nodia-client/DESIGN.md)
