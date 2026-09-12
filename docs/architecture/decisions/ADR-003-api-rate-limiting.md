# ADR-003 — Rate limiting distribuido para nodia-server

> Estado: opción A aprobada por el usuario; implementación local completada. Validación del entorno desplegado pendiente.
> Fecha: 2026-09-12
> Autorización: «Vamos con la opcion 1», referida a `@nestjs/throttler`.

## Contexto

Se necesita limitar las peticiones a la API para contener ráfagas, consultas repetitivas y abuso de escrituras. La protección debe compartir contadores entre instancias y conservar los controladores delgados.

El backend usa NestJS 12, Express, TypeScript/ESM e ioredis. Antes de esta entrega no tenía rate limiting ni `trust proxy` configurado. El servicio Redis de caché existente absorbe errores y no expone operaciones atómicas de consumo de cuota; se conserva como servicio separado.

La primera entrega identificó por IP. Tras implementarse JWT y sesiones en [ADR-004](ADR-004-auth-sessions.md), se incorporan la cuota específica de login y las cuotas por usuario verificado. Los alias singulares/plurales de los recursos, los IDs y los filtros no deben permitir reiniciar la cuota.

## Opciones consideradas

### Opción A: @nestjs/throttler con almacenamiento Redis — elegida

- Ventajas: integración con módulos, guards y decoradores de NestJS; múltiples políticas; almacenamiento intercambiable.
- Costos: validar compatibilidad con NestJS 12, mantener el adaptador comunitario y personalizar claves para cuotas agregadas.

### Opción B: rate-limiter-flexible con RateLimiterRedis

- Ventajas: contadores atómicos e integración con ioredis sin peers de NestJS.
- Costos: exige más integración propia de políticas, guards y contrato HTTP. No se incorpora.

### Opción C: express-rate-limit con rate-limit-redis

- Ventajas: middleware HTTP sencillo, aplicable antes de los guards.
- Costos: vinculado a Express y menos integrado con los metadatos de NestJS. No se incorpora.

## Decisión

Se implementa **`@nestjs/throttler@6.5.0` + `@nest-lab/throttler-storage-redis@1.2.0`**, con Redis compartido por defecto. `ipaddr.js@2.2.0` normaliza las identidades de red. Las tres dependencias quedan fijadas en `package.json` y `package-lock.json`.

### Compatibilidad con NestJS 12

El registro npm consultado el 2026-09-12 publica throttler 6.5.0 y adaptador Redis 1.2.0 con peers que incluyen NestJS hasta 11. La instalación ordinaria de esa combinación con NestJS 12 produjo `ERESOLVE`. El manifiesto de desarrollo de throttler incluye NestJS 12, pero no se instaló código desde una rama de desarrollo.

Se resolvió con `overrides` de npm limitados a esas dos versiones: sus referencias a `@nestjs/common` y `@nestjs/core` usan las dependencias raíz del proyecto. No se cambió NestJS 12, no se editó código de terceros y no se habilitó `--force` ni `--legacy-peer-deps`.

La excepción se respalda con instalación limpia (`npm ci`), compilación ESM y ejecución HTTP con dos procesos NestJS 12 y Redis real. Esto valida los flujos comprobados; no equivale a soporte oficial declarado por los paquetes.

**Mantenimiento:** cuando ambas librerías publiquen peers compatibles, actualizar las versiones, retirar los dos overrides, regenerar el lockfile y repetir instalación, build y comprobaciones operativas. No ampliar la excepción automáticamente a futuras versiones.

### Políticas implementadas

Valores iniciales de configuración, ajustables según tráfico real; no son cuotas comerciales ni métricas derivadas de producción:

| Política | Identidad | Cuota | Ventana | Bloqueo al exceder |
| --- | --- | --- | --- | --- |
| `burst` | IP | 30 solicitudes | 10 segundos | 10 segundos |
| `general` | IP | 300 solicitudes | 60 segundos | 60 segundos |
| `writes` | IP | 30 solicitudes POST/PUT/PATCH/DELETE | 60 segundos | 60 segundos |
| `login` | IP | 10 intentos de login | 60 segundos | 60 segundos |
| `user` | Usuario verificado | 300 solicitudes autenticadas | 60 segundos | 60 segundos |
| `userWrites` | Usuario verificado | 30 solicitudes POST/PUT/PATCH/DELETE autenticadas | 60 segundos | 60 segundos |

