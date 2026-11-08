---
{
  "schema_version": 1,
  "document_id": "nodia-ai.conversation-coordination",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 18,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "API chat code and common permission/confirmation/runtime contracts implemented. Real provider/model/media qualification and VM adoption require their separate receipts; documentary approval does not certify all151 operations."
  },
  "integration_status": "verified",
  "maintainer": "Mantenimiento del módulo NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/46-nodia-ai-ai01-contract-baseline.md",
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
      "path": "docs/mvp/55-nodia-ai-ai09-conversation-persistence.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/59-nodia-ai-ai13-chat-page.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/62-nodia-ai-ai16-observation-navigation.md",
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
      "path": "docs/mvp/82-nodia-ai-ai36-integral-coverage.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/nodia-ai-common-reads/use-case/build-nodia-ai-common-read-tools.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-common-preparation/use-case/build-nodia-ai-common-preparation-tools.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "docs/mvp/92-nodia-ai-api-chat-parity.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/89-module-access-and-user-data-scope.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-10-27",
    "evidence_paths": [
      "docs/evidence/nodia-ai-v1-catalog-contracts-validation.json",
      "docs/evidence/nodia-ai-ai09-persistence-validation.json",
      "docs/evidence/nodia-ai-ai13-validation.json",
      "docs/evidence/nodia-ai-ai13-browser-qa.json",
      "docs/evidence/nodia-ai-ai16-events-postgres.json",
      "docs/evidence/nodia-ai-ai16-observation-postgres.json",
      "docs/evidence/nodia-ai-ai17-validation.json",
      "docs/evidence/nodia-ai-ai18-validation.json",
      "docs/evidence/nodia-ai-ai19-validation.json",
      "docs/evidence/nodia-ai-ai20-validation.json",
      "docs/mvp/68-nodia-ai-ai22-business-operations.md",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c02-validation.json",
      "docs/evidence/nodia-ai-ai36-c04-validation.json",
      "docs/evidence/api-chat-knowledge-review-r01.json",
      "docs/evidence/api-chat-knowledge-review-r02.json",
      "docs/evidence/api-chat-sql-runtime-r01.json",
      "docs/evidence/api-chat-knowledge-human-approval-r01.json"
    ],
    "notes": "Approved successor/new explanatory revision;19 real isolated PostgreSQL runtime checks and local source/contract regressions verified. Full common-gateway SQL, live API/media and coordinated adoption are separate technical gates. Approved body unchanged from R02."
  },
  "approval": {
    "reference": "docs/evidence/api-chat-knowledge-human-approval-r01.json",
    "revision": 18,
    "content_sha256": "2de014ea07523dd77aa8e1a5fc9c9e3d23412815b4b7b05fd164b32c4ac2b4ee"
  }
}
---

# Coordinación de conversaciones y cambios

## Ampliación API key — 2026-10-27

[Plan92](../../../../mvp/92-nodia-ai-api-chat-parity.md), [ADR-084](../../../../architecture/decisions/ADR-084-nodia-ai-api-chat-common-runtime.md) y [paridad API](api-key-chat-parity.md) definen esta ampliación. Aprobación documental, implementación, calificación técnica y adopción por entorno se acreditan por separado en sus metadatos e informes fechados. Los [originales anteriores](../../../../evidence/api-chat-knowledge-originals-catalog-r01.json) conservan sus bytes y aprobaciones históricas; no se revocan ni se sustituyen sus evidencias por un resultado inventado.

API OpenAI/Gemini reutiliza catálogo, ToolGateway, grants, permisos y confirmación comunes. Aplican [contratos41](../../../../mvp/41-nodia-ai-v1-contracts.md) y [política89](../../../../mvp/89-module-access-and-user-data-scope.md): módulo NodiaAI y destinos autorizados, propietario/colaborador y bypass legítimo de super_admin sin omitir invariantes o botón humano. Las acciones históricas de roles no añaden un bloqueo contrario a89. Seleccionar capacidades o escribir «sí» no confirma una propuesta ni ejecuta efectos; revisión/hash, ejecución idempotente y recibos permanecen independientes del modo.

