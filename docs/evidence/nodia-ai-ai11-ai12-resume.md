# AI-11/AI-12 — punto de retomada

## Checkpoint vigente — 2026-10-16

**AI-11/12 cerrados técnicamente en su alcance de laboratorio; siguiente AI-13.** Se retomó por solicitud explícita del usuario y se completaron las tres fases: [worker independiente9](nodia-ai-ai11-ai12-live-agentic-worker.json), [routing10](nodia-ai-ai11-ai12-live-routing.json) y [cancelación/conciliación SQL13](nodia-ai-ai11-ai12-live-unknown.json). [Evidencia consolidada](nodia-ai-ai11-ai12-live-validation.json), [regresión final](nodia-ai-ai11-ai12-final-regression.json) y entregas57/58/plan45 son la continuidad actual.

VM `nodia-vps-lab` Running, última IP observada172.31.209.214 (DHCP; consultar Hyper-V al reconectar). API, nginx y Gemini activos; PostgreSQL/Redis/Gemini saludables. Frontend localhost5174 y túnel3100 activos; launcherClient44688, Vite47076, túnel46148, verificar identidad antes de detenerlos. Docker Desktop está encendido. No quedan workers de prueba, fixtures PostgreSQL, directorios MCP activos, marcadores unknown ni recibos nativos. Ambas sesiones se observaron válidas después de terminar; una observación transitoria previa no acreditó disponibilidad y no causó replay.

El proceso real `dist/nodia-ai-worker.js` se inició únicamente contra la BD desechable y terminó ordenadamente después del turno. No arrancarlo sobre la BD configurada sin el plan de migraciones/despliegue. La API habitual conserva su release anterior; Native final está desplegado en `/opt/nodia/nodia-gemini-microservice` y el Server nuevo verificado en `/home/operador/nodia-ai-verification/server`. Código fuente respaldado, perfiles/credenciales preservados. El protocolo MCP de Server/Native debe desplegarse coordinadamente: incluye contadores monótonos de solicitudes no reenviadas.

Para continuar: leer README/progreso/45 y abordar **AI-13**, página inicial/drawer sobre contratos ya verificados. No repetir las inferencias de este checkpoint por rutina. Fichas43 draft/unregistered y approval null; cero corpus/herramientas de negocio publicados. NegocioAI-14+, API/modalidades/compactación y gates productivos de50 permanecen en sus etapas. Los tests se ejecutaron con Node y Gemini en la misma VM; comprobar reloj/transporte antes de extrapolar a un backend Windows. No aprobación documental ni aceptación productiva automática.

## Historia — pausa anterior, superada por el checkpoint vigente

Pausa explícita del usuario el2026-10-15 (Santiago; verificaciones UTC2026-10-16). Solicitó apagar servicios y VM. La información siguiente registra ese estado anterior y no es la tarea pendiente actual.

## Verificado en esta sesión

- Build Server correcto;1228 pruebas/142 archivos. PostgreSQL desechable: AI-11/60, AI-12/20, routing/23; regresiones AI-10/49 y AI-09/70. Evidencias específicas en este directorio.
- Python final231 casos:231 correctos en imagen Linux aislada, `--network none`, sin mounts de cuenta; Windows229 correctos y2 omisiones previas. Adaptador Server47 pruebas correctas.
- [Gemini Web real](nodia-ai-ai11-ai12-live-web.json): dos turnos con valor aleatorio, historia canónica recuperada, cero herramientas.
- [Concurrencia real](nodia-ai-ai11-ai12-live-concurrency.json):13 comprobaciones, dos dispatches del adaptador. Agentic hizo dos callbacks MCP sintéticos y respondió con el dato aleatorio recibido; el supervisor acreditó MCP para la selección exacta. Chat excluyó descubrimiento, login y OCR en ambos perfiles mediante409; Web permaneció disponible mientras Agentic retenía su perfil. El turno Web terminó y los recibos se acusaron. Ninguna escritura de negocio.
- Dos diagnósticos anteriores terminaron `mcp_result_unknown` y fueron conciliados con cierre nativo, sin reenviar generación. El segundo mostró CLI SUCCESS/código0,82.551s,8RPC y2callbacks, pero una denegación previa del hook invalidó el cierre. No atribuirles timeout como causa confirmada. Se agregó catálogo explícito al prompt, conservando restricciones, y diagnóstico categórico sin contenido/credenciales; la matriz posterior pasó.
- No procesos de prueba ni contenedores PostgreSQL de fixtures activos al pausar; no operación MCP activa antes de detener el servicio. No migraciones ni escrituras de negocio en la BD configurada. Corpus43 borradores/unregistered, bundle vacío y herramientas de negocio sin publicar.

