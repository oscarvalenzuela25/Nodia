# TODO — núcleo de iniciativas y próximas entregas

> Revisado el 2026-11-17. Creado por solicitud explícita para reunir ideas y
> especificaciones que se implementarán después. No hay prioridad nueva entre
> iniciativas, fechas comprometidas ni autorización de despliegue por este índice.

## Cómo usar este núcleo

Este archivo es la entrada única para **trabajo futuro planificado**. El detalle
y checklist viven en cada documento canónico. [00-progress](00-progress.md)
conserva el estado operativo y las incidencias; [README](README.md) es el índice
de fuentes. [12-kanban](12-kanban.md) conserva su alcance/historia de MVP, no
se utiliza para reabrir tareas superadas por cortes posteriores.

Al retomar una iniciativa:

1. Leer README, progreso y este TODO; seleccionar la iniciativa que pide el usuario.
   Si no eligió una, la posición en la tabla no decide prioridad automáticamente.
2. Abrir la especificación enlazada, su checklist y dependencias/ADR/fichas.
3. Conciliar código, Git, evidencia y entorno actual. Una rama o un checkbox viejo
   no prueba qué falta hoy; tampoco un merge demuestra aceptación del usuario.
4. Continuar desde el primer paso incompleto real del alcance, conservando lo
   comprobado. No repetir despliegues, migraciones o inferencias inciertas.
5. Registrar resultado/evidencia y siguiente paso **primero en la fuente canónica**;
   actualizar después esta fila y progreso si cambió el estado operativo.
6. Cerrar por entrega/alcance con evidencia; no marcar documentos aprobados por
   haber terminado código. Si cambia una decisión, revisar dependencias y pendientes.

Estados: `especificado` (diseño/plan sin implementación), `implementado con
validación pendiente`, `en implementación`, `bloqueado` (dependencia concreta),
`cerrado por alcance`. El estado documental/aprobación lo conserva cada fuente.

## Cola actual