`supports_tools` describe soporte de solicitudes de herramientas; API usa function calling y mantiene `supports_mcp:false`. Configuración/catálogo listos no son health remoto ni éxito de inferencia. Conexión/modelo/esfuerzo son explícitos y dinámicos, sin defaults de modelo ni fallback API↔Agentic. Los tres envíos generativos actuales por run incluyen cada POST API y sus continuaciones, reservados durablemente antes de transmitir; reiniciar o reintentar no devuelve presupuesto.

El ledger HTTP y descriptor privado schema3 distinguen cierre local (`local_transport_closed`) de resultado remoto (`remote_outcome:completed|unknown`); no simulan un proceso nativo cerrado. Timeout/abort/crash no prueban cancelación remota ni coste cero. Conciliación/ACK exigen identidad y cierre local demostrados, sin autoretry de inferencia incierta. Las pruebas y publicación se cierran por separado con [plan91](../../../../mvp/91-ai-provider-onboarding-verification.md), sin aceptar todas las operaciones por un success acotado.

La selección explícita API usa el mismo chat, historial, borrador, contexto autorizado, discovery y transición de selección/grant que Agentic. La función del proveedor sólo consulta o prepara mediante el gateway; no llama al endpoint humano de confirmación. Los comandos aprobados usan escritores nativos, locks, idempotencia y recibos existentes; no nace un ejecutor comercial paralelo.

El presupuesto por POST es acumulado entre etapas del run, incluida compactación cuando aplique. Recuperar eventos, una respuesta perdida o un recibo sólo observa bajo permisos actuales. Se conserva la identidad del envío; unknown remoto no se transforma en resultado exitoso por ACK local. La UI distingue soporte de herramientas de MCP y no habilita controles por una observación de otra conexión/modo/modelo/esfuerzo. Las regresiones locales de Client no sustituyen SQL, proveedor real o UI/VM autenticada del nuevo contrato.

## Cortes anteriores conservados

> Las secciones inferiores conservan decisiones, pruebas y estados del corte anterior a esta ampliación API. Sus expresiones «actual», API posterior, permisos por acciones o publicación se leen en su fecha histórica, no como prohibición o aceptación del contrato nuevo. La regla vigente de esta revisión es el bloque API superior; las evidencias originales no se reescriben.

Estado actual AI36-C05: sólo se publica la sección «Coordinación publicada en AI36-C05». Los apartados anteriores documentan etapas históricas; sus referencias a draft o publicación pendiente no revocan este fragmento ni habilitan otras capacidades.

[Producto](../README.md). Metadatos canónicos migrados en [AI-06](../../../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md); esta revisión no cambia el estado de aprobación ni publica capacidades.

## Qué resuelve

Separar conversación, preparación y ejecución para que preguntar o editar una preview no modifique registros del negocio. Cada cambio necesita mínimos reales y dudas resueltas; el usuario confirma la revisión/hash exactos desde la app. Una ejecución puede terminar parcialmente y debe mostrar efectos ya comprometidos.

## Solicitudes y aclaraciones

| Ejemplo ilustrativo | Interpretación | Resolución |
|---|---|---|
| «Registra comida por20.000» | Preparar gasto | Preguntar estado/categoría/nombre dudosos u obligatorios; propuesta del dominio, sin ejecución inmediata |
| «Cambia ese importe» | Editar campo registrado de propuesta vigente | Identificar paso/campo, regenerar preview/revisión/hash y volver a confirmar |
| «Cancela lo que está ejecutándose» | Cancelación de conjunto, distinta de cancelar reserva | Aclarar si refiere a ejecución o registro de negocio; conservar/reconciliar efectos iniciados |
| «Muéstrame el resultado» | Recuperar estado/resultado autorizado | Consultar receipt/tool result con permiso actual; no reenviar comandos |

## Operaciones y contratos

