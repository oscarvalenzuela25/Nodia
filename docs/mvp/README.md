# Especificación del MVP — Nodia

Índice de las fuentes del producto. Actualizado el 2026-11-14; carpeta creada el 2026-08-15. Cada documento conserva su propio estado de aprobación, implementación y verificación.

El [progreso vigente](00-progress.md) contiene los pendientes y la próxima acción. Las entregas fechadas anteriores se consultan en el [historial consolidado](00-progress-history.md); sus estados históricos no sustituyen las decisiones posteriores.

## Cómo continuar

1. Leer [00-progress](00-progress.md) y retomar el primer paso incompleto del plan correspondiente, junto con sus dependencias.
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

[Especificación95](95-studies-adaptive-learning.md), [implementación96](96-nodia-teacher-implementation-plan.md), [contratos97](97-nodia-teacher-technical-contracts.md) y [traspaso98](98-nodia-teacher-start-handoff.md). Dominio propio y autoridad por destino canónico conforme a ADR092; las pruebas de una unidad no acreditan el cierre integral de Teacher.

[Upgrade adaptativo101](101-nodia-teacher-adaptive-upgrade-plan.md) R05 y [plan102](102-nodia-teacher-phased-implementation-and-final-qa.md) R04: construcción F0–F9 y QA55/55 cerrados para Windows/API key exacta, con18POST reales,47ítems revisados y restore de laboratorio. [Matriz R02](../evidence/teacher-upgrade-acceptance-20261111-r02.md) y [recibo](../evidence/teacher-upgrade-local-20261111-r02.json) conservan ese alcance. Continuación: ServerR14/ClientR41 adoptados en la VM de development, con autenticación Google normal y recorrido SQL desde la UI comprobados para la selección OpenAI Agentic configurada. Diagnóstico, evidencia por objetivo, propuesta/material, ayuda anclada, práctica y final quedaron registrados; el respaldo final posterior al QA pasó restauración de DB/configuración; la comprobación operativa y recarga de UI tras reanudar servicios pasaron. [Evidencia VM](../evidence/teacher-upgrade-development-vm-20261111-r01.json). Práctica12/14 y final40/40 son resultados del programa de QA, sin eficacia humana ni55nuevos criterios VM. Sin transferencia de aceptaciones o promoción a master. ADR098 sigue propuesto; fichas draft/partial/unregistered/approval:null, sin publicación. Los gates V1/Agentic de96 conservan su alcance.

## Interfaz y rendimiento

[Diseño Client](../../nodia-client/DESIGN.md), [tarjetas/accesos móviles35](35-mobile-cards-shortcuts-plan.md), [rendimiento37](37-web-performance-implementation-plan.md), [compositor93](93-nodia-ai-chat-composer-redesign.md) y [manual de propuestas](../features/nodia-ai/proposal-review-presentation.md).

[PWA103](103-pwa-progressive-implementation-plan.md): primera entrega PWA-001
independiente y prioritaria, instalable con iconos/ventana propia y funciones
online. Backlog separado de actualizaciones/caché, desconexión, push y datos
offline/sincronización. Candidato local en `codex/pwa-001-installation`, con
opción1 seleccionada para icono/favicon, manifiesto y validación del artefacto.
Build,90regresiones auth y82checks CI/CD correctos; instalación física,
standalone/auth y publicación pendientes. Plan en revisión;
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
