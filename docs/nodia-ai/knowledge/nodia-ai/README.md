---
{
  "schema_version": 1,
  "document_id": "nodia-ai",
  "product_id": "nodia-ai",
  "kind": "product",
  "revision": 42,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "NodiaAI mantiene chat canónico, contexto de productos, modos por selección exacta, adjuntos/voz y memoria propia aceptada. AI-15 publica67lecturas; AI-17..35 implementan revisión/confirmación humanas, recibos y recuperación, escritores nativos, informes, adjuntos R2 y organización según sus entregas/evidencias históricas. C01..C04 completan84contratos/adaptadores candidatos. C05 publica en fuentes sólo7contratos adicionales:crear movimiento financiero y6ayudantes comunes;74capacidades/31fragmentos,77candidatos restantes sin publicar. El usuario eligió descubrimiento automático por etapas:generación de descubrimiento, selección exacta contra catálogo autorizado congelado, cierre/prueba terminal/ACK, etapa local no inferente y ejecución acotada. Implementación y aceptación del nuevo camino siguen en verificación. Agentic con selección presupuesta2generaciones, Webopt-in puede requerir3; sin selección puede completar en1 con conversación o ayudantes técnicos. El callback no amplía el grant actual; después del ACK se reemplaza su allowlist bajo módulos/ámbito congelados y permisos vigentes, sin elevar límites o repetir inferencias inciertas. Sin selector de perfiles UI, Python o DDL en este bloque. La evidencia interna o publicación no acredita disponibilidad/aceptación actual del proveedor ni cierre de v1. Esta ficha conserva draft/unregistered; aprobación general y AI-36..40 pendientes según sus gates."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme a AGENTS",
  "sources": [
    {
      "path": "docs/mvp/38-nodia-ai-research-and-v1-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/45-nodia-ai-implementation-plan.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/46-nodia-ai-ai01-contract-baseline.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/50-nodia-ai-ai04-runtime-policy.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/53-nodia-ai-ai07-module-authorization.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/56-nodia-ai-ai10-admission-retention.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/57-nodia-ai-ai11-durable-worker.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/58-nodia-ai-ai12-context-execution.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/59-nodia-ai-ai13-chat-page.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/60-nodia-ai-ai14-capability-registry.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/61-nodia-ai-ai15-product-reads.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/63-nodia-ai-ai17-drafts-revisions.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/64-nodia-ai-ai18-human-confirmation.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/65-nodia-ai-ai19-financial-effect.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/66-nodia-ai-ai20-execution-recovery.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/67-nodia-ai-ai21-financial-operations.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/69-nodia-ai-ai23-dependent-workflows.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/76-nodia-ai-ai30-restricted-reports.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/78-nodia-ai-ai32-attachments-voice.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/79-nodia-ai-ai33-accepted-preferences.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/80-nodia-ai-ai34-long-context-compaction.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/81-nodia-ai-ai35-conversation-organization.md",
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
    "checked_on": "2026-10-18",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai04-runtime-policy-validation.json",
      "docs/evidence/nodia-ai-v1-catalog-contracts-validation.json",
      "docs/evidence/nodia-ai-ai02-gemini-web-viability.json",
      "docs/evidence/nodia-ai-ai03-gemini-agentic-viability.json",
      "docs/evidence/nodia-ai-ai06-knowledge-publication-validation.json",
      "docs/evidence/nodia-ai-ai07-authorization-validation.json",
      "docs/evidence/nodia-ai-ai08-authority-validation.json",
      "docs/evidence/nodia-ai-ai09-persistence-validation.json",
      "docs/evidence/nodia-ai-ai10-ai12-validation.json",
      "docs/evidence/nodia-ai-ai11-ai12-final-regression.json",
      "docs/evidence/nodia-ai-ai11-ai12-live-validation.json",
      "docs/evidence/nodia-ai-ai13-validation.json",
      "docs/evidence/nodia-ai-ai13-browser-qa.json",
      "docs/evidence/nodia-ai-ai15-postgres-integration.json",
      "docs/evidence/nodia-ai-ai15-live-local.json",
      "docs/evidence/nodia-ai-ai15-live-artifacts.json",
      "docs/evidence/nodia-ai-ai15-live-routing-interrupted.json",
      "docs/evidence/nodia-ai-ai15-live-external-final.json",
      "docs/evidence/nodia-ai-ai17-validation.json",
      "docs/evidence/nodia-ai-ai18-validation.json",
      "docs/evidence/nodia-ai-ai19-validation.json",
      "docs/evidence/nodia-ai-ai20-validation.json",
      "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "docs/evidence/nodia-ai-ai32-r04-validation.json",
      "docs/evidence/nodia-ai-ai32-r04-final-health.json",
      "docs/evidence/nodia-ai-ai32-r05-validation.json",
      "docs/evidence/nodia-ai-ai32-r06-validation.json",
      "docs/evidence/nodia-ai-ai32-r07-validation.json",
      "docs/evidence/nodia-ai-ai33-validation.json",
      "docs/evidence/nodia-ai-ai35-validation.json",
      "docs/evidence/nodia-ai-ai36-requirements-matrix.json",
      "docs/evidence/nodia-ai-ai36-c05-publication-validation.json"
    ],
    "notes": "C05 verifica offline el compilador, schemas reales del primer lote, preservación exacta de67hashes MCP y27contenidos aprobados. La implementación automática por etapas sigue en verificación; SQL, cuenta real, despliegue y aceptación productiva requieren sus evidencias propias. Aprobación null e integración unregistered conservadas para esta ficha; los hechos históricos se mantienen en las entregas enlazadas."
  },
  "approval": null
}
---

