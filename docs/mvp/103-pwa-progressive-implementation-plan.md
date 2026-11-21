# PWA de Nodia — plan de implementación por entregas

> Estado vigente al 2026-11-21. PWA-001 cerrado por alcance con aceptación humana de funcionamiento (§15), tras implementación y verificación HTTPS (§12). PWA-002, PWA-003, PWA-005 y el punto de lectura de PWA-006 implementados como candidatos locales (§4, §5, §7 y §8). PWA-004 sigue su entrega independiente (§6). §11 y §14 conservan sus cortes históricos. Ver [TODO](TODO.md).
> Fecha: 2026-11-13. Rama de planificación: `codex/plan-pwa-installation`, desde `development`.
> Rama histórica de implementación local: `codex/pwa-001-installation`, desde development/origin en `a780099b456b9cb930865543d836e61147cc4190`. Opción gráfica1 seleccionada. La publicación posterior se registra en§12; no repetir esa operación al retomar el QA de instalación.
> Fuentes: [Client08](08-stack-frontend.md), [auth14](14-authentication.md), [privacidad89](89-module-access-and-user-data-scope.md), [rutas ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md), [rendimiento37](37-web-performance-implementation-plan.md), [producción99](99-production-deployment-and-cicd-plan.md) y [diseño Client](../../nodia-client/DESIGN.md).

## 1. Objetivo y orden de entrega

La primera entrega permite **instalar Nodia, reconocer su icono y abrirla en una
ventana propia, utilizando las mismas funciones online actuales**. Es un ítem
vertical completo: se desarrolla, prueba, revisa y despliega por separado. Su
cierre no depende de caché offline, avisos de actualización, push o sincronización.

| Orden / ítem | Resultado entregable | Dependencia | Prioridad / estimación inicial |
| --- | --- | --- | --- |
| **PWA-001** | **Instalación, iconos y ventana propia; funciones online** | App actual publicada por HTTPS | **Primera entrega obligatoria; 1–2 días de trabajo** |
| PWA-002 | Service worker con caché estática acotada y actualización controlada | PWA-001 y registro raíz compartido | Candidato local (§4) |
| PWA-003 | Experiencia clara ante desconexión y recuperación online | PWA-002 para pantalla disponible sin red | Candidato local (§5) |
| PWA-004 | Notificaciones push de eventos definidos | Contrato de eventos y worker navegador; independiente de offline de datos | Planificado; 2–5 días adicionales |
| PWA-005 | Lectura offline de material de estudio de Teacher | PWA-002/003 y política de privacidad/persistencia | Publicado y verificado en Chrome para Windows (§8.3) |
| PWA-006 | Punto de lectura de Teacher sin conexión y sincronización | PWA-005, recibo y revisión del cursor de Teacher | Piloto HTTPS local verificado en Chrome para Windows con Server y PostgreSQL. Origen publicado pendiente |

Son estimaciones para una persona dedicada, sujetas a QA y disponibilidad de
dispositivos; no son fechas comprometidas. El rango anterior de3–5 días para la
base robusta corresponde aproximadamente a PWA-001/002/003 juntos, no al primer
ítem aislado. Los ítems posteriores permanecen en planificación y no se ejecutan
como parte de PWA-001. Push no exige habilitar escrituras offline.

## 2. Punto de partida comprobado y límites

- El checkout usa React/Vite/TypeScript. [vite.config.ts](../../nodia-client/vite.config.ts) no registra un plugin PWA; [index.html](../../nodia-client/index.html) referencia favicon y no manifiesto. No se encontró registro propio de service worker en la revisión inicial.
- Existe identidad gráfica; revisar sus originales y resolución antes de exportar iconos. La presencia de un favicon no acredita un icono512 válido ni calidad al instalar.
- El frontend acordado es `https://nodia-1ge.pages.dev/`; la API usa configuración pública independiente. Confirmar origen canónico, HTTPS y recursos efectivos durante el desarrollo, sin incorporar credenciales al manifiesto.
- La entrega usa [artefactos CI](../../ops/ci/artifact-release.mjs) y [CD Pages](../../ops/ci/cd-pages.mjs). Se debe verificar el artefacto y después la respuesta publicada, sin reconstruir en CD.
- El acceso sigue perteneciendo a sesión/actor/módulos y al backend. La instalación no concede módulos, extiende sesiones ni habilita proveedores IA.
- El service worker del navegador y el worker del VPS son componentes distintos. Instalar una PWA no mantiene JavaScript ejecutándose24h en el teléfono.

## 3. PWA-001 — instalación online independiente y desarrollable

### 3.1 Historia y resultado visible

**Como usuario de Nodia, quiero instalarla desde mi navegador y abrirla mediante
su icono en una ventana propia para usar las mismas funciones online sin buscar
la pestaña del navegador.**

La entrega termina con un PR propio y un artefacto publicable. Una persona debe
poder instalar, cerrar, volver a abrir, iniciar sesión y navegar con sus permisos
actuales. Otro dispositivo puede seguir utilizando la web sin instalarla.

### 3.2 Alcance cerrado

Incluye manifiesto, iconos, metadatos HTML, instalación mediante la interfaz del
navegador, `display: standalone`, comprobación de rutas/auth y validación mínima
de empaquetado/publicación. El nombre propuesto es `Nodia`; se reutilizan la marca
y el theme actuales. Las instrucciones distinguen plataforma/navegador.

No incluye service worker, `vite-plugin-pwa`, caché persistente nueva, un botón
propio de instalación, funcionamiento offline, notificaciones, tiendas de apps,
rediseño general ni cambios funcionales de API/BD/Redis. La desconexión conserva
el comportamiento online actual; no se promete abrir la aplicación sin internet.

La guía MDN confirma que un service worker no es requisito general de
instalabilidad. Por eso se difiere a PWA-002: no hace falta introducir su ciclo de
actualización/caché para completar este ítem. Ver fuentes técnicas en§10.

### 3.3 Tareas, en orden

