# QA de página y drawer AI-13

`npm run dev -- --port 5194 --mode nodia-ai-qa --host 127.0.0.1`

Abrir `http://127.0.0.1:5194/src/test/manual/nodia-ai/index.html?lang=es&theme=dark` en ese origen aislado. Usa la página, drawer, PageContent, theme, MemoryRouter, QueryClient y servicios Axios reales, con identidad y respuestas **sintéticas** exclusivamente en `fixtures.ts`. Este código no forma parte de la aplicación productiva y rechaza otros orígenes/puertos. No requiere una sesión real, API, base de datos ni proveedor. `lang=es|en`, `theme=light|dark`, `scenario=default|unknown|read-only|empty`.

El harness restaura una conversación sintética seleccionada desde MemoryRouter. Ninguna respuesta refleja disponibilidad, inferencia o datos reales. Las observaciones y modelos llevan identificadores de QA; el adaptador rechaza rutas inesperadas y no admite mensajes ni crea registros de negocio. `window.__nodiaAiQa` permite contar solicitudes, inyectar el siguiente error y refrescar consultas. El error se produce dentro del adaptador, sin tráfico HTTP al backend.

Con Chrome y el Playwright ya disponibles, ejecutar `node src/test/manual/nodia-ai/verify.mjs` desde Client. No instala navegadores. Comprueba 28 combinaciones:320/390/599/600/899/900/1440px × ES/EN × claro/oscuro. Evalúa padding único, scroll horizontal global/local, drawer único, switch opt-in y retorno de foco; después cambia anchos conservando selección, revisa el footer en390×650 y API deshabilitada, inyecta fallos recuperables en refetch/PATCH, preserva el borrador de mensaje, recarga sin POST y verifica el bloqueo ante `unknown`. En móvil exige un área de mensajes de al menos240px y verifica que el compositor es alcanzable mediante scroll natural del documento; la altura total puede superar el viewport de forma intencional. Guarda el JSON de resultados y tres capturas —página320, drawer320 y página1440— en `docs/evidence/nodia-ai-ai13-browser-*`.

La evidencia acredita interacción en Chromium con viewport redimensionado y transporte sintético. No acredita el shell autenticado completo, autorización backend, persistencia SQL, inferencia Gemini, teléfono físico, teclado virtual ni otros motores. Guards y ruta se comprueban por separado en `src/test/routes/NodiaAIRoute.test.tsx`; integración real del worker y proveedor conserva su evidencia de AI-11/12.

## Propuestas AI-17

`?scenario=proposal&lang=es&theme=dark` contiene un evento `proposal_ready` exclusivamente sintético. **Ver propuesta** consulta por intención la revisión y hash exactos mediante GET; no habilita confirmación, edición ni ejecución. Se muestran ausencia/null/false/cero/texto vacío y colecciones ordenadas, con un importe de prueba que excede la precisión segura de Number mantenido como string. `failNext("proposal")` junto con `refetch("proposal")` permite verificar un error de lectura sin perder el borrador de mensaje. Datos y eventos de este escenario son fixtures; no publican preparadores MCP ni acreditan creación de una propuesta con un proveedor real.

`?scenario=clarification` restaura un turno sintético `waiting_for_user`: el compositor queda disponible para un mensaje nuevo y no reenvía el anterior al montar la página. Este adaptador no implementa admisiones POST; el envío y su nueva identidad se comprueban en la prueba de componente con transporte sintético dedicado. `queued`, `running`, `cancel_requested` y `unknown` conservan sus bloqueos.

## Observación AI-16

`?scenario=observation&lang=es&theme=dark` representa un turno terminado con una consulta sintética. El feed GET contiene sólo una referencia durable; **Ver resultado de consulta** recupera su metadata al pulsarlo. Permite comprobar fuente, fecha, ceros reales, aviso de resultado histórico y destino autorizado, sin descargar resultados completos ni efectuar POST. Cambiar ancho no debe perder el borrador del siguiente turno ni mover su foco por revalidar eventos. Los datos de ese escenario también son sintéticos; el enlace demuestra la composición de la URL, no la existencia de ese negocio.

## AI-18 — canal humano (datos sintéticos)

