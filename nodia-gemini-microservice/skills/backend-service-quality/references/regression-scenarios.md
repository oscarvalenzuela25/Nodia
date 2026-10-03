# Escenarios de regresión y evidencia

Seleccionar únicamente filas pertinentes a la garantía modificada. Usar contrato y datos sintéticos para elegir expectativas; no convertir la tabla en una suite obligatoria para cada edición.

## Entradas y autorización

| Escenario | Garantía a comprobar |
|---|---|
| Campo ausente, nulo, cero, false o vacío | Cada valor conserva la semántica acordada; no se habilita la operación con defaults fabricados |
| Payload remoto 200 con estructura inválida | Fallo de integración explícito; no escritura ni éxito vacío |
| Número fuera de rango, string numérico, bool, NaN o infinito | Aceptación/coerción/rechazo deliberados según contrato; no conversión accidental |
| Body/query/config válidos por separado, composición contradictoria o con campo nuevo | Comando final validado, precedencia explícita y sin bypass por mezcla posterior |
| Nueva ruta/alias sin policy o metadata de acción | Clasificación explícita; una operación sensible no queda habilitada por omisión |
| Respuesta con campo sensible anidado o relación adicional | Proyección pública excluye secretos sin depender de una lista superficial de nombres |
| Campo desconocido o update parcial | No mass assignment; omitir y borrar no se confunden; compatibilidad legítima preservada |
| Token ausente, inválido o revocado | Acción rechazada según el contrato antes del costo/efecto protegido |
| Actor válido con recurso/asociación de otro tenant | No lectura, escritura, agregado, cancelación o archivo fuera del ámbito |
| Servicio autenticado con contexto de actor no autorizado | Credencial interna no salta permisos del usuario |
| Filtro/orden/ruta manipulados | No SQL/operador/ruta arbitrarios; resultados conservan ámbito |

## Efectos y concurrencia

| Escenario | Garantía a comprobar |
|---|---|
| Falla el segundo paso de una operación indivisible | Sin escritura parcial dentro del límite transaccional |
| Dos solicitudes compiten por una invariante | Restricción/locking mantiene el dominio; no solo chequeo previo |
| Misma intención y clave de idempotencia, también simultáneamente | Un efecto y resultado recuperable; estado en curso definido |
| Misma clave con intención distinta | Conflicto o tratamiento explícito, sin devolver resultado ajeno |
| Commit/efecto seguido de pérdida de respuesta | Reintento/reconciliación no duplica el efecto |
| Crash entre efecto externo y ack | Redelivery conserva integridad; estado de recuperación visible |
| Falla compensación/outbox | Pendiente recuperable; no afirmar rollback completo |
| Cambio de ámbito mientras una consulta sigue en vuelo | Resultado tardío no se publica/cachea en el contexto nuevo |

## Dependencias y recursos

| Escenario | Garantía a comprobar |
|---|---|
| Credencial/directorio presente pero sesión inválida | No disponibilidad ficticia ni llamada por otro motor |
| Recurso/modelo desconocido o retirado | Error explícito, identidad conservada, sin fallback oculto |
| Capacidad o cuota sin evidencia | Desconocida/no habilitada; no deducción por nombre ni copia de otra cuenta |
| Auth, cuota, timeout, indisponibilidad y rechazo | Clasificación estable, plazo válido y conteo real de ejecuciones |
| SDK y adaptador con retries | Presupuesto total y número máximo realmente acotados |
| Upload fragmentado sin Content-Length | Bytes reales limitados antes del parser/descarga costosa |
| Saturación y cola llena | Rechazo/espera acotada antes de temporales/trabajo; plazo local si corresponde |
| Desconexión/timeout/cancelación durante upload y ejecución | Recurso cerrado/cupo liberado; trabajo remoto incierto identificado |
| Diez lecturas de cuota concurrentes | Consulta compartida cuando así se diseñó, sin mutación accidental del resultado |
| Cambio de sesión con consulta anterior en vuelo | Caché nueva no recibe cuota/estado antiguo |
| Error del proveedor incluye secretos/documento | Respuesta/log público seguro con correlación; no cuerpo bruto |

## Consultas y operación

- Más registros que una página y selección/relación fuera de la primera: acceso/paginación completos y totales de conjunto, sin descarga ilimitada.
- Cambio de permisos, filtros y período: caché/listados/agregados conservan ámbito y semántica temporal.
- Dependencia caída, arranque sin sesión y sesión expirada: vida, readiness y error de ejecución distinguidos; recuperación comprobable.
- Reinicio/cierre con trabajo activo: no aceptar trabajo durante shutdown; recursos liberados o estado recuperable documentado.
- Más de un worker/réplica cuando se propone escalar: comprobar coordinación de estado/locks/perfiles/idempotencia. No usar una prueba de un proceso como evidencia distribuida.
- Migración con datos anteriores: conservación/coerción explícita, versión anterior/nueva y rollback realmente viable.
- Despliegue: exposición desde fuera de la red prevista, TLS/proxy, recursos medidos, renovación de credenciales y restauración. Solo ejecutar en el entorno y autorización correspondientes.

## Evidencia proporcional

| Cambio | Verificación habitual, adaptada al repositorio |
|---|---|
| Documentación/instrucciones | Estructura, enlaces, contradicciones y ausencia de scaffolding incompleto |
| Lógica/contrato | Tests de comportamiento afectados, validadores/tipado y consumidores pertinentes |
| Transporte/auth/cancelación | Fallos simulados con conteo de llamadas, ownership y recursos reutilizables |
| Escritura/concurrencia | Caso de uso y, si es necesario, integración aislada con persistencia real para garantías no demostrables por mocks |
| Dependencia/build/configuración | Lockfile/manifiesto, instalación compatible, checks/build y auditoría pertinentes |
| Operación/distribución | Integración/entorno representativo y evidencia de los controles externos que se declaran |

Antes de atribuir una garantía al test, localizar dónde se ejecuta la regla. Si está completamente simulada, probar su implementación mediante la capa permitida o reubicar la regla según la arquitectura local. Las aserciones de delegación pueden aportar wiring, pero no sustituyen las de negocio.

Registrar comando/entorno, resultado, limitaciones y pendientes reales. No crear tests que solo buscan frases de esta skill, comparar helpers privados innecesariamente o instalar infraestructura para un cambio documental. Una auditoría de dependencias sin hallazgos no prueba ausencia de vulnerabilidades en sistema operativo, imagen o lógica del producto.
