---
name: nestjs-service-quality
description: "Implementar, corregir o auditar APIs y servicios NestJS con autorización efectiva, DTOs validados en ejecución, casos de uso comprobables, persistencia transaccional y composición DI/ESM correcta. Aplicar a controladores, guards, pipes, módulos, DTOs, casos de uso, TypeORM, pruebas y configuración NestJS; complementa calidad backend general, no aplica a un backend sin NestJS ni impone reglas particulares de un producto."
---

# NestJS Service Quality

Cerrar diferencias entre tipos TypeScript, decoradores declarados y comportamiento real del servicio. Aplicar al flujo modificado, desde la entrada hasta persistencia, dependencias y respuesta.

## Encajar con el proyecto

- Leer AGENTS, contratos y decisiones aplicables. Respetar la arquitectura, runner y capas de pruebas autorizadas; las instrucciones del usuario y las reglas locales prevalecen.
- Si está instalada `backend-service-quality`, usarla para integridad, idempotencia, aislamiento, recursos y recuperación generales. Esta especialización funciona también sola: comprobar autoridad, contrato ejecutado, efecto completo, límites y errores del flujo.
- Revisar versiones realmente instaladas de Nest, adaptador HTTP, TypeORM, validadores, compilador y runner; los ejemplos oficiales pueden corresponder a otra versión. No migrar framework, ORM ni runner por activar esta guía.
- No convertir un API modular en microservicios ni imponer CQRS, DDD, colas o request scope sin necesidad demostrada. Conservar el patrón local y reducir dependencias circulares.
- Para una edición documental validar contenido/enlaces. Para un cambio de comportamiento seleccionar referencias y regresiones pertinentes; esta skill no exige iniciar DB, Redis ni servicios reales para toda tarea.

## Preparar el cambio

1. Mapear ruta/mensaje → guards/pipes/interceptores → caso de uso → datos/dependencias → respuesta. Localizar actor, ámbito y operaciones que producen efectos.
2. Expresar la garantía que falta: rechazo por permiso, conservación de dato inválido para corrección, actualización indivisible, resultado idempotente o límite efectivo. Contrastar implementación y tests, no confiar en el nombre del método.
3. Verificar rutas alternativas, aliases, exportaciones, workers y llamadas internas que lleguen a la misma regla. Consultar las fuentes de producto antes de inventar permisos o semántica de stock.
4. Elegir la referencia según el cambio; leer solo secciones relacionadas. Mantener un caso que falle con el defecto anterior y una expectativa observable.

## Autorización y contratos HTTP

- Mantener una política explícita por operación. Un guard de acciones que retorna `true` al faltar metadata necesita detección de rutas sensibles sin policy. Las excepciones públicas/propias deben ser deliberadas.
- Confirmar orden y registro de guards globales. Autorización consume identidad autenticada; no asumir que el orden de imports crea el orden requerido. Revisar `APP_GUARD`, `useExisting`, instancias y metadata de método/clase según la composición real.
- Transmitir un contexto de actor validado al caso de uso y aplicar pertenencia al recurso en consultas/mutaciones. Un UUID válido, JWT válido o permiso global no demuestra acceso al negocio de la factura ni a su archivo.
- Usar clases DTO reales cuando el pipe necesite metadata runtime. Interfaces, `Partial<T>` y otros tipos estáticos no son validadores. Conservar imports de valor para clases que participan en metadata/DI.
- Definir update/query/params con campos permitidos. No heredar todos los campos Create si algunos son inmutables o administrativos. Validar de nuevo el comando si una mezcla posterior cambia lo que se ejecuta.
- Transformar solo representaciones aceptadas; rechazar números/JSON inválidos en vez de producir `0`, `{}`, `[]` o éxito vacío. Validar contenido anidado, rangos y tamaño; `@IsObject()` no describe su contenido.
- Leer [references/authorization-and-dtos.md](references/authorization-and-dtos.md) para permisos, rutas, composición de entradas, serialización y contratos.

## Casos de uso y persistencia

- Mantener controladores delgados: adaptación del transporte y delegación. Ubicar reglas de negocio en la capa que define el repositorio; evitar casos de uso vacíos cuyos tests simulan toda la lógica en un servicio.
- Mantener acceso a datos y reglas separables. El caso de uso coordina el flujo y autoridad; las operaciones de persistencia aceptan el ámbito y contexto transaccional necesarios.
- Para una operación indivisible, todos los repositorios participantes deben derivarse del manager transaccional. Un `save` previo o repositorio inyectado global usado dentro del callback puede quedar fuera.
- Respaldar invariantes concurrentes con constraints/locking/actualizaciones condicionales apropiadas. No confiar en comprobar antes de guardar para unicidad, stock o último administrador.
- Parametrizar valores y mapear identificadores, relaciones, dirección y predicados desde una lista permitida. El QueryBuilder no vuelve seguro un fragmento SQL interpolado.
- Acotar paginación, arrays bulk y exportaciones; `all=true` no debe saltar límites por defecto. Revisar consultas por conjuntos y orden estable con volumen representativo.
- Cuando se use ESM con metadata de decoradores, comprobar ciclos de entidades/DI y el código emitido. Para relaciones TypeORM usar `Relation<T>` cuando corresponda, conservando los targets de decoradores; no ocultar problemas con `any` o `forwardRef` indiscriminado.
- Leer [references/persistence-and-esm.md](references/persistence-and-esm.md) para escrituras, consultas, migraciones y composición.

## Pruebas y operación

- Probar decisiones y efectos de la implementación real. `expect(service.update).toHaveBeenCalled()` comprueba delegación, no permiso, transacción ni integridad. No simular precisamente la regla bajo prueba.
- Cumplir la política local sobre ubicación y tipos de tests. Usar integración aislada cuando constraints, locks, SQL o DI no puedan demostrarse mediante mocks; no crear suites prohibidas por el proyecto ni afirmar una garantía no verificada.
- Diferenciar compilar, ejecutar tests con transpiler e iniciar el código compilado. Un runner puede manejar metadata/imports de forma distinta de Node; el build correcto no prueba la composición del módulo.
- Revisar límites antes de parsing/trabajo costoso, deadlines y cancelación de dependencias. Cerrar clientes/streams y habilitar shutdown apropiado. Un límite de archivo no equivale a admisión concurrente ni límite total multipart.
- Responder con errores estables y datos públicos permitidos. Evitar excepciones que incrustan mensajes brutos de DB/SDK y objetos arbitrarios con secretos anidados.
- Validar configuración efectiva, scripts, lockfile y auditoría; comprobar la configuración que usa el comando, no solo el archivo presente. No aplicar arreglos masivos de dependencias sin evaluar compatibilidad.
- Leer [references/testing-and-runtime.md](references/testing-and-runtime.md) para regresiones, DI/arranque y entrega.

## Cierre

Ejecutar checks exigidos y afectados. Informar cambios, comportamiento probado y límites de evidencia: mocks, DB aislada, servicios reales o despliegue. Si un hallazgo permanece abierto, registrarlo con prioridad y aceptación concreta; instalar esta skill no lo corrige automáticamente. No crear planes/documentos temporales si el repositorio ya mantiene el seguimiento.
