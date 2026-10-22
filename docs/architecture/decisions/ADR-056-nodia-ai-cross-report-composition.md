# ADR-056 — composición acotada y observación de informes NodiaAI

> Estado: propuesto
> Fecha: 2026-10-17

## Contexto

AI-30 calcula una fuente con autoridad nativa y agregados exactos. AI-31 debe combinar ámbitos con posibles fallos independientes, sin multiplicar hechos, perder precisión o presentar resultados parciales como completos. Una transacción PostgreSQL fallida no permite seguir consultando las demás fuentes.

## Opciones consideradas

### Una consulta o transacción global

Permitiría una fotografía conjunta, pero acopla fuentes y políticas nativas, amplía los locks y hace que un fallo invalide todo el informe. Un join directo entre hechos de distinto grano introduce fan-out.

### Composición de resultados por fuente

Reutiliza el motor verificado, conserva semántica, ámbitos y totales completos; requiere declarar fotografías independientes y reautorizar antes de guardar/entregar el resultado. Comparar grupos paginados independientemente necesita una garantía adicional de alineación.

## Decisión

Componer fuentes secuencialmente en transacciones independientes y acotadas. Cada bloque conserva totales exactos, grupos, ámbito, base temporal y observed_at. No existe una suma general implícita ni conversión monetaria. compare_compatible exige igualdad comprobable de unidad, moneda, escala, significado, grano, período/base y dimensiones. Si la comparación agrupada necesitaría otra página, se rechaza y se indica usar separate o refinar filtros; nunca se alinea una página incompleta como si fuera el conjunto.

Publicar dos puertos técnicos de lectura en el gateway existente: nodia_reports_describe y nodia_reports_run. Su contrato incluye el registro lógico y el schema específico del resultado, se congela por turno y exige el grant Agentic. Esto no publica fichas draft ni preparadores de escritura. Cada llamada reserva su recibo antes de calcular; después, un checkpoint nuevo revalida grant y todos los ámbitos exitosos, valida el resultado y persiste recibo/evento. Repetir el mismo callback completado devuelve el recibo reautorizado; una reserva incierta no recalcula automáticamente.

La lectura humana del recibo verifica chat, contrato, integridad y autoridad nativa actual, sin ejecutar agregados o proveedor. Un super_admin que inspecciona otro chat conserva el ámbito originalmente resuelto y usa su autoridad actual. El chat muestra primero totales separados; expandir grupos usa las filas persistidas del mismo filtro.

## Consecuencias

- No se añaden tablas analíticas, migraciones, dependencias ni rutas HTTP.
- Los fallos de una fuente son desconocidos y el estado partial sigue explícito durante la paginación; nunca representan cero.
- Cada página tiene observaciones propias; no se promete fotografía conjunta ni estabilidad de datos entre páginas.
- Cancelar impide nuevas fuentes y la publicación; una sentencia ya iniciada conserva el timeout SQL acotado del motor.
- El detalle disponible son grupos agregados del informe. Los registros individuales y exportaciones conservan sus contratos existentes.
- La aceptación de una inferencia real con estas dos herramientas se acredita separadamente de SQL, gateway y UI sintéticos.

## Referencias

- [Contratos41](../../mvp/41-nodia-ai-v1-contracts.md)
- [Plan45](../../mvp/45-nodia-ai-implementation-plan.md)
- [AI-30](../../mvp/76-nodia-ai-ai30-restricted-reports.md)
- [AI-31](../../mvp/77-nodia-ai-ai31-cross-reports.md)
