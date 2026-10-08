# ADR-018 — Codex Agentic local con supervisor interno

> Estado: propuesto; implementación autorizada por el usuario, sin aprobación documental automática.
> Fecha: 2026-10-08.

## Contexto

El usuario solicita OpenAI `token_plan_agentic`, conservando API key. Primero debe ejecutarse en local y después permitir QA remoto de Nodia mediante TryCloudflare. El 2026-10-08 pidió completar el código sin levantar PostgreSQL y aplazar la validación operativa. No se ha autenticado una cuenta ni realizado una inferencia real.

## Opciones consideradas

### Supervisor dentro de Nodia Server

- Mantiene autorización, IDs, contratos HTTP y configuración por instancia existentes.
- Utiliza Codex app-server por JSONL/stdio, sin otro listener HTTP ni credencial interna adicional.
- Los procesos, perfiles, jobs y cachés pertenecen a un único Server; no habilita perfiles compartidos entre réplicas.

### Microservicio independiente

- Permitiría límites duros de memoria y aislamiento mediante contenedor/worker.
- Añade transporte, despliegue, credenciales y fallos distribuidos sin una necesidad comprobada para esta entrega. Si se introduce después, aplicar ADR-008.

### Responses directo con autorización del plan

- Evita la orquestación de Codex y podría simplificar una extracción sin herramientas.
- Es una integración distinta; no sustituye silenciosamente el canal Agentic solicitado. Registro, consentimiento y elegibilidad SIWC siguen pendientes para modalidades alojadas/comerciales.

## Decisión

Implementar un supervisor NestJS con Codex `0.161.0` fijado en package-lock. Perfil por ID de conexión, fuera del repositorio, directorios privados y credenciales únicamente en keyring. La renovación queda gestionada por el runtime; login por código de dispositivo y trabajos privados por actor autenticado. No importar el perfil de Codex de esta conversación ni aceptar una cuenta API para Agentic.

Usar un proveedor Responses interno `nodia_codex`, con autenticación OpenAI y reintentos de solicitudes/streams en cero. El ID reservado `openai` no admite estas sobreescrituras en la versión instalada. No fijar `base_url` ni modelos: la autenticación selecciona la ruta y cada análisis exige un modelo descubierto/configurado. El catálogo de un proveedor personalizado puede proceder del runtime; no acredita acceso real de la cuenta.

Cada factura crea un contexto efímero, espera un turno terminal y valida la salida con el contrato existente. PDF se convierte en imágenes en un proceso acotado. Comandos, plugins, apps, agentes adicionales y búsqueda se deshabilitan por configuración comprobada; sandbox de solo lectura y sin red para herramientas. Las solicitudes interactivas del runtime se rechazan. Esta combinación no equivale a aislamiento de una VM y su comportamiento con inferencia real queda pendiente.

Quick Tunnel expone Vite y el proxy autenticado de Nodia. El runtime no se expone. El login usa el navegador del operador mediante código de dispositivo, sin callback a localhost. Los jobs se consultan por polling, compatible con la ausencia de SSE en Quick Tunnels.

## Consecuencias

- API keys, modelos y sesiones de Gemini permanecen independientes. No hay cambio automático de proveedor/modo ni replay después de un resultado incierto.
- Máximo cuatro perfiles/procesos, dos extracciones y una operación exclusiva por perfil; sin cola. Caché de observaciones/modelos de 30 s y cierre de perfiles inactivos a los cinco minutos.
- Presupuesto total de análisis configurable entre 1 y 300 s, 300 s por defecto; PDF máximo 60 s; transporte Client 360 s. Login máximo cinco minutos.
- El supervisor controla RSS del runtime cada cinco segundos y lo termina si supera 512 MiB. No es una cuota dura del SO. El worker PDF limita heap JS a 256 MiB y dimensiones/bytes de salida; memoria nativa adicional requiere observación real.
- Un lock residual falla de forma cerrada. Se registran PID de Server/runtime; no se recupera automáticamente solo porque el PID de Server murió. Revisar ambos procesos antes de retirar el lock. Cierre normal elimina lock y temporales.
- Windows queda deshabilitado hasta implementar/verificar ACL y supervisión equivalente. Inicio nativo comprobado en macOS; Linux/keyring y operación con cuenta pendientes.
- Migración de capacidades preparada y no aplicada. Conserva IDs, flags de instancias, claves, modelos y campos. Registra exclusivamente los flags previos del catálogo para reversión.
- La cuenta real, renovación/revocación, PNG/PDF reales, PostgreSQL y QA remoto se verifican en una fase posterior. El login local no acredita acceso SIWC para VPS/servicios alojados.

## Referencias

- [Plan 33](../../mvp/33-chatgpt-integration-pending.md), [contrato IA](../../mvp/ai-provider-feature-contract.md), [runbook Codex](../../features/ai-providers/openai-codex-agentic.md).
- [App-server](https://learn.chatgpt.com/docs/app-server), [autenticación](https://learn.chatgpt.com/docs/auth), [configuración](https://learn.chatgpt.com/docs/config-file/config-reference).
- [Integración SIWC](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
