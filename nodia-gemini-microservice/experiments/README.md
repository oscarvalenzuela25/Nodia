# Diagnóstico de niveles Gemini Web

## NodiaAI AI-03: Agentic y MCP

[Investigación49](../../docs/mvp/49-nodia-ai-ai03-gemini-agentic-viability.md) y
[política48](../../docs/mvp/48-nodia-ai-mode-routing-policy.md). Harness
`probe_nodia_ai_agentic.py`, stdio `nodia_ai_mcp_fixture.py` y hook
`nodia_ai_agentic_gate.py` son opt-in y no se importan desde la aplicación.

```text
python -m experiments.probe_nodia_ai_agentic --live-agentic --connection-id ID_CONFIGURADO --model ID_CONFIGURADO --thinking-level NIVEL_CONFIGURADO
```

Sólo en el contenedor Linux desechable autorizado, con `/probe/run` privado,
scripts readonly, archivo OAuth/installation_id nativos Google montados readonly
en `/probe/auth/` y bus privado bajo el mismo usuario. No copiar/inspeccionar
sus valores, incluirlos en fixtures o montar .env/Web/BD. Si no hay intensidad
configurada, omitir el argumento, sin inferirla del nombre del modelo.
Un propietario exclusivo mientras dure el ensayo; supervisor restaura el
servicio habitual incluso ante timeout. No ejecutar desde unit tests ni
dar al agente el workspace/entorno privilegiado del backend.

Resultado actual parcial: registration/initialize/tools/list comprobados,
tools/call no completado; timeout unknown sin resend. No publicar MCP ni
activar adapter_states o el switch por este resultado. El servidor fixture
permite sólo read/prepare sintéticos y finish en el hook; ninguna escritura real.

El adaptador se integró en `../web_reasoning_adapter.py` el 2026-10-13. La aplicación
lo utiliza cuando existe un registro externo de perfiles nativos verificados;
este directorio conserva únicamente el diagnóstico opt-in, sin rutas adicionales.
Ver [operación y evidencia](../../docs/features/ai-providers/gemini-web-login-viewer.md)
y [ADR-031](../../docs/architecture/decisions/ADR-031-gemini-web-reasoning-levels.md).

Para el mismo Flash descubierto, el navegador real transmitió Bajo=1, Medio=4 y
Alto=2 en body80/header15. No convertir tres preferencias a un booleano ni reutilizar
estos valores para otro ID/número de modelo sin observaciones propias.

El cliente mantiene auth, catálogo, uploads, parsing y cierre del SDK2.1.1.
La sustitución afecta solo los dos campos numéricos de la generación. Exige
perfil/modelo/versión/layout comprobados, rechaza combinaciones incompatibles,
impide generación concurrente y no repite inferencias. Sin nivel explícito conserva
el comportamiento histórico. El streaming no incorpora el nuevo parámetro.

## Ensayo diagnóstico opcional

Solo en el entorno privado, con sesión/dependencias ya configuradas. Detener el
proceso habitual antes del ensayo: dos procesos no deben compartir perfil/caché.
No copiar `.env`, cookies ni perfiles a otro equipo. Usar observaciones sanitizadas
y el ID explícito que coincida con ellas:

```text
python -m experiments.probe_live_reasoning --live-web --native-observations /ruta/observaciones.json --model ID_OBSERVADO
```

Consume tres mensajes sintéticos, uno por nivel, sin archivos. Reporta únicamente
modelo, nivel, valores enviados, número de envíos, tiempo y respuesta `OK`.
Se detiene tras el primer resultado inválido, sin sustituir modelo/cuenta/motor.
Al terminar, restaurar el proceso habitual. Para OCR integrado usar la ruta privada
existente `/web/analyze-invoice` con modelo explícito y `thinking_level`, manteniendo
la aplicación como único proceso propietario de la sesión.

El éxito verifica transporte e inferencia para esa sesión/modelo; no mide profundidad
interna ni garantiza otros modelos. `run_tests.py` cubre el constructor y uploader
reales del SDK sin red; las pruebas reales y su alcance están en la funcionalidad.

## NodiaAI AI-02: conversación Web y herramientas

[Ensayo y operación](../../docs/mvp/47-nodia-ai-ai02-gemini-web-viability.md),
[protocolo sintético](nodia_ai_web_protocol.py) y [harness opt-in](probe_nodia_ai_web.py).
No están importados por la API ni publican rutas/herramientas de dominio.

```text
python -m experiments.probe_nodia_ai_web --live-web --model ID_CONFIGURADO --connection-id ID_CONFIGURADO
```

Detener primero el propietario habitual del perfil y restaurarlo en `finally`.
Sólo en el laboratorio privado autorizado; no copiar sesiones/secretos entre equipos.
Exige modelo configurado con ID exacto descubierto, sin cambio de selección/fallback.
Hasta siete invocaciones sintéticas: lectura y preparación, sus resultados,
continuación SDK, rehidratación por historial y rechazo de confirmación por el modelo.
Las preguntas de continuidad no contienen los valores esperados; se comparan localmente.
Elimina únicamente chats que creó y sólo imprime evidencia controlada.

Las herramientas fixture no escriben datos ni tienen confirmación, DB o HTTP.
El protocolo es JSON validado sobre generación Web; no acredita MCP/function calling
nativo. `run_tests.py` incluye las21 pruebas nuevas de parsing, frontera de herramientas,
incertidumbre sin replay y admisión del adaptador. No ejecutar el harness live dentro
de la suite unitaria ni paralelamente a OCR/login.
