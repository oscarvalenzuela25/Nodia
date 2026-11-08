---
{
  "schema_version": 1,
  "document_id": "reservations.confirmed-reservation-lifecycle",
  "product_id": "reservations",
  "kind": "feature",
  "revision": 2,
  "document_status": "approved",
  "implementation": {
    "status": "partial",
    "notes": "AI36-C05 publica sólo la sección adicional enumerada bajo autorización humana específica; los apartados previos conservan su fecha y alcance. Contratos internos y publicación no prueban despliegue, inferencia o aceptación productiva."
  },
  "integration_status": "published",
  "maintainer": "Mantenimiento de Reservas y NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/28-rental-reservations-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/41-nodia-ai-v1-contracts.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/dto/update-rental-reservation.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/dto/reservation-commands.dto.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/use-case/create-rental-reservation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/use-case/update-rental-reservation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/use-case/confirm-rental-reservation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/use-case/start-rental-reservation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/use-case/complete-rental-reservation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/rental-reservation/use-case/cancel-rental-reservation.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-rental-reservation/use-case/build-nodia-ai-rental-reservation-operations.use-case.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-24",
    "evidence_paths": [
      "docs/mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md",
      "docs/evidence/nodia-ai-ai25-postgresql.json",
      "docs/evidence/nodia-ai-ai25-regressions.json",
      "docs/evidence/nodia-ai-ai25-ui-validation.json",
      "docs/evidence/nodia-ai-ai25-tested-release-parity.json",
      "docs/evidence/nodia-ai-ai25-lab-activation.json",
      "docs/evidence/nodia-ai-ai25-deployed-equality.json",
      "docs/evidence/nodia-ai-ai25-lab-runtime.json",
      "docs/evidence/nodia-ai-ai25-knowledge-validation.json",
      "docs/evidence/nodia-ai-ai36-c01-validation.json",
      "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-validation.json"
    ],
    "notes": "Publicación offline con builders nativos y schemas cerrados. El fragmento adicional es el único alcance nuevo; no equivale a cuenta real ni a una aceptación de todos sus efectos."
  },
  "approval": {
    "reference": "docs/evidence/nodia-ai-ai36-c05-write-publication-r02-authorization.md",
    "revision": 2,
    "content_sha256": "d75cf4b6cfb7b5013fefb8b54d5a19a0445e7426bdb6a37755d8540aaf190fa8"
  }
}
---

# Reservas confirmadas y ciclo comercial — contexto funcional para NodiaAI

## Qué resuelve y qué significa

Crear un acuerdo de estadía como borrador, editarlo dentro de su fase, confirmarlo, iniciar/completar la estadía o cancelarlo mediante una propuesta y botón humano exactos. [AI-25/71](../../../../mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md) amplía los puertos internos; esta ficha no publica escrituras. Disponibilidad es una observación temporal; crear draft no ocupa fechas y confirmar sí exige disponibilidad actual.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Aclaración necesaria |
|---|---|---|
| «¿Hay cupo del viernes al domingo?» | Lectura de disponibilidad | Resolver casa, fechas civiles y horarios; no tratar la consulta como hold |
| «Haz una reserva para esas fechas» | Crear borrador | Pedir huésped/contacto, cantidad, canal, tarifa, anticipo y horarios que falten |
| «Confírmala» | Transición comercial | Resolver reserva; comprobar anticipo/política o condiciones de plataforma y recambio sin fabricar pagos |
| «Ya llegó el huésped» | Iniciar estadía | Resolver reserva; comprobar ventana y preparación efectiva |
| «Cancela y devuélvele lo que corresponda» | Cancelación y pago distintos | Solicitar fecha/resolución que falte, mostrar cálculo y aclarar que pagar devolución conserva AI-26 |
| «Cambia el precio de una estadía con pagos» | Cambio posiblemente prohibido | Aplicar inmutabilidad del acuerdo; no crear otra reserva implícitamente para eludirla |

Ejemplos ilustrativos; no contienen datos ni respuestas numéricas operativas. Pedir mínimos y ambigüedades, sin exigir campos opcionales ni inferir pagado/pendiente por una frase.

## Operaciones y contratos

| Preparador interno | Writer nativo | Resultado |
|---|---|---|
| `nodia_rental_reservations_prepare_create` | `CreateRentalReservationUseCase` | Reserva draft |
| `nodia_rental_reservations_prepare_update` | `UpdateRentalReservationUseCase` | Acuerdo/campos autorizados editados |
| `nodia_rental_reservations_prepare_confirm` | `ConfirmRentalReservationUseCase` | Reserva confirmed |
| `nodia_rental_reservations_prepare_start` | `StartRentalReservationUseCase` | Estadía in_progress |
| `nodia_rental_reservations_prepare_complete` | `CompleteRentalReservationUseCase` | Estadía completed |
| `nodia_rental_reservations_prepare_cancel` | `CancelRentalReservationUseCase` | Acuerdo cancelled; devolución aprobada no pagada |

Son preparadores internos, no herramientas MCP publicadas. Los [DTOs](../../../../../nodia-server/src/rental-reservation/dto/create-rental-reservation.dto.ts) y [casos de uso](../../../../../nodia-server/src/rental-reservation/use-case/create-rental-reservation.use-case.ts) enlazados definen mínimos/validaciones. Las [lecturas publicadas](reservations.md) conservan autoridad y alcance; no se añade SQL, HTTP arbitrario ni acceso a Airbnb.

## Datos mínimos y resolución de dudas

