# OpenAI Codex Agentic

> Estado: código preparado; aceptación operativa aplazada por el usuario el 2026-10-08.
> No se levantó PostgreSQL, aplicó la migración, autenticó una cuenta ni generó una factura real. El documento no constituye una aprobación.

## Comportamiento implementado

OpenAI admite el canal `token_plan_agentic` mediante un runtime Codex supervisado por Nodia Server. API key conserva claves cifradas, modelos y facturación independientes. OpenAI Web permanece deshabilitado. El formulario utiliza los flags del catálogo: Agentic aparecerá habilitable después de aplicar la migración pendiente, y debe activarse explícitamente por conexión.

La sesión Codex pertenece a la conexión de Nodia y es compartida por quienes tengan permiso para gestionarla/usarla. Cada intento de login pertenece además al actor autenticado; otro actor no recibe su código ni el estado privado del job. Conectar no cambia modelos, canal predeterminado, API keys ni sesiones Gemini.

El panel Codex del detalle permite consultar sesión, iniciar autorización por código de dispositivo, recuperar el intento pendiente, cancelar y desconectar. Solo abre `https://auth.openai.com/codex/device`. El backend conserva los tokens en el keyring del SO; el navegador recibe un código temporal, estados y observaciones seguras. Los jobs terminales borran URL/código de su respuesta pública. Los errores conservan el modal y permiten reintentar; feedback y estados tienen ES/EN.

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
5. Cuando haya BD, revisar/aplicar únicamente la migración objetivo con `npm run migration:codex-catalog` desde Server. Preserva el registro existente `key='openai'` y guarda sus flags previos en `nodia_codex_catalog_rollback`. API `true`, Web `false`, Agentic `true`; no activa ninguna instancia ni cambia su predeterminado. La prueba real de up/repetición/down está pendiente.
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

Pendientes acordados: migración/reversión PostgreSQL; login/keyring real, renovación/revocación, desconexión y reinicio con cuenta; catálogo efectivo de la cuenta; extracción PNG/PDF desde UI; Linux; QA por Quick Tunnel. Elegibilidad/registro SIWC para servicio alojado y Responses directo quedan como trabajo independiente. El plan se conserva hasta registrar esas aceptaciones.

## Fuentes

- [App-server y autenticación](https://learn.chatgpt.com/docs/app-server), [auth Codex](https://learn.chatgpt.com/docs/auth), [configuración](https://learn.chatgpt.com/docs/config-file/config-reference).
- [SIWC con Codex](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [login SIWC](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
- [ADR-018](../../architecture/decisions/ADR-018-openai-codex-agentic.md), [contrato IA](../../mvp/ai-provider-feature-contract.md).
