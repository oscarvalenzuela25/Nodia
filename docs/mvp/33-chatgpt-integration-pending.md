# Plan de implementación: OpenAI Codex Agentic en Nodia

> Estado: código implementado; validación operativa aplazada por el usuario el 2026-10-08. Documento sin aprobación automática.
> Fecha: 2026-10-07.
> Solicitud actual: integrar la cuenta Codex como `openai` + `token_plan_agentic`, conservar API key y trasladar la documentación final a `docs/features/` al terminar.
> Arquitectura propuesta, sin aprobación automática. Este documento no habilita nuevos modos en el catálogo.

## Objetivo y punto de partida

Permitir utilizar la suscripción de la cuenta ChatGPT/Codex mediante el canal `token_plan_agentic` del proveedor existente `openai`. Conservar sus API keys y los contratos de análisis, verificación, salud y modelos que consume el frontend.

La solicitud actual sustituye la prioridad anterior de comenzar por inferencia directa: esta entrega propone Codex Agentic. `token_plan_web` de OpenAI queda fuera de alcance y deshabilitado. La investigación de Responses con autorización del plan se conserva más abajo como antecedente, sin crear otra cuota ni otro canal en esta entrega.

La integración Codex está implementada en código y tiene una migración preparada, no aplicada. La cuenta del usuario y la inferencia real siguen sin comprobarse. Esta entrega no modifica los flags actualmente guardados en BD. Conservar el [contrato de funcionalidades IA](ai-provider-feature-contract.md), incluida la configuración independiente por instancia/modo, claves cifradas, modelos dinámicos, selección explícita y ausencia de cambios automáticos de proveedor o modo.

La redacción inicial del 2026-10-07 no inició implementación. El 2026-10-08 se añadieron el runtime versionado, casos de uso, UI, pruebas y migración; sin login real, cuota consumida, cambios de BD o flags aplicados. Tampoco sustituye el diagnóstico pendiente de Gemini Web: el PDF sintético probado el 2026-10-07 terminó en timeout aunque la sesión y el catálogo estuvieran disponibles.

## Hallazgos documentales al 2026-10-07

Revalidar las fuentes oficiales al retomar: la disponibilidad, condiciones de acceso y contratos de una preview pueden cambiar.

| Tema | Hallazgo | Verificación pendiente en Nodia |
|---|---|---|
| Uso del plan | Sign in with ChatGPT documenta autorización OAuth para solicitudes elegibles con el plan. Login de identidad y permiso de consumo son distintos. | Elegibilidad de la app, cuenta, despliegue y consentimiento efectivo. |
| Cuota | La guía de usuario identifica el uso incluido de **Codex / ChatGPT Work**. Conectar una app no añade una asignación; un límite por app es un tope sobre el plan. | Datos reales entregados para la cuenta y atribución de uso. |
| Inferencia directa | Responses admite el token OAuth autorizado del plan; la guía consultada exige `store:false`, `stream:true` y catálogo activo de la cuenta. | Solicitud completa, modelo exacto y salida de factura válida. |
| Ejecución agéntica | Codex app-server puede usar ese token con un proveedor Responses. El flujo documentado no necesita un segundo login de Codex. | Runtime compatible, sesión, documentos, opciones y cancelación. |
| Despliegue | La guía consultada se dirige a apps de código abierto y alojadas localmente; para otras modalidades señala procesos de acceso y una guía de VMs autohospedadas. | Encaje concreto del despliegue de Nodia; no dar acceso por supuesto. |
| Documentos | Texto, imágenes y archivos dependen del modelo elegido. La ruta consultada no admite Files upload API. | Transporte de PNG/PDF y validación del resultado bajo las limitaciones vigentes. |

La inferencia directa y la ejecución agéntica propuestas consumirían esa familia de cuota. No crear dos bolsas independientes “Web/Agentic” ni sumar ventanas de uso. Llamar “Web” al transporte directo no lo convierte en acceso al cupo de conversaciones de chatgpt.com. Codex tampoco equivale al cupo de la función Agente de ChatGPT. API key conserva su facturación y credenciales separadas.

Una sesión autenticada, un modelo listado o un flag habilitado no prueban inferencia exitosa. Cuota desconocida se representa como desconocida; conservar los ceros reales. Las capacidades y opciones requieren evidencia del proveedor, sin deducirlas por nombres de modelos.

## Comprobaciones nuevas — 2026-10-07

