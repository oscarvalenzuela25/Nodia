# Runbook de despliegue seguro — Nodia Server y Gemini

> Estado: en revisión; guía operativa aún no ejecutada en VPS
> Fecha: 2026-09-28; actualización Gemini: 2026-10-03
> Depende de [ADR-007](../architecture/decisions/ADR-007-gemini-internal-access.md) y del [plan de seguridad](17-security-hardening-plan.md).

## Alcance y topología

La única entrada de usuarios es Nodia Server detrás del proxy HTTPS. FastAPI se usa exclusivamente por Nodia Server. Si NestJS corre en el host, Compose publica `127.0.0.1:8000:8000`; el firewall del VPS debe bloquear 8000 desde fuera. Si NestJS corre en Docker, retirar `ports` de FastAPI, compartir una red privada y configurar `GEMINI_MICROSERVICE_URL` con el nombre del servicio. La elección de topología sigue pendiente: **no desplegar Compose sin adaptarlo a ella y comprobarlo desde una red externa**.

## Antes de desplegar

1. Respaldar PostgreSQL y verificar que la copia se puede restaurar en un entorno separado. Inventariar las filas de `ai_api_keys` por versión de `secret_ciphertext` sin imprimir ciphertext ni secretos. Confirmar migraciones pendientes y que el backup contiene las claves cifradas actuales.
2. Generar con un gestor de secretos dos valores independientes de 32 bytes aleatorios, codificados como 64 caracteres hexadecimales: `GEMINI_SERVICE_TOKEN` (mismo valor en NestJS y FastAPI) y `AI_SECRET_MASTER_KEY` (solo NestJS). Nunca guardarlos en Git, imagen, logs o historial de shell. Proteger `.env` con permisos `0600` y los directorios de perfil/sesión con `0700` en el VPS.
3. Si existen datos históricos en `ai_api_keys`, inventariarlos y conservar su backup cifrado. La política actual permite únicamente sesiones Web/Antigravity: no crear, reemplazar ni activar API keys. S-07/S-08 deben definir la transición de esos datos. Si una migración de conservación necesita `AI_LEGACY_MASTER_KEY`, validar su disponibilidad antes de ejecutarla; un fallo de descifrado no autoriza borrar datos.
4. Confirmar credenciales distintas por entorno para PostgreSQL, Redis, R2, Google y JWT; TLS y permisos mínimos. Comprobar que ni el perfil de navegador ni las cookies se incluyen en el contexto de Docker o en backups accesibles públicamente.
5. Elegir el mecanismo de login gráfico del operador en VPS. El botón actual funciona solo en desarrollo con NestJS y Gemini local: abre Chrome en el host Python. En producción no inicia el trabajo hasta disponer de un visor remoto privado. No publicar VNC/noVNC, Chrome remoto ni las rutas `/auth/login/*` para suplirlo.

## Orden de activación

1. Desplegar el código de Nodia Server y Gemini con el **mismo** `GEMINI_SERVICE_TOKEN`, sin abrir tráfico público. Mantener el token antiguo durante una rotación posterior hasta coordinar la parada y arranque de ambos procesos; la implementación actual acepta un único token, así que habrá una interrupción breve de llamadas Gemini durante el cambio.
2. Validar las migraciones y la transición S-07/S-08 en una restauración de prueba antes de ejecutarlas contra producción. El código de compatibilidad actual de NestJS requiere `AI_SECRET_MASTER_KEY`; no es una credencial de inferencia. Si se ejecuta una migración de conservación de cifrado, disponer de la clave heredada solo durante esa operación y comprobar la conservación de datos sin activar su uso por proveedores.
3. Iniciar FastAPI y NestJS. Comprobar que `/health` responde sin detalles de sesión y que una petición local a `/models` sin token o con token incorrecto recibe `401`. Comprobar desde NestJS que verificación de proveedor y análisis autorizado funcionan. No colocar el token en ejemplos de curl, tickets o capturas.
4. Desde una red externa al VPS, verificar que `:8000`, `/docs`, Redis, PostgreSQL y el navegador remoto no responden. Verificar que solo el proxy HTTPS del API está expuesto. Confirmar `TRUST_PROXY` con IPs reales, `Secure`/`SameSite` de cookies y límites del proxy para cuerpos de 10 MB más overhead multipart.
5. Probar con una factura sintética: usuario sin sesión, sin `ai:manage`, sin `invoice:analyze`, rol revocado y usuario autorizado. Las rutas administrativas y de análisis deben negar acceso antes de contactar Gemini. Confirmar respuesta `413/415` para tamaño/tipo inválido y `429` bajo saturación, sin datos de factura ni secretos en logs.

