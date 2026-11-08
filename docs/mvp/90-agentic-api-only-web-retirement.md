# Retirada de Web: Agentic y API key

Fecha: 2026-10-27. Estado documental: en revisión. Alcance de implementación autorizado expresamente por el usuario en el chat de esta fecha; no implica aprobar fichas ni publicar conocimiento.

## Decisión y alcance

La solicitud actual sustituye la conservación de Web y el aplazamiento de API de las decisiones históricas del contrato funcional y política48. Los únicos modos públicos nuevos son `agentic` y `api_key`, presentados como **Agentic** y **API key** en ES/EN. No conservar `token plan` como etiqueta o identificador operativo. No retirar funciones de negocio, confirmación humana, aislamiento de perfiles, admisión, idempotencia, adjuntos o tratamiento de resultados inciertos.

[ADR083](../architecture/decisions/ADR-083-agentic-and-api-only-ai-modes.md). [Aceptación reusable de proveedores](91-ai-provider-onboarding-verification.md). [Contrato funcional](ai-provider-feature-contract.md).

## Avance comprobado al 2026-10-27

- Los tres proyectos implementan y tienen desplegados en la VM únicamente Agentic/API key. Web queda como historial legible, sin ejecución ni delegación. No se adoptó todo el checkout: los paquetes selectivos conservan el overlay operativo anterior y sus dependencias.
- Server: 5371/5371 unitarias; Client: 2003/2003; Native: 498/498 en la imagen Linux slim nueva (Windows conserva cuatro skips POSIX). Tipado, lint, builds y contratos completados; catálogo publicado de 151 capacidades, 42 documentos, 44 fragmentos y 302 contratos cerrados. Las seis revisiones tienen [aprobación humana](../evidence/ai-two-modes-knowledge-human-approval-r01.json).
- PostgreSQL: instalación limpia de 31 migraciones, nueve garantías focales y ensayo con copia privada de las 62 tablas originales. [Migración operativa aplicada una vez](../evidence/ai-two-modes-operational-migration-r01.json): 58 tablas ajenas sin diferencias; claves cifradas e historial inmutable preservados. Las selecciones Web requieren reconfiguración explícita.
- [API real](../evidence/ai-two-modes-api-real-success-r01.json): OpenAI y Gemini devuelven success OCR, con 12 comprobaciones del mismo PDF sintético. API chat NodiaAI sigue no disponible: no existía adaptador previo. Las claves de prueba no se guardaron ni se volverán a usar por rutina.
- [Agentic real](../evidence/ai-two-modes-agentic-real-success-r01.json): un caso exitoso por proveedor sobre la candidata nueva, con modelo/esfuerzo persistidos, callback MCP real, knowledge autorizado, salida validada, proceso cerrado y ACK. Cuatro turnos totales: dos éxitos y dos fallos preservados, sin replay. No equivale a recorrer las 151 operaciones ni todas las modalidades.
- [QA de navegador](../evidence/ai-two-modes-ui-r01.json): móvil/escritorio, ES/EN y fallo/reintento con fixtures interceptadas, sin credenciales. [HTTP del despliegue](../evidence/ai-two-modes-client-http-adoption-r01.json) verifica archivos actuales, rutas SPA y compatibilidad con assets anteriores.
- La limpieza autorizada retiró sólo 35 volúmenes demostrados como pruebas descartables: 1.739 GiB recuperados. Los volúmenes no identificados, perfiles, respaldos y evidencias se conservaron. La limpieza inicial del proyecto de 1,26 GB sigue aplazada.
- [Cierre y matriz por capas](../evidence/ai-two-modes-verification-final-r01.json), [estado final de servicios](../evidence/ai-two-modes-deployment-final-r01.json) y [verificación reusable91](91-ai-provider-onboarding-verification.md). Las capacidades no verificadas en vivo en esta época se distinguen de regresiones unitarias y evidencias anteriores.

### Congelación de la publicación desplegada

La release de conocimiento desplegada es `f8734238a60c9346edc87108d0525ecd5d50fdaa67ca248b0a48f69991ef4305`. Los bytes de este plan y del contrato funcional que participaron en su build se conservan con su manifiesto en `ops/lab/artifacts/agentic-api-mode-retirement-r01/deployed-knowledge-authoring-inputs-r01.zip` y su catálogo. Las anotaciones finales de progreso posteriores cambian las fuentes de autoría; no se reescribe el manifiesto desplegado ni se atribuye su hash a un build futuro. Los cuerpos de las seis fichas aprobadas permanecen intactos.

## Hechos y brechas iniciales

- Hay trabajo previo sin commit: preservar bytes/cambios ajenos; el inventario no significa que cada archivo necesite una modificación.
- Server usa `api_key`, `token_plan_web`, `token_plan_agentic` y alias `web_session`, con flags en catálogo y conexión y configuración en `fields[modo]`. `default_mode` ya es nullable.
- Client utiliza Web en ajustes, login/visor, topbar, importación de facturas y NodiaAI (selector, routing, flujos seguros y validación).
- Python tiene servicio/SDK Web, navegador, cookies, visor y diagnóstico, compartiendo admisión y partes del chat con Antigravity. No borrar helpers compartidos o credenciales de perfiles.
- API key tiene gestión cifrada, descubrimiento y OCR; el resolver de chat NodiaAI rechaza API. Su habilitación conversacional requiere adaptador y evidencia, no basta con mostrar la opción.
- El `knowledge:check` del checkout ya falla con `implementation_hash_mismatch` antes de esta tarea. Registrar comparación y no actualizar hashes a ciegas ni publicar borradores.
- La aceptación Agentic previa pertenece al runtime R07 del laboratorio, distinto de fuentes de autoría. No desplegar todo el checkout sin una revisión del overlay actual.

## Contrato común entre proyectos

1. TS y HTTP: modo `agentic | api_key`; flags `use_agentic`/`can_use_agentic` y `use_api_key`/`can_use_api_key`; configuración `fields.agentic` y `fields.api_key`. `default_mode` admite null como selección pendiente.
2. Renombrar el enum de Agentic; no aceptar Web en nuevas solicitudes. Rechazar payloads/modos retirados con error tipado antes de generación. No mantener alias ejecutables silenciosos.
3. Python privado conserva motor `agentic`; no recibe keys API. El uso de API pertenece a Server. `/health` sigue liveness; resto autenticado con credencial exclusiva y actores/ownership reales.
4. `engines` expone sólo `agentic`, con disponibilidad/auth/cuota desconocidas cuando falte evidencia; topbar sólo Agentic y API key. Mantener verde API por clave guardada según contrato, separado de inferencia exitosa.
5. Retirar delegación Web→Agentic y su switch: elegir Agentic directamente. No crear fallback API↔Agentic. Lectura de conversaciones antiguas sigue disponible; su envío con selección Web retirada queda bloqueado hasta selección explícita.
6. API de NodiaAI: conservar garantías de autoridad y presupuestos; implementar chat válido donde el adaptador pueda sostenerlo. No anunciar MCP, imágenes, audio o herramientas de negocio sin su contrato y prueba. API OCR y sus funciones actuales se conservan. Cada capacidad no implementada queda declarada como tal en la matriz, nunca simulada.

