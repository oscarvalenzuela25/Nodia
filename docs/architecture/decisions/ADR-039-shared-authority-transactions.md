# ADR-039 — Autoridad vigente dentro de las transacciones de dominio

> Estado: propuesto; implementado y comprobado localmente en AI-08, sin aprobación documental automática
> Fecha: 2026-10-15

## Contexto

Una lectura de permisos antes de escribir deja una carrera con la revocación. Finanzas y Reservas necesitan separar actor y propietario sin perder reglas nativas; NI-13 exige exclusión entre cambios concurrentes del último super_admin. La aplicación mantiene autoridad distribuida en nueve tablas y los consumidores futuros deben reutilizar los casos de uso.

## Opciones consideradas

### Lectura puntual o autorización desde caché

Barata, pero no excluye revocaciones entre lectura y efecto. Rechazada para operaciones admitidas y para NI-13.

### Advisory lock global o versión de autoridad nueva

El advisory lock requiere que todos los escritores lo respeten; además una consulta de espera puede fijar un snapshot anterior en REPEATABLE READ. Versiones/filas de autoridad permiten menor contención, pero requieren nuevas estructuras, bootstrap y protocolo de revalidación. Reservadas para una necesidad medida.

### Locks de tablas existentes, previos al snapshot

No añade persistencia ni estado duplicado. SHARE permite efectos concurrentes y excluye escrituras de autoridad; SHARE ROW EXCLUSIVE serializa sus escritores. Su costo es global y afecta mantenimiento. Elegida para la etapa actual.

## Decisión

LOCK TABLE como instrucción utility antes del primer SELECT, en orden actions/auth_sessions/module_groups/modules/role_actions/roles/user_modules/user_roles/users. Fronteras de dominio SHARE, escritores SHARE ROW EXCLUSIVE; luego releer identidad/sesión/rol y reglas necesarias dentro del mismo manager, antes de locks específicos de dominio. lock_timeout2s, statement_timeout5s. No inferencia/red ni espera humana en esa frontera.

REST obtiene ActorReference de autenticación; los puertos internos heredan identidad y transacción validada. Finanzas/Reservas reutilizan el manager del ejecutor NodiaAI. Core mantiene frontera exclusiva propia; AI-27 debe integrar sus puertos en esa frontera, sin anidarlos bajo SHARE. La política del módulo continúa siendo AI-07, y los permisos del modelo nunca proceden del Markdown.

## Consecuencias

- Las revocaciones se ordenan respecto de efectos admitidos y el último administrador queda protegido con rollback atómico.
- El LOCK previo al snapshot preserva la decisión actual después de esperar en REPEATABLE READ. Prueba real incluye revocación precedente y consulta financiera esperando.
- Costo: cambios de sesión/autoridad y mantenimiento compiten globalmente con transacciones de dominio. Los timeouts limitan espera pero no acreditan capacidad productiva. No se autorizan transacciones largas ni replays de resultado incierto.
- Trabajo posterior: medir duración/concurrencia en despliegue, integrar consumidores por etapa, conservar protocolo en nuevos escritores; si la contención lo exige, sustituir con una barrera más granular mediante un ADR y pruebas equivalentes. No añadir un epoch ledger preventivo.

## Referencias

- [AI-08/54](../../mvp/54-nodia-ai-ai08-transversal-authority.md), [AI-07/53](../../mvp/53-nodia-ai-ai07-module-authorization.md), [plan45](../../mvp/45-nodia-ai-implementation-plan.md).
- [PostgreSQL16: consistencia en la aplicación](https://www.postgresql.org/docs/16/applevel-consistency.html): adquirir locks antes de establecer el snapshot cuando se usa REPEATABLE READ.
- [PostgreSQL16: locks explícitos](https://www.postgresql.org/docs/16/explicit-locking.html): compatibilidad, duración y conflictos de modos de tabla.
