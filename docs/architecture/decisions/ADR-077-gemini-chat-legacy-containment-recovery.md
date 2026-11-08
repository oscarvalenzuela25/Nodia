# ADR-077 — Conciliación conservadora de CHAT Gemini legacy mediante cierre del contenedor original

> Estado: propuesto; implementación, despliegue y aceptación se registran por separado. No aprueba ni publica capacidades.
> Fecha: 2026-10-24.

## Contexto

El ledger CHAT Gemini v1 persiste `attempt_id`, motor, perfil, generación de sesión, identidad de operación y estado. No persiste el proceso propietario ni su cgroup. Los mapas de admisión/operaciones activas son locales al proceso. Un intento `dispatch_armed` puede sobrevivir en disco al runtime que lo admitió; reiniciar no demuestra cierre ni autoriza liberar el perfil.

ADR-054 ya define una autoridad privilegiada del host para observar la generación Docker/cgroup y certificar cierre de raíces anteriores. El login durable enlaza su contención antes de liberar el supervisor. CHAT legacy no tiene ese enlace por intento y no hereda esa garantía por compartir contenedor.

El caso investigado dispone de testigos operativos anteriores al despacho: identidad de generación Docker y cgroup retenida por root y una observación del mismo contenedor. Antes de detenerlo se puede contrastar el ledger armado exacto y el único montaje de escritura. Es una cadena operacional compuesta, distinta de haber persistido un owner por intento al despachar. Sin esa cadena no es admisible reconstruir retrospectivamente la propiedad desde un PID, una fecha o una sesión nueva.

## Opciones consideradas

### Mantener el intento incierto indefinidamente

Conserva el cierre seguro ante una identidad insuficiente y sigue siendo la respuesta cuando falta cualquier testigo. Con una cadena verificable y cierre kernel del contenedor original, impide aprovechar una prueba más fuerte ya disponible.

### Liberar por reinicio, desaparición del PID o intervención SQL

Se descarta: no acredita la contención original, puede ignorar hijos vivos y elude el protocolo nativo/ACK. Tampoco se permite editar manualmente un recibo para convertirlo en terminal.

### Enlace legacy previo a la parada y certificado host consumido por el runtime

Reutiliza la autoridad y la observación kernel de ADR-054. Requiere un contrato cerrado que enlace los testigos previos, bytes exactos del ARMED y scope del intento a la generación original. El host nunca escribe el proof nativo ni la BD.

## Decisión

Proponer la tercera opción, con rechazo conservador de cualquier cadena incompleta. La autorización de implementación no equivale a aprobación documental ni a aceptación operacional.

El productor del host valida y persiste un binding inmutable ANTES de detener/reemplazar el contenedor original. Comprueba procedencia, ownership/permisos, generación Docker/cgroup original, endpoint/configuración previstos, ledger/montaje de escritura único y el SHA de los bytes del registro ARMED con su scope exacto. La evidencia usada debe preceder a la parada y distinguir la observación anterior al despacho de la captura posterior del registro. Después del fsync y la relectura del binding, vuelve a verificar la generación original viva y los mismos bytes/scope/testigos antes de declarar el binding previo a la parada. Si falla, conserva el archivo incierto y no activa el helper ni inicia la parada desde ese resultado. No se acepta un descriptor suministrado por el modelo como prueba de propiedad.

El helper conserva las raíces referenciadas por esos bindings además de las referencias de login existentes. Sólo una comprobación kernel del cierre de esa raíz original puede producir su certificación: raíz vacía/retirada con identidad comprobada o cierre de su boot anterior. Un cambio de namespace, un nombre Docker reutilizado o un nuevo epoch no bastan.

El consumidor NATIVO valida el certificado root de sólo lectura, su versión y scope, y lo compara con el binding y con los bytes actuales del registro original. Si se cumplen todas las condiciones, el ledger nativo puede pasar únicamente `dispatch_armed` a `abandoned_unknown`, emitiendo la prueba terminal mediante su mecanismo propio. Nunca reconstruye una respuesta ni emite `completed` por cierre de infraestructura. El consumidor no invoca inferencia, login, discovery o herramientas de negocio.

El candidato distingue el propietario aún vivo del mismo runtime —ID admitido en RAM, CliRunner real verificado, misma sesión/perfil, sin intento activo ni procesos pendientes— del propietario perdido tras restart. El primero puede cerrar únicamente como incierto; el segundo requiere el certificado host y su binding. Un epoch aislado no prueba ninguno de esos casos.

Nodia Server conserva su conciliación habitual por descriptor exacto y ACK posterior al resultado SQL. La reserva no se libera porque exista el binding o porque el host haya parado el contenedor. Un error, mismatch, falta de certificado o cierre aún no acreditado mantiene la incertidumbre. Repetir la conciliación consulta la misma identidad; no admite otro dispatch.

