# Mantenimiento del workspace — 2026-10-23

Se eliminaron 27.837 archivos descartables (1.101.987.786 bytes, aproximadamente 1,10 GB): experimentos de `.tmp/` y `.temp/`, capturas sin referencias, logs intermedios, cobertura generada, cachés Python y metadatos incrementales de TypeScript. El [informe](cleanup-2026-10-23.json) contiene los grupos y verificaciones. Los patrones se ignoran en Git para próximas ejecuciones.

Se conservan pruebas existentes, evidencia consolidada, dependencias, caché del Vite activo, compilados, sesiones y credenciales. No se reiniciaron servicios, desplegaron cambios ni modificaron datos de negocio. Los scripts históricos de evidencia conservan rutas temporales de origen que ya no existen; no son dependencias operativas mantenidas. Los empaquetadores AI40 sí usan ahora el paquete preservado.

## Finales de línea e integridad histórica

797 archivos se normalizaron mediante reemplazo exacto CRLF→LF; otro AGENTS ya fue normalizado por la edición de política. `.gitattributes` y `.editorconfig` ya exigían LF. El análisis final de texto propio gestionado no encontró CRLF. Se excluyen binarios, dependencias, secretos, perfiles y sesiones.

El [manifiesto de normalización](lf-normalization-manifest.json) registra hashes y tamaños anteriores/posteriores. [El ZIP de originales](pre-lf-originals-2026-10-23.zip) conserva los 797 originales, verificados por entrada. Estos originales permiten comprobar hashes históricos; no se reescribieron recibos ni aprobaciones antiguas. Una copia LF no acredita el hash de sus bytes CRLF originales. Las ediciones deliberadas posteriores (política, rutas y procedencia técnica activa) se distinguen en el informe de limpieza.

El registro activo de conocimiento requiere 85 hashes técnicos nuevos: conserva 74 capacidades, 31 bindings y 31 fragmentos, permisos, revisiones y aprobación documental. El build local calcula `06bf13b7fd4dc03f1ba7334bf42e96ffa8deb4091092cdae15830d2b43226474`; no se adoptó en la VM. No hay nueva funcionalidad ni modificación semántica de las fichas.

## Recuperación conservada

`ops/lab/artifacts/` es local e ignorado: contiene el paquete base AI38, los tres paquetes AI40 aún útiles, el plan de adopción y el respaldo previo a contactos de proveedores. Sus tamaños y SHA256 están en el informe. No contiene material para publicar; el respaldo puede contener datos privados. La limpieza de estos elementos requiere evaluar su utilidad de recuperación, no tratarlos como temporales.

El [catálogo de entradas de aceptación](retained-acceptance-inputs.json) identifica nueve originales conservados en un ZIP local, incluidos los reportes finales AI40 y el log AI32 enlazado por hash. La herramienta compartida de acceso a la VM quedó en `ops/lab/remote.py`; su original también está archivado. La imagen AI15 enlazada se trasladó a `docs/evidence/` y se corrigió su enlace. El respaldo de contactos se referencia desde su especificación31 con la ubicación nueva.

## Pruebas y verificación

Los AGENTS raíz y de Client, Server y Gemini priorizan lógica atómica, funciones, validadores, hooks y componentes con comportamiento observable. Las páginas y secciones compuestas no requieren suites por defecto. La integración se reserva para garantías concretas entre unidades (permisos, transacciones, concurrencia, idempotencia). No se eliminaron ni desactivaron pruebas existentes por esta política.

Pasaron ambos builds, `knowledge:check`, `knowledge:build`, la comprobación de hashes archivados y el análisis sintáctico de 120 Python normalizados. Client conserva un aviso de tamaño de chunks. No se repitieron inferencias reales ni suites generales por un cambio de formato. El validador histórico de conocimiento mantiene su incompatibilidad previa: reconstruye el corte congelado AI32-R02 (67 capacidades/27 fragmentos), anterior al registro vigente. No se modificó esa evidencia para aparentar una aceptación nueva.
