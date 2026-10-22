# Visor Gemini — QA sintético

Abrir `/src/test/manual/gemini-viewer/index.html` en un servidor Vite de QA con puerto separado (por ejemplo5175, modeqa). Variantes `?lang=en&theme=light` y `?lang=es&theme=dark`.

Reutiliza el componente real y sus hooks con un adapter Axios offline. No inicia sesión, modifica authStore, llama al backend ni envía datos a Google. No introducir credenciales reales en esta fixture. Revisar en320/390/600/1280px: solo Enviar texto/ojito, centrado vertical con input, etiqueta/ayuda accesibles, ancho móvil, toggle preservando borrador/foco y envío simulado que limpia el campo.