Las políticas se acumulan. Antes de autenticar se comprueban `burst`, `general`, `writes` para mutaciones y `login` en el handler marcado `@LimitLogin()`. Después de verificar JWT, sesión y usuario, se comprueban `user` y, para mutaciones, `userWrites`. La librería ordena las políticas de cada guard por TTL. Se contabilizan intentos que alcanzan cada política, incluidos los que posteriormente fallan validación, origen o autenticación. Una petición rechazada por una política anterior no llega a consumir las siguientes.

Los límites por usuario son valores iniciales configurables de 300 solicitudes/minuto y 30 escrituras/minuto. No reemplazan los límites por IP: compartir oficina puede seguir agotando la cuota de red. Cambiar token, sesión o IP no reinicia la cuota del usuario.

El adaptador Redis incrementa y administra expiración/bloqueo mediante un script Lua atómico. Usa una ventana de contador con TTL y una clave de bloqueo independiente, creada al exceder la cuota. Los intentos durante el bloqueo también incrementan el contador. No se promete una ventana deslizante exacta ni que un cliente que siga enviando tráfico sea admitido inmediatamente al terminar un bloqueo.

Todos los TTL y bloqueos de configuración están en **milisegundos**. El adaptador devuelve los tiempos restantes redondeados hacia arriba en **segundos**.

### Integración

- `src/rate-limit/rate-limit.module.ts`: registra `ThrottlerModule.forRootAsync()` con las seis políticas y exporta los guards de IP/usuario. Las escrituras se seleccionan por método HTTP.
- `rate-limit.guard.ts`: extiende `ThrottlerGuard`; normaliza la IP, genera claves agregadas, convierte el rechazo al contrato HTTP de Nodia y limita la frecuencia de los logs de rechazo.
- `user-rate-limit.guard.ts`: reutiliza el contrato y almacenamiento anteriores, selecciona solo las políticas de usuario y obtiene la identidad de `request.auth.user.id`. Omite rutas públicas sin principal; no decodifica tokens ni toma identidades del body/query/headers.
- `rate-limit.decorator.ts`: `@LimitLogin()` selecciona exclusivamente los handlers de login, sin depender de la URL ni sobrescribir cuotas generales.
- `rate-limit-storage.provider.ts`: implementa la interfaz `ThrottlerStorage` delegando en el adaptador de la librería. Administra una conexión ioredis propia, recuperación y cierre. No duplica el contador.
- `rate-limit.config.ts`: valida almacenamiento, límites, ventanas, prefijo, conexión y proxies al arrancar.
- `AppModule` registra, en este orden, tres `APP_GUARD` con `useExisting`: `RateLimitGuard` → `AuthGuard` → `UserRateLimitGuard`. Ambos módulos exportan sus guards sin registrarlos globalmente por separado. Esto conserva una sola ejecución de cada uno y protege la verificación JWT/consultas de sesión mediante la barrera por IP. `main.ts` habilita cierre ordenado, configura confianza de proxies y expone `Retry-After` por CORS.
- Los controladores y casos de uso CRUD mantienen sus responsabilidades actuales. No se crearon casos de uso artificiales para probar la librería.

Las claves usan prefijo de aplicación/entorno, nombre de política y hash de la identidad. No incorporan URL, handler, alias, ID, query string ni JWT. La invalidación `auth:context:*` no afecta las cuotas. El método preexistente `RedisService.flushAll()` sí las borraría: no usarlo para limpiar una caché que comparta Redis con el limiter.

### Identidad, alcance y excepciones

