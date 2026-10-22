---
{
  "schema_version": 1,
  "document_id": "nodia-ai.capability-registry-gateway",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 9,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "C01..C04 implementan84contratos/adaptadores MCP cerrados candidatos. C05 publica en fuentes un lote de7(crear movimiento financiero y6ayudantes comunes), conservando67lecturas anteriores y sus hashes:74capacidades/31fragmentos y77candidatos sin publicar. Descubrimiento automático por etapas elegido por el usuario:8técnicos para descubrir/seleccionar IDs exactos contra catálogo autorizado congelado, recibo transaccional, cierre/prueba terminal/ACK y etapa local tool_selection antes de ejecutar subconjunto+7técnicos. El callback no amplía el grant de la generación; después del ACK se reemplaza su allowlist por la selección validada bajo módulos/ámbito congelados y permisos vigentes. No eleva límites y la selección desaparece en ejecución. Implementación, SQL y aceptación real del nuevo camino siguen en verificación. Perfiles explícitos sóloAPI/backend/pruebas, sin UI/Python/DDL nuevos. Confirmación, efecto, aceptación de memoria y credenciales permanecen humanos. Esta ficha continúa draft/unregistered; publicación estrecha no aprueba arquitectura ni disponibilidad."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/60-nodia-ai-ai14-capability-registry.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/40-nodia-ai-tool-catalog-v1.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/61-nodia-ai-ai15-product-reads.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/82-nodia-ai-ai36-integral-coverage.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-063-nodia-ai-bounded-staged-discovery.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-19",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai14-validation.json",
      "docs/evidence/nodia-ai-ai14-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c04-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-publication-validation.json"
    ],
    "notes": "C05 verifica offline el compilador, schemas reales del primer lote, preservación exacta de67hashes MCP y27contenidos aprobados. La implementación automática por etapas sigue en verificación; SQL, cuenta real, despliegue y aceptación productiva requieren sus evidencias propias. Aprobación null e integración unregistered conservadas para esta ficha; los hechos históricos se mantienen en las entregas enlazadas."
  },
  "approval": null
}
---

# Registro de capacidades y acceso a herramientas

[Producto](../README.md) · [Entrega AI-14](../../../../mvp/60-nodia-ai-ai14-capability-registry.md).

## Qué resuelve

Permite incorporar funciones verificadas sin enseñar al chat a recorrer endpoints o tablas. Una familia registra módulos, recursos, contratos públicos y casos de uso. Publicación y autorización son controles distintos: tener documentación o un registro no concede acceso al recurso.

## Solicitudes y dudas

| Petición ilustrativa | Interpretación y límite |
|---|---|
| «¿Qué puedo hacer en Reservas?» | Descubrir únicamente capacidades publicadas/autorizadas; catálogo vacío no significa que la app carezca del producto |
| «Busca al proveedor de este nombre» | Usar el resolver explícito cuando exista; pedir elegir ante ambigüedad, sin tomar el primer resultado |
| «Enséñame cómo registrar un gasto» | Describir contrato publicado; no modificar Finanzas ni confirmar por lenguaje natural |
| «Ejecuta este SQL o usa este endpoint» | Rechazar ejecución arbitraria; sólo herramientas registradas y sus reglas |

## Operaciones y contratos

`nodia_capabilities_search`, `nodia_capabilities_describe` y `nodia_entities_search` son infraestructura técnica de descubrimiento/resolución. Las rutas GET `/nodia-ai/capabilities`, `/:name` y `/:name/schema` comparten el caso de uso. Schemas: `CatalogSearchInput/Result`, `CatalogDescribeInput`, `CapabilityDescriptor/Schemas`, `EntitySearchInput/Candidates`. No se crean nombres nuevos a partir de aliases HTTP.

Las familias de productos reales están vacías en AI-14. El sistema de registro/gateway está implementado, pero las lecturas de negocio requieren AI-15, fichas aprobadas, contratos/puertos verificados y publicación compatible. Ni esta ficha draft ni los tests sintéticos habilitan esas lecturas.

## Mínimos, autoridad y datos

El detalle exige nombre exacto y versión de catálogo; la búsqueda acepta término/módulo y cursor acotados. Resolver requiere recurso, término, versión y scope público conforme al contrato; el scope no puede sustituir actor/sesión/permisos. Una sola coincidencia en una página incompleta sigue siendo ambigua. IDs y precisión permanecen según el dominio.

Se exige NodiaAI y todos los módulos/acciones correspondientes, con las reglas transversales de super_admin y autoridad de recurso ya definidas. El gateway reautoriza también datos recuperados. Tokens, credenciales, entidades ORM completas, nombres físicos de tablas y datos no autorizados permanecen fuera de las proyecciones.

## Filtros e informes

Este feature busca metadatos y resuelve identidades; no define sumas, monedas, períodos ni relaciones de informes. Las medidas/fechas/grano y filtros de negocio pertenecen a las familias y al registro de informes posterior. No deben inferirse de DTOs o columnas.

