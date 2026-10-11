# QA aislado del calendario

Configuración/móvil: resource=cancellation-policies aplica empty/error/invalid al listado; blocks=1 carga el ejemplo de detalle de bloqueo como registro de prueba. PUT de alojamiento confirmado se refleja únicamente en memoria de esta fixture al revalidar. Ejecutar node src/test/manual/reservations-calendar/verify-configuration-mobile.cjs <directorio-de-evidencia>: pestañas/listados en320/390/599/600/768/1440px ES oscuro/EN claro, edición por grupo, guardado/rechazo, selección predeterminada, archivo y permisos. No modifica datos reales ni declara aceptación en teléfono físico.

Ejecutar `npm run dev -- --port 5194 --mode calendar-qa --host 127.0.0.1` y abrir `/src/test/manual/reservations-calendar/index.html?property=1`.

Componentes y servicios Client reales, respuestas sintéticas copiadas de `nodia-server/test/fixtures/rental/api.json`. El adaptador Axios intercepta todas las solicitudes; no usa la API ni una BD real. No importar esta entrada desde producción. Usar este origen aislado para que la identidad sintética no afecte una sesión real.

Parámetros: `theme=light|dark`, `lang=es|en`, `empty=1`, `error=1`, `invalid=1`, `loading=1`, `reject=1` (rechaza escrituras sin cerrar el formulario), `owner=1` (permisos sintéticos de propietario para revisar formularios administrativos). `window.calendarQaRequests` permite revisar que no hay lecturas por cada evento.

Comprobar mes/semana, siguiente/anterior/Hoy, selección y ficha, cobros/preparación/detalle, creación por día/rango, pasos y borradores, selectores y teclado, móvil, cambio de alojamiento y fallos. Esta entrada comprueba integración/presentación con contratos sintéticos; RC-38 con sesión real y teléfono físico permanece independiente.

El script verify.cjs usa Playwright instalado/disponible externamente (opcional NODIA_QA_PLAYWRIGHT con la ruta del módulo) y Edge headless. Ejecutar node src/test/manual/reservations-calendar/verify.cjs <directorio-de-evidencia> con Vite activo. Comprueba22 casos sin API/BD reales. Fija el reloj sintético en noviembre para las reservas de ejemplo; al abrir manualmente con la fecha actual, navegar a noviembre. Los ejemplos de detalle/lista/calendario se capturaron en distintos momentos: el adaptador reconcilia solo fixtures QA por identidad y período.

Verificación específica de prefijos: node src/test/manual/reservations-calendar/verify-phone.cjs <directorio-de-evidencia>, con el mismo Vite/Playwright externo. Cuatro combinaciones390/600/1440 ES oscuro y390 EN claro; selector buscable, teléfono inválido bloqueado, paso conservado y rechazo409 reteniendo país/número. Esta prueba usa únicamente la fixture aislada, sin consultar ni escribir contactos reales.

Verificación de alineación del acuerdo: node src/test/manual/reservations-calendar/verify-layout.cjs <directorio-de-evidencia>, con el mismo Vite/Playwright externo. Diez combinaciones ES oscuro/EN claro x390/599/600/768/1440px; comprueba pares de importes, vencimientos/abono/notas de ancho completo, fecha/hora alineadas, hora legible y ausencia de overflow.

Verificación de selección de meses: node src/test/manual/reservations-calendar/verify-months.cjs <directorio-de-evidencia>, con el mismo Vite/Playwright externo. Cuatro secuencias390/1440 ES/EN: año2027 → mayo → día20, popup abierto hasta seleccionar día y fecha civil final2027-05-20.
