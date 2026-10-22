# ADR-055 — Fuentes lógicas y consultas restringidas de NodiaAI

> Estado: propuesto; implementación técnica autorizada en AI-30, sin aprobación documental automática.
> Fecha: 2026-10-17.

## Contexto

Los contratos41 requieren filtros y agregaciones combinables sobre campos y relaciones permitidos, conservando autoridad y exactitud. Consultar páginas nativas y sumarlas pierde el total; joins 1:N duplican hechos; introspección del ORM o SQL generado por un modelo amplían una superficie sin límites.

## Opciones consideradas

### SQL o introspección dinámica

Amplía cobertura rápidamente, pero expone identificadores físicos y no garantiza grano, autorización ni semántica monetaria.

### Tablas analíticas y un constructor universal

Facilita análisis futuros, a costa de duplicar datos, retención, sincronización y reglas de autorización para una v1 sin esa necesidad demostrada.

### Registro explícito en código y compilador acotado

Requiere incorporar cada fuente deliberadamente. Ofrece contratos tipados, filtros parametrizados y pruebas por fuente sin tablas nuevas.

## Decisión

Registrar fuentes lógicas inmutables con descriptores públicos separados de SQL privado. Versionar todo el mapeo mediante hash. Compilar filtros planos, medidas y dimensiones admitidas; usar EXISTS por predicado relacionado y un único CTE de población filtrada del que salen grupos, totales y conteo. Nunca SUM(DISTINCT importe). Las condiciones relacionadas son existencias independientes, sin expresar misma fila hija o NOT EXISTS.

Cada consulta de fuente utiliza una transacción READ COMMITTED y una sola sentencia para sus datos; la barrera de autoridad precede sus consultas. Reutilizar runFinanceScope y RentalTransactionService.read mantiene propiedad, super_admin y bloqueo de la casa frente a revocación. El manager prestado debe tener aislamiento READ COMMITTED: se rechazan snapshots anteriores que podrían ocultar una revocación. Los cursores keyset son posiciones ligadas a consulta/versión/actor/sesión/ámbito, no credenciales; cada página se reautoriza y puede observar cambios confirmados entre páginas. No prometer un snapshot persistente del informe completo.

Finanzas22 define pesos enteros y no una moneda ISO: una suma de la misma fuente conserva unit=peso y currency=null, como sus resúmenes nativos. Nunca se convierte en CLP ni se compara con otra fuente por ese nombre. Reservas declara CLP en28. Facturas carece de unidad/moneda contractual y su suma monetaria se rechaza; un conteo sigue siendo válido. Fechas legacy sin zona se describen pero no se ofrecen como instantes ni agrupaciones/períodos temporales.

AI-30 expone casos de uso internos y registro detallado. AI-31 ensambla el contrato ReportResult, procedencias múltiples, partial, compare_compatible y presentación. La publicación HTTP/MCP tiene sus gates propios; documentación o DI no publican herramientas.

## Consecuencias

- Sin tablas, migraciones, SQL libre, nuevos servicios o dependencias.
- Una fuente nueva requiere mapeo explícito, documentación y pruebas de exactitud/autoridad.
- Los grupos se acotan y las consultas conservan timeout SQL; una población grande puede exceder el presupuesto y debe fallar explícitamente.
- El CTE materializa población filtrada; planes e índices se evalúan con evidencia, sin afirmar escala productiva por el diseño.
- Quedan fuera combinaciones de fuentes, conversión monetaria, granularidades temporales derivadas, HAVING y joins arbitrarios.

## Referencias

- [Contratos41](../../mvp/41-nodia-ai-v1-contracts.md).
- [Entrega AI-30](../../mvp/76-nodia-ai-ai30-restricted-reports.md).
- [Finanzas22](../../mvp/22-personal-finance-contracts.md).
- [Reservas28](../../mvp/28-rental-reservations-contracts.md).