| ID | Trabajo concreto | Comprobación / salida |
| --- | --- | --- |
| 001.01 | Crear rama desde development actualizado; inventariar manifiestos/registro SW, favicon, rutas, auth y empaquetado existentes. Registrar la matriz de lanzamiento: Windows/Chrome y Edge, Android/Chrome; añadir iOS sólo cuando se pueda comprobar. | Base, plataformas anunciadas y archivos afectados identificados; cambios ajenos conservados. |
| 001.02 | Fijar identidad de instalación: `id` estable, `name`, `short_name`, `lang`, `start_url`, `scope`, `display`, colores del theme y ausencia de preferencia por app nativa. | Propuesta concreta: `id: /`, `start_url: /`, `scope: /`, `display: standalone`, `lang: es`; validar que `/` conserva la resolución de sesión/ruta actual. |
| 001.03 | Exportar desde la marca existente PNG192 y512; variantes maskable adecuadas y apple-touch-icon180. Revisar contraste, márgenes seguros, resolución real y recorte. | Archivos propios con dimensiones verificadas, sin rediseñar el logo ni ampliar un bitmap pequeño sin QA. |
| 001.04 | Añadir `public/manifest.webmanifest` con rutas relativas al mismo origen y referencias reales a los iconos; enlazarlo en index.html y añadir theme-color/apple-touch-icon. | Respuesta JSON válida y metadatos coherentes. Manifiesto público sin usuario, token, API privada o datos de negocio. |
| 001.05 | Comprobar instalación desde menú/barra del navegador y apertura standalone. Documentar el recorrido manual de iOS Safari. | No depende de que aparezca un banner automático ni de `beforeinstallprompt`. |
| 001.06 | Probar login/logout, renovación de sesión, rutas directas y autoridad desde la ventana instalada. | Mismos destinos canónicos y permisos; ninguna ruta funcional pública por estar instalada. |
| 001.07 | Verificar que el build y el paquete incluyen manifiesto/iconos y que Pages los sirve como archivos, con MIME correcto, sin devolver el HTML de la SPA. | Hashes/inventario del artefacto y respuesta publicada compatibles con el CD existente. Ajustar validación sólo donde falte esta garantía. |
| 001.08 | Ejecutar checks pertinentes y matriz mínima de§3.5; documentar instalación/desinstalación y límites online. | Resultados reales por plataforma/versión, sin declarar aceptado un dispositivo no probado. |
| 001.09 | Crear PR de PWA-001, integrar por el flujo development→master y verificar instalación en el origen final tras el deploy autorizado. | Entrega independiente aceptable; tareas PWA-002…006 permanecen abiertas. |

Solicitud visual del 2026-11-13: adaptar la N de la marca existente, conservando
turquesa, azul y violeta, con estilo simple y moderno para móvil y favicon. Se
prepararon cinco propuestas visuales para revisión: N esencial, N en círculo,
N con aro, N conectada y N bicolor. El usuario seleccionó **la opción 1, N
esencial**, y solicitó una rama desde development actualizado para implementar.
Se reconstruyó como SVG limpio y se exportaron favicon SVG/ICO/PNG, iconos
192/512, variantes maskable y Apple180; fuente y receta en
[branding](../../nodia-client/branding/README.md). La selección del icono no
aprueba el documento completo ni acredita instalación PWA. La comprobación
local y los pendientes se registran en §11.

Cambiar de dominio puede requerir otra instalación; un `id` estable no migra
identidad ni datos entre orígenes. Usar el origen Pages actual permite avanzar;
la futura compra de dominio no bloquea esta entrega. El manifiesto no debe fijar
un hostname de preview que termine identificando la instalación productiva.

### 3.4 Archivos y contratos previstos

| Área | Archivos previstos / existentes | Límite |
| --- | --- | --- |
| Instalación | `nodia-client/public/manifest.webmanifest` e iconos bajo `public/` | Nuevos archivos estáticos públicos. |
| HTML/estética de instalación | `nodia-client/index.html`, theme existente y fuente de marca | Metadatos; sin rehacer páginas. |
| QA/CI | Pruebas pequeñas bajo `nodia-client/src/test/` y validación existente de artefactos si corresponde | Manifiesto, referencias y dimensiones reales; no tests espejo de markup. |
| Publicación | `_headers` y empaquetado/CD actuales, sólo si la respuesta efectiva lo requiere | Preservar COOP del login y reglas de integridad; sin desactivar verificadores. |
| Documentación | Este plan, [ficha PWA](../nodia-ai/knowledge/general-settings/features/pwa-installation.md), índices y pasos de instalación | Estados reales; publicación de contexto IA separada. |

### 3.5 QA y criterios de aceptación completos

La matriz original siguiente conserva sus casillas como registro de evidencia
por criterio. El cierre funcional aceptado posteriormente en§15 no marca como
ejecutadas pruebas de dispositivo o compatibilidad sin recibo detallado; las
casillas históricas no reabren PWA-001 por sí solas.

