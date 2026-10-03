# ADR-008 — Microservicios internos consumidos solo por Nodia Server

> Estado: política confirmada por el usuario; guía de implementación documentada, verificación operativa por servicio pendiente
> Fecha: 2026-09-28
> Autorización: «para próximos microservicios, ... mismo formato, solo se podrá consumir desde nodia-server».

## Contexto

Gemini adoptó en [ADR-007](ADR-007-gemini-internal-access.md) un adaptador privado con dos barreras: red no publicada e identidad de Nodia Server mediante token de servicio. Al añadir otros microservicios, repetir solo parte de ese patrón podría dejar rutas abiertas, exponer credenciales al navegador o crear una llave compartida entre servicios. Se necesita una política común y una verificación por cada nuevo servicio.

## Opciones consideradas

### Opción A: Nodia Server como único consumidor directo — elegida

- Ventajas: un solo ingreso público para usuarios, permisos, cuotas y auditoría; cada servicio conserva una superficie de red pequeña y credenciales separadas.
- Desventajas: toda capacidad externa necesita contrato en NestJS; cada servicio requiere red, token, rotación y pruebas propias.

### Opción B: publicar cada microservicio como API para clientes

- Ventajas: acceso directo para integraciones externas.
- Desventajas: multiplica autenticación, autorización, TLS, cuotas, auditoría y operación. Amplía la superficie expuesta.

## Decisión

Todo microservicio nuevo de Nodia será **interno**: únicamente `nodia-server` puede llamarlo. El navegador, la app móvil y Postman solo llaman endpoints autorizados de Nodia Server. Un microservicio no expone rutas de negocio ni administración a Internet.

Cada par Nodia Server ↔ microservicio tendrá una **credencial de servicio distinta**, generada con al menos 32 bytes aleatorios, sin valor por defecto. El servicio comprueba la credencial en todas sus rutas salvo un `/health` mínimo, compara en tiempo constante y falla al arrancar si falta la configuración. Nodia Server añade la credencial desde el servidor en todas las llamadas. El formato inicial sigue el precedente de Gemini: 64 caracteres hexadecimales en la cabecera `X-Nodia-Service-Token`. No se reutiliza `GEMINI_SERVICE_TOKEN` para otros servicios.

El aislamiento de red es obligatorio además de la credencial: bind a `127.0.0.1` si Nodia Server corre en el host, o red Docker privada sin `ports` públicos si ambos están en contenedores. La topología de producción debe probarse desde fuera del VPS. Si un servicio pasa a otro host o aparecen varios consumidores, revisar transporte autenticado, TLS/mTLS o credenciales de corta duración en un ADR nuevo antes de desplegarlo.

La identidad del servicio no representa al usuario. Nodia Server conserva autenticación de sesión, permisos por acción y objeto, validación de entrada, límites de uso y auditoría. Las acciones administrativas del microservicio solo se exponen mediante flujos administrativos explícitos en NestJS; no se crea un proxy genérico que reenvíe rutas arbitrarias.

## Consecuencias

- Consecuencia positiva: añadir un microservicio no crea otra API pública ni entrega secretos internos a clientes.
- Costo: se deben crear adaptador, token, configuración de red, pruebas negativas y runbook para cada servicio.
- Riesgo aceptado: una credencial compartida de larga vida requiere custodia y rotación coordinada. Un contenedor con acceso a la red privada puede intentar conexiones; la credencial y el aislamiento del host limitan ese riesgo.
- Trabajo posterior: probar el patrón en el VPS para Gemini, diseñar rotación con continuidad de servicio y completar los controles pendientes del [plan de seguridad](../../mvp/17-security-hardening-plan.md). Cada nuevo servicio debe superar su propia puerta de salida de la [guía](../internal-microservice-security.md).

## Referencias

- [Guía para agregar microservicios internos](../internal-microservice-security.md)
- [ADR-007 — Gemini interno](ADR-007-gemini-internal-access.md)
- [Runbook de despliegue Gemini](../../mvp/18-security-deployment-runbook.md)
