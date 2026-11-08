# OpenAI Codex Agentic

> Cambio solicitado el 2026-10-27: retirar Web y conservar sólo Agentic (`agentic`) y API key (`api_key`), conforme [plan90](../../mvp/90-agentic-api-only-web-retirement.md) y [pruebas91](../../mvp/91-ai-provider-onboarding-verification.md). Los apartados inferiores conservan contratos/evidencias anteriores por fecha y no habilitan Web. Implementación y aceptación en curso; ningún cambio automático de proveedor, modelo o modo por error.

> Estado al2026-10-12: login y OCR PNG mediante cuenta real comprobados en VM Ubuntu, conexión de laboratorio ID1. La conexión Windows ID4 conserva su configuración independiente; runtime Windows pendiente.
> Factura sintética analizada como borrador, sin guardar factura/productos. El documento no constituye una aprobación ni aceptación del VPS real.

## Comportamiento implementado

### Actualización del catálogo solicitada — 2026-10-28

La referencia aportada por el usuario incluye GPT-6.1 Sol, GPT-6 Astra, GPT-6.1 Terra, GPT-6 Sol y GPT-6 Luna. Es una selección solicitada, no una lista cerrada en código ni una prueba de capacidades. Los IDs, etiquetas, modalidades y esfuerzos deben proceder del `model/list` de la conexión; sincronizar Ajustes debe persistir el catálogo para que NodiaAI lo reciba. Conservar selección y foco OCR si siguen vigentes, otros modos y conversaciones históricas; no cambiar de modelo automáticamente.

Durante la comprobación, el descubrimiento de la conexión1 devolvió HTTP500 con `ESRCH` al leer procfs. La corrección focal considera desaparecido ese PID y continúa el barrido de todos los miembros; un líder ausente no demuestra cierre del grupo, y errores de permiso, identidad inválida o descendientes vivos siguen bloqueándolo. La sesión y el catálogo continúan separados de la inferencia, MCP y las modalidades calificadas. [Evidencia consolidada de esta ronda](../../evidence/codex-model-catalog-refresh-r01.json).

Resultado comprobado en la VM: el runtime entregó ocho modelos y se guardaron exclusivamente los cinco solicitados en `fields.agentic.available_models`, incluido `gpt-6.1-terra`. Una nueva pestaña de Nodia AI mostró las cinco opciones. Se conservaron `gpt-6.1-sol` como principal y foco OCR, esfuerzo `medium` y el hash de la configuración API key. El borrador del chat se canceló sin aplicar cambios ni enviar mensajes. Build Linux, pruebas focales y backup cifrado posterior verificado completados; cero inferencias y cero llamadas con API key. La aceptación histórica de herramientas no se extiende al nuevo fingerprint del runtime ni a Terra.

OpenAI admite el canal `token_plan_agentic` mediante un runtime Codex supervisado por Nodia Server. API key conserva claves cifradas, modelos y facturación independientes. OpenAI Web permanece deshabilitado. El formulario utiliza los flags del catálogo: Agentic está habilitable en la BD local después de aplicar la migración, y debe activarse explícitamente por conexión. La conexión ID 4 ya lo tiene activado, conservando API como predeterminado.

La sesión Codex pertenece a la conexión de Nodia y es compartida por quienes tengan permiso para gestionarla/usarla. Cada intento de login pertenece además al actor autenticado; otro actor no recibe su código ni el estado privado del job. Conectar no cambia modelos, canal predeterminado, API keys ni sesiones Gemini.

El panel Codex del detalle se muestra exclusivamente en la pestaña `token_plan_agentic` de OpenAI, por solicitud del2026-10-13. API key no muestra la cuenta, sus acciones ni sus cuotas. Permite consultar sesión, iniciar autorización por código de dispositivo, recuperar el intento pendiente, cancelar y desconectar. Si una alerta de Codex se activa desde API, primero abre Agéntico y después su modal, esperando que terminen las consultas de esa pestaña. Cambiar de pestaña no desconecta la cuenta. Solo abre `https://auth.openai.com/codex/device`. El backend conserva los tokens en el keyring del SO; el navegador recibe un código temporal, estados y observaciones seguras. Los jobs terminales borran URL/código de su respuesta pública. Los errores conservan el modal y permiten reintentar; feedback y estados tienen ES/EN.

