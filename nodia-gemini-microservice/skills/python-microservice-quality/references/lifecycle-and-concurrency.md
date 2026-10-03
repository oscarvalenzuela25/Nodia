# Ciclo de vida, recursos y concurrencia Python

Leer al cambiar imports, startup/shutdown, clientes, perfiles, tareas o ejecución async. Verificar las APIs contra la versión/runtime del repositorio antes de implementar.

## Imports y ownership

- Separar definiciones puras de ejecución. Evitar en módulo `load_dotenv`, instanciación de clientes con credenciales, `mkdir`, lectura de cookies/perfiles y scheduling. Un script CLI debe ejecutar esas acciones en su entrypoint explícito.
- Un objeto de aplicación puede registrar rutas sin conectar servicios. Introducir fábrica y lifespan/contexto cuando permitan configurar producción y tests sin cambiar globals después de importar.
- Definir quién cierra un recurso inyectado: propiedad de la aplicación o prestado por el caller. Aplicar esa decisión coherentemente en tests; no cerrar indiscriminadamente un cliente compartido ajeno.
- Validar configuración obligatoria antes de abrir recursos. Si falla una inicialización posterior, cerrar los anteriores y el candidato fallido; construir un SDK no demuestra que su `init` terminó.
- Usar `ExitStack`/`AsyncExitStack` cuando simplifiquen múltiples recursos o inicialización parcial. Para un recurso sencillo, un `try/finally` o context manager claro basta.
- Separar liveness/readiness de inicialización exitosa de dependencias: el contrato decide si una sesión caída impide arrancar o produce un estado degradado. No mantener una marca de disponibilidad después de sustituir/cerrar el cliente.

## Cancelación y cierre

- Mantener cleanup en `finally`; propagar `CancelledError` después de liberar lo que pertenece a la operación. No convertir desconexión del usuario en fallo de cuota ni en éxito vacío.
- Un timeout cancela la espera/tarea según la API, pero no demuestra cancelación de efecto remoto, thread o CPU. Identificar el resultado incierto y conservar protección contra duplicados si hay efectos.
- Si el cierre async debe resistir otra cancelación, usar un mecanismo protegido solo con handle y presupuesto definidos; esperar su conclusión o registrar/gestionar su estado. `shield` no autoriza dejar trabajo infinito sin dueño.
- Para tareas hermanas, observar todas las excepciones y cancelar/esperar las pendientes cuando una termina o falla. Usar concurrencia estructurada si la versión lo permite y encaja con el tratamiento de errores; no dejar `create_task` sin propietario.
- Un watcher de desconexión ASGI debe coexistir con un único dueño del receive de cada fase. No permitir que dos consumidores se roben fragmentos del body. Al terminar procesamiento, cancelar y esperar el watcher.
- Un endpoint timeout no cancela automáticamente el trabajo SDK remoto. Documentar lo que puede seguir ejecutándose; no reintentar para ocultar un trabajo incierto.
- Shutdown: detener admisión, cancelar/esperar trabajos dentro del grace period y cerrar clientes/navegadores. Registrar trabajo recuperable según contrato; la terminación forzada del proceso no garantiza persistencia.

## Async, threads, CPU y subprocess

