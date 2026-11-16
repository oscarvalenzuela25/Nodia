# TODO — núcleo de iniciativas y próximas entregas

> Revisado el 2026-11-16. Creado por solicitud explícita para reunir ideas y
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
| **PWA-002 — caché y actualización** | Especificado, sin implementación acreditada | [Plan103](103-pwa-progressive-implementation-plan.md) §4 | Retomar contrato de actualización/caché estática y preservar borradores; depende de base001 y compatibilidad de artefactos |
| **PWA-003 — desconexión** | Especificado | [Plan103](103-pwa-progressive-implementation-plan.md) §5 | Diseñar estado offline/recuperación;002 para arranque sin red. No promete datos offline |
| **PWA-004 — push** | Especificado; eventos sin concretar | [Plan103](103-pwa-progressive-implementation-plan.md) §6 | Elegir eventos/destinatarios/consentimiento y contrato de suscripción. No requiere escrituras offline |
| **PWA-005/006 — datos offline y sincronización** | Especificado como evolución, sin módulo elegido | [Plan103](103-pwa-progressive-implementation-plan.md) §7–8 | Elegir módulo/datos, privacidad/retención; después conflictos/idempotencia de escrituras. No ampliar todos los módulos por defecto |
| **OBS-001 — Grafana, primera entrega operativa** | G0/documentación e inventario; Grafana Cloud Free elegido. Sin cuenta/stack, Alloy, ingesta o alertas acreditados | [Plan104 §8–9](104-logs-and-monitoring-grafana-cloud.md#8-secuencia-de-configuración-posterior), [ADR101 propuesto](../architecture/decisions/ADR-101-grafana-cloud-observability.md) | G1: cuenta/stack/región/Free efectivo/correo/host. Después G2–G6 con configuración, saneamiento antes de exportar, alertas y consumo real. Credenciales por custodia segura |
| **OBS-002 — eventos de CI/CD** | Especificado como entrega separada G7 | [Plan104](104-logs-and-monitoring-grafana-cloud.md) §6 y§8 | Definir emisor desde recibo saneado y validar fallo/entrega parcial; Alloy no observa por sí solo el runner de GitHub. Sin replay ni dependencia de telemetría para publicar |
| **NEWS-001 — Noticias bajo demanda** | Primera versión RSS implementada y NEWS-06 preparación técnica local terminada: web.dev/Node.js, lectura pública, fetch super_admin por fuente explícita y diseño editorial. JWT/SQL13gates sin red, opt-in14con RSSreales/110noticias; carga inicial corregida y41focales/QA final correctos. Candidato preparado | [Plan105 §13](105-on-demand-tech-news.md#13-news-06-validación-final-y-preparación-de-entrega--solicitud2026-11-16), [evidencia final](../evidence/news-final-validation-20261116.md), [guía de entrega](../features/news/deployment-readiness.md) | Consultar CI del SHA en la PR codex/news-implementation→development y continuar promoción/adopción autorizadas Server→Client con ambas migraciones y postchecks. Teléfono/sesión humana e inspección visual nativa200% pendientes; zoom nativo geométrico/teclado comprobado. daily.dev/GitHub fuera de esta entrega. No repetir integración o QA local ya acreditadas |
| **Teacher — evolución TUX-03/05** | Propuesta pendiente fuera del alcance entregado/cerrado de TUX-001 | [Plan106 §14](106-nodia-teacher-guided-ux-redesign.md#14-cierre-tux-001-por-aceptación-humana--2026-11-16) | Retomar diseño guiado de borrador/preparación/recuperación (TUX-03) y primera lección/continuidad (TUX-05) si se priorizan. Conservar contratos y capacidades actuales; el cierre de TUX-001 no demuestra implementación de estas evoluciones |
| **OPS-05 — retención global y disco físico** | Pendiente independiente; archivo automático del inbox ya entregado. OPS-001 cerrado por alcance | [Plan99 §33](99-production-deployment-and-cicd-plan.md#33-cierre-ops-001-y-separación-de-ops-05--2026-11-16), [alcance técnico§32](99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16) | Especificar conservación de releases/diagnósticos, duración/capacidad, protecciones y retirada u offload para liberar disco físico. No repetir archivo del inbox, que sólo libera cuota lógica; sin purga de backups/secretos/evidencia por defecto |

## Entregas cerradas por alcance

Aceptación humana registrada el2026-11-16 por instrucción del usuario: THEME-001
pasó QA; PWA-001, TUX-001 y NAIUX-001 funcionan bien y deben cerrarse. El cierre
sucede los pendientes humanos de esos alcances en los cortes anteriores. No
identifica nuevos dispositivos/entornos ni ejecuta adopciones o aprueba fichas/ADR.

| ID / iniciativa | Entrega aceptada | Fuente de cierre y límites |
| --- | --- | --- |
| **THEME-001 — temas personales** | Cerrado: catálogo, selector y persistencia local; QA aceptado por el usuario | [Plan108 §9](108-user-theme-presets.md#9-cierre-por-aceptación-humana--2026-11-16). Evidencia técnica previa conservada; no se ejecutó despliegue nuevo |
| **PWA-001 — instalación online** | Cerrado: instalación/iconos/ventana propia y funcionamiento online aceptados | [Plan103 §15](103-pwa-progressive-implementation-plan.md#15-cierre-de-pwa-001-por-aceptación-humana--2026-11-16). Publicación HTTPS previa conservada; no acredita toda la matriz por dispositivo. PWA-002…006 siguen en cola |
| **TUX-001 — Teacher fácil de entender** | Cerrado: alta guiada, paneles, cabecera/drawer y revisión legible del plan entregados y aceptados | [Plan106 §14](106-nodia-teacher-guided-ux-redesign.md#14-cierre-tux-001-por-aceptación-humana--2026-11-16). TUX-03/05 siguen separados como evolución propuesta; sin inferencia/adopción nuevas |
| **NAIUX-001 — evolución UX/UI de NodiaAI** | Cerrado: workspace/compositor, historial/filtros, burbujas y cabecera móvil entregados y aceptados | [Plan107 §16](107-nodia-ai-ux-ui-upgrade-plan.md#16-cierre-naiux-001-por-aceptación-humana--2026-11-16). Despliegue base histórico conservado; continuaciones visuales no heredan una adopción nueva por la aceptación |
| **OPS-001 — entrega CD recuperable** | Cerrado: transporte v2, reserva/preflight, estado durable, continuación de bytes y archivo automático del inbox entregados en producción con cierre administrativo | [Plan99 §33](99-production-deployment-and-cicd-plan.md#33-cierre-ops-001-y-separación-de-ops-05--2026-11-16), [recibo completo](../evidence/durable-backend-uploads-20261116.md). Usuario solicita cierre; OPS-05 sigue en cola. Sin nuevas acciones productivas, limpieza o replay |

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
locales por105§12, sin adopción o aceptación humana; diseño/ADR siguen en revisión.
La confirmación humana2026-11-16 cierra THEME-001/PWA-001/TUX-001/NAIUX-001
por sus alcances entregados; no procede de automatización ni amplía pruebas por
dispositivo. Nuevas evidencias actualizan primero sus documentos enlazados.