# NodiaAI — contexto de producto

Metadatos canónicos migrados en [AI-06](../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); este resumen conserva aprobación pendiente y no se publica; las secciones funcionales de lectura publicadas se identifican debajo.

## Propósito y alcance

Conversar en lenguaje natural sobre los productos de Nodia, consultar información autorizada y preparar cambios revisables. Conservar historial, decisiones y efectos al cambiar conexión/modo/modelo entre turnos. El dato de negocio permanece en su módulo y se consulta mediante herramientas, sin copiar la BD en el chat.

## Conceptos y relaciones

- Conversación: contenido canónico de un dueño, organización y selección; caduca90 días desde su último mensaje nuevo.
- Turno: trabajo admitido con selección/release fijos, independiente de que la página permanezca abierta.
- Propuesta: comandos/efectos revisables, versión y hash, pendiente de botón humano; el mensaje del modelo no la confirma.
- Ejecución: conjunto confirmado y recibos por paso; conservar lo creado al fallar otro paso.
- Conocimiento funcional: fichas versionadas autorizadas, distintas del historial, memoria y datos actuales de BD.

## Módulos y autoridad

Destino `/tools/nodia-ai`, key `nodia_ai`, catálogo/migración y política compartida implementados en [AI-07/53](../../../mvp/53-nodia-ai-ai07-module-authorization.md). IDs/asignaciones se resuelven en cada BD; instalación y asignación del entorno de uso pendientes. Navegación conserva asignación para todos, backend permite bypass a super_admin activo. Ordinarios requieren NodiaAI y cada módulo de destino, además de la autoridad del recurso. super_admin tiene el alcance transversal confirmado; reglas compartidas implementadas en AI-08. Un contenido, preferencia o nombre de herramienta no concede permiso.

## Índice de funcionalidades

