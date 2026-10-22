# Gemini Web: visor de autenticación en Nodia

## Niveles integrados y OCR — 2026-10-13

Implementación autorizada por el usuario, sin aprobación documental automática.
[ADR-031](../../architecture/decisions/ADR-031-gemini-web-reasoning-levels.md).
Esta entrega completa la integración pendiente del ensayo histórico siguiente.

- Ajustes IA/Web reemplaza el switch por Bajo/Medio/Alto por modelo; el análisis
  de factura ofrece los mismos niveles como override temporal. Sin selección
  automática, conversión del booleano histórico ni herencia de otros modos.
- NestJS valida nivel/configuración final antes del transporte. Prioridad:
  override → entrada propia del modelo (null limpia) → preferencia del modo →
  ausencia. Nivel y booleano explícitos juntos se rechazan, incluido false.
- El runtime lee un registro externo versionado de observaciones, montado readonly.
  Solo IDs/números/layout comprobados reciben la adaptación body80/header15.
  Otros modelos siguen en el catálogo; nivel explícito sin perfil produce422.
  `supported_options.thinking_levels_by_model` cruza perfiles y catálogo vivo.
- La intervención ocurre en generación, después del upload; el uploader real
  mantiene su AsyncSession y validación Pydantic. No cambia auth/parsing, no
  modifica el SDK instalado ni repite una inferencia con resultado incierto.
- Retirado R2 del requisito de extracción Gemini en memoria. URL/token privado
  siguen obligatorios; guardar adjuntos conserva requisitos de almacenamiento.

OCR privado real en el runtime desplegado de Ubuntu, modelo Flash descubierto
`56fdd199312815e2`, una solicitud por nivel y factura PNG sintética:

| Nivel | HTTP | Tiempo observado | Comprobaciones |
|---|---:|---:|---|
| Bajo | 200 | 114,08s | 8/8 correctas |
| Medio | 200 | 70,61s | 8/8 correctas |
| Alto | 200 | 64,52s | 8/8 correctas |

FolioTEST-0042, fecha2026-10-12, total11900, dos productos, nombres, cantidades2/5,
precios2500/1000 y totales de línea5000/5000 comprobados. Estos tiempos son ensayos
individuales; no prueban que un nivel sea más rápido ni miden profundidad interna.
El primer ensayo integrado falló antes de generar por incompatibilidad del proxy
con la validación del upload. Se corrigió el alcance a `_generate` y se añadió
regresión con el uploader real antes de repetir los tres ensayos satisfactorios.

Prueba adicional del recorrido **frontend local → API Ubuntu → Gemini Web**:
seleccionar conexión Gemini/Web y Medio en el importador, enviar el mismo PNG,
recibir «Borrador listo» con folio/fecha/total y ambos productos/costos/stock
correctos. No se guardó factura ni inventario; tras descartar, laboratorio mantiene
0 productos/0 facturas. La selección temporal no cambió preferencias persistidas.
Codex sigue disponible como sesión, sin nueva inferencia; API keys/Agentic separados.

Evidencia externa sanitizada en `C:/Users/Oscar/Documents/Codex/2026-10-12/me-p/outputs/`:
`gemini-web-ocr-levels.json`, `gemini-web-ocr-levels-initial.json`,
`nodia-web-niveles-integrados.png` y `nodia-gemini-ocr-medio-frontend.png`.
151 pruebas Python: todas en Linux, Windows con dos symlink omitidos por privilegios
y comprobados en Linux. Server884/116, Client1190/189 correctos; builds/tipado/lint
y contrato HTTP compilado aislado correctos, warnings históricos conservados.
QA offline conserva configuración ante error, etiquetas ES/EN, selección sin
default y preferencias por modelo; no realiza peticiones reales ni escribe authStore.

VM: Docker saludable, API/Gemini systemd activos y sesión Web autenticada. Perfil
publicado en `/opt/nodia/config/gemini-web-reasoning-profiles.json`, overlay
`docker-compose.web-reasoning.yml` incluido en systemd; `.env` conserva propietario
10001/permisos0600 y secretos/volúmenes previos. Ver README del microservicio para
el formato y activación. La configuración Flash y OCR permanece sin cambios.

Pendientes: perfiles observados para otros modelos, otra cuenta, inferencia PDF,
persistencia R2 y aceptación en VPS/HTTPS. Una preferencia guardada o catálogo no
acreditan disponibilidad ni cuota. SDK/protocolo requiere nueva verificación al
actualizar versiones; sin perfiles válidos se conserva el flujo histórico y se
rechazan niveles explícitos. No sustituir Web por otro motor/modelo.

## Ensayo aislado de niveles Web — 2026-10-13

