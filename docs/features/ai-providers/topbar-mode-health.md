# Indicadores de modos IA en el topbar

## Actualización manual desde la cabecera — 2026-11-06

El grupo añade un IconButton de44px «Actualizar estado de IA», con tooltip/nombre accesible ES/EN. Se mantiene dentro del montaje existente: sesión Nodia validada y acceso al módulo canónico `/ai-providers` (o bypass `super_admin`); no aparece a visitantes ni amplía permisos. Los requisitos antiguos de acción y URLs `/settings/...` inferiores son históricos, sustituidos por política89/ADR092.

Un clic reconsulta el mismo `GET /ai-providers/health` y la misma caché compartida `ai-providers-health`. Mantiene polling/staleTime120s; no duplica observadores ni añade endpoints, probes de inferencia, login o cambios de proveedor/modelo/modo. Durante cualquier reconsulta conserva los indicadores, bloquea sus acciones y muestra carga dentro del botón. El guard de intención y `cancelRefetch:false` impiden duplicar lectura/feedback con clics rápidos. Éxito comunica sólo «Estado de IA actualizado»; no implica sesión disponible o inferencia válida. El error usa un único toast global y permite otro clic conservando la observación anterior y sus reglas de incertidumbre.

La distribución existente se conserva: segunda fila por debajo de600px y fila de cabecera desde600px. No se cambia el criterio de colores ni se ocultan estados desconocidos. [Contrato de proveedores](../../mvp/ai-provider-feature-contract.md#actualización-manual-de-los-indicadores--2026-11-06) y [evidencia](../../evidence/ai-topbar-manual-refresh-20261106-r01.json) separan implementación, adopción y QA.

> Cambio solicitado el 2026-10-27: retirar Web y conservar sólo Agentic (`agentic`) y API key (`api_key`), conforme [plan90](../../mvp/90-agentic-api-only-web-retirement.md) y [pruebas91](../../mvp/91-ai-provider-onboarding-verification.md). Los apartados inferiores conservan contratos/evidencias anteriores por fecha y no habilitan Web. Implementación y aceptación en curso; ningún cambio automático de proveedor, modelo o modo por error.

Solicitudes del usuario del 2026-10-08, 2026-10-12 y 2026-10-13; implementación local, sin aprobación automática de documentos.

## Comportamiento

- Sin una conexión `is_default: true` o sin modos habilitados, no se renderiza este grupo opcional. Por decisión del2026-10-13, muestra únicamente los modos habilitados de esa instancia, con iconos y etiquetas API/Web/Agéntico: llave para `api_key`, globo para `token_plan_web` y razonamiento para `token_plan_agentic`. Los flags explícitos false prevalecen sobre el modo histórico; un modo deshabilitado se omite. OpenAI con API y Agéntico habilitados no muestra Web. Habilitar un modo sin credenciales conserva su icono con el estado pendiente correspondiente; configuración del modo y autenticación son distintos datos.
- Solo se monta para una sesión validada con acción `ai:manage` o rol activo `super_admin`, y acceso al módulo `/settings/ai-providers`, conforme a la excepción del caso de uso CheckActionPermissionUseCase y al guard de la página. No modifica los permisos del servidor.
- Consume `GET /ai-providers/health` mediante el hook y caché existentes `ai-providers-health`, con intervalo de dos minutos (120000ms), por solicitud del2026-10-13. `staleTime` también es de dos minutos para evitar reconsultas por montaje mientras el dato siga vigente. Conserva carga inicial, verificación manual e invalidaciones tras cambios/login. No agrega una consulta al listado ni a `gemini-engines`; no modifica el liveness de Docker ni las cachés internas de los adaptadores.
- Punto verde (`theme.palette.success.main`): sesión Web/Agentic disponible y autenticada en la observación correspondiente. Para Codex usa `codexSession` de la misma conexión y respeta `usageAllowed: false`. El tooltip aclara que una sesión disponible no acredita inferencia.
- API key, decisión explícita del 2026-10-12: punto verde cuando la observación contiene una clave guardada (`apiKeysCount > 0` o `selectedApiKey`), con tooltip «API key configurada». No exige modelo, clave activa ni inferencia comprobada. Conserva ese indicador de configuración durante un fallo de reconsulta con datos previos; sin claves conocidas requiere revisión. Un canal explícitamente deshabilitado se omite.
- Punto rojo para Web/Agentic (`theme.palette.error.main`): requiere revisión o estado sin verificar. Datos ausentes, inválidos o un refetch fallido no acreditan disponibilidad de sesión.
- Durante revalidación conserva los iconos y deshabilita sus botones. Al fallar, conserva el acceso al panel, marca las sesiones como sin verificar y utiliza el toast global de QueryCache; no agrega feedback duplicado.
- Clic: `/settings/ai-providers?provider=<ID>&mode=<modo>`, abriendo la instancia exacta y su pestaña habilitada. No inicia OAuth automáticamente. Web/Agentic ofrecen sus acciones de login existentes; API ofrece gestión de claves.
- En menos de 600 px, los indicadores ocupan una segunda fila para conservar juntos menú, idioma, tema y avatar. Desde 600 px quedan en una fila. Nombres accesibles y tooltips traducidos ES/EN; controles accesibles por teclado.

## Evidencia y límites

Cadencia solicitada el2026-10-13: polling/staleTime120s; regresión con dos observadores verifica una petición compartida al inicio, ninguna automática antes de dos minutos, una al vencer y reconsulta manual inmediata.16 pruebas focalizadas correctas; suite completa Client1181/188, tipado/lint/build correctos. Cambio no visual en Client, sin modificar servicios Ubuntu, credenciales ni cachés internas de proveedor.

Cambio del2026-10-13:15 pruebas focalizadas del topbar correctas, con canales omitidos, conexión histórica, cambio de predeterminado, actualización de flags, ausencia de modos y API habilitada sin clave. Suite completa Client1171/186 y tipado/lint/build correctos. Navegador localhost con datos reales confirma OpenAI con únicamente API y Agéntico; captura externa `outputs/topbar-openai-modos-habilitados.jpg`. Sin modificar flags, claves, sesiones o backend.

El detalle oculta chip y punto de estado en la pestaña API key; el resumen oculta el chip en conexiones exclusivamente API. Web/Agentic mantienen el chip. Con API predeterminada, el chip de los planes se deriva de sus propias observaciones de sesión, sin tomar la salud API. En detalle, cambiar a otro canal también toma su propia observación. Disponible indica sesión disponible/autenticada; no certifica inferencia. Observación ausente queda sin verificar, runtime/uso denegado degradado y sesión no autenticada requiere login. El estado API del backend sigue distinguiendo configuración de inferencia; no se falsifica un health saludable.

Validación del 2026-10-12: Client1167 pruebas/186 archivos, tipado/lint/build correctos; ajustes posteriores de API configurada ante refetch fallido y chip por canal,59 pruebas focalizadas correctas, suite completa final1167/186 y tipado/lint/build correctos. Linux devuelve health200 en aproximadamente12 s con Gemini sin autenticar. Consultas privadas Gemini y observaciones de conexiones Codex se inician en paralelo; timeout Client de health45 s frente a hasta30 s de lectura Codex y15 s del servicio Gemini. La extracción Codex real se verificó por separado en la VM; no acredita las claves API ni Gemini.

Pruebas sintéticas de componentes: ausencia de predeterminado, tres modos independientes, caché compartida, navegación por ID/modo, permisos, configuración histórica, cambio de predeterminado, datos ausentes/malformados, sesión Codex propia/uso denegado, revalidación pendiente, fallo con datos previos, recuperación y traducciones. Pruebas de página/detalle comprueban apertura por URL de la pestaña solicitada y regreso al resumen.

Suite completa Client: 946 pruebas en 157 archivos correctas. Revalidación focalizada posterior a ajustes de UI y navegación: 55 pruebas en cuatro archivos correctas. Tipado/lint/build comprobados al cierre. Navegador local con fixtures aislados comprobó 320/600/1280 px, temas claro/oscuro, ES/EN y recorrido Tab entre indicadores; los botones permanecen dentro del ancho del header. Fixtures temporales retirados tras QA.

No se autenticaron cuentas, consumieron inferencias, modificaron claves/BD ni reiniciaron servicios del usuario. La UI utiliza el contrato de salud existente; no implementa un probe de inferencia API. Verificación autenticada contra los servicios reales pendiente.

## Corrección solicitada — 2026-10-09

Lectura de BD local confirma conexión predeterminada Gemini ID 3, API deshabilitada y Web/Agentic habilitados. No existe fila de acción `ai:manage`; el backend autoriza a `super_admin` sin esa fila, pero el topbar omitía esa excepción y ocultaba el grupo. Frontend reconciliado con la regla real; tres modos visibles y deshabilitado explícito, sin activar flags ni iniciar inferencias. Regresiones del rol con actions vacío y del modo API desactivado añadidas.

Verificación de cierre del 2026-10-09: Client 1018 pruebas/167 archivos, tipado/lint/build correctos; 3 regresiones del permiso Server correctas. QA Edge Chromium con fixtures de `src/test/manual/topbar-health/`: 320/390/600/1280 px, ES/EN, claro/oscuro, tres controles de 44 px sin overflow; ausencia de intersecciones a 320 px, teclado y navegación exacta comprobados. Capturas fuera del repositorio en la carpeta de visualizaciones local. No se acredita inferencia real ni se cambian credenciales/modos configurados.

## Verificación del botón manual — 2026-11-06

ClientR32 adoptado y verificado:17 regresiones/2 archivos, tipos/lint correctos, build productivo aislado con3 overlays y1394 inputs R31 idénticos.185 archivos actuales,182 assets R31 y14 versiones legacy, MISS404 y una activación/recarga. ServerR12/NativeR14/SDK/auth/env/flags/timers preservados.

CUA autenticada comprobó un clic → un GET de salud200 y «Estado de IA actualizado», sin navegación, POST de inferencia o guardado comercial. Tooltip y retorno de foco por teclado, geometría44px y ausencia de overflow en320/599/600/1088px. En599 sigue en fila2 y en600 pasa a fila1; no se añadió breakpoint. La captura320 inicial desincronizada del compositor no se usa como aceptación; se repitió desde un tab ya creado a320 y se inspeccionó el bitmap. Datos previos/error/doble clic/EN se cubren en unidad; la respuesta real rápida no permitió observar carga pendiente en ese clic. Las capturas no acreditan teléfono físico ni latencia del proveedor.

## Padding inferior de la cabecera — 2026-11-06

Por solicitud del usuario, TopbarRoot aplica padding inferior0 en la regla base y desde md900; mantiene sus paddings superior/laterales, min-height y cambio de fila sm600 existentes. El cambio pertenece al header compartido, no al PageContent. No cambia consultas, estado de IA, permisos, acciones o datos.

ClientR33 activo desdeR32 con un solo archivo de producción.17 regresiones existentes/2 archivos, tipos/lint y build aislado correctos. CUA autenticada ES/oscuro compara320/600/1088px: padding12/12/16→0 y altura132/80/88→120/68/72, sin overflow. Targets de IA44px y controles permanecen dentro del ancho. Se restauró el viewport y se cerró sólo la pestaña QA. No acredita teléfono físico ni nuevos estados/proveedores. [Evidencia](../../evidence/topbar-bottom-padding-20261106-r01.json).