## Trabajo por proyecto y ámbito de agentes

| Proyecto | Ámbito | Entrega y verificación |
|---|---|---|
| Client | Sólo `nodia-client/` | Tipos/servicios/cachés/forms/tabs/cards/topbar/OCR/NodiaAI; retirar login Web y routing; ES/EN; pruebas atómicas, tipado/lint/build, UI móvil/escritorio y error/reintento. |
| Server | Sólo `nodia-server/` | DTOs/entidades/repositorios/SQL/catalog/health/quotas/modelos/OCR/chat/contexto/herramientas/contratos/scripts/tests; migración incremental probada y adaptador API acorde a capacidades reales. |
| Microservicio | Sólo `nodia-gemini-microservice/` | API privada Agentic exclusiva; retirar rutas, SDK y recursos sólo Web tras revisar imports; preservar admisión/login/ledger/MCP/adjuntos/cancelación; runner unitario aislado y arranque Linux. |
| Coordinación | Documentación/knowledge/ADR/ops y revisión común | Matriz e inventario, contratos cruzados, protección de históricos, VM/despliegue coordinado, evidencia y aceptación API con clave provista posteriormente. |

Cada agente lee sus AGENTS y skills locales obligatorias; enlaza plan91 desde el AGENTS del proyecto. No modifica fuentes de otro ámbito ni despliega/migra la VM por su cuenta. Avisar desajustes de contratos al coordinador. No cambiar SDKs/dependencias ajenas por esta tarea.

## Migración y protección de persistencia

- Añadir migración nueva; jamás reescribir migraciones ya aplicadas o evidencias históricas.
- Preflight de conflictos `fields.agentic` frente a `fields.token_plan_agentic`, restricciones SQL y trabajos/slots/attempts activos. Conflicto no equivalente bloquea la migración sin sobrescribir valores.
- Renombrar columnas y scope Agentic conservando configuración, modelos exactos, IDs, claves cifradas, permisos y etiquetas. Retirar flags Web del esquema operativo.
- Selecciones/default Web quedan null/incompletas: nunca transformar a API/Agentic ni activar modos no elegidos. Conservar campos necesarios para mostrar la necesidad de reconfigurar sin hacer inferencia.
- Desactivar routing retirado. Los snapshots y recibos históricos inmutables conservan sus bytes/hashes. Aplicar normalización de lectura explícita de Agentic histórico cuando sea necesaria para proyección; no cambiar snapshots con hashes ni reejecutar jobs antiguos.
- Diseñar rollback real: registrar qué no puede revertirse sin copia; capturar respaldo privado verificable antes de migración real. No prometer recuperar configuración Web eliminada desde una migración down vacía.
- Probar instalación limpia + upgrade histórico + conflicto/rollback sobre PostgreSQL desechable y verificar tablas/JSON ajenos byte-equivalentes en proyecciones canónicas.

## Secuencia y gates

- [x] Inspección de fuentes/decisión nueva y mapa inicial.
- [x] Plan común y aceptación reusable antes de delegar implementación.
- [x] Implementaciones paralelas con contrato acordado y pruebas focales.
- [x] Integración de tipos/HTTP/SQL/JSON/schema/knowledge y revisión de referencias residuales.
- [x] Suites locales, build Client/Server y checks Python; fallos previos separados.
- [x] VM encendida y quiet comprobado; paquete/source overlay auditado, respaldo fresco y migración de ensayo aislada.
- [x] Adopción coordinada sin jobs en vuelo; verificación UI/HTTP/Agentic real con selección persistida, turnos contados, ACK/cierre y sin replay incierto; fallos previos conservados.
- [x] API: descubrimiento en vivo y modelo explícito proporcionado al servicio real, sin fallback; OpenAI/Gemini OCR success con claves por stdin, sin persistir las credenciales de prueba ni repetir inferencias por rutina. Persistencia/configuración validada por unidades y SQL aparte. Nunca copiar claves a logs/repositorio ni fijar modelos operativos.
- [x] Aplicar matriz91 por capas y proveedor/modo, con alcance y capacidades no soportadas explícitos; success real separado de catálogo, login y HTTP200. Sólo las seis revisiones aprobadas expresamente se publicaron; la ficha nueva sigue draft.

## Inventario inicial de referencias por proyecto

Este mapa se obtiene por búsqueda textual de identificadores de modo y símbolos de adaptador, ampliada por dependencias Web en Python. Es un punto de partida auditable; distinguir runtime, pruebas, documentación/migraciones históricas y falsos positivos (WebSocket, webm, URLs) antes de editar. No eliminar esas funciones por coincidencia textual.

### nodia-client — 59 archivos inicialmente relacionados