`?scenario=confirmation` muestra los cinco campos financieros registrados y el botón de confirmación deshabilitado por falta de ejecutor, igual que el gate de producción de AI-18. `?scenario=confirmation-ready` simula únicamente para QA una disponibilidad positiva y admisión queued; no ejecuta efectos ni consume Gemini. Ambos conservan las rutas y la identidad exacta de revisión del contrato.

Desde los controles de la fixture: `failNext("proposal-edit")` rechaza el siguiente PATCH sin perder el editor; `failNext("confirmation-response-lost")` admite la confirmación sintética y pierde la respuesta. La recuperación humana consulta propuesta y operación sin otro POST. Los controles registran sólo método y path, nunca el desafío. La fixture mantiene su restricción al origen aislado `127.0.0.1:5194`.


## AI-22 — Negocios (datos sintéticos)

`business-product` muestra un producto con cero, precio negativo válido por contrato nativo, actividad falsa, registro histórico automático y traslado de negocio; el editor conserva el número como borrador de texto y envía un entero numérico al guardar. `business-contact` muestra el reemplazo completo de contacto con teléfonos vacíos, correo/descripción nulos y horario vacío. `business-invoice` muestra total cero y ausencia de archivo. `business-receipt` representa un recibo histórico de producto completado, con enlace al módulo y sin afirmar que el registro siga existiendo. Se combinan con `lang=es|en` y `theme=dark|light` en el mismo origen aislado5194. No acreditan escrituras, archivos R2 ni Gemini reales.

## AI-23 — conjuntos dependientes (datos sintéticos)

`?scenario=workflow` presenta crear proveedor y después su contacto, con referencia futura `provider_id ← paso1.id`, sin inventar un ID en la vista previa. El editor agrupa los dos campos Nombre por paso; sus identidades no dependen del orden de metadatos. Un PATCH sintético crea nueva revisión/hash y remapea conjuntamente IDs, dependencias y bindings. `failNext("proposal-edit")` conserva ambos borradores y el editor ante rechazo. Confirmación queda deshabilitada en esta fixture para no confundir la revisión de interfaz con un ejecutor real.

`?scenario=workflow-partial` muestra proveedor comprometido y contacto fallido. **Reanudar la operación confirmada** hace un único POST sintético sobre la misma ejecución; el adaptador conserva el primer recibo y completa sólo el segundo. **Actualizar estado** sólo usa GET. La vista explica que detener/cancelar no compensa pasos completados y ofrece enlaces históricos a Negocios. Los estados son ejemplos de protocolo; no prueban transacciones, autoridad SQL ni Gemini/MCP reales. Se verifican con ES/EN, claro/oscuro y viewport móvil/escritorio en el mismo origen aislado5194.

## AI-24 — configuración de Reservas (datos sintéticos)

`?scenario=rental-policy` muestra una política con dos reglas: umbrales0/7 y porcentajes0.00/50.00. El editor expone filas de días y porcentaje, con controles agregar/quitar, validación antes del PATCH y claves estables al cambiar ancho. `failNext("proposal-edit")` produce un error recuperable sin perder filas ni borradores; una edición satisfactoria produce nueva revisión/hash y requiere revisar nuevamente. Esta fixture no habilita confirmación ni llama al backend.

`?scenario=rental-receipt` muestra un recibo histórico de política completada con ID bigint sintético y enlace a la ruta registrada `/tools/reservations`. Ambos escenarios admiten ES/EN y claro/oscuro en5194; no acreditan persistencia, autorización SQL, disponibilidad de un alojamiento, inferencia Gemini ni preparación por MCP.

## AI-25: reservas y cancelación

`?scenario=reservation-create` muestra un borrador de estadía, contacto sintético, fechas/horarios propios, zona America/Santiago e importes enteros como strings más allá del entero seguro JavaScript. El editor secundario usa DateInput y TimeInput; cambiar un día inválido impide el PATCH y conserva el borrador. No se registra pago ni se afirma disponibilidad.

`?scenario=reservation-cancel` separa status/cálculo readonly de cancelación, devolución aprobada, retenido y pendientes; el editor temporal usa la zona recibida del servidor sintético. Cambiar una resolución no modifica un instante sin editar. `failNext("proposal-edit")` conserva el editor ante el error; guardar produce revisión/hash nuevos y obliga revisar antes de confirmar. La fixture no ejecuta un writer.

