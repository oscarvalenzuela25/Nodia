# Nodia CV — Generación y revisión en navegador

Fecha 2026-11-24, America/Santiago. Rama `codex/nodia-cv`, base `50bb9ec4`, candidatos compilados con los cambios locales de CV-04. [Plan 113, CV-04](../mvp/113-nodia-cv-implementation-plan.md#cv-04--preparar-generar-y-revisar-en-client).

## Inferencia real en VM

Una ejecución normal de Nodia CV iniciada en Microsoft Edge por Playwright recorrió el Client compilado, la sesión sintética, la autorización de módulos, el HTTP de Nest, la cola y el worker de CV, PostgreSQL aislado y la API externa de OpenAI. El navegador seleccionó la conexión `1` del catálogo `2`, modo `api_key`, modelo configurado `gpt-6.1-terra` y esfuerzo `medium`. El servicio de credenciales estándar resolvió la clave configurada dentro del proceso de la VM. El acceso de ese proceso a la base de configuración fue de sólo lectura.

La base aislada contenía una única calificación sintética previa de esa selección exacta para poder iniciar el recorrido normal de Client. La admisión y la inferencia posteriores correspondieron a una operación regular de CV, separada de esa calificación. [Canario real de calificación de CV-03](nodia-cv-api-key-vm-20261124.md).

| Dato comprobado | Observación |
| --- | --- |
| Navegador | Edge Chromium, 1440 × 1024, interfaz y CV en inglés, tema oscuro |
| Admisión y resultado | `POST /api/v1/nodia-cv/generations` devolvió `202`. La consulta de estado llevó a `Preview available`. Operación `47f9bbfa-d7b0-43c1-b0b3-8cdb5a36a7d0` en estado `ready`, revisión 1 |
| Tiempo | 5656 ms desde el clic hasta completar la comprobación y captura del navegador. 4010 ms entre la creación y la actualización terminal de la generación en PostgreSQL. Ambas mediciones incluyen trabajo de la aplicación |
| Borrador | Unicode visible en el nombre sintético. Dos requisitos, un hecho seleccionado, un requisito obligatorio de TypeScript respaldado por el perfil y un requisito deseable de Kubernetes sin evidencia |
| Ledger | Un canario de calificación sintética y una operación regular. La operación regular reservó e inició un intercambio real. Dueño `cv`, fase `closed`, resultado `completed`, cierre local `same_executor_return`, ACK registrado y slot `free`. Cero operaciones pendientes de ACK |
| Integridad | Los hashes de petición y respuesta coinciden con la prueba terminal. SHA-256 de la respuesta `c52219068ed445d80da4cf82192060e4963ffbdf16311350e62959edabc5b920` |

El recibo SQL de sólo lectura se tomó sobre la base aislada. Su SHA-256 es `3fb0438996e9ebb65e198e1a76789adb9c315562e28b9e6a170452391826b8c0`. La evidencia conserva resultados, recuentos y hashes. Las credenciales y la respuesta completa quedaron en la VM. El perfil y la oferta del canario fueron sintéticos.

## Regresión local en navegador

El entorno local ejecutó el Client compilado, los guardas y módulos compilados de Nest, el worker de CV y PostgreSQL 16.15. El harness sustituyó el proveedor por respuestas deterministas y Redis por un caché en memoria. El contador de envíos API reales quedó en cero. El acceso anónimo a perfiles devolvió `401`. La sesión autorizada obtuvo el contexto, el catálogo y la elegibilidad exacta a través del HTTP real.

| Prueba | Observación |
| --- | --- |
| Español, tema claro, escritorio | A 1.440 px se seleccionaron perfil, idioma y configuración. Un `POST` `202` y consultas del recibo produjeron un borrador con evidencia para TypeScript y una brecha de Kubernetes. Ancho de página y de contenido de 1.440 px |
| Edición y error HTTP | Playwright devolvió `503` a un `PUT` exacto de revisión. El diálogo retuvo fuente y aporte. Tras retirar la intercepción, el `PUT` real devolvió `200`, guardó la revisión 2 y actualizó el borrador con el aporte confirmado. El ledger de IA quedó igual. El aviso global del `503` todavía figuró en la captura posterior al reintento |
| Cambio de contexto | Cambiar la oferta marcó el borrador anterior y deshabilitó su revisión. Una generación lenta de un perfil conservó la identidad de ese perfil cuando llegó después de seleccionar otro. La oferta siguió visible y el resultado anterior no quedó editable en el contexto nuevo |
| Validación de salida | Una referencia inventada en la respuesta del proveedor simulado produjo fallo de validación real en Server. El formulario conservó la entrada |
| Resultado remoto incierto | La pérdida de respuesta del proveedor simulado guardó `unknown` y deshabilitó el envío de la misma intención. En otro caso, Playwright dejó llegar el `POST` real a Nest y cortó su respuesta `202` hacia el navegador. `Consultar recibo` recuperó el mismo ID mediante `GET`; hubo un único `POST` y un intercambio sintético para esa intención |
| Inglés, tema oscuro, 320 px | Ancho visible y ancho de documento de 320 px. Disparador de IA de 44 px abierto con `Enter`. La lista de modos, ya animada, ocupó x=44 a x=304 y 260 px de ancho. Agentic mostró su estado no disponible y dejó deshabilitado `Apply`; cero despachos Agentic. El cambio de pestaña y tamaño conservó la oferta |
| Idiomas independientes | En el artefacto con la corrección de idioma, `html` quedó en `en` y la vista previa quedó en `es`. Tras un `PUT` de revisión `200` sin inferencia adicional, el documento mostró el encabezado «Aportes confirmados» con la interfaz en inglés y el ancho de documento de 320 px |
| Español, tema claro, 320 px | Cuenta sin perfiles. Ancho visible y de documento de 320 px, `lang=es`, selector de perfil y generación deshabilitados. Abrir y cancelar el alta de perfil conservó la oferta ingresada |
| Contraste de Generar borrador | Se midieron texto y fondo en Edge a 1.440 px tras las transiciones, en el tema Nodia. Claro 6,29:1 en reposo y 9,93:1 bajo el puntero. Oscuro 7,04:1 en reposo y 6,29:1 bajo el puntero. Sin disparar generación. Artefacto `NodiaCv-Diosoyf3.js`, SHA-256 `0cbca633f7d80ff945215a9420f057c5ce5284646b1958c25fb9a1a04456741e`, captura `cv04-dark-hover-contrast.png` |

## Recuperación tras recarga

En Edge a 1.440 px, interfaz ES y tema claro, se generó un borrador local con un `POST` `202` y un intercambio sintético. Se deshabilitó la caché de red de Chromium y se recargó la misma pestaña. La entrada de CV en `sessionStorage` contenía únicamente `owner` y `requestKey` con el UUID de la solicitud. La oferta, el cargo y la empresa reaparecieron tras pulsar «Recuperar oferta y borrador». Un único `GET` `200` con `Cache-Control: private, no-store` devolvió la generación `37b999c1-f0ae-4430-aeaa-ba082ab86fc5` y el snapshot del perfil. Se recuperaron el perfil guardado, la oferta completa y el borrador revisable. Hubo cero nuevos despachos tras la recarga y cero llamadas externas.

La prueba usó `reload-recovery.mjs` y el chunk `NodiaCv-Bg2yRWww.js`, SHA-256 `3163ba84fd1a7f30fb65f86dfdd70d8b264f75e768bde5d61d6bf8cfba1de6d7`. Se reinició sólo el harness local con el Server que proyecta el snapshot por clave y se reutilizó la misma base de prueba. Captura `cv04-reload-recovered-es-light.png`.

Se repitió la recuperación con el artefacto final `NodiaCv-Diosoyf3.js` y se adelantó el reloj del navegador más allá de `expires_at` en `preview-expiry.mjs`. La vista retiró el contenido privado y su acción de revisión, mostró el vencimiento y mantuvo la oferta editable. Hubo un `POST` inicial, un `GET` de recuperación y cero llamadas externas. La prueba del reloj valida el comportamiento del navegador.

## Revisión concurrente del borrador

Dos contextos de Edge con sesiones independientes de la misma cuenta editaron el borrador recuperado. La sesión A abrió la revisión 5 y modificó la fuente de Kubernetes. La sesión B guardó evidencia adicional de TypeScript en la revisión 6. El `PUT` de A devolvió `409`, mantuvo sus campos y deshabilitó la confirmación hasta consultar la revisión actual. Tras el `GET` `200`, A guardó mediante `PUT` `200` la revisión 7 con ambas declaraciones. La operación conservó la evidencia del otro requisito y generó cero intercambios. Captura `cv04-review-rebased-independent-es-light.png`.

El primer artefacto trató la fuente y el detalle como un par y mantuvo el detalle anterior al consultar una revisión concurrente. Se corrigió y repitió el caso en `NodiaCv-cWeRlSXc.js`, SHA-256 `5e47c9f2aca47fa673ce7b196b74ae65ea7ee6298d87026fe6cdcb72ab7a8f6e`.

En ese artefacto final, A abrió la revisión 8 y editó la fuente de Kubernetes. B cambió el detalle del mismo requisito y añadió una declaración independiente en TypeScript hasta llegar a la revisión 10. El `PUT` de A devolvió `409`. El `GET` de revisión coincidió con la revisión 10 de B. El diálogo mantuvo la fuente de A, incorporó el detalle de B y pidió comprobar ambos antes de confirmar. El `PUT` `200` guardó la revisión 11 con las dos declaraciones. Un `GET` desde la segunda sesión recuperó la revisión exacta persistida. Hubo cero intercambios. El caso se reproduce con `review-rebase-final.mjs`. Capturas `cv04-review-rebase-confirmation-es-light.png` y `cv04-review-rebased-es-light.png`.

## Entorno y capturas

- La prueba local usó WSL y la remota usó la VM de desarrollo `nodia-vps-lab`. Cada base aislada recibió 76 migraciones de Server, incluida la de revisión `179399`. Las instancias de navegador usaron `http://127.0.0.1:5178/nodia-cv` en local y `http://127.0.0.1:5179/nodia-cv` mediante túnel SSH con verificación estricta de host para la VM. Las rutas de bootstrap y prueba pertenecen al harness aislado.
- SHA-256 del paquete compilado de Server `bd000db1143c48c36a639bc741d28caa2d24700938927fc2342ebf95bfe15d3a`. SHA-256 del paquete Client desplegado en la zona de verificación de la VM `e3a0d582db240dcae040eabb6bc84bcb1b9d6bd2b84316e3cb873be52101eae2`. Su chunk CV `NodiaCv-TnxHlO36.js` tiene SHA-256 `90f0b04b218dfed0f06cc8cbe5cdf2dff3b22c3257b5fa7b6e8c3b6f4802b739`. El ajuste posterior de idioma se verificó localmente con `NodiaCv-DkJp48V9.js`, SHA-256 `db2c229f50b973a4ed2d863922f08437e43c96e34707e2726011f98249594f21`, sin una segunda inferencia externa.
- Playwright CLI local conserva `baseline.mjs`, `scenarios.mjs`, `lang-retest.mjs`, `lang-finish.mjs`, `empty-finish.mjs` y `vm-real.mjs` bajo `.tmp/nodia-cv04-lab/`. La prueba de VM tiene un preflight que exige contador normal cero. `readback-vm.sql` consulta el recibo de forma independiente y de sólo lectura. El release activo y las unidades normales de la VM quedaron fuera de la ejecución.
- Las capturas están en `.tmp/nodia-cv04-lab/` y fuera de Git. `cv04-desktop-es-light-selector.png` muestra el selector, `cv04-mobile-en-dark-agentic.png` el estado no disponible a 320 px, `cv04-mobile-en-dark-spanish-draft.png` los dos idiomas, `cv04-mobile-es-light-empty.png` el estado vacío, `cv04-review-en-dark-clean.png` una revisión confirmada, `cv04-review-es-light.png` la recuperación tras el `503` y `cv04-live-vm-desktop-en-dark.png` la generación real en la VM.

El proceso de prueba de CV-04 de la VM y su túnel se cerraron tras verificar el recibo. PostgreSQL aislado, la VM y el mismo conjunto de servicios activos de Nodia quedaron disponibles. El recibo de cierre tiene SHA-256 `2480398fa4d62ddf1a0a9c98068d97f744216a3221723ae41226aefeb0277086`.

El alcance de inferencia real es una selección concreta de API key y una oferta sintética en el laboratorio. Quedan pendientes el transporte Agentic de CV, otros proveedores y modelos, la matriz de dispositivo físico, la promoción y las pruebas de PDF y ATS de CV-05 y CV-06.