El alcance completo comprende conversaciones/mensajes/turnos/eventos, metadata/selección, propuestas/confirmaciones y recuperación. [El índice de31 rutas](../../../../mvp/nodia-ai-v1-coordination-api.json) distingue25 implementadas y6 pendientes. AI-16 añade resumen/feed por turno y recuperación de resultado/metadata de herramientas; consultar sólo observa. Los cambios de negocio siguen sus casos de uso y futuras herramientas de preparación/confirmación.

[Página/drawer AI-13](../../../../mvp/59-nodia-ai-ai13-chat-page.md): abrir un chat recupera datos sin reenviar. Configuración por conversación, selección dinámica exacta entre turnos y switch Web→Agentic opt-in sólo con destino verificado de la misma conexión; API posterior. El catálogo configurado no acredita ejecución, y la comprobación de disponibilidad no genera ni habilita herramientas. AI-16 observa eventos reales mediante polling y cursor individual; el historial abre la actividad del mensaje por intención. Sin deltas simulados. AI-17 añade vista previa por revisión exacta y AI-18 incorpora edición registrada, botón humano y recuperación. Adjuntos y organización avanzada conservan sus etapas posteriores; ejecutar cambios exige AI-19..20.

## Datos mínimos y autoridad

IDs/revisiones/hash delimitan el objeto exacto; campos editables provienen del registro. Actor/sesión/alcance efectivo/idempotencia/versiones internas los controla Server. IDs bigint y dinero conservan strings y reglas del dominio. Si un dato obligatorio o una entidad/período no está claro, preguntar. No pedir todos los opcionales ni inferir estado pagado o fecha económica.

El canal del modelo descubre/consulta/prepara. Token de aprobación, cookies, claves, sesión Nodia y acceso a DB permanecen fuera. La app usa desafío y botón autenticados; texto «sí» o instrucción en un documento no ejecuta una propuesta. Conversaciones ordinarias son propias; super_admin puede inspeccionar y operar bajo su identidad, sin confirmar como otra persona.

## Informes y resultados

Este feature coordina consultas, no define medidas financieras. Fuentes/grano/fecha/moneda/procedencia se registran por dominio. Eventos llevan transiciones/deltas y refs a resultados, sin informes completos repetidos. El resultado del tool debe validar contra su schema concreto antes de mostrarse o utilizarse.

[AI-16/62](../../../../mvp/62-nodia-ai-ai16-observation-navigation.md) conserva el resultado exacto registrado y añade metadata cerrada reautorizada. La fecha corresponde a la consulta original, no garantiza que el dato siga vigente. Conteos ausentes son desconocidos; cero se conserva. Los enlaces permiten abrir detalle de negocio, alojamiento o módulo real según rutas existentes; no inventan una vista de detalle ni aceptan URLs del modelo. Perder permiso oculta refs/datos; reabrir sólo usa GET y no renueva retención ni repite herramientas.

## Fallos y recuperación

Revisión/hash/permiso obsoletos requieren conflicto/revisión; conservar borrador y foco. Doble clic o respuesta perdida recupera la identidad original bajo autoridad actual. unknown se reconcilia antes de reintentar. Cancelar bloquea futuros pasos, no simula rollback. Cada efecto necesita transacción/receipt o idempotencia/recovery nativos comprobados; pendientes en AI-18..29.

## Pendientes y evolución

- [x] Formas comunes, edición estructurada, errores, eventos y canales definidos en AI-01.
- [x] Baseline y fixtures de forma verificados offline, sin datos/cuentas reales.
- [x] Casos de uso, autorización, DB/worker y primera página/drawer; verificación local por etapas, sin aceptación productiva implícita.
- [x] Viabilidad independiente de texto Gemini Web/Agentic y MCP técnico en laboratorio AI-02/03/11/12.
- [x] AI-16: eventos durables, resultados con autoridad actual e historial/navegación registrados, sin duplicar resultados ni simular tokens.
- [x] AI-17: preparación financiera interna, borradores/revisiones/hash y preview readonly, sin publicar MCP prepare.
- [ ] Modalidades, confirmación/escrituras y gates productivos independientes.
- [ ] Publicación y aprobación explícita de ficha.

