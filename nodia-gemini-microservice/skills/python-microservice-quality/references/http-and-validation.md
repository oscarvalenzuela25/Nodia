# HTTP, ASGI, archivos y validación

Leer para rutas, schemas, multipart, streams, middleware o errores. Aplicar FastAPI/Pydantic solo si son herramientas del proyecto; confirmar versiones y comportamiento concreto.

## Contratos tipados y adaptación

- Ubicar contratos estables en módulos sin efectos de inicialización. Anotar firmas de rutas/adaptadores y validar la salida del proveedor antes de devolverla.
- En FastAPI, usar modelos de entrada/salida y dependencias/lifespan cuando representen el contrato real. No introducir JWT, DB, CORS abierto o componentes de una plantilla sin necesidad.
- En Pydantic, confirmar major version y su comportamiento de coerción/serialización. Definir validadores y restricciones de campo explícitos; no copiar decoradores/configuración de otra versión.
- Un TypedDict sirve al checker, no valida un JSON runtime. Tampoco un `cast`, una dataclass simple o una annotation evita `None`, bool o estructuras equivocadas.
- Definir opcionalidad/defaults y política de extras por operación. Comandos estrictos pueden rechazar extras; respuestas/eventos versionados pueden necesitar tolerancia compatible. No aplicar reglas de actualización parcial propias de otro recurso.
- Para números, comprobar finitud, rango y unidad del dominio. bool es subtipo de int en Python: verificar que no pase como cantidad/importe si el contrato lo rechaza. Decidir si un string numérico se admite deliberadamente.
- Decimal/enteros de unidad menor pueden ser apropiados para dinero; definir serialización y redondeo. No convertir importes a float solo para que JSON acepte la respuesta.
- Mantener cantidad cero/faltante diferenciados. Si la extracción es incompleta, conservar `None` o error según contrato; no imponer uno/cero por fallback. Derivar un valor solo de factores válidos y una regla acordada.
- JSON de IA: validar un documento estructurado, límites de tamaño/items, productos y campos necesarios. No rescatar líneas/números corruptos con regex para aparentar extracción válida. Decidir política de keys duplicadas y envoltura de markdown explícitamente.
- Si se parsea manualmente `Request`/multipart para controlar orden/límites, mantener el schema OpenAPI/requestBody cuando el proyecto lo use; declarar `Request` no documenta automáticamente el body.

## Orden de admisión y límites

- Autenticar llamadas privadas antes del trabajo costoso. La aplicación/ASGI debe contar bytes reales donde se recibe el cuerpo; `Content-Length` es una comprobación complementaria.
- En FastAPI/Starlette, un parámetro `File`/`Form` puede provocar parsing antes de la lógica del handler. Un límite dentro de la ruta no prueba que el body estuvo acotado antes de crear spool/partes.
- Revisar middleware y proxy reales: memory buffering, número de archivos/campos, tamaño de campo, archivo y cuerpo, timeout de upload y simultaneidad. Un límite por parte no es necesariamente un límite global de archivo.
- Si se necesita buffering previo, acotarlo y cerrarlo en todas las salidas. Presupuestar las copias de spool + parser + temporal/SDK; streaming no elimina la necesidad de límites.
- Adquirir capacidad antes de parser/temp cuando sean los recursos protegidos. En saturación devolver categoría y plazo propio si está definido, sin leer todo el cuerpo como condición previa.
- Definir si se acepta exactamente un archivo, campos repetidos/desconocidos y configuración JSON. Tratar duplicados sin depender de cuál valor escoge un dict.
- Al finalizar, cerrar el formulario/UploadFile, archivo interno y temporal incluso si falló validación, parseo o llamada SDK. No borrar una ruta derivada del filename remoto.
- Validar extensión/formato declarado junto con firma y cualquier requisito semántico necesario. Para PDFs/imágenes comprimidas, evaluar límites de página/píxeles/decode si ese procesamiento se realiza localmente.
- Usar lecturas por chunks y verificar límite incremental. No leer la factura entera varias veces en RAM ni hacer un `read()` ilimitado de una respuesta remota.

## Middleware, streams y cancelación

- Elegir middleware compatible con contexto, streaming y cancelación. Middleware ASGI directo puede ser apropiado para controlar receive/send; no reemplazar otros patrones sin motivo.
- No consumir `receive` en dos tareas simultáneas mientras entra el body. Si existe replay de un body ya validado y watcher de desconexión, definir fases y cleanup de ambos.
- Propagar los mensajes ASGI correctos y no iniciar una segunda respuesta después de `http.response.start`. Los errores de streaming después del start necesitan diagnóstico/cierre; no se pueden convertir en un JSON nuevo.
- Desconexión no tiene respuesta HTTP útil para el cliente; registrar su clasificación interna sin simular que se envió un status. Cancelar y esperar tareas propias, liberar recursos y preservar cualquier resultado remoto incierto.
- Middleware de identificación debe cubrir rechazos de autenticación, parser, timeout y errores inesperados. Generar/validar IDs de tamaño acotado y no duplicar headers arbitrariamente.
- Mantener el body/error seguro incluso en validación: un error de Pydantic/SDK puede incluir el input, credenciales o texto del documento. No serializar íntegramente `.errors()` ni `str(error)` sin sanitización.

## Categorías y transporte

- Adoptar códigos/error envelope del proyecto, incluyendo correlación y headers pertinentes. Distinguir entrada inválida, tipo/tamaño, acceso, conflicto, saturación/cuota, timeout, dependencia no disponible y payload remoto inválido.
- HTTP permite categorías diferentes según contrato: 4xx para entrada/autorización/conflicto, 429 para tasa/cuota, 5xx para fallos internos/dependencias. No fijar una única tabla universal si el gateway tiene una semántica aprobada distinta.
- Preservar Retry-After cuando sea válido y útil; no convertir una fecha arbitraria o texto del proveedor en un header sin validar. Si se usan segundos, definir rango y origen del dato.
- Traducir exceptions del SDK en el adaptador responsable. Reintentar solo las clases reconocidas permitidas; el handler HTTP no debe repetir otra vez un análisis que ya reintentó el SDK.
- En clientes HTTP, configurar timeout de transporte y límite de lectura/respuesta. `raise_for_status` no sustituye validar la estructura de un éxito ni decidir qué mensaje del proveedor se puede exponer.
- Liveness pública mínima solo si la política lo permite. Estado de sesión, catálogos, docs, login y análisis pueden requerir protección separada según el proyecto; CORS no la proporciona.

## Pruebas para estas garantías

- Body fragmentado/sin Content-Length supera el límite antes del parser y no llama al adaptador.
- Saturación no crea temporales ni invoca SDK; slots disponibles tras timeout/error/desconexión.
- Archivo inválido, partes duplicadas, JSON corrupto y modelos ausentes tienen resultado seguro y determinista.
- Payload externo con cero/nulo/bool/NaN/Infinity/strings/listas corruptas respeta el contrato sin fabricación.
- Error de auth/parser/adaptador conserva ID/categoría; secrets/OCR de un error simulado no aparecen en body/log público.
- Response/request schema refleja multipart y requisitos cuando exista generación OpenAPI. No limitarse a probar que la ruta devuelve 200.