## Modelo y razonamiento

`model/list` se consulta por páginas, con máximo veinte páginas/mil modelos y caché de 30 s por perfil. Se conserva el ID ejecutable exacto, modalidades y esfuerzos entregados por el runtime. Una preferencia nueva aparece sin modificar una lista de nombres en código. Sin modalidad de imagen observada, el análisis se rechaza; no se deduce visión del nombre.

La sincronización modifica únicamente `fields.token_plan_agentic.available_models`. No elige el primer modelo ni toma uno del scope API. El usuario debe asignar un modelo y, si lo desea, un esfuerzo de los observados. Preferencias históricas incompatibles permanecen visibles y se pueden cambiar/quitar; un valor nulo explícito por modelo elimina su preferencia sin heredar el esfuerzo general. El backend valida de nuevo el modelo/esfuerzo efectivo antes de generar.

La autenticación, el catálogo y un modelo configurado no prueban inferencia. En un proveedor personalizado, el catálogo puede proceder del runtime; el acceso efectivo requiere el ensayo posterior con la cuenta. Salud separa sesión, configuración y última extracción completada en ese proceso. Después de reiniciar/descargar el perfil, esa evidencia en memoria se pierde y vuelve a desconocido.

## Análisis de factura

Se conserva `POST /api/v1/invoices/analyze` multipart, IDs de negocio/proveedor/conexión, selección explícita y formato público `{ business_id, provider_id, code, total_amount, data }`. Usar `ai_provider='openai'`, `mode='token_plan_agentic'` y la conexión seleccionada. Una combinación contradictoria se rechaza, sin derivarla a Gemini/API.

Cada solicitud utiliza un thread efímero nuevo. El documento se transmite como datos, con esquema JSON de factura. Se espera `turn/completed` con estado completado; aceptar `turn/start` no produce un éxito. La respuesta se valida y conserva valores desconocidos y ceros reales. El contexto se libera después del éxito; ante fallo/cancelación se interrumpe y termina el proceso propio. No se reenvía automáticamente una extracción incierta.

Límites actuales:

| Recurso | Límite del código |
|---|---|
| Archivo | 10 MiB; firma/MIME de PDF, PNG, JPEG o WebP |
| Imagen | 4096 px por lado y 16 megapíxeles; cabecera dimensional válida |
| PDF | 1..8 páginas, máximo 1600 px por lado rasterizado, 24 MiB de PNG totales, worker de 60 s |
| Worker PDF | Heap JS 256 MiB; canvas tiene memoria nativa adicional |
| Análisis | 300 s por defecto, configurable 1000..300000 ms; Client 360 s |
| Admisión | Dos análisis simultáneos; sin cola; una operación exclusiva por conexión |
| Runtime | Cuatro perfiles; RSS supervisado 512 MiB/5 s, sin cuota dura del SO |
| Protocolo | 2 MiB por frame; máximo 32 RPC pendientes; salida de un análisis 16 MiB/10000 eventos y mensaje final 1 MiB |
| Login | Cinco minutos; jobs retenidos diez minutos, máximo cien |

Los logs de extracción contienen ID de operación, conexión, duración, resultado y causa segura. No contienen documentos, stderr ni credenciales. Los errores de Codex exponen categoría estable y, para el análisis, ID de correlación. Se distingue cuota agotada, sesión, modelo, protocolo, timeout, cancelación y runtime. No se infiere agotamiento/reinicio por porcentajes: `ordinaryUsageAllowed:false` es una observación explícita del proveedor.

