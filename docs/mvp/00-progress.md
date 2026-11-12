# Progreso del MVP — Nodia

Actualizado el 2026-11-12. Síntesis del estado y pendientes por alcance; no es una consulta en vivo de la VM ni acredita despliegue en Truobox. El upgrade Teacher tiene construcción y QA55/55 por alcance R02 del2026-11-11; los restantes QA citados conservan la fecha explícita de su evidencia.

La navegación está en el [índice del MVP](README.md). Las cronologías, checklists superados e incidencias anteriores se conservan en el [historial consolidado](00-progress-history.md), sin convertir sus «siguientes pasos» antiguos en tareas actuales.

## Próxima acción recomendada

**Validación GitHub iniciada:** [PR3](https://github.com/oscarvalenzuela25/Nodia/pull/3), rama codex/development-ci-validation → development, snapshot completo autorizado. Primer run detectó skip transitivo y se corrigieron condiciones de lanes; comprobar Checks de la revisión actual antes del merge. El checkout local development conserva su WIP. Los cortes «sin commit/push» inferiores describen la preparación previa; no acreditan CI integral verde. Ver [99§16](99-production-deployment-and-cicd-plan.md#16-pr-completo-hacia-development-y-primera-ejecución-github--2026-11-12).

1. Continuar [producción99§15](99-production-deployment-and-cicd-plan.md#15-transporte-instalado-y-cierre-de-cicd-en-curso--2026-11-12): transporte/updater ya **instalados**, SSH nuevo con host pin verificado y sudo administrativo invalidado/sesión cerrada. Producción conserva f01; API/worker activos y HTTPS200, sin apply de otra app. Pasaron systemd real20, SSH/sudo real25, SQL47 con45→48 Teacher y Python34, con fronteras sintéticas documentadas. Código CI/CD implementado y probado localmente en **development**, sin commit/push/master, con TypeScript sólo en cada build y paquetes sin rebuild en CD. Validación:74Node Linux, actionlint5workflows y helper SSH real desde el PC. Siguiente: usuario termina/versiona development, reconcilia commits operativos de master remoto, verifica CI del SHA final y promueve cuando corresponda para acreditar la primera entrega real. [Preparación](../evidence/production-cd-preparation-20261112-r01.json). Secrets/variables reportados completos; GitHub default_branch=development comprobado. [Instalación viva](../evidence/production-cd-transport-live-20261112-r01.json). Rotación PostgreSQL expuesta, calificación IA91, monitoreo/logs, segunda copia offline y retención de paquetes/diagnósticos siguen pendientes propios. Obsidian§25.16–25.17 actualizado.
2. Retomar [limpieza100](100-repository-cleanup-and-documentation-consolidation-plan.md): L02 de estos dos índices consolidado; quedan auditoría general de dependencias/temporales L01 y L03–L05 según checklist. No borrar `ops/lab/artifacts` por patrón.
3. Antes de incluir cada feature en el piloto, abrir su plan y resolver/reconciliar sus gates actuales. Un pipeline verde no cierra OCR, Teacher, recuperación o calificación IA por entorno.
4. Teacher upgrade: QA55/55 cerrado por alcance R02 Windows/API key exacta. ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. Se preservan48migraciones/102tablas y los13unknown históricos cerrados; las correcciones R14/R40/R41 se revalidaron por alcance. Práctica12/14 (escrita6/6), final40/40 (escrita24/24) y ajuste candidato no activado comprobados; son respuestas del agente de QA, no eficacia educativa humana. Seguir [102§13](102-nodia-teacher-phased-implementation-and-final-qa.md#13-cierre-pendiente-en-development--2026-11-11) y [recibo VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json). El cierre funcional está comprobado; queda revisión/versionado Git editorial; mantener development, sin master y separado de producción99.

## Checklist

- [x] Separar índice, estado actual e historia de README/00-progress conservando decisiones, límites y referencias.
- [x] Preparar plan99 y workflow CI por componentes en development; primer run auxiliar revisado y correcciones locales preparadas. CD y aprobación integral conservan sus gates.
- [x] Preparar plan100 con clasificación y límites de conservación; no se han ejecutado borrados de temporales/código.
- [ ] Completar los siguientes lotes de limpieza según100, sin editar fuentes publicadas/hashes para simular igualdad.
- [ ] Verificar CI del próximo SHA de development y completar checks/protecciones, CD, secretos y paquetes de release según99; promoción a master a cargo del usuario.
- [ ] Completar monitoreo y pendientes operativos según99; instalación, primer despliegue, TLS y backup/restore ya tienen evidencia por alcance.
- [ ] Resolver los bloqueadores funcionales por alcance y comprobar las modalidades IA que se habiliten en el entorno destino.

## Estado operativo

| Alcance | Último estado acreditado | Continuidad / fuente |
| --- | --- | --- |
| Producción | Frontend y API públicos sobre f01; API/worker habilitados, backup R2 y restore aislado verificados. Login y uso general confirmados por el usuario. | [Corte vivo](../evidence/production-backend-live-20261112-r01.json), [frontend](../evidence/production-frontend-live-20261112-r01.json) y [plan99](99-production-deployment-and-cicd-plan.md). CI preparado sin commit en development; ejecución integral del próximo SHA pendiente. Transporte/updater instalados según99§15; primer run real de CI/CD del SHA final, proveedores IA, logs, monitoreo y seguridad adicional pendientes. |
| NodiaAI | Agentic y API key operativos por alcances documentados; seis puntos Agentic cerrados en laboratorio y cierre técnico Linux de AI40. ClientR38 incorpora propuestas compactas y Antes/Después con borrador/guards conservados. | [Modos90](90-agentic-api-only-web-retirement.md), [verificación91](91-ai-provider-onboarding-verification.md), [API92](92-nodia-ai-api-chat-parity.md), [cobertura82](82-nodia-ai-ai36-integral-coverage.md) y [Linux86](86-nodia-ai-ai40-codex-acceptance.md). No extrapolar disponibilidad a otros modelos, modalidades o entornos. |
| OCR manual Gemini | La recuperación identificada y el cierre local están implementados; después de una extracción sintética válida, R15/R16 vuelven a HTTP 504 tras 240 s y la lectura del PNG, sin resultado. | Extracción real bloqueada; causa no aislada. [Plan94](94-business-point-of-sale-and-product-refactor.md) y [evidencia R16](../evidence/invoice-gemini-timeout-20261107-r02.json). Archivo conservado, sin replay ni guardado comercial. |
| Teacher | Upgrade101/102 F0–F9 y55TU cerrados para Windows/API key exacta; recorrido VM OpenAI Agentic sobre R14/R41 comprobado con diagnóstico, evidencia, material, ayuda, práctica y final. | [Matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md), [recibo R02](../evidence/teacher-upgrade-local-20261111-r02.json) y [recibo VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json); respaldo/restauración y estado operativo final comprobados; revisión/versionado Git editorial pendiente. Sin eficacia humana,55nuevos TU VM o aceptación de otras selecciones; unknown históricos intactos. |
| Productos y POS manual | Precios normal/oferta independientes, sugerencia local explícita y mejoras de presentación adoptadas en laboratorio. ServerR11/ClientR28 suceden al arranque fallido R10; no repetir su migración. | [Plan94](94-business-point-of-sale-and-product-refactor.md) y [evidencia de precios](../evidence/business-product-pricing-20261106-r01.json). Vinculación OCR manual comprobó búsqueda/comparación/borrador, sin guardado comercial final; lector/teléfono/impresión física y compatibilidad mantienen su alcance propio. |
| Recuperación | Backups cifrados, journal externo y restauraciones aisladas comprobados por cortes concretos. | [Aceptación84](84-nodia-ai-ai38-environment-acceptance.md) mantiene pendientes de evidencia la retención real de siete días y la eliminación física en 24 h. [Operador](../../ops/nodia-ai-backups/README.md); el transcurso del tiempo no demuestra cierre. |
| Dictado | Implementación y pruebas sintéticas; la prueba real anterior de reconocimiento no fue positiva. | Servicio operativo y habla/Stop reales pendientes según [plan93](93-nodia-ai-chat-composer-redesign.md); no atribuir captura real a otras mejoras del chat o Teacher. |
| Finanzas y Reservas | Implementaciones y entregas locales/aisladas registradas, con evidencia por capa y evolución posterior del entorno. | Reconciliar los gates específicos en [Client24](24-personal-finance-client-plan.md), [Client30](30-rental-reservations-client-plan.md) y sus planes Server. FC-24/RC-38 históricos no justifican repetir instalaciones ya sucedidas ni acreditar aceptación universal. |
| Core y rendimiento | Acceso/privacidad y orden de módulos tienen fuentes propias; optimizaciones visuales y móviles acreditadas por perfil/ruta. | [Política89](89-module-access-and-user-data-scope.md), [plan87](87-core-feedback-module-order-plan.md), [rendimiento37](37-web-performance-implementation-plan.md) y [DESIGN Client](../../nodia-client/DESIGN.md). Mantener gates de concurrencia, sesión y aceptación por entorno de cada fuente. |

## Bloqueos actuales

- **OCR manual Gemini:** timeout real posterior a lectura, sin resultado ni causa confirmada. Conservar archivo/estado incierto y diagnosticar con la evidencia existente; no ampliar plazos, cambiar proveedor o repetir inferencias automáticamente.
- **Teacher V1:** feedback escrito Gemini unknown y framing de generación posterior, identificados en96§32. No confundir correcciones de UI o éxito de una unidad con cierre integral.
- **Aceptación de recuperación:** retención/limpieza física y demás gates efectivos de84 necesitan evidencia propia, además de un backup o restore puntual.
- **Dictado real y modalidades:** verificar reconocimiento positivo cuando se retome; API imagen está pospuesta en92, no es una invitación a consumir claves ni un bloqueo general de API chat/OCR.
- **Piloto productivo:** despliegue/transporte y restore Truobox verificados por el corte2026-11-12; login/uso general reportados; refresh/cookies y aceptación por feature conservan alcance propio. CI preparado en development, CD/logs/monitoreo/seguridad adicional pendientes; credenciales PostgreSQL expuestas aún sin rotar. La calificación IA conserva gates propios de99.

Las listas generales de P0 y «siguientes pasos» de cortes antiguos están en el historial. Reconciliar [revisión19](19-prelaunch-review.md) con sus cierres posteriores y el alcance que se lanzará; esta síntesis no declara todos esos hallazgos resueltos ni los reabre por antigüedad.

## Corte histórico Teacher R01: integración local y QA parcial — 2026-11-11

Este corte precede al cierre R02 de55TU registrado en el estado operativo y al final del documento; sus pendientes de proveedor/muestra/performance se resolvieron para ese alcance.

El usuario autorizó todas las fases después del corte documental inicial. [101 R03](101-nodia-teacher-adaptive-upgrade-plan.md) y [102 R02](102-nodia-teacher-phased-implementation-and-final-qa.md) registran construcción F0–F9 integrada y aceptación separada: evidencia por objetivo, diagnóstico previo al plan con banco manual revisable y mapeos explícitos, recomendaciones/práctica contextual, bloques prediction/check, repaso teacher-intervals/1, hilos, fuentes privadas, actividades/visuales declarativos y conceptos/equivalencias propios. No hay FSRS, banco automáticamente validado, hipótesis pedagógicas estructuradas automáticas ni transferencia de notas/verificaciones entre planes.

QA observado: Server133tests/25suites, Client174/29; SQL core8, enriquecimiento10incluido restore aislado, dominio14, runtime29con3POSTs locales sintéticos y HTTP nuevo9; builds Server/Client pasados. Conocimiento en modo check conserva87fuentes/43excluidas,44documentos/46fragmentos aprobados y release sin cambio. [Recibo](../evidence/teacher-upgrade-local-20261111-r01.json) y [matriz55TU](../evidence/teacher-upgrade-acceptance-20261111.md) delimitan resultados; estos conteos no son55TU aprobados. Restore comprobó igualdad del contenido ordenado de todas las tablas en PostgreSQL descartable, sin workers/POST al restaurar; no es backup operativo.

Navegador de paneles320/1280px y lote P2 revalidados por alcance; calificación por manifiesto/propósito protegida mediante protocolo de operador y13checks SQL sintéticos. Pendientes: muestra pedagógica de dos temas, proveedor/selección/propósito real91/92 y baseline medido de rendimiento. Sigue sin eficacia educativa o cierre V1 integral acreditados. ADR098 permanece propuesto; fichas draft/partial/unregistered/approval:null; sin publicación/despliegue ni cambios en base operativa. Continuar correcciones y QA por lotes sin aprobación por función; producción99 conserva sus gates independientes.

## Decisiones que invalidaron pasos posteriores

| Decisión vigente | Consecuencia |
| --- | --- |
| [Agentic/API key90](90-agentic-api-only-web-retirement.md) y [paridad API92](92-nodia-ai-api-chat-parity.md) | Web y `token_plan` están retirados. El antiguo pendiente «API chat no soportado» no describe el runtime actual. |
| [Ventas sólo lectura94, R17](94-business-point-of-sale-and-product-refactor.md#26-nodiaai-ventas-y-reportes-de-solo-lectura--r17-2026-10-30) | NodiaAI consulta ventas/reportes; no prepara ni ejecuta mutaciones de ventas, tampoco desde propuestas antiguas. POS manual conservado. |
| [Privacidad89](89-module-access-and-user-data-scope.md) y [ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md) | Autoridad por destino canónico y ámbito real; mover/renombrar grupos no concede acceso. Teacher tiene dominio propio. |
| [Piloto99](99-production-deployment-and-cicd-plan.md) | Truobox reemplaza Instabox Free como destino; PostgreSQL sigue en Northflank Free por elección explícita. Un volumen pequeño no acredita garantías comerciales ni autoriza upgrades automáticos. |

La aprobación humana de las seis revisiones R02 de API corresponde a sus selecciones/alcances y no aprueba automáticamente ADRs, fichas o modalidades adicionales. Las aprobaciones de otros dominios permanecen en sus fuentes; no derivarlas de un checkbox de implementación.

## Seguimiento técnico

| Trabajo | Fuente y evidencia de entrada |
| --- | --- |
| Propuestas ClientR38 | [Manual visual](../features/nodia-ai/proposal-review-presentation.md) y [QA2026-11-07](../evidence/nodia-ai-proposal-ui-20261107-r01.json) |
| OCR Gemini R16 | [Timeout y diagnóstico](../evidence/invoice-gemini-timeout-20261107-r02.json) |
| Productos/POS | [Plan94](94-business-point-of-sale-and-product-refactor.md) y [vinculación manual](../evidence/invoice-manual-match-qa-20261107-r01.json) |
| Teacher | Upgrade [101](101-nodia-teacher-adaptive-upgrade-plan.md)/[102](102-nodia-teacher-phased-implementation-and-final-qa.md), [matriz55TU](../evidence/teacher-upgrade-acceptance-20261111.md) y [recibo local](../evidence/teacher-upgrade-local-20261111-r01.json); historia en [96](96-nodia-teacher-implementation-plan.md) y [QA V1 con bloqueos](../evidence/teacher-final-qa-20261105-r01.json) |
| Proveedores IA | [Contrato recuperado](ai-provider-feature-contract.md) y [matriz obligatoria91](91-ai-provider-onboarding-verification.md): inferencia real por selección/modelo/esfuerzo/modalidad/entorno, sin fallback ni replay |
| Despliegue | [Plan99](99-production-deployment-and-cicd-plan.md), [runbook18](18-security-deployment-runbook.md) e [instalación](database-installation.md), con reconciliación del release vigente |
| Mantenimiento | [Plan100](100-repository-cleanup-and-documentation-consolidation-plan.md) y [registro](../../ops/maintenance/README.md) |

La consolidación documental de estos índices no ejecuta despliegues ni inferencias. El lote Teacher enlazado sí incluye builds y cambios de datos sintéticos en bases descartables; se distingue de base operativa/entorno destino. La comprobación del conocimiento se realiza en modo check, sin publicación; cada resultado conserva su alcance en la evidencia correspondiente.

## Historial

[00-progress-history.md](00-progress-history.md) conserva el contenido previo de progreso y los párrafos únicos del antiguo índice. Las evidencias originales y sus hashes no se reescriben. Las entradas nuevas deben resumir el estado vigente aquí y enlazar el detalle en su plan, evitando duplicar narraciones entre índices.

<details>
<summary>Referencias de cortes anteriores</summary>

Anclas conservadas para enlaces anteriores; cada entrada lleva a su registro histórico.

- <a id="productos-serverr11-y-clientr28-activos-y-comprobados--2026-11-06"></a>[Productos: ServerR11 y ClientR28 activos y comprobados — 2026-11-06](00-progress-history.md#progress-001)
- <a id="teacher-material-gemini-r11-listo-y-proceso-codex-probado--2026-11-03"></a>[Teacher: material Gemini R11 listo y proceso Codex probado — 2026-11-03](00-progress-history.md#progress-002)
- <a id="gemini-teacher-selección-calificada-en-native-r10--2026-11-02"></a>[Gemini Teacher: selección calificada en Native R10 — 2026-11-02](00-progress-history.md#progress-003)
- <a id="cierre-v1-teacher-auditado--r07-unknown--r08-local-2026-11-02"></a>[Cierre V1 Teacher auditado — R07 unknown / R08 local, 2026-11-02](00-progress-history.md#progress-004)
- <a id="corte-histórico-oauth-real-y-corrección-r07-preparada--2026-11-02"></a>[Corte histórico: OAuth real y corrección R07 preparada — 2026-11-02](00-progress-history.md#progress-005)
- <a id="corte-histórico-inicial-de-teacher-vm--2026-11-01"></a>[Corte histórico inicial de Teacher VM — 2026-11-01](00-progress-history.md#progress-006)
- <a id="teacher-en-vm-con-ambos-proveedores-agentic--en-curso-2026-11-01"></a>[Teacher en VM con ambos proveedores Agentic — en curso, 2026-11-01](00-progress-history.md#progress-007)
- <a id="teacher-activación-local-por-operador--2026-11-01"></a>[Teacher: activación local por operador — 2026-11-01](00-progress-history.md#progress-008)
- <a id="teacher-y-navegación-estable--implementación-local2026-11-01"></a>[Teacher y navegación estable — implementación local2026-11-01](00-progress-history.md#progress-009)
- <a id="teacher-inicio-en-contexto-nuevo-y-ampliación-de-rutas--2026-11-01"></a>[Teacher: inicio en contexto nuevo y ampliación de rutas — 2026-11-01](00-progress-history.md#progress-010)
- <a id="teacher-plan-de-implementación-completo--2026-11-01"></a>[Teacher: plan de implementación completo — 2026-11-01](00-progress-history.md#progress-011)
- <a id="teacher-final-de-sección-y-umbral-confirmado--r05-2026-11-01"></a>[Teacher: final de sección y umbral confirmado — R05, 2026-11-01](00-progress-history.md#progress-012)
- <a id="teacher-ciclo-de-primera-lección--r04-2026-11-01"></a>[Teacher: ciclo de primera lección — R04, 2026-11-01](00-progress-history.md#progress-013)
- <a id="teacher-detalle-de-revisión-y-guardado--r03-2026-11-01"></a>[Teacher: detalle de revisión y guardado — R03, 2026-11-01](00-progress-history.md#progress-014)
- <a id="nodia-teacher--planificación-r02-2026-11-01"></a>[Nodia Teacher — planificación R02, 2026-11-01](00-progress-history.md#progress-015)
- <a id="editor-de-precio-y-bloqueo-de-cambios--r26-2026-10-31"></a>[Editor de precio y bloqueo de cambios — R26, 2026-10-31](00-progress-history.md#progress-016)
- <a id="nombres-en-el-menú-lateral-colapsado--r25-2026-10-31"></a>[Nombres en el menú lateral colapsado — R25, 2026-10-31](00-progress-history.md#progress-017)
- <a id="precios-por-partida-y-salida-segura-del-pos--r24-2026-10-31"></a>[Precios por partida y salida segura del POS — R24, 2026-10-31](00-progress-history.md#progress-018)
- <a id="acciones-del-último-recibo--r23-2026-10-31"></a>[Acciones del último recibo — R23, 2026-10-31](00-progress-history.md#progress-019)
- <a id="vale-y-detalle-opcional--r22-adoptado-2026-10-30"></a>[Vale y detalle opcional — R22 adoptado, 2026-10-30](00-progress-history.md#progress-020)
- <a id="ajustes-pos-y-chrome-de-caja--r21-implementado-y-desplegado-2026-10-30"></a>[Ajustes POS y Chrome de caja — R21 implementado y desplegado, 2026-10-30](00-progress-history.md#progress-021)
- <a id="ticket-manual80mm-y-presentación--r20-implementado-y-desplegado-2026-10-30"></a>[Ticket manual80mm y presentación — R20 implementado y desplegado, 2026-10-30](00-progress-history.md#progress-022)
- <a id="unidades-y-cantidades-de-venta--r19-implementado-y-desplegado-2026-10-30"></a>[Unidades y cantidades de venta — R19 implementado y desplegado, 2026-10-30](00-progress-history.md#progress-023)
- <a id="nodiaai-ventas-de-solo-lectura--r17-2026-10-30"></a>[NodiaAI: ventas de solo lectura — R17, 2026-10-30](00-progress-history.md#progress-024)
- <a id="negocios-en-móvil--r16-2026-10-30"></a>[Negocios en móvil — R16, 2026-10-30](00-progress-history.md#progress-025)
- <a id="ventas-y-reportes-filtros-y-tabla-estándar--r15-2026-10-30"></a>[Ventas y Reportes: filtros y tabla estándar — R15, 2026-10-30](00-progress-history.md#progress-026)
- <a id="pos-lista-de-compra-y-producto-manual--r14-2026-10-30"></a>[POS: lista de compra y producto manual — R14, 2026-10-30](00-progress-history.md#progress-027)
- <a id="estudios-e-inglés--borrador-r01-2026-10-29"></a>[Estudios e Inglés — borrador R01, 2026-10-29](00-progress-history.md#progress-028)
- <a id="pos-varias-ventas-locales--r13-2026-10-29"></a>[POS: varias ventas locales — R13, 2026-10-29](00-progress-history.md#progress-029)
- <a id="pos-controles-y-checkout-sin-draft-ui--r12-2026-10-29"></a>[POS: controles y checkout sin draft UI — R12, 2026-10-29](00-progress-history.md#progress-030)
- <a id="productos-visor-y-reemplazo-de-imagen--r11-2026-10-29"></a>[Productos: visor y reemplazo de imagen — R11, 2026-10-29](00-progress-history.md#progress-031)
- <a id="editor-de-producto-imagen-y-recuperación--r10-2026-10-29"></a>[Editor de producto: imagen y recuperación — R10, 2026-10-29](00-progress-history.md#progress-032)
- <a id="resumen-de-negocio-filas-de-paneles--r09-2026-10-29"></a>[Resumen de negocio: filas de paneles — R09, 2026-10-29](00-progress-history.md#progress-033)
- <a id="presentación-markdown-y-recarga--r08-2026-10-29"></a>[Presentación Markdown y recarga — R08, 2026-10-29](00-progress-history.md#progress-034)
- <a id="dictado-prueba-real-de-la-app--2026-10-29"></a>[Dictado: prueba real de la app — 2026-10-29](00-progress-history.md#progress-035)
- <a id="dictado-del-navegador--vm-r07-2026-10-29"></a>[Dictado del navegador — VM R07, 2026-10-29](00-progress-history.md#progress-036)
- <a id="título-editable-en-cabecera--vm-2026-10-29"></a>[Título editable en cabecera — VM, 2026-10-29](00-progress-history.md#progress-037)
- <a id="ajustes-del-chat-adoptados-en-vm--2026-10-29"></a>[Ajustes del chat adoptados en VM — 2026-10-29](00-progress-history.md#progress-038)
- <a id="punto-de-venta-nodiaai--verificación-natural-acotada-2026-10-28"></a>[Punto de venta NodiaAI — verificación natural acotada 2026-10-28](00-progress-history.md#progress-039)
- <a id="punto-de-venta-y-refactor-de-productos--implementación-local-2026-10-28"></a>[Punto de venta y refactor de productos — implementación local 2026-10-28](00-progress-history.md#progress-040)
- <a id="chat-completo-en-vm-para-pruebas-humanas--2026-10-28"></a>[Chat completo en VM para pruebas humanas — 2026-10-28](00-progress-history.md#progress-041)
- <a id="backend-local-para-prueba-humana-del-chat--2026-10-28"></a>[Backend local para prueba humana del chat — 2026-10-28](00-progress-history.md#progress-042)
- <a id="rediseño-local-del-chat--2026-10-28"></a>[Rediseño local del chat — 2026-10-28](00-progress-history.md#progress-043)
- <a id="ampliación-solicitada-api-key-en-el-chat--2026-10-27"></a>[Ampliación solicitada: API key en el chat — 2026-10-27](00-progress-history.md#progress-044)
- <a id="decisión-actual--retirada-web-autorizada-el-2026-10-27"></a>[Decisión actual — retirada Web autorizada el 2026-10-27](00-progress-history.md#progress-045)
- <a id="adenda-vigente-cierre-de-seis-puntos-agentic-por-alcance--2026-10-27"></a>[Adenda vigente: cierre de seis puntos Agentic por alcance — 2026-10-27](00-progress-history.md#progress-046)
- <a id="adenda-anterior-agentic-guardado-idempotencia-y-cancelación-por-alcance--2026-10-26"></a>[Adenda anterior Agentic: guardado, idempotencia y cancelación por alcance — 2026-10-26](00-progress-history.md#progress-047)
- <a id="corte-anterior-ai41-imágenes-reales-codex-y-antigravity-verificadas-por-alcance--2026-10-26"></a>[Corte anterior AI41: imágenes reales Codex y Antigravity verificadas por alcance — 2026-10-26](00-progress-history.md#progress-048)
- <a id="corte-previo-ocr-aceptación-natural-agentic-por-alcance-r05-y-p1-adoptados--2026-10-26"></a>[Corte previo OCR: aceptación natural Agentic por alcance; R05 y P1 adoptados — 2026-10-26](00-progress-history.md#progress-049)
- <a id="corte-anterior-r03-aceptación-acotada-del-chat-ocr-con-codex--2026-10-26"></a>[Corte anterior R03: aceptación acotada del chat OCR con Codex — 2026-10-26](00-progress-history.md#progress-050)
- <a id="corte-anterior-r02-ocr-publicado-y-adoptado-comparación-en-investigación--2026-10-26"></a>[Corte anterior R02: OCR publicado y adoptado; comparación en investigación — 2026-10-26](00-progress-history.md#progress-051)
- <a id="corte-anterior-control-mcp-real-aceptado-en-la-nueva-época--2026-10-26"></a>[Corte anterior: control MCP real aceptado en la nueva época — 2026-10-26](00-progress-history.md#progress-052)
- <a id="corte-anterior56f6-continuidad-spa-y-observaciones-de-gemini"></a>[Corte anterior56f6: continuidad SPA y observaciones de Gemini](00-progress-history.md#progress-053)
- <a id="cortes-anteriores-inmediatos-adopciones-y-control-previo"></a>[Cortes anteriores inmediatos: adopciones y control previo](00-progress-history.md#progress-054)
- <a id="finanzas-personales--estado-de-client"></a>[Finanzas personales — estado de Client](00-progress-history.md#progress-059)
- <a id="tools--reservas-de-alojamiento"></a>[Tools — reservas de alojamiento](00-progress-history.md#progress-060)
- <a id="reservas-de-alojamiento--continuidad"></a>[Reservas de alojamiento — continuidad](00-progress-history.md#progress-063)

</details>

## Teacher — cierre vigente del upgrade R02

Cierre técnico del upgrade2026-11-11:55/55TU verificados para Windows y la selección API key exacta configurada.18POST reales, revisión de47ítems, QA HTTP/JWT/SQL y rendimiento comparado, correcciones y restore final comprobados. Alcance y límites en la [matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md) y el [recibo R02](../evidence/teacher-upgrade-local-20261111-r02.json). No adopta otros proveedores/entornos, no acredita eficacia humana ni despliega/publica o aprueba ADR/fichas.

El corte parcial de construcción anterior se conserva como historia. No reiniciar F0 ni repetir un resultado incierto. El siguiente hito operativo requiere paquete/configuración/credenciales/sesión propios del entorno adoptado; los18POST reales y la restauración de102tablas/37secuencias/827restricciones pertenecen al laboratorio documentado.

### Continuación VM del upgrade: cierre funcional y operativo comprobado

ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. La práctica obtuvo12/14 (escrita6/6); la final40/40 (escrita24/24), con passed/assisted=false persistido y ambas confirmaciones nativas del job escrito. Las respuestas pertenecen al agente de QA y no prueban aprendizaje humano. El ajuste real generó una candidata sólo de título que no se activó; el plan aceptado y sus objetivos/política no cambiaron. El detalle de R14/R40/R41, la selección exacta y sus límites se conserva en [102§13](102-nodia-teacher-phased-implementation-and-final-qa.md#13-cierre-pendiente-en-development--2026-11-11) y el [recibo VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json). No son55aceptaciones nuevas de VM. Revisión/versionado Git pendientes; development sin promoción a master, aprobación/publicación o cambios de producción99.