- IPv4 e IPv4 representada como IPv6 se normalizan a la misma identidad. IPv6 se agrupa por /64.
- Se usa `req.ip` de Express, con `TRUST_PROXY` vacío por defecto. La variable acepta exclusivamente una lista explícita de IPs/CIDRs de proxies confiables; rechaza booleanos y cantidades de saltos. No se leen cabeceras reenviadas directamente.
- `OPTIONS` queda excluido. `@Public()` solo omite autenticación, no el límite por IP; esto incluye `GET /api/v1`. Ningún endpoint existente de negocio se exime. Un health check que deba omitir rate limiting necesita `@SkipThrottle({ burst: true, general: true, writes: true, login: true, user: true, userWrites: true })` explícito.
- Los guards cubren handlers NestJS. Swagger, rutas desconocidas y tráfico rechazado antes del guard requieren protección en el ingreso/middleware si se necesita cubrirlos. Cloudflare Pages para el frontend no demuestra que la API esté detrás de Cloudflare.
- Se mantienen disponibles los decoradores de throttler. Las cuotas agregadas deben conservar parámetros uniformes entre rutas; una política especial necesita un nombre/clave propio, para evitar mezclar límites distintos en un contador compartido.
- `POST /auth/login` incorpora `@LimitLogin()` y contabiliza también DTOs, orígenes o credenciales rechazados después del guard. `POST /auth/refresh` y `POST /auth/logout` conservan cuotas por IP, incluida `writes`, sin consumir `login` ni cuotas de usuario. Estos handlers públicos verifican la cookie cuando corresponde en sus casos de uso. `GET /auth/me` y las rutas protegidas consumen cuota de usuario solo tras verificar JWT y sesión activa. Un JWT inválido, vencido, de refresh o una sesión revocada recibe `401` sin consumir cuota de usuario, siempre que no lo rechace antes la barrera por IP/Redis.

### Redis y disponibilidad

`RATE_LIMIT_STORAGE=redis` es el valor por defecto. Se utiliza `RATE_LIMIT_REDIS_URL` si está definida, con soporte de `rediss://`; de lo contrario se usan `REDIS_HOST`, `REDIS_PORT` y `REDIS_PASSWORD` existentes. Puede ser el mismo servidor de caché, pero la conexión del limiter es independiente.

No hay fallback silencioso a memoria. Si Redis falla, las rutas protegidas responden **503**. Se deshabilita la cola offline, se acota cada comando a 1000 ms por defecto y la conexión a 2000 ms; la reconexión tiene espera creciente hasta 5 segundos. Los fallos se registran con frecuencia limitada y la recuperación se registra tras una operación exitosa.

`RATE_LIMIT_STORAGE=memory` solo se acepta con `NODE_ENV=development` o `test`, para un proceso local. Usa el almacenamiento de throttler y no sirve para validar cuotas distribuidas ni garantiza la misma semántica temporal que Redis.

Antes de producción se debe confirmar conectividad, permisos para scripts Redis, capacidad y política de expulsión de claves. Una caché que expulse claves antes del TTL puede reiniciar cuotas: aislar el almacenamiento si la configuración compartida no sirve. No se aprovisionó infraestructura ni se ejecutó un despliegue en esta tarea.

### Contrato HTTP y cliente

- Exceso de cuota: `429`, `error: RATE_LIMIT_EXCEEDED`, `message: core:rate_limit_exceeded` y cabecera estándar `Retry-After` en segundos. Se conservan también las cabeceras de políticas nombradas emitidas por la librería.
- Fallo de almacenamiento: `503`, `error: RATE_LIMIT_UNAVAILABLE` y `message: core:rate_limit_unavailable`.
- Se conserva la estructura de `AllExceptionsFilter` y ambos errores llevan `Cache-Control: no-store`. Los errores esperables del limiter no generan un stack trace por solicitud.
- El interceptor Axios del cliente traduce esos códigos a es/en, incluye la espera indicada en `Retry-After` y normaliza tanto `error.message` como `response.data.message`, para los toasts sileo y estados visuales existentes. No se agregan toasts duplicados en el interceptor.
- Las consultas ya tienen `retry: false`. El interceptor no reenvía las solicitudes rechazadas ni elimina datos en caché.

