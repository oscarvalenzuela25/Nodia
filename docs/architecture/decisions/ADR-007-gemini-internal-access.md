# ADR-007 — Acceso interno exclusivo al microservicio Gemini

> Estado: opción A elegida por el usuario; protección local implementada, despliegue y verificación externa pendientes
> Fecha: 2026-09-28
> Autorización: «Vamos con la opcion de solamente que pueda ser llamado desde nodia-server».

## Contexto

Nodia Server (NestJS) llama al microservicio Gemini (FastAPI) para analizar facturas y consultar su sesión/modelos. Actualmente FastAPI no autentica al llamador y el Compose local publica el puerto en `127.0.0.1`. El despliegue de ambos servicios en VPS sigue pendiente. Es necesario decidir si FastAPI será una API pública para clientes como Postman o un adaptador privado de NestJS.

## Opciones consideradas

### Opción A: solo Nodia Server llama directamente a FastAPI — elegida

- Ventajas: una sola frontera pública de usuarios, permisos, cuotas y auditoría en NestJS; menor superficie expuesta; sesión y credenciales de Google fuera del acceso directo de terceros.
- Desventajas: cualquier integración externa debe pasar por endpoints autorizados de Nodia Server; se necesita identidad entre servicios y operación de una red privada.

### Opción B: FastAPI admite clientes externos directos

- Ventajas: permite integraciones directas con Postman y otros sistemas.
- Desventajas: exige credenciales y permisos propios por cliente, gateway/TLS, cuotas, auditoría, versionado y separación estricta de rutas administrativas; amplía la superficie de ataque y duplica controles del borde público.

## Decisión

Adoptar la **opción A** para la primera entrega: el cliente web y Postman, cuando corresponda, llaman a Nodia Server; solo Nodia Server llama a FastAPI. FastAPI no tendrá un puerto publicado a Internet ni una interfaz pública propia. Se protegerá en dos capas:

1. Red: bind a loopback y firewall si NestJS corre en el host; o red Docker compartida sin `ports` en FastAPI si ambos son contenedores. La topología final depende del despliegue elegido para NestJS. Gemini conserva solo la salida a Google necesaria para funcionar.
2. Identidad: FastAPI comprueba la identidad propia de Nodia Server en toda ruta sensible y rechaza llamadas sin ella. Para el VPS inicial se eligió un token aleatorio de 32 bytes codificados en hex, compartido mediante `GEMINI_SERVICE_TOKEN` y enviado en `X-Nodia-Service-Token`. Se compara en tiempo constante, no tiene valor por defecto y debe rotarse simultáneamente en ambos procesos. La red local no reemplaza esta comprobación. Si los servicios se separan entre hosts o aumenta el número de consumidores, revisar mTLS o credenciales de servicio de corta vida en otro ADR.

NestJS sigue siendo responsable de autenticar usuarios, autorizar cada acción/objeto y limitar el consumo. Las rutas de login, refresh, sesión y el eventual visor remoto permanecen internas y requieren permiso administrativo a través de Nodia Server. CORS no se considera una barrera de acceso. Si en el futuro se pide consumo externo, se diseñarán endpoints en NestJS o un nuevo ADR antes de publicar FastAPI.

## Consecuencias

- Consecuencia positiva: una sola API pública para Nodia y un adaptador Gemini sin acceso directo desde Internet.
- Riesgo aceptado: procesos con acceso al host o red privada pueden intentar contactar FastAPI; se mitiga con identidad entre servicios, segmentación y permisos del host.
- Trabajo posterior: cerrar la autenticación de FastAPI, transmitir identidad desde todas las llamadas de `GeminiService`, retirar CORS amplio y rutas innecesarias, aplicar permisos de negocio en NestJS y probar desde una red externa que `:8000`/`/docs` no responden.
- Criterio de salida: una solicitud directa desde Internet no llega a FastAPI; una solicitud local sin identidad recibe 401/403; Nodia Server autorizado funciona; un usuario Nodia sin permiso es rechazado antes de invocar Gemini.

## Implementación local inicial — 2026-09-28

- FastAPI exige identidad interna en rutas sensibles y da un `/health` mínimo; se retiró CORS amplio y las rutas HTTP libres `/generate` y `/refresh-session` que NestJS no utilizaba.
- El cliente dejó de llamar `localhost:8000/auth/login`. En desarrollo local, el botón pasa por NestJS, exige `ai:manage` y usa un trabajo asíncrono protegido por token interno; Chrome aparece en el host Python. En producción el botón no inicia ese trabajo hasta disponer de visor remoto privado y prueba en VPS.
- `GeminiService` añade la cabecera interna a verificación, modelos y análisis. Ambos archivos `.env` locales ignorados por Git recibieron el mismo token aleatorio. La credencial no se imprime ni se envía al navegador.
- Los controladores administrativos de IA exigen la acción `ai:manage`; verificar proveedores y analizar facturas exige `invoice:analyze`. El rol activo `super_admin` puede pasar; las acciones se crean por migración y se asignan expresamente a otros roles. La comprobación consulta la BD en cada petición protegida para que una revocación tenga efecto inmediato.
- Se limitó el archivo a 10 MB y se verifica firma de PDF/imagen en ambos servicios. FastAPI limita a dos análisis simultáneos, usa nombres temporales aleatorios y deja de registrar respuestas crudas de Gemini. NestJS no devuelve ni huella ni ciphertext de API keys.
- La clave maestra fija de AI keys se eliminó. El formato `v2` requiere `AI_SECRET_MASTER_KEY` aleatoria; una migración transaccional transforma filas antiguas si se suministra `AI_LEGACY_MASTER_KEY`. La BD local contenía cero API keys al revisar; otros entornos requieren inventario y migración antes del despliegue.
- Pendiente: prueba desde fuera del VPS, topología final de NestJS, proxy/firewall/TLS, permisos del volumen, rotación ensayada, recuperación y verificación de usuarios/objetos por ámbito.

## Referencias

- [Plan de seguridad](../../mvp/17-security-hardening-plan.md)
- [ADR-008 — Política para futuros microservicios](ADR-008-internal-microservices-only.md)
- [Stack DevOps](../../mvp/10-stack-devops.md)
- [ADR-005 — Sesión Gemini Web](ADR-005-gemini-web-session.md)
- [ADR-006 — Proveedores de IA](ADR-006-ai-provider-configuration.md)
