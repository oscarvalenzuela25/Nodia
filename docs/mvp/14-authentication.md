# Autenticación — implementación y operación

> Estado: en revisión (implementación autorizada por el usuario; documento no aprobado)
> Fecha: 2026-09-12
> Decisión técnica: [ADR-004](../architecture/decisions/ADR-004-auth-sessions.md)

## Implementado

1. Client ID de Google configurado en frontend y backend. El backend valida que la credencial esté destinada a ese cliente.
2. Login de usuarios preexistentes y activos, sin altas automáticas, sin `is_allowed` y sin datos demo.
3. Access JWT propio de quince minutos persistido con usuario, avatar y `expiresAt` en el `authStore` existente.
4. Refresh rotativo de siete días en cookie HttpOnly, hash en PostgreSQL, detección de replay y revocación inmediata.
5. Renovación automática, un reintento tras 401, coordinación de peticiones y prevención de respuestas tardías tras logout.
6. Redirección a `/`, topbar con avatar, nombre/correo y menú de cerrar sesión. Logout limpia persist, contexto y caché.
7. Guard global de API y guards de rutas de cliente. Contexto de permisos obtenido para el usuario autenticado; Home sigue público.
8. Notificaciones Sileo es/en, botones bloqueados durante las peticiones y eliminación del login simulado.
9. Rate limiting integrado: login 10 intentos/minuto por IP y cuotas por usuario verificado de 300 solicitudes/minuto y 30 escrituras/minuto, conservando los límites por IP previos ([ADR-003](../architecture/decisions/ADR-003-api-rate-limiting.md)).

## Cuándo está activa una sesión y cuándo se permite HTTP

Requisito confirmado por el usuario: sin sesión no se ejecutan consultas de datos; todos los endpoints de negocio exigen Bearer. El login y las operaciones necesarias para comprobar, renovar y cerrar la sesión son excepciones de control de autenticación.

En el cliente, `sessionStatus` vive solo en memoria: `anonymous`, `restoring`, `authenticated` o `unavailable`. Persistir un token no persiste la condición de autenticado. `useAuth().isSessionActive` exige estado `authenticated`, token presente, `expiresAt` futuro y ninguna renovación en curso.

1. **Visita sin token local:** Home público y login disponibles; cero peticiones automáticas a la API de Nodia, incluyendo contexto, `/auth/me` y refresh. Los recursos estáticos y el SDK de Google no son endpoints de datos de Nodia.
2. **Login exitoso:** la respuesta del backend activa la sesión y permite cargar datos con `Authorization: Bearer <token>`.
3. **Recarga con token guardado:** estado `restoring`. Si todavía no venció, se valida mediante `GET /auth/me`; si venció, se llama directamente a `POST /auth/refresh`. Un 401 de `/auth/me` permite un intento de refresh. Hasta completar la recuperación no se monta la aplicación ni se consultan datos.
4. **Sesión activa:** las seis consultas actuales (usuarios, roles, acciones, módulos, grupos y contexto) tienen `enabled` condicionado a la sesión. Axios también bloquea cualquier petición protegida sin sesión, incluidas mutaciones y refetch manual, antes de enviarla a la red.
5. **Renovación:** treinta segundos antes de vencer se renueva en segundo plano, conservando la vista mientras el JWT siga vigente. Los nuevos envíos esperan la renovación. Axios vuelve a comprobar el vencimiento por si los timers se retrasaron; nunca envía deliberadamente el token local vencido a un endpoint de negocio.
6. **Fallos:** un refresh rechazado con 401/403 limpia la sesión y la caché. Un error de red/5xx al recuperar la sesión conserva las credenciales, mantiene bloqueados los datos y muestra una opción de reintentar o cerrar sesión. Si falla la renovación anticipada pero el access token sigue vigente y validado, puede seguir usándose hasta vencer; después se bloquean los envíos.
7. **Logout:** limpia token, usuario, contexto, caché y persist. Las respuestas tardías no recuperan una sesión cerrada. Los cambios de token de otra pestaña se validan antes de habilitar datos.

