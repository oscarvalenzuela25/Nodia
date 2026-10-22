# ADR-049 — Puertos de Negocios y separación del almacenamiento externo

> Estado: propuesto.
> Fecha: 2026-10-17.

## Contexto

AI-22 amplía el worker de efectos locales a recursos de Negocios heredados. Sus escritores no compartían uniformemente el manager del efecto: producto/log y traducciones/asociaciones podían comprometerse aparte del recibo. Contactos ya tiene claves de creación y versiones; facturas usa un intent para compensar uploads, pero no deduplica la intención conversacional. El chat aún no implementa staging de adjuntos de AI-32.

## Opciones consideradas

### Opción A — Llamar endpoints HTTP internos y guardar un recibo posterior

- Ventajas: evita cambiar firmas nativas.
- Desventajas: deja commits separados y permite duplicados si se pierde la respuesta. Una sesión de servicio no sustituye identidad del actor ni revisión humana exacta.

### Opción B — Duplicar escritores y mantener R2 dentro de la transacción del worker

- Ventajas: una adaptación aparente uniforme.
- Desventajas: copia reglas y acopla locks SQL a red externa sin rollback de objetos. No resuelve un PUT tardío ni COMMIT incierto.

### Opción C — Puertos SQL cerrados sobre escritores compartidos y protocolo externo separado

- Ventajas: efecto local y witness comparten commit; conserva reglas nativas y claves/versiones donde existen. El archivo mantiene ownership y recuperación propios.
- Desventajas: cada operación requiere validación, snapshot y proyección explícitos. Upload/promoción de adjuntos nuevos no queda habilitado sin su protocolo de staging.

## Decisión

Aplicar C mediante catorce registros internos de operaciones individuales, con el mismo manager transaccional del worker y metadata de herramienta/contrato/recurso/operación. No usar HTTP o SQL arbitrario del modelo ni crear tablas por familia. Mantener negocio de origen y objetivo inmutables en el envelope y congelar el destino efectivo resuelto por Server. Los templates internos no se aceptan como input confiable de preparación pública.

Conservar las claves/versiones nativas de contactos dentro de la intención del paso. Evitar que inicializadores de DTOs parciales añadan valores omitidos tras la vista previa. Efectos nativos compuestos, como producto más log, son una operación atómica y no una secuencia general.

Facturas admite create/update SQL sin upload nuevo. La clave de almacenamiento queda vacía al crear o preservada al actualizar; el modelo no la define. Rechazar file + manager antes del I/O. El upload nativo conserva ADR-026, pero su diario de limpieza no se considera idempotencia conversacional. La promoción de adjuntos requiere AI-32, clave independiente del chat y fases fuera de SQL; trasladar una factura con archivo se rechaza hasta implementar copia/recovery compatible con el binding negocio/clave.

## Consecuencias

- Reutiliza la recuperación, cancelación y conservación de AI-20/21 con recibos de operación de Negocios; no necesita un nuevo ledger de comandos.
- Los cambios de firma permiten heredar un manager sin alterar los endpoints existentes. Integración aislada debe comprobar rollback, locks y commit con recibo; tests con mocks no bastan.
- Acceso global autenticado y autoridad de dueño/super_admin se conservan conforme al producto. No añade aislamiento por negocio ni permisos por acción.
- Las rutas legacy masivas de productos y traslado de proveedores comparten validación de relaciones y locks con las individuales; no pueden eludir la coherencia negocio/proveedor. Productos y logs masivos comparten commit, sin publicar estas rutas como herramientas MCP de v1.
- Las lecturas/artefactos publicados de AI-15 continúan, con R2 binario real aún sujeto a su gate.
- No se declara paridad completa de archivos, publicación MCP, inferencia Gemini ni aceptación productiva por registrar los puertos.

## Referencias

- [AI-22](../../mvp/68-nodia-ai-ai22-business-operations.md), [arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md), [autoridad54](../../mvp/54-nodia-ai-ai08-transversal-authority.md), [recuperación66](../../mvp/66-nodia-ai-ai20-execution-recovery.md).
- [ADR-026](ADR-026-invoice-upload-recovery.md), [ADR-047](ADR-047-nodia-ai-local-execution-recovery.md), [ADR-048](ADR-048-nodia-ai-financial-operation-ports.md).
