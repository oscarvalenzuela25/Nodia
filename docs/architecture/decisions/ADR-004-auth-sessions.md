# ADR-004 — JWT propio y sesiones renovables

> Estado: implementado; revisión documental pendiente
> Fecha: 2026-09-12

## Contexto

El usuario pidió implementar Google en frontend/backend, JWT propio persistido en el store existente, renovación, avatar y logout. La autorización de implementación es explícita; este documento no se marca aprobado. El MVP exige usuarios precreados y activos y permite completar únicamente los campos vacíos de su perfil.

## Opciones consideradas

### Opción A — Solo JWT de larga duración

- Ventajas: no agrega persistencia de sesiones.
- Desventajas: exposición prolongada del token y ausencia de revocación inmediata al cerrar sesión.

### Opción B — JWT corto y refresh rotativo en cookie HttpOnly

- Ventajas: mantiene el contrato de sesión independiente del proveedor y permite revocar la sesión completa.
- Desventajas: requiere una tabla de sesiones, CORS con credenciales y coordinación entre pestañas.

## Decisión

Implementar la opción B. `@nestjs/jwt` 12 es compatible con NestJS 12 sin nuevos overrides. `google-auth-library` verifica la credencial; `CreateSessionUseCase` emite la sesión sin depender de Google y podrá reutilizarse desde otros métodos de autenticación.

- `GoogleLogin` entrega un ID token. `POST /api/v1/auth/login` acepta `{provider: "google", credential}`.
- Google debe verificar firma, audience, issuer, expiración y correo verificado. Se busca el correo normalizado en `users` y se comprueba `is_active`.
- Se vincula el `sub` estable de Google en `users.google_sub`. Para la primera vinculación automática, Google debe ser autoridad sobre el correo (Gmail o Google Workspace). Cuentas Google con correos externos requieren un futuro mecanismo adicional de verificación/vinculación; actualmente se rechazan con el mismo error genérico.
- No se crea un usuario ni se aceptan nombre, avatar o email enviados por el cliente como prueba de identidad. Nombre e imagen vacíos se completan; la imagen actual de Google se guarda como avatar de la sesión sin sobrescribir un perfil editado.
- Access JWT HS256 de 15 minutos: `sub`, `sid`, `token_use`, `iss`, `aud`, `iat`, `exp`, `jti`. Se persiste `{token, user, expiresAt}` en `src/store/authStore.tsx` mediante Zustand persist.
- Refresh JWT con audience y tipo distintos, vencimiento absoluto de siete días y rotación en cada uso. Viaja exclusivamente en cookie HttpOnly, restringida a `/api/v1/auth`; solo su SHA-256 se guarda en PostgreSQL. No se expone al store ni a JavaScript del navegador.
- `auth_sessions` tiene PK bigint, identificador público UUID, usuario, hash del refresh, avatar, expiración y revocación. La renovación bloquea la fila en una transacción. La reutilización de un refresh válido pero reemplazado revoca la familia; la revocación se confirma antes de responder 401.
- El guard valida firma, tipo, audience, issuer y expiración, además de sesión no revocada y usuario activo en DB. El sistema ya no es enteramente stateless: el JWT evita depender del proveedor, mientras la sesión persistida permite revocación inmediata.
- API protegida por defecto; login, refresh, logout y health público tienen excepciones explícitas. El contexto de autorización usa la identidad validada y pierde el correo de desarrollo fijo.
- Requisito adicional confirmado: ninguna petición automática de datos sin sesión activa. El estado de autenticación no se persiste: al recargar, el token local se valida con `/auth/me` o se renueva si venció antes de montar la app. Queries usan `enabled` y Axios impide envíos sin sesión validada y JWT vigente. Un visitante sin token no llama siquiera a validación/refresh. Fallos transitorios de recuperación bloquean los datos y permiten reintento explícito.
- Refinamiento solicitado el 2026-09-12: separar transporte y sesión en el frontend. `axiosInstance.ts` crea clientes y normaliza errores HTTP; `authSession.ts` recibe un cliente y concentra restauración, renovación e interceptores de autenticación; `api.ts` conecta ambos y expone las instancias a los servicios. Se elige composición explícita para evitar dependencias circulares y conservar una única renovación compartida entre clientes de API.
- Navegación separada por petición explícita: `GuardStrict` exige sesión validada y módulo asignado por destino en `/settings/*`; `Guard` admite demo anónima en rutas públicas; `NoGuard` conserva login. La asignación se obtiene antes de montar una página estricta. Menú y Home ocultan módulos sin sesión; ninguna de estas reglas habilita acceso anónimo a la API ni sustituye la futura autorización fina de operaciones.
- `POST /auth/logout` es idempotente, revoca la sesión y borra la cookie. Frontend borra persist, usuario, contexto y caché incluso si falla la red; no vuelve a recuperar una cookie si falta sesión local.
- Refresh treinta segundos antes de expirar o ante 401, un único intento por petición; promesa compartida por pestaña y Web Locks entre pestañas cuando está disponible. No reintenta automáticamente mutaciones por errores de red, 429 o 5xx.
- CORS permite orígenes concretos con credenciales. Login/refresh/logout verifican `Origin` para proteger las operaciones basadas en cookie. Producción exige HTTPS y cookie Secure; SameSite es configurable.

## Consecuencias

- Nuevos proveedores reutilizan emisión, renovación, guard y logout. Email/password, hashing, registro y recuperación siguen fuera de esta entrega.
- El access JWT en localStorage conserva el patrón pedido y es accesible a scripts del mismo origen; el refresh permanece HttpOnly.
- Un logout sin conexión limpia el dispositivo, pero su revocación remota no se puede confirmar. El refresh pendiente se espera antes de enviar el logout para que una respuesta tardía no cambie la cookie después del cierre.
- Sin Web Locks, la deduplicación solo cubre una pestaña; una carrera entre pestañas puede cerrar la sesión por detección de replay. Falla cerrada.
- Los endpoints de negocio ahora exigen sesión. La autorización fina por acciones (`PermissionsGuard`) y la regla de continuidad de super_admin siguen siendo tareas separadas del Kanban; una sesión válida no sustituye ese trabajo.
- La migración agrega `google_sub` y `auth_sessions` sobre el esquema existente. El rollback elimina vínculos y sesiones; no debe ejecutarse como parte del despliegue normal.
- Pendiente operativo: definir dominios y SameSite en producción, confirmar orígenes en Google Cloud, programar purga de sesiones vencidas según retención y validar OAuth con una cuenta real. No se ha desplegado.

## Referencias

- [Guía de implementación](../../mvp/14-authentication.md)
- [PRD V2](../../mvp/04-prd-v2.md)
- [Google: verificación del ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [NestJS: autenticación](https://docs.nestjs.com/security/authentication)
- [TanStack Query: consultas deshabilitadas](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries)