El protocolo oficial ofrece `model/list` con modelos, esfuerzos de razonamiento y modalidades de entrada. Los valores dependen del cliente/cuenta. No hace falta quemar modelos; un catálogo listado tampoco demuestra acceso efectivo. [Fuente: app-server](https://learn.chatgpt.com/docs/app-server).

La autenticación gestionada de app-server se documenta para aplicaciones locales o de código abierto; OpenAI excluye su uso en servicios comerciales o alojados y remite a Sign in with ChatGPT. CG-01 debe resolver el despliegue concreto antes de presentar el login local como solución de VPS. [Fuente: autenticación app-server](https://learn.chatgpt.com/docs/app-server).

El flujo documentado de entrada incluye texto e imágenes, sin contrato de adjunto PDF directo. Proponemos rasterizar PDF de forma acotada para el OCR. En proveedores personalizados el catálogo puede proceder del cliente: verificarlo contra el acceso de la cuenta. [Protocolo](https://learn.chatgpt.com/docs/app-server), [integración SIWC](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).

La configuración documenta reintentos de solicitudes y streams. Habrá que comprobar y controlar los de la versión y autenticación elegidas; desactivar solo los reintentos de NestJS no garantiza que el runtime no repita una inferencia. [Referencia de configuración](https://learn.chatgpt.com/docs/config-file/config-reference).

## Arquitectura propuesta y puntos del código afectados

```text
Nodia Client → Nodia Server → adaptador por proveedor/modo
                             ├─ openai/api_key: adaptador API existente
                             ├─ openai/token_plan_agentic: supervisor Codex → app-server por stdio
                             └─ gemini: adaptadores actuales
```

Usar un módulo interno NestJS y un proceso hijo supervisado. No se propone un nuevo microservicio HTTP. Un proceso aparte no constituye aislamiento: para extracción, restringir entorno, archivos y herramientas y verificar esas restricciones antes de habilitarlo. Si necesitan separación efectiva mediante worker/contenedor, reflejarlo en el ADR; si aparece un microservicio, aplicar ADR-008.

| Punto actual | Cambio necesario |
|---|---|
| `nodia-server/src/ai-provider/constants/supported-providers.constant.ts` | Declarar canales de OpenAI API/Agentic. Reconciliar la representación histórica: `AiConnectionMode` solo contiene `api_key`/`web_session`, mientras los canales persistidos usan `token_plan_*`. No reutilizar tipos específicos de Gemini para identificar Codex. |
| `ai_provider_catalog` y migraciones | Habilitar `can_use_token_plan_agentic` del registro `openai`, conservar API habilitada y Web deshabilitado. |
| `ai-provider/use-case/get-ai-providers-health.use-case.ts` | Resolver estado por instancia/proveedor/modo; compartir observaciones únicamente dentro del perfil correcto. |
| `ai-provider/use-case/sync-ai-provider-models.use-case.ts` | Descubrimiento Codex y persistencia solo en el scope Agentic de esa instancia. |
| `invoice/use-case/verify-ia-providers.use-case.ts` | Incorporar disponibilidad Codex sin inferencia y sin reglas de sesión exclusivas de Gemini. |
| `invoice/use-case/analyze-invoice.use-case.ts` | Sustituir el rechazo de OpenAI fuera de API y evitar que una sesión OpenAI entre accidentalmente al adaptador Gemini. |
| Client: `ProviderConnectionForm`, `ProviderDetail`, servicios IA y selector de facturas | Catálogo con Agentic, conexión explícita Codex y modelos/esfuerzos por canal. El detalle actual usa estado de engines únicamente para Gemini. |

No se necesitan nuevas columnas en `ai_provider` para los switches existentes. Mantener `use_api_key`, `use_token_plan_agentic`, `default_mode`, `fields_version` y la configuración independiente por canal. Identificador de perfil resuelto en backend; secretos fuera de `fields` y de `ai_api_keys`.

## Checklist de implementación

**Primer pendiente operativo: CG-01/CG-04 con la cuenta del usuario.** El código está implementado; el usuario pidió el 2026-10-08 dejar BD y validación real para después. Se conserva la secuencia de aceptación, incluida CG-06..08 antes de aplicar CG-09. Preparar una migración no equivale a aplicarla.

- [ ] **CG-01 — Confirmar acceso y fijar el alcance operativo.** Revalidar documentación, versión del runtime, cuenta y despliegue local/VPS. Para local, comprobar login gestionado separado; para servicio alojado/comercial, resolver registro/acceso SIWC y consentimiento antes de prometer funcionamiento. Registrar impedimentos externos y decidir el camino admitido. **Aceptación:** autenticación elegida compatible con el entorno, sin usar la cuenta ni credenciales de esta conversación.
- [x] **CG-02 — ADR y contratos.** ADR-018 creado con la plantilla, sin aprobación automática. Contratos HTTP compilados comprobados con guards reales y dependencias sintéticas. NestJS + supervisor Codex, comparando ejecución separada y preservando el alcance Agentic solicitado. Diseñar interfaz de sesiones por `(providerKey, mode)`, tipos/DTOs, estados y errores seguros. Separar configurado, autenticado, modelo configurado y última inferencia observada. **Aceptación:** contrato explícito, sin dependencia de tipos Gemini para OpenAI ni aprobación documental automática.
- [ ] **CG-03 — Runtime y aislamiento.** Dependencia/versionado reproducibles, protocolo tipado y proceso persistente acotado por perfil. Un perfil backend por conexión, fuera del repositorio; no heredar secretos de NestJS ni configuración/herramientas del usuario. Definir almacenamiento protegido del runtime: keyring o volumen/permisos/cifrado verificados; un archivo `auth.json` no equivale a cifrado. Restringir lectura a temporales necesarios y bloquear comandos/escrituras/red de herramientas cuando no sean necesarios para OCR. Límites de procesos, concurrencia, cola y memoria; ownership de perfil exclusivo, sin habilitar réplicas compartiendo perfil sin coordinación. **Aceptación:** pruebas de aislamiento, protocolo fragmentado/inválido, salida excesiva, caída, apagado y limpieza sin afectar procesos ajenos.
- [ ] **CG-04 — Sesión de cuenta Codex.** Casos de uso de iniciar login, consultar estado, cancelar y desconectar; flujo de navegador/device code según autenticación aprobada en CG-01. Renovación gestionada o OAuth propio según ese camino, con refresh coordinado. Login y jobs ligados a la conexión y autorizados con las reglas reales de Nodia. Rechazar autenticación API en el canal Agentic; no copiar perfiles globales. **Aceptación:** cuenta conectada, expiración/revocación y desconexión comprobadas, sin tokens/cookies en respuesta, BD de campos, logs o argumentos.
- [ ] **CG-05 — Modelos y razonamiento dinámicos.** Descubrimiento paginado, normalización y actualización de `fields.token_plan_agentic.available_models`; modelos/preferencias API intactos. Conservar ID exacto, modalidades observadas y esfuerzos admitidos, permitiendo Low/Medium/High cuando los entregue el proveedor y opciones nuevas sin listas cerradas. Selección explícita, sin asignar el primer modelo. No deducir visión por nombre ni inventarla si falta metadata. Configuración histórica incompatible visible y corregible, sin cambiarla en silencio. **Aceptación:** nuevos modelos aparecen al sincronizar; catálogo vacío/fallido no introduce fallbacks, y un modelo listado no se certifica como inferencia exitosa.
- [ ] **CG-06 — Extracción aislada con cuenta real.** Probar PNG y PDF sintéticos con modelo descubierto y nivel explícito. Rasterizar PDF con límites de páginas/resolución/bytes, validar MIME y proteger/limpiar temporales. Nuevo contexto por análisis, entrada como datos y salida estructurada validada contra el contrato de factura; no compartir historia de documentos entre solicitudes. Esperar finalización terminal, no aceptar el inicio de un turno como resultado. **Aceptación:** JSON válido y campos coherentes, tiempos/correlación registrados, sin herramientas innecesarias ni reenvío de resultado incierto.
- [ ] **CG-07 — Salud, cuota, verificación y sincronización.** Conectar los casos de uso actuales al resolver por proveedor/modo. Consultas no generativas, deduplicadas por perfil y con caché acotada; sin proceso/inferencia por cada fila de health. Conservar cuotas/buckets observados sin sumar ventanas ni inventar porcentajes; desconocido como `null`, cero real como cero. `can_use_model` requiere configuración y disponibilidad verificables, sin confundirlo con garantía de ejecución. **Aceptación:** sesión ausente, runtime caído y cuota desconocida se distinguen y Gemini/API mantienen sus contratos.
- [ ] **CG-08 — Analyze y resiliencia.** Enrutar `openai` + `token_plan_agentic` a Codex y reutilizar la validación/normalización de factura existente. Mantener multipart, IDs y formato público; validar modelo/esfuerzo final antes de ejecutar. Presupuesto total configurado incluyendo espera, PDF y generación, coordinado con HTTP/frontend a partir de CG-06. Timeout/cancelación interrumpe ejecución y libera recursos; cierre forzado acotado si no responde. Verificar reintentos internos del runtime para impedir replay de inferencias inciertas; no reanudar automáticamente documentos tras perder respuesta. Errores seguros correlacionados para sesión/cuota/modelo/runtime/JSON/timeout. **Aceptación:** una petición produce una sola ejecución observable, sin fallback a API/Gemini ni procesos huérfanos.
- [ ] **CG-09 — Catálogo, constante y migración.** Tras CG-06..08, migración incremental idempotente sobre `key='openai'`: API `true`, Agentic `true`, Web `false`. Preservar ID, claves, conexiones, modelos y campos históricos. Actualizar metadatos soportados, validadores y respuestas públicas, evitando registros duplicados o limpiar tablas. No activar Agentic ni cambiar predeterminados de instancias existentes automáticamente. Revisar `nodia.json`; conservar sus campos existentes y actualizar solo metadatos de capacidades que efectivamente represente. **Aceptación:** migración/reversión en PostgreSQL aislado y alta/edición de instancias; flags configurables separados de disponibilidad real.
- [ ] **CG-10 — Frontend.** El formulario habilita Agentic para OpenAI desde el catálogo. Incorporar panel de sesión Codex en el detalle: conectar, abrir login/código, consultar avance y desconectar. Servicios de sesión independientes de endpoints Gemini, con DTOs tipados; modelos arriba de API Keys y preferencias por canal. Estados de carga/vacío/error y toasts ES/EN; modal conserva datos ante fallo. Selector de facturas usa la misma instancia/modo/modelo elegidos y descarta respuestas tardías de otra selección. **Aceptación:** flujo completo desde UI, sin tokens visibles, sin romper API Keys/switches/predeterminado ni mezclar sesiones.
- [ ] **CG-11 — Regresiones y operación.** Unitarias únicamente de casos de uso en Server; componentes en Client; integración HTTP compilada y PostgreSQL aislado. Cubrir ausencia/cero, sesión expirada/revocada, cuota agotada, catálogo vacío, esfuerzo incompatible, JSON inválido, PDF inválido/excesivo, timeout/cancelación, refresh/login concurrentes, aislamiento y configuración histórica. Ejecutar tipado/lint/build y suites afectadas. Comprobar PNG/PDF desde UI y reinicio del runtime con la cuenta; distinguir evidencia simulada, local real y despliegue. **Aceptación:** matriz IA conserva Gemini y OpenAI API; despliegue solo se declara comprobado en el entorno realmente probado.
- [ ] **CG-12 — Documentación final y retiro del plan.** Crear `docs/features/ai-providers/openai-codex-agentic.md` con comportamiento entregado, login, modelos/razonamiento, cuotas y limitaciones; incluir runbook de instalación, credenciales, límites, diagnóstico y reversión. Reconciliar contrato IA, reglas OpenAI API-only de AGENTS, índices, progreso, ADR y especificación OCR. Registrar investigación de inferencia directa como pendiente futuro si sigue sin implementarse. **Aceptación:** al cerrar los pasos del alcance acordado, trasladar evidencia/pendientes operativos a documentación durable, corregir referencias y eliminar este plan sin enlaces rotos. No borrarlo para ocultar un bloqueo ni documentar una funcionalidad no comprobada como disponible.

## Contrato de sesión propuesto

Estas rutas son propuesta nueva; el contrato final se fija en CG-02 bajo el prefijo API existente y los permisos de gestión global IA vigentes:

| Método y ruta relativa | Resultado público |
|---|---|
| `GET /ai-providers/:id/session?mode=token_plan_agentic` | Estado de runtime/sesión y observación segura; no genera contenido. |
| `POST /ai-providers/:id/session/login` | Inicia login para ese canal; devuelve job ID y URL/código si el flujo los entrega. |
| `GET /ai-providers/:id/session/login/:jobId` | Avance/finalización del login; sin OAuth tokens ni vencimientos inventados. |
| `POST /ai-providers/:id/session/login/:jobId/cancel` | Cancela el intento ligado a esa conexión. |
| `POST /ai-providers/:id/session/logout` | Desconecta únicamente su perfil Codex. |

El frontend conserva los endpoints actuales de health/sync/verify/analyze y el formato de extracción. El análisis sigue recibiendo el archivo y los identificadores existentes; selecciona `ai_provider='openai'`, `mode='token_plan_agentic'` y un modelo configurado para esa instancia/canal. Una combinación contradictoria de proveedor, instancia y modo se rechaza antes de ejecutar.

## Dependencias de continuidad

- [Índice del MVP](README.md) y [progreso](00-progress.md).
- [Contrato funcional IA](ai-provider-feature-contract.md), incluidos los hallazgos previos de esta investigación.
- [Especificación de gestión de proveedores](16-ai-provider-management-handoff.md) y [revisión previa al lanzamiento](19-prelaunch-review.md).
- [Arquitectura](11-architecture-overview.md), [autenticación de Nodia](14-authentication.md) y [runbook agéntico Gemini](agentic-cli-runbook.md) para conservar responsabilidades y evitar mezclar sesiones/proveedores.
- Reglas raíz y de `nodia-server`/`nodia-client`, y sus skills locales antes de modificar código.

## Fuentes oficiales consultadas

- [Sign in with ChatGPT: uso del plan y cuota Codex / ChatGPT Work](https://learn.chatgpt.com/docs/sign-in-with-chatgpt).
- [ChatGPT plan usage: alcance y elegibilidad](https://developers.openai.com/siwc/token-sharing-open-source).
- [Registro y login OAuth](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
- [Modelos e inferencia directa](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
- [Codex app-server con autorización del plan](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).
- [Limitaciones de la preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
- [Autenticación de Codex](https://learn.chatgpt.com/docs/auth), [SDK](https://learn.chatgpt.com/docs/codex-sdk) y [protocolo app-server desde Node.js](https://learn.chatgpt.com/docs/app-server).

## Evidencia actual

Implementación de código autorizada el 2026-10-08 para local y QA remoto posterior. El usuario aclara que PostgreSQL no está levantado y solicita aplazar comprobación real. **Sin prueba OAuth ni inferencia ChatGPT real, migración aplicada o despliegue**.

## Entrega de código — 2026-10-08

- [x] Supervisor stdio/versionado, perfiles privados/keyring, límites, sesión por conexión y jobs por actor; sin copiar credenciales de esta conversación.
- [x] Modelos/esfuerzos dinámicos, health/sync/selectable/verify y análisis de factura con validación/cancelación; API/Gemini independientes y sin fallback.
- [x] Panel Client y servicios tipados, ES/EN, modalidades del selector y alertas por ID de conexión; errores mantienen modal.
- [x] Migración objetivo/reversión preparadas, ADR-018 y documentación durable/runbook local + TryCloudflare.

Los checks CG restantes conservan su aceptación original y no se marcan completos por evidencia sintética. BD, cuenta/keyring real, inferencia y QA quedaron explícitamente aplazados. El plan **no se elimina** hasta registrar esas comprobaciones; no se oculta el trabajo operativo pendiente.

Fuentes durables: [ADR-018](../architecture/decisions/ADR-018-openai-codex-agentic.md) y [funcionalidad/runbook](../features/ai-providers/openai-codex-agentic.md). `nodia.json` no está presente en este checkout; se actualizó únicamente el comentario objetivo del script que lo reconcilia, sin crear/sobrescribir un diagrama externo.

La integración aislada usa HTTP NestJS compilado y guards reales con persistencia/tokens simulados, peer JSONL sintético y worker PDF real; runtime nativo probado sin autenticación en macOS. Configuración/keyring/reintentos en cero comprobados, sesión ausente observada. Esto no certifica login ni inferencia. Las unidades y componentes cubren ausencias/ceros, esfuerzo incompatible, JSON inválido, rechazo de herramientas, cancelación/deadline, terminal temprano, aislamiento de actor/conexión y preservación de configuración API.

Server: build y lint correctos (dos avisos previos), **755 pruebas/104 archivos** correctos e integración HTTP/JSONL/PDF/runtime sin autenticación correcta. Client: build/tipado/lint correctos; suite completa **930 correctas/2 fallos previos, 156 archivos**. Verificación focalizada final de IA: **124 pruebas/12 archivos** correctos, incluida la regresión posterior de salud observada en el modal. Dos fallos monetarios de Client (`OverviewTab`, separador `$50.000` esperado frente a `$50,000`) se reprodujeron en HEAD mediante un checkout temporal de solo archivos; son ajenos a Codex. Auditoría productiva: mismos tres hallazgos que HEAD (dos high y uno critical), sin advisories nuevos en las dependencias añadidas.
