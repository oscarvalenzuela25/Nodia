# Entrevista — Operación de proveedores de IA

> Estado: en revisión (entrevista cerrada como borrador; no aprobada)
> Inicio: 2026-09-25
> Alcance: ampliación requerida por el usuario antes de producción; pendiente de reconciliar con documentos aprobados de la Parte 1

## Problema y objetivo expresados por el usuario

- El análisis de facturas usa un microservicio local que interactúa con Gemini Web mediante una sesión de navegador. La sesión puede caducar y hoy se recupera abriendo un `.bat` para iniciar sesión con Playwright.
- Se desea una sección de IA en Ajustes Generales. Su entrada mostraría el estado de los proveedores y permitiría a personas autorizadas resolver problemas de autenticación sin acceso directo al servidor.
- Se desea poder configurar credenciales de API además de sesiones web. El usuario llama «token plan» a la vía que utiliza la suscripción mediante sesión web; técnicamente no equivale a una API key. Gemini comienza con token plan y podrá cambiar manualmente a API key cuando el usuario lo decida. Mistral comienza con API key. Cada proveedor tiene una sola vía elegida a la vez, y Gemini y Mistral pueden estar disponibles simultáneamente.
- Habrá una tabla de API keys con relación uno a muchos por proveedor. Cada proveedor puede tener varias keys. Se selecciona una key principal y existe un switch para habilitar cambio automático entre keys de ese proveedor: ante fallo pertinente, marcar la actual para revisión y reintentar **la misma factura** con la siguiente hasta obtener éxito o agotar las keys. El cambio entre token plan y API key seguirá siendo manual.
- El acceso a estas configuraciones será mediante permisos asignados a roles. La configuración es global para la plataforma, no por negocio ni por usuario.
- El usuario propuso inicialmente una tabla de proveedores de IA con `id`, `api_key` como arreglo, `fields` JSON, `is_active`, `created_at` y `updated_at`.
- `fields` significa configuración extensible con los campos técnicos que cada proveedor o modo necesite; no son las reglas de extracción comercial de `providers.fields`.
- El usuario desea alojar NestJS y el microservicio Gemini en un VPS, en parte para aprender a gestionarlo. Cloudflare Pages se conserva para frontend, R2 para archivos, y PostgreSQL (Neon o Northflank) y Redis pueden ser gestionados externamente. Esta capacidad es requisito para publicar Nodia y dejarla operativa durante un periodo prolongado. El comportamiento actual de análisis de facturas debe conservarse.
- El usuario acepta que el perfil del navegador y las cookies de Gemini Web estén en un volumen persistente de Docker y que la configuración administrable esté en la base de datos.
- El usuario quiere que un botón en el frontend abra una pestaña temporal para operar el navegador de login que corre en el VPS, parecido a un selector de cuenta de Google. La cuenta usada actualmente requiere solo usuario y contraseña, sin confirmación telefónica.
- El usuario no requiere alertas proactivas si caduca la sesión Gemini: ya hay verificación en el momento de uso, y puede seguir usando Nodia sin Gemini mientras se reloguea.
- El usuario quiere que `verify-ia-providers` responda según la disponibilidad real de la vía configurada para cada proveedor. La petición `analyze` solo envía el proveedor y el backend resuelve desde la BD si ese proveedor utiliza token plan o una API key activa.
- Si una key falla, el usuario quiere una alerta visible en la aplicación para revisarla; la clasificación exacta depende del error. No pidió por ahora un envío externo de notificaciones.
- Gemini y Mistral pueden estar disponibles simultáneamente. `verify-ia-providers` informa cuáles están utilizables, y la interfaz renderiza botones solo para los proveedores activos; la persona elige el proveedor para cada factura.
- Si se agotan las keys del proveedor elegido, el análisis falla para esa factura. No hay cambio automático a otro proveedor ni entre token plan y API key.
- La alerta de key fallida queda en Ajustes Generales para roles autorizados, junto con feedback a quien analizó la factura; no se pide correo.
- La primera entrega administra Gemini y Mistral. Cada adaptador tendrá `fields` tipados; agregar un proveedor ejecutable nuevo requiere código además de registros en BD.

## Hechos observados en el repositorio

- `nodia-gemini-microservice` expone estado, login interactivo y renovación silenciosa. El login actual abre Chrome **en la máquina que ejecuta el microservicio**; un frontend remoto no vería esa ventana por el solo hecho de llamar el endpoint.
- El microservicio declara CORS con `allow_origins=["*"]` y sus endpoints de autenticación no implementan autorización propia. En VPS deberán quedar inaccesibles desde Internet y ser mediados por la API de Nodia con permisos.
- La sesión Gemini actual guarda cookies en `.env`/`session_state/` y conserva un perfil en `browser_profile/`. `ADR-005` propone Gemini Web como único adaptador Gemini y deja la API key fuera de ese cambio; el ADR sigue propuesto.
- NestJS usa Gemini y Mistral como proveedores. Mistral utiliza una API key de entorno. La verificación actual de proveedores informa `mistral: true` sin comprobar su credencial o disponibilidad.
- La importación de facturas permite elegir Gemini o Mistral en cada operación. Si no se envía selección, NestJS prefiere Gemini cuando su configuración de entorno parece disponible. La preferencia del usuario sobre conservar o sustituir esta selección por una configuración global está pendiente.
- Mistral actualmente captura su API key al construir el servicio desde `MISTRAL_API_KEY` y reintenta errores transitorios hasta tres veces. Para rotación dinámica desde BD deberá consultar/inyectar la key por intento y distinguir errores de credencial/cuota de caídas del proveedor; el comportamiento de OCR y Vision debe preservarse.
- El esquema JSON de Obsidian citado por el usuario no contiene todavía entidades de proveedores de IA. Existe otra entidad `providers` para proveedores comerciales; su campo `fields` describe reglas de extracción de productos, no credenciales de modelos de IA.
- El PRD V2 aprobado limita la Parte 1 del MVP a autenticación, autorización y Ajustes Generales básicos. La nueva sección debe definirse como ampliación posterior o actualizar explícitamente ese alcance.
- El documento DevOps aprobado históricamente especifica Cloudflare Pages para frontend, Northflank para API y PostgreSQL, y excluye Docker en el MVP. Se conserva Cloudflare Pages; NestJS pasa a VPS, PostgreSQL queda por decidir entre Neon/Northflank y Docker se incorpora para el microservicio. Esto obliga a revisar los documentos de despliegue afectados.

