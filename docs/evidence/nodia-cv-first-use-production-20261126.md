# Primer uso de modelos y reapertura de Nodia CV en producción

Fecha de verificación 2026-11-26, entre 16:51 y 16:58 UTC. Se usó una
pestaña de QA autenticada y un perfil sintético existente.

## Entrega

El CI del commit `3efde892276fcaf8df31949dd73f8cd4cd5fca2c` ensayó
la migración `1794060000000` con las dos versiones de Server. El CD
publicó ambos componentes. El receptor confirmó la operación
`e4717d41e7485d245577253a88c52b2a` como completa, con migración y
despliegue realizados. API y worker activos en
`backend-3efde892276f-5b67514b9adf`. El navegador cargó
`/assets/main-CZxajTKP.js` en la URL canónica.
[CI](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45858819392) ·
[CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45861420638).

## Generación ordinaria

Antes del despliegue, GPT-6.1 Sol en Bajo aparecía en el catálogo y la
interfaz impedía aplicar la selección por falta de calificación. GPT-6.1
Terra en Alto por API key mostraba el mismo bloqueo. Después del
despliegue, la interfaz permitió aplicar ambas selecciones e iniciar su
primer borrador. Las cuatro pruebas enviaron una intención distinta
desde el botón de generación.

| Conexión y modo | Modelo e intensidad aplicada | Resultado |
| --- | --- | --- |
| ChatGPT Agentic | GPT-6.1 Sol en Bajo | Borrador y PDF comprobado. TypeScript con evidencia y Kubernetes como brecha |
| ChatGPT Agentic | GPT-6 Luna sin intensidad seleccionada | Borrador y PDF comprobado. TypeScript con evidencia y Go como brecha |
| ChatGPT API key | GPT-6.1 Terra en Alto | Borrador y PDF comprobado. TypeScript con evidencia y Terraform como brecha |
| Gemini Agentic | Gemini 4 Neon en Bajo | Borrador y PDF comprobado. TypeScript con evidencia y Rust como brecha |

## Navegación y versiones

- La versión 2 de la prueba con GPT-6.1 Sol en Bajo se guardó y apareció en
  **CV guardados**. Abrirla recuperó ambos requisitos, su evidencia y el
  texto extraído de la revisión. El análisis se presentó en solo lectura.
  La verificación interna del archivo exacto pasó y se descargó la versión.
- Tras pasar por **Perfiles** y volver a **Generar CV**, se observó la vista
  inicial, sin requisitos ni el aviso de solicitud anterior. El texto de la
  oferta seguía disponible. Editar la oferta de la ejecución de Terra
  también retiró su vista previa y sus requisitos.
- La versión 1 de una prueba anterior recuperó sus requisitos mediante la
  migración y conservó el PDF comprobado. PostgreSQL aislado cubrió el caso
  histórico con la fuente vencida, que devuelve el análisis como ausente y
  mantiene los bytes del PDF.

La suite completa local de Client pasó 3.589 pruebas. Server pasó sus 161
pruebas de CV y las integraciones de generación Agentic, API key y versiones
sobre PostgreSQL 16. El resultado incierto histórico de Gemini Hydrogen en
Alto conserva su alcance registrado en
[Plan113 §18](../mvp/113-nodia-cv-implementation-plan.md#publicación-y-prueba-en-navegador).