## Procedimiento de reanudación anterior (ya ejecutado)

1. Leer README/progreso y57/58/45. Arrancar únicamente `nodia-vps-lab` y obtener su nueva IP mediante Hyper-V; no asumir la anterior. SSH usa clave y known_hosts externos bajo `Documents/NodiaVMs/keys`, alias de identidad `nodia-vps-lab`; nunca imprimir credenciales.
2. VM: arrancar los contenedores existentes `nodia-lab-postgres-1` y `nodia-lab-redis-1`; servicios `nodia-gemini-lab`, `nodia-api` y `nginx`. Revisar sesiones sin inferencia. Frontend y túnel local se detuvieron; recrearlos sólo si hacen falta. No arrancar el worker nuevo sobre la BD configurada sin migraciones/plan de despliegue.
3. El microservicio final está desplegado en `/opt/nodia/nodia-gemini-microservice`, con perfiles y credenciales preservados. Se guardaron backups de código fuente en `/opt/nodia/verification-backups/`. La API habitual conserva su release anterior. El Server nuevo se verifica por separado en `/home/operador/nodia-ai-verification/server`, con dependencias del lock y bases Docker desechables.
4. El harness `nodia-server/test/nodia-ai-live.integration.mjs` requiere opt-in explícito, configuración privada en la VM y JSON de selección observado de sólo lectura. Ejecutar secuencialmente las fases todavía pendientes: `agentic` (worker y MCP técnico reales), `routing` (consentimiento Web→Agentic y siguiente turno Web), `unknown` (cancelación en callback real, SQL en cuarentena y conciliación/acuse). El fixture de cancelación está preparado; no fue ejecutado.
5. No reutilizar una atestación de otro perfil/sesión/configuración. Cada fixture puede necesitar su propio probe MCP explícito; nunca convertir health en generación. No reenviar inferencias inciertas. Si la limpieza no termina, el harness conserva la BD y un recovery.json privado para conciliación.
6. Después de completar esas fases, reconciliar fuentes/fichas/inventario, actualizar evidencias/57/58/45/progreso y evaluar el cierre técnico. UI/switch es AI-13; herramientas de negocio son AI-14 y posteriores. Los gates productivos de50 siguen independientes.

## Artefactos y límites

El catálogo y modelos se resuelven desde la configuración/catálogo observados, sin fallbacks. El harness nunca utiliza la BD de negocio como fixture ni publica los borradores. Las comprobaciones reales corresponden a esta cuenta, selección y VM; no prueban otros modelos/proveedores/SO. Las cifras de dispatch del harness no son cuotas ni conteo de peticiones internas del proveedor.

Los procesos y servicios se detuvieron por solicitud del usuario. Comprobación: API/nginx/Gemini `inactive`, contenedores detenidos, Vite y túnel sin listeners, Docker Desktop detenido; Hyper-V confirmó `nodia-vps-lab`/ID `b940595d-892f-4235-9b08-59d2e777d696` en `Off` a2026-10-16T01:25:10Z, mediante apagado del invitado sin corte forzado. Conservar fuentes, perfiles, volúmenes y backups para retomar. La matriz Node/Gemini se ejecutó dentro de la VM; no extrapolarla a un backend Windows local sin comprobar configuración, reloj y transporte.