- [ ] **AC01 — Artefacto:** manifiesto parseable, campos/URLs válidos, scope/start_url coherentes e iconos existentes con dimensiones declaradas reales; empaquetados y servidos por HTTPS con MIME correcto.
- [ ] **AC02 — Instalación escritorio:** Chrome y Edge en Windows permiten instalar Nodia desde sus controles; el sistema muestra nombre e icono correctos y abre una ventana standalone. No basta crear un acceso directo que abra una pestaña.
- [ ] **AC03 — Instalación móvil:** Chrome Android se prueba en un dispositivo compatible, con dispositivo/versión registrados. Si se anuncia soporte iOS en ese lanzamiento, también Safari iOS mediante Añadir a pantalla de inicio. La emulación responsive no acredita instalar una app en esos sistemas.
- [ ] **AC04 — Reapertura:** cerrar por completo y abrir desde el icono conserva el destino de entrada y resuelve correctamente sesión vigente o login, sin pantalla en blanco.
- [ ] **AC05 — Google/auth:** login, popup/retorno, cancelación/error de login, renovación y logout funcionan desde la ventana instalada; logout seguido de reapertura no expone la vista privada y cambiar cuenta no muestra datos del actor anterior. Conservar los contratos de COOP/cookies/CORS, sin suponer sesiones compartidas entre Safari y su instalación. Si un navegador exige un ajuste de auth para funcionar, ese ajuste acotado y su regresión pertenecen a PWA-001.
- [ ] **AC06 — Rutas y acceso:** recargar un destino privado mantiene la ruta canónica; sin sesión se aplica el guard habitual y sin módulo no se concede acceso. Comprobar al menos un usuario ordinario y super_admin con su política existente.
- [ ] **AC07 — Funciones online:** smoke del módulo accesible, carga de datos y apertura de archivos; comprobar un flujo ya disponible de Teacher/NodiaAI sin consumir inferencias ni ejecutar mutaciones de negocio por rutina. Login de proveedores no se confunde con disponibilidad de inferencia.
- [ ] **AC08 — Navegación externa:** autorización Google/proveedores y enlaces externos conservan su destino seguro; no se intenta introducir páginas de terceros dentro del scope del manifiesto.
- [ ] **AC09 — Límite online:** no aparece nueva caché Cache Storage de PWA, service worker ni cola de peticiones; la documentación explica la necesidad de red. Instalar no modifica el caché en memoria actual de TanStack ni promete eliminar datos preexistentes del navegador.
- [ ] **AC10 — Entrega:** lint, pruebas de valor afectadas y un build con TypeScript incluido; CI/CD verifica el mismo artefacto sin rebuild. TypeScript no se repite en tests o lint. Después se prueba la instalación publicada; un JSON local válido no acredita ese resultado.
- [ ] **AC11 — Compatibilidad:** checklist con fecha, navegador, versión, dispositivo y origen. Un entorno no disponible queda pendiente; no se anuncia como soportado por extrapolar una prueba de Chromium o un viewport móvil.
- [ ] **AC12 — Documentación/retirada:** instrucciones de instalación y desinstalación por plataforma; limitaciones registradas. La retirada de una versión vuelve por el procedimiento de release existente y no borra sesiones/almacenamiento del dispositivo.

Matriz de lanzamiento propuesta: Windows/Chrome y Edge, Android/Chrome.
iOS/Safari es objetivo adicional: se incluyen sus instrucciones y se prueba si
se dispone del dispositivo; mientras tanto queda explícitamente sin verificar,
sin anunciar soporte ni bloquear el lanzamiento de las plataformas comprobadas.
Las versiones efectivas se fijan al ensayar; el navegador decide su UI de
instalación. Safari macOS/Firefox y tiendas no forman parte del gate inicial.
Si falta un dispositivo de la matriz anunciada, registrar la limitación y no
marcar AC03/AC11 completos para él. Standalone no promete pantalla completa ni
ocultar controles propios del sistema operativo.

### 3.6 Definición de terminado y prueba de independencia

PWA-001 está terminado cuando AC01–AC12 estén satisfechos por alcance, el código
esté revisado e instalado en el origen acordado y una persona pueda abrir su
icono/ventana y usar las funciones online con sus permisos. Antes de ese despliegue
se distingue «implementado y probado localmente» de «operativo para usuarios».
El cierre solicitado y aceptado por el usuario el2026-11-16 se concilia en§15;
esa aceptación del alcance entregado no certifica cada plataforma de la matriz.

**Prueba de independencia:** el PR puede cerrarse con PWA-002…006 sin empezar,
sin instalar plugin PWA, crear contratos de sincronización o contratar servicios.
Si el PR incluye precache, push o persistencia offline, dividirlo antes de revisar.
Las correcciones indispensables de auth, rutas o empaquetado descubiertas por
AC01–AC12 sí pertenecen al mismo ítem; no se pospone una instalación rota.

## 4. PWA-002 — caché estática y actualizaciones controladas

Implementado como candidato local. Ver la [decisión de arquitectura propuesta](../architecture/decisions/ADR-112-pwa-controlled-release-updates.md).

- [x] Integrar metadatos en el build de Vite y usar un worker raíz compartido para actualizaciones y el futuro flujo de Web Push. La evaluación de Workbox se resolvió con el worker nativo y el generador de metadatos, con las dependencias vigentes del proyecto.
- [x] Acotar la caché a JavaScript, CSS y fuentes públicas con hash del artefacto, de hasta 2 MiB por archivo. Calentar sólo JavaScript y CSS de entrada y guardar el resto bajo demanda.
- [x] Aplicar la lista a lecturas GET de scripts, estilos y fuentes del mismo origen. Mantener navegación, API y autenticación sobre la red, con la autoridad habitual. Validar HTTP 200 y MIME del recurso antes de cachear.
- [x] Ofrecer «Actualizar ahora» y «Más tarde» en ES/EN. La versión se activa sin recargar las demás pestañas. Ediciones, formularios abiertos y mutaciones de la pestaña solicitante permiten abrir la versión nueva en otra pestaña.
- [x] Reservar `nodia-static-v1-<versión>` para recursos de Nodia y conservar la versión activa y dos cachés anteriores. Recuperar recursos antiguos ya consultados por su URL con hash. La falta de un módulo diferido antiguo conduce al estado de error con recuperación explícita.
- [x] Validar relación entre HTML, worker, recursos declarados y `/pwa-release.json` en el artefacto. Mantener `/service-worker.js` en el scope raíz y aplicar la configuración de producción en un contexto seguro.
- [x] Probar en Chromium dos publicaciones consecutivas, aplazamiento, aplicación con dos pestañas, un formulario real, recurso ausente y reversión local.
- [ ] Comparar arranque en el origen publicado según plan37 y verificar recuperación con los recursos y navegadores del despliegue.
- [ ] Verificar el rollback del release publicado, que mantiene el registro de push. La retirada completa del worker requiere un procedimiento que contemple la suscripción vinculada.
- [ ] Probar desconexión durante instalación, auth/permisos y reapertura en los entornos que se declaren soportados.