En el servidor la decisión definitiva ocurre en **cada petición**: firma/issuer/audience/tipo/expiración del JWT, sesión existente no vencida ni revocada y usuario activo. El guard se registra como `APP_GUARD`, por lo que también protege automáticamente nuevos controladores. Solo se usa `@Public()` en métodos que deliberadamente no requieren access Bearer: login, refresh, logout y health (`GET /api/v1`). Refresh exige una cookie válida; logout permite revocación idempotente sin access token vigente. Swagger y el preflight CORS son infraestructura HTTP, no endpoints de datos autenticados.

La sesión tiene una duración absoluta de siete días desde el login. Cada access token dura como máximo quince minutos, sin extender ese límite de siete días. Vencida o revocada la sesión del servidor, hace falta volver a iniciar sesión con Google.

Los `APP_GUARD` se registran una sola vez en `AppModule`, en orden IP → `AuthGuard` → usuario. `@Public()` no omite los límites por IP: login tiene además `@LimitLogin()`; refresh/logout comparten la cuota de escrituras por IP y no consumen login ni cuotas de usuario. Los intentos rechazados por DTO, origen o credencial cuentan para login si alcanzaron esa política. `GET /auth/me` y endpoints de negocio utilizan `request.auth.user.id` solo después de validar firma, sesión y usuario; cambiar JWT, sesión o IP no reinicia esa cuota. Los límites son configurables en `.env.example` y mantienen el contrato 429/503 y el tratamiento del cliente existente.

## Organización HTTP y sesión en el frontend

La configuración se separa en tres archivos de `nodia-client/src/config/`:

| Archivo | Responsabilidad |
|---|---|
| `axiosInstance.ts` | Fábrica `createAxiosInstance`: URL, timeout, headers, cookies y normalización de errores HTTP, incluidos 429/503. No depende del store ni ejecuta lógica de sesión. |
| `authSession.ts` | Fábrica `createAuthSession(client)`: restaurar, renovar, esperar renovaciones e instalar interceptores de Bearer, bloqueo sin sesión, reintento tras 401 y descarte de respuestas tardías. Recibe el cliente por parámetro. |
| `api.ts` | Crea `mainInstance`, instala auth y exporta `createApiInstance`, `restoreSession`, `refreshSession` y `waitForRefresh`. Todas las instancias de API comparten un solo gestor de sesión y una renovación en curso. |

Los servicios importan el cliente desde `config/api.ts`; el provider y su hook importan de ese mismo archivo las operaciones de sesión. La fábrica de transporte se utiliza únicamente al configurar clientes: usarla directamente en un servicio omitiría auth. `authSession.ts` no importa `api.ts`, evitando dependencias circulares. El interceptor de normalización HTTP se instala antes del interceptor de respuesta de auth.

```ts
// Ejemplo desde src/services/:
import { mainInstance } from "../config/api";

export const getUsers = () => mainInstance.get("/users");
```

Este refactor conserva las reglas de sesión, los guards y el contrato del backend.

## Guards de navegación y modo demo

Requisito confirmado el 2026-09-12: separar la navegación estricta de la navegación que admite demo.

| Guard | Regla | Uso actual |
|---|---|---|
| `GuardStrict` | Sesión validada y módulo asignado para el destino indicado en `modulePath` | `/settings/users`, `/settings/roles`, `/settings/actions`, `/settings/modules` |
| `Guard` | Permite visitantes en modo demo y usuarios con sesión validada | `/` y futuros módulos públicos |
| `NoGuard` | Pantalla exclusiva para visitantes; una sesión autenticada redirige a `/` | `/login` |

`GuardStrict` carga el contexto de autorización antes de montar la página, también al entrar escribiendo la URL. Sin sesión redirige a `/login`; sin el módulo correspondiente, a `/404`. No basta pertenecer al grupo `settings` o tener otro módulo. Se compara el destino exacto del módulo (`link`, con fallback para claves conocidas), normalizando slash final y mayúsculas; los query parameters no conceden permisos adicionales. Durante una renovación anticipada se conserva la vista ya validada, con controles inhabilitados. Un fallo inicial de contexto muestra error y reintento sin montar la página ni enviar sus consultas.

