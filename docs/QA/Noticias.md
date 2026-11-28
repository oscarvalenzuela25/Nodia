# QA de Noticias

Usar [la cuenta de la ronda](README.md#ejecución). Preparar una fuente
habilitada y resultados sintéticos con y sin etiquetas o portada.
Probar el proveedor externo sólo con una conexión de QA y la acción
explícita indicada. Aunque la fuente tenga un tema IA, esta suite no
invoca un modelo de Nodia.

## Casos

| Caso | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- |
| NEWS-01 Entrada con sesión | Abrir `/news` sin sesión. Volver a Inicio, entrar con la cuenta de QA y abrir Noticias desde el menú. Recargar. | La visita anónima va a Login. La sesión validada llega a Mis noticias y la recarga conserva acceso. Registrar ruta efectiva y lecturas efectuadas. |
| NEWS-02 Estado local y filtros | Abrir una conexión de prueba con snapshot vigente. Aplicar filtro de fuente y luego de tema. Abrir el enlace de un artículo y revisar una fila sin portada. | El estado local determina los artículos. Los filtros coinciden con fuente y etiquetas y cada destino enlaza al original. La falta de portada conserva la tarjeta. Registrar origen, conteos y peticiones para comprobar que filtrar o recargar no actualiza al proveedor. |
| NEWS-03 Actualización explícita | En el entorno aislado, conectar DEV con una credencial de QA, probar la conexión y pulsar Actualizar. Repetir bajo enfriamiento y con fixture de respuesta vacía o sin etiquetas seguidas. | La conexión muestra el estado y la máscara. La actualización explícita publica resultados del dueño y el caso de enfriamiento respeta la ventana vigente. Los vacíos muestran feedback acorde al contrato. Registrar estado y conteo de llamadas sin exponer la credencial. |
| NEWS-04 Compatibilidad y desconexión | En el entorno aislado, quitar la conexión de prueba, recargar y consultar el listado público histórico `GET /api/v1/news`. Si el entorno habilita el piloto daily.dev para la cuenta, repetir la conexión y actualización sólo en ese alcance. | Desconectar limpia la lectura personal propia. La ruta histórica devuelve la envoltura vacía. daily.dev sirve resultados sólo al piloto habilitado y el estado debe explicarse cuando el piloto no está disponible. Registrar código, estado y procedencia. |

[Alcance de Noticias](../mvp/105-on-demand-tech-news.md) ·
[Contratos HTTP y pilotos](../features/news/http-contract.md).