| Revisión | Cambio | Impacto |
|---|---|---|
| 1 | Contratos AI-01 y límites de coordinación | Shapes no prueban autoridad, transacción o inferencia; contexto aún no publicado |


[Persistencia AI-09](conversation-persistence.md): once tablas M1. [AI-10](chat-admission-retention.md) añade mensajes/admisión/retención automática; [worker](durable-worker.md) y [contexto](context-execution.md) documentan la evidencia real separada de la UI. AI-13 configura consentimiento; AI-15 publica lecturas y AI-16 observa eventos/resultados desde la página. AI-17 guarda borradores/propuestas y revisiones; confirmación y efectos conservan las etapas siguientes.

[AI-17/63](../../../../mvp/63-nodia-ai-ai17-drafts-revisions.md): mínimo obligatorio→aclaración→revisión congelada, con CAS y autoridad actual. La ficha sigue draft/unregistered, sin aprobación ni herramientas nuevas.

## Canal humano AI-18

[Entrega64](../../../../mvp/64-nodia-ai-ai18-human-confirmation.md): una nueva edición crea revisión/hash y exige nueva revisión humana. El desafío sólo se obtiene desde el botón de la app; el modelo no lo recibe. La solicitud original se recupera con su identidad; otra solicitud sobre una propuesta ya admitida obtiene409 y recupera con GET. El estado en cola no acredita un cambio de negocio. Los campos de categoría/obligación permanecen sólo de lectura en este primer editor. Registro operativo vacío: confirmación deshabilitada hasta completar ejecutor nativo y recuperación. Ficha draft/unregistered sin aprobación/publicación adicional.

[AI-19/65](../../../../mvp/65-nodia-ai-ai19-financial-effect.md) implementa un efecto financiero interno con recibo atómico, sin nueva publicación. La preparación/ejecución operativa conserva sus gates de AI-20.


## Extensión AI-20: ejecución local y recuperación

[Entrega66](../../../../mvp/66-nodia-ai-ai20-execution-recovery.md) conecta el worker al efecto financiero de un solo paso y habilita su admisión nativa exacta. Cancelar espera las barreras SQL: conserva un commit realizado y cancela sólo lo no comprometido. Recuperar nunca invoca el escritor; un rollback local probado permite reanudación explícita con la misma identidad/hash y sesión vigente. Cambios materiales exigen otra propuesta/botón. El chat puede reabrirse para observar el recibo y abrir Finanzas; el recibo es histórico. Purga de chat elimina su journal resuelto sin borrar el movimiento. No hay tablas/columnas nuevas, aprobación documental ni preparación MCP publicada. Secuencias y otras operaciones mantienen sus etapas.

## Extensión AI-21: coordinación de doce escrituras financieras

[Entrega67](../../../../mvp/67-nodia-ai-ai21-financial-operations.md) reutiliza el protocolo para crear/actualizar/eliminar movimientos, categorías, grupos y obligaciones. Sigue admitiendo un paso por propuesta, sin dependencias ni bindings. Una operación nativa puede modificar varias filas atómicamente; la revisión muestra esos efectos y no ofrece editar saldos calculados como comandos independientes.

El binding de los nuevos puertos incluye objetivo y envelope completo; creación de movimiento v2 conserva su contrato/binding/recibo histórico. La observación valida receipts de create/update/delete sin requerir existencia actual del registro afectado. Cancelar no compensa lo comprometido; sólo rollback local probado ofrece resume explícito bajo contrato original y autoridad actual. Cambios materiales requieren otra revisión y botón.

La ampliación no añade rutas, tablas/columnas ni preparación MCP publicada. Más de128 pertenencias supera la política de colecciones y se rechaza sin mostrar una preview truncada. La evidencia final AI-21, preparación real con Gemini y publicación mantienen gates separados; esta ficha no se aprueba automáticamente.


## Ampliación AI-22 — efectos individuales de Negocios

