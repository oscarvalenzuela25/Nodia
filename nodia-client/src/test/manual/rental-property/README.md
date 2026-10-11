# QA aislado de alojamientos

Abrir `/src/test/manual/rental-property/index.html?lang=es&theme=light` en un origen Vite exclusivo para fixtures. Parámetros: `lang=es/en`, `theme=light/dark`, `empty=1` para cero alojamientos. El adapter local bloquea mutaciones y peticiones reales.

Comprobar 320/390/600/1280 px: una instrucción de selección, botón contained «Crear alojamiento», modal sin zona horaria ni horarios, Activo al final, acciones a ancho completo en móvil, scroll y foco accesibles. Los datos sintéticos no acreditan operación con sesión real.