- [`src/translate/en/nodiaAi.json`](../../nodia-client/src/translate/en/nodiaAi.json)
- [`src/translate/es/nodiaAi.json`](../../nodia-client/src/translate/es/nodiaAi.json)
- [`src/layouts/components/Topbar/components/AiProviderIndicators/modeHealth.ts`](../../nodia-client/src/layouts/components/Topbar/components/AiProviderIndicators/modeHealth.ts)
- [`src/translate/en/layout.json`](../../nodia-client/src/translate/en/layout.json)
- [`src/translate/es/layout.json`](../../nodia-client/src/translate/es/layout.json)
- [`src/layouts/components/Topbar/components/AiProviderIndicators/AiProviderIndicators.tsx`](../../nodia-client/src/layouts/components/Topbar/components/AiProviderIndicators/AiProviderIndicators.tsx)
- [`src/translate/en/business.json`](../../nodia-client/src/translate/en/business.json)
- [`src/translate/es/business.json`](../../nodia-client/src/translate/es/business.json)
- [`src/modules/nodiaAi/components/SecureInteraction/SecureInteraction.tsx`](../../nodia-client/src/modules/nodiaAi/components/SecureInteraction/SecureInteraction.tsx)
- [`src/translate/en/ai_providers.json`](../../nodia-client/src/translate/en/ai_providers.json)
- [`src/translate/es/ai_providers.json`](../../nodia-client/src/translate/es/ai_providers.json)
- [`src/modules/nodiaAi/infrastructure/types.ts`](../../nodia-client/src/modules/nodiaAi/infrastructure/types.ts)
- [`src/modules/nodiaAi/infrastructure/secureFlow.ts`](../../nodia-client/src/modules/nodiaAi/infrastructure/secureFlow.ts)
- [`src/modules/nodiaAi/infrastructure/schemas.ts`](../../nodia-client/src/modules/nodiaAi/infrastructure/schemas.ts)
- [`src/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.tsx`](../../nodia-client/src/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.tsx)
- [`src/modules/nodiaAi/infrastructure/aiProviderPresentation.ts`](../../nodia-client/src/modules/nodiaAi/infrastructure/aiProviderPresentation.ts)
- [`src/modules/business/infrastructure/types.ts`](../../nodia-client/src/modules/business/infrastructure/types.ts)
- [`src/modules/generalSettings/pages/AiProviders/AiProviders.tsx`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/AiProviders.tsx)
- `src/modules/generalSettings/pages/AiProviders/infrastructure/webLogin.ts` (retirado; ruta del inventario inicial)
- [`src/modules/generalSettings/pages/AiProviders/infrastructure/useServices.ts`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/useServices.ts)
- [`src/modules/generalSettings/pages/AiProviders/infrastructure/types.ts`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/types.ts)
- [`src/modules/generalSettings/pages/AiProviders/infrastructure/services.ts`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/services.ts)
- [`src/modules/generalSettings/pages/AiProviders/infrastructure/codexSession.ts`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/infrastructure/codexSession.ts)
- [`src/test/modules/business/components/AnalysisConsole/AnalysisConsole.test.tsx`](../../nodia-client/src/test/modules/business/components/AnalysisConsole/AnalysisConsole.test.tsx)
- [`src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/types.ts`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/types.ts)
- [`src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail.tsx`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail.tsx)
- [`src/test/layouts/components/Topbar/components/AiProviderIndicators/AiProviderIndicators.test.tsx`](../../nodia-client/src/test/layouts/components/Topbar/components/AiProviderIndicators/AiProviderIndicators.test.tsx)
- `src/test/manual/web-reasoning/main.tsx` (retirado; ruta del inventario inicial)
- [`src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/components/SyncModelsModal/SyncModelsModal.tsx`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/components/ProviderDetail/components/SyncModelsModal/SyncModelsModal.tsx)
- [`src/test/modules/business/pages/BusinessDetail/components/ProductsTab/ProductInvoiceImport.test.tsx`](../../nodia-client/src/test/modules/business/pages/BusinessDetail/components/ProductsTab/ProductInvoiceImport.test.tsx)
- [`src/modules/generalSettings/pages/AiProviders/components/ProviderConnectionForm/ProviderConnectionForm.tsx`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/components/ProviderConnectionForm/ProviderConnectionForm.tsx)
- [`src/test/manual/topbar-health/main.tsx`](../../nodia-client/src/test/manual/topbar-health/main.tsx)
- [`src/test/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection.test.ts`](../../nodia-client/src/test/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection.test.ts)
- [`src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx`](../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/ProductInvoiceImport.tsx)
- [`src/modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard.tsx`](../../nodia-client/src/modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard.tsx)
- [`src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection.ts`](../../nodia-client/src/modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection.ts)
- `src/test/modules/generalSettings/pages/AiProviders/infrastructure/webLogin.test.ts` (retirado; ruta del inventario inicial)
- `src/modules/generalSettings/pages/AiProviders/components/GeminiWebAccountButton/index.ts` (retirado; ruta del inventario inicial)
- [`src/test/manual/ai-providers/README.md`](../../nodia-client/src/test/manual/ai-providers/README.md)
- `src/modules/generalSettings/pages/AiProviders/components/GeminiWebAccountButton/GeminiWebAccountButton.tsx` (retirado; ruta del inventario inicial)
- [`src/test/manual/ai-providers/main.tsx`](../../nodia-client/src/test/manual/ai-providers/main.tsx)
- [`src/test/modules/generalSettings/pages/AiProviders/components/ProviderDetail/SyncModelsModal.test.tsx`](../../nodia-client/src/test/modules/generalSettings/pages/AiProviders/components/ProviderDetail/SyncModelsModal.test.tsx)
- [`src/test/modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail.test.tsx`](../../nodia-client/src/test/modules/generalSettings/pages/AiProviders/components/ProviderDetail/ProviderDetail.test.tsx)
- [`src/test/modules/generalSettings/pages/AiProviders/components/ProviderConnectionForm/ProviderConnectionForm.test.tsx`](../../nodia-client/src/test/modules/generalSettings/pages/AiProviders/components/ProviderConnectionForm/ProviderConnectionForm.test.tsx)
- [`src/test/modules/generalSettings/pages/AiProviders/AiProviders.test.tsx`](../../nodia-client/src/test/modules/generalSettings/pages/AiProviders/AiProviders.test.tsx)
- [`src/test/modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard.test.tsx`](../../nodia-client/src/test/modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard.test.tsx)
- `src/test/modules/generalSettings/pages/AiProviders/components/GeminiWebAccountButton/GeminiWebAccountButton.test.tsx` (retirado; ruta del inventario inicial)
- [`src/test/manual/nodia-ai/verify.mjs`](../../nodia-client/src/test/manual/nodia-ai/verify.mjs)
- [`src/test/manual/nodia-ai/secure-fixtures.ts`](../../nodia-client/src/test/manual/nodia-ai/secure-fixtures.ts)
- [`src/test/manual/nodia-ai/fixtures.ts`](../../nodia-client/src/test/manual/nodia-ai/fixtures.ts)
- [`src/test/modules/nodiaAi/infrastructure/aiProviderFixtures.ts`](../../nodia-client/src/test/modules/nodiaAi/infrastructure/aiProviderFixtures.ts)
- [`src/test/modules/nodiaAi/pages/NodiaAI/NodiaAI.test.tsx`](../../nodia-client/src/test/modules/nodiaAi/pages/NodiaAI/NodiaAI.test.tsx)
- [`src/test/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.test.tsx`](../../nodia-client/src/test/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.test.tsx)
- [`src/test/modules/nodiaAi/infrastructure/fixtures.ts`](../../nodia-client/src/test/modules/nodiaAi/infrastructure/fixtures.ts)
- [`src/test/modules/nodiaAi/components/SecureInteraction/SecureInteraction.test.tsx`](../../nodia-client/src/test/modules/nodiaAi/components/SecureInteraction/SecureInteraction.test.tsx)
- [`src/test/modules/nodiaAi/components/ProposalPreview/HumanProposalReview.test.tsx`](../../nodia-client/src/test/modules/nodiaAi/components/ProposalPreview/HumanProposalReview.test.tsx)
- [`src/test/modules/nodiaAi/components/ProposalPreview/ProposalPreview.test.tsx`](../../nodia-client/src/test/modules/nodiaAi/components/ProposalPreview/ProposalPreview.test.tsx)
- [`src/test/modules/nodiaAi/infrastructure/schemas.test.ts`](../../nodia-client/src/test/modules/nodiaAi/infrastructure/schemas.test.ts)
- [`src/test/modules/nodiaAi/infrastructure/secureFlow.test.ts`](../../nodia-client/src/test/modules/nodiaAi/infrastructure/secureFlow.test.ts)