| Función | Ficha | Implementación | Integración |
|---|---|---|---|
| Admisión y retención del chat | [chat-admission-retention](features/chat-admission-retention.md) | API y mantenimiento M1 verificados aisladamente | Unregistered |
| Worker durable | [durable-worker](features/durable-worker.md) | AI-11 implementado: worker independiente, perfil compartido y conciliación verificados con Gemini real | Unregistered |
| Contexto y ejecución | [context-execution](features/context-execution.md) | AI-12 implementado: loader/builder, MCP técnico y delegación opt-in verificados con Gemini real | Unregistered |
| Autoridad transversal e invariantes | [shared-authority](features/shared-authority.md) | Parcial: REST/Client y barreras verificadas; puertos pendientes | Unregistered |
| Módulo y autorización compartida | [module-authorization](features/module-authorization.md) | Catálogo/ruta/política compartida AI-07; consumidores de conversación y worker integrados posteriormente | Unregistered |
| Persistencia de conversación M1 | [conversation-persistence](features/conversation-persistence.md) | Once tablas y puertos AI-09; API/worker integrados en AI-10/11 | Unregistered |
| Coordinación de conversación y cambios | [conversation-coordination](features/conversation-coordination.md) | Parcial: API durable, página/drawer y observación AI-16; propuestas/confirmación posteriores | Unregistered |
| Viabilidad Gemini Web | [gemini-web-viability](features/gemini-web-viability.md) | Spike verificado; adaptador conversacional integrado AI-12 con historia canónica comprobada | Unregistered |
| Viabilidad Gemini Agentic/MCP | [gemini-agentic-viability](features/gemini-agentic-viability.md) | Spike verificado; worker, MCP técnico y cancelación/conciliación integrados AI-11/12 | Unregistered |
| Admisión, presupuestos y conservación | [runtime-policy](features/runtime-policy.md) | Configuración/validador AI-04; ocho gates productivos pendientes | Unregistered |
| Registro de capacidades y ToolGateway | [capability-registry-gateway](features/capability-registry-gateway.md) | AI-14 implementado/verificado localmente; familias reales vacías, sin lecturas de negocio publicadas | Unregistered |
| Metadatos y publicación del conocimiento | [knowledge-publication](features/knowledge-publication.md) | Compilador AI-06/loader AI-12 implementados; AI-15 publica27 fragmentos funcionales, esta ficha propia sigue excluida | Unregistered |

Resto de funciones de página/runtime/herramientas/adjuntos/informes/memoria se especifica en45 y se añadirá conforme a su implementación. Esta ficha no modifica el alcance ni marca esas funciones disponibles.

## Restricciones y evolución

[Política48](../../../mvp/48-nodia-ai-mode-routing-policy.md) establece Web conversacional y Agentic con MCP. El backend AI-12 implementa consentimiento opt-in revisionado para alternar desde Web sólo hacia Agentic verificado de la misma conexión en v1; API después. Revalida elegibilidad, modelo/esfuerzo, sesión/configuración y consentimiento antes del dispatch. El siguiente turno conserva Web como base. [AI-13](../../../mvp/59-nodia-ai-ai13-chat-page.md) incorpora el drawer/switch con catálogo autorizado y comprobación no generativa. Historial canónico compartido y confirmación humana de escrituras conservados; MCP técnico no concede operaciones de negocio.

Bulk/import, carpetas de chats y globo global quedan fuera de v1 según alcance; nunca SQL/HTTP arbitrario o secretos como herramienta. Las operaciones respetan el contrato de su módulo. Cambios incompatibles invalidan propuestas pendientes; receipts históricos no se reejecutan. Nuevos productos integran fichas, herramientas y pruebas sin tablas conversacionales nuevas.

[Política50](../../../mvp/50-nodia-ai-ai04-runtime-policy.md):5 minutos por voz/20 MiB por archivo confirmados, presupuestos propios globales por turno. Sin archivo técnico adicional al borrar el chat; resueltos se eliminan, sólo tareas mínimas de unknown/limpieza hasta cerrar. Negocio y preferencias aceptadas independientes. Backup/restore y borrado físico requieren gates reales; ficha/configuración no prueban ejecución.