Las cuotas mantienen sus buckets y ventanas separados, sin sumarlos ni atribuirlos a otro canal. Cero es cero; dato ausente es `null`. Una cuota desconocida no significa ilimitada.

## Preparación local y validación posterior

1. Usar Node.js 24.20.0 o superior. Ejecutar `npm ci` en Server y Client. Las dependencias Codex `0.161.0`, PDF.js, canvas e image-size están fijadas; no hace falta instalar un Codex global.
2. Configurar PostgreSQL y las variables normales de Nodia cuando corresponda. Esta entrega no cambió `.env` ni aplica migraciones al arrancar.
3. En `nodia-server/.env`, establecer `NODIA_CODEX_ENABLED=true`. El perfil por defecto es `~/.local/share/nodia/codex/<connection-id>`; `NODIA_CODEX_PROFILE_ROOT` permite un path absoluto canónico fuera del repositorio. Root/perfil deben pertenecer al usuario de Server, tener permisos 0700 y no atravesar symlinks. No usar el `CODEX_HOME` personal ni copiar `auth.json`.
4. El runtime exige `cli_auth_credentials_store=keyring`. macOS utiliza el keyring del SO; Linux debe disponer de un keyring utilizable por el proceso y se comprobará antes de inferir. No hay fallback a archivos planos. Windows queda deshabilitado hasta verificar ACL/supervisión.
5. Para cada entorno, revisar/aplicar únicamente la migración objetivo con `npm run migration:codex-catalog` desde Server. Preserva el registro existente `key='openai'` y guarda sus flags previos en `nodia_codex_catalog_rollback`. API `true`, Web `false`, Agentic `true`; la migración no activa instancias ni cambia su predeterminado. Aplicada en BD local el 2026-10-08; up/repetición/down/repetición comprobados en un esquema PostgreSQL aislado y descartado mediante rollback. No se ejecutó down sobre el catálogo objetivo.
6. Ejecutar Server con `npm run start` para QA de análisis, evitando un supervisor watch que lo reemplace durante una generación. Iniciar Client con `npm run dev`. Abrir el detalle de una conexión OpenAI y **Gestionar cuenta Codex**; completar el código en el sitio oficial y esperar la comprobación de sesión.
7. Activar Agentic en esa conexión, sincronizar sus modelos, asignar ID/esfuerzo observados y elegirla explícitamente en facturas. Probar un PNG y PDF sintéticos con resultado conocido antes de usar documentos reales. Registrar el JSON validado, tiempo y acceso efectivo del modelo; no marcar disponible solo por el login.

`NODIA_CODEX_INVOICE_TIMEOUT_MS` configura el presupuesto total, con máximo 300000. No ampliarlo sin revisar transporte Client, recursos y evidencia de una ejecución completa.

## QA posterior con TryCloudflare

No se necesita un VPS para implementar o probar localmente. Mantener el runtime y sus perfiles en el equipo de Server; el túnel expone únicamente Nodia:

```text
Navegador QA → HTTPS Quick Tunnel → Vite :5174 → /api/v1 → Nodia Server :3000 → Codex por stdio
```

Configurar Client con `VITE_API_URL=/api/v1` y `NODIA_API_PROXY_TARGET=http://localhost:3000`. Vite ya admite `.trycloudflare.com` y conserva `Origin`. Ejecutar `cloudflared tunnel --url http://localhost:5174` y usar el host real emitido.