Por solicitud del usuario, se comprobó el transporte antes de cambiar el selector
de Nodia. El menú real de Gemini con Flash seleccionado envía Bajo=1, Medio=4 y
Alto=2 en el body `f.req` (posición80) y el header de modelo JSPB (posición15).
Las tres capturas sanitizadas usan el mismo ID descubierto `56fdd199312815e2`,
número de modelo1 y HTTP200. No se deriva soporte de otros modelos ni sus versiones
comerciales a partir de este ID.

El [adaptador experimental](../../../nodia-gemini-microservice/experiments/README.md)
añade `thinking_level` a `generate_content`, aislado de la aplicación habitual.
Conserva el SDK2.1.1 para auth, descubrimiento, uploads y parsing, sustituye solo
los dos valores observados y exige perfil/modelo/versión/layout comprobados.
No modifica site-packages, rutas públicas, configuración guardada ni selector.
Una discrepancia, otro ID o parámetros incompatibles se rechazan antes del envío;
concurrencia y reenvíos de generación deshabilitados.

Prueba HTTP real en Docker/Ubuntu, con el navegador de login cerrado:

| Nivel | Valor body/header | Resultado del mensaje sintético | Envíos |
|---|---:|---|---:|
| Bajo | 1/1 | `OK`,30,17s | 1 |
| Medio | 4/4 | `OK`,18,02s en ensayo posterior | 1 |
| Alto | 2/2 | `OK`,35,08s | 1 |

El primer mensaje SDK de Medio terminó con `TimeoutError` después de54,06s y un
único envío. El ensayo posterior utilizó un **mensaje nuevo**, sin replay automático
del resultado incierto. Medio y Alto posteriores recibieron HTTP200. El éxito
confirma transporte/inferencia para este modelo y sesión; no mide profundidad
interna, no garantiza estabilidad ni certifica OCR u otros modelos con estos niveles.

Evidencia externa en `C:/Users/Oscar/Documents/Codex/2026-10-12/me-p/outputs/`:
`gemini-web-reasoning-native.json`, `gemini-web-reasoning-sdk-initial.json` y
`gemini-web-reasoning-sdk-followup.json`. Solo IDs públicos, formas sanitizadas,
valores, tiempos y resultados; sin cookies, tokens ni contenido privado.
145 pruebas offline pasan en Ubuntu; Windows145 con dos casos de symlink omitidos
por permisos y comprobados en Linux. Incluyen el constructor real de peticiones
del SDK, modelos incorrectos, observaciones inválidas/contradictorias, cancelación
y aislamiento del contexto. Un primer lanzamiento Windows desde el directorio raíz
falló en el test PTY Agentic ajeno al cambio; con el cwd del microservicio, la suite
pasó dos veces. Compilación Python, `pip check` y `git diff --check` correctos.

Se restaura el runtime habitual tras el ensayo. Primer paso pendiente: integrar el
contrato de niveles por modelo, reconciliar explícitamente el booleano histórico y
comprobar extracción con niveles antes de sustituir el selector. API keys, Codex y
Gemini Agentic permanecen independientes; documentación sin aprobación automática.

Implementación solicitada el 2026-10-13. [ADR-030](../../architecture/decisions/ADR-030-gemini-web-login-viewer.md). Login con cuenta real y OCR del motor Web comprobados en VM; análisis completo desde Nodia y VPS público pendientes.

## Uso

1. Ajustes IA → conexión Gemini → Token Plan (Web).
2. «Iniciar Sesión en Navegador Remoto» o «Renovar Sesión Ahora» → «Abrir visor de Gemini».
3. La pantalla de Gemini aparece dentro del modal. Pulsar «Sign in» en esa pantalla.
4. Pulsar el campo de Google, escribir en «Texto para el campo seleccionado» y pulsar «Enviar texto». El ojito muestra/oculta el texto conservando borrador y foco; inicialmente está oculto. Elegir los siguientes campos y botones de Google directamente en la pantalla. El texto se vacía únicamente tras envío confirmado.
5. Completar la autenticación en Google. El servicio verifica ambas cookies y la sesión mediante Gemini Web; únicamente entonces Nodia informa éxito y reconsulta sus estados/modelos. El login no acredita una inferencia ni una cuota determinada.

Simplificación solicitada el2026-10-13: quitar botones auxiliares de teclado, scroll, actualización y ampliación del visor; queda «Enviar texto» y el ojito dentro del input. Etiqueta/ayuda fuera de la fila mantienen el botón centrado con el campo en escritorio; en móvil ambos ocupan el ancho disponible y el botón va debajo. El visor se ajusta al ancho disponible y mantiene scroll local cuando corresponde.