`?scenario=reservation-receipt&lang=en` muestra un recibo histórico de reserva con ID bigint exacto y enlace `/tools/reservations`. Los tres escenarios son browser-only, admiten ES/EN y tema claro/oscuro y no importan datos productivos ni habilitan escrituras MCP/Gemini. Las capturas son evidencia de interfaz sintética, no SQL, casa disponible o dinero efectivamente devuelto.

## AI-26: dinero, bloqueos y preparación

Escenarios `rental-payment`, `rental-refund`, `rental-money-void`, `rental-expense`, `rental-expense-pay`, `rental-block`, `rental-preparation` y `rental-approval`: montos CLP exactos, cobro/devolución efectiva y anulación separados, pago del gasto existente, instantes de bloqueo con zona de la casa y ropa con tres estados (sin especificar/no disponible/disponible). La hora prevista y la aprobación del mismo día no se presentan como preparación realizada. `failNext("proposal-edit")` rechaza el PATCH sintético y conserva controles/borrador; guardar sin fallo genera nueva revisión/hash. No realiza efectos ni confirma como usuario real.

Escenarios `rental-money-receipt`, `rental-expense-receipt`, `rental-block-receipt` y `rental-preparation-receipt` muestran recibos históricos por cada recurso con ID9007199254740996 y enlace `/tools/reservations`. ES/EN y claro/oscuro; sólo origen aislado5194. No prueban SQL, permisos del backend, transferencia externa, Gemini ni MCP publicado.

## AI-27: administración Core

`core-user` muestra colecciones finales de roles/módulos, detalles resueltos y pérdida de acceso readonly; corregir usa SelectMultipleInput y alta explícita de ID bigint string. `core-role` permite revisar ES/EN mediante TranslationInput por fila sin JSON libre. `core-delete` muestra advertencia y usuarios/asociaciones afectados; `core-receipt&lang=en` conserva ID9007199254740996 y enlace `/settings/users`.

Guardar genera revisión/hash nuevos; `failNext("proposal-edit")` prueba rechazo con borrador y foco conservados. Sólo origen5194, textos y registros sintéticos; no consulta catálogos, autoriza HTTP, modifica permisos reales o publica herramientas MCP/Gemini.


## AI-28: configuración IA no secreta

`ai-provider` muestra conexión y catálogo con IDs string exactos, default_mode null, modelo Web configurado y Agentic sin asignar, disponibilidad desconocida y preferencias de intensidad resultantes. El editor reutiliza texto por modo y enum nullable; null explícito limpia sólo el path editado. `failNext("proposal-edit")` conserva borrador/foco tras error, y guardar genera otra revisión/hash sintéticos. La confirmación permanece deshabilitada en este escenario.

`ai-provider-receipt&lang=en` conserva recibo histórico de conexión y enlace `/settings/ai-providers?provider=9007199254740996`. Invalidar catálogo/estado no cambia la selección del chat. Ambos usan exclusivamente5194 con ES/EN y tema claro/oscuro; no acceden a cuentas, secretos, base de datos o inferencia, ni prueban soporte del modelo.


## AI-29 — canal humano seguro

`secure-key` monta una ejecución ya confirmada y pausada, con target bigint exacto. Abrir canal seguro carga el formulario local; guardar usa exclusivamente el adaptador sintético y devuelve un recibo UUID. `secure-key-error` rechaza el primer POST con422 sin cerrar la modal ni borrar su input; el siguiente envío explícito completa la fixture. Ninguna entrada se envía a un backend/proveedor o se persiste fuera de la memoria transitoria de la página.

`secure-login` muestra el login Gemini Agentic con enlace oficial sintético; `secure-codex` muestra el código de dispositivo SYNTH-123 y URL oficial. No completar autorizaciones reales desde fixtures. `secure-delete`, `secure-sync` y `secure-logout` representan sus acciones humanas correspondientes; no acreditan efectos remotos ni login de una cuenta real. El descriptor y las interacciones se mantienen fuera de QueryCache/MutationCache; el harness de ejecución sí contiene estado público no secreto. Todos los escenarios requieren el origen aislado5194 y admiten ES/EN/claro/oscuro/móvil.