Aceptación: nueva versión ofrecida y aplicada sin perder borradores; API conserva
su autoridad online; recursos públicos anteriores/nuevos tienen recuperación
probada. Comparación de rendimiento y rollout/rollback documentados. Evaluar ADR
si la estrategia introduce garantías compartidas o alternativas costosas.

### Verificación local — 2026-11-21

Dos builds de producción de Client se sirvieron por turnos en un origen
seguro de loopback con Chrome 158.0.8127.36 y un API sintético. En una pestaña se abrió
el formulario real **Nuevo proveedor** y se editaron el nombre y el impuesto.
En la otra se aplazó la actualización y luego se aplicó. El primer cambio
de documento ocurrió sólo en la pestaña que lo pidió y conservó su ruta,
parámetros y fragmento. El formulario conservó el documento, ambos valores y
sus controles. Se guardó en una sola petición exitosa del fixture y después
esa pestaña aplicó la versión nueva y mostró el proveedor guardado.

Al devolver HTTP 404 para el script de entrada de la versión publicada, el
candidato falló la instalación y la versión activa siguió mostrando avisos.
Al restaurar el script, el candidato esperó la acción de la persona. Chrome
mantuvo el registro raíz y la suscripción FCM del perfil de prueba tras el
cambio de worker. Se inyectaron eventos push por Chrome DevTools antes,
durante la espera y después de la activación. El worker mostró el aviso y su
payload conservó el destino canónico. La entrega remota de extremo a extremo
pertenece a los ensayos de PWA-004 por plataforma.

El worker nuevo recuperó desde caché el script de entrada que había preparado
para la versión anterior, mientras el origen servía sólo la publicación actual.
La inspección encontró 136 entradas y todas correspondían a `/assets/`.
Al revertir el origen a la publicación anterior, la pestaña solicitante
volvió a esa versión con la misma URL y el proveedor guardado. La otra
pestaña siguió abierta en la versión posterior. La suscripción FCM se
conservó también durante la reversión. Se dio de baja la suscripción de
prueba, se retiró el registro del navegador aislado y se cerró el origen.

Pasaron el build con tipado, 39 regresiones de Client, 34 pruebas de
artefactos y publicación en Linux y la validación de conocimiento. El
artefacto validó 12 archivos públicos PWA, incluida la versión, y comprobó
que el cuerpo del worker coincide con la fuente. El candidato prepara dos
archivos de entrada que suman 558.536 bytes sin comprimir. El worker en el
ensayo ocupó 16.014 bytes sin comprimir y cerca de 5,7 kB con gzip. La
comparación de arranque en el origen publicado queda pendiente.

## 5. PWA-003 — desconexión y recuperación comprensibles

Implementado como candidato local. Ver la [decisión de arquitectura propuesta](../architecture/decisions/ADR-113-pwa-connection-recovery.md).

- [x] Ofrecer un aviso traducido de desconexión o problema con el servidor y un reintento en la vista y el modal. Conservar los formularios montados.
- [x] Usar el estado del navegador como señal de red y validar el liveness real de `GET /api/v1`. Tratar fallos sin respuesta como problemas de alcance cuando el navegador todavía indica conexión.
- [x] Revalidar la sesión cuando esté indisponible según el flujo vigente y reintentar lecturas GET activas que fallaron por conectividad. Los HTTP 401/403/404/410 conservan el manejo por sesión o módulo.
- [x] Impedir que una escritura intentada sin conexión quede en cola de TanStack Query. La recuperación conserva el borrador en memoria y requiere una acción explícita para guardar.
- [x] Servir una página estática de contingencia cuando falle el transporte de una navegación controlada. Ofrecer reintento en la misma URL y conservar las respuestas HTTP del origen. La primera visita requiere que el navegador pueda cargar el sitio para instalar el worker.
- [x] Probar en Chromium la desconexión real del navegador, el API con 503, el borrador preservado, un único guardado explícito y el arranque sin conexión.
- [ ] Comprobar disponibilidad, reconexión y alcance de autenticación en el origen publicado y las plataformas declaradas. Verificar los escenarios de expiración y cambio de cuenta de extremo a extremo.

Aceptación: el usuario entiende por qué no puede completar una acción y puede
recuperar la vista online sin perder su borrador. No se anuncian consultas o
escrituras offline de datos del negocio.

### Verificación local — 2026-11-21

Se reprodujo en el candidato anterior que **Guardar** sin conexión dejaba
una mutación en espera y la enviaba al reconectar. Con PWA-003, Chrome 158
mostró **Sin conexión a internet** al deshabilitar la red en un formulario
real de Proveedores. El intento de guardado dejó el formulario abierto.
Con el navegador en línea y el API de prueba en HTTP 503 se mostró
**Problema con el servidor**. El reintento exitoso mantuvo el documento, la
URL y los valores de nombre e impuesto. El servidor del fixture registró
cero envíos automáticos y un único `POST 201` después de pulsar **Guardar**.

Con el worker activo, una segunda pestaña abierta sin red recibió la página
estática de contingencia. Volvió a la ruta exacta, con sus parámetros y
fragmento, al pulsar **Reintentar** tras recuperar la conexión. Una
respuesta HTTP 503 de navegación del origen se conservó íntegra.

Con red activa, un HTTP 503 de la consulta de proveedores mostró el aviso de
servidor. Una comprobación con HTTP 200 y HTML inesperado mantuvo el aviso.
Con la respuesta válida, **Reintentar conexión** recuperó la consulta GET y la
tabla. El sondeo no envió un encabezado de autorización. Un HTTP 403 siguió
el tratamiento del módulo. En un viewport de 375 px, la acción de reintento
midió 44 px, fue alcanzable por teclado y el aviso conservó el foco en el
campo activo al desconectarse. El modal no tuvo desbordamiento horizontal.

Pasaron 114 pruebas dirigidas de Client, que incluyeron clasificación de
errores, concurrencia del reintento, guardado sin red, guardias de sesión y
el worker de push y navegación. El ensayo utilizó un API sintético y se
cerró el origen de prueba al terminar.

## 6. PWA-004 — notificaciones push

