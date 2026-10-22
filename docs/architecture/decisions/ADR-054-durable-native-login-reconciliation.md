# ADR-054 — Identidad durable y conciliación del login nativo

> Estado: propuesto; implementación y aceptación se registran separadamente.
> Fecha: 2026-10-17.

## Contexto

AI-29 separa credenciales y desafíos del chat. Sin embargo, los mapas de login de los procesos no permiten al worker conciliar una respuesta inicial perdida o un reinicio de la API. Un 404, un timeout o la desaparición del PID del padre no demuestran que Chromium o el CLI terminaron. AI-29-R01 exige conservar la identidad de la intención sin repetir un login incierto ni retener el contenido del chat.

## Opciones consideradas

### Mantener mapas y cuarentena permanente

Es simple y evita repetir efectos, pero bloquea al dueño aunque el login siga vivo en otro proceso. No satisface la recuperación prevista.

### Persistir desafíos en SQL o crear otro servicio de sesiones

Facilitaría compartir estado, pero extiende la superficie de secretos y la infraestructura. SQL tampoco demuestra el cierre de los procesos nativos.

### Supervisor local por intento y prueba mínima en el perfil

Permite consultar y cancelar el mismo intento desde API y worker mediante un socket local privado. El supervisor conserva desafíos sólo en memoria y escribe identidad, plazo y prueba de estado, sin credenciales. Requiere controlar hijos, permisos y cierre real.

## Decisión

Usar la tercera opción en los adaptadores existentes. No se crea un microservicio ni un puerto de red. La intención usa `native_request_key`, ya persistida antes del despacho, y el descriptor seguro conserva destino exacto y UUID de solicitud. Las interacciones posteriores tienen sus propias claves; no sustituyen la identidad del login.

El inicio recibe un plazo inmutable, acotado por el flujo SQL. Una cancelación previa a la admisión escribe un marcador que impide un inicio tardío. Al vencer el plazo, un inicio antiguo se rechaza incluso si ya se retiró su marcador terminal. Las pruebas terminales pueden eliminarse de forma acotada; una prueba incierta no se elimina para simular éxito.

El acceso local usa directorios privados y sockets restringidos al usuario del servicio; actor, conexión, modo y solicitud se contrastan con el registro. No se confía en un UID declarado por el cliente. Los desafíos, enlaces OAuth, códigos, capturas y credenciales no se escriben en el registro ni llegan al modelo.

Observar y cancelar una intención existente no inicia otra autenticación. Sólo una respuesta nativa validada y el cierre demostrado permiten liberar el testigo. La identidad del proceso incluye su nacimiento; el PID aislado, su ausencia o un 404 conservan incertidumbre. La compatibilidad Windows depende de disponer de las mismas garantías y no se presume a partir de Linux.

Una cancelación demostrada acredita que el intento ya no continuará trabajando. No acredita logout ni revierte una autorización que pudiera haber alcanzado el almacén nativo antes de un crash. Ese caso no genera recibo de login completado; el estado actual de la cuenta se observa por separado. Una cuenta previamente autenticada tampoco prueba por sí sola el resultado de un intento perdido.

### Contención Linux de Gemini

Los procesos Chromium pueden crear sesiones y grupos propios. Una prueba basada únicamente en PGID no contiene ese árbol. Se descartó el ensayo con seccomp, preload y flags de crash reporting: Chromium real no mantuvo un funcionamiento compatible. Esas variantes no forman parte de la entrega.

Gemini utiliza un cgroup v2 por intento bajo el cgroup del contenedor existente. El supervisor permanece detrás de un gate hasta que su pertenencia y la identidad del cgroup sean durables. Todos sus descendientes heredan ese ámbito, incluso si crean otra sesión. El cierre exige `cgroup.events: populated 0`; la cancelación forzada utiliza `cgroup.kill`. El candidato de resultado que escribe el supervisor no se presenta como terminal antes de esa prueba.

Un helper privilegiado del host adjunta exclusivamente la vista del cgroup de ese contenedor en `/run/nodia-login-cgroups`, con `nosuid,nodev,noexec`. Delega la creación de subgrupos y la migración de procesos propios al UID del servicio. El `cgroup.kill` raíz permanece privilegiado. No se añade una capability al contenedor, socket Docker, puerto, modo de namespace o nuevo servicio, ni se cambian sus límites de memoria/CPU/procesos.

Esta delegación contiene los adaptadores y sus procesos de confianza; no constituye un sandbox frente a código malicioso con el UID del servicio. La prueba presupone que esos procesos no migran explícitamente fuera del subgrupo mediante `cgroup.procs`. Crear otra sesión o PGID por sí solo conserva la contención.

El helper se ejecuta en `ExecStartPost` de la unidad Gemini existente. Guarda una identidad mínima por generación y publica una certificación sin secretos, propiedad de root y de sólo lectura. Sólo el host puede certificar que un cgroup anterior quedó vacío o fue retirado tras un reinicio de Docker/host. El adaptador valida esa certificación antes de conciliar un ámbito anterior; un namespace distinto por sí solo sigue siendo insuficiente. Si falta la delegación o su prueba, el nuevo login durable falla explícitamente.

## Consecuencias

- API y worker pueden conciliar el mismo intento sin compartir memoria y sin mantener SQL abierto durante I/O.
- Se reutilizan los perfiles y el journal SQL; no se necesitan tablas de conversación nuevas.
- Los registros operativos tienen cardinalidad y vida acotadas. La incertidumbre requiere conciliación verificable, nunca redispatch automático.
- Un socket privado y un perfil persistente forman parte del contrato operativo; varias réplicas en hosts diferentes requieren otra decisión.
- La publicación MCP, la aprobación documental y la aceptación de una cuenta real conservan sus gates propios.

## Referencias

- [AI-29 y R01](../../mvp/75-nodia-ai-ai29-secure-human-flows.md).
- [Canal humano](ADR-053-nodia-ai-secure-human-interaction.md).
- [Arquitectura de ejecución](../../mvp/43-nodia-ai-execution-architecture.md).
