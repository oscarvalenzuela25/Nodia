# TODO — núcleo de iniciativas y próximas entregas

> Revisado el 2026-11-20. Creado por solicitud explícita para reunir ideas y
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
| **OpenCode — Agentic y API key** | Especificado. El ensayo Agentic gratuito llegó al servicio y devolvió 429. | [Plan115](115-opencode-provider-implementation-plan.md), [catastro QA](114-ai-model-usage-inventory.md) | Fijar versiones del runtime y presupuesto de prueba. Obtener acceso API y ejecutar los canaries de texto por modo. |
| **FreeLLMAPI — gateway privado para API key** | Especificado. Piloto e integración pendientes tras OpenCode. | [Plan116](116-freellmapi-integration-plan.md) y [catastro QA](114-ai-model-usage-inventory.md) | Después del cierre de OpenCode, montar dos orígenes controlados y probar selección exacta y un único envío en éxito y fallo. |
| **BIZ-STOCK-001 — Stock opcional por producto** | Implementado localmente con verificaciones aisladas. Validación operativa pendiente. | [Plan94 §47](94-business-point-of-sale-and-product-refactor.md#47-stock-opcional-por-producto), [ADR120 propuesto](../architecture/decisions/ADR-120-optional-product-stock.md) | Revisar los productos legados, medir la conversión y comprobar el corte coordinado Server/Client y la recuperación antes de retirar la columna anterior. |
| **CV-001 — Nodia CV** | Cola corregida en producción. ChatGPT GPT-6.2 Sol en Alto calificado y verificado desde generación hasta descarga después de recargar. Gemini Hydrogen en Alto cerró con resultado remoto incierto. | [Plan113 §18](113-nodia-cv-implementation-plan.md#publicación-y-prueba-en-navegador), [guía UI](../features/nodia-cv/ui-design.md), [ADR119 propuesto](../architecture/decisions/ADR-119-nodia-cv-owned-generation-and-verified-pdf.md) | Determinar el alcance de `reply_finish_missing` en Gemini y calificar una intención nueva cuando exista una corrección o condición verificable. Conservar el intento incierto. |
| **TUX-CALENDAR — Calendario de estudio** | Calendario y gestión por estado verificados con Client, Nest y PostgreSQL | [Propuesta inicial](106-nodia-teacher-guided-ux-redesign.md#23-propuesta-de-calendario-de-estudio), [Plan111 §10](111-teacher-study-calendar-plan.md#10-gestión-del-calendario-y-filtro-de-actividad), [ADR116 propuesto](../architecture/decisions/ADR-116-teacher-study-calendar-ownership.md) | Validar la adopción en el entorno que corresponda y precisar la reprogramación de un calendario con avance. |
| **Teacher — Tarjetas de repaso** | Biblioteca, importación JSON y propuestas por partes con ámbito propio | [Plan112](112-teacher-flashcards-plan.md#propuestas-de-texto-e-imagen-en-la-biblioteca), [ADR118 propuesto](../architecture/decisions/ADR-118-teacher-flashcard-proposal-execution.md) | Calificar texto e imagen por selección exacta con un proveedor real en el entorno autorizado. |
| **Teacher — Sets de mazos** | Diseño implementado y recorrido autenticado verificado en la rama local con API y PostgreSQL reales. | [Plan112](112-teacher-flashcards-plan.md#prueba-local-con-api-y-postgresql-reales) | Adoptar la migración y verificar la biblioteca en el entorno de destino. |
| **NodiaAI — Calendarios y tarjetas de Teacher** | Fichas aprobadas y catálogo activado en la rama de Teacher | [Catálogo40](40-nodia-ai-tool-catalog-v1.md#calendarios-y-tarjetas-de-teacher) | Verificar una consulta y un cambio confirmado tras la adopción en el entorno de destino. |
| **Teacher — piloto de fragmentos interactivos** | Implementado y verificado en un plan sintético local | [Plan106 §22](106-nodia-teacher-guided-ux-redesign.md#22-piloto-de-fragmentos-interactivos--2026-11-22) | Abrir la lección original con una sesión autorizada. Recoger la evaluación del usuario antes de ampliar el piloto. |
| **PWA-002 — caché y actualización** | Base publicada con Teacher. La actualización explícita por pestaña se verificó en laboratorio | [Plan103 §4](103-pwa-progressive-implementation-plan.md#4-pwa-002--caché-estática-y-actualizaciones-controladas), [ADR112 propuesto](../architecture/decisions/ADR-112-pwa-controlled-release-updates.md) | Verificar cambio de versión, rendimiento de arranque y reversión en el despliegue autorizado. |
| **PWA-003 — desconexión** | Base publicada con Teacher. Avisos, reintento y conservación del borrador verificados en laboratorio | [Plan103 §5](103-pwa-progressive-implementation-plan.md#5-pwa-003--desconexión-y-recuperación-comprensibles), [ADR113 propuesto](../architecture/decisions/ADR-113-pwa-connection-recovery.md) | Verificar el flujo en el despliegue autorizado y las plataformas declaradas. |
| **PWA-004 — recordatorios de visitas de proveedores** | Publicado en Server y Client. Piloto completo en Chrome para Windows. En Chrome para Android se comprobó recepción con Nodia cerrada, apertura con el worker instrumentado y cero envíos en la visita posterior a la baja por API. Edge verificó el transporte WNS y la recepción con el sitio cerrado. | [Plan103 §6.7](103-pwa-progressive-implementation-plan.md#67-piloto-https-y-retirada--00405), [publicación §6.8](103-pwa-progressive-implementation-plan.md#68-publicación-de-proveedores-y-web-push--2026-11-21), [ADR111 propuesto](../architecture/decisions/ADR-111-web-push-provider-visit-reminders.md) | Verificar el registro autenticado y una entrega real en producción. Comprobar en Android la apertura con el worker original y la baja desde la interfaz, y el clic nativo en Edge. Validación en iPhone aplazada por decisión del usuario. |
| **PWA-005 — material de Teacher sin conexión** | Publicado. Descarga y reapertura sin red verificadas en Chrome para Windows | [Plan103 §7](103-pwa-progressive-implementation-plan.md#7-pwa-005--lectura-offline-por-módulo), [ADR114 propuesto](../architecture/decisions/ADR-114-teacher-offline-study-copies.md) | Probar plataformas pendientes, purga y cuota agotada. |
| **PWA-006 — sincronización del punto de lectura de Teacher** | Publicado. Guardado sin red, reintento y ambas resoluciones verificados en dos perfiles Chrome para Windows | [Plan103 §8.3](103-pwa-progressive-implementation-plan.md#83-publicación-https--2026-11-21), [ADR115 propuesto](../architecture/decisions/ADR-115-teacher-offline-reading-sync.md) | Repetir en dispositivos físicos distintos. |
| **OBS-001 — Grafana, primera entrega operativa** | Métricas, sondas, logs HTTP saneados, tablero y correo operativos. Uso observado y reversión aislada comprobados | [Plan104 §15](104-logs-and-monitoring-grafana-cloud.md#15-g6-consumo-observado-y-reversión-ensayada--2026-11-19), [ADR101 propuesto](../architecture/decisions/ADR-101-grafana-cloud-observability.md) | Conciliar series, ingesta de logs y ejecuciones del mes cuando el portal publique datos de uso |
| **Productos — disponibilidad y stock** | Revisión aplazada hasta abordar stock. El ajuste del listado retira el filtro y los indicadores de disponibilidad. | [Plan94 §48](94-business-point-of-sale-and-product-refactor.md#46-búsqueda-de-códigos-en-productos--2026-11-23) | Definir la relación entre existencias y disponibilidad comercial antes de restaurar controles en el listado. |

## Entregas cerradas por alcance

Aceptación humana registrada el2026-11-16 por instrucción del usuario: THEME-001
pasó QA; PWA-001, TUX-001 y NAIUX-001 funcionan bien y deben cerrarse. El cierre
sucede los pendientes humanos de esos alcances en los cortes anteriores. No
identifica nuevos dispositivos/entornos ni ejecuta adopciones o aprueba fichas/ADR.

El 2026-11-17 el usuario solicita cerrar PCON-001, OCR-001, BIZ-042 y TUX-03/05.
La integración en Git se comprobó para las cuatro entregas. La verificación
funcional por entorno conserva los límites documentados en sus planes.

El 2026-11-19 el usuario confirmó que CASH-001, LISTA-001 y NEWS-001 quedaron
listos. Se cierran por el alcance entregado y la evidencia registrada en sus
planes.

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
| **CASH-001 — Caja de Negocios** | Caja, resumen mensual y egresos de facturas manuales y OCR | [Plan109 §18](109-business-cash-ledger-plan.md#18-cierre-de-cash-001--2026-11-19) |
| **LISTA-001 — Listas de Market** | Alta, edición, actividad, copiado y checklist compartido | [Plan110 §10](110-market-shopping-lists-plan.md#10-cierre-de-lista-001--2026-11-19) |
| **NEWS-001 — Noticias personales** | Circuito personal DEV y piloto local de daily.dev | [Plan105 §18.9](105-on-demand-tech-news.md#189-cierre-de-news-001--2026-11-19). Una eventual distribución de daily.dev conserva su evaluación propia. |
| **OBS-002 — eventos de CI/CD** | Cerrado por alcance. Ingesta automática de un recibo real en Loki y verificación sintética de fallo y entrega parcial | [Plan104 §16](104-logs-and-monitoring-grafana-cloud.md#16-g7-eventos-del-recibo-de-entrega--2026-11-19), [reportero automático](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44673802429). OBS-001 conserva la conciliación mensual de uso. |
| **OPS-05 — retención global y disco físico** | Retirada del inventario completada y política operativa definida. Los 25 ZIP tienen custodia y restauración verificadas en R2 con bloqueo de 90 días. Segunda copia de la clave comprobada con una restauración desde la bóveda privada | [Política](99-production-deployment-and-cicd-plan.md#política-permanente-de-retención-de-despliegues), [custodia en R2](99-production-deployment-and-cicd-plan.md#custodia-en-r2-verificada-para-los-25-zip), [prueba de la segunda copia](99-production-deployment-and-cicd-plan.md#segunda-copia-de-la-clave-de-custodia). Un traslado posterior de los originales requiere adaptar y ensayar los lectores de rutas locales. |


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
comprobación HTTPS no acredita instalación humana. La primera versión de
Noticias publicó dos fuentes por105§15, con CI/CD y GET público comprobados.
El corte personal posterior de105§18 conserva su propia verificación. Los ADR
de Noticias siguen en revisión.
La confirmación humana2026-11-16 cierra THEME-001/PWA-001/TUX-001/NAIUX-001
por sus alcances entregados; no procede de automatización ni amplía pruebas por
dispositivo. Nuevas evidencias actualizan primero sus documentos enlazados.
