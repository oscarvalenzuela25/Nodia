# ADR-113 — Recuperación de conexión en la PWA

> Estado: propuesto
> Fecha: 2026-11-21

## Contexto

Un navegador puede informar que volvió a estar en línea mientras el API de
Nodia sigue inaccesible. TanStack Query puede pausar una mutación iniciada sin
red y enviarla al reconectar. Un envío diferido excede el alcance de PWA-003
y puede confirmar cambios que la persona todavía está editando.

## Opciones consideradas

- Usar únicamente los eventos `online` y `offline`. Es inmediato y consume
  pocos recursos. Deja sin detectar los errores del servidor con red activa.
- Comprobar periódicamente servicios externos. Agrega tráfico, dependencias
  y observabilidad ajena al sitio. La respuesta tampoco acredita el API.
- Combinar señales del navegador con fallos reales del API y un reintento
  puntual contra un endpoint propio.

## Decisión

Mostrar una desconexión cuando el navegador la detecta. Con red indicada por
el navegador, los fallos de transporte y las respuestas HTTP 5xx se presentan
como problemas de comunicación con el servidor. Las respuestas de validación,
acceso y ausencia siguen el flujo de su módulo.

El reintento comprueba `GET /api/v1` sin credenciales ni caché. Si la respuesta
coincide con el contrato de liveness, se recupera la sesión por el flujo
vigente cuando corresponde y se reintentan las lecturas GET activas que
fallaron por conectividad. El estado de error se mantiene si una de esas
lecturas vuelve a fallar. Un evento real de reconexión permite una comprobación
automática por transición. El aviso y el reintento comparten el estado del
documento con los modales, donde se puede actuar sin cerrar el editor.

Las mutaciones de Client fallan de inmediato cuando están sin red en lugar de
quedar pausadas para reanudarse. El transporte rechaza escrituras antes del
envío cuando el navegador indica desconexión. Tras la recuperación, la persona
decide cuándo mandar el formulario que permanece abierto.

## Consecuencias

- El servicio de liveness comprueba alcance al API. La autorización, el
  acceso a datos y el resultado de una escritura dependen de sus solicitudes.
- Los borradores viven en la vista abierta y siguen sus límites de sesión y
  cuenta. Persistir datos privados y sincronizar cambios son entregas futuras.
- La navegación controlada usa la red. Si falla el transporte, el worker
  devuelve una página estática con reintento explícito sobre la misma URL.
  El aviso de arranque requiere un worker instalado en una visita anterior.

## Referencias

- [PWA-003](../../mvp/103-pwa-progressive-implementation-plan.md#5-pwa-003--desconexión-y-recuperación-comprensibles)
- [Actualizaciones controladas de la PWA](ADR-112-pwa-controlled-release-updates.md)
- [Modos de red de TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