Las lecturas fallidas se recuperan automáticamente cada10s mientras el intento exista, con un único toast por episodio; no se repiten entradas. Lectura normal cada2s, pausada mientras hay texto o una entrada en curso. Un error conserva el borrador; comprobar la pantalla antes de repetir una entrada cuyo resultado sea incierto. «Cancelar login» del modal cierra el navegador. Cada intento dura como máximo cinco minutos. Si la API informa que el intento desapareció, se permite cerrar y comenzar otro.

## Transporte y acceso

### Cambiar cuenta Web (solicitud del 2026-10-13)

En Token Plan (Web), «Cambiar cuenta» muestra una confirmación antes de limpiar la sesión compartida por **todas** las conexiones Gemini Web del servidor. Tras confirmar, se detienen cliente/renovación, se vacían el perfil Google del adaptador y su caché de cookies, se invalidan las observaciones/modelos del frontend y se abre el modal de login. Pulsar «Abrir visor de Gemini» e ingresar con la otra cuenta. Si se cancela ese nuevo login, Web permanece desconectado. API keys, Gemini Agentic y Codex conservan sus credenciales y perfiles separados.

La desconexión persiste en `session_state/cookies.json`: una marca atómica reemplaza las cookies y bloquea la semilla `.env` aunque esté montada en solo lectura. El SDK usa exclusivamente el directorio privado de sesión del adaptador. Solo un login explícito exitoso reemplaza esa marca; health, recuperación headless y reinicios no restauran la cuenta anterior. La semilla de solo lectura no se reescribe ni se borran otras claves de configuración. Esta operación elimina la sesión del adaptador, no revoca la cuenta Google ni cierra sus otros navegadores.

Después del nuevo login, el cliente registra la semilla realmente leída en lugar de confundirla con las cookies nuevas. La sesión persistida prevalece sobre la semilla al arrancar, incluso si una edición de configuración cambió su fecha; `.env` actúa como bootstrap cuando no hay sesión persistida. Regresión: login explícito de segunda cuenta → health → cierre/reinicio con semilla antigua de fecha posterior conserva la segunda cuenta.

`POST gemini-session/logout` (ambos aliases, JWT/`ai:manage`) → `POST /auth/logout` privado (token/actor) → `{status:"disconnected"}` sin datos de cuenta. No-store; sin reintento automático. Un login, análisis, cuota o renovación activos produce409 antes de limpiar. Si falla el cierre/limpieza, permanece desconectado con limpieza pendiente, se conserva la confirmación y debe reintentarse antes de conectar otra cuenta. Los roots de volumen se conservan, las rutas externas/symlinks de raíz se rechazan y los links internos se eliminan sin seguirlos.

Regresiones sintéticas cubren confirmación/cancelación, fallo/reintento, doble envío, salida de contexto, autorización pública/privada, cliente/caché/perfil, reinicio con semilla antigua, login nuevo y cancelación durante limpieza. El cambio real de cuenta sigue requiriendo que el usuario confirme la limpieza y complete Google; no se borra su sesión como parte del despliegue o de las pruebas.

Entrega desplegada en VM: Client1187/189, Server878/115 y HTTP compilado Windows/Linux correctos; Python138 en Linux, Windows138 con dos casos de symlink omitidos por permisos (ambos comprobados en Linux). SDK close fallido y caché escrita durante close cubiertos, sin reiniciar una cuenta antigua después del logout. Tipado/lint/build correctos con warnings históricos. La cuenta real sigue autenticada después del despliegue y localhost5174 responde200. La revisión automática del navegador bloqueó el acceso a una pestaña con protocolo interno de página de error; comprobación visual y login con la segunda cuenta pendientes.

Frontend → Axios/autenticación Nodia existente → Nodia Server → microservicio privado → página Playwright. No requiere un iframe de Google, abrir Chrome en Windows, comandos de SSH del usuario, VNC ni un puerto gráfico público.

| API pública, ambos aliases `ai-provider` / `ai-providers` | Resultado |
|---|---|
| `POST gemini-login/start` | `{id,state}` |
| `GET gemini-login/:id` | Estado del intento |
| `GET gemini-login/:id/frame` | `{ready,frame_id,image,width,height}`; JPEG base64 o pantalla todavía no lista |
| `POST gemini-login/:id/input` | Comando limitado y nuevo estado del intento |
| `POST gemini-login/:id/cancel` | Cancelación |

Todas requieren JWT Nodia y `ai:manage`; el actor se obtiene del JWT, nunca del body. Ownership comprobado en Server y Python; otro administrador recibe404. Server envía exclusivamente `X-Nodia-Service-Token` y `X-Nodia-Actor-Id` al servicio. No publicar FastAPI al navegador. Respuestas `no-store`; pantallas se eliminan de la caché Query al desmontar, y variables de la mutación tras finalizar.

