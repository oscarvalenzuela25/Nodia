El candidato Node arrancó su API real desde `dist/main.js` con `NODE_ENV=production` y el árbol de dependencias instalado previamente mediante `npm ci --omit=dev`. La ejecución aislada duró 10,274 segundos en la VM Linux local y pasó once controles. No se usaron `@nestjs/testing`, composición parcial de módulos, overrides de servicios ni cambios de código de producto.

Se verificaron antes y después los hashes de los 2.827 archivos compilados y de `package.json`/`package-lock.json` contra el manifiesto congelado del candidato. El árbol `node_modules` era físico, independiente del operativo y sin `@nestjs/testing`. No se repitió la instalación: esta prueba completa el arranque HTTP que faltaba a la evidencia de dependencias frescas.

| Control HTTP sobre la API completa | Resultado |
| --- | --- |
| Ruta pública `/api/v1` | 200 |
| NodiaAI sin credencial | 401 |
| `/auth/me` con JWT y sesión SQL sintéticos válidos | 200 e identidad correcta |
| Listado y detalle del chat propio con módulo asignado | 200; listado filtra el otro dueño |
| Lectura del chat ajeno por usuario ordinario | 404 |
| Sesión válida sin módulo NodiaAI | 403 |
| JWT válido después de revocar su sesión SQL | 401 |

Las ocho peticiones funcionales fueron GET. El arnés creó las identidades, sesiones y chats sintéticos únicamente en PostgreSQL desechable y emitió los JWT con el `AuthTokenService` compilado real. La aplicación completa realizó la verificación del JWT, sesión, módulos y propiedad mediante sus guards y casos de uso reales. Esto prueba la autenticación de sesiones y autorización HTTP; **no prueba el inicio de sesión con Google**. El contrato actual acepta un Google ID token; no existe login de contraseña, bcrypt ni signup que se pueda probar como alternativa.

La API conectó exclusivamente con PostgreSQL y Redis desechables, sin llamadas a proveedor ni almacenamiento. Un guard de laboratorio rechazó sockets ajenos y fetch del proceso API, y restringió su único listener a un puerto efímero de loopback; el proceso padre sólo pudo consultar su PostgreSQL y la API de prueba. No se permitieron los puertos operativos 3000, 3001, 5174, 5432, 6379 u 8000. Se usaron secretos sintéticos y `/dev/null` como fuente dotenv, sin leer `.env` configurado, cuentas o perfiles operativos.

El recorrido no admitió runs, jobs, intentos o ejecuciones de IA. La API cerró mediante SIGTERM sin kill forzado; los dos contenedores propios fueron eliminados, no quedó ninguno y se conservaron todos los IDs de contenedores preexistentes. Los archivos compilados y manifiestos del árbol fresh conservaron sus hashes. La prueba no adopta el candidato ni acredita OAuth Google, UI, R2 o inferencia real.

El [informe del driver](nodia-ai-ai38-fresh-api-process-r01.json) y el [informe del proceso real](nodia-ai-ai38-fresh-api-process-r01-native.json) fueron copiados byte por byte desde la VM. La [validación local](nodia-ai-ai38-fresh-api-process-validation.json) fija hashes, fuentes y controles de consistencia. El arnés es [nodia-ai-ai38-fresh-api-process.mjs](../../nodia-server/test/nodia-ai-ai38-fresh-api-process.mjs) y su driver es [nodia-ai-ai38-fresh-api-process.py](scripts/nodia-ai-ai38-fresh-api-process.py).