El menú lateral y las tarjetas de Home usan únicamente asignaciones de una sesión validada y omiten grupos vacíos. La navegación no concede acceso por un nombre de rol hardcodeado; el contexto de módulos y las reglas de acciones del backend son responsabilidades distintas. La autorización fina de operaciones del Kanban permanece pendiente.

`useAuth().isDemo` indica que no existe sesión local; `isSessionValid` permite conservar una vista validada durante la renovación y `isSessionActive` indica que se pueden iniciar consultas remotas. Restauración o fallo temporal de validación no se convierten en modo demo. Las páginas demo deben usar datos locales; el guard no habilita llamadas anónimas a la API ni inventa datos de demostración.

Ejemplo al registrar rutas:

```tsx
<GuardStrict modulePath="/settings/users"><Users /></GuardStrict>
<Guard><PublicModule /></Guard>
```

## Contrato HTTP

Todas las rutas usan el prefijo existente `/api/v1`. Las menciones históricas a `/api/auth/*` en documentos anteriores describían rutas sin la versión.

| Método/ruta | Entrada | Respuesta |
|---|---|---|
| `POST /auth/login` | JSON `{ "provider": "google", "credential": "<ID token>" }` | `{token, expiresAt, user}` + cookie refresh |
| `POST /auth/refresh` | Cookie refresh | Nuevo access JWT y cookie rotada; misma expiración absoluta de sesión |
| `POST /auth/logout` | Cookie refresh | 204 y cookie borrada |
| `GET /auth/me` | Bearer JWT | `{id, name, email, image_url}` |
| `GET /authorization/context` | Bearer JWT | Roles, acciones y módulos del usuario validado |

`expiresAt` es Unix time en milisegundos. El JWT tiene fechas estándar en segundos. `auth/me` y contexto son recursos separados; al recargar, la validación o renovación de sesión precede a cualquier carga del contexto.

Login/refresh/logout requieren un header `Origin` autorizado, también desde Postman/curl. El navegador lo envía automáticamente. El cliente envía cookies con `withCredentials: true`.

## Configuración local

Client ID configurado:

```text
648664263695-atejjacv8uedispitjeg339ivdj9mm4b.apps.googleusercontent.com
```

En `nodia-client/.env.local`:

```dotenv
VITE_GOOGLE_CLIENT_ID=648664263695-atejjacv8uedispitjeg339ivdj9mm4b.apps.googleusercontent.com
VITE_API_URL=http://localhost:3000/api/v1
```

En `nodia-server/.env`:

```dotenv
GOOGLE_CLIENT_ID=648664263695-atejjacv8uedispitjeg339ivdj9mm4b.apps.googleusercontent.com
AUTH_JWT_SECRET=<secreto aleatorio de al menos 32 bytes>
AUTH_ALLOWED_ORIGINS=http://localhost:5174
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=false
```

Se generó un secreto local si no existía, sin incluirlo en archivos versionados ni en el chat. No se necesita Client Secret de Google para verificar ID tokens.

En Google Cloud, el cliente OAuth debe ser de tipo Web, con pantalla de consentimiento configurada y orígenes JavaScript autorizados `http://localhost` y `http://localhost:5174`. Si corresponde por su configuración de audiencia, agregar la cuenta a los usuarios de prueba. Este flujo de callback JavaScript no necesita una ruta de redirect en React.

Usar Node 24.20.0 o compatible con los `engines` del proyecto. Levantar PostgreSQL y Redis según el README de servidor, luego `npm run start:dev` en servidor y `npm run dev` en cliente. Usar `localhost` consistentemente; cambiar a `127.0.0.1` también requiere configurar ese origen.