## Vista previa, efectos y recuperación

Descubrir o describir no cambia el negocio. Un callback guarda su resultado técnico acotado y consume presupuesto; no confirma propuestas. Las preparaciones/escrituras permanecen bloqueadas hasta sus etapas. Cada intención de callback conserva nombre/contrato/argumentos, call_id y run; un resultado previo requiere permisos actuales y contrato compatible. Un fallo o revocación no autoriza replay de efectos.

## Evolución y pendientes

Al ampliar un producto: mantener su ficha, contratos, export tipado, autoridad/proyección y pruebas; publicar con revisión/hash y binding compatibles. El siguiente turno puede descubrirlo sin recrear el chat. El turno en curso conserva su catálogo/grant.

Al cerrar AI-14, el transporte admitía 32 herramientas por despacho. AI-15 verifica un catálogo completo acotado de 72 herramientas y 128 KiB, como se detalla abajo. No es un límite permanente de productos: superar cualquiera de esas cotas exige otra estrategia verificada antes de publicar. Las consultas externas/artefactos tienen implementación candidata; faltan aprobación/publicación documental, aceptación con Gemini para estas funciones nuevas y despliegue. No hay cambios de BD por este feature.


## Actualización AI-15 — lecturas candidatas

[Entrega y gates](../../../../mvp/61-nodia-ai-ai15-product-reads.md). AI-15 permite seleccionar los exports exactos de una familia mediante IDs del manifiesto, sin resolver clases por strings. Un build vacío no instancia todos los productos. Finanzas declara REPEATABLE READ; Reservas conserva READ COMMITTED para observar revocación tras el lock. Los resultados se validan antes de comprobar su autoridad y de recuperarlos; los permisos sobre recursos listados se revalidan. El transporte privado admite 72 herramientas y 128 KiB de catálogo medidos con 67 contratos de dominio más cinco técnicos, conservando 64 KiB para argumentos/resultados. Esta ampliación no demuestra inferencia Gemini ni elimina el gate de selección futura al crecer el catálogo.


Ampliación AI-15: [contrato de ejecución y archivos](../../../../mvp/61-nodia-ai-ai15-product-reads.md). Cinco consultas externas usan prepare/execute/verify con deadline, señal y fingerprint; un replay no repite red y un recibo interrumpido no se redispara. Tres referencias de artefacto permiten descargas humanas reautorizadas con datos actuales, sin URL firmada ni archivo persistente adicional. Sin cambios visuales en esta entrega.


## Continuación AI36-C01 — preparación MCP candidata

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c01--contratos-y-adaptadores-de-preparación-mcp), [ADR-061](../../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md) y [evidencia](../../../../evidence/nodia-ai-ai36-c01-validation.json). Esta continuación actualiza el estado histórico descrito arriba: existen 73 contratos cerrados y adaptadores candidatos para Finanzas, Negocios, Reservas, Core y configuración no secreta de proveedores. La documentación y el código no los publican automáticamente.

Una petición parcial puede generar preguntas sobre los campos mínimos; continuar exige borrador y revisión exactos. El backend fija actor, sesión y conversación, conserva validación nativa y contrasta el resultado completo con la propuesta persistida. Un resultado inválido revierte borrador, propuesta y recibo MCP conjuntamente. Reutilizar un call_id sólo recupera su recibo exacto con autoridad vigente. El modelo no confirma ni ejecuta: el botón humano sobre la propuesta exacta conserva su canal autenticado.

Los campos JSON flexibles nativos admitidos se representan como datos tipados cerrados; no habilitan comandos, secretos ni campos de autoridad. Los límites físicos del transporte pueden rechazar tamaños/profundidades aceptados por una API nativa. No se inventan capacidades por tener un endpoint o un nombre en el catálogo.

PostgreSQL desechable comprueba dos recorridos representativos, financieros y de proveedor, con 22 comprobaciones de preparación, confirmación, recibo, replay, revocación y rollback. No hubo inferencia Gemini, R2, despliegue ni modificación de datos operativos. Las 67 capacidades de lectura y 27 fragmentos publicados permanecen intactos; los 73 preparadores siguen sin publicar. Selección del catálogo y aceptación real son gates posteriores; los cuatro flujos seguros, analizador de factura y seis ayudantes conservan C02..C04. No hay cambios visuales, de tablas, migraciones o endpoints en C01.


## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.


## AI36-C03 — análisis de factura en generación activa

La [ficha de análisis activo](../../businesses/features/active-invoice-analysis.md) detalla el candidato MCP de dos fases y sus límites. Reutiliza el parser nativo, acredita el adjunto original del turno y conserva una extracción pendiente de revisión. No inicia OCR anidado ni crea registros comerciales. [Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md) conserva la separación entre implementación, pruebas, publicación y aceptación real.