| Concepto | Condición real | Aclaración |
|---|---|---|
| Crear draft | Casa, huésped/contacto, cantidad, canal, días/horas propios, tarifa y anticipo explícitos | Resolver entidades/intervalos; preguntar sólo faltantes obligatorios |
| Confirmación directa | Anticipo recibido y política capturable válidos | No inferir pago de un anticipo configurado ni registrarlo por confirmar |
| Airbnb | Anticipo0/política local null, referencia y condiciones externas al confirmar | Pedir referencia/condiciones explícitas; no sincronizar plataforma |
| Inicio/fin | Estado y tiempo admitidos; preparación efectiva al iniciar | No simular checklist ni anticipar salida |
| Cancelación | Instante efectivo UTC/offset; devolución/resolución si corresponde | Mostrar cálculo Server y distinguir aprobado frente a efectivamente devuelto |

Fechas civiles y horas conservan la zona IANA de la casa; no se heredan horarios de metadatos del alojamiento. Instantes requieren UTC u offset; una hora DST ambigua/inexistente debe corregirse. Importes enteros CLP como strings conservan precisión; total/noches y saldos son derivados, no editables por el modelo.

## Reglas, acceso y restricciones

Destino `rental_reservations`, ruta `/tools/reservations`. Usuarios ordinarios requieren módulos de NodiaAI/Reservas y acceso nativo a la casa; super_admin conserva actor real y transversalidad conforme54. Cada reserva debe pertenecer al `property_id` autorizado. No exponer contactos fuera del ámbito ni incluir credenciales.

Draft sin historia monetaria permite cambios del acuerdo; cualquier pago histórico, aun voided, o confirmación restringe la edición. Status no es un campo PUT libre. Confirmar relee ocupación/bloqueos/vecinos, anticipo/política y preparaciones concretas del mismo día. Cancelar no borra historia ni registra dinero; no hay DELETE/reapertura/holds o transiciones inversas nuevos. Archivo de casa/reserva no elimina ocupación histórica ni dinero. Pagos, gastos, bloqueos y preparación conservan AI-26.

## Filtros e informes

No se crea un motor de informes en AI-25. Listado/detalle, disponibilidad, calendario, resumen y simulación conservan contratos publicados en las nueve fichas de lectura. Importes CLP mantienen grano por reserva; recibido, aprobado a devolver, retenido y pendiente se muestran separados. Los filtros combinables e informes cruzados conservan AI-30/31 y procedencia explícita; no sumar páginas ni duplicar comisiones entre productos.

## Vista previa, confirmación y recuperación

El coordinador congela comando, ámbito, cambios y precondiciones; una edición material produce nueva revisión/hash. El botón confirma esa propuesta, no concede una aprobación genérica ni un pago. IDs de same_day_approvals y platform_policy se muestran recursivamente readonly; otra intención puede corregirlos sin un editor JSON libre. El recibo atómico identifica recurso rental_reservations, operación, casa e ID; no prueba existencia actual ni disponibilidad futura.

El worker reutiliza journal y writer nativos en la misma transacción del recibo, con actor y hash canónico. Reanudar consulta primero resultados comprometidos; timeout/COMMIT incierto exige conciliación y no replay. Los conjuntos conservan pasos completados sin deshacerlos; no hay binding nuevo entre una reserva futura y otra operación. Al expirar chat se elimina contenido técnico resuelto, sin borrar registros del dominio ni preferencias aceptadas.

## Integración y evidencia

- [x] DTOs, mínimos, estados y fuentes nativos contrastados.
- [x] Preparadores/ejecutores y contratos comprobados mediante tests de casos de uso.
- [x] Disponibilidad, acceso, atomicidad y recuperación verificados con PostgreSQL/HTTP/worker reales sobre bases desechables.
- [x] Client y QA ES/EN/móvil comprobados con fixtures identificadas; no teléfono físico.
- [ ] Publicación MCP de escritura y aceptación con Gemini verificadas.

Ver [entrega71](../../../../mvp/71-nodia-ai-ai25-rental-reservation-lifecycle.md) para evidencia ejecutada y límites. Esta ficha permanece draft/unregistered y approval null; ningún test o despliegue sustituye aprobación documental.

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Compatibilidad |
|---|---|---|
| 1 | AI-25 incorpora seis operaciones internas conforme28/41 | Revalidar snapshots/propuestas ante cambios materiales; conservar recibos sin repetir efectos. Nueve cuerpos de lecturas aprobadas intactos |

## Reservas: ciclo de vida publicado en AI36-C05

Este fragmento añade sólo estas preparaciones publicadas:

- `nodia_rental_reservations_prepare_cancel`
- `nodia_rental_reservations_prepare_complete`
- `nodia_rental_reservations_prepare_confirm`
- `nodia_rental_reservations_prepare_create`
- `nodia_rental_reservations_prepare_start`
- `nodia_rental_reservations_prepare_update`

Cada herramienta recibe un partial cerrado, devuelve mínimos faltantes o propuesta revisable y permite continuar sólo con draft_id/revisión CAS exactos. No aplica el cambio de dominio. Consulta las referencias reales; nunca inventes IDs o enlaces. Sólo el botón humano sobre revisión/hash exactos admite la ejecución y su recibo nativo. No se aceptan SQL, comandos arbitrarios, secretos ni bulk/importación. Confirmar/iniciar/completar/cancelar, pagar/anular y aprobar preparación conservan sus reglas y permisos nativos. No son eliminaciones físicas ni revierten automáticamente dinero u ocupación.

El backend exige NodiaAI y cada módulo/acción de destino vigentes, reautoriza al ejecutar y conserva recuperación/idempotencia. Publicación, selección del intento, disponibilidad, despliegue y aceptación real son estados distintos. Los apartados anteriores son históricos y no amplían este lote.