[Entrega68](../../../../mvp/68-nodia-ai-ai22-business-operations.md) incorpora catorce puertos internos de negocios/colaboradores, productos/logs, proveedores/contactos y facturas. Mantiene confirmación humana exacta, manager/witness compartidos y recuperación sin reejecutar para observar. Sólo un paso por propuesta; secuencias dependientes esperan AI-23. La nueva ficha de Negocios permanece draft/unregistered; las siete fichas aprobadas de lectura no cambian y no se publican preparadores MCP. Nuevo upload/promoción de adjuntos y traslado de facturas con archivo esperan AI-32; lecturas privadas/CSV existentes continúan y R2 binario real conserva su gate. La evidencia final de la etapa queda pendiente de consolidar en68, separada de Gemini y aceptación productiva.

## Extensión AI-23 — conjuntos dependientes

[Entrega69](../../../../mvp/69-nodia-ai-ai23-dependent-workflows.md) amplía la coordinación a uno a ocho borradores del mismo chat/actor. El conjunto reclama esos borradores y reemplaza sus propuestas individuales anteriores, para evitar confirmar la misma intención por dos caminos. La revisión/hash congela orden, ámbitos, cambios y referencias; corregir una revisión lista remapea las identidades y exige otro botón.

Ejemplo: «Crea este proveedor y agrega su contacto». Primero se reúne el negocio, datos mínimos del proveedor y datos mínimos del contacto. El contacto muestra el ID del proveedor como referencia al paso anterior, sin inventar un número. Sólo ese enlace registrado está habilitado inicialmente; no se enlazan campos arbitrarios, SQL o resultados textuales del agente.

Si el proveedor se compromete y falla el contacto, el proveedor continúa creado. Recuperar sólo consulta; reanudar conserva el mismo ID y sólo continúa los pasos pendientes bajo autoridad y precondiciones actuales. Corregir datos pendientes prepara otra propuesta con relación a la ejecución previa y necesita nueva confirmación. Cancelar no deshace los pasos completados ni habilita replay de un resultado incierto.

La interfaz agrupa campos repetidos por paso, muestra las dependencias y conserva recibos históricos aun cuando el conjunto falle o se cancele. Su QA sintético no demuestra SQL ni Gemini. El first-bind durable, la migración de dos columnas y los escenarios de concurrencia/recuperación se consolidan en69. Esta ficha permanece draft/unregistered; no se publican herramientas por actualizarla.


## Continuación AI36-C01 — preparación MCP candidata

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c01--contratos-y-adaptadores-de-preparación-mcp), [ADR-061](../../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md) y [evidencia](../../../../evidence/nodia-ai-ai36-c01-validation.json). Esta continuación actualiza el estado histórico descrito arriba: existen 73 contratos cerrados y adaptadores candidatos para Finanzas, Negocios, Reservas, Core y configuración no secreta de proveedores. La documentación y el código no los publican automáticamente.

Una petición parcial puede generar preguntas sobre los campos mínimos; continuar exige borrador y revisión exactos. El backend fija actor, sesión y conversación, conserva validación nativa y contrasta el resultado completo con la propuesta persistida. Un resultado inválido revierte borrador, propuesta y recibo MCP conjuntamente. Reutilizar un call_id sólo recupera su recibo exacto con autoridad vigente. El modelo no confirma ni ejecuta: el botón humano sobre la propuesta exacta conserva su canal autenticado.

Los campos JSON flexibles nativos admitidos se representan como datos tipados cerrados; no habilitan comandos, secretos ni campos de autoridad. Los límites físicos del transporte pueden rechazar tamaños/profundidades aceptados por una API nativa. No se inventan capacidades por tener un endpoint o un nombre en el catálogo.

PostgreSQL desechable comprueba dos recorridos representativos, financieros y de proveedor, con 22 comprobaciones de preparación, confirmación, recibo, replay, revocación y rollback. No hubo inferencia Gemini, R2, despliegue ni modificación de datos operativos. Las 67 capacidades de lectura y 27 fragmentos publicados permanecen intactos; los 73 preparadores siguen sin publicar. Selección del catálogo y aceptación real son gates posteriores; los cuatro flujos seguros, analizador de factura y seis ayudantes conservan C02..C04. No hay cambios visuales, de tablas, migraciones o endpoints en C01.