| Revisión | Cambio | Fuente/evidencia | Impacto |
|---|---|---|---|
| 1 | Documentar el producto y coordinación AI-01 | Contratos y evidencia enlazados | No publicación ni runtime |
| 2 | Evaluación AI-02 de loop Web con cuenta | Evidencia y ficha de viabilidad | No herramientas productivas ni API; gate de admisión compartida pendiente |
| 3 | AI-03 Agentic/MCP con cuenta e historial en perfil nuevo | Evidencia49 y ficha Agentic | Adapter_states sin activar; no publicar runtime/herramientas/switch |
| 4 | Política AI-04, límites propios y conservación mínima | Política50/evidencia/ficha runtime-policy | Sin archivo adicional ni nuevas tablas; gates productivos pendientes |
| 5 | AI-05 fichas de productos y AI-06 frontmatter único/compilación | Contrato52 y ficha knowledge-publication |37 borradores; cero contexto/capacidades publicados, sin tablas nuevas |
| 6 | Módulo/política compartida AI-07 | Contrato53 y ficha module-authorization | Sin chat/herramientas publicados; AI-08 transversalidad/barreras implementadas; runtime pendiente |
| 10 | AI-11/12: worker independiente, contexto/MCP técnico, delegación y conciliación con Gemini real | Entregas57/58 y evidencia conjunta real | Producto parcial; corpus43 draft/unregistered, cero contenido/herramientas de negocio publicados |
| 12 | AI-14: registro, descubrimiento HTTP/MCP y ToolGateway con contratos/autoridad compartidos | [Entrega60](../../../mvp/60-nodia-ai-ai14-capability-registry.md) y [ficha](features/capability-registry-gateway.md) | Tres ayudantes técnicos; 44 borradores, cero familias reales publicadas; selección acotada del transporte pendiente AI-15/36 |


[Autoridad transversal AI-08](features/shared-authority.md): actor/destinatario, transacciones y NI-13.


[Persistencia AI-09](features/conversation-persistence.md): once tablas M1 y contratos cerrados. AI-10 añade mensajes/admisión/retención; AI-11/12 incorporan worker, contexto, routing y conciliación con aceptación Gemini real. [Evidencia conjunta](../../../evidence/nodia-ai-ai11-ai12-live-validation.json). AI-13 incorpora página y drawer, verificados por separado. El producto completo sigue parcial: registro/gateway AI-14 implementado y lecturas de negocio AI-15/familias, eventos públicos completos, API, adjuntos/voz, memoria/compactación y gates productivos conservan su trabajo independiente.


## Actualización AI-15 — lecturas publicadas

[Entrega y gates](../../../mvp/61-nodia-ai-ai15-product-reads.md). AI-15 implementa 59 lectores candidatos: Negocios 12, Finanzas 11, Reservas 21, Core 10 y administración IA 5. La composición consume sólo IDs de una publicación compilada aprobada; el release AI-15 contiene67 contratos y27 fragmentos de lectura. Las pruebas temporales sí ejecutan puertos nativos con PostgreSQL aislado. Los ocho puertos adicionales están implementados con límites propios y verificados aisladamente. La publicación de67 capacidades está materializada; Gemini real conserva evidencia positiva y resultados parciales descritos en61, sin aceptación universal de inferencias.


Ampliación AI-15: [contrato de ejecución y archivos](../../../mvp/61-nodia-ai-ai15-product-reads.md). Cinco consultas externas usan prepare/execute/verify con deadline, señal y fingerprint; un replay no repite red y un recibo interrumpido no se redispara. Tres referencias de artefacto permiten descargas humanas reautorizadas con datos actuales, sin URL firmada ni archivo persistente adicional. Sin cambios visuales en esta entrega.


## Publicación de lecturas AI-15 — estado actual

AI-15 publica 67 contratos de lectura/referencia con 27 fragmentos revisados, manteniendo otras 17 fichas excluidas. Gemini real verificó familias SQL y referencias/CSV; routing y externas conservan resultados parciales y desconocidos explícitos. Este resumen de producto y las doce fichas propias de NodiaAI mantienen aprobación pendiente y no tienen bindings.

El corpus incorpora46 fichas:27 funcionalidades approved/published ligadas a67 contratos read/read_artifact y19 fichas draft/unregistered excluidas. La nueva ficha de efectos confirmados de Negocios está excluida; no modifica los cuerpos de las siete fichas aprobadas de lectura de ese producto. No hay escrituras publicadas. La [autorización específica](../../../evidence/nodia-ai-ai15-publication-authorization.md) alcanza esas secciones funcionales, no este resumen. Los estados del índice describen el alcance publicado de lectura de cada función y no todo su CRUD.

[AI-15](../../../mvp/61-nodia-ai-ai15-product-reads.md) distingue diez comprobaciones SQL con Gemini real y doce de referencias/CSV, observaciones externas con recibos positivos y final incierto, y routing Web parcial. R2 sin configurar no se transforma en descarga verificada; unknown no se reenvía. Los contratos se publican con permisos y límites actuales, sin prometer que todo turno del modelo termine correctamente. Sin cambios visuales ni nuevos bindings de resumen.