Durante la adopción se detienen admisión y nuevos claims; API/worker sólo se reactivan después de conciliar y acreditar el ACK original. Una reversión de imagen anterior al ACK conserva el helper v2, el binding y la raíz retenida: restaurar el helper previo, que sólo conserva referencias de login, podría eliminar esa autoridad de cierre. Si el consumidor no puede completar la conciliación, el sistema queda detenido de forma conservadora con la prueba original preservada. Restaurar descriptores host anteriores sólo es admisible tras el ACK y retiro comprobado del binding; nunca restaura SQL ni recibos nativos históricos.

El [contrato de la funcionalidad](../../features/ai-providers/gemini-chat-legacy-recovery.md) recoge la frontera entre productor, certificado y consumidor. El candidato acuerda certificado v2 compatible con login v1 y hasta8 bindings Agentic cerrados por SHA/scope/generación/lineage. El esquema debe contrastarse con las fuentes revisadas de ambos lados antes de congelar el candidato.

## Consecuencias

Se reutilizan contenedor, almacenamiento privado y autoridad host existentes, sin nuevo puerto, capability del contenedor o tabla de BD. La información adicional es técnica y acotada: IDs opacos, hashes y prueba de contención; no prompts, respuestas, cookies, modelos inventados o credenciales.

El cierre local no prueba que el proveedor remoto no recibió la petición ni revierte acciones previas. La salida legítima es incertidumbre conciliada, con respuesta no disponible y sin replay. La retención debe conservar el binding mientras proteja un intento pendiente; la limpieza posterior sigue el ACK y la política vigente, sin crear auditoría eterna ni borrar referencias antes del cierre.

La extensión no resuelve automáticamente futuros propietarios sin witness; la evolución normal es persistir contención por intento antes del despacho. Windows, otros hosts, réplicas y proveedores quedan fuera hasta disponer de garantías equivalentes.

En el ensayo operacional, la comparación completa de HostConfig detuvo la adopción después de arrancar una imagen saludable. No se conservó el objeto anterior y no se atribuye la diferencia a un campo ni se afirma paridad histórica total. La continuación exige una verificación independiente del estado actual: identidad y fuentes de imagen, usuario10001, no-new-privileges y capacidades efectivas nulas, namespaces privados, puerto sólo loopback, montajes y límites declarados, certificado root, binding y ARMED exactos. Se conserva el recibo fallido y se utiliza una intención nueva; esto no elimina ninguna guarda de la conciliación nativa ni autoriza liberar por simple reinicio. Las futuras sustituciones deben conservar una proyección técnica saneada y hashes por campo antes de retirar el contenedor, sin copiar Config.Env ni credenciales.

La inspección también encontró tres Compose0666, otro controlado por UID10001 y su padre reemplazable por ese usuario. Se repararon sólo cinco objetos: cuatro archivos quedaron root:root0644 y el directorio padre root:root0755. Los15 hashes de contenido y16 ancestros se verificaron; no hubo operación recursiva, cambio de bytes, perfiles, datos o reinicio. La auditoría posterior confirma los controles actuales; no convierte retrospectivamente esos archivos en autoridad histórica ni el fallo de adopción en un positivo.

Esquema, límites y fuentes de productor/consumidor revisados; las comprobaciones offline de identidad/permisos/lifetime y el preflight de sólo lectura pasan. La integración Linux aislada acredita rechazo de la raíz aún viva, preservación de la referencia anterior y cierre nativo incierto con ACK; también pasan ocho regresiones Linux de archivos/cleanup. El ensayo operacional posterior completa una transición nativa abandoned_unknown y un ACK reales, retira el binding exacto y reanuda API/worker R08; la evidencia consolidada conserva el negativo HostConfig y separa los controles actuales. No repite la generación original. La corrección adicional de limpieza del CLI pasa su validación offline; una reproducción de doble cancelación no acredita por sí misma la causa histórica. No se afirma entrega o cierre de AI-40 mediante este ADR.

## Referencias

- [ADR-054: contención del login](ADR-054-durable-native-login-reconciliation.md).
- [Arquitectura43](../../mvp/43-nodia-ai-execution-architecture.md) y [política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Ledger CHAT](../../../nodia-gemini-microservice/native_attempts.py), [conciliación CHAT](../../../nodia-gemini-microservice/nodia_ai_chat.py) y [admisión del perfil](../../../nodia-gemini-microservice/profile_admission.py).
- [Helper host de login existente](../../evidence/scripts/attach-nodia-gemini-login-cgroup.py).
- [Conciliación Gemini de Server](../../../nodia-server/src/nodia-ai-adapter/use-case/reconcile-gemini-nodia-ai-runtime.use-case.ts).

- [Validación offline del consumidor candidato](../../evidence/nodia-ai-ai40-gemini-chat-owner-consumer-validation-r01.json): distinta del ensayo kernel y de la aceptación operacional.
