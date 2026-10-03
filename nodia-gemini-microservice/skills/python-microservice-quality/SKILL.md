---
name: python-microservice-quality
description: "Implementar, corregir o revisar servicios Python, APIs y workers con inicialización controlada, contratos tipados, concurrencia acotada, limpieza ante cancelación y pruebas aisladas. Usar al cambiar ciclo de vida, transporte, adaptadores externos, archivos, tests o runtime de un servicio Python; no exige FastAPI, Pydantic, pytest ni convertir un monolito en microservicios."
---

# Python Microservice Quality

Aplicar los mecanismos de Python que evitan efectos al importar, bloqueo del event loop, recursos abandonados y validaciones ficticias. También sirve para una API monolítica o un worker Python con estos problemas; no activa una auditoría de cualquier script por contener Python.

## Encajar y componer

- Leer instrucciones y contratos locales. Confirmar versión de Python, framework, manifiesto/lockfile, entrypoints y runner realmente usados antes de proponer APIs, configuración o dependencias.
- Las reglas explícitas del usuario y del proyecto prevalecen sobre los ejemplos de esta skill. No imponer arquitectura, framework, credencial, runner, ORM o servicios externos.
- Si `backend-service-quality` está disponible y aplica, usarla para autorización, integridad, idempotencia e identidad de integraciones. Esta especialización define el mecanismo Python y puede usarse sola; no requiere instalar otra skill para continuar.
- Conservar código/datos de trabajo ajenos. No leer ni copiar secretos, perfiles o sesiones de producción para construir fixtures. Modificar tooling o despliegue solo dentro del alcance autorizado.
- Leer referencias condicionalmente; un cambio de documentación no requiere levantar Python, navegador, contenedores o una cuenta real.

## Preparar el cambio

1. Seguir el camino del entrypoint a imports, inicialización, procesamiento y shutdown. Localizar efectos de módulo, ownership, estado global y límites por proceso.
2. Identificar dónde entran datos no confiables y cuándo se consumen memoria, disco, CPU, conexiones o cuota. Verificar qué valida realmente el framework/SDK y qué solo documenta.
3. Elegir pruebas que demuestren la garantía afectada sin red ni recursos operativos. Revisar el adaptador y sus retries internos antes de añadir recuperación.
4. Seleccionar la referencia pertinente:

| Trabajo | Referencia |
|---|---|
| Imports, startup/shutdown, sesiones, async, threads o tareas | [lifecycle-and-concurrency.md](references/lifecycle-and-concurrency.md) |
| HTTP/ASGI, uploads, esquemas, errores o serialización | [http-and-validation.md](references/http-and-validation.md) |
| Runner, mocks, dependencias, contenedor, workers o operación | [testing-and-runtime.md](references/testing-and-runtime.md) |

## Invariantes Python

### Inicialización y configuración

- Importar un módulo de aplicación no debe abrir conexiones, iniciar navegador/tareas, renovar sesiones, leer credenciales operativas ni crear archivos/directorios. Constantes puras, modelos, clases y registro de rutas son apropiados.
- Cargar/validar configuración e inicializar recursos desde un entrypoint o ciclo de vida explícito. Para librerías existentes con efectos, encapsular/adaptar dentro del alcance; no ocultar el problema moviéndolo a otro import.
- Separar construcción de aplicación/servicio de ejecución. Inyectar adaptadores, configuración, reloj o directorios cuando permita aislamiento real; no añadir un contenedor de DI si una fábrica o constructor basta.
- Definir qué configuración falla el arranque y qué dependencia no disponible permite continuar degradado según contrato. No devolver readiness positiva por el mero hecho de construir un cliente.
- Evitar defaults de ejecución que cambien silenciosamente identidad o garantías. Nombres de proveedor, rutas de sesión, capacidades y límites se obtienen de fuentes/configuración comprobadas según el producto.

### Contratos y tipos

