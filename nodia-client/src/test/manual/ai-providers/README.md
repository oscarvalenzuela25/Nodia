# QA móvil de proveedores IA

Fixture sintético separado de producción. Intercepta todas las solicitudes Axios; una URL/operación inesperada falla. No conecta cuentas ni modifica datos reales, y los modelos/credenciales simulados solo existen aquí.

Ejecutar `npm run dev -- --host 127.0.0.1 --port 5197 --strictPort` en nodia-client y abrir `/src/test/manual/ai-providers/index.html`.

Parámetros de QA:

- `theme=dark` o `theme=light`, `lang=es` o `lang=en`.
- `detail=901` (Gemini sintético) o `detail=902` (OpenAI sintético).
- `mode=api_key`, `mode=token_plan_web` o `mode=token_plan_agentic`.
- `unknown=1`: sin observación de motores; no inventar disponibilidad/cuotas.
- `empty=1`: sin conexiones ni claves. `error=1`: GET rechazados.
- `failSave=1` / `failDelete=1`: primera edición/eliminación rechazada; conservar diálogo/inputs para reintento.

Comprobar320/390/599/600/1280px, temas/idiomas, tres modos Gemini y OpenAI sin Web, modelos largos, tarjetas/tabla de claves, página conservada al redimensionar, estado desconocido, confirmación/cancelación/error/reintento y formularios. La sincronización responde con el catálogo sintético; no hay inferencia ni OAuth en este fixture.
