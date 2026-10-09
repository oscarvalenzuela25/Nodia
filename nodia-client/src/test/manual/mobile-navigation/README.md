# QA aislado de navegación y tarjetas móviles

Ejecutar `npm run dev -- --port 5193 --mode mobile-qa --host 127.0.0.1` y abrir `/src/test/manual/mobile-navigation/index.html?theme=dark&lang=es`.

Esta entrada usa BaseLayout, MobileBottomNav y ReservationTable reales con el contexto y las respuestas sintéticas guardadas en caché. `fixtures.json` deriva exclusivamente de `nodia-server/test/fixtures/rental/api.json`; no contiene información de personas reales. No se importa desde la aplicación ni forma parte del bundle productivo. Usar este puerto/origen aislado, nunca el origen de una sesión real.

- `theme=light|dark`, `lang=es|en`; `loading=1` observa cinco segundos de carga inicial local de Reservas, sin llamar al backend.
- Agregar los cuatro accesos, bloquear/desbloquear, cambiar/quitar, recargar y comprobar el catálogo que excluye duplicados. La configuración persiste bajo la identidad sintética de este origen.
- Los handlers de detalle/edición/creación emiten avisos QA. Los enlaces muestran destinos reales; la página de QA no es el router del producto. No navegar esos destinos como prueba operativa.
- Probar 320/360/390/430/599 px: tarjetas y barra sin márgenes externos. Desde 600 px: tabla original y barra ausente. Comprobar el último registro y paginado por encima de la barra, tema/idioma, teclado, Escape y retorno del foco.

Los flujos remotos, permisos operativos y BD objetivo requieren la aceptación correspondiente de cada módulo; esta entrada acredita presentación, no disponibilidad real del backend.
