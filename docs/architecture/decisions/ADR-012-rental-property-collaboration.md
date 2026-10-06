# ADR-012 — Reservas compartidas por casa y registro monetario operativo

> Estado: propuesto
> Fecha: 2026-10-04

## Contexto

El usuario confirmó una herramienta de reservas para una casa completa, cobro por noches en CLP, pagos y gastos, con colaboradores agregados por el propietario para administrar como en Business. Cambiar más adelante el propietario de todos los registros desde usuario individual a casa compartida implicaría migrar relaciones, consultas, autorización y caché.

Business utiliza `businesses` y `business_collaborators`, con propietario, usuario, `position`, `action_ids` y estado. Su experiencia es una referencia; no se ha solicitado convertir una casa en Business ni extender a Reservas el acceso global confirmado para productos/facturas/archivos. Finanzas personales pertenece a usuarios y tiene reglas distintas de fechas/estados; reutilizar sus movimientos como datos compartidos de Reservas mezclaría ámbitos y reconocimiento de caja.

## Opciones consideradas

### Opción A: casa como Business y dinero como Finanzas personales

- Ventajas: reutiliza estructuras existentes y algunos flujos de interfaz.
- Desventajas: acopla alojamiento con proveedores/productos/facturas, confunde colaboración por casa con acceso de Negocios y datos financieros personales, y exige adaptar reglas de fechas/duplicación. La solicitud de experiencia similar no confirma estos vínculos.

### Opción B: dominio modular de Reservas con casa como ámbito compartido

- Ventajas: expresa propietario/colaboradores y operaciones compartidas directamente; conserva una separación clara de Business y Finanzas; permite ampliar a más casas sin reinterpretar la historia.
- Desventajas: requiere entidades/contratos propios, una política de pertenencia y resumen monetario específicos; algunas piezas visuales se parecerán a Business.

### Opción C: framework genérico de ámbitos, miembros y finanzas para todos los módulos

- Ventajas: podría centralizar comportamientos realmente comunes a futuro.
- Desventajas: cambia varios dominios antes de conocer sus necesidades, añade abstracciones y obliga a reconciliar garantías que actualmente difieren. El alcance de una casa no justifica esa infraestructura.

## Decisión

Proponer **B**, dentro de Nodia Server y Client existentes. La colaboración y los gastos son requisitos confirmados; este esquema técnico completo permanece propuesto.

- Casa con propietario y colaboradores relacionados con usuarios existentes. Todos los datos operativos se asocian a la casa; actor de una escritura conserva autoría y no se convierte en dueño exclusivo del dato.
- Proponer acceso operativo completo del colaborador a reservas/pagos/devoluciones/gastos/preparación/bloqueos, y gestión de miembros/configuración general por propietario. No copiar `action_ids` ni introducir permisos por cada acción sin requisito confirmado.
- Autorizar consultas y escrituras por pertenencia vigente al ámbito real. Visibilidad de módulo y autenticación no conceden acceso a cualquier casa. No agregar privilegio transversal de superadministrador sin una decisión explícita de producto.
- Reutilizar componentes/infraestructura existentes cuando el contrato coincida. No importar servicios de Business para crear casas ni duplicar automáticamente dinero en Finanzas personales.
- Registro monetario de Reservas distingue acuerdos, cobros recibidos, devoluciones efectivas y gastos pagados; todos compartidos por casa, en CLP y con fecha efectiva/autoría.
- No crear microservicio, cambiar stack ni abstraer genéricamente pertenencia/dinero de otros módulos en esta entrega.
- ERD posterior concretará IDs/FKs, constraints, pagos, historial, idempotencia, revocación concurrente y protección conjunta de reservas/bloqueos. No prometer integridad o acceso comprobados por escribir este ADR.

## Consecuencias

- Positivas: una sola historia de operación para propietario/colaboradores; separación entre ámbito de datos y usuario que registra; independencia de las decisiones históricas de Negocios/Finanzas.
- Costos o riesgos aceptados como propuesta: contratos y verificaciones propios, invalidación de caché al retirar miembros, concurrencia de operaciones monetarias y disponibilidad. Evitar duplicación de reglas dentro del propio dominio con una implementación compartida por casos de uso.
- Trabajo posterior: ERD/contratos y matriz final de capacidades; pruebas de propietario/colaborador/externo/revocado, asociaciones por casa, idempotencia y carreras reales en PostgreSQL aislado. La opción de registro simple de ropa de cama es una inferencia pendiente de corrección si el usuario quería inventario.

## Referencias

- [Entrevista de Reservas](../../mvp/25-rental-reservations-interview.md)
- [Especificación funcional](../../mvp/26-rental-reservations-spec.md)
- [Aclaración de alcance de Negocios](../../mvp/04-prd-v2.md)
- [Finanzas personales](../../mvp/20-personal-finance-interview.md)
- Referencia ejecutada de Business: `nodia-server/src/business/entities/business.entity.ts`, `entities/business-collaborator.entity.ts`, `dto/assign-collaborators.dto.ts` y `business.service.ts`.

## Estado tras aceptar el ERD — 2026-10-04

El usuario aceptó el [ERD 27](../../mvp/27-rental-reservations-erd.md): ámbito por casa, colaboradores operativos, autoría y dominio monetario independiente. Se incorporó al JSON de Obsidian y documento 03; [contratos 28](../../mvp/28-rental-reservations-contracts.md) y [plan Backend 29](../../mvp/29-rental-reservations-backend-plan.md) se preparan en revisión. Esta aceptación del esquema no cambia automáticamente el estado del ADR completo.

## Evidencia de implementación local — 2026-10-04

Backend implementado en módulos verticales `src/rental-*`, sin nuevas tablas respecto del ERD aceptado. [Entrega/runbook de 29](../../mvp/29-rental-reservations-backend-plan.md) registra tests de casos de uso y PostgreSQL/HTTP real aislado, incluidas concurrencia, revocación, idempotencia, fallos antes de commit y recuperación. No se conectó a la BD objetivo ni se aprueba automáticamente este ADR.