## Reversión y recuperación

- Si falla la migración, conservar la base intacta o restaurar el backup verificado antes de volver a intentar. La migración de cifrado no tiene `down` seguro: el código anterior no puede leer ciphertext `v2`. Para volver al código anterior se requiere restaurar el respaldo anterior a la migración; evaluar los cambios escritos después del respaldo antes de cualquier restauración.
- Si FastAPI rechaza a NestJS, comprobar que ambos procesos cargaron el mismo token y la URL interna correcta. No desactivar la validación de identidad ni publicar el puerto para resolver el incidente.
- Si falla el login de Google o se pierde el perfil, detener análisis Gemini, diagnosticar desde el entorno privado, restaurar el volumen protegido o volver a autenticar mediante un procedimiento de operador definido. Revocar cookies/credenciales si se sospecha exposición.
- Registrar fecha, versión desplegada, resultado de pruebas externas, responsable y riesgos residuales. La apertura al público requiere completar las puertas de salida de las etapas 0 a 5 del plan.

## Verificación operativa de Gemini v1 — 2026-10-03

Las comprobaciones locales pasaron con servicios simulados y sin Google: suite en Windows/Linux, construcción de imagen, ejecución UID 10001, arranque sin cookies, rechazo de rutas privadas sin token, readiness 503 y limpieza de temporales. Esto no demuestra login real ni recuperación de sesiones en el VPS. Consultar [ADR-009](../architecture/decisions/ADR-009-truthful-gemini-engines.md).

1. **Preparar el host.** Elegir la topología privada anterior y respaldar perfil/sesión de forma protegida. Preparar sus permisos para UID/GID 10001 y lectura de `.env` sin incluirlo en la imagen. Mantener un solo worker. Medir memoria, CPU, shm y almacenamiento persistente; Compose acota temporales, pero no impone una cuota al perfil persistente. No borrar un perfil para corregir permisos.
2. **Arranque frío.** Con una sesión de prueba ausente, verificar `/health` 200, `/ready` privado 503 y análisis Web 503. Con token ausente/incorrecto, las rutas sensibles deben responder 401, incluidos docs y login. El healthcheck de Docker solo mide vida del proceso.
3. **Login y análisis privados.** Definir y ensayar el acceso gráfico del operador antes de habilitar login en producción. Acceder mediante Server y usar una factura sintética. Sincronizar modelos descubiertos, asignar uno explícitamente y revisar opciones de razonamiento: capacidades no reportadas se consideran desconocidas y no se habilitan por nombre. Antigravity permanece no disponible hasta verificar un adaptador real de la sesión de escritorio del usuario; Web no lo sustituye.
4. **Fallos y límites.** Probar cuerpo fragmentado sin `Content-Length`, 413/415, saturación 429 con `Retry-After`, desconexión y timeout 504. Verificar liberación de cupos/temporales y correlación mediante `X-Request-ID`; Server debe conservar la categoría y el plazo sin exponer la respuesta del proveedor. Aplicar también límites de carga/tiempo en el proxy público.
5. **Recuperación.** Reiniciar y confirmar continuidad de la sesión; ensayar expiración/inactividad, renovación privada y restauración de volúmenes en un entorno separado. No sustituir modelos, motores ni credenciales cuando falle. Comprobar cierre ordenado y ausencia de trabajos/navegadores pendientes.
6. **Evidencia y reversión.** Desde una red externa, verificar aislamiento de FastAPI y dependencias. Registrar versión, topología, permisos, límites medidos, casos ejecutados y resultado. Conservar imagen/configuración previas y un backup restaurable; no declarar listo el soporte dual ni desplegar hasta cerrar las verificaciones correspondientes al alcance de lanzamiento.
