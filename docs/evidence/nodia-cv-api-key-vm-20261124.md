# Nodia CV — Inferencia real de texto en el laboratorio VM

Fecha 2026-11-24, America/Santiago. [Plan113, CV-03](../mvp/113-nodia-cv-implementation-plan.md#cv-03--generación-y-selección-exacta-en-server). Base del worktree `50bb9ec4`, rama `codex/nodia-cv`. La ejecución usa el candidato compilado de CV-03 con sus cambios locales.

## Resultado

**API key real en el flujo de Nodia CV.** OpenAI, catálogo `2`, conexión `1`, modelo `gpt-6.1-terra`, esfuerzo `medium`. La configuración de la VM contenía esa selección en el catálogo y la clave seleccionada estaba activa, disponible para uso y sin espera. La observación previa devolvió `configuration_only` con cero intercambios. Después se ejecutó un único canario con perfil y oferta sintéticos, mediante admisión de CV, su worker y el transporte textual de API real. El borrador quedó `ready` y la elegibilidad posterior quedó `qualified` para esa selección y ese alcance del laboratorio.

**Agentic permanece inhabilitado en CV.** Se comprobó la selección Agentic configurada de OpenAI `1/gpt-6.1-sol/medium` contra la elegibilidad compilada de CV. Resultado `agentic_transport_unavailable`, sin calificación, sin elegibilidad ni envíos. El proveedor tiene parámetros Agentic en su propio catálogo. CV sigue pendiente de un descriptor, transporte y prueba terminal con su propia identidad.

| Dato comprobado | Observación |
| --- | --- |
| Entorno | VM de desarrollo Hyper-V `nodia-vps-lab`, Linux, Node 24.20.0, PostgreSQL 16.15 aislado |
| Ventana | 13:08:58 a 13:09:08 hora de Santiago, con 8,497 s entre la admisión y la actualización del resultado |
| Operación | `31e56502-39f4-49bf-9c19-6ea4af5cec21`, propósito `cv_tailoring`, prompt `cv-tailoring/1`, ledger con dueño `cv` |
| Intercambios | Uno reservado y uno iniciado, una operación de CV total, cero operaciones CV pendientes de reconocimiento |
| Resultado validado | Dos requisitos, uno obligatorio con evidencia de TypeScript y uno preferido sin evidencia de Kubernetes. Un hecho seleccionado y cero hechos restantes |
| Prueba | `nodia-cv-api-text/1`, esquema 1, cierre local comprobado al volver el ejecutor, remoto `completed`, fase `closed`, ACK y recurso `free`. Los hashes de petición y respuesta coinciden con la prueba terminal |
| SHA-256 de la respuesta | `a0d2230d985e4cc994cb3fde319545bf900ab56e67462fbcc2b6911110ca54f5` |
| Lectura posterior | La misma intención devolvió la generación guardada y su calificación. Volver a dar al worker el ID terminal no abrió otro intercambio |

## Entorno y reproducción

1. Se arrancó la VM con el [helper existente](scripts/start-nodia-ai-lab-vm.ps1), se comprobó su identidad con SSH estricto y se verificó que API, worker, Gemini y nginx estaban activos. La consulta de opciones activas sólo leyó banderas de configuración y la presencia de una clave seleccionada en modo de sólo lectura.
2. Se preparó un Postgres desechable de prueba en la VM. El puerto del contenedor quedó en loopback y la base comenzó vacía. Se aplicaron 75 migraciones **a esa base**. El candidato se instaló en un directorio de verificación aislado con las dependencias runtime existentes. Se mantuvieron las unidades systemd y el release activo.
3. El [runner](../../nodia-server/scripts/qualify-nodia-cv-text.mjs) se ejecutó como usuario de runtime de la VM. Los casos de uso y el worker escribieron en la base desechable. El servicio estándar de credenciales consultó la fuente configurada vía una conexión de sólo lectura y resolvió la clave exacta dentro del proceso. Las filas de referencia de la base desechable contienen punteros inertes para las FK. La comprobación de estado de la base configurada observó cero slots API ocupados y cero operaciones pendientes de ACK antes y después.
4. El runner sobre el candidato compilado recibió `--connection 1 --model gpt-6.1-terra --effort medium` para preflight. Se añadió `--run-once` una única vez para la prueba viva. Esta opción exige la base aislada vacía y la selección explícita que coincide con la vigente. Para verificar el resultado se usó una lectura SQL independiente sobre esa base.
5. Tras la lectura independiente y el ACK, se detuvo únicamente el contenedor desechable del canario. Su política de limpieza retiró sus datos temporales. La VM y las unidades API, worker, Gemini y nginx siguieron activas.

SHA-256 del paquete aislado `c5aa105ef6239ba1846c9644f53028ba578f4c536767d3e38aeb07dc1461678a`. El runner se actualizó después del preflight para comprobar el cierre y la concordancia de hashes con el ledger. SHA-256 de su versión ejecutada `2cde6c34b3c1e2b4e61a8f8aa7bd46ec289d16f459011ff18b2dc3d0d649633f`. Recibo sanitizado del runner `9c97160c6234a781dac36674d94031f335f2c1ce23bf80a19b7d0efe45de428b`. Recibo SQL independiente `fcb135e08f4fdc656c719d26e1c09578c39a1056461dad9b06a78a7d3252d624`.

La calificación reside sólo en la base aislada. Esta evidencia cubre el recorrido de casos de uso y worker contra la API externa, con perfil y oferta sintéticos. Quedan pendientes la adopción en el entorno activo, el flujo HTTP/UI de generación, un transporte Agentic propio y sus pruebas, y otras selecciones o modalidades. Las claves, los perfiles de sesión, el prompt y la respuesta completa se conservaron fuera del recibo.
