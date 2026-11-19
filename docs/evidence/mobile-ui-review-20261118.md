# Revisión móvil de Nodia — 2026-11-18

Segunda revisión de `codex/ui-refresh`. Se inspeccionó Noticias con la sesión
local en el navegador integrado y se usaron fixtures sintéticas para las
acciones de prueba. La matriz incluye español e inglés, claro y oscuro,
anchos de 320 y 390 px, la transición 599/600 px y orientación horizontal
representada por viewports bajos y anchos.

| Área | Hallazgo y verificación |
| --- | --- |
| Encabezado y dock | En 320 px, menú, idioma y tema pasaron de 40/37/40 px a 44 px de alto. Se comprobó el ancho del documento a 320, 390, 599, 600 y 844 px. En 844 × 390 con puntero táctil emulado, el control más bajo del encabezado también mide 44 px. La reserva de scroll para el foco coincide con el dock. |
| Diálogos y avisos | A 320 × 568, con una reducción visual sintética de 234 px, la hoja de accesos termina en y=334 y Guardar en y=318. La búsqueda conserva el valor y Escape devuelve el foco al acceso. Un aviso sintético queda dentro del ancho y por encima del dock. |
| Negocios, Finanzas y Reservas | En 320 px, Market y Reservas mostraban sólo parte de sus pestañas. El selector compacto permite recorrer las opciones con flechas, mantiene el foco y conserva la sección al cruzar 600 px. La opción activa recibe foco y la búsqueda se puede enfocar por separado. Se conservaron las tablas con scroll local. |
| Administración | Doce perfiles de listados/detalle a 320 y 390 px. Se abrieron seis formularios a 320 × 568 y se alcanzaron ambas acciones con 44 px de alto. Usuarios conservó el borrador al redimensionar y durante un 503 sintético. |
| Noticias | El reintento de 503 se coloca en su propia fila. En 320 px pasó de 84 × 31 a 256 × 44 px. Un reintento recuperó los artículos a 320 y 390 px. La vista local de Mis noticias llenó el ancho disponible en ambos tamaños. |
| NodiaAI | En 320 × 400, el área de lectura pasó de 24 a 72 px y los cuatro controles del compositor se alcanzan al desplazar el contenido sobre el dock. A 390 × 844 el chat conserva su scroll interno y el documento cabe en el viewport. En 667 × 375, el área de lectura pasó de 41 a 72 px. Con 328 px de oclusión sintética, los cuatro controles quedaron por encima del límite visible. En el historial, Cerrar permanece visible al desplazar los filtros incluso a 320 × 240. |
| Teacher | Dieciséis perfiles en alta, revisión, lección y práctica. Los tres pasos muestran sus etiquetas a 320 px y se conserva el borrador al avanzar y volver a editar. |

La reducción de viewport se simuló en Chromium. El teclado del sistema, la
orientación y el área segura de un teléfono físico requieren una comprobación
en ese dispositivo. Las capturas sintéticas están en `output/playwright/`.

Pasaron las suites focalizadas de controles compartidos, operaciones,
Administración, Noticias, NodiaAI y Teacher. La ejecución final de controles
compartidos pasó con 37 pruebas en siete archivos. TypeScript y Vite pasaron
en `npm run build`. ESLint pasó con `--ignore-pattern .tmp/` para excluir
fixtures temporales previos.
