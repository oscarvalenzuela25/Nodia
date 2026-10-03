# Escenarios de regresión frontend

Consultar los apartados relacionados con el comportamiento cambiado. Elegir escenarios que protejan garantías reales; no ejecutar esta lista completa para un cambio menor. Las reglas de negocio y el stack del proyecto determinan la expectativa final.

## Identidad y configuración

| Situación | Comprobación observable |
|---|---|
| Dos instancias comparten nombre o clave de catálogo | Seleccionar la segunda envía su ID y configuración; la primera no participa en la operación |
| La selección desaparece en refetch o pierde permisos | Se informa y bloquea la operación dependiente; no se ejecuta con otra instancia |
| Un modo tiene configuración y el otro no | El modo sin configurar permanece sin asignación; no recibe valores del otro modo o de una raíz histórica |
| Falta un recurso/modelo configurado | La acción dependiente no ejecuta con un fallback inventado |
| Disponibilidad, capacidad o cuota no reportada | La interfaz representa el estado desconocido; no muestra un valor operativo fabricado |
| Una respuesta anterior llega después de cambiar contexto | No sobrescribe la selección ni el formulario del contexto vigente |

## Consultas y revalidación

| Situación | Comprobación observable |
|---|---|
| Primera carga, vacío y error inicial | Son estados distintos; el error ofrece recuperación y no afirma que no existen registros |
| Refetch falla con datos en caché | Los datos siguen visibles; aparece error/reintento sin sustituir la vista por skeletons |
| Transporte/caché/componente observan el mismo fallo | El usuario recibe un solo aviso por esa operación |
| Cancelación intencional de consulta | No muestra error de servidor |
| Red no disponible, timeout o HTTP 429 | Se recupera el estado de carga y se puede actuar según el contrato; no hay bucle de reintento |
| Cambio de usuario, negocio o filtro | No se presentan datos del ámbito anterior como si fueran del actual |

Para comprobar refetch fallido: cargar una respuesta válida, hacer fallar la siguiente lectura e invalidar/refrescar. Verificar datos, error y feedback; hacer que el reintento responda y verificar recuperación. No simular un fallo inicial y llamarlo refetch.

## Formularios, mutaciones y trabajos

| Situación | Comprobación observable |
|---|---|
| Guardado rechazado por servidor | Modal abierto, valores intactos y mensaje específico permitido; se puede corregir/reintentar |
| Guardado exitoso | Cierre/limpieza e invalidación ocurren tras confirmación del éxito y conforme al flujo local |
| Dos envíos antes de resolver la primera petición | Una sola petición en curso; controles dependientes bloqueados |
| Actualización optimista falla | Rollback/reconciliación coherente; no se modifica otra instancia o contexto |
| Timeout de escritura | Se reconoce resultado incierto; no se repite automáticamente ni se anuncia éxito sin confirmación |
| Reintento con idempotencia soportada | Se conserva la clave de la misma intención; el resultado integrado es único |
| Trabajo prolongado activo | Cancelar sigue accesible salvo cuando su propia petición lo impide |
| Cancelación del trabajo falla o consulta de estado falla | No se cierra ni se declara terminado; se informa y permite recuperación |
| Operación con varias escrituras falla a mitad | No se declara éxito/atomicidad; la garantía exige prueba integrada del contrato transaccional |

Para conservar un formulario: escribir valores distintos de los iniciales, rechazar la mutación, comprobar los mismos valores y reintentar. Verificar solo que existe un dialog no demuestra conservación del borrador.

## Valores, paginación y agregados

| Situación | Comprobación observable |
|---|---|
| Cero o `false` válido según el contrato | Permanece sin convertirse en un default distinto |
| Campo requerido borrado, ausente, `NaN` o infinito | Se señala para revisión y no se envía como cero o como un valor válido |
| Negativos, decimales y límites | Se aceptan/rechazan y redondean según el contrato, no por una regla inventada en UI |
| Elementos repetidos dentro de un borrador | Se aplica la política de duplicados del contrato; no se pierde información silenciosamente |
| Registros superan la página o antiguo límite fijo | Son accesibles mediante siguiente página/búsqueda; se envían filtros y paginación correctos |
| Se elimina el último registro de la última página | Se ajusta/refetch la página válida sin dejar al usuario atrapado en una página vacía |
| Seleccionado fuera de la página/resultados actuales | Se conserva su identidad y etiqueta; seleccionar/deseleccionar cargados no borra otras selecciones |
| Indicador recibe una primera página incompleta | Usa agregados o representa la limitación; no publica la suma parcial como total global |
| Período cruza fin de mes o zona horaria | Incluye los registros que define el contrato; el formato regional no altera la fecha de transporte |

## Permisos e interacción

| Situación | Comprobación observable |
|---|---|
| Actor de lectura o permiso revocado | Acciones y formularios se actualizan, incluidos los ya abiertos, según las capacidades recibidas |
| Acceso directo a ruta restringida | Respeta los guards y la carga del contexto; no depende de ocultar el enlace |
| Endpoint devuelve 403 | No deja una acción habilitada con autorización obsoleta; ofrece la recuperación definida |
| Modal ocupado frente a Escape/cierre | El comportamiento respeta el contrato local; un error no destruye el borrador |
| Idioma, tema o tamaño afectado por el cambio | Feedback traducido, controles legibles y alcanzables, sin desbordamiento accidental |
| Navegación por teclado de controles modificados | Foco, activación, cierre y retorno son utilizables conforme al componente |

Los tests de UI no prueban que un endpoint rechace actores o ámbitos no autorizados. La idempotencia, transacción y autorización HTTP se verifican con pruebas de integración/casos de uso adecuados fuera de la simulación del componente.
