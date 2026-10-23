# AI-38: inventario de Gemini Web y diagnóstico de streaming

Observación de solo lectura del 2026-10-22, sin inferencias, reinicios ni cambios de sesión o configuración. [Inventario nativo](nodia-ai-ai38-web-stream-readonly-r01.json) y [paridad del SDK](nodia-ai-ai38-web-stream-sdk-parity-r01.json).

## Hechos comprobados

- Gemini conserva la imagen `sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e`, contenedor `9b07866b018c51efcb481a47fa8d81ef94b98dab430c1535b54b5d098488f267` y época `2026-10-22T19:48:35.342867871Z` durante toda la observación.
- API y worker están activos en el paquete `nodia-server-ai38-owner-r01`; PID 2786324 y 2786325. Los seis contadores nativos y los contadores SQL de trabajos, intentos y reservas pendientes están en cero a las 21:20 UTC de la VM.
- `gemini-webapi==2.1.1` y `curl-cffi==0.16.3` están instalados. Los 31 archivos Python públicos del SDK son idénticos byte por byte a los de la `.venv` Windows local. No se importó la aplicación para obtener la comparación del SDK.
- El import público es `from gemini_webapi.utils import StreamingFrameParser`. Su implementación reside en `utils/parsing.py`: clase en la línea134, `feed` en159 y `flush` en215. Las fuentes pertinentes quedan incluidas, con números de línea, en el inventario JSON.

## Límite de la evidencia anterior

El observador de Nodia cuenta los chunks y bytes del transporte antes de que el SDK los decodifique y pase a `StreamingFrameParser`. Dos chunks y 224 bytes no equivalen a dos frames JSON; tampoco permiten clasificar el contenido upstream como error, cola, heartbeat o candidata sin observar el framing.

En `client.py`1825..1883, el SDK espera el siguiente chunk con `stall_threshold + 5`. Con timeout y watchdog configurados en120 segundos, esa espera puede llegar a125 segundos. El caller de Nodia limita la generación completa a120 segundos. Por tanto, el caso sin candidata, sin EOF y sin recuperación es compatible con que el caller cancele antes de la espera o recuperación del SDK. Esto explica una limitación de lo observado; **no identifica la causa del silencio de Gemini** ni justifica aumentar el límite o reenviar una inferencia incierta.

## Preparación operativa, todavía sin ejecución

Se prepararon los scripts de [empaquetado](scripts/nodia-ai-ai38-web-stream-package-r01.py), [build aislado](scripts/nodia-ai-ai38-web-stream-build-r01.py) y [adopción](scripts/nodia-ai-ai38-web-stream-adopt-r01.py). Sólo permiten la base FIX exacta de47 fuentes, modificar `web_generation_diagnostics.py` y añadir `web_stream_frame_diagnostics.py`; el resultado tiene48 fuentes. La construcción utiliza únicamente COPY y las pruebas no montan perfiles, entorno operativo ni red.

El empaquetador conserva los45 archivos de pruebas del tar FIX congelado y sólo acepta nuevas pruebas explícitas de Web. La adopción exige plan e inventarios exactos, backup cifrado, drenaje y conservación de mounts, entorno y paquete Server. Reutiliza los mecanismos revisados de la adopción anterior en un espacio de trabajo y descriptor propios. Reiniciar Gemini invalidará las pruebas de la época anterior: una eventual adopción exige revalidar Web, MCP y los cuatro formatos Agentic.

Las [19 pruebas offline del driver](scripts/nodia-ai-ai38-web-stream-adopt-tests-r01.py) pasaron. No se ha construido ni adoptado una imagen mediante estos nuevos scripts en esta observación; tampoco se ha empaquetado aún el código del observador de frames.

## Continuación: build y adopción autorizados

El inventario de solo lectura anterior permanece congelado en su época original. Posteriormente se ejecutaron [build offline](nodia-ai-ai38-web-stream-build-r01.json), [preflight](nodia-ai-ai38-web-stream-adopt-preflight-r01.json) y [adopción](nodia-ai-ai38-web-stream-adopt-r01.json) como operaciones separadas y autorizadas. La traza del control textual anterior quedó [capturada antes del reinicio](nodia-ai-ai38-web-stream-text-diag-r01.json).

El build pasó486 pruebas Linux sin omisiones, sobre45 fuentes de pruebas congeladas del FIX y una nueva fuente de12 pruebas. Sólo cambió `web_generation_diagnostics.py` y se añadió `web_stream_frame_diagnostics.py`; dependencias y Config de la imagen permanecen idénticas. Los contenedores aislados se retiraron y la época operativa se conservó durante el build.

La adopción activó la imagen `sha256:985ba983fec5789671ceaa53c98103fbbf5b81c07938e6d10b2099034e2c0306`, con48 fuentes Python, en el contenedor `b20db84410938175ca00002b56ec3fef9b894af1399413b2fabbbbd36bcfab96`, época `2026-10-22T21:25:38.245485678Z`. API y worker volvieron activos con PID2844863 y2844864. Se conservaron mounts, entorno, configuración, SQL, nginx y el paquete Server. Backup cifrado nuevo listo, timers restaurados y todos los contadores nativos/SQL pendientes en cero. Esta operación no generó inferencias ni efectos de negocio.

Las pruebas de la época anterior requieren nueva aceptación. Se prepararon, todavía sin ejecutar, el [wrapper de MCP](scripts/nodia-ai-ai38-web-stream-mcp-r01.py) y el [inventario final](scripts/nodia-ai-ai38-web-stream-final-r01.py), ligados a la nueva imagen/época. Cinco [pruebas puras del control MCP](scripts/nodia-ai-ai38-web-stream-mcp-control-tests-r01.py) pasaron; el guard también aceptó el recibo real de adopción local. Sólo el coordinador raíz emite inferencias y decide los siguientes formatos según los resultados del diagnóstico.
