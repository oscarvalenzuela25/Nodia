# ADR-107 — Conciliación de un despliegue recuperado después de migrar

> Estado: propuesto, sin aprobación documental.
> Fecha: 2026-11-17

## Contexto

El intento `8014c78f` confirmó cuatro migraciones y falló al comprobar una
columna virtual en TypeORM. La recuperación autorizada activó el candidato
con el esquema confirmado y dejó operativo el backend. Ambos puntos de
admisión del CD mantuvieron el bloqueo histórico. El [ADR099](ADR-099-pre-migration-deployment-reconciliation.md)
cubre la restauración del release anterior antes de solicitar migraciones.

## Opciones consideradas

- Aplicar una excepción al ID en las dos barreras. El cambio sería pequeño,
  pero no comprobaría los efectos del intento ni la identidad del backend
  recuperado.
- Registrar evidencia verificable del efecto confirmado y de la activación.
  El receptor y el actualizador pueden usar la misma política de admisión
  y seguir verificando la evidencia cuando cambie el release activo.

## Decisión

Registrar una conciliación privada en el intento original después de
verificar el diagnóstico, la identidad del artefacto y del release recuperado,
la prueba previa de columnas persistentes, el recibo de recuperación y el
ledger exacto del candidato mediante una consulta nueva de solo lectura con
TLS. Se comprueban los procesos de API y worker, los timers, HTTP y CORS.
La herramienta operatoria se limita al intento citado.

La instalación verifica los hashes de los archivos instalados y los paquetes
revisados. Usa ambos locks del host y conserva los originales antes de cambiar
el código y sus pins. Publica el recibo de admisión al final, si los dos puntos
de admisión aceptan la evidencia y se resolvieron todos los bloqueos anteriores.
Un intento nuevo recibe su propio ID y sigue el procedimiento ordinario.

## Consecuencias

- Se conserva el fallo original junto con su `BLOCKED.json` y el historial
  de evidencias. Ese ID mantiene prohibido el reintento.
- La conciliación no ejecuta migraciones, reinicios, despliegues ni publicación
  de Pages. Un estado parcial requiere inspección operatoria.
- La verificación de una próxima entrega incluye CI de master, el resultado
  de CD, las versiones del backend y Pages y el recorrido de Caja.

## Referencias

- [Incidente y evidencia de recuperación](../../mvp/99-production-deployment-and-cicd-plan.md#34-fallo-de-entrega-productiva-de-master-b62a9029--2026-11-17).
- [Runbook de producción](../../../ops/production/README.md#conciliación-posterior-a-migración-confirmada).
