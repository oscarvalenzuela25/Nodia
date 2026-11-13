# PWA de Nodia — plan de implementación por entregas

> Estado: en revisión. La prioridad y el alcance independiente de PWA-001 fueron solicitados explícitamente el 2026-11-13; este documento nuevo no tiene aprobación documental integral ni acredita implementación.
> Fecha: 2026-11-13. Rama de planificación: `codex/plan-pwa-installation`, desde `development`.
> Fuentes: [Client08](08-stack-frontend.md), [auth14](14-authentication.md), [privacidad89](89-module-access-and-user-data-scope.md), [rutas ADR092](../architecture/decisions/ADR-092-stable-module-navigation-routes.md), [rendimiento37](37-web-performance-implementation-plan.md), [producción99](99-production-deployment-and-cicd-plan.md) y [diseño Client](../../nodia-client/DESIGN.md).

## 1. Objetivo y orden de entrega

La primera entrega permite **instalar Nodia, reconocer su icono y abrirla en una
ventana propia, utilizando las mismas funciones online actuales**. Es un ítem
vertical completo: se desarrolla, prueba, revisa y despliega por separado. Su
cierre no depende de caché offline, avisos de actualización, push o sincronización.

| Orden / ítem | Resultado entregable | Dependencia | Prioridad / estimación inicial |
| --- | --- | --- | --- |
| **PWA-001** | **Instalación, iconos y ventana propia; funciones online** | App actual publicada por HTTPS | **Primera entrega obligatoria; 1–2 días de trabajo** |
| PWA-002 | Service worker con caché estática acotada y actualización controlada | PWA-001 | Planificado; 1–2 días adicionales |
| PWA-003 | Experiencia clara ante desconexión y recuperación online | PWA-002 para pantalla disponible sin red | Planificado; 0,5–1 día adicional |
| PWA-004 | Notificaciones push de eventos definidos | Contrato de eventos y worker navegador; independiente de offline de datos | Planificado; 2–5 días adicionales |
| PWA-005 | Lectura offline de datos de un módulo expresamente elegido | PWA-002/003 y decisión de privacidad/persistencia | Planificado; estimación tras definir módulo, previsiblemente semanas |
| PWA-006 | Escrituras offline y sincronización del módulo elegido | PWA-005 y contratos backend de conflicto/idempotencia | Planificado; estimación propia, previsiblemente semanas adicionales |

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

**Prueba de independencia:** el PR puede cerrarse con PWA-002…006 sin empezar,
sin instalar plugin PWA, crear contratos de sincronización o contratar servicios.
Si el PR incluye precache, push o persistencia offline, dividirlo antes de revisar.
Las correcciones indispensables de auth, rutas o empaquetado descubiertas por
AC01–AC12 sí pertenecen al mismo ítem; no se pospone una instalación rota.

## 4. PWA-002 — caché estática y actualizaciones controladas

Ítem posterior; no es una dependencia oculta de PWA-001.

- [ ] Revisar compatibilidad de la versión elegida de vite-plugin-pwa/Workbox con Vite8 y Node del proyecto; fijar dependencias y lockfile. Elegir generateSW o injectManifest por necesidades comprobadas, sin introducir ambos mecanismos.
- [ ] Especificar un allowlist acotado de assets públicos versionados. Comparar tamaño/arranque con plan37; no descargar por defecto todos los módulos diferidos, medios o material de Teacher.
- [ ] Mantener fuera de la caché SW `/api`, autenticación/OAuth, respuestas privadas, archivos firmados/R2, observaciones IA y metadatos operativos del CD. No almacenar ni repetir POST/PUT/PATCH/DELETE ni respuestas401/403 como contenido recuperable.
- [ ] Diseñar aviso traducido de versión disponible, actualización explícita y aplazamiento seguro ante formulario/borrador/trabajo en curso. Evitar recargas automáticas que pierdan contexto.
- [ ] Resolver versión anterior/nueva entre pestañas y lazy chunks: no retirar recursos usados por clientes activos sin una estrategia probada; probar dos releases consecutivos y rollback.
- [ ] Definir namespace, límites y limpieza sólo de las cachés propias de Nodia. Preservar las reglas del usuario/dispositivo y el almacenamiento ajeno.
- [ ] Validar headers del SW, scope, MIME, registro en el build y exclusión de desarrollo/previews según la política elegida. Preparar retirada/unregister controlado que sólo afecte el registro propio; quitar el archivo del servidor no basta para retirar un SW existente.
- [ ] Probar actualización pendiente/aceptada/aplazada, dos pestañas, recurso ausente y desconexión durante instalación. QA de auth/permisos y reapertura en los entornos que se declaren soportados.

Aceptación: nueva versión ofrecida y aplicada sin perder borradores; API conserva
su autoridad online; recursos públicos anteriores/nuevos tienen recuperación
probada. Comparación de rendimiento y rollout/rollback documentados. Evaluar ADR
si la estrategia introduce garantías compartidas o alternativas costosas.

## 5. PWA-003 — desconexión y recuperación comprensibles