- Anotar firmas y contratos de entrada/salida relevantes, especialmente rutas, adaptadores y fronteras de ejecución. Mantener `Any` confinado donde el SDK/transporte aún sea desconocido y validarlo antes de usarlo; no aceptar `dict[str, Any]` como sustituto de contrato.
- Usar la herramienta de validación existente, compatible con su versión. Pydantic, dataclasses o TypedDict cumplen funciones distintas: un TypedDict o dataclass sin validación no sanea JSON remoto.
- Seleccionar coerción, opcionalidad y campos extras por contrato. Mantener números finitos, rangos, precisión y significado de cero/faltante; no convertir salida corrupta en datos válidos por comodidad.
- Unificar parsing/normalización compartida y validar antes de persistir o devolver el resultado. No duplicar parsers entre adaptadores.

### Async, recursos y concurrencia

- `async def` no vuelve asíncronos un SDK síncrono, disco, CPU ni subprocess. Usar APIs async, ejecución en thread/proceso o streaming adecuados a la carga; medir antes de añadir paralelismo.
- Acotar admisión antes del trabajo costoso; cola y espera también tienen límites. Un semáforo por proceso no limita todos los workers ni cancela un thread en vuelo.
- Asignar dueño a clientes, browsers, contextos, archivos, tareas, temporales y locks. Usar context managers/finally y cierre de startup parcial, timeout, cancelación y shutdown.
- No tragar `asyncio.CancelledError` ni transformarlo en éxito/error de proveedor. Hacer cleanup y propagar cancelación; una llamada remota puede seguir teniendo un resultado incierto.
- No crear tareas sin dueño que guarde el handle, observe su resultado y espere/cancele al cerrar. Evitar event loops anidados o clientes async compartidos entre loops incompatibles.
- Tratar locks y caché como estado de la aplicación/sesión, no globals casuales. Una respuesta en vuelo de una sesión reemplazada no debe publicar estado viejo en la nueva.

### HTTP y adaptadores

- Separar autenticación/admisión/parsing cuando el orden consume recursos o define seguridad. Para archivos, limitar cuerpo real antes del parser y el archivo después, incluyendo peticiones fragmentadas.
- Mantener endpoints como adaptación de transporte; lógica y SDK/navegador en módulos de aplicación/integración. Validar salida externa y respuesta pública.
- Clasificar fallos esperados y traducirlos a HTTP/mensajería con mensajes seguros y correlación. No devolver `str(error)`, trazas o cuerpos del proveedor al llamador.
- Acotar reintento, duración y tamaño de lectura. Revisar retries del SDK; conservar identidad/modelo/payload. Una cuota o timeout de generación no autoriza una segunda ejecución automática.
- No presentar sesión activa por una variable, perfil existente o cliente de otro motor. Las políticas de IA/proveedores pertenecen al proyecto; esta skill no impone prohibición global de keys ni catálogos concretos.

## Verificar y entregar

- Instalar aislamiento antes de discovery/imports de aplicación. Usar temporales para configuración, perfiles, caché y archivos; bloquear servicios externos por defecto en pruebas unitarias.
- Mantener el runner del proyecto y probar comportamiento, no formato de mocks. Cubrir import puro, inicialización parcial, cancelación, límite/admisión y cierre cuando cambie esa garantía; no ejecutar todas las variantes por una edición cosmética.
- Ejecutar los comandos locales de tipado/lint/tests/build pertinentes. No instalar mypy/ruff/pytest, reemplazar dependencias ni modificar CI solo porque sean ejemplos habituales.
- Si cambian dependencias o runtime, comprobar compatibilidad, resolución reproducible, consistencia y auditoría. `pip check` no es una auditoría de vulnerabilidades.
- Diferenciar simulación, Linux/Windows, navegador real, sesión real y despliegue. Declarar limitaciones de SDK y coordinación por proceso. No afirmar readiness por un TestClient con mocks o un `/health` 200.
