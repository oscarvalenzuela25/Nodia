# QA móvil de proveedores IA

Fixture sintético separado de producción. Intercepta todas las solicitudes Axios; una URL/operación inesperada falla. No conecta cuentas ni modifica datos reales, y los modelos/credenciales simulados solo existen aquí.

Ejecutar `npm run dev -- --mode qa --host 127.0.0.1 --port 5197 --strictPort` en nodia-client y abrir `/src/test/manual/ai-providers/index.html`. El modo QA separa su caché de dependencias del servidor de desarrollo habitual.

Parámetros de QA:

- `theme=dark` o `theme=light`, `lang=es` o `lang=en`.
- `detail=901` (Gemini sintético) o `detail=902` (OpenAI sintético).
- `mode=api_key` o `mode=agentic`.
- `grouped=1&detail=901&mode=agentic`: variantes sintéticas Low/Medium/High en una tarjeta. Cambiar razonamiento conserva el ID OCR anterior; no se inventa un ID base.
- `codex=1&detail=902&mode=agentic`: cuenta Codex sintética conectada, sin cuotas ni esfuerzos descubiertos. Permite revisar acciones contained; no realiza OAuth.
- `defaultCodex=1`: OpenAI sintético predeterminado con Agentic activo. Health no aporta sesión Codex; el topbar debe consultar una vez `902/session?mode=agentic` sin abrir su detalle. El refresh manual añade un GET health y uno de sesión. `window.aiProviderQA.calls` registra sólo método/URL, sin cuerpos ni credenciales.
- `unknown=1`: sin observación de motores; no inventar disponibilidad/cuotas.
- `empty=1`: sin conexiones ni claves. `error=1`: GET rechazados.
- `noModels=1`: Gemini sin modelos; no ofrece controles de potencia ni borra preferencias guardadas.
- `detail=902&mode=agentic&codexUnavailable=1`: Codex sin runtime, reconsulta compacta con icono/tooltip y Conectar bloqueado.
- `failSave=1` / `failDelete=1`: primera edición/eliminación rechazada; conservar diálogo/inputs para reintento.

Comprobar320/390/599/600/1280px, temas/idiomas, Agentic y API key, sin controles Web, modelos largos, tarjetas/tabla de claves, página conservada al redimensionar, estado desconocido, confirmación/cancelación/error/reintento y formularios. La sincronización responde con el catálogo sintético; no hay inferencia ni OAuth en este fixture.

Revisión 2026-11-12: Chromium redimensionado a 320/1280 px, ES/dark en Gemini y Codex, EN/light en API OpenAI. Sin overflow horizontal del documento (scrollWidth 310/1270 px con scrollbar de 10 px). Esfuerzos de Gemini de 72×44 px en móvil; API OpenAI envuelve los seis controles con altura de 44 px y Ultra deshabilitado. Manage/Disconnect Codex contained, 252×44 px en móvil. Cambio Gemini High→Medium preservó OCR High y una sola tarjeta. Estas observaciones usan datos sintéticos y no certifican dispositivos físicos ni inferencia.
