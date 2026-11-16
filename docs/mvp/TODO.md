# TODO — núcleo de iniciativas y próximas entregas

> Revisado el 2026-11-15. Creado por solicitud explícita para reunir ideas y
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
| **PWA-001 — instalación online** | Implementado y artefacto publicado/verificado HTTPS por el corte103§12; aceptación física/standalone pendiente. El usuario reconoce el paso1 realizado | [Plan103 §11–14](103-pwa-progressive-implementation-plan.md#14-estado-conciliado-para-el-todo--2026-11-15), [guía](pwa-installation-guide.md), [evidencia HTTPS](../evidence/pages-public-convergence-20261114.md) | Reconciliar AC01–AC12; probar instalación/reapertura Chrome/Edge y Android físico, Google/auth/renovación/cambio de cuenta standalone. iOS sin verificar. No repetir publicación/PR antiguo |
| **PWA-002 — caché y actualización** | Especificado, sin implementación acreditada | [Plan103](103-pwa-progressive-implementation-plan.md) §4 | Retomar contrato de actualización/caché estática y preservar borradores; depende de base001 y compatibilidad de artefactos |
| **PWA-003 — desconexión** | Especificado | [Plan103](103-pwa-progressive-implementation-plan.md) §5 | Diseñar estado offline/recuperación;002 para arranque sin red. No promete datos offline |
| **PWA-004 — push** | Especificado; eventos sin concretar | [Plan103](103-pwa-progressive-implementation-plan.md) §6 | Elegir eventos/destinatarios/consentimiento y contrato de suscripción. No requiere escrituras offline |
| **PWA-005/006 — datos offline y sincronización** | Especificado como evolución, sin módulo elegido | [Plan103](103-pwa-progressive-implementation-plan.md) §7–8 | Elegir módulo/datos, privacidad/retención; después conflictos/idempotencia de escrituras. No ampliar todos los módulos por defecto |
| **OBS-001 — Grafana, primera entrega operativa** | G0/documentación e inventario; Grafana Cloud Free elegido. Sin cuenta/stack, Alloy, ingesta o alertas acreditados | [Plan104 §8–9](104-logs-and-monitoring-grafana-cloud.md#8-secuencia-de-configuración-posterior), [ADR101 propuesto](../architecture/decisions/ADR-101-grafana-cloud-observability.md) | G1: cuenta/stack/región/Free efectivo/correo/host. Después G2–G6 con configuración, saneamiento antes de exportar, alertas y consumo real. Credenciales por custodia segura |
| **OBS-002 — eventos de CI/CD** | Especificado como entrega separada G7 | [Plan104](104-logs-and-monitoring-grafana-cloud.md) §6 y§8 | Definir emisor desde recibo saneado y validar fallo/entrega parcial; Alloy no observa por sí solo el runner de GitHub. Sin replay ni dependencia de telemetría para publicar |
| **NEWS-001 — Noticias bajo demanda** | Investigación, lectura DEV puntual y maqueta editorial con fixtures. Sin módulo/API Nodia implementado | [Plan105 §4–6](105-on-demand-tech-news.md#4-entregas-y-aceptación-propuestas), [diseño](../features/news/editorial-design.md) | Resolver acceso/plan daily.dev, condiciones/retención por fuente, conexión personal/multiusuario y catálogo. Luego contratos y primera fuente de extremo a extremo. Fuentes candidatas daily.dev/DEV/RSS/HN |
| **TUX-001 — Teacher fácil de entender** | En implementación por alcance: alta guiada/paneles y revisión legible TUX-04 locales, QA sintética comprobada; comprensión humana y adopción pendientes | [Plan106 §13](106-nodia-teacher-guided-ux-redesign.md#13-revisión-del-plan-legible-y-edición-progresiva--solicitud2026-11-16), [ficha candidata](../nodia-ai/knowledge/studies/features/guided-setup-and-study-experience.md), [evidencia](../evidence/teacher-plan-review-20261116/README.md) | Validar comprensión/UI autenticada y teléfono físico de revisión antes de adopción por entorno si se solicita. Construcción y QA locales no se repiten:12perfiles,3039/365global antes del guard final y del caso histórico;26focales posteriores, build/lint finales correctos. TUX-03 y TUX-05 continúan por sus alcances; TUX-04 sigue parcial, sin inferencia, despliegue o aceptación UX nuevos |
| **NAIUX-001 — evolución UX/UI de NodiaAI** | Implementado y entregado operativamente en producción2026-11-16: Client6ba/bbb5 publicado por CD43799433169; NAIUX-00/06 locales comprobados, plan en revisión y validación humana pendiente | [Plan107 §11](107-nodia-ai-ux-ui-upgrade-plan.md#11-implementación-local-solicitada-en-la-misma-rama--2026-11-15), [adopción99§31.2](99-production-deployment-and-cicd-plan.md#312-entrega-nueva-completada-en-producción--2026-11-16), [evidencia local](../evidence/nodia-ai-ux-upgrade-20261115.md), [ficha](../nodia-ai/knowledge/nodia-ai/features/chat-composer-selection.md#evolución-uxui-del-chat--planificación2026-11-15) | Continuación [107§13](107-nodia-ai-ux-ui-upgrade-plan.md#13-historial-compacto-y-burbujas--solicitud2026-11-16): mockups aceptados, implementación y QA sintética6perfiles/continuidad correctas de marca, historial compacto y burbujas; tipos/lint/build finales correctos y pruebas globales con revalidación focal posterior, sin adopción nueva. Continuación [107§14](107-nodia-ai-ux-ui-upgrade-plan.md#14-continuidad-del-historial-y-filtros--continuación2026-11-16): vacío filtrado, resumen/restablecimiento y acceso por teclado implementados, QA sintética5perfiles y global3034/364, tipos/lint/build correctos. Después, NAIUX-07: revisar comprensión/UI real y teléfono/teclado físico. No repetir baseline, construcción o despliegue ya completados. Agentic/API key, propuestas, adjuntos/voz/Stop, permisos y recuperación conservados; sin inferencias o aceptación humana nuevas |
| **OPS-001 — entrega CD recuperable y retención** | OPS-01 conciliado y OPS-06 diagnóstico adoptado; entrega nueva43799433169 complete2026-11-16 con backend/Client6ba y postchecks SSH/HTTPS correctos. Recibo antiguo unknown intacto, sin replay. No-op no usado por cambiosops; código integrado | [Plan99§31.2](99-production-deployment-and-cicd-plan.md#312-entrega-nueva-completada-en-producción--2026-11-16), [ADR103 propuesto](../architecture/decisions/ADR-103-backend-payload-equivalence-with-preserved-source.md), [evidencia/recibos](../evidence/deploy-upload-reconciliation-20261115.md) | Continuación [99§32](99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16): transporte v2 adoptado, bundle5d5a150b y capabilities SSH reales; app6ba/PIDs intactos. CI2309037c/43871419155 completa correcta,173Node+15políticas+206Python root sin skips. Gate posterior de revalidación CI/master antes del submit:72focales correctas, falta CI del próximo HEAD. Continuar con esa CI, promoción/transferencia/retención reales y entrega nueva; delivery null, OPS sin cierre total. [Evidencia](../evidence/durable-backend-uploads-20261116.md); [ADR104 propuesto](../architecture/decisions/ADR-104-durable-upload-continuation-and-incoming-retention.md), sin borrado, replay o aprobación documental inferidos |

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
comprobación HTTPS no acredita instalación humana. Noticias y Teacher UX/UI siguen
en revisión; Teacher cuenta con la primera entrega local de106§10, sin aceptación humana. Nuevas evidencias deberán actualizar primero sus documentos enlazados.
