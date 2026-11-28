# QA por producto

Estas suites permiten verificar Nodia desde sus rutas habituales y dejar
evidencia reproducible por caso. [AGENTS.md](../../AGENTS.md) indica cuándo
ejecutarlas. Las especificaciones enlazadas por cada suite fijan el resultado
esperado.

| Producto o módulo | Suite |
| --- | --- |
| NodiaAI | [Chat, consultas y herramientas](nodiaAI.md) |
| Nodia Teacher | [Estudios, práctica y tarjetas](nodiaTeacher.md) |
| Nodia CV | [Perfil, borradores, revisiones y PDF](nodiaCV.md) |
| Negocios | [Catálogo, POS, caja, proveedores, facturas y reportes](Negocios.md) |
| Arriendos | [Propiedades, reservas y reportes](Arriendos.md) |
| Finanzas | [Finanzas personales y reportes](Finanzas.md) |
| Proveedores de IA | [Configuración, modelos y estado](ProveedoresIA.md) |
| Core | [Inicio, sesión, administración y preferencias](Core.md) |
| Notificaciones | [Web Push y recordatorios de visitas](Notificaciones.md) |
| Noticias | [Lectura y conexiones personales](Noticias.md) |

## Ejecución

1. Leer el alcance vigente de las suites pedidas y anotar fecha, entorno,
   URL, commit o release de Client y Server, navegador y cuenta de QA. Usar
   **una sola cuenta activa con rol `super_admin`** durante la ronda. Los
   casos sin sesión se ejecutan como visitante y permiten volver con esa
   misma cuenta. Las pruebas de otros roles corresponden a sus suites de
   autorización y quedan fuera de esta ronda.
2. Usar el entorno pedido. Si no se indica uno, usar un entorno aislado
   con datos sintéticos. En producción ejecutar las lecturas y los efectos
   técnicos autorizados del QA, como crear y archivar sus chats de prueba.
   Los casos que escriben datos de negocio, cambian credenciales o permisos
   o simulan fallos se ejecutan en un entorno aislado, salvo que el alcance
   productivo autorice expresamente esos efectos.
3. Preparar los datos que pide la suite y fijar la referencia con la que se
   contrastará el resultado. Etiquetar los recursos nuevos con el ID de
   ronda cuando la interfaz lo permita. Si cambia el origen durante una
   lectura, comparar con el recibo de ese momento y anotar la variación.
4. Ejecutar todos los casos aplicables de las suites solicitadas. Usar las
   rutas canónicas y sus controles normales. Correr cada caso sin IA una vez
   por entorno, salvo que el caso pida variantes. Ejecutar cada caso `IA`
   según la matriz. Las acciones controladas de fallo, concurrencia o
   compatibilidad pueden usar el entorno y los fixtures indicados.
5. Registrar resultado y evidencia por caso. Si una prueba falla, guardar su
   estado y continuar con las independientes. Repetir las afectadas tras el
   arreglo dejando vinculado el resultado anterior. Cerrar las sesiones de
   prueba activas de acuerdo con el producto, archivar los chats creados
   para este QA y confirmar la limpieza de los fixtures propios conforme al
   alcance. Mantener las conversaciones originales de los incidentes.

## Matriz de IA

1. Para cada caso `IA`, identificar el propósito o modalidad y consultar
   los proveedores, conexiones, modos y modelos publicados por el entorno
   bajo prueba. Contrastar los catálogos vigentes del proveedor y los
   selectores o contratos del producto. Incluir cada proveedor integrado y
   cada modelo descubierto para sus modos. Usar los IDs reales y la
   disponibilidad observada en la ronda.
2. Formar una fila por caso × proveedor × conexión × modo × modelo. Incluir
   Agentic y API key cuando estén habilitados para el proveedor. Para
   casos con varias modalidades, registrar el resultado de cada modalidad.
   Si hay varios despachos o selecciones independientes, conservar la identidad
   de cada etapa. Anotar también los proveedores o conexiones
   identificados que no pudieron inventariarse y por qué.
3. Fijar explícitamente **Medio** en cada ejecución. Registrar su ID efectivo
   (`medium` o el valor equivalente documentado por el proveedor y por el
   adaptador para esa selección). Si la modalidad, el modo o Medio figuran
   expresamente como incompatibles, registrar `no soportado` y la fuente.
   Si están sin verificar o la selección está indisponible, registrar
   `bloqueado` con el motivo. Una prueba en otro esfuerzo, modelo,
   proveedor o modo tiene su propia identidad y queda fuera de la cobertura
   de esa fila.
4. Comprobar la selección realmente aplicada, un resultado válido para el
   caso y su estado terminal. Verificar el cierre local y el acuse cuando
   el transporte los requiera. En lecturas con herramientas, comprobar
   la operación y el resultado del gateway. Agentic acredita su transporte
   MCP o el puente autorizado. API key acredita function calling. La sesión,
   el catálogo, la clave guardada y los flags de herramientas son evidencia
   de preparación. Cada propósito, modalidad y combinación exige su propia
   evidencia de ejecución. Identificar si el transporte fue real o de prueba
   controlada.
5. Respetar el presupuesto de la operación y distinguir un fallo conocido de
   un resultado remoto incierto. En un resultado incierto, observar y
   conciliar por la vía documentada. Conservar el identificador original y
   evitar reenviar la inferencia. Si se agota el presupuesto de la ronda,
   registrar las filas pendientes y su motivo.

El [catastro de IA](../mvp/114-ai-model-usage-inventory.md) identifica
los puntos de entrada y propósitos. La ronda funcional de una sola cuenta
complementa los controles de incorporación de proveedores, incluidos los
negativos de autorización y aislamiento que exigían otra cuenta.
[Matriz de incorporación](../mvp/91-ai-provider-onboarding-verification.md) ·
[Contrato de proveedores](../mvp/ai-provider-feature-contract.md).

## Registro y cierre

| Caso | Entorno y release | Proveedor, conexión, modo, modelo y esfuerzo | Estado | Observación y evidencia |
| --- | --- | --- | --- | --- |
| ID de la suite | Entorno, commit o release | IDs efectivos o manual | `pasa`, `falla`, `bloqueado` o `no soportado` | Resultado esperado y observado, identificador del turno, trabajo, intento o recibo según aplique, enlace a evidencia o motivo |

Usar `pasa` cuando coincidan las comprobaciones del caso, `falla` cuando
el comportamiento diverja, `bloqueado` cuando falte una precondición o
evidencia y `no soportado` cuando el contrato lo acredite. Reportar el
total de filas inventariadas y los resultados por estado. Una ronda con
fallos o bloqueos queda parcial.

Guardar material temporal en `output/` o `.tmp/`. Consolidar sólo
evidencia textual útil y sanitizada en [docs/evidence](../evidence/README.md).
Omitir credenciales, datos personales, payloads completos y capturas en Git.
Cuando cambie un flujo, actualizar el caso, sus pasos y el enlace a la fuente.