## Continuación AI36-C02 — preparación segura candidata

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c02--preparación-mcp-de-cuatro-flujos-seguros), [decisión](../../../../architecture/decisions/ADR-061-nodia-ai-mcp-write-preparation.md#extensión-ai36-c02--cuatro-preparadores-del-canal-seguro) y [evidencia](../../../../evidence/nodia-ai-ai36-c02-validation.json). Se añaden contratos/adaptadores candidatos de alta y actualización de API key, login de conexión y logout propio. Mantienen parciales no secretos, revisión CAS, permisos vigentes y propuesta exacta. MCP no recibe secretos/códigos ni descriptores de interacción: el botón humano admite la ejecución y el worker pausa antes de abrir el canal seguro.

Los tres flujos de proveedor exigen Ajustes IA y ai:manage. Cerrar la sesión Nodia actual usa únicamente la autoridad basal NodiaAI y el actor/sesión autenticados; el recurso separado nodia_sessions evita heredar permisos de proveedor. No se puede elegir una sesión ajena. La normalización y mínimos nativos permanecen en sus casos de uso, sin duplicarlos en el chat. Las API keys administran conexiones existentes; esto no habilita inferencia API en NodiaAI.

Los 77 preparadores candidatos C01+C02 siguen sin publicar; se conservan67 lecturas/27 fragmentos y las fichas aprobadas. La evidencia distingue pruebas de contratos, SQL aislado y proveedor simulado de autenticación/inferencia real. Rechazar campos secretos no acredita detección semántica de secretos pegados en texto libre. No hay cambios de UI, endpoints, tablas o migraciones; esta ficha permanece draft/unregistered y no habilita herramientas.


## AI36-C04 — seis ayudantes comunes candidatos

[Entrega82](../../../../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c04--seis-ayudantes-comunes) y [evidencia C04](../../../../evidence/nodia-ai-ai36-c04-validation.json) documentan los contratos/adaptadores explícitos de propuestas, operaciones, conjuntos, adjuntos y preferencias. Las lecturas de propuestas/operaciones/adjuntos quedan ligadas al chat del contexto backend; las preferencias pertenecen al actor, incluso para super_admin. El metadato de adjunto no entrega contenido, nombre de archivo, interpretación, URL o clave de almacenamiento. Las preparaciones sólo generan borrador/propuesta: el botón y canal humanos conservan confirmación, ejecución, reanudación/cancelación y aceptación de memoria. Sin cambios visuales ni impacto de layout/responsive/bundle cliente. Esta ficha permanece draft/unregistered; su actualización no publica herramientas.

## Coordinación publicada en AI36-C05

`nodia_proposals_get` consulta la revisión pública de una propuesta de esta conversación. `nodia_operations_get` consulta el estado de una ejecución de esta conversación y sus resultados públicos. Ambos reciben únicamente el identificador público del recurso: el backend fija actor y chat y revalida su acceso. El hash público de una propuesta no es una confirmación ni un secreto.

`nodia_workflows_prepare` combina borradores propios completos, con las revisiones y enlaces tipados admitidos, en una propuesta secuencial de hasta ocho pasos. No inventes identificadores ni enlaces: usa los borradores y salidas compatibles realmente disponibles. Una operación ya confirmada conserva cada efecto comprometido; fallar un paso no deshace los anteriores. Preparar el conjunto no confirma ni ejecuta. El botón humano sobre el conjunto exacto es obligatorio; reanudar, cancelar y confirmar siguen siendo acciones humanas, sin herramienta MCP. Cada paso vuelve a exigir sus módulos y reglas nativas. Este lote sólo publica la preparación financiera individual y la preparación de preferencias; otros preparadores no se habilitan por componer un conjunto.

Este contrato sólo se ofrece cuando esté publicado, seleccionado en el intento y autorizado. La publicación no acredita disponibilidad ni inferencia real del proveedor.