## Inferencias por validar

- El estado del proveedor podría distinguir servicio inaccesible, sesión vencida, credencial inválida, límite de uso y disponible. `is_active` solo expresaría una decisión administrativa.
- Una clave por fila permitiría prioridad, rotación, activación y auditoría individual; un arreglo de claves en una sola celda dificulta esas operaciones.
- El acceso remoto a un login de navegador requiere diseñar una sesión de navegador visible/operable por la persona autorizada o un mecanismo de vinculación distinto. Es una decisión de infraestructura y seguridad, no solo de interfaz.
- El uso no oficial de Gemini Web mediante automatización tiene riesgo de cambios técnicos, límites y condiciones del proveedor; verificar la política aplicable antes de depender de esta vía en producción. Fuente a revisar: https://policies.google.com/terms y documentación de Gemini Apps.

## Primera ronda respondida

1. VPS para NestJS y el microservicio; frontend en Cloudflare Pages, R2 para archivos, PostgreSQL y Redis gestionados externamente.
2. Gemini Web y Gemini API serán modos intercambiables por elección administrativa, sin fallback automático entre modos.
3. La gestión de IA es requisito previo a producción; se debe mantener la función actual de facturas.
4. Acceso mediante roles; configuración global de plataforma.
5. `fields` extensible para parámetros específicos de cada proveedor.

## Segunda ronda respondida o parcialmente respondida

1. Despliegue aclarado como híbrido: VPS para API y microservicio; servicios gestionados para datos, frontend y archivos.
2. Quiere un botón en el frontend que abra una pestaña temporal para operar el navegador del VPS.
3. La selección actual Gemini/Mistral por factura sigue sin respuesta explícita.
4. Una tabla de API keys por proveedor, una key seleccionada y un switch de rotación automática entre keys del mismo proveedor. Key fallida marcada con problema. Pendiente concretar qué errores activan la rotación y qué sucede al agotar todas.
5. Toda la IA se protege por roles. Pendiente concretar claves de acciones y qué operaciones se delegan.

## Opciones de login remoto por evaluar

- Sesión temporal de navegador remoto en el VPS, lanzada desde el panel y visible mediante noVNC o tecnología equivalente. Playwright usa el perfil persistente y el servidor extrae las cookies al terminar. Requiere aislamiento, proxy autenticado y cierre por tiempo/inactividad.
- Acceso operativo al escritorio remoto del VPS por VPN/túnel. Reduce integración de UI, pero obliga a conceder acceso operativo al servidor y no cumple tan bien el flujo desde el panel.
- Carga manual de cookies desde un navegador local. Menor infraestructura inicial, pero manejo manual de secretos sensibles y mayor fragilidad.

## Tercera ronda respondida o parcialmente respondida

1. La pregunta sobre selección Gemini/Mistral por factura no quedó clara para el usuario; reformular con ejemplo concreto.
2. Pestaña temporal elegida.
3. La cuenta actual solo usa usuario y contraseña.
4. Se eligió un switch de rotación automática entre keys; falta clasificar fallos.
5. No se requieren alertas proactivas; verificación al usar IA y estado en panel.

## Cuarta ronda respondida o parcialmente respondida

1. El análisis envía el proveedor; el backend elige la vía activa desde BD. La pantalla actual tiene botones separados Gemini/Mistral, por lo que la interpretación de trabajo es conservarlos; confirmar si un proveedor puede estar activo en paralelo al otro.
2. Ante fallo de una API key, reintentar la misma factura con la siguiente hasta éxito; marcar keys fallidas para revisión. La clasificación exacta de fallos queda pendiente.
3. El resultado al agotarse todas las keys sigue pendiente.
4. Alcance de proveedores iniciales y presentación de `fields` siguen pendientes.

## Quinta ronda respondida

1. Sí: ambos proveedores pueden estar disponibles; la persona escoge en cada factura entre botones de proveedores activos.
2. Sí: aviso persistente en Ajustes Generales y feedback al usuario afectado, sin correo.
3. Sí: error al agotar todas las keys, sin fallback a otro proveedor o modo.
4. Sí: Gemini y Mistral primero; `fields` tipados por proveedor y adaptadores nuevos mediante código.

## Resultado de la entrevista

Las decisiones de producto confirmadas se transformaron en [especificación de entrega para agente](16-ai-provider-management-handoff.md). Ese documento permanece en revisión hasta aprobación explícita.

## Decisiones pendientes antes de especificar implementación

- Reconciliar el despliegue híbrido con VPS y la ampliación previa a producción con los documentos aprobados del MVP.
- Probar en VPS que el navegador remoto permite iniciar sesión con la cuenta real, capturar cookies, reiniciar y recuperar el perfil antes de implementar toda la UI.
- Clasificar errores específicos por adaptador para rotación de keys y definir periodos de enfriamiento; se propone una política en el documento de entrega.
- Reconciliar alcance, permisos, despliegue y documentación técnica sin aprobar documentos automáticamente.
