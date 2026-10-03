---
name: backend-service-quality
description: "Desarrollar, corregir o revisar APIs, backends monolíticos, microservicios, workers e integraciones con contratos comprobados, autorización por ámbito, integridad de datos, límites y recuperación verificable. Aplicar al cambiar comportamiento backend o su operación, en cualquier lenguaje; no impone framework, proveedor, arquitectura distribuida ni política de credenciales."
---

# Backend Service Quality

Evitar servicios que funcionan en el camino exitoso pero pierden identidad, duplican efectos, inventan datos o quedan inutilizables al fallar una dependencia. Aplicar durante implementación y revisión, ajustando el trabajo al cambio real.

## Encajar con el repositorio

- Leer instrucciones aplicables, decisiones y contratos de los consumidores afectados. Las instrucciones explícitas del usuario y las reglas de producto del proyecto prevalecen sobre esta guía.
- Inspeccionar manifiesto, lockfile, scripts y arquitectura existente cuando intervengan herramientas o dependencias. Conservar cambios ajenos; no cambiar framework, runner, autenticación, carpetas o CI por activar la skill.
- No convertir un módulo en microservicio sin una necesidad comprobada. Evaluar primero un límite modular dentro del proceso; distribución añade fallos parciales, coordinación y operación.
- Esta skill no prohíbe ni exige API keys, sesiones de navegador, proveedores específicos o un tipo de exposición HTTP. Esas decisiones pertenecen al proyecto. No usar una práctica genérica para eludir sus restricciones.
- No imponer una auditoría completa a una edición pequeña. Seleccionar las referencias y checks relacionados con la garantía modificada. Documentación o metadatos requieren validar contenido/enlaces, no iniciar servicios innecesariamente.

## Preparar el cambio

1. Identificar entrada, actor/identidad, ámbito, consumidores, dependencias y efectos persistentes. Definir qué resultado observable debe cambiar y qué invariantes deben conservarse.
2. Revisar el contrato ejecutado, no solo sus tipos: validadores, esquemas, rutas, mensajes, casos de uso y persistencia. Separar hechos comprobados de supuestos y compatibilidad histórica.
3. Seguir el flujo en caso de timeout, duplicado, cancelación, revocación y respuesta inválida. Localizar quién posee cada recurso y quién recupera un resultado incierto.
4. Elegir pruebas pertinentes en [references/regression-scenarios.md](references/regression-scenarios.md). Una decisión de negocio ausente no se completa con un default técnico; registrar la dependencia y avanzar en lo independiente.
5. Crear o actualizar una decisión técnica cuando cambien garantías costosas de revertir, límites entre sistemas o protocolos compartidos, según la práctica local. No exigir un ADR para cualquier cambio.

## Invariantes de desarrollo

### Límites y contratos

- Separar adaptación HTTP/mensajería, lógica de aplicación y acceso a dependencias según el diseño existente. Mantener una única implementación de la regla de negocio; no duplicarla en rutas, adaptadores y consumidores.
- Validar entradas y respuestas remotas no confiables en el límite apropiado. Un tipo estático o un esquema de documentación no valida el dato ejecutado. Si se combinan body, query, configuración o mensajes, validar también el comando final y su precedencia; no introducir campos sin validar después de la barrera.
- Distinguir ausencia, `null`, cero, `false`, vacío y dato inválido. Rechazar estructuras incompatibles; no sustituirlas por un éxito vacío ni fabricar cantidades, precios, identidades o disponibilidad.
- Definir campos permitidos, semántica de actualización parcial, rangos, unidades, precisión, fechas y errores. Mantener alineados contratos ejecutados y documentación/generación cuando exista.
- Leer [references/contracts-and-data.md](references/contracts-and-data.md) al modificar validación, permisos, consultas, escrituras, migraciones o contratos compartidos.

### Identidad y autorización

- Autenticar al llamador y autorizar la acción sobre el recurso y ámbito reales. Credencial de servicio, token de usuario y pertenencia a un tenant son garantías diferentes. Inventariar rutas y operaciones con su política explícita; un guard global no demuestra cobertura si admite operaciones sin metadata/policy.
- Derivar actor/tenant de un contexto validado; no confiar en un ID de usuario/negocio enviado por el cliente. Aplicar el ámbito también en consultas, escrituras, caché, objetos y trabajos asíncronos.
- Seleccionar instancias por identidad estable, no por nombre de presentación ni primer registro coincidente. Mantener esa identidad al reintentar y al asociar estado/cuotas/resultados.
- CORS, ocultar controles, una ruta interna o un nombre difícil de adivinar no sustituyen autorización. Respetar las rutas anónimas explícitas del producto sin extenderlas a otros endpoints.
- No colocar tokens, sesiones, contenido personal o documentos completos en logs, URLs, errores públicos, claves de caché o fixtures.