El correo debe existir en `users` y tener `is_active=true`. Para primera vinculación automática se aceptan Gmail y Google Workspace; otros correos de cuentas Google requieren verificación adicional futura.

## Migración

En una base existente de Nodia, ejecutar desde `nodia-server`:

```sh
npm run migration:run
```

La migración `AuthSessions1789257600000` añade `users.google_sub` (único/nullable) y `auth_sessions`, sin recrear usuarios ni roles. Requiere el esquema base ya existente. Es idempotente para columnas/tablas creadas previamente por synchronize en desarrollo.

La configuración de desarrollo existente conserva `synchronize`; en producción se desactiva y se deben aplicar migraciones antes de arrancar. La migración de auth no crea el esquema histórico completo de Nodia.

## Producción

- Configurar un secreto independiente y fuerte, Client ID y lista explícita de orígenes HTTPS.
- Usar dominios del mismo sitio, por ejemplo `app.ejemplo.com` y `api.ejemplo.com`, con SameSite=Lax, cuando sea posible.
- Si frontend/API están en sitios distintos, usar `AUTH_COOKIE_SAME_SITE=none`; en producción Secure se activa obligatoriamente. Las políticas de bloqueo de cookies de terceros pueden impedir la renovación: preferir dominios del mismo sitio o proxy propio.
- Registrar el origen de producción en Google Cloud. La lista CORS del backend y Google deben coincidir con el frontend real.
- El sistema requiere PostgreSQL para validar/revocar sesiones y Redis para el rate limiting actual. Los errores 429/503 conservan el tratamiento existente.
- Implementar la purga periódica de filas vencidas según la política de retención acordada; las sesiones vencidas ya no autorizan ni renuevan.

## Verificación

- Pruebas de casos de uso: cuentas inexistentes/inactivas, credenciales incorrectas, preservación de perfil, JWT expirado/alterado/audience incorrecta, rotación, replay y logout.
- Pruebas de cliente: intercambio de credencial, persist, redirección, loading/error, avatar, limpieza, refresh concurrente, límite absoluto de siete días, respuestas posteriores al logout, ausencia de peticiones de datos antes de validar/renovar la sesión, guards demo/estricto, acceso directo por URL y ocultación de módulos sin sesión.
- Comprobación con una instancia aislada de PostgreSQL y NestJS real, incluyendo dos renovaciones concurrentes. La frontera de Google se simula en esta prueba; no usa datos de la base de desarrollo.
- Revisión visual local del botón oficial de Google y Home público, sin errores de consola.
- Smoke HTTP real: ocho comprobaciones de guard, DTOs, rechazo de origen, CORS con credenciales y cookie borrada en logout.
- Verificación adicional del bloqueo global con NestJS/PostgreSQL aislados: 50 operaciones protegidas, cada una sin token y con token inválido (100 rechazos 401); 12 rutas GET con Bearer válido responden 200. Sesiones inexistentes, vencidas y revocadas rechazadas; excepciones públicas de auth verificadas. Base temporal eliminada.
- Resultado: 196 pruebas del cliente y 73 del backend pasando; typecheck/build y lint sin errores. El refactor de configuración HTTP añade comprobaciones de renovación compartida y bloqueo anónimo en clientes derivados; se conserva la verificación previa del backend, que no cambia en este refactor. Persisten ocho advertencias previas de hooks en pantallas administrativas y el aviso de tamaño de bundle.
- Pendiente externo: completar un acceso con una cuenta real preautorizada. No se ha comprobado la configuración privada del proyecto Google Cloud ni se ha desplegado.

## Alcance futuro

Para email/password u otro proveedor se agrega su verificador/caso de uso y se reutiliza `CreateSessionUseCase`. Contraseñas requerirán hashing, verificación, recuperación y sus políticas; no se agrega ese mecanismo por adelantado.

La autorización fina por acción en endpoints y las reglas administrativas del Kanban siguen pendientes. Esta entrega valida identidad/sesión y carga los permisos reales; no implementa el `PermissionsGuard` completo.
