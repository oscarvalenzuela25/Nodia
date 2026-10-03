# Integraciones, cargas, caché y trabajos

Leer al cambiar transporte externo, sesiones, archivos, colas, cuotas o ejecución prolongada. Los valores de límites y las políticas de proveedores se obtienen del proyecto, no de esta referencia.

## Adaptador e identidad

- Exponer un contrato interno que permita distinguir disponibilidad, autenticación, descubrimiento y ejecución. Instanciar un SDK, encontrar un directorio o tener una variable no demuestra que la sesión funcione.
- Mantener separados estado/configuración/caché por instancia, motor, credencial o generación de sesión y ámbito cuando intervengan. No mezclar cuotas de cuentas distintas ni usar salud de una conexión para habilitar otra.
- Descubrir recursos dinámicos desde una fuente comprobada cuando el producto lo requiera. Un nombre comercial no demuestra capacidades, contexto, precio ni permiso de uso.
- Ejecutar lo configurado o devolver una causa explícita si falta/ya no está disponible. Una alias reportada puede ser válida según el contrato; conservar identidad física al reintentar. Un recurso retirado no se sustituye silenciosamente.
- Para IA/OCR: no imponer proveedor, modelo ni mecanismo de credenciales. Aplicar restricciones locales; no introducir catálogos ficticios o un fallback que altere cuota/privacidad. Validar resultado estructurado y conservar incertidumbre para revisión.
- Un plugin/modelo puede pedir herramientas o ejecutar acciones. El dato/documento remoto es entrada no confiable: no debe decidir comandos, permisos, credenciales, rutas ni acciones externas fuera de lo autorizado por el flujo.

## Deadlines, reintentos y resultado incierto

- Definir presupuesto extremo a extremo y límites de conexión/lectura/escritura cuando el transporte lo permita. Incluir autenticación, carga, espera y parsing si forman parte de la operación.
- Ubicar la política de retry en una capa responsable; si transporte, SDK, adaptador, cola y llamador reintentan, contar el máximo real de ejecuciones y el tiempo acumulado.
- Reintentar únicamente errores identificados y operaciones seguras. No capturar `Exception` y repetir todo; una generación facturable o una escritura puede haberse ejecutado antes de perder la respuesta.
- Para recuperación de autenticación, coordinar callers concurrentes y mantener la misma intención/identidad. Definir número de recuperaciones y condición de parada; una renovación continua no es resiliencia.
- Quota/rate limit: conservar categoría y plazo reportado, validar su formato/rango. No inventar tiempo de reset ni rotar automáticamente cuenta/motor salvo política explícita. La saturación local sí puede usar un plazo documentado propio.
- Para retry permitido, aplicar backoff/jitter y deadline; respetar cancelación y shutdown. Circuit breakers o bulkheads son opciones si la carga/fallo lo justifican, no requisitos para una petición sencilla.
- Comunicar si el estado quedó incierto y cómo consultar/reconciliar. No responder "falló sin efectos" sin evidencia del sistema remoto.

## Admisión y cargas

- Identificar el primer punto de consumo: buffering del proxy/ASGI, multipart, descompresión, descarga o decodificación. Limitar bytes allí y además el tamaño lógico del archivo; `Content-Length` puede faltar o ser incorrecto.
- Acotar número de partes/campos, tamaño de campos, archivos, items y contenido descomprimido cuando el flujo los admita. No aceptar un ZIP o imagen enorme solo porque su tamaño comprimido es pequeño.
- Adquirir capacidad antes de recibir/parsear trabajo costoso. La cola también requiere tamaño, timeout y política de rechazo; esperar sin límite solo mueve el problema.
- Elegir memoria/disk/streaming según la carga. Un spool en disco evita RAM ilimitada, pero requiere espacio y cupos; varias copias por parser/adapter multiplican el presupuesto.
- Usar nombres internos y directorio controlado; validar formato por firma y contenido relevante, no solo extensión/MIME. La firma no prueba ausencia de malware ni validez semántica completa.
- Si se descargan URLs remotas, proteger SSRF según el caso: destinos permitidos, resolución/redirecciones y redes internas, además de tamaño/tiempo. No introducir descarga de URLs si el contrato solo admite uploads.
- Limpiar temporales en todas las salidas sin tocar archivos ajenos. En un crash sin cleanup, aplicar una política de expiración/recuperación identificable; no ejecutar borrados amplios para "limpiar".

## Caché y cuota

- Incluir en la clave todos los factores que cambian resultado, sin secretos en texto: identidad de instancia, ámbito, opciones y generación de sesión según corresponda.
- Definir TTL, invalidación y si se admite stale. Mostrar origen/antigüedad cuando la decisión dependa de ellos. Un fetch fallido no vuelve recientes datos anteriores.
- Coordinar consultas simultáneas con single-flight si hay costo relevante. Definir qué pasa si cancela el dueño y cómo reciben error los demás; compartir resultados no obliga a compartir buffers mutables.
- Descartar respuestas en vuelo de sesiones/contextos reemplazados. Capturar una generación/identidad antes de consultar y comprobarla al publicar o cachear.
- Si el SDK conserva snapshots privados o traga errores, comprobar qué significa su respuesta y probar falla real/simulada. No asumir que una llamada completada produjo observación nueva. Encapsular ese acoplamiento y registrar la limitación.
- Cuota no observada es desconocida, no cero ni ilimitada. Separar consultas de estado de ejecuciones que consumen recursos; no hacer inferencia para pintar un indicador de salud.

## Colas y trabajo asíncrono

- Modelar estados y transiciones: creado, admitido, ejecutando, éxito, fallo, cancelación solicitada y cancelación confirmada según el caso. Una petición HTTP aceptada no demuestra que el trabajo terminó.
- Guardar identidad del trabajo, ámbito y resultado con retención acotada. Definir cómo se consulta desde otra réplica y tras reinicio; memoria local no es un registro durable.
- Asumir redelivery cuando el broker lo permite; confirmar mensaje solo en el punto correcto. Crash entre efecto y ack puede duplicar procesamiento: proteger efectos, no solo IDs de mensajes.
- Acotar retries/poison messages y ofrecer estado diagnosticable o dead-letter según infraestructura. No reintentar mensajes inválidos indefinidamente ni perderlos sin evidencia.
- Cancelación requiere ownership y señal cooperativa. Si el efecto ya ocurrió, cancelar no es revertir. Un timeout HTTP no debe abandonar un trabajo sin política explícita.
- En shutdown, detener admisión, esperar/cancelar dentro del presupuesto y cerrar dependencias. Señalar qué trabajo se recupera al reiniciar.

## Errores y exposición operativa

- Clasificar fallos y traducirlos al contrato del llamador. Preservar categorías/plazos útiles sin reenviar texto bruto, trazas, OCR ni cuerpos del proveedor.
- Crear/correlacionar IDs de solicitud/trabajo con formato y tamaño acotados; no confiar en un header arbitrario para logs. No usarlos como labels de métricas.
- Readiness tiene política explícita por dependencia/motor; no debe consumir cuota o atascarse mientras la dependencia cae. Liveness mide vida del proceso; su error no equivale siempre a motivo para reiniciar.
- Revisar acceso público/privado real, identidad de servicio y rutas sensibles. Puertos, proxy, TLS, cookies y firewall necesitan evidencia de despliegue correspondiente; una prueba con mocks no los verifica.