## AI36-C04 — seis ayudantes comunes candidatos

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) y [evidencia C04](../../../../evidence/nodia-ai-ai36-c04-validation.json) documentan los contratos/adaptadores explícitos de propuestas, operaciones, conjuntos, adjuntos y preferencias. Las lecturas de propuestas/operaciones/adjuntos quedan ligadas al chat del contexto backend; las preferencias pertenecen al actor, incluso para super_admin. El metadato de adjunto no entrega contenido, nombre de archivo, interpretación, URL o clave de almacenamiento. Las preparaciones sólo generan borrador/propuesta: el botón y canal humanos conservan confirmación, ejecución, reanudación/cancelación y aceptación de memoria. Sin cambios visuales ni impacto de layout/responsive/bundle cliente. Esta ficha permanece draft/unregistered; su actualización no publica herramientas.

## AI36-C05 — publicación selectiva y descubrimiento por etapas

El usuario eligió «Descubrimiento automático por etapas». La [entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c05--publicación-selectiva-y-descubrimiento-por-etapas) y el [ADR-063 propuesto](../../../../architecture/decisions/ADR-063-nodia-ai-bounded-staged-discovery.md) separan esa decisión de la aprobación documental y de la aceptación operativa.

La primera publicación selectiva añade crear un movimiento financiero y seis ayudantes comunes a las67lecturas existentes:74capacidades/31fragmentos,59fuentes/28excluidas;77candidatos siguen sin publicar. Se conservan los27contenidos aprobados anteriores, sus contratos y hashes MCP. El epoch opaco heredado conserva compatibilidad de recibos; el release de contenido cambia. La [autorización estrecha](../../../../evidence/nodia-ai-ai36-c05-publication-authorization.md) se limita a los siete contratos y cuatro secciones necesarias; esta ficha de producto/arquitectura permanece draft/unregistered.

La generación de descubrimiento presenta ocho herramientas técnicas, incluidas búsqueda/descripción autorizadas y `nodia_capabilities_select`. La selección contiene IDs exactos contra el catálogo global publicado/autorizado y su hash congelado; el recibo no amplía el grant de la generación en vuelo. Una vez comprobados el cierre nativo, prueba terminal y ACK, la etapa local `tool_selection`, sin inferencia, reemplaza la allowlist del grant por la selección validada bajo módulos/ámbito congelados y permisos vigentes, y reanuda inferencia normal o delegada. La ejecución recibe sólo el subconjunto más siete técnicos; desaparece la herramienta de selección. No se modifica una generación en vuelo ni se trunca un catálogo para hacerlo caber.

Se mantienen74herramientas/131072bytes de catálogo y las cotas independientes JSON128, grant SQL128 y contexto262144bytes. Agentic usa dos generaciones cuando solicita/valida selección; un saludo, aclaración o informe técnico acotado puede completar en una sin seleccionar capacidades. Web→Agentic opt-in puede requerir tres, siempre en la misma conexión y sin cambiar proveedor/modo por error o repetir inferencias inciertas. Los perfiles explícitos `finance_assistance` y compatibilidad de lecturas son opciones API/backend/pruebas; no se incorpora un selector de perfiles a la UI.

La [matriz por capacidad](../../../../evidence/nodia-ai-ai36-c05-publication-validation.json) distingue publicación en fuentes, selección candidata, pruebas internas por familia, evidencia externa histórica y aceptación actual pendiente. El perfil financiero de18capacidades no acredita aceptación automática. La nueva transición está en implementación/verificación; no atribuirle todavía SQL o inferencia real del candidato. Se reutilizan manifiestos, grants, recibos y etapas, sin Python, DDL o UI nuevos. Los efectos siguen necesitando la propuesta exacta y botón humano; selección automática no acepta preferencias ni confirma cambios.

### Índice inicial y costo de descubrimiento

El contexto inicial Agentic de descubrimiento incluye un índice compacto y completo de metadatos del catálogo publicado y autorizado al actor, agrupado por módulo y recurso. Identifica las capacidades disponibles para seleccionar sin incorporar sus schemas, handlers o datos de negocio. El índice es contexto informativo: no activa capacidades ni modifica el grant. Antes del despacho, el backend vuelve a contrastar el hash del catálogo y la procedencia del contexto con las fuentes actuales autorizadas; un índice incompleto, obsoleto o incompatible no permite inferir capacidades adicionales. Web conversacional no recibe este índice ni instrucciones MCP.

La primera cohorte real C05 consumió11de las12llamadas acumuladas en descubrimiento y completó un callback de preparación financiera antes de que otra llamada agotara el presupuesto; el turno quedó incierto y se concilió sin repetir la inferencia. Es un hallazgo de costo de descubrimiento, no una aceptación completa de esa capacidad. El índice busca reducir búsquedas/descripciones repetidas, conservando12callbacks, los límites de bytes y las3generaciones acumuladas, incluida cualquier compactación. La [aceptación y sus cohortes separadas](../../../../evidence/nodia-ai-ai36-c05-acceptance.md) registra el resultado posterior sin reemplazar la evidencia de ese primer intento. Esta ficha continúa draft/unregistered y con aprobación null; sus metadatos excluidos no publican el índice ni sus capacidades.