- No usar `asyncio.run` dentro de un event loop activo ni construir un cliente async en un loop y usarlo desde otro. Cada cliente/tarea debe seguir el ciclo de vida del loop que lo posee.
- Preferir SDK/driver async cuando exista y sea compatible. Para IO síncrono, ejecutar fuera del loop solo si hace falta y con capacidad acotada; no enviar CPU prolongada a threads asumiendo paralelismo adecuado.
- Para CPU, escoger proceso/trabajo separado o librería que libere el GIL según medición y arquitectura. No crear un process pool por petición ni enviar sesiones/objetos no serializables.
- Cancelar `to_thread` o un future no detiene el thread. Evitar liberar su cupo o borrar su archivo mientras sigue usándolo; el recurso/capacidad debe permanecer asociado al trabajo real hasta terminar o aislarlo en una unidad terminable.
- El SDK síncrono necesita sus propios timeouts de transporte. Si no tiene cancelación cooperativa, declarar la limitación antes de prometer un límite total duro.
- Subprocess: pasar argumentos estructurados sin shell/interpolación de datos, acotar salida/tiempo, tratar retorno no cero y cerrar stdout/stderr. Para proceso creado y propiedad del servicio, timeout/shutdown requieren terminarlo y esperar su salida; no matar procesos ajenos.
- No lanzar un agente/herramienta con acceso a todo el repositorio para procesar un documento remoto. Su permisos, cwd, herramientas y filesystem deben corresponder al flujo autorizado; el prompt del documento no puede ampliar ese acceso.

## Admisión, locks y perfiles

- Crear locks/semaphores por aplicación/loop, con alcance explícito. Adquirir capacidad antes de reservar temporales o invocar trabajo costoso; configurar número de cupos y tiempo de espera.
- Liberar únicamente cuando se adquirió y terminó el trabajo que consume el recurso. Usar context managers cuando sus garantías encajen; no incrementar un semáforo ante un acquire fallido.
- Evitar deadlocks por orden inconsistente, acquire anidado del mismo lock o `await` externo prolongado dentro de una sección crítica. Una lock corta protege transición; la recuperación en vuelo puede compartirse con un handle.
- Un login por perfil necesita exclusión y cancelación confirmada antes de reutilizarlo. Un estado `cancel_requested` no prueba que el navegador cerró el perfil.
- Navegador/contexto/página/driver requieren cierre incluso si falla launch/init. Mantener los handles para cierre parcial y no sustituir un perfil bloqueado por otro sin la política del proyecto.
- Locks de proceso no coordinan volúmenes/perfiles usados por múltiples workers. Antes de escalar, decidir storage/coordination compatible o declarar un solo propietario. No imponer un único worker a servicios stateless sin este problema.

## Persistencia y caché de sesión

- Escribir sesión/configuración de forma atómica en un temporal del mismo filesystem, con permisos adecuados, validación y reemplazo; limpiar el temporal ante fallo. Considerar fsync y compatibilidad de permisos/plataforma cuando la durabilidad lo requiera.
- Preservar campos ajenos. Reescribir `.env` o un JSON a partir de solo la credencial nueva puede borrar configuración. La configuración semilla puede ser de solo lectura; usar el storage runtime ya definido sin hacer writable un secreto por comodidad.
- Separar cliente candidato del activo. Publicar el reemplazo solo después de init validado, invalidar caché de sesión y cerrar el anterior según el tratamiento de trabajos en vuelo.
- Asociar lecturas de estado/cuota a generación de sesión. Compartir lectura concurrente dentro de esa generación y descartar su resultado si cambió antes de publicarlo.
- No reusar un dict cacheado mutable entre callers si pueden modificarlo. Construir copias/valores inmutables según costo y contrato.
- Si la integración depende de atributos privados del SDK, encapsular el acceso y probar su semántica ante fallos/versiones. Preferir API pública comprobable y registrar riesgo de compatibilidad.

## Pruebas de valor para estos cambios

- Importar/reimportar sin dotenv, mkdir, clientes ni navegador. Instalar las guardas antes del import bajo prueba.
- Fallar después de crear un cliente/browser y comprobar cierre parcial; después permitir otra inicialización correcta.
- Cancelar durante espera, upload y ejecución; comprobar cierre/cupo y recuperación. Para thread/subprocess, comprobar que el trabajo real termina o permanece contabilizado.
- Dos recuperaciones simultáneas no duplican renovación; un cambio de sesión con resultado viejo en vuelo no contamina la nueva.
- Shutdown con trabajo activo no deja tareas sin observar ni perfil inutilizable. Usar eventos/barriers, no sleeps largos para ganar una carrera.