Comando: `frame_id` + acción `click` (`x,y`), `text` (`text`), `key` (`key`) o `scroll` (`delta`). Sin mezclas, campos desconocidos ni atajos de dirección/consola/archivos. Coordenadas1280×850, texto≤2048 caracteres, scroll±600. Cada acción consume la pantalla y las navegaciones la invalidan: conflictos409 requieren revisar/actualizar, nunca replay automático. Solo HTTPS de Gemini y los hosts Google admitidos. Lectura JPEG≤768KiB; comando privado≤8KiB; operación de navegador≤3s, transporteServer≤5s. No registrar entradas, imágenes, cookies ni URLs de autorización.

## VM y VPS

El Dockerfile fijado incluye Xvfb/xauth; arranca `xvfb-run` como usuario10001, con pantalla1280×850 y TCP deshabilitado. El navegador es headed dentro del contenedor, aunque Ubuntu no tenga escritorio. El Compose conserva perfiles/cookies en volúmenes y publica8000 solo en loopback. Rebuild de la imagen y reinicio de API requeridos al desplegar esta versión.

En VM, el proxy Vite/SSH de API existente transporta también el visor. No hay un túnel gráfico adicional. Los servicios gráficos legacy de laboratorio se detuvieron/deshabilitaron; sus archivos no se borraron ni se exportaron sus contraseñas. En VPS, usar la API HTTPS/orígenes autorizados y la red privada habitual (ADR-008); ningún cambio especial de WebSocket es necesario.

Un worker Python y una réplica API por este flujo; estado de intentos en memoria. Reinicio de la API pierde el acceso al intento anterior, que expira en el servicio dentro de300s. Una recarga del frontend también pierde su ID y puede requerir esperar la expiración antes de iniciar otro. Para múltiples réplicas se necesita afinidad/ownership compartido y una prueba específica.

Google puede rechazar el navegador o exigir MFA/CAPTCHA; el visor no modifica esa política. La prueba del formulario y de las entradas no equivale a login real aceptado. Posteriormente el usuario completó el login: sesión/descubrimiento/OCR comprobados en esta VM. El usuario introduce sus credenciales en el visor, sin enviarlas al chat. Gemini Agentic/API, Codex y sus cuentas independientes conservan su flujo.

## Evidencia

Suite Python127 pruebas, incluida ejecución en el contenedor Linux, y `pip check` correctos. Server877/115; integración HTTP compilada correcta con guard/permiso/actor reales y persistencia/transporte sintéticos: ambos aliases, DTOs, límites, respuesta corrupta, errores seguros y no-store. Client1180/188, build/tipado/lint correctos. Pruebas de UI: texto enmascarado, clic escalado, teclado, borrador ante fallo, retry explícito, cancelación y caché efímera. Regresión focalizada posterior9/2 correcta para feedback/cierre del modal; checks detallados en progreso.

VM real: abrir visor desde Nodia, pantalla Gemini, clic «Sign in» → formulario Google, enviar `prueba-local` sin submit y seleccionar/borrar confirmado; cancelación desde UI, cierre del navegador y salud de servicios comprobados. Móvil390×844 con ampliación: página390px, diálogo326px sin overflow horizontal; navegador operativo con los tres servicios gráficos legacy apagados. Capturas externas `outputs/gemini-visor-frontend-vm.jpg`/`gemini-visor-movil-vm.jpg`. No se inició sesión con cuenta real ni se generó contenido durante estas verificaciones.

Prueba posterior del2026-10-13 autorizada por el usuario tras completar Google: `/web/status` y `/web/models` privados informan autenticación válida; Nodia muestra «Sesión Web: Autenticada». Tres modelos descubiertos en vivo. Se eligió para el ensayo el primer modelo descubierto, `gemini-flash-lite`/`8c46e95b1a07cecc`, sin modificar la selección persistida. `POST /web/analyze-invoice` sobre factura PNG sintética devolvió200 en7,23s: folioTEST-0042, fecha2026-10-12, total11900, CUADERNO AZUL×2 a2500 y LAPIZ ROJO×5 a1000. Comprobaciones de folio/total/número de ítems/cantidades correctas; no se guardaron factura ni inventario. Resultado externo `outputs/gemini-web-ocr-result.json`.

Esta prueba ejecutó el microservicio privado en Ubuntu, no la ruta pública de facturas de Nodia. Esa ruta conserva el gate `canUseGemini()` que exige R2; el laboratorio sigue sin R2 y la conexión Gemini aún no tiene modelos asignados. Resolver esas condiciones y probar frontend→API→OCR antes de acreditar el flujo completo. Sin nuevas inferencias, cambios de código/configuración o aceptación del VPS por esta verificación.
