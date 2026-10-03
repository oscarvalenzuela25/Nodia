# Pruebas de valor y operación NestJS

Leer al cambiar pruebas, límites, dependencias, configuración, errores o ciclo de vida.

## Elegir pruebas que prueben la regla

- Localizar dónde se ejecuta la invariante. Simular transporte/repositorios externos, conservando la política o regla que se quiere comprobar. Si una capa delega todo al mock de negocio, sus tests no prueban ese negocio.
- Respetar ubicación y capas permitidas por AGENTS. Cuando el proyecto permite unit tests solo de casos de uso, hacer que las reglas de aplicación residan y se ejecuten allí; no crear tests de servicio/controlador para sortear la política. Las comprobaciones de integración deben seguir el alcance autorizado local.
- Priorizar actor sin permiso/otro tenant, entrada inválida, segunda escritura fallida, concurrencia, respuesta perdida, proveedor no configurado y timeout. Conservar éxito legítimo y compatibilidad requerida.
- No probar solo cantidad de llamadas, texto de errores o código copiado. Asertar resultado/efecto permitido y ausencia de efectos indebidos. Conteos de llamadas sí aportan valor para retry, fan-out y presupuesto cuando ese es el contrato.
- No usar mocks como prueba de rollback, lock, constraint o comportamiento SQL de un driver. Usar persistencia aislada para esas garantías o declarar evidencia pendiente. No afirmar que 100% de cobertura certifica autorización.
- Aislar red, DB, Redis, almacenamiento y cuentas externas antes de importar código que pueda inicializarlos. Tests unitarios no deben usar `.env` de producción, cookies reales ni credenciales de desarrollador. No añadir un test documental que replique instrucciones de la skill.

## DI y runtime compilado

Build, tests y arranque resuelven problemas diferentes. Si cambian providers, módulos, decoradores, ciclos o loader ESM, comprobar la composición del código compilado de forma aislada y proporcional. Evitar arrancar el AppModule contra infraestructura real incidentalmente.

- Revisar que el runner y TypeScript emitan la metadata requerida. Mantener tokens/imports de valor e imports/exports del módulo; no añadir providers duplicados para resolver un test mal compuesto.
- Verificar aliases/extensiones, detección de entidades y registro de use cases en el runtime desplegado.
- Una verificación HTTP aislada de permisos/validación puede complementar unit tests permitidos, sin transformarse en tests prohibidos de controladores/servicios. Aclarar alcance y dependencias.

## Límites, multipart y dependencias

- Revisar límites reales de body/campos/archivos antes del trabajo protegido, memoria/disk storage y parser del adaptador instalado. Un archivo de 10 MiB puede coexistir con otros campos/cargas en vuelo; evaluar tamaño total, simultaneidad y cola.
- Autenticación/rate limiting, admisión concurrente y tamaño son controles diferentes. Un límite de peticiones por minuto no limita duración ni número de trabajos activos.
- Acotar exportaciones y batch; considerar streaming/backpressure cuando el volumen lo justifique. No cargar todo en memoria ni expandir asociaciones sin límite para un endpoint interactivo.
- Diseñar deadline de operación y límites de transporte, retry total y cancelación apropiada. `Promise.race` que devuelve timeout no detiene trabajo/subida remota; abortar/seguir/reconciliar según las capacidades reales.
- Auditar manifiesto y lockfile de producción y revisar la ruta concreta de advisories. No decir que todo aviso es explotable ni que no hay riesgo porque el archivo no pasa por un método propio. Actualizar versiones compatibles y validar comportamiento multipart/errores afectado.
- Validar que el comando de lint usa configuración/reglas pretendidas, incluyendo soporte de reglas que requieren tipos. La presencia de un archivo de config no demuestra que se esté aplicando.

## Configuración, errores y lifecycle

- Validar configuración obligatoria y condicional al iniciar, sin imprimir secretos: DB/TLS, Redis, firma/cifrado, origen público, storage y URLs de servicios. Una funcionalidad deshabilitada no debe exigir credenciales innecesarias; una habilitada no debe quedar medio configurada.
- Usar lifecycle de Nest para recursos poseídos por la aplicación y habilitar manejo de señales cuando corresponda. Cerrar conexiones/clientes/streams y dejar trabajos completados o recuperables; no asumir que Node los cierra de forma ordenada.
- Diferenciar liveness y readiness de dependencias necesarias, con información pública mínima. Un endpoint Hello o proceso vivo no prueba preparación para recibir operaciones.
- Producir errores de dominio seguros y correlación. Revisar exception filters, SDK catch y logs: esconder errores desconocidos no protege mensajes brutos incrustados en `InternalServerErrorException`.
- Invalidar caché según la identidad anterior y nueva; capturar estado previo antes de mutarlo. Los permisos sensibles requieren coherencia/revalidación definidas, no una cache compartida globalmente por email a ciegas.
- Verificar proxy/TLS, exposición, recursos, imagen y restauración en el entorno pertinente antes de declararlo operativo. No desplegar ni modificar DB/cuentas reales como efecto de validar una skill.

## Evidencia de entrega

Registrar checks ejecutados, advertencias, hallazgos de audit, regresiones y límites de integración. Cambios solo documentales requieren metadata/enlaces/equivalencia de copias. Cambios de comportamiento necesitan pruebas y build/lint afectados; operación requiere evidencia propia del entorno. No borrar tests, desactivar validadores ni instalar dependencias masivamente para lograr verde. No cerrar un hallazgo porque se añadió una instrucción que lo prevenga.
