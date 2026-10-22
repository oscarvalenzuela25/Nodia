# ADR-069 — Restore en cuarentena y observación operativa de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-20

## Contexto

[AI-37](../../mvp/45-nodia-ai-implementation-plan.md) exige medir consultas y comprobar recuperación, limpieza y restauración sin duplicar efectos. [La política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md) separa reiniciar un proceso de restaurar una copia: un job `ready` en el backup pudo haberse enviado después de capturarlo. La ausencia de recibo en esa copia tampoco demuestra rollback en el dominio actual.

La recuperación normal conserva fencing y resultados inciertos, pero esas garantías no autorizan inferir ausencia de efectos posteriores al backup. Además, una excepción de recuperación no debe impedir indefinidamente la retención o su observación. Logs y alertas necesitan límites sin copiar mensajes, adjuntos o secretos.

## Opciones consideradas

### Reanudar el worker directamente sobre la copia

- Ventajas: reutiliza el arranque habitual.
- Desventajas: puede reactivar trabajo o confirmaciones obsoletas y resucitar chats borrados después del backup. No satisface la política50; se descarta.

### Restore aislado con cuarentena explícita y conciliación separada

- Ventajas: bloquea arranque antes del contexto Nest, aplica reloj actual y manifiesto externo de borrados; conserva incertidumbre sin replay.
- Desventajas: exige aislamiento de red/credenciales, journal externo completo, inventario de objetos y conciliación contra el dominio actual. El preparador por sí solo no autoriza abrir la copia.

## Decisión

Implementar la segunda opción como herramienta operacional sin endpoint HTTP o MCP. `NODIA_AI_OPERATION_MODE=quarantine` bloquea API y worker antes de crear sus contextos; un valor inválido falla. La ausencia conserva `normal` por compatibilidad con despliegues existentes. El flag no sustituye una red aislada ni el control de credenciales.

El preparador valida un manifiesto cerrado, acotado, ligado al backup y al head/pin de un journal externo confiable, con cobertura temporal hasta la cuarentena. Un hash proporcionado por el propio backup no acredita esa procedencia. No se fabrican pruebas de cobertura histórica ni se infieren eventos que nunca registró el journal.

Los permisos y confirmaciones restaurados no se reutilizan. El trabajo no terminal queda marcado como restaurado y desconocido; la recuperación/resume habituales no pueden convertirlo en un fallo seguro o enviarlo otra vez. Se conservan identidades y reservas necesarias. La purga usa el caso de uso de retención existente y el reloj actual; completar la preparación nunca equivale a autorizar la apertura.

La observación operacional usa agregados de PostgreSQL, umbrales de la política y cadencia existente, sin tablas de métricas o nuevas rutas. Diferencia ausencia de alertas observadas de disponibilidad del proveedor. El coste externo no medido permanece `null`. La observación no ejecuta inferencias ni usa resultados de otra instancia como prueba de disponibilidad.

## Consecuencias

- No se crean tablas, permisos de herramienta o historial permanente por esta decisión.
- Se conserva el orden seguro de locks, fencing, cierre/ACK y conciliación. Una copia no prueba el estado actual del proceso remoto o del dominio.
- Cada acción de mantenimiento se intenta aun cuando falle una anterior; no se añaden escritores concurrentes por ese cambio.
- Los resúmenes tienen categorías cerradas y cardinalidad constante. La consulta tiene timeout SQL; la espera del pool no se presenta como cancelación total del transporte.
- Las mediciones sintéticas y el restore aislado no prueban rotación de backups externos, journal continuo, borrado remoto o aceptación productiva. Esos gates permanecen explícitos antes de abrir un entorno restaurado.
- AI-36 conserva su aceptación pendiente. Esta decisión no amplía plazos, modelos, modos, capacidades publicadas o confirmación humana.

## Referencias

- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md).
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Entrega AI-37](../../mvp/83-nodia-ai-ai37-performance-recovery.md).
