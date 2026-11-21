# Descubrimiento de Gemini Agentic y catálogo de productos — 2026-11-21

## Frontera del timeout observado

El intento anterior usó la conexión Gemini Agentic del laboratorio,
`gemini-3.8-flash-high` con esfuerzo `high`. El puente construyó, escribió y
vació en stdout la respuesta de `tools/list` de 12.797 bytes. La identidad
de agente y modelo coincidió y el CLI confirmó recepción del prompt. El
CLI registró 116 segundos sin nuevos eventos antes del `TimeoutError`
local de 119 segundos. Hubo cero llamadas de herramientas, cero decisiones
del hook y cero resultados. El contexto controlado quedó en 50.416 de
262.144 bytes. Los indicadores sanitizados de red y HTTP quedaron vacíos.

La espera se localiza antes del primer `tools/call`. La evidencia del
bridge termina en el flush y la del CLI en la recepción del prompt.
El motivo interno del CLI o de la inferencia remota sigue indeterminado.
El rechazo auxiliar anterior a `initialize` también se observó en una
[ejecución que sí terminó](nodia-ai-ai38-mcp-post-list-readonly-r01.md).
El intento original quedó reconciliado y acusado.

## Variantes ensayadas

Un primer candidato aplazó las fichas de conocimiento en descubrimiento
y completó el turno. Un recibo de Productos coincidió con los once
registros de PostgreSQL. El verificador inicial esperaba exactamente una
llamada de Productos y Gemini hizo varias. Esa ejecución acredita
respuesta persistida y ACK. El verificador inicial no llegó al cotejo
del texto final.

El segundo candidato también compactó los metadatos de capacidades.
En la misma entrada, el contexto canónico bajó de 23.304 a 14.186 bytes.
Gemini agotó el plazo en descubrimiento con un `tools/list` exitoso y
cero llamadas. Se reconcilió y acusó el intento. Se retiraron ambas
variantes del cambio final, pues reducir el tamaño del prompt no
resolvió la espera.

## Perfil de consulta de productos

Las solicitudes de texto que piden inequívocamente listar productos con
precios, o consultar cuánto cuestan, pueden usar el perfil
`product_catalog_reads` en Gemini Agentic. La detección se limita a
formas acotadas en español e inglés. La admisión comprueba que la
selección exacta tiene MCP observado y que el actor tiene acceso actual
a ambas lecturas publicadas. Solicitudes mixtas, otros modos o falta de
autoridad mantienen el descubrimiento normal.

El perfil congela `nodia_businesses_list` y `nodia_products_list` con
el mecanismo existente. Gemini inicia la ejecución en una generación
y puede resolver el negocio por nombre, con la autorización de ámbito
revalidada al consultar. Se conservan el plazo nativo, los esquemas MCP,
la reconciliación y el manejo de resultados inciertos. El cambio evita
la generación de descubrimiento para este caso. La demora interna
intermitente del CLI sigue sin una explicación comprobable.


## Verificación del perfil en la VM

El mismo modelo y esfuerzo respondieron en una generación. La pregunta
incluyó el nombre del negocio y pidió precios vigentes en CLP, con el
precio regular en caso de oferta. El operador verificó que el ID quedó
fuera del prompt inicial.

Un `tools/list` exitoso mostró las siete herramientas técnicas y las dos
lecturas del perfil. Gemini llamó a `nodia_businesses_list` y después a
`nodia_products_list`. Hubo siete consultas de Productos. Una devolvió
la página completa y las restantes consultaron páginas o subconjuntos.
El recibo completo y la respuesta final coincidieron en los once
productos, sus importes vigentes y el precio regular del producto en
oferta. El recibo quedó acusado y se retiró PostgreSQL aislado con cero
trabajos pendientes, recursos retenidos o propuestas.

Pasaron 258 pruebas focalizadas de admisión, detector, selección y
worker, la compilación de Server, la auditoría de catálogo y la
integración de lecturas con PostgreSQL desechable. Oxlint reportó una
advertencia previa en una fixture ajena. La comprobación real cubre esta
ruta de consulta con la selección exacta en la VM.

SHA-256 del registro sanitizado del turno: `d7512f73a4f01b992a7e90e86c9ab6f588fb4407ed72b3d419d21aca88734b35`.