| ID / iniciativa | Estado comprobado por alcance | Documento para retomar | Primera acción pendiente y dependencia |
| --- | --- | --- | --- |
| **CASH-001 — Caja de Negocios** | Especificado, con rama de desarrollo `codex/business-cash-ledger` desde `origin/development` (`0049b5fc`). R02 incluye selectores X/+, unicidad de categorías, egreso vinculado a factura y dos cards mensuales | [Plan109](109-business-cash-ledger-plan.md), [ADR106 propuesto](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md), [ficha candidata](../nodia-ai/knowledge/businesses/features/cash-ledger-and-invoice-expenses.md) | **CASH-01**: cerrar contratos HTTP, reglas y orden de bloqueo. La integración OCR de CASH-04 depende de una confirmación transaccional e idempotente |
| **PWA-002 — caché y actualización** | Especificado, sin implementación acreditada | [Plan103](103-pwa-progressive-implementation-plan.md) §4 | Retomar contrato de actualización/caché estática y preservar borradores; depende de base001 y compatibilidad de artefactos |
| **PWA-003 — desconexión** | Especificado | [Plan103](103-pwa-progressive-implementation-plan.md) §5 | Diseñar estado offline/recuperación;002 para arranque sin red. No promete datos offline |
| **PWA-004 — push** | Especificado; eventos sin concretar | [Plan103](103-pwa-progressive-implementation-plan.md) §6 | Elegir eventos/destinatarios/consentimiento y contrato de suscripción. No requiere escrituras offline |
| **PWA-005/006 — datos offline y sincronización** | Especificado como evolución, sin módulo elegido | [Plan103](103-pwa-progressive-implementation-plan.md) §7–8 | Elegir módulo/datos, privacidad/retención; después conflictos/idempotencia de escrituras. No ampliar todos los módulos por defecto |
| **OBS-001 — Grafana, primera entrega operativa** | G0/documentación e inventario; Grafana Cloud Free elegido. Sin cuenta/stack, Alloy, ingesta o alertas acreditados | [Plan104 §8–9](104-logs-and-monitoring-grafana-cloud.md#8-secuencia-de-configuración-posterior), [ADR101 propuesto](../architecture/decisions/ADR-101-grafana-cloud-observability.md) | G1: cuenta/stack/región/Free efectivo/correo/host. Después G2–G6 con configuración, saneamiento antes de exportar, alertas y consumo real. Credenciales por custodia segura |
| **OBS-002 — eventos de CI/CD** | Especificado como entrega separada G7 | [Plan104](104-logs-and-monitoring-grafana-cloud.md) §6 y§8 | Definir emisor desde recibo saneado y validar fallo/entrega parcial; Alloy no observa por sí solo el runner de GitHub. Sin replay ni dependencia de telemetría para publicar |
| **NEWS-001 — Noticias bajo demanda** | Implementado, integrado y publicado: PR46/development y PR47/master, SHA03206aa1; CI43967669633/CD43969486953 correctos, backend/Client completos. GET público posterior200/TLS verificado, ambas fuentes y0artículos; no se ejecutó refresh en esta consulta | [Plan105 §15](105-on-demand-tech-news.md#15-promoción-y-publicación-comprobadas--2026-11-16), [CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/43969486953), [guía de entrega](../features/news/deployment-readiness.md) | Primera actualización explícita por fuente desde sesión super_admin y verificación de lectura pública/permisos/UI en producción, seguida de aceptación humana. Teléfono e inspección visual nativa200% pendientes. No repetir PR/promoción/despliegue; daily.dev/GitHub quedan fuera de esta entrega |
| **OPS-05 — retención global y disco físico** | Pendiente independiente; archivo automático del inbox ya entregado. OPS-001 cerrado por alcance | [Plan99 §33](99-production-deployment-and-cicd-plan.md#33-cierre-ops-001-y-separación-de-ops-05--2026-11-16), [alcance técnico§32](99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16) | Especificar conservación de releases/diagnósticos, duración/capacidad, protecciones y retirada u offload para liberar disco físico. No repetir archivo del inbox, que sólo libera cuota lógica; sin purga de backups/secretos/evidencia por defecto |

## Entregas cerradas por alcance

Aceptación humana registrada el2026-11-16 por instrucción del usuario: THEME-001
pasó QA; PWA-001, TUX-001 y NAIUX-001 funcionan bien y deben cerrarse. El cierre
sucede los pendientes humanos de esos alcances en los cortes anteriores. No
identifica nuevos dispositivos/entornos ni ejecuta adopciones o aprueba fichas/ADR.

El 2026-11-17 el usuario solicita cerrar PCON-001, OCR-001, BIZ-042 y TUX-03/05.
La integración en Git se comprobó para las cuatro entregas. La verificación
funcional por entorno conserva los límites documentados en sus planes.

| ID / iniciativa | Entrega aceptada | Fuente de cierre y límites |
| --- | --- | --- |
| **THEME-001 — temas personales** | Cerrado: catálogo, selector y persistencia local; QA aceptado por el usuario | [Plan108 §9](108-user-theme-presets.md#9-cierre-por-aceptación-humana--2026-11-16). Evidencia técnica previa conservada; no se ejecutó despliegue nuevo |
| **PWA-001 — instalación online** | Cerrado: instalación/iconos/ventana propia y funcionamiento online aceptados | [Plan103 §15](103-pwa-progressive-implementation-plan.md#15-cierre-de-pwa-001-por-aceptación-humana--2026-11-16). Publicación HTTPS previa conservada; no acredita toda la matriz por dispositivo. PWA-002…006 siguen en cola |
| **TUX-001 — Teacher fácil de entender** | Cerrado: alta guiada, paneles, cabecera/drawer y revisión legible del plan entregados y aceptados | [Plan106 §14](106-nodia-teacher-guided-ux-redesign.md#14-cierre-tux-001-por-aceptación-humana--2026-11-16) |
| **NAIUX-001 — evolución UX/UI de NodiaAI** | Cerrado: workspace/compositor, historial/filtros, burbujas y cabecera móvil entregados y aceptados | [Plan107 §16](107-nodia-ai-ux-ui-upgrade-plan.md#16-cierre-naiux-001-por-aceptación-humana--2026-11-16). Despliegue base histórico conservado; continuaciones visuales no heredan una adopción nueva por la aceptación |
| **OPS-001 — entrega CD recuperable** | Cerrado: transporte v2, reserva/preflight, estado durable, continuación de bytes y archivo automático del inbox entregados en producción con cierre administrativo | [Plan99 §33](99-production-deployment-and-cicd-plan.md#33-cierre-ops-001-y-separación-de-ops-05--2026-11-16), [recibo completo](../evidence/durable-backend-uploads-20261116.md). Usuario solicita cierre; OPS-05 sigue en cola. Sin nuevas acciones productivas, limpieza o replay |
| **PCON-001 — apertura de Contactos** | Cerrado por alcance. Recuperación local ante fallo de carga integrada mediante PR 48 y 49 | [Plan31](31-provider-contacts-proposal.md#cierre-de-pcon-001--2026-11-17). Si reaparece el 404, capturar petición, error y versión de la sesión afectada |
| **OCR-001 — revisión de factura y selección IA** | Cerrado por alcance. Revisión compacta, defaults y selección exacta integrados mediante PR 48 y 49 | [Plan94 §43](94-business-point-of-sale-and-product-refactor.md#43-cierre-de-ocr-001-y-biz-042--2026-11-17), [QA local](../evidence/invoice-ocr-review-defaults-20261116.md) |
| **BIZ-042 — precios, división y proveedores OCR** | Cerrado por alcance. Ajustes de precios, proveedores y factura integrados mediante PR 50 y 51 | [Plan94 §43](94-business-point-of-sale-and-product-refactor.md#43-cierre-de-ocr-001-y-biz-042--2026-11-17), [QA local](../evidence/business-pricing-ocr-adjustments-20261117.md). Migración operativa y habilitación OCR requieren evidencia propia |
| **TUX-03/05 — guía y continuidad de Teacher** | Cerrado por alcance. Guía, diagnóstico opcional y continuidad integrados mediante PR 50 y 51 | [Plan106 §16](106-nodia-teacher-guided-ux-redesign.md#16-cierre-de-tux-0305--2026-11-17), [QA local](../evidence/teacher-guided-continuity-20261116.md) |


Mantenimiento solicitado2026-11-16 completado:247capturas de validación
(16486902bytes) fuera del árbol Git, originales locales intactos/ignorados y
[catálogo de hashes/enlaces históricos](../evidence/validation-images-archive-20261116.md).
Sin reescritura del historial, assets funcionales o JSON de evidencia alterados.

## Añadir nuevas ideas sin perder el contexto

Añadir una fila con ID estable, resultado esperado, estado comprobado, documento
canónico, primer pendiente y dependencias. Si sólo existe una idea, escribir
«por especificar» y el problema que resuelve; no fingir que está lista para construir.
No crear una segunda especificación dentro de esta tabla. Cuando haya alcance
funcional, crear/actualizar fichas NodiaAI y enlaces conforme al estándar.

Mantener IDs originales de entregas como PWA-001. OBS/NEWS/TUX/NAIUX son identificadores
de seguimiento, no permisos, rutas, herramientas o prioridades. Una idea retirada
se conserva con motivo y destino si fue reemplazada, sin borrar evidencia histórica.

## Corte de verificación

Esta conciliación usa documentación/código y referencias Git disponibles en el
checkout; no consultó producción, cuentas Grafana o dispositivos. Plan103§12 y
evidencia posterior suceden el texto de publicación pendiente de103§11; la
comprobación HTTPS no acredita instalación humana. Noticias tiene dos fuentes
publicadas por105§15, con CI/CD y GET público comprobados; primera actualización
y aceptación humana pendientes. Diseño/ADR siguen en revisión.
La confirmación humana2026-11-16 cierra THEME-001/PWA-001/TUX-001/NAIUX-001
por sus alcances entregados; no procede de automatización ni amplía pruebas por
dispositivo. Nuevas evidencias actualizan primero sus documentos enlazados.
