# ADR-026 — Creación de factura con compensación recuperable de R2

> Estado: implementado por solicitud del usuario; documento en revisión
> Fecha: 2026-10-10

## Contexto

El usuario solicita que un fallo al guardar el archivo o la factura no deje el otro efecto aislado. POST `/invoices/analyze` solo extrae información. POST `/invoices` subía el archivo antes del INSERT sin compensación. R2 no participa en una transacción PostgreSQL: un rollback SQL no elimina un objeto, y un timeout de PUT no demuestra que el objeto no se haya creado.

## Opciones consideradas

### Opción A — Transacción SQL con PUT dentro

- Ventajas: implementación corta, revierte el registro si PUT arroja error.
- Desventajas: mantiene conexión/locks durante red externa; no revierte R2, ni cubre caída del proceso/COMMIT incierto. No satisface la garantía solicitada.

### Opción B — PUT seguido de DELETE compensatorio en catch

- Ventajas: elimina el objeto en fallos ordinarios del INSERT.
- Desventajas: pierde la limpieza al reiniciar y si DELETE también falla; puede eliminar un archivo válido si el COMMIT ocurrió sin respuesta.

### Opción C — Intento persistido antes de PUT y confirmación transaccional

- Ventajas: recupera caídas, eliminación fallida y resultado incierto, coordina réplicas y conserva objetos referenciados.
- Desventajas: tabla/migración y proceso periódico; consistencia eventual entre dos sistemas, nunca atomicidad instantánea distribuida.

## Decisión

Implementar C para creación de factura con archivo. Sin modificar el contrato HTTP ni el análisis, y sin cambiar stock/importación de productos:

1. Validar el archivo y generar clave UUID exclusiva `invoices/{business_id}/{uuid}.{ext}`. El DTO no se modifica.
2. Insertar el intento en `invoice_uploads` antes de cualquier PUT. Si falla la persistencia, no iniciar la subida.
3. Ejecutar PUT fuera de la transacción SQL, con límite de espera de 60s.
4. Confirmar con transacción corta: bloquear el intento aún vigente/no reclamado, guardar factura usando su EntityManager y eliminar el intento. Ambas escrituras confirman o revierten juntas; statement_timeout10s y lock_timeout5s por sentencia, sin prometer un deadline HTTP total.
5. Ante error, consultar si la factura ya quedó confirmada por esa clave y devolverla si se puede comprobar. En otro caso, reclamar limpieza del intento; no eliminar objetos asociados a una factura. Si la BD está inaccesible, mantener el intento durable y no borrar a ciegas.
6. Un caso de uso de recuperación reclama pendientes mediante CTE UPDATE/SELECT, FOR UPDATE SKIP LOCKED y lease de60s. La transacción de confirmación y la reclamación se serializan sobre la misma fila; una limpieza iniciada impide confirmar. DELETE idempotente de la clave exacta tiene límite10s y ocurre fuera de transacciones.
7. Conservar un marcador hasta diez minutos después de registrar el intento y repetir DELETE entonces: cubre un PUT cuyo efecto remoto llega después de la primera compensación. Fallos de limpieza conservan el registro con backoff60s..1h. No se descartan por superar intentos.
8. Worker NestJS al iniciar y cada minuto, sin solapamiento local, hasta cinco objetos por ciclo. Al cerrar, retirar timer y esperar el ciclo activo. `idx_invoices_path_storage` evita escanear facturas para comprobar referencias; índice de retry_after para pendientes.

## Consecuencias

- Si PUT falla, no se crea la factura. Si la transacción SQL falla, se intenta eliminar inmediatamente el archivo. Durante una caída de R2 puede existir un objeto pendiente de eliminación: no afirmar que una transacción SQL hace ambas operaciones atómicas.
- Requiere migración incremental `1791630000000-CreateInvoiceUploads`; rollback rechaza eliminar el diario si hay pendientes. Comando acotado `npm run migration:invoice-uploads` conserva las demás migraciones.
- El token R2 necesita permiso efectivo de eliminación. Si se revoca, la cola permanece y emite eventos seguros de limpieza aplazada. Un período de gracia no prueba un límite del proveedor para una escritura remota incierta; verificar transportes y recuperación reales en el despliegue.
- La recuperación solo gestiona claves nuevas registradas en este diario. No lista ni elimina archivos históricos/ajenos. Creación sin archivo y path_storage histórico conserva contrato.
- No resuelve idempotencia entre nuevas peticiones HTTP ni factura/productos/stock/movimientos en una única operación: S-05 permanece abierto. Una respuesta HTTP perdida después del guardado aún necesita un contrato de confirmación/idempotencia para evitar duplicación si el cliente hace otra petición.
- Pruebas locales: casos de uso y PostgreSQL16 desechable con AWS SDK contra S3 sintético en loopback; no equivalen a comprobar permisos, indisponibilidad o timing reales de Cloudflare.

Evidencia de entrega:857 pruebas en114 archivos Server, compilación/tipado correctos y lint sin avisos nuevos (dos previos de IA);18 comprobaciones de integración y pipeline HTTP de acceso a facturas correctos. Migración aplicada a la BD local configurada, verificada en loopback y repetida sin nuevos cambios. No se creó factura/objeto real ni se ejecutó inferencia; falta comprobar token/recuperación contra R2 real y despliegue productivo.

## Referencias

- [S-05](../../mvp/19-prelaunch-review.md), integridad de importación.
- [Transacciones TypeORM](https://typeorm.io/docs/advanced-topics/transactions/).
- [API S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/), soporte de PUT/DELETE por objeto.