### nodia-server — 188 archivos inicialmente relacionados

- [`config/nodia-ai-knowledge.registry.json`](../../nodia-server/config/nodia-ai-knowledge.registry.json)
- [`scripts/enable-codex-catalog.mjs`](../../nodia-server/scripts/enable-codex-catalog.mjs)
- [`test/ai-api.integration.mjs`](../../nodia-server/test/ai-api.integration.mjs)
- [`scripts/observe-nodia-ai-lab-selection.mjs`](../../nodia-server/scripts/observe-nodia-ai-lab-selection.mjs)
- [`test/agentic-cli.integration.mjs`](../../nodia-server/test/agentic-cli.integration.mjs)
- [`test/ai37-performance.fixture.mjs`](../../nodia-server/test/ai37-performance.fixture.mjs)
- [`test/database-setup.integration.mjs`](../../nodia-server/test/database-setup.integration.mjs)
- [`test/codex-http.integration.mjs`](../../nodia-server/test/codex-http.integration.mjs)
- [`scripts/restore-ai-catalog.mjs`](../../nodia-server/scripts/restore-ai-catalog.mjs)
- [`test/fixtures/ai-provider-configuration.fixture.ts`](../../nodia-server/test/fixtures/ai-provider-configuration.fixture.ts)
- [`test/nodia-ai-ai09.integration.mjs`](../../nodia-server/test/nodia-ai-ai09.integration.mjs)
- [`scripts/update-ai-catalog-diagram.mjs`](../../nodia-server/scripts/update-ai-catalog-diagram.mjs)
- [`test/nodia-ai-ai10.integration.mjs`](../../nodia-server/test/nodia-ai-ai10.integration.mjs)
- [`test/nodia-ai-ai11.integration.mjs`](../../nodia-server/test/nodia-ai-ai11.integration.mjs)
- [`src/ai-provider/ai-provider.controller.ts`](../../nodia-server/src/ai-provider/ai-provider.controller.ts)
- [`test/nodia-ai-ai12-routing.integration.mjs`](../../nodia-server/test/nodia-ai-ai12-routing.integration.mjs)
- [`test/nodia-ai-ai12.integration.mjs`](../../nodia-server/test/nodia-ai-ai12.integration.mjs)
- [`test/nodia-ai-ai13.integration.mjs`](../../nodia-server/test/nodia-ai-ai13.integration.mjs)
- [`test/fixtures/nodia-ai-secure-flow.fixture.ts`](../../nodia-server/test/fixtures/nodia-ai-secure-flow.fixture.ts)
- [`test/nodia-ai-ai14.integration.mjs`](../../nodia-server/test/nodia-ai-ai14.integration.mjs)
- [`src/ai-provider/ai-provider.service.ts`](../../nodia-server/src/ai-provider/ai-provider.service.ts)
- [`test/fixtures/nodia-ai-tools.fixture.ts`](../../nodia-server/test/fixtures/nodia-ai-tools.fixture.ts)
- [`src/ai-provider/entities/ai-provider.entity.ts`](../../nodia-server/src/ai-provider/entities/ai-provider.entity.ts)
- [`src/ai-provider/entities/ai-provider-catalog.entity.ts`](../../nodia-server/src/ai-provider/entities/ai-provider-catalog.entity.ts)
- [`test/nodia-ai-ai15-external.integration.mjs`](../../nodia-server/test/nodia-ai-ai15-external.integration.mjs)
- [`src/ai-provider/dto/create-ai-provider-catalog.dto.ts`](../../nodia-server/src/ai-provider/dto/create-ai-provider-catalog.dto.ts)
- [`src/ai-provider/dto/codex-session.dto.ts`](../../nodia-server/src/ai-provider/dto/codex-session.dto.ts)
- [`test/nodia-ai-ai15-live-attest.mjs`](../../nodia-server/test/nodia-ai-ai15-live-attest.mjs)
- [`test/nodia-ai-ai15-live.integration.mjs`](../../nodia-server/test/nodia-ai-ai15-live.integration.mjs)
- [`src/ai-provider/dto/create-ai-provider.dto.ts`](../../nodia-server/src/ai-provider/dto/create-ai-provider.dto.ts)
- [`test/nodia-ai-ai15-quota-gateway.integration.mjs`](../../nodia-server/test/nodia-ai-ai15-quota-gateway.integration.mjs)
- [`src/ai-provider/use-case/ai-provider-configuration.rules.ts`](../../nodia-server/src/ai-provider/use-case/ai-provider-configuration.rules.ts)
- [`src/ai-provider/use-case/codex-chat-runtime.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/codex-chat-runtime.use-case.spec.ts)
- [`src/ai-provider/use-case/api-model-discovery.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/api-model-discovery.use-case.spec.ts)
- [`test/nodia-ai-ai15.integration.mjs`](../../nodia-server/test/nodia-ai-ai15.integration.mjs)
- [`test/nodia-ai-ai16-events.integration.mjs`](../../nodia-server/test/nodia-ai-ai16-events.integration.mjs)
- [`src/ai-provider/use-case/codex-profile-observation.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/codex-profile-observation.use-case.spec.ts)
- [`test/nodia-ai-ai16-observation.integration.mjs`](../../nodia-server/test/nodia-ai-ai16-observation.integration.mjs)
- [`src/ai-provider/dto/get-selectable-models.dto.ts`](../../nodia-server/src/ai-provider/dto/get-selectable-models.dto.ts)
- [`src/ai-provider/use-case/codex-provider-contracts.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/codex-provider-contracts.use-case.spec.ts)
- [`test/nodia-ai-ai17.integration.mjs`](../../nodia-server/test/nodia-ai-ai17.integration.mjs)
- [`src/ai-provider/types/ai-provider.types.ts`](../../nodia-server/src/ai-provider/types/ai-provider.types.ts)
- [`src/ai-provider/dto/update-ai-provider-catalog.dto.ts`](../../nodia-server/src/ai-provider/dto/update-ai-provider-catalog.dto.ts)
- [`src/ai-provider/helpers/supported-providers.helper.ts`](../../nodia-server/src/ai-provider/helpers/supported-providers.helper.ts)
- [`src/ai-provider/helpers/model-observation.helper.ts`](../../nodia-server/src/ai-provider/helpers/model-observation.helper.ts)
- [`src/ai-provider/use-case/execute-codex-invoice.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/execute-codex-invoice.use-case.spec.ts)
- [`src/ai-provider/use-case/execute-api-invoice.use-case.ts`](../../nodia-server/src/ai-provider/use-case/execute-api-invoice.use-case.ts)
- [`src/ai-provider/use-case/execute-api-invoice.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/execute-api-invoice.use-case.spec.ts)
- [`src/ai-provider/use-case/execute-codex-invoice.use-case.ts`](../../nodia-server/src/ai-provider/use-case/execute-codex-invoice.use-case.ts)
- [`src/ai-provider/use-case/get-ai-providers-health.use-case.ts`](../../nodia-server/src/ai-provider/use-case/get-ai-providers-health.use-case.ts)
- [`src/ai-provider/use-case/get-ai-providers-health.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/get-ai-providers-health.use-case.spec.ts)
- [`test/nodia-ai-ai29-gemini-real.integration.mjs`](../../nodia-server/test/nodia-ai-ai29-gemini-real.integration.mjs)
- [`test/nodia-ai-ai28.integration.mjs`](../../nodia-server/test/nodia-ai-ai28.integration.mjs)
- [`src/ai-provider/use-case/get-all-ai-providers.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/get-all-ai-providers.use-case.spec.ts)
- [`test/nodia-ai-ai29-r01.integration.mjs`](../../nodia-server/test/nodia-ai-ai29-r01.integration.mjs)
- [`src/ai-provider/use-case/get-selectable-models.use-case.ts`](../../nodia-server/src/ai-provider/use-case/get-selectable-models.use-case.ts)
- [`src/ai-provider/use-case/get-selectable-models.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/get-selectable-models.use-case.spec.ts)
- [`test/nodia-ai-ai29.integration.mjs`](../../nodia-server/test/nodia-ai-ai29.integration.mjs)
- [`src/ai-provider/use-case/manage-ai-provider-secure-session.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/manage-ai-provider-secure-session.use-case.spec.ts)
- [`src/ai-provider/use-case/get-supported-ai-providers.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/get-supported-ai-providers.use-case.spec.ts)
- [`test/nodia-ai-ai32-attachments.integration.mjs`](../../nodia-server/test/nodia-ai-ai32-attachments.integration.mjs)
- [`test/nodia-ai-ai31.integration.mjs`](../../nodia-server/test/nodia-ai-ai31.integration.mjs)
- [`src/ai-provider/use-case/manage-ai-provider-secure-session.use-case.ts`](../../nodia-server/src/ai-provider/use-case/manage-ai-provider-secure-session.use-case.ts)
- [`test/nodia-ai-ai33.integration.mjs`](../../nodia-server/test/nodia-ai-ai33.integration.mjs)
- [`test/nodia-ai-ai34.integration.mjs`](../../nodia-server/test/nodia-ai-ai34.integration.mjs)
- [`test/nodia-ai-ai36-c05-live.integration.mjs`](../../nodia-server/test/nodia-ai-ai36-c05-live.integration.mjs)
- [`src/ai-provider/use-case/save-ai-provider-catalog.use-case.ts`](../../nodia-server/src/ai-provider/use-case/save-ai-provider-catalog.use-case.ts)
- [`src/ai-provider/use-case/save-ai-provider-catalog.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/save-ai-provider-catalog.use-case.spec.ts)
- [`test/nodia-ai-ai36-c05-selection.integration.mjs`](../../nodia-server/test/nodia-ai-ai36-c05-selection.integration.mjs)
- [`test/nodia-ai-ai36-common-helpers.integration.mjs`](../../nodia-server/test/nodia-ai-ai36-common-helpers.integration.mjs)
- [`test/nodia-ai-ai36-c05-semantic-control.fixture.mjs`](../../nodia-server/test/nodia-ai-ai36-c05-semantic-control.fixture.mjs)
- [`test/nodia-ai-ai36-secure-preparation.integration.mjs`](../../nodia-server/test/nodia-ai-ai36-secure-preparation.integration.mjs)
- [`test/nodia-ai-ai36-write-preparation.integration.mjs`](../../nodia-server/test/nodia-ai-ai36-write-preparation.integration.mjs)
- [`test/nodia-ai-ai36-invoice-analysis.integration.mjs`](../../nodia-server/test/nodia-ai-ai36-invoice-analysis.integration.mjs)
- [`src/ai-provider/use-case/sync-ai-provider-models.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/sync-ai-provider-models.use-case.spec.ts)
- [`src/ai-provider/use-case/save-ai-provider-configuration.use-case.ts`](../../nodia-server/src/ai-provider/use-case/save-ai-provider-configuration.use-case.ts)
- [`test/nodia-ai-ai37-performance.integration.mjs`](../../nodia-server/test/nodia-ai-ai37-performance.integration.mjs)
- [`src/ai-provider/use-case/sync-ai-provider-models.use-case.ts`](../../nodia-server/src/ai-provider/use-case/sync-ai-provider-models.use-case.ts)
- [`test/nodia-ai-ai37-recovery.integration.mjs`](../../nodia-server/test/nodia-ai-ai37-recovery.integration.mjs)
- [`src/ai-provider/use-case/save-ai-provider-configuration.use-case.spec.ts`](../../nodia-server/src/ai-provider/use-case/save-ai-provider-configuration.use-case.spec.ts)
- [`src/nodia-ai-attachment/use-case/observe-nodia-ai-attachment-capabilities.use-case.spec.ts`](../../nodia-server/src/nodia-ai-attachment/use-case/observe-nodia-ai-attachment-capabilities.use-case.spec.ts)
- [`src/nodia-ai-adapter/use-case/route-nodia-ai-adapter.use-case.spec.ts`](../../nodia-server/src/nodia-ai-adapter/use-case/route-nodia-ai-adapter.use-case.spec.ts)
- [`src/nodia-ai-adapter/use-case/resolve-nodia-ai-adapter.use-case.ts`](../../nodia-server/src/nodia-ai-adapter/use-case/resolve-nodia-ai-adapter.use-case.ts)
- [`src/common/constants/internal-microservices.constant.ts`](../../nodia-server/src/common/constants/internal-microservices.constant.ts)
- [`src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts`](../../nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts)
- [`src/nodia-ai-write-tools/use-case/secure-flow-contracts.use-case.spec.ts`](../../nodia-server/src/nodia-ai-write-tools/use-case/secure-flow-contracts.use-case.spec.ts)
- [`src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.spec.ts`](../../nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.spec.ts)
- [`src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts`](../../nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts)
- [`src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.spec.ts`](../../nodia-server/src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.spec.ts)
- [`src/nodia-ai-write-tools/use-case/core-provider-write-contracts.use-case.spec.ts`](../../nodia-server/src/nodia-ai-write-tools/use-case/core-provider-write-contracts.use-case.spec.ts)
- [`src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.spec.ts`](../../nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.spec.ts)
- [`test/nodia-ai-run-cancellation.integration.mjs`](../../nodia-server/test/nodia-ai-run-cancellation.integration.mjs)
- [`src/migrations/1790553700000-AddTokenPlanFlagsToCatalogAndProviders.ts`](../../nodia-server/src/migrations/1790553700000-AddTokenPlanFlagsToCatalogAndProviders.ts)
- [`test/nodia-ai-live.integration.mjs`](../../nodia-server/test/nodia-ai-live.integration.mjs)
- [`test/nodia-ai-live-worker.fixture.mjs`](../../nodia-server/test/nodia-ai-live-worker.fixture.mjs)
- [`test/nodia-ai-live-unknown.fixture.mjs`](../../nodia-server/test/nodia-ai-live-unknown.fixture.mjs)
- [`test/nodia-ai-ai39.integration.mjs`](../../nodia-server/test/nodia-ai-ai39.integration.mjs)
- [`test/nodia-ai-live-concurrency.fixture.mjs`](../../nodia-server/test/nodia-ai-live-concurrency.fixture.mjs)
- [`test/nodia-ai-invoice-ocr.integration.mjs`](../../nodia-server/test/nodia-ai-invoice-ocr.integration.mjs)
- [`test/nodia-ai-ai38-mcp-diagnostic.mjs`](../../nodia-server/test/nodia-ai-ai38-mcp-diagnostic.mjs)
- [`src/migrations/1791640000000-CompleteAiProviderCatalog.ts`](../../nodia-server/src/migrations/1791640000000-CompleteAiProviderCatalog.ts)
- [`test/nodia-ai-ai38-live-routing.mjs`](../../nodia-server/test/nodia-ai-ai38-live-routing.mjs)
- [`test/nodia-ai-ai38-live-capabilities.mjs`](../../nodia-server/test/nodia-ai-ai38-live-capabilities.mjs)
- [`src/migrations/1791450000000-EnableCodexAgenticCatalog.ts`](../../nodia-server/src/migrations/1791450000000-EnableCodexAgenticCatalog.ts)
- [`src/migrations/1791320000000-RestoreAiApiCatalog.ts`](../../nodia-server/src/migrations/1791320000000-RestoreAiApiCatalog.ts)
- [`src/nodia-ai-runtime/use-case/runtime.fixture.ts`](../../nodia-server/src/nodia-ai-runtime/use-case/runtime.fixture.ts)
- [`test/nodia-ai-ai40-recovery-contract.spec.mjs`](../../nodia-server/test/nodia-ai-ai40-recovery-contract.spec.mjs)
- [`test/nodia-ai-ai40-real-canary.mjs`](../../nodia-server/test/nodia-ai-ai40-real-canary.mjs)
- [`src/migrations/1792200000000-CreateNodiaAiConversationPersistence.ts`](../../nodia-server/src/migrations/1792200000000-CreateNodiaAiConversationPersistence.ts)
- [`test/nodia-ai-ai38-context-evolution.mjs`](../../nodia-server/test/nodia-ai-ai38-context-evolution.mjs)
- [`src/nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case.ts`](../../nodia-server/src/nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case.ts)
- [`src/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.ts`](../../nodia-server/src/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.ts)
- [`src/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.spec.ts`](../../nodia-server/src/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.spec.ts)
- [`src/nodia-ai-runtime/use-case/known-rejection-checkpoint.spec.ts`](../../nodia-server/src/nodia-ai-runtime/use-case/known-rejection-checkpoint.spec.ts)
- [`src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.ts`](../../nodia-server/src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.ts)
- [`src/invoice/use-case/verify-ia-providers.use-case.ts`](../../nodia-server/src/invoice/use-case/verify-ia-providers.use-case.ts)
- [`src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.spec.ts`](../../nodia-server/src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.spec.ts)
- [`src/invoice/use-case/verify-ia-providers.use-case.spec.ts`](../../nodia-server/src/invoice/use-case/verify-ia-providers.use-case.spec.ts)
- [`src/common/ai/codex/invoice-native-runtime.spec.ts`](../../nodia-server/src/common/ai/codex/invoice-native-runtime.spec.ts)
- [`src/nodia-ai-tools/use-case/execute-nodia-ai-report-tool.use-case.spec.ts`](../../nodia-server/src/nodia-ai-tools/use-case/execute-nodia-ai-report-tool.use-case.spec.ts)
- [`src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.ts`](../../nodia-server/src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.ts)
- [`src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.spec.ts`](../../nodia-server/src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.spec.ts)
- [`src/invoice/use-case/analyze-web-without-storage.use-case.spec.ts`](../../nodia-server/src/invoice/use-case/analyze-web-without-storage.use-case.spec.ts)
- [`src/invoice/use-case/analyze-invoice.use-case.ts`](../../nodia-server/src/invoice/use-case/analyze-invoice.use-case.ts)
- [`src/invoice/use-case/analyze-invoice.use-case.spec.ts`](../../nodia-server/src/invoice/use-case/analyze-invoice.use-case.spec.ts)
- [`src/invoice/use-case/analysis-observations.use-case.spec.ts`](../../nodia-server/src/invoice/use-case/analysis-observations.use-case.spec.ts)
- [`src/invoice/types/invoice.types.ts`](../../nodia-server/src/invoice/types/invoice.types.ts)
- [`src/invoice/dto/reserve-analysis-observation.dto.ts`](../../nodia-server/src/invoice/dto/reserve-analysis-observation.dto.ts)
- [`src/invoice/dto/analyze-invoice.dto.ts`](../../nodia-server/src/invoice/dto/analyze-invoice.dto.ts)
- [`src/nodia-ai-invoice-analysis/use-case/snapshot-nodia-ai-invoice-analysis.use-case.ts`](../../nodia-server/src/nodia-ai-invoice-analysis/use-case/snapshot-nodia-ai-invoice-analysis.use-case.ts)
- [`src/nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case.spec.ts`](../../nodia-server/src/nodia-ai-secure-flow/use-case/recover-nodia-ai-secure-flows.use-case.spec.ts)
- [`src/nodia-ai-invoice-analysis/use-case/build-nodia-ai-invoice-analysis-tool.use-case.spec.ts`](../../nodia-server/src/nodia-ai-invoice-analysis/use-case/build-nodia-ai-invoice-analysis-tool.use-case.spec.ts)
- [`src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.ts`](../../nodia-server/src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.ts)
- [`src/nodia-ai-secure-flow/use-case/manage-nodia-ai-secure-flow.use-case.ts`](../../nodia-server/src/nodia-ai-secure-flow/use-case/manage-nodia-ai-secure-flow.use-case.ts)
- [`src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.spec.ts`](../../nodia-server/src/nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.spec.ts)
- [`src/nodia-ai-secure-flow/use-case/manage-nodia-ai-secure-flow.use-case.spec.ts`](../../nodia-server/src/nodia-ai-secure-flow/use-case/manage-nodia-ai-secure-flow.use-case.spec.ts)
- [`src/nodia-ai-secure-preparation/nodia-ai-secure-preparation.service.ts`](../../nodia-server/src/nodia-ai-secure-preparation/nodia-ai-secure-preparation.service.ts)
- [`src/nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.ts`](../../nodia-server/src/nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.ts)
- [`src/nodia-ai-secure-flow/use-case/durable-nodia-ai-secure-flow.use-case.spec.ts`](../../nodia-server/src/nodia-ai-secure-flow/use-case/durable-nodia-ai-secure-flow.use-case.spec.ts)
- [`src/nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.spec.ts`](../../nodia-server/src/nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.spec.ts)
- [`src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts`](../../nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts)
- [`src/nodia-ai-secure-flow/types/secure-flow.types.ts`](../../nodia-server/src/nodia-ai-secure-flow/types/secure-flow.types.ts)
- [`src/nodia-ai-context/types/invoice-ocr-discovery-hint.spec.ts`](../../nodia-server/src/nodia-ai-context/types/invoice-ocr-discovery-hint.spec.ts)
- [`src/nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case.ts)
- [`src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.spec.ts`](../../nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.spec.ts)
- [`src/nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case.spec.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case.spec.ts)
- [`src/nodia-ai-provider-operations/nodia-ai-provider-operations.service.ts`](../../nodia-server/src/nodia-ai-provider-operations/nodia-ai-provider-operations.service.ts)
- [`src/nodia-ai-context/use-case/prepare-nodia-ai-admission.use-case.ts`](../../nodia-server/src/nodia-ai-context/use-case/prepare-nodia-ai-admission.use-case.ts)
- [`src/nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.ts)
- [`src/nodia-ai-context/use-case/prepare-nodia-ai-admission.use-case.spec.ts`](../../nodia-server/src/nodia-ai-context/use-case/prepare-nodia-ai-admission.use-case.spec.ts)
- [`src/nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.spec.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.spec.ts)
- [`src/nodia-ai-context/use-case/nodia-ai-routing-target.ts`](../../nodia-server/src/nodia-ai-context/use-case/nodia-ai-routing-target.ts)
- [`src/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.spec.ts`](../../nodia-server/src/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.spec.ts)
- [`src/nodia-ai-context/use-case/nodia-ai-observation-identity.ts`](../../nodia-server/src/nodia-ai-context/use-case/nodia-ai-observation-identity.ts)
- [`src/nodia-ai-invoice-ocr/use-case/build-nodia-ai-invoice-ocr-tool.use-case.spec.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/use-case/build-nodia-ai-invoice-ocr-tool.use-case.spec.ts)
- [`src/nodia-ai-context/use-case/nodia-ai-attachment-context-boundary.spec.ts`](../../nodia-server/src/nodia-ai-context/use-case/nodia-ai-attachment-context-boundary.spec.ts)
- [`src/nodia-ai-context/use-case/build-nodia-ai-context.use-case.ts`](../../nodia-server/src/nodia-ai-context/use-case/build-nodia-ai-context.use-case.ts)
- [`src/nodia-ai-context/use-case/build-nodia-ai-context.use-case.spec.ts`](../../nodia-server/src/nodia-ai-context/use-case/build-nodia-ai-context.use-case.spec.ts)
- [`src/nodia-ai-conversation/nodia-ai-connections.service.ts`](../../nodia-server/src/nodia-ai-conversation/nodia-ai-connections.service.ts)
- [`src/nodia-ai-conversation/types/nodia-ai-persistence.types.ts`](../../nodia-server/src/nodia-ai-conversation/types/nodia-ai-persistence.types.ts)
- [`src/nodia-ai-invoice-ocr/contracts/invoice-ocr.json`](../../nodia-server/src/nodia-ai-invoice-ocr/contracts/invoice-ocr.json)
- [`src/nodia-ai-conversation/use-case/conversation-admission.fixture.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/conversation-admission.fixture.ts)
- [`src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.ts)
- [`src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.spec.ts`](../../nodia-server/src/nodia-ai-invoice-ocr/adapters/products-invoice-ocr.adapter.spec.ts)
- [`src/nodia-ai-conversation/use-case/validate-nodia-ai-snapshots.use-case.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/validate-nodia-ai-snapshots.use-case.ts)
- [`src/nodia-ai-conversation/use-case/validate-nodia-ai-snapshots.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/validate-nodia-ai-snapshots.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/observe-nodia-ai-eligibility.use-case.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/observe-nodia-ai-eligibility.use-case.ts)
- [`src/nodia-ai-conversation/dto/nodia-ai-selection.dto.ts`](../../nodia-server/src/nodia-ai-conversation/dto/nodia-ai-selection.dto.ts)
- [`src/nodia-ai-conversation/use-case/observe-nodia-ai-eligibility.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/observe-nodia-ai-eligibility.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/validate-nodia-ai-conversation-input.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/validate-nodia-ai-conversation-input.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case.ts)
- [`src/nodia-ai-conversation/dto/nodia-ai-eligibility-query.dto.ts`](../../nodia-server/src/nodia-ai-conversation/dto/nodia-ai-eligibility-query.dto.ts)
- [`src/nodia-ai-conversation/use-case/nodia-ai-connections.fixture.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/nodia-ai-connections.fixture.ts)
- [`src/nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/update-nodia-ai-conversation.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/update-nodia-ai-conversation.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case.ts)
- [`src/nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case.spec.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/project-nodia-ai-conversation.use-case.spec.ts)
- [`src/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.ts`](../../nodia-server/src/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.ts)
- [`src/nodia-ai-products/ai-settings/use-case/read-ai-settings.use-case.ts`](../../nodia-server/src/nodia-ai-products/ai-settings/use-case/read-ai-settings.use-case.ts)
- [`src/nodia-ai-products/ai-settings/use-case/read-ai-settings.use-case.spec.ts`](../../nodia-server/src/nodia-ai-products/ai-settings/use-case/read-ai-settings.use-case.spec.ts)
- [`src/nodia-ai-products/contracts/ai-settings.schema.json`](../../nodia-server/src/nodia-ai-products/contracts/ai-settings.schema.json)
- [`src/nodia-ai-products/contracts/external.schema.json`](../../nodia-server/src/nodia-ai-products/contracts/external.schema.json)
- [`src/nodia-ai-products/contracts/invoice-analysis.json`](../../nodia-server/src/nodia-ai-products/contracts/invoice-analysis.json)
- [`src/nodia-ai-products/contracts/secure-flows.json`](../../nodia-server/src/nodia-ai-products/contracts/secure-flows.json)
- [`src/nodia-ai-products/contracts/write-core-provider.json`](../../nodia-server/src/nodia-ai-products/contracts/write-core-provider.json)
- [`src/nodia-ai-products/external/use-case/read-external.use-case.ts`](../../nodia-server/src/nodia-ai-products/external/use-case/read-external.use-case.ts)
- [`src/nodia-ai-products/external/use-case/read-external.use-case.spec.ts`](../../nodia-server/src/nodia-ai-products/external/use-case/read-external.use-case.spec.ts)