- [ ] Definir pantalla de arranque sin red con shell estático de PWA-002 y acción de reintento; distinguir primera visita sin recursos, desconexión posterior y fallo de API.
- [ ] Tratar online/offline del navegador como una pista: conexión a red no demuestra disponibilidad del servidor ni sesión válida.
- [ ] Acordar qué controles requieren red y cómo conservan borradores locales ya existentes. No presentar una operación no enviada como guardada ni confirmar automáticamente al reconectar.
- [ ] Distinguir fallos transitorios de401/403/404/410; preservar ocultación de contenido rechazado y aislamiento por cuenta/sesión. No crear persistencia de datos privados en esta fase.
- [ ] Probar caída de red, API inaccesible con internet, expiración/revocación, cambio de cuenta y recuperación explícita, sin loops de reintentos o avisos duplicados.

Aceptación: el usuario entiende por qué no puede completar una acción y puede
recuperar la vista online sin perder su borrador. No se anuncian consultas o
escrituras offline de datos del negocio.

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

No se convierte toda Nodia en offline como un solo ticket. Primero elegir un
módulo y un caso acotado; material de estudio descargable es una posibilidad por
evaluar, no una capacidad aprobada. IA remota/login/generación siguen online.

- [ ] Definir datos descargables, vigencia, límites, cuotas y significado de «copia descargada» frente a autoridad del servidor.
- [ ] Revisar privacidad, equipo compartido, cambio de cuenta, logout, revocación, cifrado y eliminación. Sin red no se puede comprobar una revocación nueva; el producto debe decidir qué datos puede exponer en esas condiciones.
- [ ] Crear ADR de persistencia local/esquema/migraciones y contrato del módulo; no persistir indiscriminadamente todo el caché de TanStack o tokens.
- [ ] Diseñar descarga explícita, progreso/cancelación, control de cuota y limpieza; probar fallo parcial, pérdida de almacenamiento y disco lleno sin afirmar durabilidad que el navegador no garantice.
- [ ] Resolver refresco/versiones, señales de desactualizado y borrado seguro por alcance. Aislar cuentas/negocios y respetar propiedad de datos.
- [ ] Probar reapertura sin red, datos expirados, credenciales cambiadas, dispositivo compartido y reconexión; revisar caché y almacenamiento local sin secretos en evidencias.

Aceptación: sólo el caso/módulo acordado funciona sin red y distingue datos
descargados de datos vigentes. Requiere revisión y estimación propias antes de
implementar; no hereda aprobación de PWA-001.

## 8. PWA-006 — escrituras offline y sincronización

- [ ] Elegir operaciones elegibles y excluir las que exigen autorización/confirmación online vigente. La elección de un módulo no habilita todas sus mutaciones.
- [ ] Diseñar ADR y contrato Server para identidad de operación, idempotencia, revisión/fence, orden, conflictos y resultados inciertos. No permitir replay de inferencias o efectos externos desconocidos.
- [ ] Modelar cola durable local con estados visibles: borrador, pendiente de envío, en proceso, aplicada, rechazada/conflicto o resultado incierto; distinguirlos del éxito confirmado.
- [ ] Revalidar sesión/actor/módulos/ownership al enviar; no usar un permiso antiguo ni una confirmación genérica como autorización actual.
- [ ] Implementar resolución de conflictos, cancelación previa a envío y reconciliación, conservando la misma identidad al recuperar un resultado incierto.
- [ ] Tratar sincronización en background como mejora dependiente del navegador; debe existir recuperación con la app abierta y acción del usuario.
- [ ] Probar doble dispositivo/pestaña, cierre abrupto, respuesta perdida después de commit, red oscilante, cola parcial y cambio de cuenta; no trasladar pendientes al nuevo actor.

Aceptación: cada operación admitida se reconcilia sin duplicar efectos ni anunciar
éxito antes de confirmación, con conflictos recuperables y pruebas backend/locales
por garantía. Estimación y aceptación específicas por operación/módulo.

## 9. Seguimiento y entregables

- [x] Plan creado con PWA-001 independiente y fases posteriores desglosadas.
- [x] Ficha candidata e índices enlazados; entrada explícita de fuente para validación, sin publicación.
- [ ] Desarrollar PWA-001 desde development actualizado, en su propia rama.
- [ ] Completar AC01–AC12 y distinguir QA local, dispositivos y publicación efectiva.
- [ ] Revisar y priorizar PWA-002/003 después de la primera entrega.
- [ ] Elegir eventos push antes de PWA-004 y módulo/política offline antes de PWA-005/006.

Esta entrega es documental: no instala dependencias, registra service workers,
modifica la app, publica Pages ni cambia el VPS. La [ficha funcional](../nodia-ai/knowledge/general-settings/features/pwa-installation.md)
se mantiene draft/planned, con aprobación nula; el plan no habilita herramientas
o capacidades IA. Al implementar se actualizan este checklist, progreso, fichas
y pasos de usuario con las comprobaciones realmente ejecutadas. Los reportes de
ensayo van a output/ o .tmp/; sólo evidencia durable útil se consolida en la entrega.

Validación documental de esta revisión: `knowledge:check` correcto con91fuentes,
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
