# AI-38 — Revisión independiente del alcance de aceptación C05

Fecha: 2026-10-20. Corte: preferencias verificadas; Finanzas pendiente de cierre en esta revisión. Sin solicitudes al proveedor, cambios de publicación ni modificaciones de documentos compartidos por el revisor.

## Decisión de contabilización

Si el caso financiero completa todos sus criterios, corresponde registrar **«primer lote C05: aceptación representativa acumulada de siete capacidades, 7/7»**. Ese resultado cierra el pendiente de aceptación del lote piloto. No equivale a cerrar AI-36, a acreditar las 151 capacidades registrables ni a aceptar las 74 publicadas en la instancia actual.

La formulación sin calificadores «C05 completo» puede ocultar el alcance: [82](../mvp/82-nodia-ai-ai36-integral-coverage.md#continuación-ai36-c05--publicación-selectiva-y-descubrimiento-por-etapas) distingue el primer lote de siete de los 77 candidatos restantes y de los gates por capacidad/entorno. [45](../mvp/45-nodia-ai-implementation-plan.md) conserva AI-36 y AI-38 como etapas con condiciones propias. La publicación del código fuente, la aceptación de un caso representativo y la adopción de un paquete son estados independientes.

## Evidencia ya comprobada

El cierre [R05](nodia-ai-ai36-c05-r05-validation.json) conserva cuatro aceptaciones históricas: `nodia_proposals_get`, `nodia_operations_get`, `nodia_attachments_describe` y `nodia_workflows_prepare`. R05 no añade aceptaciones. La primera corresponde a la cohorte03; operaciones y adjuntos a la cohorte08; workflows al caso independiente R02. Se mantienen sus compilados, roles e instancias originales.

El [caso de preferencias AI-38](nodia-ai-ai38-live-capabilities-preferences-r01-case.json), su [guard](nodia-ai-ai38-live-capabilities-preferences-r01-guard.json), [driver](nodia-ai-ai38-live-capabilities-preferences-r01-driver.json) y [recibo de copia exacta](nodia-ai-ai38-live-capabilities-preferences-r01-receipt.json) acreditan dos capacidades nuevas. El recibo vincula cinco archivos y sus hashes; esos hashes se verificaron localmente durante esta revisión.

- Dos generaciones reales separan selección y ejecución, con turno final `completed` y dos ACK exactos.
- `nodia_preferences_prepare`: callback completado con borrador exacto; cero preferencias antes de confirmar; confirmación HTTP del operador de prueba; un único efecto y su recibo atómico.
- `nodia_preferences_list`: callback completado cuya salida excluye la preferencia todavía no aceptada.
- La repetición de confirmación/recuperación conserva idempotencia; no se atribuye interacción física en UI ni efectos sobre registros operativos.

Al corte de esta revisión, la aceptación acumulada demostrada es **6/7**. La instrucción de continuar Finanzas o la mera existencia de su proceso no añade una aceptación.

## Compatibilidad de los siete contratos

El nuevo caso identifica la release `c70317bf3106f002a399c5449158f0cdea204a308f1016dc0053a27be3e6ad36`, con `catalog_release` `nodia-ai-ai15-reads/1`, 74 capacidades y registry hash `31add4d121c6452e1b3cf406503803fadb9bca26f5a4fa681e49b72bf281e824`. El cambio de release desde `bde409…` no cambia por sí mismo el contrato MCP de una herramienta.

Se compararon directamente los siete `per_capability.contract_hash` del caso nuevo con los mapas retenidos en el [caso workflow R02](nodia-ai-ai36-c05-r02-case-attempt01-workflow-case-report.json) y el [caso preferencias R03](nodia-ai-ai36-c05-r03-case-attempt01-preferences-case-report.json): **7/7 idénticos en ambas comparaciones**.

| Capacidad | SHA-256 MCP, idéntico R02/R03/c703 |
|---|---|
| `nodia_attachments_describe` | `38e1fe8ff894526917d47d45a96aa1b6a2ab16cb4c27459291d2583878959ad4` |
| `nodia_finance_movements_prepare_create` | `940b53baf8714b1a04cff3ef7fdd59cb126a4457199feeb3993dee9dd023ae54` |
| `nodia_operations_get` | `8e8c085c8da7deb90191fbbb74cf5386c4365434d26d89c774c5a8c6b6c64f4a` |
| `nodia_preferences_list` | `35895fb678b6d02ec4241d8daebbce602826e8c50c3af779bbcf74a98d67a39c` |
| `nodia_preferences_prepare` | `a1dd4db24e479b9baffa2848b8e0f8ccb6e21aca425e55346a14dce9ad43b4d1` |
| `nodia_proposals_get` | `dd96b92de5b86bdd807b904947706aaf103fed258122aae7b78a424a6a2e9a79` |
| `nodia_workflows_prepare` | `3f2de6818c06114ec1715fcb9e8b6dd71ef75cde9691b7e9d4e1184892ac78b2` |

También se compararon los siete objetos completos `new_capabilities` de la [publicación histórica](nodia-ai-ai36-c05-publication-validation.json) con `capability_contracts` del manifiesto c703 del candidato01: los siete coinciden, incluidos revisiones, rutas, fuentes de implementación y referencias/hashes de schemas. Esto no convierte un hash en prueba semántica de ejecución.

R05 enlaza esa misma publicación mediante SHA-256 `85c0efe12c35eb5408662a890fbf85f1e7e810342fcdcf1807d03e90d114e099`, comprobado contra el archivo actual. R05 no contiene una nueva cohorte aceptada de estas capacidades; su continuidad se apoya en el baseline y la publicación retenidos. No se presenta como una tercera medición nueva de los siete hashes en esa instancia.

## Gate financiero necesario para sumar la séptima

El cierre requiere comprobar el caso individual y sus recibos, no inferirlo del caso de preferencias ni del workflow histórico:

1. Selección publicada/exacta, callback financiero y recibo SQL ligados al run y a la llamada; hash del contrato esperado.
2. Descubrimiento y ejecución terminados, prueba nativa `completed`, proceso cerrado y ACK exacto de cada generación. Un callback dentro de un turno `unknown` sigue siendo insuficiente.
3. Aserciones semánticas financieras: borrador/propuesta exactos y cero movimiento antes de confirmar; confirmación HTTP sobre revisión/hash exactos; un movimiento esperado y recibo nativo atómico, con repetición idempotente.
4. Conciliación, SQL y estado nativo sin pendientes, cleanup de los datos/contenedor propios y mismo runtime/selección autorizados. No se reenvían resultados inciertos.

Hasta disponer del resultado financiero congelado, se conserva 6/7. Si todos esos controles pasan, el acumulado será 7/7; tres capacidades tendrán aceptación nueva en esta época y cuatro conservarán aceptación histórica bajo contratos compatibles.

## Gates que permanecen independientes

- **Cobertura global AI-36:** los 77 candidatos no publicados continúan sin habilitarse, incluido el análisis de factura. Siete casos no verifican cada operación, variante, error o permiso de los 151 candidatos. Las 67 lecturas históricas conservan su evidencia propia; no se transforman en 67 aceptaciones individuales actuales por suma aritmética.
- **Época nativa:** MCP y modalidades se acreditan para perfil/sesión/modelo/esfuerzo/configuración/rol/instancia concretos. Reiniciar o restaurar Gemini no transfiere sus pruebas efímeras. Compatibilidad de contratos permite conservar una aceptación histórica identificada, no afirmar que esas cuatro pruebas se repitieron ahora.
- **Modo, formato y flujo:** Agentic no acredita Web, Web→Agentic, API o Codex; PNG no acredita PDF o audio, ni WAV acredita WebM/Ogg. La preparación de una preferencia no acepta memoria automáticamente; una preparación financiera no confirma el gasto.
- **Entorno y UI:** estas cohortes usan Gemini real y PostgreSQL desechable, actor sintético y confirmación HTTP del operador. No certifican un clic físico, el recorrido generativo completo desde UI ni todos los efectos visibles de los dominios publicados en el entorno operativo.
- **Adopción:** el Node operativo conserva 932 assets. El paquete Node01 completo —2.827 outputs/979 assets runtime— y el Client congelado siguen sin adoptarse por este caso. El diagnóstico Python mínimo activo no equivale a desplegar esos paquetes. Migración/despliegue/reversión, dependencias, admisión, retención/backups/journal y restore externo conservan los gates de AI-38.
- **Causa y estabilidad:** éxitos nuevos no explican causalmente los timeouts históricos ni acreditan estabilidad continua, SLA, cuota o coste del proveedor. Se mantienen las evidencias fallidas y el cierre sin replay.

Recomendación documental: actualizar el contador del piloto únicamente después de validar la séptima evidencia y su cadena de hashes; mantener explícitos el carácter acumulado, el corte de época y los pendientes de AI-36/38. Esta revisión no modifica los checklists ni aprueba documentos.

## Adenda: séptima capacidad comprobada después del corte inicial

El [caso financiero congelado](nodia-ai-ai38-live-capabilities-finance-r01-case.json) terminó `passed`, con un turno completo, dos generaciones y dos ACK. El callback financiero y su recibo durable corresponden al hash `940b53ba…3ae54` de la tabla anterior. Sus cuatro aserciones pasan: preview exacta, cero efecto antes de confirmar, un movimiento esperado después de confirmar y recibo financiero atómico. El arnés también acredita recuperación sin replay y ausencia de intentos/slots/ACK pendientes en su PostgreSQL desechable.

Se verificaron los cinco hashes del [recibo de copia](nodia-ai-ai38-live-capabilities-finance-r01-receipt.json) contra sus archivos locales. Por tanto, el contador representativo acumulado del primer lote C05 puede actualizarse a **7/7**. Tres capacidades tienen aceptación nueva en esta época; las otras cuatro conservan sus cohortes históricas y sus contratos compatibles. Esta adenda no modifica ninguno de los límites, ámbitos ni gates independientes enumerados arriba.