## Observación y navegación AI-16

[Entrega62](../../../mvp/62-nodia-ai-ai16-observation-navigation.md) integra el journal M1, cursores individuales y resultados con autoridad actual. El historial abre actividad por intención y los enlaces apuntan a rutas reales; fecha y conteos corresponden a la consulta guardada. PostgreSQL/HTTP y Gemini real se registran por separado en la evidencia; no se repiten herramientas al regresar. Sin SSE/tokens simulados ni escrituras publicadas. La [ficha de coordinación](features/conversation-coordination.md) permanece draft/unregistered:67 capacidades/27 fragmentos publicados se conservan.

[AI-17/63](../../../mvp/63-nodia-ai-ai17-drafts-revisions.md): mínimo obligatorio→aclaración→revisión congelada, con CAS y autoridad actual. La ficha sigue draft/unregistered, sin aprobación ni herramientas nuevas.

## Canal humano AI-18

[Entrega64](../../../mvp/64-nodia-ai-ai18-human-confirmation.md): una nueva edición crea revisión/hash y exige nueva revisión humana. El desafío sólo se obtiene desde el botón de la app; el modelo no lo recibe. La solicitud original se recupera con su identidad; otra solicitud sobre una propuesta ya admitida obtiene409 y recupera con GET. El estado en cola no acredita un cambio de negocio. Los campos de categoría/obligación permanecen sólo de lectura en este primer editor. Registro operativo vacío: confirmación deshabilitada hasta completar ejecutor nativo y recuperación. Ficha draft/unregistered sin aprobación/publicación adicional.

[AI-19/65](../../../mvp/65-nodia-ai-ai19-financial-effect.md) implementa un efecto financiero interno con recibo atómico, sin nueva publicación. La preparación/ejecución operativa conserva sus gates de AI-20.


[AI-20/66](../../../mvp/66-nodia-ai-ai20-execution-recovery.md) conecta el worker al movimiento confirmado, con receipt atómico, recuperación SQL sin replay y cancelación/reanudación humanas. El flujo de preparación MCP sigue pendiente de publicación; esta ficha continúa draft/unregistered.

## Ampliación AI-21 — familia financiera

[Entrega67](../../../mvp/67-nodia-ai-ai21-financial-operations.md) amplía el registro interno y worker a doce escrituras financieras individuales: CRUD de movimientos, categorías, grupos y obligaciones. Reutiliza reglas/escritores nativos, una operación por propuesta y recibo atómico con recuperación de AI-20. Crear obligación y movimiento inicial, corregir principal y retirar pertenencias son efectos compuestos del mismo caso de uso; no habilitan secuencias arbitrarias. El ID objetivo forma parte del comando congelado y el recibo de eliminación es histórico, observable sin exigir que el registro siga presente.

Las once lecturas financieras publicadas conservan sus contratos. Los nuevos preparadores MCP siguen sin publicar; 67 capacidades/27 fragmentos de lectura no se convierten en herramientas de escritura por editar documentación. La evidencia final AI-21 está pendiente de consolidación en67 y se separará de Gemini/preparación real y aceptación productiva. Este resumen y la [ficha de coordinación](features/conversation-coordination.md) siguen draft/unregistered, con approval:null y sin nuevos sources en el registro de publicación.


## Ampliación AI-22 — efectos individuales de Negocios

[Entrega68](../../../mvp/68-nodia-ai-ai22-business-operations.md) incorpora catorce puertos internos de negocios/colaboradores, productos/logs, proveedores/contactos y facturas. Mantiene confirmación humana exacta, manager/witness compartidos y recuperación sin reejecutar para observar. Sólo un paso por propuesta; secuencias dependientes esperan AI-23. La nueva ficha de Negocios permanece draft/unregistered; las siete fichas aprobadas de lectura no cambian y no se publican preparadores MCP. Nuevo upload/promoción de adjuntos y traslado de facturas con archivo esperan AI-32; lecturas privadas/CSV existentes continúan y R2 binario real conserva su gate. La evidencia final de la etapa queda pendiente de consolidar en68, separada de Gemini y aceptación productiva.

