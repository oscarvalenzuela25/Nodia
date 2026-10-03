# Pruebas aisladas, dependencias y runtime

Leer al cambiar suite, tooling, manifiesto, imágenes, workers o despliegue. Aplicar comandos del repositorio, no los ejemplos de una guía genérica.

## Aislamiento antes de discovery

- Instalar guardas de entorno/red antes de importar módulos de aplicación, no únicamente en `setUp` después de discovery. Considerar factories de fixtures y plugins que ejecutan imports anticipados.
- Mantener unittest/pytest u otro runner existente. Usar fixtures/cleanup del runner correspondiente y event loops compatibles; migrarlo solo si es parte del cambio autorizado.
- Redirigir `.env`, perfiles, sesión, caché SDK y uploads a temporales sintéticos antes de construir servicios. No leer credenciales operativas para copiarlas a una carpeta de test.
- Bloquear conexiones externas por defecto y fallar de forma explícita al intentar abrir Google/proveedor/browser real. Permitir solamente lo necesario para el runner/loop; no desactivar globalmente la protección porque Windows usa sockets internos.
- Un test que prueba IO HTTP puede usar ASGI/TestClient o loopback aislado si lo necesita. No sustituir "bloqueo de red externa" por prohibición universal de sockets que rompe infraestructura local del test.
- Simular el símbolo donde lo consume la aplicación y las fronteras del SDK. Verificar que el mock se usó cuando importa; un test verde que nunca interceptó el cliente real puede consumir cuota.
- Los tests bajo import deben cerrar contextos/temporales aunque falle un import. No usar escrituras al path operativo ni restaurarlo después como estrategia de aislamiento.
- Integración real: ejecución separada con cuenta/entorno de prueba y autorización existente. Registrar costo, efecto y recursos; no ejecutarla en la suite unitaria por defecto.

## Diseño de pruebas

- Probar contrato observable y efectos, incluidas las salidas adversas modificadas. Usar fakes para SDK/transporte; no exigir el layout de un helper privado como garantía del producto.
- Para retry, contar invocaciones y comprobar identidad/payload: éxito, auth recuperable, cuota, timeout y rechazo no deberían compartir ciegamente política.
- Para cancelación/cleanup, comprobar que el recurso se cerró y otra operación puede usarlo. Un flag `finally_called` sin validar el recurso puede ocultar fugas.
- Para concurrencia, usar eventos/barriers y reloj inyectado cuando sea útil; evitar sleeps largos y flaky assertions de orden temporal incidental.
- Para caché, comprobar lectura compartida, fallo desconocido, TTL y sustitución de sesión con consulta en vuelo. No usar un tiempo fijo del sistema que haga el test depender del reloj real.
- Un mock de DB no prueba aislamiento transaccional o restricciones bajo carrera real. Elegir integración aislada cuando esa garantía sea parte del cambio; respetar las capas de tests permitidas localmente.
- Seguir las pruebas vigentes de valor y corregir expectativas que afirmaban un comportamiento ficticio mediante un contrato autorizado. No borrar/regenerar assertions para conseguir verde.
- Documentación/skills: validar estructura, enlaces, metadata, copias y coherencia. No añadir tests al producto que solo reflejen el texto de instrucciones ni correr servicios reales por estos cambios.

## Dependencias y reproducibilidad

- Confirmar Python y plataforma soportados, manifiesto, constraints/lockfile y herramientas existentes. No imponer pip/uv/Poetry ni añadir otro archivo de resolución sin propósito.
- Alinear SDK, HTTP client, framework/ASGI, validación y navegador/binarios cuando haya acoplamiento. Una deprecation requiere evaluación de compatibilidad, no upgrade a ciegas.
- Usar instalación reproducible apropiada al proyecto. Pines/locks y hashes de artefactos aportan garantías distintas; un nombre con versión no prueba integridad del artefacto ni fija paquetes del sistema.
- Comprobar consistencia del entorno (por ejemplo `pip check` si usa pip) y auditar el manifiesto/resolución con herramientas compatibles. Registrar paquetes omitidos y cobertura; no afirmar que eso audita navegador/OS o lógica.
- Ejecutar tooling auxiliar en un entorno separado cuando evite contaminar dependencias runtime. No dejar scripts temporales, instalaciones ad hoc o cambios en el entorno de producción como residuo de la auditoría.
- Retirar dependencias solo después de inventariar imports, plugins, scripts, generación, binarios y operación. Una dependencia sin import textual puede ser peer/transitiva/loader; un SDK instalado no prueba disponibilidad operativa.

## Runtime, contenedor y estado

- Arrancar desde un entrypoint explícito, sin debug/reload en producción. Configurar workers desde una fuente comprobable; una variable del host puede multiplicarlos si no se controla la configuración real.
- Revisar estado local: perfil de navegador, locks, caché, colas y jobs. Un worker/propietario único puede ser el límite correcto hasta coordinarlo; un servicio stateless no necesita esa restricción automáticamente.
- En contenedor, usuario no root cuando sea compatible, permisos de volúmenes/secrets y writable paths explícitos. No resolver un permiso con `chmod 777`, borrando perfiles o copiando `.env` dentro de la imagen.
- Excluir secretos, sesiones, perfiles, entorno virtual y datos operativos del build context. Verificar el resultado cuando la imagen se construya; un `.dockerignore` escrito no demuestra que no se filtró una capa previa.
- Fijar base/dependencias según reproducibilidad y política de actualización. Actualizaciones de digest/browser requieren verificación; fijar una imagen no elimina sus vulnerabilidades.
- Acotar CPU, RAM, procesos, tmpfs/disco, shm y cantidad de trabajos según medición. Un tmpfs acotado controla temporales pero no el disco del perfil/volumen persistente; el presupuesto debe incluir buffering y copias.
- Playwright/Selenium/navegador: validar compatibilidad de versión/binarios y cierre. Un test de cliente simulado no verifica render/login ni permisos del browser en Linux.
- Mantener límites de proxy y aplicación coordinados, sin quitar la defensa interna por depender del proxy. Para servicio privado, comprobar binding/red/firewall reales además de autenticación.
- Readiness y healthcheck tienen significado/documentación explícitos. No reiniciar indefinidamente un proceso vivo solo porque caducó una sesión que necesita intervención del operador.

## Operación y evidencia de entrega

- Para cambios de runtime, verificar arranque sin credenciales, dependencia caída, shutdown, recursos/temporales y permisos en plataformas afectadas con datos sintéticos.
- Para sesión persistente, ensayar arranque frío, reinicio, expiración, renovación y restauración en entorno permitido. Nunca imprimir cookies/tokens o incluir backups sensibles en reporte.
- Para escalar, probar estado distribuido/propietario y recuperación entre replicas. Para publicar, comprobar exposición externa, proxy/TLS y recursos representativos; no llamar "VPS validado" a `docker compose config` local.
- Usar backup y procedimiento de rollback compatibles con estado persistido. Actualizar runbook/documentación del proyecto cuando cambie esa garantía; no crear planes temporales duplicados por rutina.
- Entregar comandos y resultados realmente ejecutados, cobertura y pendientes. Distinguir pruebas de Windows/Linux, mocks, browser real, cuenta real e infraestructura. No inventar un check exitoso porque existe el comando.