- [ ] Elegir eventos concretos y destinatarios autorizados, por ejemplo finalización de un trabajo ya existente. Definir retención, deduplicación y qué se considera entrega frente a lectura.
- [ ] Diseñar contrato backend de suscripciones por usuario/dispositivo, alta/baja idempotente, revocación y limpieza de endpoints expirados. Credenciales push sólo en servidor; una URL de suscripción tampoco pertenece a logs públicos.
- [ ] Pedir permiso tras acción explícita, manejar denegación/revocación y preferencias; no condicionar el uso de la app a aceptar notificaciones.
- [ ] Implementar envío por el flujo durable adecuado del backend, con límites/reintentos conocidos; no hacer del SW del teléfono un worker permanente.
- [ ] Payload mínimo sin datos sensibles de Teacher/ventas/finanzas/chat; al abrir, resolver sesión y autorización del destino canónico otra vez.
- [ ] Verificar soporte real por plataforma. En iOS comprobar requisitos de instalación/versión y permisos en dispositivo; dejar explícitos los entornos no soportados.
- [ ] Probar cuentas múltiples, logout, permisos retirados, suscripción obsoleta, repetición del evento y enlace sin sesión/módulo; observar fallos sin almacenar contenido privado.

Aceptación: sólo los destinatarios permitidos reciben el evento definido, con
activación y baja verificadas. No se promete entrega inmediata ni garantizada;
la aplicación mantiene su mecanismo de consulta de estado habitual.

## 7. PWA-005 — lectura offline por módulo

El 2026-11-21 el usuario eligió Teacher como primer módulo y pidió descargar
material de estudio, abrirlo sin conexión y asociarlo a la cuenta correcta.
El candidato local reutiliza la lectura autorizada del material vigente de
una lección. Su política se detalla en el [ADR114 propuesto](../architecture/decisions/ADR-114-teacher-offline-study-copies.md)
y en la [ficha de material sin conexión](../nodia-ai/knowledge/studies/features/offline-study-material.md).

- [x] Implementar descarga explícita de teoría, ejemplos y resúmenes de una unidad, con cancelación y confirmación tras guardar.
- [x] Mantener una copia de hasta 256 KiB por unidad y diez copias por concesión, por 24 horas. Etiquetarlas como copias descargadas y reemplazarlas desde Teacher en línea.
- [x] Cifrar la copia y vincularla a cuenta y sesión. Aplicar invalidación ante salida, sesión o cuenta nueva y revocación conocida. Ofrecer eliminación de una copia.
- [x] Validar la disponibilidad del lector público con el worker antes de confirmar. Abrirlo desde Descargas de Teacher o desde el aviso de arranque sin red.
- [x] Probar en Chrome la reapertura sin red, el cambio de cuenta en el mismo perfil, el acceso directo a la ruta anterior, el borrado y una revocación conocida.
- [ ] Verificar la entrega en un origen publicado y las plataformas declaradas, la recuperación tras purga del navegador y el comportamiento con cuota agotada en cada plataforma.

### Verificación local — 2026-11-21

Chrome 158 usó el Client compilado, una API de prueba y dos cuentas
sintéticas en el mismo perfil. A descargó una lección desde el Teacher real,
cerró la pestaña de la app y abrió el lector en una pestaña nueva sin red.
La copia mostró el texto de la unidad y su vigencia con cero peticiones al API
en esa apertura. Los registros locales mostraron cifrado AES-GCM con clave no
exportable y la caché del worker sólo contenía recursos públicos.

El cambio de cuenta retiró el contenido abierto para A. B tampoco recuperó
la copia al abrir directamente el enlace guardado de A. B pudo descargar y
eliminar su propio material. Una revocación conocida del API retiró el
contenido de otra pestaña y continuó bloqueándolo al volver sin red.
El ensayo se ejecutó en un perfil aislado de laboratorio.
Con el reloj de Chrome controlado, la copia seguía abriendo tras 23 horas
sin red con la misma sesión local. Al superar 24 horas dejó de abrir.

Pasaron el build con tipado, 394 pruebas de Client, 35 pruebas de artefactos
en Linux y la validación de las fichas candidatas. La comprobación del build
validó los 13 recursos PWA y el cuerpo del worker. El servidor y el navegador
del ensayo se cerraron al terminar.

## 8. PWA-006 — escrituras offline y sincronización

La primera operación admitida es **Guardar punto de lectura** en los bloques
descargados de Teacher. Se almacena una intención cifrada por estudio bajo
la cuenta, sesión y vigencia de la copia (§7). Las copias anteriores mantienen
la lectura. Volver a descargar incorpora la revisión para guardar el punto.
El alcance cubre la posición de lectura. La práctica, las evaluaciones y
otras escrituras requieren sus propios contratos.

- [x] Reconciliar cada envío por UUID y revisión de cursor. Si se pierde la
  respuesta, consultar el recibo antes de repetir el mismo comando.
- [x] Validar acceso a Teacher, ownership y versión de plan/material en
  Server. Persistir el cursor y el recibo juntos, sin migración de base de datos.
- [x] Mostrar el punto pendiente, el envío incierto, la confirmación, el
  rechazo o el conflicto. Permitir reintentar y descartar un punto sin enviar.
- [x] Al volver la red, reanudar con Teacher o el lector abiertos y la sesión
  vigente. Si otro dispositivo guardó el mismo punto, usar la revisión actual.
  Con puntos distintos, mostrar ambos y permitir **Usar este punto** o
  **Conservar el del servidor**. La primera elección vuelve a comprobar la
  revisión mostrada y la segunda descarta el pendiente sin escribir.
- [x] Verificar el piloto HTTPS local en Windows con Server y PostgreSQL.
- [ ] Verificar el candidato en un origen publicado y en dispositivos físicos distintos.

### 8.1. Verificación local — 2026-11-21

