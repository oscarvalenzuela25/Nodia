# ADR-017 — Autenticación remota de Gemini Agentic desde Ajustes IA

> Estado: propuesto documentalmente; implementación autorizada por el usuario. Intercambio OAuth y persistencia con cuenta del VPS pendientes.
> Fecha: 2026-10-07

## Contexto

Gemini Web tiene su propio login. Agentic reutilizaba una sesión del CLI instalada administrativamente en el servidor, sin una acción en Ajustes IA. El usuario necesita iniciar esa sesión desde otro equipo, por ejemplo un Mac que accede a Nodia alojado en un VPS. La sesión actual es compartida entre las conexiones Gemini Agentic, mientras modelos y preferencias pertenecen a cada instancia.

El CLI oficial 1.3.1 no ofrece un subcomando de login. Su flujo remoto SSH abre un enlace OAuth oficial y espera que el operador pegue el código mostrado por Google. Requiere terminal interactiva incluso antes de solicitar el código.

## Opciones consideradas

### Opción A: adaptar el flujo OAuth remoto del CLI

- Ventajas: el CLI conserva el intercambio y almacenamiento de credenciales; el navegador puede estar en otro equipo; no requiere publicar una terminal ni una pantalla del VPS.
- Desventajas: controlar una TUI versionada mediante PTY, verificar estado fuera de esa terminal y mantener una dependencia Windows para ConPTY.

### Opción B: construir OAuth propio copiando el registro o almacenamiento del CLI

- Ventajas: transporte HTTP más directo.
- Desventajas: asumir contratos de autenticación ajenos, gestionar tokens y acoplarse a detalles privados. No hay evidencia suficiente para habilitar esa alternativa.

### Opción C: mantener el login exclusivamente en la terminal del operador

- Ventajas: no adaptar la TUI.
- Desventajas: no satisface la operación desde Ajustes solicitada por el usuario.

## Decisión

Implementar A dentro del microservicio privado existente, con rutas públicas de Nodia Server protegidas por sesión y `ai:manage`. El actor del trabajo deriva de la sesión Nodia verificada; FastAPI recibe `users.id`, un `BIGINT` PostgreSQL representado como cadena decimal canónica positiva (1..9223372036854775807), junto con la credencial interna. Conservar la cadena exacta, sin convertirla a `Number` ni sustituirla por un UUID. Un administrador no puede consultar, enviar códigos ni cancelar el trabajo de otro. La respuesta pública de intento actual es `{job:null}` cuando no existe uno.

Mantener una sesión Agentic compartida y una sola autenticación activa por proceso. Bloquear inferencias Agentic mientras dure el login; Web conserva su sesión. Trabajos de hasta 300 s, resultados consultables hasta 600 s desde su creación, sin reintentos de intercambio ni inferencia. Invalidar observaciones al comenzar y terminar. Confirmar sesión mediante `/usage` y catálogo no generativos del CLI, nunca por el código aceptado o por la existencia del perfil.

El puente solo permite seleccionar el menú Google OAuth observado, responder consultas fijas de terminal y enviar un código acotado. Solo exporta eventos tipados y un enlace HTTPS validado de `accounts.google.com` con callback oficial Antigravity y PKCE. No expone una terminal genérica. Después de enviar el código descarta la salida de terminal. El log temporal del CLI se elimina al cerrar; credenciales finales permanecen bajo gestión del CLI.

Cancelar, vencer el plazo o apagar el servicio termina y espera procesos propios antes de liberar admisión, incluso si el trabajo se cancela antes de empezar. Linux usa PTY/grupo de procesos; Windows usa ConPTY mediante `pywinpty==3.0.5` y el Job Object existente. Cuerpo privado de login hasta 8192 bytes/5 s y respuesta privada hasta 16384 bytes/5 s. Respuestas de login con `Cache-Control:no-store`.

Si la sesión existente ya se verifica, finalizar sin iniciar otra autenticación ni cambiar cuenta. No añadir `/logout`: el comando del CLI puede purgar credenciales globales, por lo que cambiar cuenta requiere operación explícita y una decisión posterior. No modificar el catálogo, modelos, tablas o claves API.

## Consecuencias

- Consecuencias positivas: login desde el navegador del cliente sin instalar el CLI en ese equipo; tokens fuera del frontend y la BD; contratos de análisis y configuración conservados.
- Costos o riesgos aceptados: dependencia de la TUI 1.3.1 y de las capacidades de almacenamiento del CLI bajo el usuario del servicio; jobs locales que requieren un worker; la sesión compartida no ofrece cuentas distintas por conexión.
- Trabajo posterior: autenticar una cuenta en el VPS destino, comprobar almacenamiento protegido, arranque frío/recreación y renovación/revocación. La prueba del enlace en Linux no verifica el intercambio OAuth ni una inferencia Linux.

## Referencias

- [ADR-016](ADR-016-antigravity-cli-adapter.md), [seguridad de microservicios](../internal-microservice-security.md).
- [Funcionalidad y contratos](../../features/ai-providers/gemini-agentic-authentication.md), [runbook](../../mvp/agentic-cli-runbook.md).
- [Flujo remoto oficial](https://www.antigravity.google/docs/cli/install/), [comandos CLI](https://www.antigravity.google/docs/cli/reference/).