### nodia-gemini-microservice — 44 archivos inicialmente relacionados

- [`AGENTS.md`](../../nodia-gemini-microservice/AGENTS.md)
- [`README.md`](../../nodia-gemini-microservice/README.md)
- `auth.py` (retirado; ruta del inventario inicial)
- `browser_manager.py` (retirado; ruta del inventario inicial)
- `docker-compose.web-reasoning.yml` (retirado; ruta del inventario inicial)
- [`experiments/README.md`](../../nodia-gemini-microservice/experiments/README.md)
- `experiments/probe_live_reasoning.py` (retirado; ruta del inventario inicial)
- [`experiments/probe_nodia_ai_agentic.py`](../../nodia-gemini-microservice/experiments/probe_nodia_ai_agentic.py)
- `experiments/probe_nodia_ai_web.py` (retirado; ruta del inventario inicial)
- `gemini_service.py` (retirado; ruta del inventario inicial)
- [`login_supervisor.py`](../../nodia-gemini-microservice/login_supervisor.py)
- [`main.py`](../../nodia-gemini-microservice/main.py)
- [`native_attachments.py`](../../nodia-gemini-microservice/native_attachments.py)
- [`nodia_ai_chat.py`](../../nodia-gemini-microservice/nodia_ai_chat.py)
- [`schemas.py`](../../nodia-gemini-microservice/schemas.py)
- [`tests/fixtures/login_supervisor_fixture.py`](../../nodia-gemini-microservice/tests/fixtures/login_supervisor_fixture.py)
- [`tests/fixtures/nodia-ai-ai15-mcp-tools.json`](../../nodia-gemini-microservice/tests/fixtures/nodia-ai-ai15-mcp-tools.json)
- [`tests/fixtures/nodia-ai-ai31-mcp-tools.json`](../../nodia-gemini-microservice/tests/fixtures/nodia-ai-ai31-mcp-tools.json)
- [`tests/test_agentic_profile_observations.py`](../../nodia-gemini-microservice/tests/test_agentic_profile_observations.py)
- `tests/test_browser_manager.py` (retirado; ruta del inventario inicial)
- `tests/test_interactive_login.py` (retirado; ruta del inventario inicial)
- `tests/test_login_viewer.py` (retirado; ruta del inventario inicial)
- [`tests/test_native_attachments.py`](../../nodia-gemini-microservice/tests/test_native_attachments.py)
- [`tests/test_nodia_ai_chat.py`](../../nodia-gemini-microservice/tests/test_nodia_ai_chat.py)
- `tests/test_nodia_ai_web_admission.py` (retirado; ruta del inventario inicial)
- [`tests/test_service_auth.py`](../../nodia-gemini-microservice/tests/test_service_auth.py)
- `tests/test_session_lifecycle.py` (retirado; ruta del inventario inicial)
- [`tests/test_support.py`](../../nodia-gemini-microservice/tests/test_support.py)
- `tests/test_web_adapter.py` (retirado; ruta del inventario inicial)
- `tests/test_web_audio_transport.py` (retirado; ruta del inventario inicial)
- `tests/test_web_candidate_diagnostics.py` (retirado; ruta del inventario inicial)
- `tests/test_web_chat_recovery.py` (retirado; ruta del inventario inicial)
- `tests/test_web_generation_diagnostics.py` (retirado; ruta del inventario inicial)
- `tests/test_web_logout.py` (retirado; ruta del inventario inicial)
- `tests/test_web_reasoning_adapter.py` (retirado; ruta del inventario inicial)
- `tests/test_web_stream_frame_diagnostics.py` (retirado; ruta del inventario inicial)
- `tests/test_web_structured_text.py` (retirado; ruta del inventario inicial)
- `tests/test_web_upload_diagnostics.py` (retirado; ruta del inventario inicial)
- `web_audio_transport.py` (retirado; ruta del inventario inicial)
- `web_candidate_diagnostics.py` (retirado; ruta del inventario inicial)
- `web_generation_diagnostics.py` (retirado; ruta del inventario inicial)
- `web_reasoning_adapter.py` (retirado; ruta del inventario inicial)
- `web_stream_frame_diagnostics.py` (retirado; ruta del inventario inicial)
- `web_upload_diagnostics.py` (retirado; ruta del inventario inicial)
