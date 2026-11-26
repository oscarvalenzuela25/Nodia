# Guardado, descarte y edición de borradores de Nodia CV

Verificación de producción el 2026-11-26. El recorrido utilizó una
pestaña de QA y perfiles y ofertas sintéticos.

## Guardar o descartar al salir

El primer despliegue publicó Client del commit
`6010839e9921eb01689ce9181dc4ade1f9860008`. Pages sirvió
`/assets/main-DyNQIahF.js`. La operación verificó el backend
`backend-3efde892276f-5b67514b9adf`, con API y worker activos.
[CI](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45871549371) ·
[CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45873252944).

- Antes del cambio, una recarga tras generar con una oferta sintética
  conservó su referencia. GPT-6.1 Sol en Alto se podía aplicar y
  el aviso **Recuperar oferta y borrador** bloqueaba **Generar borrador**.
- Después de publicar, la misma pestaña admitió una oferta nueva con
  GPT-6.1 Sol en Alto. El borrador presentó el requisito nuevo de PostgreSQL.
  El aviso anterior dejó de aparecer.
- Navegar a **Perfiles** abrió el diálogo y enfocó **Seguir editando**.
  Elegir esa opción conservó el borrador. Al pedir **CV guardados**,
  **Guardar borrador** preparó el PDF, guardó la versión 3 y continuó.
  La reapertura mostró el análisis nuevo y pasó la verificación del PDF.
- Al regresar a **Generar CV**, se observó la vista inicial sin la oferta
  anterior superpuesta. Con otro borrador generado mediante GPT-6.1 Terra
  en Alto por API key, navegar a **Inicio** abrió el diálogo.
  **Descartar** permitió salir y conservó el historial sin una versión
  para ese borrador.
- Una generación sintética adicional en ChatGPT Agentic terminó con un
  error comunicado en el formulario. El recorrido de descarte usó una
  intención distinta en API key.

## Editar con IA y reabrir el CV

El segundo despliegue publicó el commit
`19354f003d157a371a6cb2ed36271889026f5b2e`. El CI ensayó la
migración `1794070000000`. El VPS confirmó completa la operación
`55a1d2db1bd7a21ebb6af12ce994f64d`, con API y worker activos en
`backend-19354f003d15-81bc507e4fea`. El navegador recibió
`/assets/main-D3-ol-8X.js`. [CI](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45873965071) ·
[CD](https://github.com/oscarvalenzuela25/Nodia/actions/runs/45875662999).

- **GPT-6.1 Sol en Alto por Agentic.** El borrador incluía PostgreSQL,
  TypeScript y un proyecto. **Editar con IA** propuso retirar PostgreSQL y
  mover Competencias antes de Proyectos. El documento original continuó
  visible hasta **Aplicar cambios**. La vista nueva mantuvo TypeScript, el
  proyecto y el análisis de la oferta.
- La plantilla Compacta se conservó al aplicar. **Guardar borrador** creó
  la versión 4. Desde **CV guardados**, la lectura del PDF exacto verificó
  Competencias antes de Proyectos y la ausencia de PostgreSQL en el texto
  del documento. El requisito de la oferta siguió disponible en el análisis.
- **GPT-6.1 Terra en Alto por API key.** Una segunda edición propuso omitir
  el proyecto. **Conservar original** mantuvo el proyecto visible. Descartar
  el borrador al salir dejó esa propuesta fuera de **CV guardados**.

Las pruebas locales de edición cubrieron 55 pruebas de Client y 201
pruebas unitarias de Server en el alcance afectado. Cuatro suites de
PostgreSQL 16 comprobaron permisos HTTP, revisión, carreras, retry
por la clave original, purga y los carriles de API key, Codex y Gemini
con transportes de prueba. Las ejecuciones reales de este registro
corresponden a los dos modelos y modos indicados.