## Consecuencias

- Protección agregada y compartida entre instancias, integrada en NestJS.
- Dependencias y overrides acotados con mantenimiento explícito.
- Redis se vuelve una dependencia de disponibilidad para las rutas protegidas. El costo en latencia y los falsos positivos requieren observación en el entorno desplegado.
- Usuarios de una oficina siguen compartiendo la cuota por IP además de sus cuotas individuales. Calibrar ambos niveles con tráfico real. Las rutas autenticadas añaden una operación Redis para `user` y otra para `userWrites` cuando corresponda.

### Validación local

Entorno: Node 24.20.0, NestJS 12.0.1 y Redis 7.2.6 temporal, sin tocar datos de un servidor compartido.

- Instalación limpia con `npm ci` y árbol de dependencias sin duplicar NestJS.
- Backend: build y lint correctos; 46 pruebas de casos de uso aprobadas.
- Cliente: typecheck correcto y 148 pruebas aprobadas, incluidas 7 nuevas de traducción/contrato Axios. Lint sin errores, con 8 advertencias existentes en componentes ajenos a esta entrega.
- Comprobaciones operativas HTTP mediante fixture temporal con el módulo compilado: cuota atómica compartida entre dos procesos, alias/IDs/query, cuota general y de escrituras, expiración, aislamiento de IPs, normalización IPv4/IPv6, confianza de proxies, exclusiones, cabeceras y errores, caída/recuperación de Redis, modo memoria y validación de configuración.
- No se añadieron suites de controladores, servicios o guards. Los fixtures y el Redis usados para comprobación son temporales y no forman parte de los archivos versionados.

Ampliación tras integrar auth (2026-09-12): build/lint del backend correctos y 73 pruebas de casos de uso aprobadas. La comprobación HTTP usa el `AppModule` y los endpoints de auth reales en dos procesos, con Redis temporal real; solo sustituye persistencia y el verificador externo de Google. Comprueba login compartido (incluidos fallos de DTO/origen/credencial), JWT firmado y sesiones verificadas antes de cuotas de usuario, independencia de usuarios, cuota compartida entre tokens/sesiones/IPs/rutas/alias, escrituras, orden de guards y TTL de claves. También se repite la comprobación previa de IP, proxy, expiración y caída/recuperación Redis. No se modificó frontend en esta ampliación ni se verificó Google o PostgreSQL reales en este fixture.

### Pendientes de despliegue y evolución

- Confirmar Redis y cadena real de proxies en Northflank antes de activar allí la versión; configurar `TRUST_PROXY`, prefijo por entorno y acceso Redis.
- Verificar desde la ruta pública de entrada que dos clientes tienen identidades distintas y que cabeceras externas no suplantan la IP.
- Observar tráfico en staging y ajustar los valores iniciales antes de producción.
- Login y cuotas por usuario están integrados; calibrar sus variables `RATE_LIMIT_LOGIN_*`, `RATE_LIMIT_USER_*` y `RATE_LIMIT_USER_WRITES_*` junto a las cuotas por IP.
- Retirar overrides al disponer de releases compatibles y repetir las comprobaciones.

## Referencias

- [Progreso](../../mvp/00-progress.md), [stack backend](../../mvp/09-stack-backend.md), [DevOps](../../mvp/10-stack-devops.md), [arquitectura](../../mvp/11-architecture-overview.md) y [kanban: T3.2/T3.4](../../mvp/12-kanban.md).
- [Configuración operativa en nodia-server](../../../nodia-server/README.md#rate-limiting).
- [Rate limiting en NestJS](https://docs.nestjs.com/security/rate-limiting), [throttler 6.5.0](https://registry.npmjs.org/@nestjs%2Fthrottler/6.5.0) y [adaptador Redis 1.2.0](https://registry.npmjs.org/@nest-lab%2Fthrottler-storage-redis/1.2.0).
- [Overrides de npm](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides) y [proxies de Express](https://expressjs.com/en/guide/behind-proxies/).