## Ampliación AI-23 — secuencias dependientes

[Entrega69](../../../mvp/69-nodia-ai-ai23-dependent-workflows.md) reúne uno a ocho borradores del mismo chat/actor en una propuesta exacta y reemplaza las propuestas individuales reclamadas. El primer enlace operativo pasa el ID de un proveedor creado a su contacto; no habilita referencias arbitrarias ni lotes. El conjunto se ejecuta paso a paso y conserva los efectos comprometidos si otro paso falla o se cancela. Reanudar continúa lo pendiente con el mismo comando; corregir exige otra propuesta/botón y enlaza la ejecución previa.

La [ficha de coordinación](features/conversation-coordination.md) detalla referencias futuras, edición por paso, first-bind durable y límites de recuperación. Son ampliaciones draft/unregistered, sin nuevas fuentes documentales, aprobación ni escrituras MCP publicadas. La evidencia SQL/worker/migración y Client se consolida en69; QA sintético no acredita Gemini. El contexto publicado conserva67 lecturas/referencias y27 fragmentos, sujeto al build/pin de release validado por Server.


AI-30 incorpora [fuentes e informes restringidos](features/restricted-reports.md), motor interno de una fuente y catálogo autorizado; combinación y presentación quedan en AI-31. Ver [entrega76](../../../mvp/76-nodia-ai-ai30-restricted-reports.md). Sin publicación MCP implícita.

AI-31 incorpora composición de fuentes, puertos técnicos de lectura y presentación del recibo con totales/procedencia separados; ver [entrega77](../../../mvp/77-nodia-ai-ai31-cross-reports.md). La ficha de informes sigue draft/unregistered; no habilita operaciones por Markdown.

AI-32: [adjuntos y notas de voz](features/attachments-and-voice.md), draft/unregistered; contratos, límites y evidencia en[78](../../../mvp/78-nodia-ai-ai32-attachments-voice.md).

AI-32-R01: [evidencia vigente](../../../evidence/nodia-ai-ai32-r01-validation.json) y [entrega78](../../../mvp/78-nodia-ai-ai32-attachments-voice.md). JSON Web con citas externas canónicas corregido; imagen/PDF comprobados en Web y Agentic, audio español y archivo+MCP sintético de lectura en Agentic.337 pruebas Python Linux; audio Web, R2 real, micrófono físico y traslado legacy mantienen aceptación pendiente. Esta ficha continúa draft/unregistered y no publica herramientas.

AI-32-R02: [entrega78](../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r02--formatos-de-audio-y-traslado-legacy), [evidencia](../../../evidence/nodia-ai-ai32-r02-validation.json). Pruebas por MIME exacto, WAV español verificado en Web, audio comprimido Web pendiente; traslado legacy implementado con135 checks SQL/regresión y storage sintético. Sin conversión automática ni nuevos preparadores MCP publicados. R2 real/micrófono físico conservan sus gates. Los párrafos R01 anteriores son históricos.


## Revalidación AI-32-R05

R2 y voz física verificadas en el flujo Web desde la app, con originales sin interpretación aceptada, respuesta, descarga privada y recarga. El formulario mantiene contenido y acciones dentro del chat; cargar historial se bloquea durante captura. Evaluación de impacto visual: no cambia contratos, herramientas, permisos o significado de los datos. [Entrega R05](../../../mvp/78-nodia-ai-ai32-attachments-voice.md) documenta los límites; esta ficha permanece draft/unregistered y sin aprobación.


## Revalidación AI-32-R06

Purga por generación y copias de factura verificadas con R2 real, casos de uso compilados y SQL desechable; la copia de factura sobrevive a la expiración del chat. Reemplazo con contenido distinto, traslado legacy, rollback y recuperación conservan sus contratos. No se equipara esta prueba con publicación MCP o aceptación productiva. [Entrega R06](../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r06--purga-y-copias-de-factura-con-r2-real) mantiene evidencia y límites. Ficha draft/unregistered y approval null conservados.

## Cierre técnico AI-32-R07