### Integridad y efectos

- Definir el límite de la operación indivisible. Usar transacciones y restricciones de persistencia para las invariantes locales; una secuencia de llamadas desde otro servicio no garantiza atomicidad.
- Controlar concurrencia mediante primitivas apropiadas a todos los escritores. Un mutex local no protege varios workers, hosts o clientes.
- Antes de reintentar una escritura o trabajo, decidir cómo detectar que ya ocurrió. Un timeout puede dejar un efecto confirmado con respuesta perdida; no repetir a ciegas.
- Mantener idempotencia ligada a la intención y ámbito, con una operación de reserva/confirmación atómica y tratamiento de carreras. No reutilizar una clave para otro payload ni prometer entrega exactamente una vez sin evidencia.
- No mantener una transacción de DB abierta durante trabajo externo prolongado salvo justificación explícita. Para efectos entre sistemas, aplicar el mecanismo existente de outbox, reconciliación o compensación; no imponer infraestructura nueva sin necesidad.

### Resiliencia y recursos

- Acotar tamaño, cardinalidad, fan-out, duración, simultaneidad y espera donde se consumen recursos. Los límites posteriores al parsing o a la descarga no controlan el costo previo.
- Asignar ownership y cierre a clientes, archivos, streams, tareas, sesiones, locks y permisos de concurrencia. El éxito, fallo, timeout, cancelación y shutdown necesitan salida definida.
- Aplicar deadlines que incluyan el flujo relevante y límites específicos de transporte. No asumir que cancelar la espera cancela una llamada remota o un thread ya ejecutándose.
- Reintentar solo fallos y operaciones que lo permitan, con número/tiempo total acotados. Evitar multiplicación entre capas; conservar identidad y payload. Respetar saturación/cuota y su plazo de reintento cuando esté disponible.
- Un fallback cambia comportamiento, costo o garantías: hacerlo únicamente si el contrato lo permite y lo comunica. No presentar otro proveedor, modelo, sesión o ámbito como el original.
- Leer [references/integrations-and-jobs.md](references/integrations-and-jobs.md) para dependencias externas, sesiones, IA, colas, caché, cargas o trabajo prolongado.

### Observabilidad y operación

- Producir categorías de error estables con contexto seguro y correlación. Preservar diferencias relevantes entre validación, autorización, conflicto, saturación, indisponibilidad y timeout; no convertir todo en un 500/503 genérico o un 200 ficticio.
- Registrar solo lo necesario para diagnosticar: operación, duración, identidad no sensible, resultado y causa clasificada. Mantener logs/metric labels acotados; no usar payloads, IDs arbitrarios o request IDs como etiquetas de métricas de alta cardinalidad.
- Separar vida del proceso, disponibilidad para atender y salud de dependencias. Un proceso vivo no demuestra sesión válida, cuota disponible o preparación para publicar.
- Identificar qué estado es local y qué se comparte. No habilitar más workers/réplicas sin revisar locks, caché, perfiles, trabajos e idempotencia.
- Validar configuración obligatoria sin exponer valores. Retirar código/dependencias solo después de revisar consumidores, scripts, generación, migraciones y recuperación; no borrar datos operativos por falta de imports.

## Verificar y entregar

- Probar comportamientos e invariantes desde el contrato, no llamadas privadas o copias de la implementación. Mantener regresiones que fallen ante el defecto anterior. Seguir las capas y runners permitidos por el proyecto. No simular precisamente la regla que se quiere demostrar: un caso de uso que delega todo en un mock y comprueba una llamada no verifica permisos, integridad ni concurrencia.
- Las pruebas unitarias usan datos sintéticos y dependencias simuladas, sin red externa, cuentas reales ni archivos de producción. Integraciones reales se ejecutan por separado en el entorno y alcance ya autorizados; no inventar una aprobación adicional si existe.
- Ejecutar checks locales exigidos y pertinentes: tipado/lint, pruebas, build y contratos cuando aplique. Cambios de dependencias requieren consistencia del manifiesto/lockfile y auditoría; no actualizar indiscriminadamente para silenciar avisos.
- No eliminar assertions, omitir pruebas o apagar validación para legitimar un defecto. Si cambió un contrato autorizado, actualizar sus consumidores/pruebas explicando el cambio.
- Diferenciar evidencia de mocks, integración aislada, cuenta real y despliegue. Informar qué se verificó, qué cambió y qué queda pendiente; no declarar seguridad, atomicidad, disponibilidad o readiness con evidencia de otra capa.

## Composición con otras skills

Puede utilizarse sola. Si está disponible una skill del lenguaje/framework, aplicar esa especialización para el mecanismo concreto sin duplicar ni contradecir estas garantías. `python-microservice-quality` y `nestjs-service-quality` son especializaciones opcionales; esta base no depende de tenerlas instaladas.