Añadir ese origen exacto a `AUTH_ALLOWED_ORIGINS` en Server y a los orígenes JavaScript autorizados del cliente Google OAuth. Para HTTPS, `AUTH_COOKIE_SECURE=true` y `AUTH_COOKIE_SAME_SITE=lax`. Los usuarios de QA deben existir, estar activos y tener permisos de Nodia; Google no los crea automáticamente. Ver [procedimiento de autenticación QA](../../mvp/14-authentication.md#qa-remoto-temporal-con-cloudflare-quick-tunnel--2026-10-03).

Codex usa código de dispositivo y polling; no requiere callback a localhost ni SSE. No publicar el runtime, perfiles ni el microservicio Gemini. Quick Tunnels son temporales y no acreditan operación VPS/comercial. Este recorrido todavía no se ejecutó con la cuenta/BD de Nodia; el QA de análisis prolongados debe comprobar los límites del túnel/proxy realmente observados.

## Diagnóstico, reinicio y reversión

- Incidencia reportada el 2026-10-08: `POST /ai-providers/4/session/login` devolvió 503 / `codex_runtime_unavailable`. La inspección confirma que `CodexRuntimeService.create` rechaza Windows y exige `NODIA_CODEX_ENABLED=true`; habilitar únicamente el catálogo o la conexión no hace operativo el runtime. Se conserva esa restricción, sin cambiar `.env`, perfiles o cuentas. El panel ahora distingue disponibilidad, bloquea Conectar con runtime indisponible o consulta de sesión fallida y ofrece reconsulta; un POST fallido deja mensaje/diálogo intactos, sin repetir el login automáticamente. El soporte nativo Windows continúa pendiente.
- Runtime desconocido tras reinicio: abrir Gestionar cuenta para consultar el perfil; health no crea un proceso por cada fila.
- Keyring ausente/inaccesible o `auth.json` presente: operación indisponible; configurar almacenamiento protegido. No cambiar a credenciales planas ni importar otra sesión.
- Perfil ocupado: hay login/análisis/logout en curso o un lock residual. `nodia.lock` registra PID de Server y runtime. Después de una caída, comprobar **ambos** procesos y su identidad antes de retirar ese lock; no hay recuperación automática de locks ni replay de facturas.
- Cuota desconocida: mantenerla desconocida. Cuota explícitamente denegada o error terminal de límites: esperar/corregir lo indicado por el proveedor y reintentar manualmente.
- Error al finalizar: usar ID de correlación en los logs seguros. Un fallo del catálogo no cambia el modelo guardado.
- Apagado normal: shutdown de NestJS cierra procesos propios, elimina temporales y libera locks. Las credenciales de keyring persisten hasta desconectar.
- Reversión operativa: desconectar la cuenta desde Nodia y desactivar Agentic en sus instancias; dejar API key si se desea. `NODIA_CODEX_ENABLED=false` bloquea el runtime. Restaurar los flags originales con `npm run migration:codex-catalog -- --rollback` solo si esta migración es la última aplicada; el script rechaza revertir otra. No borra conexiones, claves ni preferencias.

## Evidencia y pendientes

Pruebas unitarias de casos de uso y componentes utilizan fixtures claramente sintéticos. La integración `npm run test:codex:integration -- --runtime` utiliza rutas HTTP compiladas con guards reales y almacenamiento/tokens simulados, un peer JSONL sintético, el worker PDF real y perfiles temporales del runtime nativo sin autorización. Cubre 401/403, DTO, ownership BIGINT, código privado/no-store, concurrencia, frames fragmentados/UTF-8/inválidos/excesivos, herramientas rechazadas, timeout/caída/cierre y limpieza PDF. No usa BD ni credenciales reales.

La versión instalada inició en macOS con configuración/keyring/reintentos comprobados y devolvió cuenta ausente. Esto prueba el arranque y la configuración, no la persistencia de un login ni la ejecución del modelo. Los resultados finales de build/lint/suites se registran en [plan 33](../../mvp/33-chatgpt-integration-pending.md).

La auditoría de dependencias productivas devuelve los mismos tres hallazgos que HEAD (Nest platform-express, multer y proxy-addr; dos high y uno critical). No se hizo una actualización ajena de esas dependencias para ocultarlos.

Pendientes acordados: reversión sobre el catálogo objetivo si se solicita y migración de otros entornos; login/keyring real, renovación/revocación, desconexión y reinicio con cuenta; catálogo efectivo de la cuenta; extracción PNG/PDF desde UI; Linux/soporte Windows; QA por Quick Tunnel. Elegibilidad/registro SIWC para servicio alojado y Responses directo quedan como trabajo independiente. El plan se conserva hasta registrar esas aceptaciones.

## Revisión solicitada en Windows — 2026-10-08

**Resultado: implementación comprobada con pruebas sintéticas; feature no operativo en el entorno actual.** Esta revisión no aplica migraciones, modifica `.env`, conecta cuentas ni consume inferencias reales. No constituye aprobación documental.

### Estado confirmado del entorno

- Node.js `24.20.0`, Server ejecutado en Windows (`win32`). `CodexRuntimeService.create` rechaza esta plataforma incluso con `NODIA_CODEX_ENABLED=true`: comprobación compilada devuelve HTTP 503 / `codex_runtime_unavailable`. El rechazo está previsto en ADR-018; habilitar una variable no resuelve la ausencia de soporte Windows.
- La configuración actual no habilita `NODIA_CODEX_ENABLED`. La observación compilada devuelve `available:false`, `authenticated:null`, sin cuota ni inferencia observadas.
- Lecturas de PostgreSQL con `default_transaction_read_only=on` y timeout de cinco segundos: catálogo OpenAI ID `2`, API habilitada, Web/Agentic deshabilitados; migración `EnableCodexAgenticCatalog1791450000000` ausente. Conexión OpenAI ID `4`, activa, únicamente API, predeterminado `api_key`. No se leyeron claves ni se modificaron filas.
- Faltaban las dependencias nuevas en `node_modules`; el primer build falló por `image-size` y dos suites no pudieron cargar. Se ejecutó `npm ci --no-audit --no-fund` con el lockfile existente, sin cambios de manifiesto/lockfile. El build y las suites focalizadas pasan después de instalar.

### Hallazgo P1: cancelación sin propiedad del perfil

**Actualización 2026-10-10, revisión VPS:** el código actual protege la parada externa con `if (lease)` y contiene regresión de operación dueña/competidor cancelado. Las 20 pruebas de `execute-codex-invoice.use-case.spec.ts` pasan en esta revisión. El defecto descrito abajo conserva valor histórico y ya no se considera pendiente en código; esta comprobación sintética no cierra login/keyring/inferencia/reinicio reales en Linux ni CG-08/CG-11 completos.

En `nodia-server/src/ai-provider/use-case/execute-codex-invoice.use-case.ts`, el catch externo llama a `runtime.stop(id)` cuando la señal está abortada, aunque `runtime.acquire(id)` haya rechazado por perfil ocupado y esta solicitud nunca haya recibido un lease. Una segunda solicitud cancelada puede terminar la extracción o el login que posee ese perfil.

Reproducción aislada contra el caso de uso compilado: proveedor/modelo/PNG sintéticos, `runtime.get` devuelve un perfil con `busy:true`, `runtime.stop` registra llamadas y el caller entrega una señal previamente abortada. Resultado observado: HTTP 499 / `codex_cancelled` y llamada `stop('42')` sobre el perfil ajeno. No se inició Codex ni se usó una cuenta. Las suites existentes no cubren esta combinación y su éxito no cierra el defecto.

**Corrección pendiente:** detener el runtime únicamente si la solicitud obtuvo su lease, comprobar cancelación antes de adquirir y añadir una regresión en el caso de uso que preserve la primera operación ante una segunda solicitud cancelada/rechazada. Mantener también las pruebas de cancelación de la operación que sí posee el lease. CG-08/CG-11 continúan pendientes.

### Evidencia de esta revisión

- Server: build correcto; lint sin errores, con dos warnings previos. Suites focalizadas de proveedores/verificación/análisis: 260 pruebas / 26 archivos correctos; suite completa posterior con tres workers: 755 pruebas / 104 archivos correctos. El hallazgo P1 fue reproducido por separado y no está cubierto por esas suites.
- Client: build/tipado y lint correctos. Ajustes IA: 114 pruebas / 11 archivos; importación/selección IA y modal de factura: 55 pruebas / 3 archivos. Total focalizado Client: 169 pruebas correctas.
- `node test/codex.integration.mjs`: HTTP compilado con guards reales (401/403, DTO, ownership BIGINT, no-store, cancelación y errores seguros) y worker PDF real (rasterización, límites, rechazo y limpieza) correctos. **En Windows el script omite el peer JSONL**, aunque el mensaje final enumere JSONL; no atribuir cobertura de ese transporte ni del aislamiento de procesos a esta ejecución. No se ejecutó `--runtime` con autenticación.
- No se comprobó login, keyring, renovación/revocación, catálogo efectivo de cuenta, PNG/PDF mediante inferencia/UI, reinicio autenticado ni Quick Tunnel. Aplicar la migración por sí solo tampoco supera el bloqueo Windows ni el hallazgo de concurrencia.

## Activación explícita en BD local — 2026-10-08

Tras la revisión, el usuario solicitó poner Agentic en `true`. Se aplicó únicamente `EnableCodexAgenticCatalog1791450000000` mediante el script objetivo, con build correcto, y se activó `ai_providers.use_token_plan_agentic` en la conexión OpenAI ID `4` mediante transacción y bloqueo de filas. Verificación posterior al commit: catálogo ID `2`, API `true`, Web `false`, Agentic `true`; conexión ID `4`, API `true`, Web `false`, Agentic `true`, predeterminado `api_key`. La migración aparece en el historial.

Antes de escribir se probó up/up/down/down en un esquema temporal de PostgreSQL con datos sintéticos y rollback completo, preservando el otro proveedor. Respaldo de flags y huellas de integridad: `C:/Users/Oscar/AppData/Local/Nodia/backups/codex-enable-2026-10-08T20-06-03.962Z.json`, sin secretos. Se comprobó que los campos/modelos y demás configuración de la conexión, y todas las filas de API keys, conservaron sus huellas; solo cambiaron el flag solicitado y los timestamps correspondientes. Los flags originales del catálogo también están en `nodia_codex_catalog_rollback`.

La activación de la instancia es independiente de la migración: para revertirla, restaurar su flag desde el respaldo, además de usar el procedimiento de rollback del catálogo cuando corresponda. No se cambió `.env`, ejecutó login/inferencia ni corrigió el P1 de cancelación; Windows continúa rechazado. Esta solicitud reemplaza el aplazamiento de la migración local, sin aprobar documentos ni certificar operación real.

## Ensayo Ubuntu — 2026-10-12

Despliegue y límites en [laboratorio VM](../../mvp/vps-local-vm-lab.md). Autorización por código completada por el usuario en Chrome; cuenta ChatGPT comprobada por el runtime, sin `auth.json`. El proceso hijo hereda únicamente el bus D-Bus privado y XDG_RUNTIME_DIR en Linux, además de su allowlist existente; no hereda claves API. Con `ProtectHome=true`, systemd oculta `/run/user`: se enlaza exclusivamente su socket privado en `/run/nodia-runtime/bus`, manteniendo la protección y el keyring cifrado. Guardado/lectura/borrado sintéticos se comprobaron también dentro del namespace aislado de la API.

Codex0.161.0 rechazó `readOnly.access` en `turn/start` antes de iniciar la primera generación: «readOnly.access is no longer supported». Se retiró ese campo no admitido; el contrato estable conserva `readOnly` y `networkAccess:false`, herramientas deshabilitadas y rechazo de peticiones interactivas. No se afirma restricción de raíces de lectura mediante ese campo eliminado. Prueba nativa en perfil desechable sin autenticación valida la política exacta que usa producción; evita que el peer sintético o la documentación de otra versión oculten una incompatibilidad.

OCR posterior desde Client localhost→SSH→Nginx→Server Linux→Codex: HTTP201 en10,5 s, turno terminal completado y extracción validada. Modelo elegido por el usuario `gpt-6.1-sol`, sin esfuerzo forzado; folioTEST-0042, fecha2026-10-12, total11900, CUADERNO AZUL×2 a2500 y LAPIZ ROJO×5 a1000 coinciden con la imagen sintética. Los SKU ausentes siguen pendientes de revisión; no se inventan para habilitar guardado. Evidencia externa `outputs/codex-ubuntu-ocr.jpg`, ejecución de seguimiento `bad647db-dc59-4d9b-9a7e-3f2d4d47cdb5`.

Server Linux873 pruebas/115 archivos,20 regresiones focalizadas tras corrección y contratos JSONL/HTTP/PDF + política nativa correctos. No se probaron inferencia PDF, renovación/revocación reales, cuenta de otra conexión, VPS público ni elegibilidad comercial SIWC.

## Observación desde NodiaAI — 2026-10-16

La observación cancelable de sesión conserva la admisión exclusiva del perfil. Si no puede adquirirlo por `codex_runtime_unavailable` o `codex_profile_busy`, devuelve una observación con `available:false`, `authenticated:null`, fecha desconocida y el motivo exacto; no convierte ese resultado en una sesión cerrada ni en una inferencia fallida. En esta admisión, la cancelación y los errores inesperados siguen propagándose; el manejo de errores RPC posterior conserva su contrato previo. Un perfil ocupado no se interrumpe; sólo se detiene por cancelación el perfil cuyo lease pertenece a esta solicitud.

La revisión AI-15 reprodujo la diferencia anterior entre observar con y sin señal en el runtime real del laboratorio: la variante cancelable lanzaba una excepción antes del fallback. Las regresiones del caso de uso de lectura externa comprueban indisponibilidad, perfil ocupado, errores inesperados y cancelación con propiedad. Esta corrección no acredita login o inferencia Codex; la prueba generativa de AI-15 utiliza Gemini Agentic. Ver [entrega61](../../mvp/61-nodia-ai-ai15-product-reads.md).

## Ampliación solicitada: Codex en el chat NodiaAI — 2026-10-18

El usuario solicita incorporar el agente Codex como proveedor del chat NodiaAI. Se añade al [plan de implementación, AI-39/40](../../mvp/45-nodia-ai-implementation-plan.md#e11--codex-agentic-en-nodiaai): adaptador/runtime con MCP y posterior integración de interfaz/aceptación real. Esta solicitud amplía el alcance; no acredita implementación, disponibilidad actual o nueva inferencia. La integración histórica de sesión/OCR descrita arriba conserva su evidencia y límites.

Reutilizar la conexión OpenAI y su modo Agéntico, con modelos/esfuerzos descubiertos. El historial y el contexto autorizado pertenecen a NodiaAI; las herramientas deben pasar por su gateway, propuestas exactas, confirmación humana y recibos. El runtime de OCR sigue con herramientas deshabilitadas; el chat requiere un adaptador y una conciliación explícitos, compartiendo exclusión del perfil con OCR/login. No se crea un proveedor duplicado, no se habilita OpenAI Web ni se cambia automáticamente Gemini/API a Codex. Primer entorno de verificación: Linux; no se declara soporte nativo Windows.

La [ficha funcional](../../nodia-ai/knowledge/nodia-ai/features/context-execution.md#extensión-planificada-codex-ai-3940) mantiene estos cambios como planeados, sin publicar conocimiento operativo ni herramientas. Autenticación de una cuenta no prueba conversación/MCP; cada modalidad y operación publicada necesita su aceptación con el nuevo adaptador.

## Referencias oficiales

- [App-server y autenticación](https://learn.chatgpt.com/docs/app-server), [auth Codex](https://learn.chatgpt.com/docs/auth), [configuración](https://learn.chatgpt.com/docs/config-file/config-reference).
- [SIWC con Codex](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [login SIWC](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
- [ADR-018](../../architecture/decisions/ADR-018-openai-codex-agentic.md), [contrato IA](../../mvp/ai-provider-feature-contract.md).