R07 completa lifecycle del inspector (hijo muerto/timeout/cancelación, cuatro casos Windows/Linux) y expiración durante PUT con recuperación R2 en otro proceso y ventana70s real. Cierre técnico AI-32 en laboratorio; aceptación productiva/publicación separadas, sin aprobar la ficha. [Entrega](../../../mvp/78-nodia-ai-ai32-attachments-voice.md#revalidación-ai-32-r07--aceptación-técnica-y-recuperación-tras-put-tardío) y [evidencia](../../../evidence/nodia-ai-ai32-r07-validation.json). Las modalidades mantienen sus pruebas exactas R04/R05; R07 no añade inferencia ni disponibilidad.

## Preferencias aceptadas AI-33

[Ficha](features/accepted-preferences.md) y [entrega79](../../../mvp/79-nodia-ai-ai33-accepted-preferences.md): memoria explícita propia, independiente del chat, sin secretos ni permisos. Crear/editar/olvidar exige propuesta y botón exactos; contexto reautorizado, límite50 y exclusión de recuerdos no disponibles. SQL36 y UI sintética verificados; herramientas MCP de preferencias aún sin publicar.


## Contexto largo AI-34

[Ficha](features/long-context-compaction.md) y [entrega80](../../../mvp/80-nodia-ai-ai34-long-context-compaction.md): snapshots vinculados a secuencia/hash y scope, originales intactos, referencias operativas actuales y error explícito si no cabe. SQL36 y regresiones verificados; Web y Agentic compactan y responden desde memoria con cuenta real. MCP completa un callback sintético con ACK. Cierre técnico de laboratorio por capas, sin aceptación productiva ni nueva publicación MCP; formatos de adjuntos conservan su verificación independiente.

- [Organización e interacción del chat](features/conversation-organization.md): AI-35, draft/unregistered; [entrega81](../../../mvp/81-nodia-ai-ai35-conversation-organization.md).

- [Pruebas integrales y cobertura AI-36](../../../mvp/82-nodia-ai-ai36-integral-coverage.md): evidencia por capa y contratos pendientes; no nueva capacidad publicada.

- [Codex Agentic en NodiaAI](features/context-execution.md#extensión-planificada-codex-ai-3940): ampliación planificada AI-39/40; reutiliza conocimiento, autoridad y confirmación, sin nueva publicación.


## Continuación AI36-C01 — preparación MCP candidata

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c01--contratos-y-adaptadores-de-preparación-mcp), [ADR-061](../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md) y [evidencia](../../../evidence/nodia-ai-ai36-c01-validation.json). Esta continuación actualiza el estado histórico descrito arriba: existen 73 contratos cerrados y adaptadores candidatos para Finanzas, Negocios, Reservas, Core y configuración no secreta de proveedores. La documentación y el código no los publican automáticamente.

Una petición parcial puede generar preguntas sobre los campos mínimos; continuar exige borrador y revisión exactos. El backend fija actor, sesión y conversación, conserva validación nativa y contrasta el resultado completo con la propuesta persistida. Un resultado inválido revierte borrador, propuesta y recibo MCP conjuntamente. Reutilizar un call_id sólo recupera su recibo exacto con autoridad vigente. El modelo no confirma ni ejecuta: el botón humano sobre la propuesta exacta conserva su canal autenticado.

Los campos JSON flexibles nativos admitidos se representan como datos tipados cerrados; no habilitan comandos, secretos ni campos de autoridad. Los límites físicos del transporte pueden rechazar tamaños/profundidades aceptados por una API nativa. No se inventan capacidades por tener un endpoint o un nombre en el catálogo.

PostgreSQL desechable comprueba dos recorridos representativos, financieros y de proveedor, con 22 comprobaciones de preparación, confirmación, recibo, replay, revocación y rollback. No hubo inferencia Gemini, R2, despliegue ni modificación de datos operativos. Las 67 capacidades de lectura y 27 fragmentos publicados permanecen intactos; los 73 preparadores siguen sin publicar. Selección del catálogo y aceptación real son gates posteriores; los cuatro flujos seguros, analizador de factura y seis ayudantes conservan C02..C04. No hay cambios visuales, de tablas, migraciones o endpoints en C01.


## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.


## AI36-C03 — análisis de factura en generación activa

La [ficha de análisis activo](../businesses/features/active-invoice-analysis.md) detalla el candidato MCP de dos fases y sus límites. Reutiliza el parser nativo, acredita el adjunto original del turno y conserva una extracción pendiente de revisión. No inicia OCR anidado ni crea registros comerciales. [Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md) conserva la separación entre implementación, pruebas, publicación y aceptación real.


## AI36-C04 — seis ayudantes comunes candidatos

[Entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) y [evidencia C04](../../../evidence/nodia-ai-ai36-c04-validation.json) documentan los contratos/adaptadores explícitos de propuestas, operaciones, conjuntos, adjuntos y preferencias. Las lecturas de propuestas/operaciones/adjuntos quedan ligadas al chat del contexto backend; las preferencias pertenecen al actor, incluso para super_admin. El metadato de adjunto no entrega contenido, nombre de archivo, interpretación, URL o clave de almacenamiento. Las preparaciones sólo generan borrador/propuesta: el botón y canal humanos conservan confirmación, ejecución, reanudación/cancelación y aceptación de memoria. Sin cambios visuales ni impacto de layout/responsive/bundle cliente. Esta ficha permanece draft/unregistered; su actualización no publica herramientas.

## AI36-C05 — publicación selectiva y descubrimiento por etapas

El usuario eligió «Descubrimiento automático por etapas». La [entrega82](../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c05--publicación-selectiva-y-descubrimiento-por-etapas) y el [ADR-063 propuesto](../../../architecture/decisions/ADR-063-nodia-ai-bounded-staged-discovery.md) separan esa decisión de la aprobación documental y de la aceptación operativa.

La primera publicación selectiva añade crear un movimiento financiero y seis ayudantes comunes a las67lecturas existentes:74capacidades/31fragmentos,59fuentes/28excluidas;77candidatos siguen sin publicar. Se conservan los27contenidos aprobados anteriores, sus contratos y hashes MCP. El epoch opaco heredado conserva compatibilidad de recibos; el release de contenido cambia. La [autorización estrecha](../../../evidence/nodia-ai-ai36-c05-publication-authorization.md) se limita a los siete contratos y cuatro secciones necesarias; esta ficha de producto/arquitectura permanece draft/unregistered.

La generación de descubrimiento presenta ocho herramientas técnicas, incluidas búsqueda/descripción autorizadas y `nodia_capabilities_select`. La selección contiene IDs exactos contra el catálogo global publicado/autorizado y su hash congelado; el recibo no amplía el grant de la generación en vuelo. Una vez comprobados el cierre nativo, prueba terminal y ACK, la etapa local `tool_selection`, sin inferencia, reemplaza la allowlist del grant por la selección validada bajo módulos/ámbito congelados y permisos vigentes, y reanuda inferencia normal o delegada. La ejecución recibe sólo el subconjunto más siete técnicos; desaparece la herramienta de selección. No se modifica una generación en vuelo ni se trunca un catálogo para hacerlo caber.

Se mantienen74herramientas/131072bytes de catálogo y las cotas independientes JSON128, grant SQL128 y contexto262144bytes. Agentic usa dos generaciones cuando solicita/valida selección; un saludo, aclaración o informe técnico acotado puede completar en una sin seleccionar capacidades. Web→Agentic opt-in puede requerir tres, siempre en la misma conexión y sin cambiar proveedor/modo por error o repetir inferencias inciertas. Los perfiles explícitos `finance_assistance` y compatibilidad de lecturas son opciones API/backend/pruebas; no se incorpora un selector de perfiles a la UI.

La [matriz por capacidad](../../../evidence/nodia-ai-ai36-c05-publication-validation.json) distingue publicación en fuentes, selección candidata, pruebas internas por familia, evidencia externa histórica y aceptación actual pendiente. El perfil financiero de18capacidades no acredita aceptación automática. La nueva transición está en implementación/verificación; no atribuirle todavía SQL o inferencia real del candidato. Se reutilizan manifiestos, grants, recibos y etapas, sin Python, DDL o UI nuevos. Los efectos siguen necesitando la propuesta exacta y botón humano; selección automática no acepta preferencias ni confirma cambios.