- Server compilado y PostgreSQL 16 aislado, con dos sesiones autenticadas.
  Dos comandos concurrentes sobre la misma revisión devolvieron HTTP 200 y
  409. La consulta del recibo y la repetición exacta devolvieron el primer
  resultado, con un solo avance del cursor y del conjunto de bloques visitados.
  Reutilizar el UUID con contenido distinto se rechazó. La elección explícita
  avanzó una vez desde la revisión vigente. Se comprobó la protección por
  permisos, ownership, material obsoleto, evaluación activa y alcance del
  endpoint limitado a bloques de lectura.
  [Integración de dominio](../../nodia-server/test/teacher-domain.integration.mjs).
- Build de Client en Chrome 158 para Windows, dos perfiles aislados con
  la misma cuenta de prueba y sesiones distintas, sobre un API HTTP simulado.
  Cada perfil guardó sin red y recuperó su punto al reabrir el lector. Una
  respuesta truncada después de confirmar se recuperó por recibo, con un
  solo PATCH confirmado. Una interrupción anterior a las cabeceras permitió
  comprobar también el reenvío con el mismo UUID. Se verificaron ambas
  elecciones de conflicto y el aislamiento al cambiar de cuenta. Borrar la
  copia con un punto pendiente y volver a descargar la misma lección no
  reactivó la intención ni generó una petición de recibo o escritura.
- El contrato y las decisiones se registran en el [ADR115 propuesto](../architecture/decisions/ADR-115-teacher-offline-reading-sync.md)
  y la [ficha de avance sin conexión](../nodia-ai/knowledge/studies/features/offline-reading-progress.md).

### 8.2. Piloto HTTPS en Windows — 2026-11-21

Se probó el build de Client en dos perfiles temporales de Chrome 158 en el
mismo PC, con TLS 1.3 en loopback y un certificado limitado a esos perfiles.
La misma cuenta sintética usó dos sesiones distintas. El API de Teacher
ejecutó el controlador, los casos de uso y los recibos reales de Server
sobre PostgreSQL 16 descartable. La revisión automática bloqueó la apertura
del túnel público. La verificación de un origen publicado queda pendiente.

1. Ambos perfiles descargaron **Cómo funciona DNS** con el cursor en
   revisión 3. Se cortó la red en cada perfil. Se guardó **Teoría de DNS**
   en A y **Ejemplo de resolución** en B. Al cerrar y reabrir el lector sin
   red, ambos conservaron su selección. El cursor en PostgreSQL seguía en 3.
2. Al reconectar A, Server confirmó el punto de teoría con HTTP 200 y
   revisión 4. B recibió HTTP 409 al reconectar y vio los dos puntos con
   sus opciones. Server conservó teoría hasta que B pulsó **Usar este
   punto**. Se confirmó el ejemplo con HTTP 200 y revisión 5.
3. A guardó el resumen sin red desde revisión 4 y obtuvo otro conflicto.
   **Conservar el del servidor** mantuvo el ejemplo en revisión 5. La
   elección produjo cero PATCH y siguió aplicada tras recargar el lector.
4. Se consultó el recibo de B y se repitió su último PATCH con el mismo
   identificador y cuerpo. Se recuperó el mismo resultado HTTP 200. En
   PostgreSQL quedaron dos recibos y dos bloques visitados, una vez cada uno.

### 8.3. Publicación HTTPS — 2026-11-21

