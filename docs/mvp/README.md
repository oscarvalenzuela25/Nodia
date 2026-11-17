# Especificación del MVP — Nodia

**Caja de Negocios — CASH-04 implementado localmente en Server, 2026-11-17.**
[Plan109 §13](109-business-cash-ledger-plan.md#13-facturas-y-ocr-vinculados-con-caja--cash-04-2026-11-17)
registra el egreso único por factura, su retiro y restauración, y el guardado
atómico de Facturas y OCR con recibos recuperables. El [TODO](TODO.md)
continúa en **CASH-05** con la interfaz de Caja.

**Topbar para Negocios y recarga desde el avatar — 2026-11-17.**
[Estado de IA](../features/ai-providers/topbar-mode-health.md#estado-de-ia-para-negocios--2026-11-17)
y [modelos del OCR](94-business-point-of-sale-and-product-refactor.md#44-modelos-ocr-con-acceso-de-negocios--2026-11-17)
se consultan con el módulo Negocios. El menú del avatar incorpora
[Actualizar información](103-pwa-progressive-implementation-plan.md#16-recargar-la-página-desde-el-avatar--2026-11-17)
para recargar la URL actual. Candidato local en `codex/business-cash-ledger`.

**Caja de Negocios — CASH-01 cerrado, 2026-11-17.** El
[Plan109](109-business-cash-ledger-plan.md#3-reglas-de-caja-v1) fija los contratos
de categorías, movimientos, filtros y agregados, edición de egresos desde
Facturas y confirmación OCR con recibo recuperable. El
[ADR106](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md)
sigue propuesto. Ese contrato sirvió de base para CASH-02 en
`codex/business-cash-ledger`.

**Cierre de cuatro entregas — 2026-11-17.** Por instrucción del usuario, el
[TODO](TODO.md#entregas-cerradas-por-alcance) cierra PCON-001, OCR-001, BIZ-042
y TUX-03/05. Se comprobó su integración en `development` y `master`. Los
[cierres de Contactos](31-provider-contacts-proposal.md#cierre-de-pcon-001--2026-11-17),
[Negocios](94-business-point-of-sale-and-product-refactor.md#43-cierre-de-ocr-001-y-biz-042--2026-11-17)
y [Teacher](106-nodia-teacher-guided-ux-redesign.md#16-cierre-de-tux-0305--2026-11-17)
conservan el alcance de la evidencia funcional.

**Caja de Negocios — planificación2026-11-17:** [Plan109](109-business-cash-ledger-plan.md)
define tab Caja, categorías comunes a ingresos/egresos, filtros Ransack hoy/activos,
paneles coherentes con búsqueda y tabla, vínculo opcional de factura a un único
egreso y dos cards de ingresos/egresos del mes actual en Overview. Plan y vistas
sintéticas, sin implementación. [ADR106 propuesto](../architecture/decisions/ADR-106-business-cash-invoice-expense-consistency.md)
separa ownership, consistencia e idempotencia; confirmar OCR requiere ampliar la
frontera nativa antes de afirmar atomicidad. Este corte de planificación precede
el cierre de CASH-01 en `codex/business-cash-ledger`.
Ficha candidata planned/draft/unregistered/approval:null.
Ampliación R02: selectores de categoría con X y +/modal de creación rápida;
duplicados ignorando mayúsculas/espaciados incluso inactivas. Quitar categoría
de factura retira su egreso al guardar, cambiarla conserva ID. Cierres de caja
como ingresos manuales; sin ventas automáticas. Drawer y modal se muestran en
la maqueta actualizada de las candidatas Caja rev2 y Negocios rev57.

**Negocios: precios redondeados, división y proveedores OCR — solicitud2026-11-17:**
[Plan94§42](94-business-point-of-sale-and-product-refactor.md#42-precios-de-venta-redondeados-división-local-y-proveedores-ocr--solicitud2026-11-17)
registra venta manual libre hasta onBlur y normalización al guardar; sugerencias
por porcentaje y división de venta ya redondeadas a decenas. Neto conserva CLP
entero. `use_ocr` defaultfalse y filtro exclusivo del selector OCR; columnas
ocultas conservan mapeos, demás formularios muestran todos los proveedores.
Folio opcional, fecha civil inicial de hoy, Notas/Activo al final y Overview
sin chip Por confirmar. Migración1793680000000 preparada/verificada en PG16
sintético,7gates; sin SQL operativo. Client3225/387, focal OCR75/3, tipos/lint/build y Chromium32perfiles correctos;
Server6143/358 y1caso Linux omitido en Windows. Candidato de PR50 actualizado.
[Evidencia y límites](../evidence/business-pricing-ocr-adjustments-20261117.md).
NodiaAI muestra venta normalizada antes de confirmar; propuestas incompatibles
requieren revisión nueva. Candidatas Negocios55/calculadora15 sin nueva aprobación
ni publicación. Cierre e integración registrados en el plan94§43.

**Teacher: TUX-03/05 implementados y verificados localmente — 2026-11-16:**
[Plan106§15](106-nodia-teacher-guided-ux-redesign.md#15-tux-0305-guía-y-continuidad-implementadas-localmente--2026-11-16)
registra conversación/diagnóstico opcionales, borrador protegido, preparación y
recuperación explícitas, primera lección y continuidad desde contexto real.
Rama `codex/teacher-guided-continuity` desde development `6b7f15a5`.
Teacher final277/42 y global previa3171/383, tipos/build y lint de fuentes correctos;
Chromium sintético16perfiles320/600/900/1440 ES/EN y errores CAS/respuesta
verificados por [evidencia](../evidence/teacher-guided-continuity-20261116.md).
No hay generación automática, cambios Server/DB ni inferencia/despliegue nuevos.
Cierre e integración registrados en el plan106§16. Fichas candidatas
actualizadas sin aprobación/publicación.

**Proveedores: apertura recuperable de Contactos — incidencia2026-11-16:**
[Plan31](31-provider-contacts-proposal.md#apertura-recuperable-de-contactos--incidencia-de-producción2026-11-16) registra error/404 reportado en producción.
El usuario confirma que recargar la página corrige el fallo observado.
Assets/importación anónimos actuales correctos; causa exacta aún no aislada. Reproducción local de import404 confirmó escape al error global;
candidato contiene descarga/fallo con lista y borradores intactos, retry local y
scope vigente. Focal67/9 y QA fresh320/600/1440 de fallo/recuperación correctas;
global3139/380, tipos/lint/build y pins locales correctos por
[evidencia](../evidence/providers-contacts-opening-20261116.md). El plan31
registra el cierre por alcance. Si reaparece el fallo, capturar petición/error
autenticados antes de atribuir causa.

**OCR manual: defaults y selección exacta — solicitud2026-11-16:**
[Plan94§41](94-business-point-of-sale-and-product-refactor.md#41-revisión-ocr-compacta-defaults-comerciales-y-selección-ia--solicitud2026-11-16) documenta alias nuevo desde nombre,
alias existente editable/conservado, disponibilidad nueva true y updates intactos;
venta inicial30% sobre bruto editable, cantidad junto al alias y sin toggle.
Modelo/intensidad desde defaults persistidos por instancia/modo. Implementación
local, tipos/lint/build y QA Chromium sintética6perfiles correctos por
[evidencia](../evidence/invoice-ocr-review-defaults-20261116.md). Global2:3125/378;
focal posterior124/10 cubre último delta de recuperación. Tipos/lint/build finales
y conocimiento/pins locales correctos. Cierre e integración registrados en plan94§43.
Sin inferencia ni aprobación/publicación nuevas.

**News integrado y publicado — 2026-11-16:**
[105§15](105-on-demand-tech-news.md#15-promoción-y-publicación-comprobadas--2026-11-16)
registra PR46/47 integradas, master03206aa1 y CI/CD correctos para backend/Client.
Lectura pública HTTP200 con ambas fuentes y caché inicial vacía; primer pendiente
es actualizar desde super_admin y completar aceptación funcional en producción.
No repetir integración/despliegue. [TODO vigente](TODO.md).

**PR News y archivo de capturas — solicitud2026-11-16:**
[PR46](https://github.com/oscarvalenzuela25/Nodia/pull/46) abierta contra development;
CI del corte funcional correcto (Client3104/376, Server6092/355 y40checks SQL).
[105§14](105-on-demand-tech-news.md#14-pr-a-development-y-capturas-fuera-de-git--solicitud2026-11-16)
registra la actualización y siguientes fases. Se retiran247capturas/16486902bytes
del árbol versionado, con [catálogo de originales](../evidence/validation-images-archive-20261116.md)
y JSON históricos intactos. La actualización tiene su CI propio; no fusiona o
despliega. El [TODO](TODO.md) mantiene integración/adopción News y OPS-05 en cola.

**Noticias: preparación final NEWS-06 — 2026-11-16:**
[105§13](105-on-demand-tech-news.md#13-news-06-validación-final-y-preparación-de-entrega--solicitud2026-11-16)
completa validación técnica local: JWT/SQL reales de laboratorio,13gates sin red
y14opt-in con dos RSS reales/110noticias; UI adversa y carga inicial corregida,
41focales/tipos/lint/build y QA320/900/1440. Zoom nativo200% geométrico/teclado
comprobado, con captura visual fallida; teléfono/Google/sesión humana pendientes.
[Evidencia final](../evidence/news-final-validation-20261116.md) y
[guía de entrega](../features/news/deployment-readiness.md) dejan candidato para
CI/promoción y adopción separadas; no se despliega por este pedido de preparación.

**Noticias: segunda fuente Node.js — NEWS-04,2026-11-16:**
[105§12](105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16)
incorpora Node.js junto a web.dev: lectura pública, POST por fuente explícita
exclusivo super_admin, estado/caché independientes y dedupe por URL conservando
procedencias. Node sólo título/URL/fecha con aviso MIT accesible. [Evidencia](../evidence/news-nodejs-integration-20261116.md)
separa SQL/HTTP descartable, RSS real y UI sintética. NEWS-06 conserva aceptación
y adopción; daily.dev deshabilitada y GitHub candidata no bloquean RSS.

**OPS-001 cerrado por alcance — 2026-11-16:** por solicitud del usuario,
[99§33](99-production-deployment-and-cicd-plan.md#33-cierre-ops-001-y-separación-de-ops-05--2026-11-16)
registra el cierre del transporte recuperable v2 y archivo automático del inbox
ya entregados. OPS-05 conserva en [TODO](TODO.md) la política de retención global
y disco físico/offload. Sin nueva limpieza, despliegue o aprobación del ADR104.

**Cierre por aceptación humana — 2026-11-16:** el usuario confirma QA de
THEME-001 y funcionamiento de PWA-001, TUX-001 y NAIUX-001, y solicita cerrarlos.
Las cuatro entregas quedan **cerradas por alcance**; sus planes108/103/106/107
registran el cierre y conservan evidencia técnica previa. No se identificaron
dispositivos/entornos nuevos ni se ejecutó otra adopción. Evoluciones PWA-002…006
y Teacher TUX-03/05 permanecen separadas; el cierre no aprueba fichas o ADR.
El [TODO](TODO.md) distingue las entregas cerradas de la cola activa.

**Temas personales desde el topbar — solicitud2026-11-16:**
[Plan108](108-user-theme-presets.md) especifica paleta independiente de
claro/oscuro, Nodia predeterminado y preferencia del navegador para todos los
roles. Catálogo oficial tweakcn incorporado a MUI, sin consulta externa en uso;
contraste acotado a nuevos tokens y estructura de Nodia conservada.
Implementación y verificación local completadas:
44 opciones, contraste de 86 paletas importadas y QA Chromium sintética de
12 perfiles; global3059/370 y 27 focales posteriores al feedback final,
tipos/lint/build correctos por [alcance y límites](../evidence/user-theme-presets-20261116.md).
[Ficha candidata](../nodia-ai/knowledge/general-settings/features/interface-theme-presets.md)
draft/unregistered/approval:null. THEME-001 cerrado por QA/aceptación humana
2026-11-16; sin atribuir dispositivos no identificados, herramienta IA,
sincronización de cuenta o despliegue nuevos. Seguimiento en
[TODO](TODO.md).

**Teacher: revisión legible del plan — solicitud2026-11-16:**
[106§13](106-nodia-teacher-guided-ux-redesign.md#13-revisión-del-plan-legible-y-edición-progresiva--solicitud2026-11-16)
retoma TUX-04: resumen/recorrido primero, «Usar este plan» principal y edición o
ajuste con IA bajo demanda. Todos los campos, borradores, cantidades inválidas y
aceptación exacta conservan sus contratos. Implementación y QA sintética local
verificadas:12perfiles320–1280px y borradores/nodos/foco conservados, incluso
ante503/409. Global3039/365 previa al guard final y al caso histórico;26focales
posteriores y build/lint finales correctos. [Evidencia propia](../evidence/teacher-plan-review-20261116/README.md).
TUX-001 cerrado por aceptación humana del alcance entregado2026-11-16;
TUX-03/05 siguen como evolución propuesta. Sin inferencia, adopción, publicación
o aprobación documental nuevas por el cierre.

**NodiaAI: historial móvil desde cabecera — solicitud2026-11-16:**
[107§15](107-nodia-ai-ux-ui-upgrade-plan.md#15-historial-móvil-desde-cabecera--solicitud2026-11-16)
registra la petición de retirar la barra lateral por debajo de900px y abrir el
historial desde un icono de cabecera; fila móvil con «Nuevo chat» compacto a la
derecha. Escritorio conserva el panel colapsable; chat/borrador/URL y búsqueda
conservados en [QA Chromium sintética](../evidence/nodia-ai-mobile-history-20261116/README.md),
incluso al redimensionar y ante503. Implementación local, tipos/lint/build
correctos;84focales y global3035/364 correctos. Capturas anteriores
con barra móvil históricas, sin aprobar fichas o desplegar esta revisión.

**NodiaAI: claridad del historial y filtros — continuación2026-11-16:**
retomado NAIUX-001 desde [107§14](107-nodia-ai-ux-ui-upgrade-plan.md#14-continuidad-del-historial-y-filtros--continuación2026-11-16).
Vacío filtrado diferenciado, criterios activos/restablecimiento visibles,
selección accesible y Drawer móvil con nombre. QA Chromium sintética en cinco
perfiles correcta, con borrador/chat/foco y recuperación de consulta conservados;
global3034/364 y tipos/lint/build correctos. [Evidencia](../evidence/nodia-ai-history-filters-20261116.md).
NAIUX-001 cerrado por aceptación humana del alcance entregado2026-11-16; no se
acreditan dispositivos ni adopción nuevos, ni se modifican contratos, IA,
autoridad o aprobación/publicación de fichas.

**Teacher: ResizeObserver — corrección local verificada2026-11-16:** solicitud en
la misma rama, sin cambiar diseño o borradores. [106§12](106-nodia-teacher-guided-ux-redesign.md#12-ciclo-de-medición-de-teacherloading--solicitud2026-11-16)
limita la medición Boneyard a la carga inicial tras reproducir el aviso; regresión
atómica (3 casos) y QA independiente de tres recorridos/seis perfiles sin avisos;
geometría conservada.
Revalidación focal actual 60/60, tipado, lint y build finales correctos por alcance;
global con fallo de test concurrente y revalidación posterior detallados en [evidencia](../evidence/teacher-drawer-chat-ui-20261116.md#corrección-del-ciclo-de-medición--solicitud2026-11-16).
Sin inferencia, despliegue o publicación de contexto.

**Teacher: cabecera, drawer y selector IA — solicitud2026-11-16:** mockups
aceptados y desarrollo autorizado en la rama actual `codex/durable-backend-uploads`.
[Plan106§11](106-nodia-teacher-guided-ux-redesign.md#11-cabecera-drawer-adaptativo-y-selector-ia--solicitud2026-11-16) registra estado a la derecha del título,
acciones/resultado integrados, aprendizaje adaptativo en Drawer con Mis fuentes
inicial y selección IA horizontal en Popover, sin botón «+». Implementación y QA sintética de seis perfiles/
continuidad verificadas; pruebas/tipos/lint/build finales correctos por alcance
(incluida la última alineación CSS xs); [evidencia propia](../evidence/teacher-drawer-chat-ui-20261116.md).
Contratos/autoridad/recuperación conservados; sin inferencia, despliegue o
aprobación/publicación de fichas por este lote.

**NodiaAI: historial compacto y burbujas — solicitud2026-11-16:** mockups
aceptados e implementación local en la rama actual `codex/durable-backend-uploads`.
[Plan107§13](107-nodia-ai-ux-ui-upgrade-plan.md#13-historial-compacto-y-burbujas--solicitud2026-11-16)
registra marca34px estilo Teacher, historial colapsado en iconos con tooltips,
compositor16px, selector según texto y respuestas en globo con copia sólo por
icono. [QA sintética6perfiles/continuidad correcta](../evidence/nodia-ai-sidebar-bubbles-20261116.md);
tipos/lint/build finales correctos y pruebas globales con corrección/revalidación
focal posterior. Contratos/contexto/autoridad conservados.
Sin adopción de este nuevo alcance, inferencia o aprobación/publicación de fichas.

**CD: entrega95b completada con upload v2 — 2026-11-16:**
[99§32](99-production-deployment-and-cicd-plan.md#32-retención-automática-y-continuación-de-uploads--solicitud2026-11-16)
y [recibo/evidencia](../evidence/durable-backend-uploads-20261116.md): PR39/40
integrados, CI master43878077045 y CD43879692520 completos correctos. Backend/
Client95b publicados con árbolesc01/bbb5 sin variación; transferencia v2 de
215982275bytes verified, recovered:false y sin fallos inyectados en producción.
SSH nuevo deployment_ready/blocked:false y writers activos; HTTPS API200/auth401/
Client200 con TLS0, Pages01ee1156 y PWA10recursos correctos. El mantenimiento previo
de adopción conservó6ba/PIDs sin restart; esta entrega normal activó95b.
Prueba root final: un archivo automático de215986320bytes, bytes/referencias
íntegros; inventario9ZIPs/1943826973bytes, tres archivos y un ledger verified,
sin parcial. Sudo invalidado, tmux cerrado y SSH posterior95b/blocked:false/activos.
Alcance v2 entregado y cierre administrativo completo. [TODO OPS-001](TODO.md)
continúa con política de disco físico/offload y retención global de releases/
diagnósticos. Fallos y reanudación probados en CI aislado; transferencia productiva
normal (recovered:false).
[ADR104 propuesto](../architecture/decisions/ADR-104-durable-upload-continuation-and-incoming-retention.md),
sin aprobación documental, inferencia IA, cambios de conocimiento o replay histórico.

**CD y NodiaAI: entrega productiva completada — 2026-11-16:**
PR36→development y PR37→master6ba2afb7, con CI correctos. CI43798403214 y
CD43799433169 correctos: backend6ba/c01 complete y Client6ba/bbb5 publicado,
PWA10recursos verificados. SSH nuevo confirma current, API/worker activos y
blocked:false; HTTPS API200/auth401/Client200 con TLS verificado.
[99§31](99-production-deployment-and-cicd-plan.md#312-entrega-nueva-completada-en-producción--2026-11-16)
y [evidencia/recibos](../evidence/deploy-upload-reconciliation-20261115.md)
separan mantenimiento sin restart de la entrega normal que sí activó release y
reinició servicios. No-op no usado por cambiosops; código integrado, caso remoto
elegible aún sin ensayar. CD antiguo/recibo unknown intactos, sin replay.
[TODO](TODO.md): NAIUX adopción operativa realizada, comprensión/UI real y teléfono
pendientes; OPS conserva preflight, ledger/reanudación y retención automática.
Sin nueva inferencia, aceptación humana o aprobación/publicación de fichas.
Sudo invalidado y tmux administrativo cerrado, comprobación SSH correcta.

**CD: cuota de upload reparada, despliegue pendiente — 2026-11-15:**
CI43753748903 pasó; CD43754640640 rechazó backend antes de submit/publicación.
Incoming1,94GB más ZIP216MB excedía el límite2GiB, sin falta de disco.
Archivado reversible de un ZIP histórico complete deja8ZIPs/1727842713bytes,
con hash/recibos intactos; currente2c2eca3 y API/worker activos, sin nuevo deploy.
[99§30](99-production-deployment-and-cicd-plan.md#30-upload-de-backend-cuota-activa-y-diagnóstico--2026-11-15)
y [evidencia](../evidence/production-upload-quota-20261115.md). Candidato distingue
rechazos conocidos de unknown sin replay;130Node+27receiver+16archivo Linux
correctos. Gateway productivo no actualizado por esta intervención; siguiente
promoción/CI/CD nuevos y adopción operatoria propia del diagnóstico, sin repetir
el intento fallido. sudo invalidado y sesión administrativa cerrada.

**Teacher GPT en producción — incidencia cerrada2026-11-15:** host release
activado con72 en API/worker, registro/hashes/current comprobados y timers
restaurados. Respaldo real restaurado para49 migraciones/102 tablas; HTTPS200 y
auth401 verificados. El usuario confirmó que GPT/medium dejó de mostrar el
aviso y generó la propuesta. Alcance de esta aceptación: esa propuesta/selección;
no amplía a otras modalidades o al curso Teacher completo.
[Plan99§29](99-production-deployment-and-cicd-plan.md#29-teacher-sigue-bloqueado-tras-el-cd-aprovisionamiento-separado--2026-11-14)
y [evidencia](../evidence/teacher-production-runtime-20261114.md).

**Alta POS con incorporación automática — VM development2026-11-14:** guardar el
producto añade una unidad a la misma venta local y limpia/enfoca el lector,
sin reescaneo. [Plan94§40](94-business-point-of-sale-and-product-refactor.md#40-añadir-el-producto-recién-guardado-a-la-venta-actual--solicitud2026-11-14)
y [evidencia nueva](../evidence/pos-product-registration-autoadd-20261114.md)
sustituyen la regla de no-autoadd del corte§39. Client2994/362,57focales,
build/tipos/lint y QA sintética correctos; Client VM adoptado con213recursos
exactos y runtime intacto, recibo propio y rollback preparado.
Sin cambio Server, checkout, herramienta IA o aprobación documental nueva.

**Lector POS: registro de barcode desconocido — VM development2026-11-14:**
decisión Registrar/No con alta nativa precargada, retorno al lector y asociación
existente conservada; carrito intacto y errores HTTP separados de ausencia.
[Plan94§39](94-business-point-of-sale-and-product-refactor.md#39-alta-de-producto-al-escanear-un-barcode-desconocido--solicitud2026-11-14),
[ficha candidata](../nodia-ai/knowledge/businesses/features/point-of-sale-checkout-and-accessibility.md#barcode-desconocido-y-alta-nativa--solicitud2026-11-14)
y [evidencia](../evidence/pos-unknown-barcode-registration-20261114.md).
Client2986/362, regresiones finales, build/tipos/lint y QA sintética6perfiles
correctos. Adopción sólo Client VM con213recursos exactos y rollback preparado;
Server/DB/procesos/timers intactos. Sin producción, herramientas IA nuevas o
aceptación de lector físico/UI autenticada VM.

**Alias de productos — VM development2026-11-14:** nombre humano independiente,
revisión explícita para productos nuevos/sin alias en factura, búsqueda por
nombre OR alias y filtros de código/barcode. [Plan94§38](94-business-point-of-sale-and-product-refactor.md#38-alias-humano-de-productos-y-revisión-ocr--solicitud2026-11-14),
[ADR102 propuesto](../architecture/decisions/ADR-102-human-product-alias-and-code-completeness.md)
y [evidencia](../evidence/product-alias-and-code-completeness-20261114.md).
Client2964/360 y Server6063/353 correctos, caso Linux aparte; build/lint y QA
visual sintética correctos. SQL aislado5gates y HTTP4gates Linux correctos;
migración179366 adoptada una vez en VM sin backfill,13productos/33logs
preservados. Respaldo final DB/configuración cifrado y restaurado; cierre de
servicios/timers en recibo operativo. No rediseña POS, publica herramientas ni
modifica producción; fichas candidatas sin aprobación heredada.

**Chat compacto y GPT Agentic — VM development2026-11-14:** rama
`codex/nodia-ai-chat-space-gpt-selection` desde origin/development. Stop en el
compositor, sin botón de actividad ni cabecera título/modelo; renombrado lateral,
padding vertical16px y laterales16/24/32px. Preferencias GPT recuperables sin
inventar modelos/disponibilidad, elegibilidad Teacher con diagnóstico preciso.
Host Teacher ya existente preservado en VM; elegibilidad exacta GPT/medium y
una creación normal de plan comprobadas, trabajo ready y cierre confirmado,
sin aceptar propuesta. El primer aviso de sesión fue un harness sin el bind del
bus de credenciales, corregido sin cambiar credenciales. [Evidencia](../evidence/nodia-ai-chat-space-gpt-selection-20261114.md).
La adopción VM no despliega producción ni publica fichas candidatas. Los
conteos locales previos de chat conservan su recibo; la suite posterior con
productos se registra arriba. Aprovisionamiento productivo separado en
[99§28](99-production-deployment-and-cicd-plan.md#28-host-específico-teacher-gpt-y-guard-cd--candidato-local2026-11-14).

Índice de las fuentes del producto. Actualizado el 2026-11-14; carpeta creada el 2026-08-15. Cada documento conserva su propio estado de aprobación, implementación y verificación.

El [progreso vigente](00-progress.md) contiene el estado operativo y la próxima acción. El [TODO central](TODO.md) reúne iniciativas futuras, especificaciones y puntos de reanudación sin duplicar sus planes. Las entregas fechadas anteriores se consultan en el [historial consolidado](00-progress-history.md); sus estados históricos no sustituyen las decisiones posteriores.

## Cómo continuar

1. Leer [00-progress](00-progress.md) y el [TODO central](TODO.md); abrir la especificación de la iniciativa seleccionada y retomar su primer paso incompleto real junto con sus dependencias.
2. Consultar la especificación del dominio, backend y ADR aplicables antes de cambiar contratos o comportamiento.
3. Registrar decisiones y evidencia en su fuente canónica; mantener las [fichas NodiaAI](../nodia-ai/knowledge/README.md) cuando corresponda.
4. Distinguir aprobación documental, implementación, integración real y aceptación por entorno. No marcar documentos aprobados sin confirmación explícita ni reutilizar estados antiguos como pendientes actuales.
5. Si cambia una decisión, revisar los documentos dependientes y sus checklists. La autorización de desarrollo existente no exige pedir permiso por cada acción técnica ya autorizada.

## Orden de documentos

| Documento base | Propósito |
| --- | --- |
| [01 — Entrevista](01-interview.md) | Contexto, problema, actores y resultado esperado |
| [02 — PRD V1](02-prd-v1.md) | Primera definición funcional |
| [03 — Modelo de dominio](03-domain-model-erd.md) | Datos y relaciones |
| [04 — PRD V2](04-prd-v2.md) | Reconciliación de producto y modelo |
| [05 — Sitemap](05-sitemap.md) | Navegación, con las decisiones de rutas posteriores aplicables |
| [06 — Contratos de rutas](06-route-specs.md) | Comportamiento por destino |
| [07 — Diseño](07-design-constraints.md) | Restricciones y sistema visual |
| [08 — Frontend](08-stack-frontend.md) | Herramientas y convenciones Client |
| [09 — Backend](09-stack-backend.md) | Herramientas y convenciones Server |
| [10 — DevOps](10-stack-devops.md) | Entornos, infraestructura y entrega |
| [11 — Arquitectura](11-architecture-overview.md) | Componentes y decisiones técnicas |
| [12 — Kanban](12-kanban.md) | Tareas derivadas del alcance |
| [13 — Readiness](13-readiness-review.md) | Revisión y autorización de desarrollo |
| [14 — Autenticación](14-authentication.md) | Configuración y operación de identidad/sesión |

## Dominios funcionales

| Tema | Fuentes de entrada |
| --- | --- |
| Finanzas personales | [Entrevista20](20-personal-finance-interview.md), [ERD21](21-personal-finance-erd.md), [contratos22](22-personal-finance-contracts.md), planes [Server23](23-personal-finance-backend-plan.md) y [Client24](24-personal-finance-client-plan.md) |
| Reservas | [Entrevista25](25-rental-reservations-interview.md), [especificación26](26-rental-reservations-spec.md), [ERD27](27-rental-reservations-erd.md), [contratos28](28-rental-reservations-contracts.md), planes [Server29](29-rental-reservations-backend-plan.md)/[Client30](30-rental-reservations-client-plan.md) y [rediseño36](36-reservations-redesign-proposal.md) |
| Negocios, productos y POS | [PRD de Negocios](../features/businesses/01-prd.md), [plan94](94-business-point-of-sale-and-product-refactor.md) y [contactos31](31-provider-contacts-proposal.md) |
| Core, módulos y privacidad | [Orden/feedback87](87-core-feedback-module-order-plan.md), [política89](89-module-access-and-user-data-scope.md) y [ADR092 de rutas canónicas](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) |
| Noticias de tecnología, programación e IA | [Plan105§12](105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16): NEWS-04 incorpora RSS Node.js junto a web.dev, lectura pública Home→Noticias y fetch exclusivo super_admin por fuente explícita. Diseño NEWS-05/chips conservado, dedupe con procedencias/avisos MIT. [Evidencia](../evidence/news-nodejs-integration-20261116.md), [contratos](../features/news/http-contract.md), [catálogo](../features/news/source-catalog.md) y [ADR105 propuesto](../architecture/decisions/ADR-105-public-news-and-source-access-tiers.md). NEWS-06 aceptación/adopción pendientes |

La aprobación explícita del ERD27 del 2026-10-04 no aprueba por extensión contratos28, planes29/30 ni sus ADR. Los estados de cada dominio se consultan en sus fuentes y en progreso.

## IA y conocimiento

| Tema | Fuentes |
| --- | --- |
| Proveedores y regresiones | [Contrato funcional](ai-provider-feature-contract.md), [entrevista15](15-ai-providers-interview.md), [especificación16](16-ai-provider-management-handoff.md) y [verificación91](91-ai-provider-onboarding-verification.md) |
| Modos vigentes y API chat | [Agentic/API key y retiro Web90](90-agentic-api-only-web-retirement.md), [paridad API92](92-nodia-ai-api-chat-parity.md), [runbook Agentic](agentic-cli-runbook.md) y [plan CLI32](32-agentic-cli-implementation-plan.md) |
| NodiaAI: alcance e implementación | [Investigación38](38-nodia-ai-research-and-v1-plan.md), [inventario39](39-nodia-ai-current-capabilities-inventory.md), [plan45](45-nodia-ai-implementation-plan.md) y [cobertura82](82-nodia-ai-ai36-integral-coverage.md) |
| Herramientas, contratos y ejecución | [Catálogo40](40-nodia-ai-tool-catalog-v1.md), [contratos41](41-nodia-ai-v1-contracts.md), [ERD42](42-nodia-ai-erd.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [autoridad54](54-nodia-ai-ai08-transversal-authority.md) y [política50](50-nodia-ai-ai04-runtime-policy.md) |
| Contexto funcional publicado | [Estándar/corpus](../nodia-ai/knowledge/README.md), [fichas51](51-nodia-ai-ai05-product-knowledge.md), [publicación52](52-nodia-ai-ai06-knowledge-publication-contract.md) y plantillas de [producto](../nodia-ai/knowledge/_templates/product.md)/[funcionalidad](../nodia-ai/knowledge/_templates/feature.md) |
| Recuperación y aceptación | [Rendimiento/recuperación83](83-nodia-ai-ai37-performance-recovery.md), [entorno84](84-nodia-ai-ai38-environment-acceptance.md), [Codex85](85-nodia-ai-ai39-codex-runtime.md) y [aceptación Linux86](86-nodia-ai-ai40-codex-acceptance.md) |
| Facturas y chat | [Consola34](34-invoice-analysis-console-plan.md), [compositor93](93-nodia-ai-chat-composer-redesign.md) y [reglas de Negocios94](94-business-point-of-sale-and-product-refactor.md) |

Los únicos modos operativos son Agentic y API key. Las referencias a Web, `token_plan` o CRUD conversacional de ventas describen etapas retiradas; no habilitan ejecución. Consultar progreso y plan91 para la disponibilidad realmente comprobada por selección/entorno.

## Teacher

[Rediseño UX/UI106](106-nodia-teacher-guided-ux-redesign.md), solicitado el2026-11-15
con alta guiada3pasos, paneles, cabecera/drawer y revisión legible del plan
entregados por106§10–13. TUX-001 cerrado por aceptación humana2026-11-16;
TUX-03/05 conservan su evolución propuesta de borrador/preparación y primera
lección/continuidad. Documento en revisión, sin aprobación integral o despliegue
nuevos; seguimiento en [TODO](TODO.md).

Continuación2026-11-14: [96§43](96-nodia-teacher-implementation-plan.md#43-alta-de-estudio-razonamiento-recuperable-y-menú-persistente--2026-11-14)
y [ADR100 propuesto](../architecture/decisions/ADR-100-teacher-first-generation-with-explicit-ai-selection.md)
registran la decisión explícita de crear con la IA elegida sin canary previo,
razonamiento recuperable, alta guiada y menú activo en subrutas. Se conservan
presupuesto, autoridad, selección exacta y recuperación; la generación puede ser
el primer intento real. Candidato local, sin aceptación operativa, inferencia o
despliegue por esta entrega. [Evidencia](../evidence/teacher-ai-selection-first-generation-20261114.md).

[Especificación95](95-studies-adaptive-learning.md), [implementación96](96-nodia-teacher-implementation-plan.md), [contratos97](97-nodia-teacher-technical-contracts.md) y [traspaso98](98-nodia-teacher-start-handoff.md). Dominio propio y autoridad por destino canónico conforme a ADR092; las pruebas de una unidad no acreditan el cierre integral de Teacher.

[Upgrade adaptativo101](101-nodia-teacher-adaptive-upgrade-plan.md) R05 y [plan102](102-nodia-teacher-phased-implementation-and-final-qa.md) R04: construcción F0–F9 y QA55/55 cerrados para Windows/API key exacta, con18POST reales,47ítems revisados y restore de laboratorio. [Matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md) y [recibo](../evidence/teacher-upgrade-local-20261111-r02.json) conservan ese alcance. Continuación: ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. [Evidencia VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json). Práctica12/14 y final40/40 son resultados del programa de QA, sin eficacia humana ni55nuevos criterios VM. Sin transferencia de aceptaciones o promoción a master. ADR098 sigue propuesto; fichas draft/partial/unregistered/approval:null, sin publicación. Los gates V1/Agentic de96 conservan su alcance.

## Interfaz y rendimiento

**Evolución UX/UI de NodiaAI — implementación local2026-11-15:**
[Plan107§11](107-nodia-ai-ux-ui-upgrade-plan.md#11-implementación-local-solicitada-en-la-misma-rama--2026-11-15)
y [evidencia](../evidence/nodia-ai-ux-upgrade-20261115.md) registran workspace
flex/historial plegable, lectura editorial y compositor2niveles con selector
progresivo. Misma rama `codex/nodia-ai-ux-ui-upgrade`; Client3013/363, tipos/
build/lint del código y QA28perfiles sintéticos correctos. Agentic/API key,
contratos y recuperación conservados; sin inferencias/despliegue o aprobación/
publicación por ese corte histórico. NAIUX-001 cerrado por aceptación humana
2026-11-16, incluidas continuaciones107§13–15. [TODO](TODO.md) conserva cierre y
límites de adopción; no repetir baseline/construcción o despliegue ya completados.

[Diseño Client](../../nodia-client/DESIGN.md), [tarjetas/accesos móviles35](35-mobile-cards-shortcuts-plan.md), [rendimiento37](37-web-performance-implementation-plan.md), [compositor93](93-nodia-ai-chat-composer-redesign.md) y [manual de propuestas](../features/nodia-ai/proposal-review-presentation.md).

[PWA103](103-pwa-progressive-implementation-plan.md): primera entrega PWA-001
independiente y prioritaria, instalable con iconos/ventana propia y funciones
online. Backlog separado de actualizaciones/caché, desconexión, push y datos
offline/sincronización. Implementación inicial y opción1 para icono/favicon,
manifiesto y validación de artefacto realizadas;103§12 acredita publicación y
diez recursos originales verificados por HTTPS. PWA-001 cerrado por aceptación
humana de funcionamiento2026-11-16; matriz por dispositivo no acreditada por esa
confirmación. No repetir el deploy histórico.
Ver [plan103](103-pwa-progressive-implementation-plan.md)
y [TODO](TODO.md). Plan en revisión;
[ficha candidata](../nodia-ai/knowledge/general-settings/features/pwa-installation.md)
draft/partial, sin publicación.

El plan37 tiene autorización explícita para implementación por etapas. Cada optimización conserva contratos y presenta ahorro/QA por perfil y ruta; una medición local no equivale a aceptación productiva completa.

## Producción y mantenimiento

[Plan99§25](99-production-deployment-and-cicd-plan.md#25-pages-respuesta-válida-rechazada-y-preflight-antes-del-backend--2026-11-14)
registra la respuesta válida de Pages rechazada por el cliente propio y su
corrección: preflight antes del backend y recibo durable sin secretos. Prueba
real con el artefacto original correcta, publicación todavía pendiente; backend
0f69d505 activo y su operación completa no se repite.

| Necesidad | Fuente vigente |
| --- | --- |
| Despliegue productivo y CI/CD | [Plan99](99-production-deployment-and-cicd-plan.md), [ADR097 propuesto](../architecture/decisions/ADR-097-monorepo-production-release-pipeline.md) y [ADR099 propuesto: conciliación previa a migraciones](../architecture/decisions/ADR-099-pre-migration-deployment-reconciliation.md) |
| Logs y monitoreo | [Plan104 — Grafana Cloud Free](104-logs-and-monitoring-grafana-cloud.md): elección confirmada, comparativa/inventario/flujo y etapas previas a instalar; [ADR101 propuesto](../architecture/decisions/ADR-101-grafana-cloud-observability.md). Sin instalación o ingesta acreditadas |
| Instalación de base y bootstrap | [Guía de instalación](database-installation.md) |
| Seguridad y preparación | [Plan17](17-security-hardening-plan.md), [runbook18](18-security-deployment-runbook.md) y [revisión19](19-prelaunch-review.md), reconciliando sus cortes históricos |
| Servicios internos | [ADR008](../architecture/decisions/ADR-008-internal-microservices-only.md) y [guía de seguridad](../architecture/internal-microservice-security.md) |
| Recuperación | [Operador de backups](../../ops/nodia-ai-backups/README.md) y plan84 |
| Limpieza y consolidación | [Plan100](100-repository-cleanup-and-documentation-consolidation-plan.md) y [registro de mantenimiento](../../ops/maintenance/README.md) |
| Ensayos anteriores | [Antecedentes de VPS](vps-first-test-deployment.md) y [laboratorio VM](vps-local-vm-lab.md); no son recetas productivas listas para ejecutar |

## Estados

- `pendiente`: aún no trabajado.
- `en progreso`: tiene información parcial.
- `bloqueado`: necesita una decisión que impide avanzar.
- `en revisión`: completo como borrador, pendiente de aprobación.
- `aprobado`: confirmado por el usuario.
- `no aplica`: descartado conscientemente y confirmado.

## Jerarquía de información

1. Documentos aprobados de esta carpeta.
2. ADR dentro de `docs/architecture/decisions/`.
3. `AGENTS.md`.
4. Conversación o memoria externa.

Este índice organiza fuentes; no cambia sus aprobaciones ni reemplaza sus contratos.

## Historial

El [registro consolidado](00-progress-history.md) conserva los cortes anteriores de ambos índices y los complementos únicos del antiguo README. No se deben copiar de nuevo cronologías completas en esta entrada.

<details>
<summary>Referencias de cortes anteriores</summary>

Anclas conservadas para enlaces anteriores; cada entrada lleva a su registro histórico.

- <a id="productos-precios-independientes-y-vinculación-revisada-adoptados--2026-11-06"></a>[Productos: precios independientes y vinculación revisada adoptados — 2026-11-06](00-progress-history.md#index-001)
- <a id="teacher-ambos-proveedores-y-recorrido-vm-comprobados--2026-11-03"></a>[Teacher: ambos proveedores y recorrido VM comprobados — 2026-11-03](00-progress-history.md#index-002)
- <a id="teacher-en-vm-con-ambos-proveedores-agentic--en-curso-2026-11-01"></a>[Teacher en VM con ambos proveedores Agentic — en curso, 2026-11-01](00-progress-history.md#index-003)
- <a id="teacher-activación-local-por-operador--2026-11-01"></a>[Teacher: activación local por operador — 2026-11-01](00-progress-history.md#index-004)
- <a id="teacher-y-navegación-estable--implementación-local2026-11-01"></a>[Teacher y navegación estable — implementación local2026-11-01](00-progress-history.md#index-005)
- <a id="teacher-y-rutas-independientes-del-menú--inicio-solicitado-2026-11-01"></a>[Teacher y rutas independientes del menú — inicio solicitado, 2026-11-01](00-progress-history.md#index-006)
- <a id="nodia-teacher-paquete-completo-para-implementar--2026-11-01"></a>[Nodia Teacher: paquete completo para implementar — 2026-11-01](00-progress-history.md#index-007)
- <a id="teacher-práctica-y-final-de-sección90--r05-2026-11-01"></a>[Teacher: práctica y final de sección≥90% — R05, 2026-11-01](00-progress-history.md#index-008)
- <a id="teacher-primera-unidad-teoríaquiz-y-pausa--r04-2026-11-01"></a>[Teacher: primera unidad, teoría/quiz y pausa — R04, 2026-11-01](00-progress-history.md#index-009)
- <a id="teacher-revisión-ajustes-y-creación-del-plan--2026-11-01"></a>[Teacher: revisión, ajustes y creación del plan — 2026-11-01](00-progress-history.md#index-010)
- <a id="nodia-teacher-general--flujo-y-plan-de-implementación-2026-11-01"></a>[Nodia Teacher general — flujo y plan de implementación, 2026-11-01](00-progress-history.md#index-011)
- <a id="editor-de-precio-y-bloqueo-de-cambios--r26-2026-10-31"></a>[Editor de precio y bloqueo de cambios — R26, 2026-10-31](00-progress-history.md#index-012)
- <a id="nombres-en-el-menú-lateral-colapsado--r25-2026-10-31"></a>[Nombres en el menú lateral colapsado — R25, 2026-10-31](00-progress-history.md#index-013)
- <a id="precios-por-partida-y-salida-segura-del-pos--r24-2026-10-31"></a>[Precios por partida y salida segura del POS — R24, 2026-10-31](00-progress-history.md#index-014)
- <a id="acciones-del-último-recibo--r23-2026-10-31"></a>[Acciones del último recibo — R23, 2026-10-31](00-progress-history.md#index-015)
- <a id="vale-y-detalle-opcional--r22-adoptado-2026-10-30"></a>[Vale y detalle opcional — R22 adoptado, 2026-10-30](00-progress-history.md#index-016)
- <a id="ajustes-pos-y-chrome-de-caja--r21-implementado-y-desplegado-2026-10-30"></a>[Ajustes POS y Chrome de caja — R21 implementado y desplegado, 2026-10-30](00-progress-history.md#index-017)
- <a id="ticket-manual80mm-y-presentación--r20-implementado-y-desplegado-2026-10-30"></a>[Ticket manual80mm y presentación — R20 implementado y desplegado, 2026-10-30](00-progress-history.md#index-018)
- <a id="unidades-y-cantidades-de-venta--r19-implementado-y-desplegado-2026-10-30"></a>[Unidades y cantidades de venta — R19 implementado y desplegado, 2026-10-30](00-progress-history.md#index-019)
- <a id="nodiaai-ventas-de-solo-lectura--r17-2026-10-30"></a>[NodiaAI: ventas de solo lectura — R17, 2026-10-30](00-progress-history.md#index-020)
- <a id="negocios-en-móvil--r16-2026-10-30"></a>[Negocios en móvil — R16, 2026-10-30](00-progress-history.md#index-021)
- <a id="filtros-tablas-y-entrada-de-productos--r15-2026-10-30"></a>[Filtros, tablas y entrada de productos — R15, 2026-10-30](00-progress-history.md#index-022)
- <a id="pos-como-lista-de-compra-y-edición-manual--r14-2026-10-30"></a>[POS como lista de compra y edición manual — R14, 2026-10-30](00-progress-history.md#index-023)
- <a id="estudios-e-inglés--propuesta-inicial-2026-10-29"></a>[Estudios e Inglés — propuesta inicial 2026-10-29](00-progress-history.md#index-024)
- <a id="varias-ventas-locales-y-presentación-del-pos--r13-2026-10-29"></a>[Varias ventas locales y presentación del POS — R13, 2026-10-29](00-progress-history.md#index-025)
- <a id="pos-accesible-y-checkout-atómico--r12-2026-10-29"></a>[POS accesible y checkout atómico — R12, 2026-10-29](00-progress-history.md#index-026)
- <a id="visor-de-imagen-desde-productos--r11-2026-10-29"></a>[Visor de imagen desde Productos — R11, 2026-10-29](00-progress-history.md#index-027)
- <a id="editor-de-producto-e-imagen-al-guardar--r10-2026-10-29"></a>[Editor de producto e imagen al guardar — R10, 2026-10-29](00-progress-history.md#index-028)
- <a id="orden-visual-del-resumen-de-negocio--r09-2026-10-29"></a>[Orden visual del resumen de negocio — R09, 2026-10-29](00-progress-history.md#index-029)
- <a id="markdown-de-respuestas-y-recarga-de-cabecera--r08-2026-10-29"></a>[Markdown de respuestas y recarga de cabecera — R08, 2026-10-29](00-progress-history.md#index-030)
- <a id="dictado-intento-autenticado-negativo--2026-10-29"></a>[Dictado: intento autenticado negativo — 2026-10-29](00-progress-history.md#index-031)
- <a id="dictado-del-navegador-a-texto--vm-r07-2026-10-29"></a>[Dictado del navegador a texto — VM R07, 2026-10-29](00-progress-history.md#index-032)
- <a id="título-editable-en-cabecera--vm-2026-10-29"></a>[Título editable en cabecera — VM, 2026-10-29](00-progress-history.md#index-033)
- <a id="ajustes-del-chat-adoptados-en-vm--2026-10-29"></a>[Ajustes del chat adoptados en VM — 2026-10-29](00-progress-history.md#index-034)
- <a id="punto-de-venta-con-nodiaai--prueba-real-2026-10-28"></a>[Punto de venta con NodiaAI — prueba real 2026-10-28](00-progress-history.md#index-035)
- <a id="punto-de-venta-y-refactor-de-productos--implementación-local-2026-10-28"></a>[Punto de venta y refactor de productos — implementación local 2026-10-28](00-progress-history.md#index-036)
- <a id="chat-completo-en-vm-para-pruebas-humanas--2026-10-28"></a>[Chat completo en VM para pruebas humanas — 2026-10-28](00-progress-history.md#index-037)
- <a id="backend-local-para-prueba-humana-del-chat--2026-10-28"></a>[Backend local para prueba humana del chat — 2026-10-28](00-progress-history.md#index-038)
- <a id="rediseño-local-del-chat--2026-10-28"></a>[Rediseño local del chat — 2026-10-28](00-progress-history.md#index-039)
- <a id="ampliación-solicitada-api-key-en-el-chat--2026-10-27"></a>[Ampliación solicitada: API key en el chat — 2026-10-27](00-progress-history.md#index-040)
- <a id="decisión-actual--retirada-web-autorizada-el-2026-10-27"></a>[Decisión actual — retirada Web autorizada el 2026-10-27](00-progress-history.md#index-041)
- <a id="corte-vigente-seis-puntos-cerrados-por-alcance-agentic-de-laboratorio--2026-10-27"></a>[Corte vigente: seis puntos cerrados por alcance Agentic de laboratorio — 2026-10-27](00-progress-history.md#index-042)
- <a id="corte-anterior-ocr-natural-agentic-aceptado-por-alcance-r05-y-p1-adoptados--2026-10-26"></a>[Corte anterior: OCR natural Agentic aceptado por alcance; R05 y P1 adoptados — 2026-10-26](00-progress-history.md#index-043)
- <a id="corte-anterior-r03-aceptación-acotada-del-chat-ocr-con-codex--2026-10-26"></a>[Corte anterior R03: aceptación acotada del chat OCR con Codex — 2026-10-26](00-progress-history.md#index-044)
- <a id="corte-anterior-r02-ocr-publicado-y-adoptado-comparación-en-investigación--2026-10-26"></a>[Corte anterior R02: OCR publicado y adoptado; comparación en investigación — 2026-10-26](00-progress-history.md#index-045)
- <a id="corte-anterior-control-mcp-real-aceptado-en-la-nueva-época--2026-10-26"></a>[Corte anterior: control MCP real aceptado en la nueva época — 2026-10-26](00-progress-history.md#index-046)
- <a id="corte-anterior56f6-continuidad-spa-y-observaciones-de-gemini"></a>[Corte anterior56f6: continuidad SPA y observaciones de Gemini](00-progress-history.md#index-047)
- <a id="cortes-anteriores-inmediatos-adopciones-y-control-previo"></a>[Cortes anteriores inmediatos: adopciones y control previo](00-progress-history.md#index-048)
- <a id="ampliación-previa-a-producción-en-revisión"></a>[Ampliación previa a producción en revisión](00-progress-history.md#index-051)
- <a id="integraciones-pendientes-de-retomar"></a>[Integraciones pendientes de retomar](00-progress-history.md#index-052)
- <a id="finanzas-personales--ampliación-y-planes"></a>[Finanzas personales — ampliación y planes](00-progress-history.md#index-053)
- <a id="tools--reservas-de-alojamiento"></a>[Tools — reservas de alojamiento](00-progress-history.md#index-054)
- <a id="contactos-de-proveedores"></a>[Contactos de proveedores](00-progress-history.md#index-055)

</details>
