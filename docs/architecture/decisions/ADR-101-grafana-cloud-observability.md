# ADR-101 — Grafana Cloud Free y recolector Alloy para observabilidad

> Estado: propuesto
> Fecha: 2026-11-14
> Selección del proveedor/plan: Grafana Cloud Free elegida explícitamente por el usuario. Esta selección no aprueba íntegramente el ADR ni acredita instalación.

## Contexto

Nodia tiene API/worker/servicios con logs en journald y frontend en Pages. Los
fallos de entrega se producen también en runners GitHub/Cloudflare, fuera del
VPS. Logs actuales contienen ramas de mensajes libres y no cubren duración de
todos los errores HTTP; no se deben exportar indiscriminadamente. Se requiere
centralizar observabilidad con presupuesto gratuito y operación acotada.

## Opciones consideradas

### Opción A — Better Stack, Sentry o Axiom

- Ventajas: plataformas administradas; Sentry tiene SDK para React/NestJS y las
  otras alternativas ofrecen ingestión de logs.
- Desventajas: límites/cobertura diferentes; la comparación vigente y sus fuentes
  están en104. No se seleccionan proveedores paralelos para la primera entrega.

### Opción B — Grafana Cloud Free con Alloy en el VPS

- Ventajas: logs/métricas administrados y sondas externas; aprovecha journald y
  la integración Linux sin alojar una plataforma de almacenamiento en el VPS.
- Desventajas: cuotas y retención finitas, consumo local del agente por medir,
  permisos de lectura y saneamiento previo; CI necesita una entrada separada.

### Opción C — Stack Grafana/Loki/Prometheus o Uptime Kuma autoalojados

- Ventajas: control de alojamiento; software abierto.
- Desventajas: almacenamiento, actualizaciones y recuperación propios. Kuma
  cubre disponibilidad y no sustituye logs. Alojar el monitor en el mismo VPS
  comparte su dominio de fallo; se requiere observación externa igualmente.

## Decisión

La elección humana es B. Se propone este detalle técnico, previo a implementar:

1. Mantener Grafana/Loki/almacenamiento de métricas y alertas en Cloud Free;
   instalar sólo Alloy como servicio Linux, con identidad propia y salida TLS.
2. Recoger métricas del host y unidades explícitas. Exportar logs únicamente
   después de revisar su completitud y aplicar allowlist/saneamiento. Sin
   credenciales, contenido de negocio o mensajes privados libres.
3. Comprobaciones públicas externas sobre destinos seguros; liveness no prueba
   readiness DB/Redis, worker, inferencia o corrección de todas las rutas.
4. Integrar eventos saneados del recibo CI/CD en una fase separada. El fallo de
   telemetría no autoriza retry/rollback ni altera los gates de publicación.
5. Etiquetas estables y control de cuotas; no planes de pago, cuotas de trial
   como capacidad permanente o cifras de consumo inventadas. Tokens limitados
   al stack, fuera de frontend/repositorio/chat y sin puertos públicos nuevos.

## Consecuencias

- Positivas: evidencia centralizada y alertas externas sin otra base de datos
  de observabilidad en el host de Nodia; los contratos de negocio permanecen.
- Costos/riesgos: retención limitada, dependencia de conectividad/proveedor,
  posible pérdida/rechazo por cuotas y costo de recursos todavía sin medir.
  La ausencia de telemetría no equivale a cero errores.
- Trabajo posterior: cuenta/stack/región/Free, permisos, saneamiento HTTP/Redis,
  configuración Alloy, checks, correo, pruebas/consumo y runbook de retirada.
  No hay instalación o aceptación operativa acreditadas por este documento.

## Referencias

- [Plan104: comparación, inventario, flujo, límites y etapas](../../mvp/104-logs-and-monitoring-grafana-cloud.md).
- [Plan99 de producción](../../mvp/99-production-deployment-and-cicd-plan.md) y [ADR097](ADR-097-monorepo-production-release-pipeline.md).
- [Grafana Cloud Free](https://grafana.com/pricing/), [Alloy Linux](https://grafana.com/docs/alloy/latest/set-up/install/linux/), [lectura de journal](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.journal/), [sondas externas](https://grafana.com/docs/grafana-cloud/observe-and-act/testing/synthetic-monitoring/introduction/).