PWA-005/006 y la base de actualización y reconexión se integraron por los
[PR 83](https://github.com/oscarvalenzuela25/Nodia/pull/83) y
[PR 84](https://github.com/oscarvalenzuela25/Nodia/pull/84). Pasaron el
[CI de master](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44872170628)
y el [CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44873017820)
para `c13ef763`. Dos perfiles de Chrome para Windows descargaron la misma
lección sintética, guardaron puntos distintos y los recuperaron al reabrir sin
red. Se completó un reintento después de fallar la consulta de un recibo. El
segundo perfil recibió el conflicto y **Usar este punto** avanzó el cursor a
revisión 5. En otro conflicto, **Conservar el del servidor** dejó esa revisión
con cero escrituras después de elegir.

### 8.4. Lectura y resolución de conflictos más claras — 2026-11-21

El lector offline mantiene a la vista la conexión, la vigencia de la copia y
el estado del punto de lectura. El acceso **Ir al punto de lectura** lleva el
foco al bloque elegido. En un conflicto se muestran los dos puntos con sus
orígenes y cada acción conserva el flujo con teclado. La lección conserva
párrafos, listas, citas, énfasis y código mediante elementos semánticos. El
renderizador recibe el Markdown persistido y construye nodos con texto, sin
ejecutar el HTML del material ni solicitar recursos externos.

Teacher restaura el acceso **Abrir copia descargada** al volver a una lección
que ya tiene una copia vigente para la misma cuenta, sesión y versión. Si se
publicó material nuevo, ofrece actualizar la copia. La presentación reutiliza
los contratos de sesión, vigencia y revisión de PWA-005/006.

Chrome 158 en Windows verificó dos perfiles con la misma cuenta sintética,
un API de prueba y el build de producción en loopback. Se restauró el acceso
a la copia al recargar Teacher. El lector abrió sin red, marcó dos puntos
distintos y enfocó el bloque con **Ir al punto de lectura** a 320 px. Se
comprobó el diseño a 390 px en oscuro y a 1280 px en claro, el recibo tras
perder la respuesta y la navegación por teclado durante el conflicto. Se
verificaron las dos elecciones, el cambio de cuenta y la eliminación offline
seguida de una nueva descarga sin reactivar el pendiente anterior.

Los recursos públicos del lector pasaron de 34.123 a 101.638 bytes
minificados y de 13.823 a 32.980 bytes con gzip local. Los 13 archivos
incluyendo HTML permanecen dentro de 512 KiB y 32 archivos. El parser se
carga al abrir una copia y el worker lo prepara con el resto de los recursos
para que esté disponible sin red.

## 9. Seguimiento y entregables

- [x] Plan creado con PWA-001 independiente y fases posteriores desglosadas.
- [x] Ficha candidata e índices enlazados; entrada explícita de fuente para validación, sin publicación.
- [x] Desarrollar PWA-001 desde development actualizado, en su propia rama; publicación y verificación HTTPS registradas en§12.
- [x] Registrar aceptación humana de funcionamiento y cierre de PWA-001 por alcance (§15); conservar la matriz AC01–AC12 como evidencia por criterio, sin inventar pruebas de dispositivos.
- [x] Implementar PWA-002 y PWA-003 como candidatos locales (§4 y §5).
- [ ] Verificar la actualización, la reversión y la reconexión con el artefacto publicado.
- [ ] Elegir eventos push antes de PWA-004.
- [x] Elegir Teacher y verificar su lectura offline por cuenta en laboratorio (PWA-005, §7).
- [x] Implementar y verificar el punto de lectura de Teacher como primera operación elegible de PWA-006 (§8).
- [x] Verificar PWA-005 y PWA-006 en el despliegue con dos perfiles de Chrome para Windows (§8.3).
- [ ] Completar las pruebas en las plataformas declaradas y en dispositivos físicos distintos.

El corte inicial fue documental. El candidato PWA-001 posterior implementó
manifiesto, iconos, metadatos y validación del artefacto. La [ficha funcional](../nodia-ai/knowledge/general-settings/features/pwa-installation.md)
permanece draft/implemented, con aprobación nula. Esta ficha y las candidatas de
Estudios siguen fuera del contexto publicado de NodiaAI.
Los reportes intermedios van a output/ o .tmp/; sólo evidencia durable útil se
consolida en la entrega. La [guía de instalación](pwa-installation-guide.md)
distingue pasos de usuario y compatibilidad realmente comprobada.

Validación documental del corte inicial: `knowledge:check` correcto con91fuentes,
47excluidas,44documentos y46fragmentos; la candidata queda excluida. Se comprobó
igualdad de bytes de las44fichas aprobadas y ausencia de cambios en capacidades
y bindings. UTF-8/LF y destinos de enlaces locales correctos. El registro añade
una fuente y puede cambiar la huella del catálogo compilado; esto no publica la
candidata. No se ejecutaron builds/tests de aplicación para una entrega sólo
documental ni se realizó QA de instalación PWA.

## 10. Referencias técnicas verificadas para el plan

- [MDN: instalación de PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable): manifiesto, HTTPS, standalone y diferencias de navegador; service worker separado de instalación.
- [Vite PWA: aviso de actualización](https://vite-pwa-org.netlify.app/guide/prompt-for-update): ciclo de nuevas versiones y cachés. Es candidato para PWA-002; su compatibilidad exacta se valida al elegir versión.
- [web.dev: caché PWA](https://web.dev/learn/pwa/caching): estrategia de recursos y almacenamiento; no implica disponibilidad offline de operaciones de negocio.
- [Apple: Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers): requisitos por plataforma a comprobar cuando se aborde PWA-004.

Las referencias describen mecanismos, no aceptación de Nodia. Los pasos de
instalación/versiones se vuelven a comprobar al implementar y registrar QA.

## 11. Candidato local PWA-001 — 2026-11-13

Rama `codex/pwa-001-installation`, creada tras fetch y fast-forward de
development a `a780099b456b9cb930865543d836e61147cc4190`, conservando el apunte
visual previo. [PR16](https://github.com/oscarvalenzuela25/Nodia/pull/16) abierto
en borrador hacia development; CI Linux y resultados finales se consultan en
ese PR, sin merge o deploy por esta entrega. Implementación de 001.01–004 y
001.07/008 por alcance local:

- Manifiesto con identidad `/`, nombre Nodia, idioma es, entrada/scope `/`,
  ventana standalone y colores del theme claro existente. Sin hostname de
  preview, credenciales o rutas privadas en el manifiesto.
- Opción1 en SVG vectorial y exportaciones independientes; maskable opaco con
  la N dentro del círculo seguro de radio40%, comprobado en192/512. Favicon
  legible a16/32px y recortes circular/cuadrado revisados sobre claro/oscuro.
- HTML enlaza manifiesto/favicon/Apple; `_headers` conserva COOP para Google y
  añade MIME/revalidación del manifiesto. No cambian guards, sesión o destinos.
- CI valida el dist antes de empaquetar/subir; CD comprueba diez recursos
  publicados por MIME/tamaño/SHA256 sin reconstrucción. Los paquetes históricos
  sin perfil PWA siguen siendo conciliables. Fallar después de publicar conserva
  el deployment y un estado explícito sin reenviar la publicación.

Build con TypeScript correcto;90pruebas existentes de auth/sesión/permisos y
82pruebas Node de CI/CD correctas,10omitidas por requisitos Linux/Node del CI.
Lint del código correcto con `npm run lint -- --ignore-pattern '.tmp/**'`:
el comando sin exclusión detecta una regla react-refresh en un experimento
preexistente e ignorado `.tmp/teacher-upgrade-browser/main.tsx`; no se modificó.

QA local Windows: Chrome157.0.8103.52 y Edge157.0.4341.46, perfiles persistentes
aislados, origen `http://127.0.0.1:4183`. Manifiesto sin errores y
`Page.getInstallabilityErrors` vacío; nueve archivos públicos con200/MIME
correcto. Ruta privada `/nodia-ai` sin sesión vuelve a `/login`; cero peticiones
API anónimas, registros SW y Cache Storage. La ventana ensayada seguía en modo
browser (`standalone=false`): esto no acredita instalar o reabrir la app.
Un primer perfil efímero devolvió `in-incognito`; al ensayar perfil persistente
desapareció, sin cambios de código.

`knowledge:check` correcto:91fuentes,47excluidas,44documentos y46fragmentos;
fichas aprobadas sin cambios y candidata PWA excluida, sin publicar.

Evidencia consolidada: [PWA-001 local](../evidence/pwa-001-local-20261113.md).
Pendientes 001.05/006/009 y AC01–AC12 por alcance: instalación/reapertura real
Chrome/Edge, Google/auth/cambio de cuenta desde standalone, prueba Android
física, CI Linux, revisión e integración por PR y comprobación HTTPS del mismo
artefacto publicado. iOS no verificado y sin soporte anunciado. No hubo
inferencias, mutaciones de negocio, instalación en dispositivos o deploy.
PWA-002…006 permanecen abiertas y no condicionan este candidato.

## 12. Verificación HTTPS: transición pública tras publicar — 2026-11-14

El CD43622185230 publicó el frontend pero su primera verificación pública
falló en digest. La lectura posterior de los diez recursos del ZIP CI original,
sin rebuild y con digest oficial verificado, coincide exactamente. El gate
se corrige con snapshots completos durante un plazo de120segundos y hasta25
intentos, sólo GET sin credenciales; MIME/tamaño/SHA256 exactos permanecen
obligatorios. Una discordancia persistente conserva el deployment publicado
y el fallo, sin volver a publicar. [Plan99§27](99-production-deployment-and-cicd-plan.md#27-pages-publicado-verificación-pública-durante-la-transición--2026-11-14)
y [evidencia](../evidence/pages-public-convergence-20261114.md) registran
identidades, límites y validación. No modifica los assets, auth, manifest o
alcance instalable; standalone y dispositivos siguen pendientes por su alcance.

## 13. Favicon web igual a la marca PWA — 2026-11-14

Solicitud adicional sobre PR25 abierto hacia development. Los archivos ya
comparten la opción1 elegida: N esencial en gradiente turquesa/azul/violeta.
Se inspeccionaron PNG192 y favicon32 y la fuente SVG común. Se conservan sus
bytes y las imágenes/manifiesto PWA; sólo se versionan las tres referencias
favicon del HTML con `?v=6e46f1a62f82`, prefijo12 del SHA256 del SVG.
Esto solicita una URL nueva; no acredita borrar la caché de un dispositivo
particular ni comprobar su pestaña instalada.

El gate de empaquetado conserva el href canónico para históricos y acepta sólo
la versión derivada de los bytes actuales del SVG, rechazando versión incorrecta,
parámetros arbitrarios, origen externo y modificación del SVG sin actualizarla.
Manifiesto e inventario público de10archivos conservan sus restricciones.

Build Client con tipos correcto;31comprobaciones PWA/artefactos en Linux con
Node24.22.2 correctas y0omisiones. Windows:25correctas/6exclusivasLinux omitidas.
El primer intento Linux sobre /mnt/c detectó modos incompatibles; la corrida
final usó el directorio de fixtures nativo mediante NODIA_ARTIFACT_TEST_TEMP_ROOT,
sin cambiar las garantías. Una copia parcial de la fixture sin dependencia de
empaquetado se descartó; el ensayo final usa los módulos originales completos.
El build contiene los tres href versionados,10assets válidos y favicon bytes
idénticos a public/. No React, auth, API, SW, capacidades o publicación nuevos.

Evaluación visual en la [ficha existente](../nodia-ai/knowledge/general-settings/features/pwa-installation.md).
Cambio local para actualizar el mismo PR; sin nuevo despliegue de VM/producción,
instalación real, prueba de caché personal o aceptación adicional PWA-001.

## 14. Estado conciliado para el TODO — 2026-11-15

El usuario identifica el paso1 PWA como realizado al pedir el núcleo de pendientes.
Se concilian los cortes existentes: implementación/assets de§11 y favicon de§13;
§12 acredita publicación y comprobación posterior por HTTPS de diez recursos del
artefacto CI original. Las referencias a «publicación pendiente» en el corte
histórico§11 no describen ese resultado posterior. No se repite PR, merge o CD.

No implica cierre de todos los AC01–AC12: instalación/reapertura Chrome/Edge,
Google/auth/renovación/cambio de cuenta desde standalone y Android físico requieren
su evidencia. iOS sigue sin verificar. Reconciliar cada gate con la versión y
dispositivo de la prueba futura; publicación exacta no acredita instalación humana.
PWA-002…006 siguen sin implementación acreditada por este corte.

[TODO](TODO.md) contiene el punto de reanudación por entrega; las especificaciones
y evidencias permanecen en este plan. Sin nueva consulta productiva, despliegue,
instalación, aprobación o verificación de dispositivo por esta conciliación.

## 15. Cierre de PWA-001 por aceptación humana — 2026-11-16

El usuario confirmó «PWA 001 igual ya funciona bien» y solicitó cerrar el ítem.
**PWA-001 queda cerrado por alcance**: instalación con icono y ventana propia,
conservando las funciones online. La aceptación humana sucede el pendiente
funcional de§14; la publicación y la integridad de recursos siguen acreditadas
por§12, sin repetir PR, merge o CD.

La confirmación no identifica navegador, versión, dispositivo u origen de la
prueba. No se marcan automáticamente AC01–AC12 como pruebas ejecutadas ni se
anuncia compatibilidad iOS o de otra plataforma sin evidencia específica. La
matriz conserva esos límites de verificación; no constituye un bloqueo nuevo
del alcance que el usuario acaba de aceptar.

PWA-002…006 continúan abiertos como entregas independientes: caché/actualización,
desconexión, push, datos offline y sincronización. Este cierre no incorpora
service worker ni esas capacidades, no ejecuta un despliegue y no aprueba el
plan completo o la ficha NodiaAI, que mantiene draft y approval:null.

## 16. Recargar la página desde el avatar — 2026-11-17

**Actualizar información** aparece encima de **Cerrar sesión** para la
persona autenticada. Usa la recarga nativa en la ubicación actual, incluida
la ruta, query y fragmento. El mismo menú se usa en escritorio, móvil y la
ventana instalada. Una sesión en proceso de renovación o cierre bloquea la
acción junto al resto del menú.

La recarga vuelve a iniciar Client y sus consultas en esa URL. La gestión de
versiones, caché estática y borradores al actualizar corresponde a PWA-002.
En Chromium con fixture sintético, el clic a 320 px y Enter a 1440 px
registraron una navegación de tipo `reload` con la misma URL. El control queda
antes de Cerrar sesión y conserva 44 px de alto en móvil.
